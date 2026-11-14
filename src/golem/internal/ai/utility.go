package ai

import (
	"math"

	"golem_century/internal/ai/sim"
)

// Rival utility (Very Hard). Every AI plays for its own win; nobody shares a reward.
//   - People count as humanEdgeMid points stronger than their evaluation mid-game, so a person
//     who is close is the first rival an AI blocks. At the end the bias shrinks to
//     humanEdgeTerminal: losing to a person is graded a little worse than losing to an AI,
//     but a win is always a win and a loss always a loss.
//   - Mid-game the margin is taken against rivalLeadShare·strongest + (1−rivalLeadShare)·average
//     rival, so handing crystals or cards to ANY opponent costs something (no "gifts" to the AI
//     that moves next).
const (
	humanEdgeMid      = 3.0
	humanEdgeTerminal = 1.0
	rivalLeadShare    = 0.7
)

// perspective says what every seat maximises, from the searching agent's point of view.
type perspective struct {
	n     int
	kind  [sim.MaxPlayers]UtilityKind
	human [sim.MaxPlayers]bool // seats played by people (DecideOptions.Humans)
	scale float64              // points per unit of the logistic (mid-game)
}

// newPerspective builds the utilities: Easy/Medium see everyone as score maximisers, Hard sees
// everyone as beat-the-leader, Very Hard models the other AIs as rivals like itself and people
// as beat-the-leader. The agent's own seat always uses its profile.
func newPerspective(n int, seat int, p Profile, humans []bool) perspective {
	pv := perspective{n: n, scale: 6}
	for i := 0; i < n; i++ {
		pv.human[i] = i != seat && i < len(humans) && humans[i]
		switch p.Utility {
		case UtilityRival:
			pv.kind[i] = UtilityRival
			if pv.human[i] {
				pv.kind[i] = UtilityBeatLeader
			}
		case UtilityBeatLeader:
			pv.kind[i] = UtilityBeatLeader
		default:
			pv.kind[i] = UtilityOwn
		}
	}
	return pv
}

// rewards converts seat values into rewards in [0,1] for every seat. winner is the winning seat
// of a finished game (ties are decided by turn order, so a zero margin is resolved by it), else -1.
func (pv *perspective) rewards(v *[sim.MaxPlayers]float64, terminal bool, winner int, r *[sim.MaxPlayers]float64) {
	scale := pv.scale
	if terminal {
		scale = 2.5 // final scores are exact: sharpen
	}
	for i := 0; i < pv.n; i++ {
		var x float64
		switch pv.kind[i] {
		case UtilityOwn:
			sum := 0.0
			for j := 0; j < pv.n; j++ {
				if j != i {
					sum += v[j]
				}
			}
			x = v[i] - sum/float64(max(1, pv.n-1))
		case UtilityBeatLeader:
			x = v[i] - pv.strongest(v, i, 0)
		case UtilityRival:
			if terminal && winner >= 0 {
				if winner == i {
					x = math.Max(0.5, v[i]-pv.strongest(v, i, 0))
				} else {
					x = math.Min(-0.5, v[i]-pv.strongest(v, i, humanEdgeTerminal))
				}
				break
			}
			sum := 0.0
			for j := 0; j < pv.n; j++ {
				if j != i {
					sum += v[j] + pv.edge(j, humanEdgeMid)
				}
			}
			mean := sum / float64(max(1, pv.n-1))
			x = v[i] - (rivalLeadShare*pv.strongest(v, i, humanEdgeMid) + (1-rivalLeadShare)*mean)
		}
		if terminal && x == 0 && winner >= 0 { // a tie on points: turn order decides
			if winner == i {
				x = 0.5
			} else {
				x = -0.5
			}
		}
		r[i] = 1 / (1 + math.Exp(-x/scale))
	}
}

// strongest returns the best value among the seats other than i, people raised by edge.
func (pv *perspective) strongest(v *[sim.MaxPlayers]float64, i int, edge float64) float64 {
	best := math.Inf(-1)
	for j := 0; j < pv.n; j++ {
		if j != i {
			best = math.Max(best, v[j]+pv.edge(j, edge))
		}
	}
	return best
}

func (pv *perspective) edge(j int, e float64) float64 {
	if pv.human[j] {
		return e
	}
	return 0
}
