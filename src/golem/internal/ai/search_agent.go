package ai

import (
	"context"
	"math"
	"math/rand/v2"
	"sync"
	"time"

	"golem_century/internal/ai/sim"
	"golem_century/internal/game"
)

// searchAgent is the agent for every level: Easy uses the 1-ply policy only, the others run an
// ensemble of open-loop MCTS trees (one per worker, each with its own refill samples) and pick
// by aggregated root visits.
type searchAgent struct {
	p      Profile
	rt     *Runtime
	ev     evaluator
	intent intentTracker
}

func newSearchAgent(p Profile, rt *Runtime) *searchAgent {
	ev := newEvaluator()
	if p.Weights != nil {
		ev.w = *p.Weights
	}
	return &searchAgent{p: p, rt: rt, ev: ev}
}

func (a *searchAgent) Level() Level     { return a.p.Level }
func (a *searchAgent) Profile() Profile { return a.p }

var nodePool = sync.Pool{New: func() any { return &[]node{} }}

func (a *searchAgent) Decide(ctx context.Context, snap *game.GameState, o DecideOptions) (Decision, error) {
	start := time.Now()
	st, err := sim.FromGame(snap)
	if err != nil {
		d := greedyDecide(snap, a.p, rand.New(rand.NewPCG(o.Seed, 1)), evalGame)
		d.Stats.Fallback = err.Error()
		return d, nil
	}
	seat := st.Seat()
	n := int(st.N)
	pv := newPerspective(n, seat, a.p, o.Teams)
	pl := policy{ev: a.ev, denialWeight: 0.5}
	if a.p.OppModel {
		pl.denial = denialTargets(&st, seat, &pv, a.ev)
	}
	rng := rand.New(rand.NewPCG(o.Seed, 0xa1))
	drawer := sim.RandDrawer{R: rng}

	legal := st.AppendLegal(nil, sim.Search)
	var chosen sim.Action
	stats := SearchStats{}
	switch {
	case len(legal) == 0:
		return Decision{Action: game.Action{Type: game.Rest}, Stats: SearchStats{Fallback: "no legal moves"}}, nil
	case len(legal) == 1:
		chosen = legal[0]
	default:
		if w, ok := immediateWin(&st, legal, &pv, drawer); ok {
			chosen = w
			break
		}
		if !a.p.Search {
			chosen = a.greedyPick(&st, legal, &pl, drawer, rng)
			break
		}
		var ok bool
		chosen, stats, ok = a.search(ctx, &st, &pv, pl, o, start)
		if !ok {
			if ctx.Err() != nil {
				return Decision{}, ctx.Err()
			}
			chosen = a.greedyPick(&st, legal, &pl, drawer, rng)
			stats.Fallback = "search produced no move"
		}
	}

	ga, err := sim.ToGameAction(snap, chosen)
	if err != nil {
		return Decision{}, err
	}
	d := Decision{Action: ga, Stats: stats}
	// pick the discard if this move overflows the caravan
	after := st
	after.Apply(chosen, drawer)
	if after.P[seat].Pending > 0 && !after.Over {
		before := after
		pl.bestDiscard(&after, drawer)
		var disc sim.Crystals
		for c := 0; c < 4; c++ {
			disc[c] = before.P[seat].Res[c] - after.P[seat].Res[c]
		}
		d.Discard = &game.Resources{Yellow: int(disc[0]), Green: int(disc[1]), Blue: int(disc[2]), Pink: int(disc[3])}
	}
	d.Intents = a.intent.detect(&st, chosen, seat, &pv, a.p, a.ev, o.Teams)
	d.Stats.Elapsed = time.Since(start)
	return d, nil
}

// greedyPick is the 1-ply policy: evaluate every move for the mover (denial included when the
// profile models opponents), drop root blunders, then softmax within the profile's window.
func (a *searchAgent) greedyPick(st *sim.State, legal []sim.Action, pl *policy, d sim.Drawer, rng *rand.Rand) sim.Action {
	scores := make([]float64, len(legal))
	pl.fullScores(st, legal, d, scores)
	applyRootGuard(st, legal, scores)
	best := 0
	for i := range scores {
		if scores[i] > scores[best] {
			best = i
		}
	}
	if a.p.RootTemp <= 0 {
		return legal[best]
	}
	weights := make([]float64, len(scores))
	total := 0.0
	for i, v := range scores {
		if math.IsInf(v, -1) || (a.p.RootWindow > 0 && scores[best]-v > a.p.RootWindow) {
			continue
		}
		weights[i] = math.Exp((v - scores[best]) / a.p.RootTemp)
		total += weights[i]
	}
	r := rng.Float64() * total
	for i, w := range weights {
		if r < w {
			return legal[i]
		}
		r -= w
	}
	return legal[best]
}

