package game

import (
	"fmt"
	"math/rand"
	"testing"
)

// checkInvariants verifies properties that must hold after every Step.
func checkInvariants(gs *GameState) error {
	n := len(gs.Players)
	ids := map[int]string{}
	place := func(c *Card, where string) error {
		if prev, dup := ids[c.ID]; dup {
			return fmt.Errorf("card %d (%s) is both in %s and %s", c.ID, c.Name, prev, where)
		}
		ids[c.ID] = where
		return nil
	}
	actionCards, golems := 0, 0
	copperHeld, silverHeld := 0, 0
	for _, p := range gs.Players {
		if !p.Resources.NonNegative() {
			return fmt.Errorf("player %d has negative crystals: %+v", p.ID, *p.Resources)
		}
		for _, group := range [][]*Card{p.Hand, p.PlayedCards} {
			for _, c := range group {
				actionCards++
				if err := place(c, fmt.Sprintf("player %d hand/played", p.ID)); err != nil {
					return err
				}
			}
		}
		for _, c := range p.PointCards {
			golems++
			if err := place(c, fmt.Sprintf("player %d golems", p.ID)); err != nil {
				return err
			}
		}
		for _, c := range p.Coins {
			if c.Points == 3 {
				copperHeld++
			} else {
				silverHeld++
			}
		}
	}
	for _, c := range gs.Market.ActionCards {
		actionCards++
		if !c.Deposits.NonNegative() {
			return fmt.Errorf("negative deposits on %s", c.Name)
		}
		if err := place(c, "market"); err != nil {
			return err
		}
	}
	for _, c := range gs.Market.ActionDeck {
		actionCards++
		if err := place(c, "action deck"); err != nil {
			return err
		}
	}
	for _, c := range append(append([]*Card{}, gs.Market.PointCards...), gs.Market.PointDeck...) {
		golems++
		if err := place(c, "golem row/deck"); err != nil {
			return err
		}
	}
	if want := len(CreateDefaultActionCards()) + 2*n; actionCards != want {
		return fmt.Errorf("action cards: %d, want %d", actionCards, want)
	}
	if want := len(CreateDefaultPointCards()); golems != want {
		return fmt.Errorf("golems: %d, want %d", golems, want)
	}
	if got := gs.Market.Coins[0].Amount + copperHeld; got != 2*n {
		return fmt.Errorf("copper coins: %d, want %d", got, 2*n)
	}
	if got := gs.Market.Coins[1].Amount + silverHeld; got != 2*n {
		return fmt.Errorf("silver coins: %d, want %d", got, 2*n)
	}
	return nil
}

func TestInvariants_RandomGames(t *testing.T) {
	games := 2000
	if testing.Short() {
		games = 200
	}
	ended := 0
	for g := 0; g < games; g++ {
		seed := int64(1000 + g)
		rng := rand.New(rand.NewSource(seed))
		gs := NewGameState(2+g%4, seed)
		if err := checkInvariants(gs); err != nil {
			t.Fatalf("game %d setup: %v", g, err)
		}
		for step := 0; step < 3000 && !gs.GameOver; step++ {
			mover := gs.GetCurrentPlayer()
			res := randomLegalStep(t, gs, rng)
			if res.TurnEnded && mover.Resources.Total() > MaxCrystals {
				t.Fatalf("game %d step %d: player %d ended the turn with %d crystals", g, step, mover.ID, mover.Resources.Total())
			}
			if err := checkInvariants(gs); err != nil {
				t.Fatalf("game %d step %d: %v", g, step, err)
			}
		}
		if gs.GameOver {
			ended++
			if gs.Winner == nil {
				t.Fatalf("game %d ended without a winner", g)
			}
		}
	}
	if ended < games*9/10 {
		t.Errorf("only %d/%d random games ended within the step cap", ended, games)
	}
}
