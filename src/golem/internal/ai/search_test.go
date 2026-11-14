package ai

import (
	"context"
	"math/rand"
	"testing"
	"time"

	"golem_century/internal/game"
)

// testProfile is a level's profile with a single worker (deterministic with an iteration budget).
func testProfile(l Level) Profile {
	p := DefaultProfile(l)
	p.Workers = 1
	return p
}

func decide(t *testing.T, a Agent, gs *game.GameState, iters int, humans []bool) Decision {
	t.Helper()
	d, err := a.Decide(context.Background(), gs.Clone(), DecideOptions{Seed: 7, Iterations: iters, Humans: humans})
	if err != nil {
		t.Fatalf("decide: %v", err)
	}
	if _, err := gs.Clone().Validate(d.Action); err != nil {
		t.Fatalf("decision %+v is illegal: %v", d.Action, err)
	}
	return d
}

func TestSearchAgents_PlayLegalCompleteGames(t *testing.T) {
	for _, l := range AllLevels {
		for n := 2; n <= 4; n++ {
			gs := game.NewGameState(n, int64(300+n))
			agents := make([]Agent, n)
			for i := range agents {
				p := testProfile(l)
				agents[i] = NewAgentWithProfile(p, DefaultRuntime())
			}
			// small iteration budgets keep the test fast; legality is what matters here
			for step := 0; step < 3000 && !gs.GameOver; step++ {
				seat := gs.CurrentTurn % n
				d, err := agents[seat].Decide(context.Background(), gs.Clone(), DecideOptions{Seed: uint64(step), Iterations: 60})
				if err != nil {
					t.Fatalf("%v %dp step %d: %v", l, n, step, err)
				}
				res, err := gs.Step(d.Action)
				if err != nil {
					t.Fatalf("%v %dp step %d: illegal %+v: %v", l, n, step, d.Action, err)
				}
				if res.PendingDiscard > 0 {
					disc := d.Discard
					if disc == nil {
						t.Fatalf("%v: overflowing move without a discard choice", l)
					}
					if _, err := gs.Step(game.Action{Type: game.Discard, DiscardResources: disc}); err != nil {
						t.Fatalf("%v: discard %v rejected: %v", l, disc, err)
					}
				}
			}
			if !gs.GameOver {
				t.Fatalf("%v %dp: game did not finish", l, n)
			}
		}
	}
}

func TestSearchAgent_DeterministicWithIterationBudget(t *testing.T) {
	gs := game.NewGameState(3, 11)
	a := NewAgentWithProfile(testProfile(Hard), DefaultRuntime())
	b := NewAgentWithProfile(testProfile(Hard), DefaultRuntime())
	d1 := decide(t, a, gs, 400, nil)
	d2 := decide(t, b, gs, 400, nil)
	if d1.Action.Type != d2.Action.Type || d1.Action.CardIndex != d2.Action.CardIndex || d1.Action.Multiplier != d2.Action.Multiplier {
		t.Fatalf("same seed and budget must give the same move: %+v vs %+v", d1.Action, d2.Action)
	}
}

func TestSearchAgent_IgnoresDeckOrder(t *testing.T) {
	gs := game.NewGameState(4, 21)
	// play a few moves so the position is not trivial
	rng := rand.New(rand.NewSource(2))
	for i := 0; i < 12; i++ {
		acts := gs.LegalActions()
		gs.Step(acts[rng.Intn(len(acts))])
		if gs.GetCurrentPlayer().PendingDiscard > 0 {
			p := gs.GetCurrentPlayer()
			gs.Step(game.Action{Type: game.Discard, DiscardResources: game.AutoDiscard(p.Resources, p.PendingDiscard)})
		}
	}
	other := gs.Clone()
	rng.Shuffle(len(other.Market.ActionDeck), func(i, j int) {
		other.Market.ActionDeck[i], other.Market.ActionDeck[j] = other.Market.ActionDeck[j], other.Market.ActionDeck[i]
	})
	rng.Shuffle(len(other.Market.PointDeck), func(i, j int) {
		other.Market.PointDeck[i], other.Market.PointDeck[j] = other.Market.PointDeck[j], other.Market.PointDeck[i]
	})
	a := NewAgentWithProfile(testProfile(VeryHard), DefaultRuntime())
	d1 := decide(t, a, gs, 500, nil)
	d2 := decide(t, NewAgentWithProfile(testProfile(VeryHard), DefaultRuntime()), other, 500, nil)
	if d1.Action.Type != d2.Action.Type || d1.Action.CardIndex != d2.Action.CardIndex {
		t.Fatalf("the decision must not depend on the hidden deck order: %+v vs %+v", d1.Action, d2.Action)
	}
}

func TestSearchAgent_CancelReturnsQuickly(t *testing.T) {
	gs := game.NewGameState(4, 5)
	a := NewAgent(VeryHard, &Runtime{ScalePct: 100})
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		a.Decide(ctx, gs.Clone(), DecideOptions{Seed: 1})
		close(done)
	}()
	time.Sleep(100 * time.Millisecond)
	cancel()
	select {
	case <-done:
	case <-time.After(300 * time.Millisecond):
		t.Fatal("search must stop soon after cancellation")
	}
}

