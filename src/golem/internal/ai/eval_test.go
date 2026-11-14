package ai

import (
	"testing"

	"golem_century/internal/ai/sim"
)

func TestTurnsToAfford(t *testing.T) {
	cases := []struct {
		res, req sim.Crystals
		rate     float64
		want     int
	}{
		{sim.Crystals{0, 0, 2, 3}, sim.Crystals{0, 0, 2, 3}, 2, 1},  // affordable now
		{sim.Crystals{0, 1, 2, 2}, sim.Crystals{0, 0, 2, 3}, 2, 2},  // green → pink: 2 steps, one upgrade_2
		{sim.Crystals{1, 0, 2, 2}, sim.Crystals{0, 0, 2, 3}, 2, 3},  // yellow → pink: 3 steps
		{sim.Crystals{0, 0, 0, 0}, sim.Crystals{0, 0, 0, 2}, 2, 5},  // two pinks from nothing: 8 levels
		{sim.Crystals{0, 0, 0, 0}, sim.Crystals{0, 0, 0, 2}, 10, 2}, // a strong engine does it in one turn
	}
	for i, c := range cases {
		if got := turnsToAfford(c.res, c.req, c.rate); got != c.want {
			t.Errorf("case %d: turnsToAfford(%v, %v, %.0f) = %d, want %d", i, c.res, c.req, c.rate, got, c.want)
		}
	}
}

func TestCardPotential_ExpertValues(t *testing.T) {
	want := map[string]float64{"trade_0002_0020": 10, "trade_1000_0200": 10, "trade_0200_2000": 10,
		"trade_0003_0030": 9, "trade_0005_0300": 8, "mint_0002": 2, "upgrade_3": 3}
	for m, d := range sim.Merchants {
		if v, ok := want[d.Name]; ok && cardPotential[m] != v {
			t.Errorf("%s potential = %.0f, want %.0f", d.Name, cardPotential[m], v)
		}
	}
}
