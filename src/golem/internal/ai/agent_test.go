package ai

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"golem_century/internal/game"
)

func TestParseLevel(t *testing.T) {
	for in, want := range map[string]Level{
		"easy": Easy, "Medium": Medium, "HARD": Hard, "veryhard": VeryHard,
		"very_hard": VeryHard, "very-hard": VeryHard, " very hard ": VeryHard,
	} {
		got, err := ParseLevel(in)
		if err != nil || got != want {
			t.Errorf("ParseLevel(%q) = %v, %v; want %v", in, got, err, want)
		}
		if back, _ := ParseLevel(got.String()); back != got {
			t.Errorf("String() round trip failed for %v", got)
		}
	}
	if _, err := ParseLevel("impossible"); err == nil {
		t.Error("unknown level must be rejected")
	}
}

func TestScheduler_NeverExceedsCapacity(t *testing.T) {
	s := NewScheduler(3)
	var inUse, peak atomic.Int32
	var wg sync.WaitGroup
	for i := 0; i < 64; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			got, release := s.Acquire(context.Background(), 1+i%4)
			defer release()
			if got < 1 {
				t.Error("Acquire with a live context must grant at least one token")
				return
			}
			n := inUse.Add(int32(got))
			for {
				p := peak.Load()
				if n <= p || peak.CompareAndSwap(p, n) {
					break
				}
			}
			time.Sleep(time.Millisecond)
			inUse.Add(-int32(got))
		}(i)
	}
	wg.Wait()
	if peak.Load() > 3 {
		t.Fatalf("peak tokens in use %d > capacity 3", peak.Load())
	}
}

func TestScheduler_AcquireRespectsContext(t *testing.T) {
	s := NewScheduler(1)
	_, release := s.Acquire(context.Background(), 1)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	if got, rel := s.Acquire(ctx, 1); got != 0 {
		rel()
		t.Fatal("Acquire must give up when the context ends while the pool is empty")
	}
	release()
}

// playGame runs agents on the reference engine through Step and returns the finished state.
// Every decision must be legal: an illegal action fails the test.
func playGame(t *testing.T, gs *game.GameState, agents []Agent, maxSteps int) *game.GameState {
	t.Helper()
	for step := 0; step < maxSteps && !gs.GameOver; step++ {
		seat := gs.CurrentTurn % len(gs.Players)
		d, err := agents[seat].Decide(context.Background(), gs.Clone(), DecideOptions{Seed: uint64(step)})
		if err != nil {
			t.Fatalf("step %d: decide: %v", step, err)
		}
		res, err := gs.Step(d.Action)
		if err != nil {
			t.Fatalf("step %d: seat %d chose an illegal action %+v: %v", step, seat, d.Action, err)
		}
		if res.PendingDiscard > 0 {
			disc := d.Discard
			if disc == nil {
				disc = game.AutoDiscard(gs.Players[seat].Resources, res.PendingDiscard)
			}
			if _, err := gs.Step(game.Action{Type: game.Discard, DiscardResources: disc}); err != nil {
				t.Fatalf("step %d: discard %v rejected: %v", step, disc, err)
			}
		}
	}
	return gs
}

func TestGreedyAgent_PlaysLegalCompleteGames(t *testing.T) {
	for n := 2; n <= 5; n++ {
		gs := game.NewGameState(n, int64(100+n))
		agents := make([]Agent, n)
		for i := range agents {
			agents[i] = newGreedyAgent(DefaultProfile(Easy), DefaultRuntime())
		}
		playGame(t, gs, agents, 2000)
		if !gs.GameOver {
			t.Fatalf("%d players: greedy game did not finish within 2000 steps (round %d)", n, gs.Round)
		}
	}
}
