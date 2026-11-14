package session

import (
	"context"
	"strings"
	"sync"
	"testing"
	"time"

	"golem_century/internal/ai"
	"golem_century/internal/game"
	"golem_century/internal/logger"
)

// blockingAgent thinks until released or cancelled.
type blockingAgent struct {
	startOnce sync.Once
	started   chan struct{}
	release   chan struct{}
	cancelled chan struct{}
}

func newBlockingAgent() *blockingAgent {
	return &blockingAgent{started: make(chan struct{}), release: make(chan struct{}), cancelled: make(chan struct{})}
}

func (b *blockingAgent) Level() ai.Level     { return ai.Hard }
func (b *blockingAgent) Profile() ai.Profile { return ai.DefaultProfile(ai.Hard) }
func (b *blockingAgent) Decide(ctx context.Context, _ *game.GameState, _ ai.DecideOptions) (ai.Decision, error) {
	b.startOnce.Do(func() { close(b.started) })
	select {
	case <-ctx.Done():
		close(b.cancelled)
		return ai.Decision{}, ctx.Err()
	case <-b.release:
		return ai.Decision{Action: game.Action{Type: game.Rest}}, nil
	}
}

func fastRuntime() *ai.Runtime { return &ai.Runtime{ScalePct: 100, MinDelay: 0} }

func newAISession(id string, levels []ai.Level, opts ...Option) *GameSession {
	gs := NewGameSession(id, len(levels), 60, nil, logger.NewNopLogger())
	gs.ApplyOptions(append([]Option{WithSinglePlayer(levels), WithAIRuntime(fastRuntime(), false)}, opts...)...)
	return gs
}

