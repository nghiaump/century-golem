package game

import (
	"errors"
	"testing"
)

func produceIndex(t *testing.T, p *Player) int {
	t.Helper()
	for i, c := range p.Hand {
		if c.ActionType == Produce {
			return i
		}
	}
	t.Fatal("no produce card in hand")
	return -1
}

func TestStep_DiscardBlocksOtherActionsAndEndsTurn(t *testing.T) {
	gs := NewGameState(2, 11)
	p := gs.GetCurrentPlayer()
	p.Resources = &Resources{Yellow: 10}

	res, err := gs.Step(Action{Type: PlayCard, CardIndex: produceIndex(t, p)}) // +2 yellow → 12
	if err != nil {
		t.Fatalf("produce failed: %v", err)
	}
	if res.TurnEnded || res.PendingDiscard != 2 || gs.GetCurrentPlayer() != p {
		t.Fatalf("turn must stay with the player until they discard: %+v", res)
	}
	if _, err := gs.Step(Action{Type: Rest}); !errors.Is(err, ErrMustDiscard) {
		t.Fatalf("want ErrMustDiscard, got %v", err)
	}
	if _, err := gs.Step(Action{Type: Discard, DiscardResources: &Resources{Yellow: 1}}); err == nil {
		t.Fatal("discarding the wrong amount must fail")
	}
	res, err = gs.Step(Action{Type: Discard, DiscardResources: &Resources{Yellow: 2}})
	if err != nil {
		t.Fatalf("discard failed: %v", err)
	}
	if !res.TurnEnded || gs.GetCurrentPlayer() == p || p.Resources.Total() != 10 {
		t.Fatalf("discard should end the turn at 10 crystals: %+v, total=%d", res, p.Resources.Total())
	}
}

func TestStep_LastSeatDiscardEndsGame(t *testing.T) {
	gs := NewGameState(2, 13)
	gs.LastRound = true
	if _, err := gs.Step(Action{Type: Rest}); err != nil { // seat 1
		t.Fatal(err)
	}
	last := gs.GetCurrentPlayer() // seat 2 = last seat
	last.Resources = &Resources{Yellow: 9, Pink: 1}
	res, err := gs.Step(Action{Type: PlayCard, CardIndex: produceIndex(t, last)}) // → 12
	if err != nil {
		t.Fatal(err)
	}
	if gs.GameOver || res.GameOver {
		t.Fatal("game must not end before the last seat discards")
	}
	res, err = gs.Step(Action{Type: Discard, DiscardResources: &Resources{Yellow: 2}})
	if err != nil {
		t.Fatal(err)
	}
	if !res.GameOver || !gs.GameOver || gs.Winner == nil {
		t.Fatalf("discard by the last seat must end the game: %+v", res)
	}
	if _, err := gs.Step(Action{Type: Rest}); !errors.Is(err, ErrGameOver) {
		t.Fatalf("Step after game over: want ErrGameOver, got %v", err)
	}
}

func TestCheckGameOver_WaitsForPendingDiscard(t *testing.T) {
	gs := NewGameState(2, 13)
	gs.LastRound = true
	gs.CurrentTurn = 1 // last seat
	gs.GetCurrentPlayer().PendingDiscard = 1
	gs.CheckGameOver()
	if gs.GameOver {
		t.Fatal("legacy CheckGameOver must wait for the pending discard")
	}
}

func TestStep_LastRoundTriggeredFlag(t *testing.T) {
	gs := NewGameState(4, 21) // threshold 5
	p := gs.GetCurrentPlayer()
	for i := 0; i < 4; i++ {
		p.PointCards = append(p.PointCards, &Card{ID: 9700 + i, Type: PointCard, Points: 1})
	}
	p.Resources = NewResources()
	p.Resources.AddAll(gs.Market.PointCards[0].Requirement, 1)
	res, err := gs.Step(Action{Type: ClaimPointCard, CardIndex: 0})
	if err != nil {
		t.Fatal(err)
	}
	if !res.LastRoundTriggered || !gs.LastRound || gs.GameOver {
		t.Fatalf("5th golem with 4 players should trigger (not end) the last round: %+v", res)
	}
}
