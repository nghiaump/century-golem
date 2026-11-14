package arena

import (
	"os"
	"testing"

	"golem_century/internal/ai"
)

// TestGameLengths is a diagnostic (run with AIBENCH_DIAG=1): rounds per game for a few pairings.
func TestGameLengths(t *testing.T) {
	if os.Getenv("AIBENCH_DIAG") == "" {
		t.Skip("diagnostic")
	}
	w := ai.DefaultWeights
	w.CrystalLevel = 0.7
	hoard := ai.DefaultProfile(ai.Medium)
	hoard.Workers, hoard.Weights = 1, &w
	pairs := map[string][]Bot{
		"medium-medium": {LevelBot(ai.Medium, 3000, 1), LevelBot(ai.Medium, 3000, 1)},
		"hoard-medium":  {ProfileBot("hoard", hoard, 3000), LevelBot(ai.Medium, 3000, 1)},
		"hoard-hoard":   {ProfileBot("hoard", hoard, 3000), ProfileBot("hoard", hoard, 3000)},
	}
	for name, bots := range pairs {
		for seed := int64(1); seed <= 4; seed++ {
			r := PlayGame(seed, bots, nil)
			t.Logf("%s seed %d: rounds=%d final=%v err=%v", name, seed, r.Rounds, r.Final, r.Err)
		}
	}
}