// search runs the MCTS ensemble and returns the chosen root move.
func (a *searchAgent) search(ctx context.Context, st *sim.State, pv *perspective, pl policy, o DecideOptions, start time.Time) (sim.Action, SearchStats, bool) {
	var sched *Scheduler
	if a.rt != nil {
		sched = a.rt.Sched
	}
	got, release := sched.Acquire(ctx, max(1, a.p.Workers))
	defer release()
	if got == 0 {
		return sim.Action{}, SearchStats{}, false
	}
	deadline := start.Add(a.p.Budget)
	perWorker := 0
	if o.Iterations > 0 {
		perWorker = max(1, o.Iterations/got)
	}

	trees := make([]*tree, got)
	var wg sync.WaitGroup
	for w := 0; w < got; w++ {
		buf := nodePool.Get().(*[]node)
		t := newTree(a.p, *pv, pl, o.Seed, uint64(w)+1, *buf)
		trees[w] = t
		wg.Add(1)
		go func(t *tree) {
			defer wg.Done()
			t.reset(st)
			for i := 0; ; i++ {
				if perWorker > 0 {
					if i >= perWorker {
						return
					}
				} else if i&127 == 0 && (ctx.Err() != nil || time.Now().After(deadline)) {
					return
				}
				t.iterate(st)
			}
		}(t)
	}
	wg.Wait()

	// aggregate root children by move
	type agg struct {
		act    sim.Action
		visits uint32
		prior  float32
	}
	byKey := map[uint64]*agg{}
	order := []uint64{}
	stats := SearchStats{Workers: got}
	for _, t := range trees {
		stats.Iterations += t.iters
		stats.Nodes += len(t.nodes)
		if len(t.nodes) > 0 {
			for c := t.nodes[0].first; c >= 0; c = t.nodes[c].next {
				ch := &t.nodes[c]
				g, ok := byKey[ch.key]
				if !ok {
					g = &agg{act: ch.act, prior: ch.prior}
					byKey[ch.key] = g
					order = append(order, ch.key)
				}
				g.visits += ch.visits
			}
		}
		nodes := t.nodes[:0]
		nodePool.Put(&nodes)
	}
	if len(order) == 0 {
		return sim.Action{}, stats, false
	}
	best := byKey[order[0]]
	for _, k := range order[1:] {
		g := byKey[k]
		if g.visits > best.visits || (g.visits == best.visits && g.prior > best.prior) {
			best = g
		}
	}
	if a.p.RootTemp > 0 && best.visits > 0 {
		// visit-count softmax: P ∝ visits^(1/τ)
		rng := rand.New(rand.NewPCG(o.Seed, 0xb2))
		total := 0.0
		w := make([]float64, len(order))
		for i, k := range order {
			w[i] = math.Pow(float64(byKey[k].visits)/float64(best.visits), 1/a.p.RootTemp)
			total += w[i]
		}
		r := rng.Float64() * total
		for i, k := range order {
			if r < w[i] {
				return byKey[k].act, stats, true
			}
			r -= w[i]
		}
	}
	return best.act, stats, true
}

// immediateWin returns a move that ends the game with the mover (or its coalition) winning.
func immediateWin(st *sim.State, legal []sim.Action, pv *perspective, d sim.Drawer) (sim.Action, bool) {
	if !st.LastRound {
		return sim.Action{}, false
	}
	mover := st.Seat()
	best, bestPts, found := sim.Action{}, -1, false
	for _, a := range legal {
		c := *st
		c.Apply(a, d)
		if !c.Over {
			continue
		}
		w := int(c.Winner)
		mine := w == mover || (pv.kind[mover] == UtilityCoalition && pv.isAI[w])
		if mine && c.P[mover].FinalPoints() > bestPts {
			best, bestPts, found = a, c.P[mover].FinalPoints(), true
		}
	}
	return best, found
}

// denialTargets marks whose losses count as gains in the priors: the leader (beat-the-leader)
// or every human (coalition).
func denialTargets(st *sim.State, seat int, pv *perspective, ev evaluator) [sim.MaxPlayers]bool {
	var out [sim.MaxPlayers]bool
	if pv.kind[seat] == UtilityCoalition {
		for i := 0; i < int(st.N); i++ {
			out[i] = !pv.isAI[i]
		}
		return out
	}
	var v [sim.MaxPlayers]float64
	ev.values(st, &v)
	leader := -1
	for i := 0; i < int(st.N); i++ {
		if i != seat && (leader < 0 || v[i] > v[leader]) {
			leader = i
		}
	}
	if leader >= 0 && v[leader] >= v[seat]-2 {
		out[leader] = true
	}
	return out
}
