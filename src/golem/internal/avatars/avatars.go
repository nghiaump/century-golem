// Package avatars keeps the players' own avatar pictures for as long as a room uses them.
//
// The browser shrinks the picked image (≤ 5 MB) to a 256×256 JPEG and uploads that; the server decodes
// it again, crops it square, scales it to at most 256 px and re-encodes it, which also drops any
// metadata (EXIF, GPS) or extra bytes in the file. Pictures live only in memory: a picture is tied to
// the rooms whose players wear it and is deleted as soon as the last of those rooms is removed; a
// picture no room picked up within PendingTTL is deleted too. Nothing is written to disk or to the
// event store, and total memory is capped.
//
// HTTP (routed by server.WrapWithCORS, since the route table in cmd/ is not ours to change):
//
//	POST /api/avatars            body: image/jpeg or image/png (≤ 1 MB) → {"avatar": "u_<16 hex>"}
//	GET  /api/avatars/<id>.jpg   → the picture, or 404 once it has been deleted
package avatars

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"image"
	"image/color"
	"image/jpeg"
	_ "image/png" // PNG uploads are accepted too
	"io"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"
)

const (
	// MaxUploadBytes bounds an upload. The browser already shrank the picture (the 5 MB limit applies
	// to the file the player picks), so a real upload is ~20–40 KB.
	MaxUploadBytes = 1 << 20
	// Size is the side of the stored square picture (enough for a 68 px avatar on a 3× screen).
	Size = 256
	// MaxSourceSide rejects oversized images before decoding them (decompression bombs).
	MaxSourceSide = 2048
	// MinSourceSide rejects images too small to be a picture.
	MinSourceSide = 32
	// PendingTTL deletes an uploaded picture that no room picked up (e.g. the player never started).
	PendingTTL = 15 * time.Minute
	// MaxEntries and MaxBytes cap memory (oldest unused pictures go first).
	MaxEntries = 400
	MaxBytes   = 24 << 20
	quality    = 85
	pathPrefix = "/api/avatars"
)

var (
	ErrNotImage = errors.New("not a JPEG or PNG image")
	ErrTooLarge = errors.New("image too large")
	ErrTooSmall = errors.New("image too small")
	ErrFull     = errors.New("too many avatars right now, try again later")

	idPattern = regexp.MustCompile(`^u_([0-9a-f]{16})$`)
)

type entry struct {
	data     []byte
	sessions map[string]struct{}
	created  time.Time
}

// Store holds the pictures in memory. Safe for concurrent use.
type Store struct {
	mu    sync.Mutex
	m     map[string]*entry
	bytes int
	now   func() time.Time
}

// New returns an empty store.
func New() *Store { return &Store{m: map[string]*entry{}, now: time.Now} }

// Default is the server's store (the WebSocket handler attaches avatars, room cleanup releases them).
var Default = New()

// ID returns the store key of a custom avatar value ("u_<16 hex>"), false for built-in avatars ("1".."24").
func ID(avatar string) (string, bool) {
	m := idPattern.FindStringSubmatch(avatar)
	if m == nil {
		return "", false
	}
	return m[1], true
}

// Put processes an uploaded image and keeps it until a room uses it (or PendingTTL passes).
// Uploading the same picture again returns the same value.
func (s *Store) Put(raw []byte) (string, error) {
	data, err := process(raw)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(data)
	id := hex.EncodeToString(sum[:8])

	s.mu.Lock()
	defer s.mu.Unlock()
	s.sweepLocked()
	if e, ok := s.m[id]; ok {
		if len(e.sessions) == 0 {
			e.created = s.now() // fresh grace period
		}
		return "u_" + id, nil
	}
	for len(s.m) >= MaxEntries || s.bytes+len(data) > MaxBytes {
		if !s.evictOldestPendingLocked() {
			return "", ErrFull
		}
	}
	s.m[id] = &entry{data: data, sessions: map[string]struct{}{}, created: s.now()}
	s.bytes += len(data)
	return "u_" + id, nil
}

// Get returns a stored picture by its key.
func (s *Store) Get(id string) ([]byte, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sweepLocked()
	e, ok := s.m[id]
	if !ok {
		return nil, false
	}
	return e.data, true
}

// Attach ties a custom avatar to a room (a player joined it wearing that avatar).
func (s *Store) Attach(sessionID, avatar string) {
	id, ok := ID(avatar)
	if !ok || sessionID == "" {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if e, ok := s.m[id]; ok {
		e.sessions[sessionID] = struct{}{}
	}
}

// ReleaseSession forgets a removed room; pictures no other room uses are deleted at once.
func (s *Store) ReleaseSession(sessionID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for id, e := range s.m {
		if _, ok := e.sessions[sessionID]; !ok {
			continue
		}
		delete(e.sessions, sessionID)
		if len(e.sessions) == 0 {
			s.deleteLocked(id)
		}
	}
}

// Len reports how many pictures are stored (tests, logs).
func (s *Store) Len() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.m)
}

