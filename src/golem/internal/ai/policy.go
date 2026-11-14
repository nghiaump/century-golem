package ai

import (
	"math"
	"math/rand/v2"

	"golem_century/internal/ai/sim"
)

// policy scores moves for the player to move. Priors use the full evaluator (plus a denial term
// for Hard/Very Hard); rollouts use cheap hand-written features (a "heavy playout").
type policy struct {
	ev           evaluator
	denial       [sim.MaxPlayers]bool // seats whose losses count as our gain in priors
	denialWeight float64
}

// fullScores scores every move by the mover's evaluation after it (best discard included) plus
// the denial term. scores must have len(acts).
func (pl *policy) fullScores(s *sim.State, acts []sim.Action, d sim.Drawer, scores []float64) {
	mover := s.Seat()
	var base [sim.MaxPlayers]float64
	useDenial := false
	for i := 0; i < int(s.N); i++ {
		useDenial = useDenial || (pl.denial[i] && i != mover)
	}
	if useDenial {
		pl.ev.values(s, &base)
	}
	var v [sim.MaxPlayers]float64
	for i, a := range acts {
		c := *s
		c.Apply(a, d)
		if c.P[mover].Pending > 0 && !c.Over {
			pl.bestDiscard(&c, d)
		}
		pl.ev.values(&c, &v)
		sc := v[mover]
		if useDenial {
			for q := 0; q < int(s.N); q++ {
				if q != mover && pl.denial[q] {
					sc += pl.denialWeight * (base[q] - v[q])
				}
			}
		}
		scores[i] = sc
	}
}

// bestDiscard resolves a pending discard of the player to move by its own evaluation.
func (pl *policy) bestDiscard(s *sim.State, d sim.Drawer) {
	var buf [8]sim.Action
	acts := s.AppendLegal(buf[:0], sim.Search)
	if len(acts) == 0 {
		return
	}
	mover := s.Seat()
	best, bestV := acts[0], math.Inf(-1)
	for _, a := range acts {
		c := *s
		c.Apply(a, d)
		if v := pl.ev.value(&c, mover); v > bestV {
			best, bestV = a, v
		}
	}
	s.Apply(best, d)
}

// fastScore is the rollout policy: cheap features, no move application.
func fastScore(s *sim.State, a sim.Action) float64 {
	p := s.Cur()
	switch a.Kind {
	case sim.AClaim:
		g := &sim.Golems[s.Row[a.Card]]
		return 6 + float64(g.Points) + float64(coinBonus(s, int(a.Card)))
	case sim.APlay:
		d := &sim.Merchants[a.Card]
		var after sim.Crystals
		switch d.Kind {
		case sim.KProduce:
			after = p.Res
			for c := 0; c < 4; c++ {
				after[c] += d.Out[c]
			}
		case sim.KUpgrade:
			after = a.Vec
		case sim.KTrade:
			after = p.Res
			m := int8(a.Mult)
			for c := 0; c < 4; c++ {
				after[c] += (d.Out[c] - d.In[c]) * m
			}
		}
		gain := float64(after.Level() - p.Res.Level())
		if over := after.Total() - sim.MaxCrystals; over > 0 {
			gain -= 1.5 * float64(over)
		}
		return gain
	case sim.AAcquire:
		m := s.Market[a.Card]
		return 0.35*cardPotential[m] - 0.7*float64(a.Card) + 0.6*float64(s.MDep[a.Card].Level()) - 0.2*float64(a.Vec.Level())
	case sim.ARest:
		return 1.2*float64(popcount(p.Played)) - 2
	case sim.ADiscard:
		return -float64(a.Vec.Level())
	}
	return 0
}

// rolloutMove picks an ε-greedy move with fastScore.
func rolloutMove(s *sim.State, acts []sim.Action, eps float64, rng *rand.Rand) sim.Action {
	if rng.Float64() < eps {
		return acts[rng.IntN(len(acts))]
	}
	best, bestV := 0, math.Inf(-1)
	for i, a := range acts {
		if v := fastScore(s, a); v > bestV {
			best, bestV = i, v
		}
	}
	return acts[best]
}

// softmaxPriors turns scores (points) into priors with temperature temp.
func softmaxPriors(scores []float64, temp float64, out []float32) {
	top := math.Inf(-1)
	for _, v := range scores {
		top = math.Max(top, v)
	}
	sum := 0.0
	for i, v := range scores {
		e := math.Exp((v - top) / temp)
		out[i] = float32(e)
		sum += e
	}
	for i := range out[:len(scores)] {
		out[i] = float32(float64(out[i]) / sum)
	}
}