// scenario builds a 2-player position where seat 0 (the AI) is to move.
func scenario(t *testing.T, golems []string) *game.GameState {
	t.Helper()
	gs := game.NewGameState(2, 99)
	row := make([]*game.Card, 0, len(golems))
	for i, name := range golems {
		row = append(row, game.CreateCardFromName(name, 101+i))
	}
	// keep IDs consistent with the deck: find the real cards by name
	byName := map[string]*game.Card{}
	for _, c := range append(append([]*game.Card{}, gs.Market.PointCards...), gs.Market.PointDeck...) {
		byName[c.Name] = c
	}
	deck := []*game.Card{}
	used := map[string]bool{}
	for i, name := range golems {
		c, ok := byName[name]
		if !ok {
			t.Fatalf("unknown golem %s", name)
		}
		row[i] = c
		used[name] = true
	}
	for _, c := range append(append([]*game.Card{}, gs.Market.PointCards...), gs.Market.PointDeck...) {
		if !used[c.Name] {
			deck = append(deck, c)
		}
	}
	gs.Market.PointCards = row
	gs.Market.PointDeck = deck
	return gs
}

// The human (seat 1) is one turn from a valuable golem the AI can claim right now: Hard (human
// leading) and Very Hard (person counted stronger) must take it.
func TestScenario_DenyHumansTargetGolem(t *testing.T) {
	for _, l := range []Level{Hard, VeryHard} {
		gs := scenario(t, []string{"golem_0022", "golem_0230", "golem_3200", "golem_0040", "golem_2003"})
		ai, human := gs.Players[0], gs.Players[1]
		ai.Resources = &game.Resources{Blue: 2, Pink: 3}    // can claim golem_3200 (18 pts) now
		human.Resources = &game.Resources{Blue: 2, Pink: 3} // …and so can the human, on their next turn
		human.PointCards = []*game.Card{{ID: 9901, Type: game.PointCard, Points: 14}}
		human.Points = 14
		d := decide(t, NewAgentWithProfile(testProfile(l), DefaultRuntime()), gs, 1500, []bool{false, true})
		if d.Action.Type != game.ClaimPointCard || gs.Market.PointCards[d.Action.CardIndex].Name != "golem_3200" {
			t.Errorf("%v should claim golem_3200 before the human, chose %+v", l, d.Action)
		}
	}
}

// Last copper coin: the AI should take the slot-0 golem when the human could take it next turn.
func TestScenario_TakeLastCopper(t *testing.T) {
	gs := scenario(t, []string{"golem_0302", "golem_0022", "golem_5000", "golem_4000", "golem_2220"})
	gs.Market.Coins[0].Amount = 1
	ai, human := gs.Players[0], gs.Players[1]
	ai.Resources = &game.Resources{Yellow: 2, Blue: 3}
	human.Resources = &game.Resources{Yellow: 2, Blue: 2, Green: 2}
	d := decide(t, NewAgentWithProfile(testProfile(Hard), DefaultRuntime()), gs, 1500, []bool{false, true})
	if d.Action.Type != game.ClaimPointCard || d.Action.CardIndex != 0 {
		t.Errorf("Hard should take the last copper (golem 0), chose %+v", d.Action)
	}
}

func TestScenario_TakesGameWinningClaim(t *testing.T) {
	gs := scenario(t, []string{"golem_0022", "golem_5000", "golem_0230", "golem_3200", "golem_2003"})
	gs.LastRound = true
	gs.CurrentTurn = 1 // seat 1 (last seat) to move
	me, other := gs.Players[1], gs.Players[0]
	other.PointCards = []*game.Card{{ID: 9902, Type: game.PointCard, Points: 30}}
	me.PointCards = []*game.Card{{ID: 9903, Type: game.PointCard, Points: 14}}
	me.Resources = &game.Resources{Pink: 5}
	d := decide(t, NewAgentWithProfile(testProfile(Medium), DefaultRuntime()), gs, 50, nil)
	if d.Action.Type != game.ClaimPointCard || gs.Market.PointCards[d.Action.CardIndex].Name != "golem_5000" {
		t.Fatalf("must take the claim that wins the game, chose %+v", d.Action)
	}
}

func TestIntent_TookTargetGolem(t *testing.T) {
	gs := scenario(t, []string{"golem_0022", "golem_0230", "golem_3200", "golem_0040", "golem_2003"})
	ai, human := gs.Players[0], gs.Players[1]
	ai.Resources = &game.Resources{Blue: 2, Pink: 3}
	// The human can claim golem_3200 on their very next turn, so waiting would lose it. (With a
	// 2-turn human the AI may correctly take a free card first and still claim in time.)
	human.Resources = &game.Resources{Blue: 2, Pink: 3}
	d := decide(t, NewAgentWithProfile(testProfile(VeryHard), DefaultRuntime()), gs, 1500, []bool{false, true})
	if d.Action.Type != game.ClaimPointCard || gs.Market.PointCards[d.Action.CardIndex].Name != "golem_3200" {
		t.Fatalf("Very Hard should claim the human's target golem_3200, chose %+v", d.Action)
	}
	if len(d.Intents) != 1 || d.Intents[0].TargetID != human.ID {
		t.Fatalf("claiming the human's target should produce one intent for them, got %+v", d.Intents)
	}
}

func TestAntiStall_MovesTowardsAGolem(t *testing.T) {
	gs := scenario(t, []string{"golem_0050", "golem_0040", "golem_0032", "golem_0230", "golem_0222"})
	gs.Round = 120
	p := gs.GetCurrentPlayer()
	p.Resources = &game.Resources{Pink: 9, Blue: 1}
	p.Hand = append(p.Hand, game.CreateCardFromName("trade_1000_0030", 37)) // 1 pink → 3 green
	d := decide(t, NewAgentWithProfile(testProfile(Medium), DefaultRuntime()), gs, 100, nil)
	if d.Stats.Fallback != "anti-stall claim" {
		t.Fatalf("past round 100 the anti-stall policy must decide, got %+v (%s)", d.Action, d.Stats.Fallback)
	}
	if d.Action.Type != game.PlayCard || p.Hand[d.Action.CardIndex].Name != "trade_1000_0030" {
		t.Fatalf("expected the pink→green trade towards the green golems, got %+v", d.Action)
	}
}
