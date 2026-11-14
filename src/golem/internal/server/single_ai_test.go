package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"golem_century/internal/config"
)

func postSingle(t *testing.T, gs *GameServer, body string) (int, map[string]any) {
	t.Helper()
	rec := httptest.NewRecorder()
	gs.HandleCreateSinglePlayer(rec, httptest.NewRequest(http.MethodPost, "/api/single", strings.NewReader(body)))
	var out map[string]any
	_ = json.NewDecoder(rec.Body).Decode(&out)
	return rec.Code, out
}

func TestCreateSinglePlayer_Difficulty(t *testing.T) {
	gs := newCleanupTestServer(config.Config{})

	code, out := postSingle(t, gs, `{"numAI":1}`)
	if code != http.StatusOK || out["difficulty"] != "medium" || out["coalition"] != nil {
		t.Fatalf("default difficulty: code=%d body=%v", code, out)
	}
	if !strings.HasPrefix(out["sessionID"].(string), "single_") {
		t.Fatalf("session ID must keep the single_ prefix: %v", out["sessionID"])
	}

	code, out = postSingle(t, gs, `{"numAI":3,"difficulty":"veryhard"}`)
	if code != http.StatusOK || out["difficulty"] != "veryhard" || out["coalition"] != nil {
		t.Fatalf("veryhard: code=%d body=%v", code, out)
	}
	s, ok := gs.GetSessionV2(out["sessionID"].(string))
	if !ok || !s.IsSinglePlayer() || len(s.AILevels()) != 3 {
		t.Fatalf("session not configured as single player with 3 AIs")
	}

	if code, _ := postSingle(t, gs, `{"numAI":2,"difficulty":"impossible"}`); code != http.StatusBadRequest {
		t.Fatalf("unknown difficulty: want 400, got %d", code)
	}
	if code, _ := postSingle(t, gs, `{"numAI":2,"aiLevels":["easy"]}`); code != http.StatusBadRequest {
		t.Fatalf("aiLevels length mismatch: want 400, got %d", code)
	}
	code, out = postSingle(t, gs, `{"numAI":2,"aiLevels":["easy","hard"]}`)
	if code != http.StatusOK || out["aiLevels"].([]any)[1] != "hard" {
		t.Fatalf("per-AI levels: code=%d body=%v", code, out)
	}

	code, out = postSingle(t, gs, `{"numAI":1,"sessionID":"mine"}`)
	if code != http.StatusOK || out["sessionID"] != "single_mine" {
		t.Fatalf("custom ID must be forced to single_*: code=%d body=%v", code, out)
	}
}
