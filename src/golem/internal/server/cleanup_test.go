package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"golem_century/internal/config"
	"golem_century/internal/logger"
	"golem_century/internal/session"

	"github.com/gorilla/websocket"
)

func newCleanupTestServer(cfg config.Config) *GameServer {
	if cfg.DefaultTurnTimeoutInSeconds == 0 {
		cfg.DefaultTurnTimeoutInSeconds = 60
	}
	gs := NewGameServer(NewGameServerRequest{Logger: logger.NewNopLogger(), Config: &cfg})
	gs.cleanupInterval = 50 * time.Millisecond
	return gs
}

func waitUntil(t *testing.T, timeout time.Duration, cond func() bool, msg string) {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if cond() {
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatal(msg)
}

func TestIdleLimitDefaultsAndOverrides(t *testing.T) {
	gs := newCleanupTestServer(config.Config{})
	if got := gs.idleLimit(session.GameStatusWaiting); got != 5*time.Minute {
		t.Errorf("waiting default = %v, want 5m", got)
	}
	if got := gs.idleLimit(session.GameStatusPlaying); got != 10*time.Minute {
		t.Errorf("playing default = %v, want 10m", got)
	}
	if got := gs.idleLimit(session.GameStatusEnded); got != 2*time.Minute {
		t.Errorf("ended default = %v, want 2m", got)
	}

	gs = newCleanupTestServer(config.Config{SessionIdleWaitingSeconds: 7, SessionIdlePlayingSeconds: 8, SessionIdleEndedSeconds: 9})
	if gs.idleLimit(session.GameStatusWaiting) != 7*time.Second ||
		gs.idleLimit(session.GameStatusPlaying) != 8*time.Second ||
		gs.idleLimit(session.GameStatusEnded) != 9*time.Second {
		t.Error("configured idle limits not applied")
	}
}

func TestEmptyWaitingRoomIsRemoved(t *testing.T) {
	gs := newCleanupTestServer(config.Config{SessionIdleWaitingSeconds: 1})
	gs.CreateSessionV2("room_empty", 2, 60)

	waitUntil(t, 3*time.Second, func() bool { return !gs.checkSessionExists("room_empty") },
		"empty waiting room was not removed")
}

func TestConnectedRoomIsKept(t *testing.T) {
	gs := newCleanupTestServer(config.Config{SessionIdleWaitingSeconds: 1})
	mux := http.NewServeMux()
	mux.HandleFunc("/ws", gs.HandleWebSocket)
	srv := httptest.NewServer(mux)
	defer srv.Close()

	gs.CreateSessionV2("room_busy", 2, 60)
	conn, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(srv.URL, "http")+"/ws?session=room_busy&name=P1&avatar=1", nil)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer conn.Close()

	time.Sleep(1500 * time.Millisecond) // longer than the idle limit
	if !gs.checkSessionExists("room_busy") {
		t.Fatal("room with a connected player was removed")
	}
}

// A started game whose players all disconnect keeps their seats (Conn == nil) and is auto-played by the AI;
// it must still be removed once nobody has been connected for the playing idle limit.
func TestAbandonedStartedGameIsRemoved(t *testing.T) {
	gs := newCleanupTestServer(config.Config{SessionIdlePlayingSeconds: 1})
	mux := http.NewServeMux()
	mux.HandleFunc("/ws", gs.HandleWebSocket)
	srv := httptest.NewServer(mux)
	defer srv.Close()

	s := gs.CreateSessionV2("single_abandoned", 2, 60)
	conn, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(srv.URL, "http")+"/ws?session=single_abandoned&name=P1&avatar=1", nil)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	waitUntil(t, 2*time.Second, func() bool { return s.GetActivelyConnectedPlayersCount() == 1 }, "player never connected")
	if err := s.StartGame(); err != nil {
		t.Fatalf("start game: %v", err)
	}
	conn.Close()

	waitUntil(t, 5*time.Second, func() bool { return !gs.checkSessionExists("single_abandoned") },
		"abandoned started game was not removed")
	if err := s.Close(); err != nil { // already closed by the reaper: must be a no-op
		t.Fatalf("second Close: %v", err)
	}
}

func TestSessionLimit(t *testing.T) {
	gs := newCleanupTestServer(config.Config{MaxSessions: 2})
	gs.CreateSessionV2("a", 2, 60)
	if gs.atSessionLimit() {
		t.Fatal("limit reached too early")
	}
	gs.CreateSessionV2("b", 2, 60)
	if !gs.atSessionLimit() {
		t.Fatal("limit not reached at MaxSessions")
	}

	req := httptest.NewRequest(http.MethodPost, "/api/create", strings.NewReader(`{"numPlayers":2}`))
	rec := httptest.NewRecorder()
	gs.HandleCreateSession(rec, req)
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("create at limit: status %d, want 503", rec.Code)
	}

	if newCleanupTestServer(config.Config{}).atSessionLimit() {
		t.Fatal("MaxSessions 0 must mean unlimited")
	}
}

func TestListHidesSinglePlayerGames(t *testing.T) {
	gs := newCleanupTestServer(config.Config{})
	gs.CreateSessionV2("single_123", 2, 60)
	gs.CreateSessionV2("room_123", 2, 60)

	rec := httptest.NewRecorder()
	gs.HandleListSessions(rec, httptest.NewRequest(http.MethodGet, "/api/list", nil))
	var body struct {
		Sessions []map[string]any `json:"sessions"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if len(body.Sessions) != 1 || body.Sessions[0]["sessionID"] != "room_123" {
		t.Fatalf("listed sessions = %v, want only room_123", body.Sessions)
	}
}
