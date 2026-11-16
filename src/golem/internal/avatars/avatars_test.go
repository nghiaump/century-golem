package avatars

import (
	"bytes"
	"encoding/json"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func photo(t *testing.T, w, h int, enc string) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, color.RGBA{uint8(x), uint8(y), 120, 255})
		}
	}
	var buf bytes.Buffer
	var err error
	if enc == "png" {
		err = png.Encode(&buf, img)
	} else {
		err = jpeg.Encode(&buf, img, &jpeg.Options{Quality: 95})
	}
	if err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

// A JPEG with an EXIF APP1 segment (e.g. GPS) right after SOI.
func withExif(jpg []byte) []byte {
	exif := append([]byte{0xFF, 0xE1, 0x00, 0x10}, []byte("Exif\x00\x00GPS-SECRET")...)
	return append(append([]byte{0xFF, 0xD8}, exif...), jpg[2:]...)
}

func TestPut_CropsScalesAndReencodes(t *testing.T) {
	s := New()
	avatar, err := s.Put(withExif(photo(t, 800, 600, "jpeg")))
	if err != nil {
		t.Fatal(err)
	}
	id, ok := ID(avatar)
	if !ok {
		t.Fatalf("bad avatar value %q", avatar)
	}
	data, ok := s.Get(id)
	if !ok {
		t.Fatal("picture not stored")
	}
	cfg, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || format != "jpeg" || cfg.Width != Size || cfg.Height != Size {
		t.Fatalf("want a %d×%d JPEG, got %s %d×%d (%v)", Size, Size, format, cfg.Width, cfg.Height, err)
	}
	if bytes.Contains(data, []byte("GPS-SECRET")) || bytes.Contains(data, []byte("Exif")) {
		t.Fatal("metadata must not survive the re-encode")
	}
	// the same upload again → same value, still one picture
	again, _ := s.Put(withExif(photo(t, 800, 600, "jpeg")))
	if again != avatar || s.Len() != 1 {
		t.Fatalf("re-upload must be idempotent: %q vs %q, %d stored", again, avatar, s.Len())
	}
	// PNG accepted; small pictures keep their size (no upscaling)
	small, err := s.Put(photo(t, 100, 120, "png"))
	if err != nil {
		t.Fatal(err)
	}
	sid, _ := ID(small)
	data, _ = s.Get(sid)
	if cfg, _, _ := image.DecodeConfig(bytes.NewReader(data)); cfg.Width != 100 || cfg.Height != 100 {
		t.Fatalf("small picture cropped to 100×100, got %d×%d", cfg.Width, cfg.Height)
	}
}

func TestPut_RejectsBadInput(t *testing.T) {
	s := New()
	if _, err := s.Put([]byte("<svg onload=alert(1)>")); err != ErrNotImage {
		t.Fatalf("non-image: %v", err)
	}
	if _, err := s.Put(photo(t, MaxSourceSide+1, 64, "png")); err != ErrTooLarge {
		t.Fatalf("too large: %v", err)
	}
	if _, err := s.Put(photo(t, 10, 10, "png")); err != ErrTooSmall {
		t.Fatalf("too small: %v", err)
	}
	if s.Len() != 0 {
		t.Fatal("rejected uploads must not be stored")
	}
}

func TestLifecycle_GoesWithTheRoom(t *testing.T) {
	s := New()
	now := time.Unix(1_000_000, 0)
	s.now = func() time.Time { return now }

	a, _ := s.Put(photo(t, 300, 300, "jpeg"))
	id, _ := ID(a)
	s.Attach("room1", a)
	s.Attach("room2", a)
	s.Attach("room1", "4") // built-in avatars are ignored

	s.ReleaseSession("room1")
	if _, ok := s.Get(id); !ok {
		t.Fatal("still used by room2")
	}
	now = now.Add(PendingTTL * 3) // attached pictures don't expire
	if _, ok := s.Get(id); !ok {
		t.Fatal("a picture in use must not expire")
	}
	s.ReleaseSession("room2")
	if _, ok := s.Get(id); ok || s.Len() != 0 {
		t.Fatal("deleted with the last room")
	}

	// uploaded but never used: gone after PendingTTL
	b, _ := s.Put(photo(t, 300, 300, "png"))
	bid, _ := ID(b)
	now = now.Add(PendingTTL - time.Minute)
	if _, ok := s.Get(bid); !ok {
		t.Fatal("kept during the grace period")
	}
	now = now.Add(2 * time.Minute)
	if _, ok := s.Get(bid); ok {
		t.Fatal("unused picture must expire")
	}
}