func (s *Store) deleteLocked(id string) {
	if e, ok := s.m[id]; ok {
		s.bytes -= len(e.data)
		delete(s.m, id)
	}
}

// sweepLocked deletes pictures no room picked up within PendingTTL.
func (s *Store) sweepLocked() {
	cutoff := s.now().Add(-PendingTTL)
	for id, e := range s.m {
		if len(e.sessions) == 0 && e.created.Before(cutoff) {
			s.deleteLocked(id)
		}
	}
}

func (s *Store) evictOldestPendingLocked() bool {
	oldest := ""
	for id, e := range s.m {
		if len(e.sessions) == 0 && (oldest == "" || e.created.Before(s.m[oldest].created)) {
			oldest = id
		}
	}
	if oldest == "" {
		return false
	}
	s.deleteLocked(oldest)
	return true
}

// process decodes, crops to the centre square, scales to ≤ Size and re-encodes as JPEG.
func process(raw []byte) ([]byte, error) {
	cfg, format, err := image.DecodeConfig(bytes.NewReader(raw))
	if err != nil || (format != "jpeg" && format != "png") {
		return nil, ErrNotImage
	}
	if cfg.Width > MaxSourceSide || cfg.Height > MaxSourceSide {
		return nil, ErrTooLarge
	}
	if cfg.Width < MinSourceSide || cfg.Height < MinSourceSide {
		return nil, ErrTooSmall
	}
	src, _, err := image.Decode(bytes.NewReader(raw))
	if err != nil {
		return nil, ErrNotImage
	}
	b := src.Bounds()
	side := min(b.Dx(), b.Dy())
	min0 := image.Pt(b.Min.X+(b.Dx()-side)/2, b.Min.Y+(b.Dy()-side)/2)
	crop := image.Rectangle{Min: min0, Max: min0.Add(image.Pt(side, side))}
	out := scale(src, crop, min(side, Size))
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, out, &jpeg.Options{Quality: quality}); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// scale resamples the square `crop` of src to n×n by averaging the source pixels under each output
// pixel (area filter: sharp enough for downscaling, no aliasing). Opaque output (JPEG has no alpha:
// transparent PNG areas become the dark page colour).
func scale(src image.Image, crop image.Rectangle, n int) *image.RGBA {
	out := image.NewRGBA(image.Rect(0, 0, n, n))
	side := crop.Dx()
	bg := [3]float64{18, 19, 28} // rock-950
	for oy := 0; oy < n; oy++ {
		y0 := crop.Min.Y + oy*side/n
		y1 := max(y0+1, crop.Min.Y+(oy+1)*side/n)
		for ox := 0; ox < n; ox++ {
			x0 := crop.Min.X + ox*side/n
			x1 := max(x0+1, crop.Min.X+(ox+1)*side/n)
			var r, g, bl, cnt float64
			for y := y0; y < y1; y++ {
				for x := x0; x < x1; x++ {
					cr, cg, cb, ca := src.At(x, y).RGBA()
					a := float64(ca) / 0xffff
					r += float64(cr>>8) + (1-a)*bg[0]
					g += float64(cg>>8) + (1-a)*bg[1]
					bl += float64(cb>>8) + (1-a)*bg[2]
					cnt++
				}
			}
			out.SetRGBA(ox, oy, color.RGBA{uint8(r / cnt), uint8(g / cnt), uint8(bl / cnt), 255})
		}
	}
	return out
}

// Match reports whether a request is for this package's routes.
func Match(path string) bool {
	return path == pathPrefix || strings.HasPrefix(path, pathPrefix+"/")
}

// ServeHTTP handles upload (POST /api/avatars) and download (GET /api/avatars/<id>.jpg).
func (s *Store) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("X-Content-Type-Options", "nosniff")
	switch {
	case r.Method == http.MethodPost && r.URL.Path == pathPrefix:
		raw, err := io.ReadAll(http.MaxBytesReader(w, r.Body, MaxUploadBytes))
		if err != nil {
			writeJSON(w, http.StatusRequestEntityTooLarge, map[string]string{"error": "image too large"})
			return
		}
		avatar, err := s.Put(raw)
		switch {
		case errors.Is(err, ErrFull):
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": err.Error()})
		case err != nil:
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		default:
			writeJSON(w, http.StatusOK, map[string]string{"avatar": avatar})
		}
	case r.Method == http.MethodGet || r.Method == http.MethodHead:
		name := strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, pathPrefix+"/"), ".jpg")
		id, ok := ID("u_" + name)
		if !ok {
			http.NotFound(w, r)
			return
		}
		data, ok := s.Get(id)
		if !ok {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "image/jpeg")
		// private: browsers may keep it for the session, shared caches (Cloudflare) must not keep a copy
		w.Header().Set("Cache-Control", "private, max-age=3600")
		w.Header().Set("Content-Security-Policy", "default-src 'none'")
		w.WriteHeader(http.StatusOK)
		if r.Method == http.MethodGet {
			_, _ = w.Write(data)
		}
	default:
		w.Header().Set("Allow", "GET, POST")
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
