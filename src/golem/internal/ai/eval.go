package ai

import (
	"math"

	"golem_century/internal/ai/sim"
)

// Weights are the evaluator's tunable parameters (points per unit). Tuned in M6, see
// docs/ai/tinh-chinh.md.
type Weights struct {
	CrystalLevel float64 // mid-game value of one crystal level (yellow 1 … pink 4)
	Progress1    float64 // weight of the best reachable golem's net value
	Progress2    float64 // weight of the second best
	Gamma        float64 // discount per extra turn needed
	Contested    float64 // factor when an opponent reaches the golem sooner
	Tied         float64 // factor when an opponent reaches it in the same number of turns
	Engine       float64 // value per point of card potential (scaled down as the game ends)
	EngineCap    float64 // cap on summed card potential
	CardsSoftCap int     // more cards than this slow the engine down
	ExtraCard    float64 // penalty per card above the soft cap
	Played       float64 // tempo cost per played card (needs a rest to come back)
	MinRate      float64 // crystal levels gained per turn by the weakest engine
}

// DefaultWeights are the starting weights (h_illes BGA guide + NikhilMittal engine.js, tuned).
// Tuning log: docs/ai/tinh-chinh.md (round 1: CrystalLevel 0.6→0.75, Progress2 0.25→0.35).
var DefaultWeights = Weights{
	CrystalLevel: 0.75, Progress1: 0.75, Progress2: 0.35, Gamma: 0.8, Contested: 0.55, Tied: 0.8,
	Engine: 0.18, EngineCap: 40, CardsSoftCap: 8, ExtraCard: 0.8, Played: 0.12, MinRate: 2,
}

// cardPotential[m] is the crystal-level gain of one full play of merchant m (the expert's
// "step value"): produce = output levels, upgrade = steps, trade = gain × repeats that fit in
// a 10-crystal caravan (YY>GG and P>BB = +10, YYY>GGG = +9, YYYYY>BBB = +8).
var cardPotential [sim.NumMerchants]float64

func init() {
	for m := range sim.Merchants {
		d := &sim.Merchants[m]
		switch d.Kind {
		case sim.KProduce:
			cardPotential[m] = float64(d.Out.Level())
		case sim.KUpgrade:
			cardPotential[m] = float64(d.Steps)
		case sim.KTrade:
			gain := d.Out.Level() - d.In.Level()
			reps := min(sim.MaxCrystals/max(1, d.In.Total()), sim.MaxCrystals/max(1, d.Out.Total()))
			cardPotential[m] = float64(gain * max(1, reps))
		}
	}
}

// evaluator scores positions. It is stateless apart from its weights, so one value can be shared
// by all search workers.
type evaluator struct{ w Weights }

func newEvaluator() evaluator { return evaluator{w: DefaultWeights} }

// phase in [0,1]: how close the game is to its end (max golems / goal, 1 in the last round).
func phase(s *sim.State) float64 {
	if s.LastRound || s.Over {
		return 1
	}
	most := uint8(0)
	for i := 0; i < int(s.N); i++ {
		most = max(most, s.P[i].Golems)
	}
	return math.Min(1, float64(most)/float64(s.Goal))
}

// endWeight is how much crystals are valued at their final-scoring value (1 per non-yellow)
// instead of their conversion value. It reaches 1 as soon as someone is one golem from the goal:
// if it only jumped to 1 when the last round starts, triggering the end would devalue a player's
// crystals and two AIs at goal−1 would both refuse to claim the final golem (observed stall).
func endWeight(s *sim.State) float64 {
	if s.LastRound || s.Over {
		return 1
	}
	most := 0
	for i := 0; i < int(s.N); i++ {
		most = max(most, int(s.P[i].Golems))
	}
	return math.Max(0, math.Min(1, float64(most-(int(s.Goal)-3))/2))
}

// engineRate estimates crystal levels a player gains per turn: the mean of its three best cards,
// discounted for the turns spent resting, never below MinRate.
func (e evaluator) engineRate(p *sim.Player) float64 {
	var top [3]float64
	n := 0
	for h := p.Hand | p.Played; h != 0; h &= h - 1 {
		v := cardPotential[bitIndex(h)]
		n++
		for i := 0; i < 3; i++ {
			if v > top[i] {
				copy(top[i+1:], top[i:2])
				top[i] = v
				break
			}
		}
	}
	k := min(n, 3)
	if k == 0 {
		return e.w.MinRate
	}
	mean := (top[0] + top[1] + top[2]) / float64(k)
	rest := float64(n) / float64(n+1) // one rest every n plays
	return math.Max(e.w.MinRate, mean*rest)
}

