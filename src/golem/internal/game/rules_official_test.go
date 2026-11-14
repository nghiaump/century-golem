package game

import (
	"encoding/json"
	"errors"
	"testing"
)

// stateJSON is used to assert "state unchanged" after a rejected action.
func stateJSON(t *testing.T, gs *GameState) string {
	t.Helper()
	b, err := json.Marshal(gs)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	return string(b)
}

func TestHasAll_RespectsMultiplier(t *testing.T) {
	r := &Resources{Yellow: 4}
	if !r.HasAll(&Resources{Yellow: 2}, 2) {
		t.Error("4 yellow should cover 2×2 yellow")
	}
	if r.HasAll(&Resources{Yellow: 2}, 3) {
		t.Error("4 yellow must not cover 3×2 yellow")
	}
}

func TestTrade_MultiplierBeyondAffordable_Rejected(t *testing.T) {
	gs := NewGameState(2, 1)
	p := gs.GetCurrentPlayer()
	p.Resources = &Resources{Yellow: 4}
	p.Hand = []*Card{CreateCardFromName("trade_0002_0020", 9001)}
	before := stateJSON(t, gs)
	_, err := gs.Step(Action{Type: PlayCard, CardIndex: 0, Multiplier: 3})
	if !errors.Is(err, ErrCannotPlay) {
		t.Fatalf("want ErrCannotPlay, got %v", err)
	}
	if stateJSON(t, gs) != before {
		t.Fatal("state changed after a rejected trade")
	}
	if _, err := gs.Step(Action{Type: PlayCard, CardIndex: 0, Multiplier: 2}); err != nil {
		t.Fatalf("affordable multiplier rejected: %v", err)
	}
	if p.Resources.Yellow != 0 || p.Resources.Green != 4 {
		t.Fatalf("after 2× (2Y→2G): got %s", p.Resources)
	}
}

func TestUpgrade_NegativeInput_Rejected(t *testing.T) {
	gs := NewGameState(2, 1)
	p := gs.GetCurrentPlayer()
	p.Resources = &Resources{Yellow: 2}
	idx := -1
	for i, c := range p.Hand {
		if c.ActionType == Upgrade {
			idx = i
		}
	}
	_, err := gs.Step(Action{Type: PlayCard, CardIndex: idx,
		InputResources: &Resources{Yellow: -3, Green: 4}, OutputResources: &Resources{Blue: 1}})
	if err == nil {
		t.Fatal("negative input must be rejected")
	}
	if p.Resources.Yellow != 2 {
		t.Fatalf("resources changed: %s", p.Resources)
	}
}

func TestAcquire_DepositsStayOnCards_TargetDepositsCollected(t *testing.T) {
	gs := NewGameState(2, 7)
	p := gs.GetCurrentPlayer()
	p.Resources = &Resources{Yellow: 1, Blue: 1}
	gs.Market.ActionCards[2].Deposits = &Resources{Pink: 1}
	target := gs.Market.ActionCards[2]
	left0, left1 := gs.Market.ActionCards[0], gs.Market.ActionCards[1]

	_, err := gs.Step(Action{Type: AcquireCard, CardIndex: 2,
		DepositList: []DepositData{{Crystal: Yellow}, {Crystal: Blue}}})
	if err != nil {
		t.Fatalf("acquire failed: %v", err)
	}
	if left0.Deposits.Yellow != 1 || left1.Deposits.Blue != 1 {
		t.Errorf("deposits must stay on the skipped cards: card0=%s card1=%s", left0.Deposits, left1.Deposits)
	}
	if p.Resources.Pink != 1 || p.Resources.Total() != 1 {
		t.Errorf("buyer should hold exactly the collected pink, got %s", p.Resources)
	}
	if target.Deposits.Total() != 0 {
		t.Errorf("acquired card must leave with no deposits, got %s", target.Deposits)
	}
	if p.Hand[len(p.Hand)-1] != target {
		t.Error("acquired card should be last in hand")
	}
}

func TestAcquire_NoDeposits_FallbackPlacesCheapest(t *testing.T) {
	gs := NewGameState(2, 7)
	p := gs.GetCurrentPlayer()
	p.Resources = &Resources{Green: 1, Pink: 2}
	c0, c1 := gs.Market.ActionCards[0], gs.Market.ActionCards[1]
	if _, err := gs.Step(Action{Type: AcquireCard, CardIndex: 2}); err != nil {
		t.Fatalf("acquire failed: %v", err)
	}
	if c0.Deposits.Green != 1 || c1.Deposits.Pink != 1 {
		t.Errorf("fallback should place green then pink: card0=%s card1=%s", c0.Deposits, c1.Deposits)
	}
	if p.Resources.Pink != 1 || p.Resources.Total() != 1 {
		t.Errorf("player should keep 1 pink, got %s", p.Resources)
	}
}

func TestAcquire_BadDeposits_StateUnchanged(t *testing.T) {
	gs := NewGameState(2, 7)
	p := gs.GetCurrentPlayer()
	p.Resources = &Resources{Yellow: 1, Green: 1}
	before := stateJSON(t, gs)

	cases := []Action{
		{Type: AcquireCard, CardIndex: 2, DepositList: []DepositData{{Crystal: Yellow}}},                    // wrong count
		{Type: AcquireCard, CardIndex: 2, DepositList: []DepositData{{Crystal: Yellow}, {Crystal: Yellow}}}, // only 1 yellow
		{Type: AcquireCard, CardIndex: 3}, // fallback: only 2 crystals
	}
	for i, a := range cases {
		if _, err := gs.Step(a); !errors.Is(err, ErrBadDeposits) {
			t.Errorf("case %d: want ErrBadDeposits, got %v", i, err)
		}
		if stateJSON(t, gs) != before {
			t.Fatalf("case %d: state changed after a rejected acquire", i)
		}
	}
}

func TestClaim_CoinIsACopy(t *testing.T) {
	gs := NewGameState(3, 3)
	p := gs.GetCurrentPlayer()
	p.Resources = NewResources()
	p.Resources.AddAll(gs.Market.PointCards[0].Requirement, 1)
	copperBefore := gs.Market.Coins[0].Amount
	if _, err := gs.Step(Action{Type: ClaimPointCard, CardIndex: 0}); err != nil {
		t.Fatalf("claim failed: %v", err)
	}
	if len(p.Coins) != 1 || p.Coins[0].Points != 3 {
		t.Fatalf("expected one copper coin, got %+v", p.Coins)
	}
	if p.Coins[0] == gs.Market.Coins[0] {
		t.Error("player coin must not alias the market coin pile")
	}
	if gs.Market.Coins[0].Amount != copperBefore-1 {
		t.Errorf("market copper should drop by 1: %d -> %d", copperBefore, gs.Market.Coins[0].Amount)
	}
}

func TestTie_LaterSeatWins(t *testing.T) {
	gs := NewGameState(3, 5)
	for _, p := range gs.Players {
		p.Resources = NewResources()
		p.PointCards = []*Card{{ID: 9500 + p.ID, Type: PointCard, Points: 10}}
	}
	gs.Players[0].PointCards[0].Points = 12 // seat 1 strictly ahead → seat 1 wins
	gs.finishGame()
	if gs.Winner != gs.Players[0] {
		t.Fatalf("strict leader should win, got %v", gs.Winner.ID)
	}
	gs.GameOver = false
	gs.Players[0].PointCards[0].Points = 10 // three-way tie → last seat wins
	gs.finishGame()
	if gs.Winner != gs.Players[2] {
		t.Fatalf("tie should go to the later seat (3), got seat %d", gs.Winner.ID)
	}
}
