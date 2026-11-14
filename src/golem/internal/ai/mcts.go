package ai

import (
	"math"
	"math/rand/v2"

	"golem_century/internal/ai/sim"
)

// node is one open-loop tree node: the move that leads to it from its parent plus statistics.
// Nodes live in a per-tree slice and link by index (no pointers, no per-node allocation).
type node struct {
	act      sim.Action
	key      uint64
	prior    float32
	visits   uint32
	avail    uint32 // times this move was legal when its parent was visited
	sum      [sim.MaxPlayers]float32
	first    int32 // first child, -1 if none
	next     int32 // next sibling, -1 if none
	mover    int8  // seat that chooses among this node's children
	expanded bool
}

// tree is one worker's open-loop MCTS: every iteration starts from the root position and samples
// the unseen refills afresh (determinization per iteration), so hidden deck order never matters.
type tree struct {
	nodes  []node
	cap    int
	prof   Profile
	pv     perspective
	pl     policy
	rng    *rand.Rand
	drawer sim.RandDrawer
	acts   []sim.Action
	scores []float64
	priors []float32
	path   []int32
	iters  int
}

// newTree creates a worker tree reusing the given node buffer (may be nil).
func newTree(p Profile, pv perspective, pl policy, seed uint64, stream uint64, nodes []node) *tree {
	rng := rand.New(rand.NewPCG(seed, stream))
	capNodes := p.MaxNodes
	if capNodes <= 0 {
		capNodes = 200000
	}
	return &tree{
		nodes:  nodes[:0],
		cap:    capNodes,
		prof:   p,
		pv:     pv,
		pl:     pl,
		rng:    rng,
		drawer: sim.RandDrawer{R: rng},
		acts:   make([]sim.Action, 0, 256),
		scores: make([]float64, 256),
		priors: make([]float32, 256),
		path:   make([]int32, 0, 64),
	}
}

func (t *tree) reset(root *sim.State) {
	t.nodes = t.nodes[:0]
	t.nodes = append(t.nodes, node{first: -1, next: -1, mover: int8(root.Seat())})
	t.iters = 0
}

// iterate runs one MCTS iteration from root.
func (t *tree) iterate(root *sim.State) {
	s := *root
	t.path = append(t.path[:0], 0)
	ni := int32(0)
	for !s.Over {
		acts := s.AppendLegal(t.acts[:0], sim.Search)
		if !t.nodes[ni].expanded {
			if len(t.nodes)+len(acts) > t.cap {
				break // tree full: evaluate here
			}
			t.expand(ni, &s, acts)
		} else {
			t.addMissing(ni, &s, acts)
		}
		ci := t.selectChild(ni, acts)
		if ci < 0 {
			break
		}
		s.Apply(t.nodes[ci].act, t.drawer)
		t.path = append(t.path, ci)
		ni = ci
		if t.nodes[ci].visits == 0 {
			break // new leaf
		}
	}
	var r [sim.MaxPlayers]float64
	t.rollout(&s, &r)
	for _, idx := range t.path {
		n := &t.nodes[idx]
		n.visits++
		for i := 0; i < int(s.N); i++ {
			n.sum[i] += float32(r[i])
		}
	}
	t.iters++
}

// expand creates the children of node ni with priors from the full policy.
func (t *tree) expand(ni int32, s *sim.State, acts []sim.Action) {
	n := len(acts)
	if cap(t.scores) < n {
		t.scores = make([]float64, n)
		t.priors = make([]float32, n)
	}
	scores, priors := t.scores[:n], t.priors[:n]
	t.pl.fullScores(s, acts, t.drawer, scores)
	if ni == 0 {
		applyRootGuard(s, acts, scores)
	}
	softmaxPriors(scores, 1.0, priors)
	mover := int8(s.Seat())
	prev := int32(-1)
	for i, a := range acts {
		t.nodes = append(t.nodes, node{act: a, key: a.Key(), prior: priors[i], first: -1, next: -1})
		idx := int32(len(t.nodes) - 1)
		if prev < 0 {
			t.nodes[ni].first = idx
		} else {
			t.nodes[prev].next = idx
		}
		prev = idx
	}
	t.nodes[ni].mover = mover
	t.nodes[ni].expanded = true
}