func waitFor(t *testing.T, d time.Duration, cond func() bool, msg string) {
	t.Helper()
	deadline := time.Now().Add(d)
	for time.Now().Before(deadline) {
		if cond() {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatal(msg)
}

func TestAISession_AllAIGameFinishes(t *testing.T) {
	gs := newAISession("single_allai", []ai.Level{ai.Easy, ai.Easy, ai.Easy})
	defer gs.Close()
	if err := gs.StartGame(); err != nil {
		t.Fatal(err)
	}
	waitFor(t, 60*time.Second, func() bool { return gs.GetStatus() == GameStatusEnded },
		"all-AI game did not finish (an AI in seat 1 must be able to move first)")
	st := gs.GetSerializedState()
	if st["winner"] == nil {
		t.Fatal("finished game has no winner")
	}
}

func TestAISession_StateResponsiveWhileThinkingAndCloseCancels(t *testing.T) {
	agent := newBlockingAgent()
	gs := newAISession("single_block", []ai.Level{ai.Hard, ai.Hard},
		WithAgentFactory(func(ai.Level, *ai.Runtime) ai.Agent { return agent }))
	if err := gs.StartGame(); err != nil {
		t.Fatal(err)
	}
	select {
	case <-agent.started:
	case <-time.After(5 * time.Second):
		t.Fatal("agent never started thinking")
	}
	begin := time.Now()
	st := gs.GetSerializedState()
	if time.Since(begin) > 200*time.Millisecond {
		t.Fatal("state must stay readable while an AI is thinking")
	}
	if st["aiThinking"] == nil {
		t.Fatal("state should report the thinking AI")
	}
	gs.Close()
	select {
	case <-agent.cancelled:
	case <-time.After(2 * time.Second):
		t.Fatal("Close must cancel the in-flight search")
	}
}

func TestAISession_StaleResultDropped(t *testing.T) {
	agent := newBlockingAgent()
	gs := newAISession("single_stale", []ai.Level{ai.Hard, ai.Hard},
		WithAgentFactory(func(ai.Level, *ai.Runtime) ai.Agent { return agent }))
	defer gs.Close()
	if err := gs.StartGame(); err != nil {
		t.Fatal(err)
	}
	<-agent.started
	gs.mu.RLock()
	seq, cur := gs.stepSeq, gs.GameState.GetCurrentPlayer().ID
	gs.mu.RUnlock()
	if ev := gs.onAIResult(aiResult{seq: seq + 7, playerID: cur, decision: ai.Decision{Action: game.Action{Type: game.Rest}}}); ev != nil {
		t.Fatal("a result for an old step must be dropped")
	}
	gs.mu.RLock()
	defer gs.mu.RUnlock()
	if gs.stepSeq != seq {
		t.Fatal("dropped result changed the game")
	}
}

func TestAISession_WaitingPayloadListsAIs(t *testing.T) {
	gs := NewGameSession("single_wait", 3, 60, nil, logger.NewNopLogger())
	gs.ApplyOptions(WithSinglePlayer([]ai.Level{ai.Hard, ai.VeryHard}))
	st := gs.GetSerializedState()
	players := st["players"].([]map[string]interface{})
	if len(players) != 2 {
		t.Fatalf("expected 2 AI rows, got %d", len(players))
	}
	if players[0]["aiLevel"] != "hard" || players[1]["aiLevel"] != "veryhard" || players[1]["isAI"] != true {
		t.Fatalf("unexpected AI rows: %+v", players)
	}
	if st["mode"] != "single" || st["numPlayers"] != 3 {
		t.Fatalf("unexpected waiting payload: mode=%v numPlayers=%v", st["mode"], st["numPlayers"])
	}
	if _, ok := st["coalition"]; ok {
		t.Fatal("the waiting payload must not carry a coalition flag any more")
	}
}

func TestAISession_ModeDetection(t *testing.T) {
	nop := logger.NewNopLogger()
	if !NewGameSession("single_legacy", 2, 60, nil, nop).IsSinglePlayer() {
		t.Error("legacy single_ prefix must still mean single player")
	}
	if NewGameSession("room_1", 2, 60, nil, nop).IsSinglePlayer() {
		t.Error("a plain room is multiplayer")
	}
	s := NewGameSession("custom", 2, 60, nil, nop)
	s.ApplyOptions(WithSinglePlayer([]ai.Level{ai.Easy}))
	if !s.IsSinglePlayer() {
		t.Error("WithSinglePlayer must win over the ID")
	}
}

// addTestHuman registers a waiting human without a WebSocket.
func addTestHuman(gs *GameSession, clientID string) {
	gs.mu.Lock()
	defer gs.mu.Unlock()
	gs.connectedPlayers[clientID] = &PlayerInfo{ClientID: clientID, Name: "Human", JoinedAt: time.Now(),
		WriteChan: make(chan []byte, 1000), Done: make(chan struct{})}
}

func TestAISession_HumanSeatIsRandomAndAIsAreLabelled(t *testing.T) {
	seenSeat := map[int]bool{}
	for i := 0; i < 40; i++ {
		gs := NewGameSession("single_seat", 4, 60, nil, logger.NewNopLogger())
		gs.ApplyOptions(WithSinglePlayer([]ai.Level{ai.Easy, ai.Medium, ai.Hard}), WithAIRuntime(&ai.Runtime{MinDelay: time.Hour}, false))
		addTestHuman(gs, "h1")
		if err := gs.StartGame(); err != nil {
			t.Fatal(err)
		}
		gs.mu.RLock()
		humanID := gs.connectedPlayers["h1"].PlayerID
		seenSeat[humanID] = true
		humans := 0
		for _, p := range gs.GameState.Players {
			if !p.IsAI {
				humans++
				if p.ID != humanID {
					t.Errorf("human seat mismatch: %d vs %d", p.ID, humanID)
				}
			} else if gs.aiLevelOf(p.ID) == "" {
				t.Errorf("AI seat %d has no level", p.ID)
			}
		}
		st := gs.serializeState()
		gs.mu.RUnlock()
		if humans != 1 {
			t.Fatalf("expected exactly one human seat, got %d", humans)
		}
		for _, p := range st["players"].([]map[string]interface{}) {
			if p["isAI"] == true && p["online"] != true {
				t.Fatalf("AI must not be shown offline: %+v", p)
			}
		}
		gs.Close()
	}
	if len(seenSeat) < 2 {
		t.Fatalf("human always got the same seat in 40 games: %v", seenSeat)
	}
}

func TestAISession_HumanTimeoutIsPlayedByAI(t *testing.T) {
	for attempt := 0; attempt < 30; attempt++ {
		gs := NewGameSession("single_timeout", 2, 60, nil, logger.NewNopLogger())
		gs.ApplyOptions(WithSinglePlayer([]ai.Level{ai.Easy}), WithAIRuntime(fastRuntime(), false))
		addTestHuman(gs, "h1")
		if err := gs.StartGame(); err != nil {
			t.Fatal(err)
		}
		gs.mu.Lock()
		humanID := gs.connectedPlayers["h1"].PlayerID
		gs.TurnTimeout = 150 * time.Millisecond
		gs.mu.Unlock()
		if humanID == 1 { // the very first turn never times out; retry for a later seat
			gs.Close()
			continue
		}
		waitFor(t, 10*time.Second, func() bool {
			gs.mu.RLock()
			defer gs.mu.RUnlock()
			return gs.GameState.Round >= 2
		}, "a timed-out human turn was never auto-played")
		gs.Close()
		return
	}
	t.Skip("human always drew seat 1")
}

// Intent messages are off unless WithAIIntents(true).
func TestAISession_IntentMessagesOffByDefault(t *testing.T) {
	for _, enabled := range []bool{false, true} {
		for attempt := 0; ; attempt++ {
			if attempt == 30 {
				t.Skip("human always drew seat 1")
			}
			gs := newAISession("single_intent", []ai.Level{ai.Hard, ai.Hard},
				WithAgentFactory(func(ai.Level, *ai.Runtime) ai.Agent { return &fixedAgent{} }))
			gs.mu.Lock()
			gs.maxPlayers = 3 // 1 human + 2 AIs
			gs.mu.Unlock()
			if enabled {
				gs.ApplyOptions(WithAIIntents(true))
			}
			addTestHuman(gs, "h1")
			if err := gs.StartGame(); err != nil {
				t.Fatal(err)
			}
			gs.mu.RLock()
			human := gs.connectedPlayers["h1"]
			gs.mu.RUnlock()
			if human.PlayerID == 1 { // the human moves first and never times out on turn 1: retry
				gs.Close()
				continue
			}
			waitFor(t, 5*time.Second, func() bool {
				gs.mu.RLock()
				defer gs.mu.RUnlock()
				return gs.stepSeq >= 1
			}, "AI never moved")
			gs.mu.Lock()
			got := false
			for len(human.WriteChan) > 0 {
				if msg := <-human.WriteChan; strings.Contains(string(msg), `"aiIntent"`) {
					got = true
				}
			}
			gs.mu.Unlock()
			gs.Close()
			if got != enabled {
				t.Errorf("intents enabled=%v but aiIntent sent=%v", enabled, got)
			}
			break
		}
	}
}

type fixedAgent struct{}

func (f *fixedAgent) Level() ai.Level     { return ai.Hard }
func (f *fixedAgent) Profile() ai.Profile { return ai.DefaultProfile(ai.Hard) }

// Decide rests and reports an intent aimed at the first human seat.
func (f *fixedAgent) Decide(_ context.Context, snap *game.GameState, _ ai.DecideOptions) (ai.Decision, error) {
	target := 0
	for _, p := range snap.Players {
		if !p.IsAI {
			target = p.ID
			break
		}
	}
	return ai.Decision{Action: game.Action{Type: game.Rest},
		Intents: []ai.Intent{{Kind: ai.IntentTookTargetGolem, TargetID: target}}}, nil
}

func TestAISession_AIAvatarsRandomDistinctAndNamed(t *testing.T) {
	seen := map[string]bool{}
	for i := 0; i < 20; i++ {
		gs := NewGameSession("single_av", 5, 60, nil, logger.NewNopLogger())
		gs.ApplyOptions(WithSinglePlayer([]ai.Level{ai.Easy, ai.Easy, ai.Easy, ai.Easy}), WithAIRuntime(&ai.Runtime{MinDelay: time.Hour}, false))
		addTestHuman(gs, "h1")
		gs.mu.Lock()
		gs.connectedPlayers["h1"].Avatar = "4"
		waiting := gs.waitingAIRows()
		gs.mu.Unlock()
		if err := gs.StartGame(); err != nil {
			t.Fatal(err)
		}
		gs.mu.RLock()
		avatars := map[string]bool{}
		k := 0
		for _, p := range gs.GameState.Players {
			if !p.IsAI {
				continue
			}
			a := gs.aiAvatars[p.ID]
			if a == "" || a == "4" || avatars[a] {
				t.Fatalf("AI avatar %q must be set, distinct and not the human's (4)", a)
			}
			avatars[a] = true
			seen[a] = true
			if p.Name != aiName(a, 0) || strings.HasPrefix(p.Name, "AI ") {
				t.Fatalf("AI %d should be named after its avatar %s, got %q", p.ID, a, p.Name)
			}
			if waiting[k]["avatar"] != a {
				t.Fatalf("AI #%d changed avatar between waiting room (%v) and game (%s)", k, waiting[k]["avatar"], a)
			}
			k++
		}
		gs.mu.RUnlock()
		gs.Close()
	}
	if len(seen) < 8 {
		t.Fatalf("AI avatars do not look random: only %d distinct in 20 games", len(seen))
	}
}
