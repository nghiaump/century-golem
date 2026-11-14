package sim

import "math/rand/v2"

// Drawer decides which unseen card fills an emptied slot: it returns a position in the unseen
// pool of size n > 0 (State.MPool / State.GPool). Search uses RandDrawer; the differential test
// replays the real deck. Only the size is passed so the state never escapes to the heap.
type Drawer interface {
	Merchant(n int) int
	Golem(n int) int
}

// RandDrawer draws uniformly at random.
type RandDrawer struct{ R *rand.Rand }

func (d RandDrawer) Merchant(n int) int { return d.R.IntN(n) }
func (d RandDrawer) Golem(n int) int    { return d.R.IntN(n) }

// Apply plays a legal move for the player to move (the caller guarantees legality, e.g. by taking
// it from AppendLegal). It mirrors game.GameState.Step: after the move either a discard is
// pending (same player again) or the turn ends — finishing the game when the last seat completes
// the last round.
func (s *State) Apply(a Action, d Drawer) {
	seat := s.Seat()
	p := &s.P[seat]
	switch a.Kind {
	case APlay:
		def := &Merchants[a.Card]
		switch def.Kind {
		case KProduce:
			addInto(&p.Res, def.Out, 1)
		case KUpgrade:
			p.Res = a.Vec
		case KTrade:
			m := int8(a.Mult)
			addInto(&p.Res, def.In, -m)
			addInto(&p.Res, def.Out, m)
		}
		bit := uint64(1) << a.Card
		p.Hand &^= bit
		p.Played |= bit

	case AAcquire:
		k := int(a.Card)
		// place the crystals, cheapest colour on the leftmost card
		pos := 0
		for c := 0; c < 4; c++ {
			for n := a.Vec[c]; n > 0; n-- {
				s.MDep[pos][c]++
				pos++
			}
		}
		addInto(&p.Res, a.Vec, -1)
		addInto(&p.Res, s.MDep[k], 1)
		p.Hand |= uint64(1) << s.Market[k]
		for i := k; i+1 < int(s.NMarket); i++ {
			s.Market[i] = s.Market[i+1]
			s.MDep[i] = s.MDep[i+1]
		}
		s.NMarket--
		s.Market[s.NMarket] = 0
		s.MDep[s.NMarket] = Crystals{}
		if s.NMPool > 0 {
			i := d.Merchant(int(s.NMPool))
			s.Market[s.NMarket] = s.MPool[i]
			s.NMPool--
			s.MPool[i] = s.MPool[s.NMPool]
			s.MPool[s.NMPool] = 0
			s.NMarket++
		}

	case AClaim:
		j := int(a.Card)
		g := &Golems[s.Row[j]]
		addInto(&p.Res, g.Req, -1)
		p.GolemPts += int16(g.Points)
		p.Golems++
		for i := j; i+1 < int(s.NRow); i++ {
			s.Row[i] = s.Row[i+1]
		}
		s.NRow--
		s.Row[s.NRow] = 0
		if s.NGPool > 0 {
			i := d.Golem(int(s.NGPool))
			s.Row[s.NRow] = s.GPool[i]
			s.NGPool--
			s.GPool[i] = s.GPool[s.NGPool]
			s.GPool[s.NGPool] = 0
			s.NRow++
		}
		switch {
		case j == 0 && s.Copper > 0:
			s.Copper--
			p.CoinPts += 3
		case j == 0 && s.Silver > 0:
			s.Silver--
			p.CoinPts++
		case j == 1 && s.Copper > 0 && s.Silver > 0:
			s.Silver--
			p.CoinPts++
		}
		if p.Golems >= s.Goal {
			s.LastRound = true
		}

	case ARest:
		p.Hand |= p.Played
		p.Played = 0

	case ADiscard:
		addInto(&p.Res, a.Vec, -1)
		p.Pending = 0
	}

	if t := p.Res.Total(); t > MaxCrystals {
		p.Pending = int8(t - MaxCrystals)
		return
	}
	if s.LastRound && seat == int(s.N)-1 {
		s.finish()
		return
	}
	s.Turn++
	if s.Turn%int16(s.N) == 0 {
		s.Round++
	}
}

// finish ends the game: highest final points, ties to the later seat.
func (s *State) finish() {
	s.Over = true
	best := -1
	for i := 0; i < int(s.N); i++ {
		if pts := s.P[i].FinalPoints(); pts >= best {
			best = pts
			s.Winner = int8(i)
		}
	}
}

func addInto(dst *Crystals, v Crystals, m int8) {
	dst[0] += v[0] * m
	dst[1] += v[1] * m
	dst[2] += v[2] * m
	dst[3] += v[3] * m
}
