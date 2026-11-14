package ai

import (
	"math"

	"golem_century/internal/ai/sim"
)

// intentTracker turns an AI move into at most one explainable message for a human ("took the
// golem you were going for", …) and rate-limits repeats.
type intentTracker struct {
	last map[string]int16 // kind|target -> round it was last reported
}

// golemTargets returns, for seat h, the probability that each row golem is its current target
// (softmax over discounted net value) and the turns it needs for each.
func golemTargets(st *sim.State, h int, ev evaluator) (prob [sim.GolemRowSize]float64, turns [sim.GolemRowSize]int) {
	p := &st.P[h]
	rate := ev.engineRate(p)
	val := [sim.GolemRowSize]float64{}
	top := math.Inf(-1)
	for j := 0; j < int(st.NRow); j++ {
		g := &sim.Golems[st.Row[j]]
		turns[j] = turnsToAfford(p.Res, g.Req, rate)
		val[j] = float64(int(g.Points)+coinBonus(st, j)) * math.Pow(ev.w.Gamma, float64(turns[j]-1))
		top = math.Max(top, val[j])
	}
	sum := 0.0
	for j := 0; j < int(st.NRow); j++ {
		prob[j] = math.Exp(0.6 * (val[j] - top))
		sum += prob[j]
	}
	for j := 0; j < int(st.NRow); j++ {
		prob[j] /= sum
	}
	return prob, turns
}

// detect inspects the chosen move against every human seat (every other seat when humans is nil).
func (it *intentTracker) detect(st *sim.State, a sim.Action, seat int, p Profile, ev evaluator, humans []bool) []Intent {
	if it.last == nil {
		it.last = map[string]int16{}
	}
	isHuman := func(i int) bool {
		if i == seat {
			return false
		}
		if humans != nil {
			return i < len(humans) && humans[i]
		}
		return true
	}
	emit := func(kind IntentKind, target, cardID int, motive bool) []Intent {
		key := string(kind) + "|" + string(rune('0'+target))
		if r, ok := it.last[key]; ok && st.Round-r < 2 {
			return nil
		}
		it.last[key] = st.Round
		return []Intent{{Kind: kind, TargetID: target, CardID: cardID, Motive: motive}}
	}

	// was this move chosen against our own short-term interest? (motive)
	ownBest, ownChosen := math.Inf(-1), 0.0
	if p.Level >= Hard {
		var buf [256]sim.Action
		for _, b := range st.AppendLegal(buf[:0], sim.Search) {
			if b.Kind == sim.AAcquire || b.Kind == sim.ADiscard {
				continue // refills are random: skip the noisy ones for this comparison
			}
			c := *st
			c.Apply(b, noDraw{})
			v := ev.value(&c, seat)
			ownBest = math.Max(ownBest, v)
			if b == a {
				ownChosen = v
			}
		}
	}
	againstSelf := p.Level >= Hard && !math.IsInf(ownBest, -1) && ownChosen < ownBest-0.75

	switch a.Kind {
	case sim.AClaim:
		j := int(a.Card)
		golemID := 101 + int(st.Row[j])
		for h := 0; h < int(st.N); h++ {
			if !isHuman(h) {
				continue
			}
			prob, turns := golemTargets(st, h, ev)
			if prob[j] >= 0.45 && turns[j] <= 2 {
				return emit(IntentTookTargetGolem, h+1, golemID, againstSelf)
			}
			if coinBonus(st, j) > 0 && turns[j] <= 2 {
				return emit(IntentBlockCoin, h+1, golemID, againstSelf)
			}
		}
		if st.P[seat].Golems+2 == st.Goal {
			return emit(IntentRushing, 0, golemID, false)
		}
	case sim.AAcquire:
		m := st.Market[a.Card]
		if cardPotential[m] < 8 {
			return nil
		}
		for h := 0; h < int(st.N); h++ {
			if !isHuman(h) {
				continue
			}
			in := sim.Merchants[m].In
			if sim.Merchants[m].Kind == sim.KTrade && st.P[h].Res.Covers(in, 1) {
				return emit(IntentTookWantedCard, h+1, int(m)+1, againstSelf)
			}
		}
	}
	return nil
}

// noDraw is used where a refill would only add noise: it always takes the first unseen card.
type noDraw struct{}

func (noDraw) Merchant(int) int { return 0 }
func (noDraw) Golem(int) int    { return 0 }