func TestPut_MemoryCapEvictsUnusedFirst(t *testing.T) {
	s := New()
	now := time.Unix(2_000_000, 0)
	s.now = func() time.Time { now = now.Add(time.Second); return now }
	used, _ := s.Put(photo(t, 64, 64, "png"))
	s.Attach("room", used)
	for i := 0; i < MaxEntries+5; i++ {
		img := image.NewRGBA(image.Rect(0, 0, 40, 40))
		img.Set(i%40, i/40%40, color.RGBA{255, uint8(i), uint8(i >> 8), 255})
		var buf bytes.Buffer
		_ = png.Encode(&buf, img)
		if _, err := s.Put(buf.Bytes()); err != nil {
			t.Fatalf("upload %d: %v", i, err)
		}
	}
	if s.Len() > MaxEntries {
		t.Fatalf("cap: %d > %d", s.Len(), MaxEntries)
	}
	if id, _ := ID(used); func() bool { _, ok := s.Get(id); return !ok }() {
		t.Fatal("a picture in use must never be evicted")
	}
}

func TestHTTP_UploadAndDownload(t *testing.T) {
	s := New()
	rec := httptest.NewRecorder()
	s.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/avatars", bytes.NewReader(photo(t, 400, 400, "jpeg"))))
	var res map[string]string
	if rec.Code != http.StatusOK || json.Unmarshal(rec.Body.Bytes(), &res) != nil {
		t.Fatalf("upload: %d %s", rec.Code, rec.Body.String())
	}
	id, ok := ID(res["avatar"])
	if !ok {
		t.Fatalf("avatar value %q", res["avatar"])
	}

	rec = httptest.NewRecorder()
	s.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/avatars/"+id+".jpg", nil))
	if rec.Code != http.StatusOK || rec.Header().Get("Content-Type") != "image/jpeg" ||
		rec.Header().Get("Cache-Control") != "private, max-age=3600" || rec.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Fatalf("download: %d %v", rec.Code, rec.Header())
	}

	for _, path := range []string{"/api/avatars/0123456789abcdef.jpg", "/api/avatars/../../etc/passwd", "/api/avatars/xyz"} {
		rec = httptest.NewRecorder()
		s.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
		if rec.Code != http.StatusNotFound {
			t.Fatalf("%s: want 404, got %d", path, rec.Code)
		}
	}

	rec = httptest.NewRecorder()
	s.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/avatars", bytes.NewReader([]byte("not an image"))))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("garbage upload: want 400, got %d", rec.Code)
	}
	big := bytes.Repeat([]byte{0xFF}, MaxUploadBytes+10)
	rec = httptest.NewRecorder()
	s.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/avatars", bytes.NewReader(big)))
	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("oversized upload: want 413, got %d", rec.Code)
	}
}

func TestMatchAndID(t *testing.T) {
	if !Match("/api/avatars") || !Match("/api/avatars/ab.jpg") || Match("/api/avatarsX") || Match("/api/list") {
		t.Fatal("Match")
	}
	if _, ok := ID("4"); ok {
		t.Fatal("built-in avatar is not custom")
	}
	if _, ok := ID("u_0123456789abcdef"); !ok {
		t.Fatal("custom avatar value")
	}
	if _, ok := ID("u_0123456789ABCDEF"); ok {
		t.Fatal("upper-case is not a value we hand out")
	}
}
