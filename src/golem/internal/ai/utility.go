package ai

import (
	"math"

	"golem_century/internal/ai/sim"
)

// Rival utility (Very Hard). Every AI plays for its own win; nobody shares a reward. The main
// rival is the strongest opponent, and people only break ties:
//   - mid-game a person counts humanTieMid points stronger than their evaluation: when a person
//     and an AI are about as dangerous (within a point), the person is the one to block. An AI
//     that clearly leads stays the main rival, and a person who trails is not targeted.
//   - at the end the bias is humanTieTerminal, below one point while final scores are whole
//     numbers: it only decides between two opponents on the same score. A win is always a win
//     and a loss always a loss.
//   - mid-game the margin is taken against rivalLeadShare·strongest + (1−rivalLeadShare)·average
//     rival, so handing crystals or cards to ANY opponent costs something (no "gifts" to the AI
//     that moves next).
//
// Until 2026-11-15 people counted 3 points stronger (1 at the end). That made an AI that was far
// behind spend its turn taking a cheap golem the person was about to claim, instead of playing for
// its own win (ADR 0008, amendment).
const (
	humanTieMid      = 1.0
	humanTieTerminal = 0.25
	rivalLeadShare   = 0.7
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
					x = math.Min(-0.5, v[i]-pv.strongest(v, i, humanTieTerminal))
				}
				break
			}
			sum := 0.0
			for j := 0; j < pv.n; j++ {
				if j != i {
					sum += v[j] + pv.edge(j, humanTieMid)
				}
			}
			mean := sum / float64(max(1, pv.n-1))
			x = v[i] - (rivalLeadShare*pv.strongest(v, i, humanTieMid) + (1-rivalLeadShare)*mean)
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

// mainRival is the seat whose losses seat counts as its own gains: the strongest other seat. For
// a rival (Very Hard) a person within humanTieMid of the strongest AI takes its place.
func (pv *perspective) mainRival(v *[sim.MaxPlayers]float64, seat int) int {
	tie := 0.0
	if pv.kind[seat] == UtilityRival {
		tie = humanTieMid
	}
	best := -1
	for i := 0; i < pv.n; i++ {
		if i != seat && (best < 0 || v[i]+pv.edge(i, tie) > v[best]+pv.edge(best, tie)) {
			best = i
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
