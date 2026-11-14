package game

import (
	"math/rand"
	"testing"
)

// randomLegalStep plays one random legal action (claims preferred, so games make progress).
func randomLegalStep(t *testing.T, gs *GameState, rng *rand.Rand) StepResult {
	t.Helper()
	acts := gs.LegalActions()
	if len(acts) == 0 {
		t.Fatal("no legal actions in a live game")
	}
	var claims []Action
	for _, a := range acts {
		if a.Type == ClaimPointCard {
			claims = append(claims, a)
		}
	}
	a := acts[rng.Intn(len(acts))]
	if len(claims) > 0 && rng.Float64() < 0.7 {
		a = claims[rng.Intn(len(claims))]
	}
	res, err := gs.Step(a)
	if err != nil {
		t.Fatalf("legal action %+v rejected: %v", a, err)
	}
	return res
}

func TestClone_IsIndependent(t *testing.T) {
	for seed := int64(1); seed <= 40; seed++ {
		rng := rand.New(rand.NewSource(seed))
		gs := NewGameState(2+int(seed%4), seed)
		for step := 0; step < 300 && !gs.GameOver; step++ {
			if step%25 == 0 {
				before := stateJSON(t, gs)
				c := gs.Clone()
				if stateJSON(t, c) != before {
					t.Fatalf("seed %d step %d: clone differs from original", seed, step)
				}
				for i := 0; i < 40 && !c.GameOver; i++ {
					randomLegalStep(t, c, rng)
				}
				if stateJSON(t, gs) != before {
					t.Fatalf("seed %d step %d: playing on the clone changed the original", seed, step)
				}
			}
			randomLegalStep(t, gs, rng)
		}
	}
}

func TestClone_WinnerRemapped(t *testing.T) {
	gs := NewGameState(2, 3)
	gs.finishGame()
	c := gs.Clone()
	if c.Winner == nil || c.Winner == gs.Winner || c.Winner.ID != gs.Winner.ID {
		t.Fatal("winner must point into the clone's own players")
	}
}