// turnsToAfford estimates the turns a player needs before claiming a golem (1 = claim on its
// next turn). Each missing crystal is made from the highest spare crystal below its colour
// (cost = level difference, an upgrade) or else produced from scratch (cost = its level); the
// total cost is paid at `rate` levels per turn.
func turnsToAfford(res sim.Crystals, req sim.Crystals, rate float64) int {
	var need, spare [4]int
	for c := 0; c < 4; c++ {
		if d := int(req[c]) - int(res[c]); d > 0 {
			need[c] = d
		} else {
			spare[c] = -d
		}
	}
	cost := 0
	for c := 3; c >= 0; c-- {
		for ; need[c] > 0; need[c]-- {
			src := -1
			for l := c - 1; l >= 0; l-- {
				if spare[l] > 0 {
					src = l
					break
				}
			}
			if src >= 0 {
				spare[src]--
				cost += c - src
			} else {
				cost += c + 1
			}
		}
	}
	if cost == 0 {
		return 1
	}
	return 1 + int(math.Ceil(float64(cost)/rate))
}

// coinBonus is the coin a claim at row position j would earn right now.
func coinBonus(s *sim.State, j int) int {
	switch {
	case j == 0 && s.Copper > 0:
		return 3
	case j == 0 && s.Silver > 0:
		return 1
	case j == 1 && s.Copper > 0 && s.Silver > 0:
		return 1
	}
	return 0
}

// remainingTurns returns how many more turns seat i gets in the last round (huge otherwise).
func remainingTurns(s *sim.State, i int) int {
	if !s.LastRound {
		return 1 << 20
	}
	cur := s.Seat()
	if i >= cur {
		return 1
	}
	return 0
}

// values fills v[i] with every seat's evaluation in points (final points when the game is over).
func (e evaluator) values(s *sim.State, v *[sim.MaxPlayers]float64) {
	n := int(s.N)
	if s.Over {
		for i := 0; i < n; i++ {
			v[i] = float64(s.P[i].FinalPoints())
		}
		return
	}
	ph := phase(s)
	lambda := endWeight(s)

	var rate [sim.MaxPlayers]float64
	var t [sim.MaxPlayers][sim.GolemRowSize]int
	for i := 0; i < n; i++ {
		rate[i] = e.engineRate(&s.P[i])
		for j := 0; j < int(s.NRow); j++ {
			t[i][j] = turnsToAfford(s.P[i].Res, sim.Golems[s.Row[j]].Req, rate[i])
		}
	}

	for i := 0; i < n; i++ {
		p := &s.P[i]
		val := float64(p.Banked())
		// crystals: their conversion value mid-game, their scoring value (non-yellow) at the end
		val += (1-lambda)*e.w.CrystalLevel*float64(p.Res.Level()) + lambda*float64(int(p.Res[1])+int(p.Res[2])+int(p.Res[3]))

		// progress towards the visible golems: net value (points + coin − crystals spent),
		// discounted by turns needed and by competition
		left := remainingTurns(s, i)
		best, second := 0.0, 0.0
		for j := 0; j < int(s.NRow); j++ {
			g := &sim.Golems[s.Row[j]]
			ti := t[i][j]
			if ti > left {
				continue
			}
			spent := (1-lambda)*e.w.CrystalLevel*float64(g.Req.Level()) + lambda*float64(int(g.Req[1])+int(g.Req[2])+int(g.Req[3]))
			net := float64(int(g.Points)+coinBonus(s, j)) - spent
			if net <= 0 {
				continue
			}
			net *= math.Pow(e.w.Gamma, float64(ti-1))
			for q := 0; q < n; q++ {
				if q == i {
					continue
				}
				if t[q][j] < ti {
					net *= e.w.Contested
					break
				} else if t[q][j] == ti {
					net *= e.w.Tied
				}
			}
			if net > best {
				best, second = net, best
			} else if net > second {
				second = net
			}
		}
		val += e.w.Progress1*best + e.w.Progress2*second

		// engine: card potential matters less as the end approaches
		pot := 0.0
		cards := 0
		for h := p.Hand | p.Played; h != 0; h &= h - 1 {
			pot += cardPotential[bitIndex(h)]
			cards++
		}
		val += (1 - ph) * e.w.Engine * math.Min(pot, e.w.EngineCap)
		if extra := cards - e.w.CardsSoftCap; extra > 0 {
			val -= (1 - ph) * e.w.ExtraCard * float64(extra)
		}
		val -= (1 - ph) * e.w.Played * float64(popcount(p.Played))
		v[i] = val
	}
}

// value returns one seat's evaluation.
func (e evaluator) value(s *sim.State, seat int) float64 {
	var v [sim.MaxPlayers]float64
	e.values(s, &v)
	return v[seat]
}

func bitIndex(h uint64) int {
	n := 0
	for h&1 == 0 {
		h >>= 1
		n++
	}
	return n
}

func popcount(x uint64) int {
	n := 0
	for ; x != 0; x &= x - 1 {
		n++
	}
	return n
}
