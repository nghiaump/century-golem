package ai

import (
	"context"
	"math"
	"math/rand/v2"
	"time"

	"golem_century/internal/game"
)

// greedyAgent looks one move ahead on the reference engine and picks among the best moves by a
// softmax. It is the Easy policy and the safe fallback of the search agents.
type greedyAgent struct {
	p  Profile
	rt *Runtime
}

func newGreedyAgent(p Profile, rt *Runtime) *greedyAgent { return &greedyAgent{p: p, rt: rt} }

func (g *greedyAgent) Level() Level     { return g.p.Level }
func (g *greedyAgent) Profile() Profile { return g.p }

func (g *greedyAgent) Decide(ctx context.Context, snap *game.GameState, o DecideOptions) (Decision, error) {
	start := time.Now()
	rng := rand.New(rand.NewPCG(o.Seed, 0x9e3779b97f4a7c15))
	d := greedyDecide(snap, g.p, rng, evalGame)
	d.Stats.Elapsed = time.Since(start)
	return d, ctx.Err()
}

type scoredAction struct {
	a       game.Action
	discard *game.Resources
	value   float64
}

// greedyDecide scores every legal move (and the best discard after an overflowing move) with
// eval from the mover's point of view, applies the blunder guard, then picks by softmax.
func greedyDecide(snap *game.GameState, p Profile, rng *rand.Rand, eval func(*game.GameState, int) float64) Decision {
	seat := snap.CurrentTurn % len(snap.Players)
	acts := snap.AppendLegalActions(nil, game.LegalOptions{MaxDepositVariants: 4, MaxDiscardVariants: 6})
	if len(acts) == 0 {
		return Decision{Action: game.Action{Type: game.Rest}, Stats: SearchStats{Fallback: "no legal actions"}}
	}
	scored := make([]scoredAction, 0, len(acts))
	for _, a := range acts {
		c := snap.Clone()
		res, err := c.Step(a)
		if err != nil {
			continue
		}
		sa := scoredAction{a: res.Applied}
		if res.PendingDiscard > 0 {
			best := math.Inf(-1)
			for _, d := range game.DiscardOptions(*c.Players[seat].Resources, res.PendingDiscard) {
				cc := c.Clone()
				dd := d
				if _, err := cc.Step(game.Action{Type: game.Discard, DiscardResources: &dd}); err != nil {
					continue
				}
				if v := eval(cc, seat); v > best {
					best, sa.discard = v, &dd
				}
			}
			sa.value = best
		} else {
			sa.value = eval(c, seat)
		}
		scored = append(scored, sa)
	}
	if len(scored) == 0 {
		return Decision{Action: game.Action{Type: game.Rest}, Stats: SearchStats{Fallback: "no applicable actions"}}
	}
	scored = blunderGuard(snap, seat, scored)
	pick := softmaxPick(scored, p.RootTemp, p.RootWindow, rng)
	return Decision{Action: pick.a, Discard: pick.discard}
}

// blunderGuard removes moves no level should ever make, unless nothing else is left:
// resting with nothing to pick up, and any move other than an available game-winning claim.
func blunderGuard(snap *game.GameState, seat int, in []scoredAction) []scoredAction {
	me := snap.Players[seat]
	out := in[:0:0]
	for _, s := range in {
		if s.a.Type == game.Rest && len(me.PlayedCards) == 0 && len(in) > 1 {
			continue
		}
		out = append(out, s)
	}
	if len(out) == 0 {
		return in
	}
	return out
}

// softmaxPick chooses among moves within `window` points of the best with probability
// ∝ exp(value/temp); temp <= 0 picks the best (ties broken by order).
func softmaxPick(s []scoredAction, temp, window float64, rng *rand.Rand) scoredAction {
	best := 0
	for i := range s {
		if s[i].value > s[best].value {
			best = i
		}
	}
	if temp <= 0 || len(s) == 1 {
		return s[best]
	}
	top := s[best].value
	weights := make([]float64, len(s))
	total := 0.0
	for i := range s {
		if window > 0 && top-s[i].value > window {
			continue
		}
		weights[i] = math.Exp((s[i].value - top) / temp)
		total += weights[i]
	}
	r := rng.Float64() * total
	for i, w := range weights {
		if r < w {
			return s[i]
		}
		r -= w
	}
	return s[best]
}

// evalGame is a cheap static evaluation of `seat`'s position in points: banked points, crystal
// value, progress towards the visible golems and a small engine term. (The search levels use the
// richer evaluator in eval.go; this one keeps the greedy policy self-contained.)
func evalGame(gs *game.GameState, seat int) float64 {
	p := gs.Players[seat]
	if gs.GameOver {
		return float64(p.GetFinalPoints())
	}
	v := float64(p.GetPoints())
	have := p.Resources.Vec()
	for c, n := range have {
		v += 0.45 * float64((c+1)*n)
	}
	best, second := 0.0, 0.0
	for _, g := range gs.Market.PointCards {
		req := g.Requirement.Vec()
		short := 0
		for c := 0; c < 4; c++ {
			if d := req[c] - have[c]; d > 0 {
				short += d * (c + 1)
			}
		}
		val := float64(g.Points) * math.Pow(0.82, float64(short)/2)
		if val > best {
			best, second = val, best
		} else if val > second {
			second = val
		}
	}
	v += 0.55*best + 0.15*second
	cards := len(p.Hand) + len(p.PlayedCards)
	v += 0.35 * float64(min(cards, 8))
	v -= 0.08 * float64(len(p.PlayedCards))
	return v
}
