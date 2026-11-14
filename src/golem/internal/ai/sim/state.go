package sim

import (
	"fmt"
	"sort"

	"golem_century/internal/game"
)

// Player is one seat.
type Player struct {
	Res      Crystals
	Hand     uint64 // bit m = merchant index m in hand
	Played   uint64 // bit m = merchant index m played (back to hand on rest)
	Golems   uint8
	GolemPts int16
	CoinPts  int16
	Pending  int8 // crystals to discard before the turn can end
}

// FinalPoints is golem points + coins + 1 per non-yellow crystal.
func (p *Player) FinalPoints() int {
	return int(p.GolemPts) + int(p.CoinPts) + int(p.Res[1]) + int(p.Res[2]) + int(p.Res[3])
}

// Banked is golem points + coins.
func (p *Player) Banked() int { return int(p.GolemPts) + int(p.CoinPts) }

// State is a full game position. Copy it by value.
type State struct {
	P         [MaxPlayers]Player
	N         uint8
	Turn      int16 // the engine's CurrentTurn (seat = Turn % N)
	Round     int16
	LastRound bool
	Over      bool
	Winner    int8 // seat, -1 while running
	Goal      uint8

	Market  [MarketSize]uint8 // merchant indices, positions 0..NMarket-1
	MDep    [MarketSize]Crystals
	NMarket uint8
	Row     [GolemRowSize]uint8 // golem indices, positions 0..NRow-1
	NRow    uint8

	MPool  [NumDeckMerchants]uint8 // unseen merchant cards (unordered)
	NMPool uint8
	GPool  [NumGolems]uint8 // unseen golems (unordered)
	NGPool uint8

	Copper, Silver int8
}

// Seat returns the seat to move.
func (s *State) Seat() int { return int(s.Turn) % int(s.N) }

// Cur returns the player to move.
func (s *State) Cur() *Player { return &s.P[s.Seat()] }

// FromGame converts an engine state. The unseen pools are sorted by card ID, so the real deck
// order is erased.
func FromGame(gs *game.GameState) (State, error) {
	var s State
	n := len(gs.Players)
	if n < 1 || n > MaxPlayers {
		return s, fmt.Errorf("sim: unsupported player count %d", n)
	}
	s.N = uint8(n)
	s.Turn = int16(gs.CurrentTurn)
	s.Round = int16(gs.Round)
	s.LastRound = gs.LastRound
	s.Over = gs.GameOver
	s.Goal = uint8(gs.GolemsToEnd())
	s.Winner = -1
	for i, p := range gs.Players {
		sp := &s.P[i]
		sp.Res = crystalsOf(p.Resources)
		for _, c := range p.Hand {
			m, ok := MerchantIndex(c)
			if !ok {
				return s, fmt.Errorf("sim: unknown merchant card %q", c.Name)
			}
			sp.Hand |= 1 << m
		}
		for _, c := range p.PlayedCards {
			m, ok := MerchantIndex(c)
			if !ok {
				return s, fmt.Errorf("sim: unknown merchant card %q", c.Name)
			}
			sp.Played |= 1 << m
		}
		sp.Golems = uint8(len(p.PointCards))
		for _, c := range p.PointCards {
			sp.GolemPts += int16(c.Points)
		}
		for _, c := range p.Coins {
			sp.CoinPts += int16(c.Points)
		}
		sp.Pending = int8(p.PendingDiscard)
		if gs.Winner == p {
			s.Winner = int8(i)
		}
	}
	m := gs.Market
	for i, c := range m.ActionCards {
		idx, ok := MerchantIndex(c)
		if !ok {
			return s, fmt.Errorf("sim: unknown market card %q", c.Name)
		}
		s.Market[i] = idx
		s.MDep[i] = crystalsOf(c.Deposits)
	}
	s.NMarket = uint8(len(m.ActionCards))
	for i, c := range m.PointCards {
		idx, ok := GolemIndex(c)
		if !ok {
			return s, fmt.Errorf("sim: unknown golem %q", c.Name)
		}
		s.Row[i] = idx
	}
	s.NRow = uint8(len(m.PointCards))
	for _, c := range m.ActionDeck {
		idx, _ := MerchantIndex(c)
		s.MPool[s.NMPool] = idx
		s.NMPool++
	}
	for _, c := range m.PointDeck {
		idx, _ := GolemIndex(c)
		s.GPool[s.NGPool] = idx
		s.NGPool++
	}
	sortU8(s.MPool[:s.NMPool])
	sortU8(s.GPool[:s.NGPool])
	if len(m.Coins) > 0 {
		s.Copper = int8(m.Coins[0].Amount)
	}
	if len(m.Coins) > 1 {
		s.Silver = int8(m.Coins[1].Amount)
	}
	return s, nil
}

// Canonical returns a copy with both pools sorted (for comparisons).
func (s State) Canonical() State {
	sortU8(s.MPool[:s.NMPool])
	sortU8(s.GPool[:s.NGPool])
	return s
}

func sortU8(a []uint8) { sort.Slice(a, func(i, j int) bool { return a[i] < a[j] }) }
