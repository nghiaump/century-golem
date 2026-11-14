package game

import (
	"math/rand"
	"testing"
)

func TestLegalActions_AllApplyAndAreDistinct(t *testing.T) {
	for seed := int64(1); seed <= 30; seed++ {
		rng := rand.New(rand.NewSource(seed))
		gs := NewGameState(2+int(seed%4), seed)
		for step := 0; step < 200 && !gs.GameOver; step++ {
			if step%7 == 0 {
				seen := map[string]int{}
				for i, a := range gs.LegalActions() {
					c := gs.Clone()
					if _, err := c.Step(a); err != nil {
						t.Fatalf("seed %d step %d: legal action #%d %+v rejected: %v", seed, step, i, a, err)
					}
					key := stateJSON(t, c)
					if j, dup := seen[key]; dup {
						t.Fatalf("seed %d step %d: actions #%d and #%d lead to the same state", seed, step, j, i)
					}
					seen[key] = i
				}
			}
			randomLegalStep(t, gs, rng)
		}
	}
}

func TestLegalActions_PendingDiscardOnlyDiscards(t *testing.T) {
	gs := NewGameState(2, 9)
	p := gs.GetCurrentPlayer()
	p.Resources = &Resources{Yellow: 10, Green: 1}
	p.PendingDiscard = 1
	acts := gs.LegalActions()
	if len(acts) != 2 { // discard 1 yellow, or 1 green
		t.Fatalf("expected 2 discard options, got %d", len(acts))
	}
	for _, a := range acts {
		if a.Type != Discard {
			t.Fatalf("only Discard is legal while a discard is pending, got %+v", a)
		}
	}
}

// UpgradeResults must equal the brute-force set {v : CanUpgraded(res → v, steps)}.
func TestUpgradeResults_MatchesBruteForce(t *testing.T) {
	rng := rand.New(rand.NewSource(99))
	for trial := 0; trial < 300; trial++ {
		res := Resources{Yellow: rng.Intn(5), Green: rng.Intn(4), Blue: rng.Intn(3), Pink: rng.Intn(3)}
		for _, steps := range []int{2, 3} {
			got := map[[4]int]bool{}
			for _, r := range UpgradeResults(res, steps) {
				got[r.Vec()] = true
				in, out := UpgradeIO(res, r)
				if !in.CanUpgraded(&out, steps) {
					t.Fatalf("UpgradeIO(%v→%v) = %v→%v is not a valid upgrade", res, r, in, out)
				}
			}
			n := res.Total()
			want := map[[4]int]bool{}
			for y := 0; y <= n; y++ {
				for g := 0; g <= n-y; g++ {
					for b := 0; b <= n-y-g; b++ {
						v := [4]int{y, g, b, n - y - g - b}
						if res.CanUpgraded(ResourcesFromVec(v), steps) {
							want[v] = true
						}
					}
				}
			}
			if len(got) != len(want) {
				t.Fatalf("res=%v steps=%d: got %d results, brute force %d", res, steps, len(got), len(want))
			}
			for v := range want {
				if !got[v] {
					t.Fatalf("res=%v steps=%d: missing %v", res, steps, v)
				}
			}
		}
	}
}
