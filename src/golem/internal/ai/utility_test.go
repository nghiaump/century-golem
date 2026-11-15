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

func TestRivalUtility_PersonIsMainRivalOnlyOnATie(t *testing.T) {
	pv := rivalView()
	// AI and person equally strong (19): costing the person 3 is worth more than costing the AI 3.
	hitAI := reward0(pv, [sim.MaxPlayers]float64{20, 16, 19}, false, -1)
	hitHuman := reward0(pv, [sim.MaxPlayers]float64{20, 19, 16}, false, -1)
	if hitHuman <= hitAI {
		t.Fatalf("on equal threat the person is the one to block: human %.4f vs AI %.4f", hitHuman, hitAI)
	}
	// The AI clearly leads (25 vs 22): it stays the main rival, so costing it 2 is worth more than
	// costing the trailing person 2 (the reported bug: an AI far behind spending its turn on a cheap
	// golem only to take it from the person).
	hitAI = reward0(pv, [sim.MaxPlayers]float64{20, 23, 22}, false, -1)
	hitHuman = reward0(pv, [sim.MaxPlayers]float64{20, 25, 20}, false, -1)
	if hitAI <= hitHuman {
		t.Fatalf("a clear AI leader must stay the main rival: AI %.4f vs human %.4f", hitAI, hitHuman)
	}
}

func TestPerspective_MainRival(t *testing.T) {
	pv := rivalView() // seat 0 VH, seat 1 AI, seat 2 person
	cases := []struct {
		v    [sim.MaxPlayers]float64
		want int
	}{
		{[sim.MaxPlayers]float64{20, 30, 25}, 1},   // AI leads clearly
		{[sim.MaxPlayers]float64{20, 30, 29.5}, 2}, // equal threat: the person
		{[sim.MaxPlayers]float64{20, 25, 30}, 2},   // the person leads
	}
	for _, c := range cases {
		if got := pv.mainRival(&c.v, 0); got != c.want {
			t.Errorf("mainRival(%v) = %d, want %d", c.v[:3], got, c.want)
		}
	}
	// Hard (beat-the-leader) has no tie rule: the plain leader.
	hard := newPerspective(3, 0, DefaultProfile(Hard), []bool{false, false, true})
	if got := hard.mainRival(&[sim.MaxPlayers]float64{20, 30, 29.5}, 0); got != 1 {
		t.Errorf("Hard must target the plain leader, got %d", got)
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
