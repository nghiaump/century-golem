// Package sim is a compact, allocation-free copy of the Century: Golem rules used by the AI
// search. internal/game stays the only authority for real games; a differential test
// (sim_test.go) checks that both implementations agree after every step.
//
// The state is a plain value (~300 B): copying it is a struct copy, applying a move allocates
// nothing. Deck order is never represented: unseen cards form an unordered pool and refills draw
// from it through a Drawer, so a search cannot peek at the real deck by construction.
package sim

import (
	"fmt"

	"golem_century/internal/game"
)

// Crystals counts [yellow, green, blue, pink].
type Crystals [4]int8

// Total returns the number of crystals.
func (c Crystals) Total() int { return int(c[0]) + int(c[1]) + int(c[2]) + int(c[3]) }

// Level returns the summed crystal levels (yellow 1 … pink 4).
func (c Crystals) Level() int { return int(c[0]) + 2*int(c[1]) + 3*int(c[2]) + 4*int(c[3]) }

// Covers reports whether c holds at least m times r.
func (c Crystals) Covers(r Crystals, m int8) bool {
	return c[0] >= r[0]*m && c[1] >= r[1]*m && c[2] >= r[2]*m && c[3] >= r[3]*m
}

// MaxTimes returns how many times r fits into c (0 when r is empty).
func (c Crystals) MaxTimes(r Crystals) int8 {
	best := int8(-1)
	for i := 0; i < 4; i++ {
		if r[i] > 0 {
			if t := c[i] / r[i]; best < 0 || t < best {
				best = t
			}
		}
	}
	if best < 0 {
		return 0
	}
	return best
}

// Kind is a merchant card kind.
type Kind uint8

const (
	KProduce Kind = iota
	KUpgrade
	KTrade
)

// MerchantDef is a merchant (action) card.
type MerchantDef struct {
	Name  string
	Kind  Kind
	In    Crystals // trade input
	Out   Crystals // produce/trade output
	Steps int8     // upgrade steps
}

// GolemDef is a golem (point) card.
type GolemDef struct {
	Name   string
	Req    Crystals
	Points int8
}

const (
	// Merchant indices 0..42 are the 43 deck cards (card ID − 1); 43 and 44 are every player's
	// two starting cards (mint_0002 and upgrade_2).
	NumDeckMerchants = 43
	StartMint        = 43
	StartUpgrade     = 44
	NumMerchants     = 45
	NumGolems        = 36 // golem index = card ID − 101
	MarketSize       = 6
	GolemRowSize     = 5
	MaxPlayers       = 5
	MaxCrystals      = game.MaxCrystals
)

// Merchants and Golems are built once from the reference engine's card lists (single source).
var (
	Merchants [NumMerchants]MerchantDef
	Golems    [NumGolems]GolemDef
)

func init() {
	deck := game.CreateDefaultActionCards()
	if len(deck) != NumDeckMerchants {
		panic(fmt.Sprintf("sim: expected %d merchant cards, engine has %d", NumDeckMerchants, len(deck)))
	}
	for i, c := range deck {
		if c.ID != i+1 {
			panic("sim: merchant card IDs must be 1..43 in list order")
		}
		Merchants[i] = merchantFromCard(c)
	}
	start := game.CreateInitialActionCards(0)
	Merchants[StartMint] = merchantFromCard(start[0])
	Merchants[StartUpgrade] = merchantFromCard(start[1])

	golems := game.CreateDefaultPointCards()
	if len(golems) != NumGolems {
		panic(fmt.Sprintf("sim: expected %d golems, engine has %d", NumGolems, len(golems)))
	}
	for i, g := range golems {
		if g.ID != 101+i {
			panic("sim: golem IDs must be 101..136 in list order")
		}
		Golems[i] = GolemDef{Name: g.Name, Req: crystalsOf(g.Requirement), Points: int8(g.Points)}
	}
}

func merchantFromCard(c *game.Card) MerchantDef {
	d := MerchantDef{Name: c.Name}
	switch c.ActionType {
	case game.Produce:
		d.Kind, d.Out = KProduce, crystalsOf(c.Output)
	case game.Upgrade:
		d.Kind, d.Steps = KUpgrade, int8(c.TurnUpgrade)
	case game.Trade:
		d.Kind, d.In, d.Out = KTrade, crystalsOf(c.Input), crystalsOf(c.Output)
	}
	return d
}

func crystalsOf(r *game.Resources) Crystals {
	if r == nil {
		return Crystals{}
	}
	return Crystals{int8(r.Yellow), int8(r.Green), int8(r.Blue), int8(r.Pink)}
}

// MerchantIndex maps an engine card to its merchant index.
func MerchantIndex(c *game.Card) (uint8, bool) {
	if c.ID >= 1 && c.ID <= NumDeckMerchants {
		return uint8(c.ID - 1), true
	}
	switch c.Name {
	case Merchants[StartMint].Name:
		return StartMint, true
	case Merchants[StartUpgrade].Name:
		return StartUpgrade, true
	}
	return 0, false
}

// GolemIndex maps an engine golem card to its golem index.
func GolemIndex(c *game.Card) (uint8, bool) {
	if c.ID >= 101 && c.ID < 101+NumGolems {
		return uint8(c.ID - 101), true
	}
	return 0, false
}
