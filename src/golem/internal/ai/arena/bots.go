// Package arena runs AI-vs-AI games for calibration and benchmarks (docs/ai/tinh-chinh.md).
// Every game is played on the reference engine through game.Step, so an illegal AI move fails
// the run instead of being silently fixed.
package arena

import (
	"context"
	"math"
	"math/rand/v2"

	"golem_century/internal/ai"
	"golem_century/internal/ai/sim"
	"golem_century/internal/game"
)

// Bot creates a fresh agent per game (agents may keep per-game state).
type Bot struct {
	Name       string
	New        func() ai.Agent
	Iterations int // fixed iteration budget per decision (0 = the agent's own time budget)
}

// LevelBot is a difficulty level with a fixed iteration budget (deterministic, machine-independent).
func LevelBot(l ai.Level, iterations int, workers int) Bot {
	return Bot{
		Name: l.String(),
		New: func() ai.Agent {
			p := ai.DefaultProfile(l)
			if workers > 0 {
				p.Workers = workers
			}
			return ai.NewAgentWithProfile(p, ai.DefaultRuntime())
		},
		Iterations: iterations,
	}
}

// ProfileBot is a bot with an explicit profile (tuning experiments).
func ProfileBot(name string, p ai.Profile, iterations int) Bot {
	return Bot{Name: name, New: func() ai.Agent { return ai.NewAgentWithProfile(p, ai.DefaultRuntime()) }, Iterations: iterations}
}

// Baselines.
var (
	RandomBot = Bot{Name: "random", New: func() ai.Agent { return &scripted{pick: pickRandom} }}
	GreedyBot = Bot{Name: "greedy", New: func() ai.Agent { return ai.NewLegacyGreedy() }}
	LegacyBot = Bot{Name: "legacy", New: func() ai.Agent {
		return ai.FromStrategy(game.NewAIPlayer(nil), ai.LevelUnknown)
	}}
	RusherBot     = Bot{Name: "rusher", New: func() ai.Agent { return &scripted{pick: pickRusher} }}
	CoinChaserBot = Bot{Name: "coinchaser", New: func() ai.Agent { return &scripted{pick: pickCoinChaser} }}
)

// scripted is a rule-based baseline bot working on the sim state.
type scripted struct {
	pick func(s *sim.State, acts []sim.Action, rng *rand.Rand) sim.Action
}

func (b *scripted) Level() ai.Level     { return ai.LevelUnknown }
func (b *scripted) Profile() ai.Profile { return ai.Profile{} }

func (b *scripted) Decide(_ context.Context, snap *game.GameState, o ai.DecideOptions) (ai.Decision, error) {
	st, err := sim.FromGame(snap)
	if err != nil {
		return ai.Decision{}, err
	}
	rng := rand.New(rand.NewPCG(o.Seed, 77))
	acts := st.AppendLegal(nil, sim.Search)
	a := b.pick(&st, acts, rng)
	ga, err := sim.ToGameAction(snap, a)
	return ai.Decision{Action: ga}, err
}

func pickRandom(_ *sim.State, acts []sim.Action, rng *rand.Rand) sim.Action {
	return acts[rng.IntN(len(acts))]
}

// deficitCost is the crystal-level cost still missing for a golem (same idea as the evaluator).
func deficitCost(res, req sim.Crystals) int {
	cost := 0
	for c := 0; c < 4; c++ {
		if d := int(req[c]) - int(res[c]); d > 0 {
			cost += d * (c + 1)
		}
	}
	return cost
}

// greedyTowards picks the move that most reduces the deficit to the golem chosen by target.
func greedyTowards(s *sim.State, acts []sim.Action, rng *rand.Rand, target func(*sim.State) int) sim.Action {
	best, bestV := acts[0], math.Inf(-1)
	for _, a := range acts {
		c := *s
		c.Apply(a, sim.RandDrawer{R: rng})
		seat := s.Seat()
		v := -float64(deficitCost(c.P[seat].Res, sim.Golems[c.Row[target(&c)]].Req))
		if a.Kind == sim.ARest && s.Cur().Played == 0 {
			v -= 100
		}
		if a.Kind == sim.AAcquire {
			v -= 0.5 // rushers rarely draft
		}
		if v > bestV {
			best, bestV = a, v
		}
	}
	return best
}

// pickRusher claims the cheapest golem as soon as possible.
func pickRusher(s *sim.State, acts []sim.Action, rng *rand.Rand) sim.Action {
	bestClaim, bestReq := -1, 1<<30
	for i, a := range acts {
		if a.Kind == sim.AClaim {
			if r := sim.Golems[s.Row[a.Card]].Req.Total(); r < bestReq {
				bestClaim, bestReq = i, r
			}
		}
	}
	if bestClaim >= 0 {
		return acts[bestClaim]
	}
	return greedyTowards(s, acts, rng, func(c *sim.State) int {
		best, bestCost := 0, 1<<30
		for j := 0; j < int(c.NRow); j++ {
			if cost := deficitCost(c.Cur().Res, sim.Golems[c.Row[j]].Req); cost < bestCost {
				best, bestCost = j, cost
			}
		}
		return best
	})
}

// pickCoinChaser goes for the golems that pay coins (row positions 0 and 1).
func pickCoinChaser(s *sim.State, acts []sim.Action, rng *rand.Rand) sim.Action {
	for _, a := range acts {
		if a.Kind == sim.AClaim && a.Card <= 1 {
			return a
		}
	}
	for _, a := range acts {
		if a.Kind == sim.AClaim {
			return a
		}
	}
	return greedyTowards(s, acts, rng, func(c *sim.State) int { return 0 })
}
