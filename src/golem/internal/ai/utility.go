package ai

import (
	"math"

	"golem_century/internal/ai/sim"
)

// perspective says what every seat maximises, from the searching agent's point of view.
type perspective struct {
	n     int
	kind  [sim.MaxPlayers]UtilityKind
	team  [sim.MaxPlayers]int  // coalition team per seat
	isAI  [sim.MaxPlayers]bool // seats on the AI team (coalition)
	scale float64              // points per unit of the logistic (mid-game)
}

// newPerspective builds the utilities: the agent's own seat uses its profile; in coalition mode
// every AI-team seat shares the team reward and humans are modelled as beat-the-leader; otherwise
// Easy/Medium see everyone as score maximisers and Hard sees everyone as beat-the-leader.
func newPerspective(n int, seat int, p Profile, teams []int) perspective {
	pv := perspective{n: n, scale: 6}
	myTeam := -1
	if seat < len(teams) {
		myTeam = teams[seat]
	}
	for i := 0; i < n; i++ {
		pv.team[i] = 100 + i
		if i < len(teams) {
			pv.team[i] = teams[i]
		}
		switch p.Utility {
		case UtilityCoalition:
			pv.isAI[i] = pv.team[i] == myTeam
			if pv.isAI[i] {
				pv.kind[i] = UtilityCoalition
			} else {
				pv.kind[i] = UtilityBeatLeader
			}
		case UtilityBeatLeader:
			pv.kind[i] = UtilityBeatLeader
		default:
			pv.kind[i] = UtilityOwn
		}
	}
	// a coalition needs at least one opponent outside the team; otherwise beat the leader
	if p.Utility == UtilityCoalition {
		others := false
		for i := 0; i < n; i++ {
			others = others || !pv.isAI[i]
		}
		if !others {
			for i := 0; i < n; i++ {
				pv.kind[i] = UtilityBeatLeader
			}
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
	bestAI, bestHuman := math.Inf(-1), math.Inf(-1)
	for i := 0; i < pv.n; i++ {
		if pv.isAI[i] {
			bestAI = math.Max(bestAI, v[i])
		} else {
			bestHuman = math.Max(bestHuman, v[i])
		}
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
			best := math.Inf(-1)
			for j := 0; j < pv.n; j++ {
				if j != i {
					best = math.Max(best, v[j])
				}
			}
			x = v[i] - best
		case UtilityCoalition:
			x = bestAI - bestHuman
		}
		if terminal && x == 0 && winner >= 0 { // a tie on points: turn order decides
			won := winner == i
			if pv.kind[i] == UtilityCoalition {
				won = pv.isAI[winner]
			}
			if won {
				x = 0.5
			} else {
				x = -0.5
			}
		}
		r[i] = 1 / (1 + math.Exp(-x/scale))
	}
}