// addMissing adds children for legal moves this node has not seen yet (a different refill made
// them possible) with a small uniform prior.
func (t *tree) addMissing(ni int32, s *sim.State, acts []sim.Action) {
	last := int32(-1)
	for c := t.nodes[ni].first; c >= 0; c = t.nodes[c].next {
		last = c
	}
	for _, a := range acts {
		k := a.Key()
		found := false
		for c := t.nodes[ni].first; c >= 0; c = t.nodes[c].next {
			if t.nodes[c].key == k {
				found = true
				break
			}
		}
		if found || len(t.nodes) >= t.cap {
			continue
		}
		t.nodes = append(t.nodes, node{act: a, key: k, prior: 0.5 / float32(len(acts)), first: -1, next: -1})
		idx := int32(len(t.nodes) - 1)
		if last < 0 {
			t.nodes[ni].first = idx
		} else {
			t.nodes[last].next = idx
		}
		last = idx
	}
}

// selectChild picks the PUCT-best child among the moves legal in this iteration (availability
// counts replace the parent visit count, as in ISMCTS).
func (t *tree) selectChild(ni int32, acts []sim.Action) int32 {
	parent := &t.nodes[ni]
	mover := int(parent.mover)
	parentQ := 0.5
	if parent.visits > 0 {
		parentQ = float64(parent.sum[mover]) / float64(parent.visits)
	}
	best, bestScore := int32(-1), math.Inf(-1)
	for c := parent.first; c >= 0; c = t.nodes[c].next {
		ch := &t.nodes[c]
		legal := false
		for i := range acts {
			if acts[i].Key() == ch.key {
				legal = true
				break
			}
		}
		if !legal {
			continue
		}
		ch.avail++
		q := parentQ - 0.1 // first-play urgency for unvisited moves
		if ch.visits > 0 {
			q = float64(ch.sum[mover]) / float64(ch.visits)
		}
		u := t.prof.CPuct * float64(ch.prior) * math.Sqrt(float64(ch.avail)) / (1 + float64(ch.visits))
		if sc := q + u; sc > bestScore {
			best, bestScore = c, sc
		}
	}
	return best
}

// rollout plays ε-greedy fast moves for RolloutTurns rounds (to the end when near it and the
// profile asks for it), then converts the evaluation into rewards.
func (t *tree) rollout(s *sim.State, r *[sim.MaxPlayers]float64) {
	plies := t.prof.RolloutTurns * int(s.N)
	if t.prof.EndgameToTerminal && nearEnd(s) {
		plies = 6 * int(s.N)
	}
	for i := 0; i < plies && !s.Over; i++ {
		acts := s.AppendLegal(t.acts[:0], sim.Search)
		s.Apply(rolloutMove(s, acts, t.prof.Epsilon, t.rng), t.drawer)
	}
	var v [sim.MaxPlayers]float64
	t.pl.ev.values(s, &v)
	winner := -1
	if s.Over {
		winner = int(s.Winner)
	}
	t.pv.rewards(&v, s.Over, winner, r)
}

// nearEnd reports whether the game is in its last round or someone is one golem from the goal.
func nearEnd(s *sim.State) bool {
	if s.LastRound {
		return true
	}
	for i := 0; i < int(s.N); i++ {
		if s.P[i].Golems+1 >= s.Goal {
			return true
		}
	}
	return false
}

// applyRootGuard removes moves no level should make at the root (scores to −∞ unless nothing
// else is left): resting with nothing played.
func applyRootGuard(s *sim.State, acts []sim.Action, scores []float64) {
	if len(acts) < 2 || s.Cur().Played != 0 {
		return
	}
	for i, a := range acts {
		if a.Kind == sim.ARest {
			scores[i] = math.Inf(-1)
		}
	}
}
