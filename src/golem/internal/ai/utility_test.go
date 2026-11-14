package ai

import (
	"testing"

	"golem_century/internal/ai/sim"
)

// Seat 0 is the Very Hard agent, seat 1 another AI, seat 2 a person.
func rivalView() perspective {
	return newPerspective(3, 0, DefaultProfile(VeryHard), []bool{false, false, true})
}

func reward0(pv perspective, v [sim.MaxPlayers]float64, terminal bool, winner int) float64 {
	var r [sim.MaxPlayers]float64
	pv.rewards(&v, terminal, winner, &r)
	return r[0]
}

func TestRivalUtility_GiftsToAnotherAICost(t *testing.T) {
	pv := rivalView()
	base := [sim.MaxPlayers]float64{20, 14, 18}
	// The reported Very Hard bug: spend own crystals so the AI moving next picks them up.
	gift := [sim.MaxPlayers]float64{18, 17, 18}
	if reward0(pv, gift, false, -1) >= reward0(pv, base, false, -1) {
		t.Fatal("handing value to another AI must lower the rival reward")
	}
	// Even a pure gift (no cost to us) to an AI that stays behind must not be neutral.
	if reward0(pv, [sim.MaxPlayers]float64{20, 16, 18}, false, -1) >= reward0(pv, base, false, -1) {
		t.Fatal("feeding a trailing AI must still cost something")
	}
}

func TestRivalUtility_PersonCountsStronger(t *testing.T) {
	pv := rivalView()
	// Same loss of value for the opponent: hurting the person is worth more than hurting the AI.
	hitAI := reward0(pv, [sim.MaxPlayers]float64{20, 16, 19}, false, -1)
	hitHuman := reward0(pv, [sim.MaxPlayers]float64{20, 19, 16}, false, -1)
	if hitHuman <= hitAI {
		t.Fatalf("blocking a close person should be preferred: human %.4f vs AI %.4f", hitHuman, hitAI)
	}
}

func TestRivalUtility_TerminalOrdering(t *testing.T) {
	pv := rivalView()
	win := reward0(pv, [sim.MaxPlayers]float64{25, 24, 24}, true, 0)
	tieWin := reward0(pv, [sim.MaxPlayers]float64{24, 20, 24}, true, 0) // later seat on a tie… modelled by winner
	loseToAI := reward0(pv, [sim.MaxPlayers]float64{24, 25, 20}, true, 1)
	loseToHuman := reward0(pv, [sim.MaxPlayers]float64{24, 20, 25}, true, 2)
	if !(win > 0.5 && tieWin > 0.5) {
		t.Fatalf("a win must be rewarded above 0.5: win %.3f tie-win %.3f", win, tieWin)
	}
	if !(loseToAI < 0.5 && loseToHuman < loseToAI) {
		t.Fatalf("a loss must be below 0.5 and losing to a person worse: AI %.3f human %.3f", loseToAI, loseToHuman)
	}
	if loseToAI >= tieWin {
		t.Fatal("any win must beat any loss")
	}
}

func TestPerspective_VeryHardWithoutPeopleIsPlainRival(t *testing.T) {
	pv := newPerspective(2, 0, DefaultProfile(VeryHard), nil)
	if pv.kind[0] != UtilityRival || pv.kind[1] != UtilityRival || pv.human[1] {
		t.Fatalf("unexpected perspective: %+v", pv)
	}
	pv = newPerspective(3, 1, DefaultProfile(VeryHard), []bool{true, false, false})
	if pv.kind[0] != UtilityBeatLeader || !pv.human[0] || pv.kind[1] != UtilityRival || pv.kind[2] != UtilityRival {
		t.Fatalf("people are modelled as beat-the-leader, AIs as rivals: %+v", pv)
	}
}
