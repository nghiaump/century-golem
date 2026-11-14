package sim

import (
	"fmt"

	"golem_century/internal/game"
)

func resourcesOf(c Crystals) *game.Resources {
	return &game.Resources{Yellow: int(c[0]), Green: int(c[1]), Blue: int(c[2]), Pink: int(c[3])}
}

// ToGameAction converts a sim move into an engine action for the current player of gs (the
// engine state the sim state was built from). The caller should still Validate it.
func ToGameAction(gs *game.GameState, a Action) (game.Action, error) {
	p := gs.GetCurrentPlayer()
	switch a.Kind {
	case APlay:
		for i, c := range p.Hand {
			if m, ok := MerchantIndex(c); ok && m == a.Card {
				ga := game.Action{Type: game.PlayCard, CardIndex: i, Multiplier: 1}
				switch Merchants[a.Card].Kind {
				case KUpgrade:
					in, out := game.UpgradeIO(*p.Resources, *resourcesOf(a.Vec))
					ga.InputResources, ga.OutputResources = &in, &out
				case KTrade:
					ga.Multiplier = int(a.Mult)
				}
				return ga, nil
			}
		}
		return game.Action{}, fmt.Errorf("sim: card %s not in hand", Merchants[a.Card].Name)
	case AAcquire:
		return game.Action{Type: game.AcquireCard, CardIndex: int(a.Card),
			DepositList: game.DepositsFromMultiset(*resourcesOf(a.Vec))}, nil
	case AClaim:
		return game.Action{Type: game.ClaimPointCard, CardIndex: int(a.Card)}, nil
	case ARest:
		return game.Action{Type: game.Rest}, nil
	case ADiscard:
		return game.Action{Type: game.Discard, DiscardResources: resourcesOf(a.Vec)}, nil
	}
	return game.Action{}, fmt.Errorf("sim: unknown action kind %d", a.Kind)
}

// FromGameAction converts a (valid, normalised) engine action of gs's current player into a sim move.
func FromGameAction(gs *game.GameState, a game.Action) (Action, error) {
	p := gs.GetCurrentPlayer()
	switch a.Type {
	case game.PlayCard:
		if a.CardIndex < 0 || a.CardIndex >= len(p.Hand) {
			return Action{}, fmt.Errorf("sim: bad hand index")
		}
		m, ok := MerchantIndex(p.Hand[a.CardIndex])
		if !ok {
			return Action{}, fmt.Errorf("sim: unknown card")
		}
		sa := Action{Kind: APlay, Card: m, Mult: 1}
		switch Merchants[m].Kind {
		case KUpgrade:
			after := crystalsOf(p.Resources)
			in, out := crystalsOf(a.InputResources), crystalsOf(a.OutputResources)
			for c := 0; c < 4; c++ {
				after[c] += out[c] - in[c]
			}
			sa.Vec = after
		case KTrade:
			sa.Mult = uint8(max(1, a.Multiplier))
		}
		return sa, nil
	case game.AcquireCard:
		var v Crystals
		for _, d := range a.DepositList {
			v[d.Crystal]++
		}
		return Action{Kind: AAcquire, Card: uint8(a.CardIndex), Vec: v}, nil
	case game.ClaimPointCard:
		return Action{Kind: AClaim, Card: uint8(a.CardIndex)}, nil
	case game.Rest:
		return Action{Kind: ARest}, nil
	case game.Discard:
		return Action{Kind: ADiscard, Vec: crystalsOf(a.DiscardResources)}, nil
	}
	return Action{}, fmt.Errorf("sim: unknown engine action %d", a.Type)
}
