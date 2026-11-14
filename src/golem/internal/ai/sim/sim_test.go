package sim

import (
	"math/rand"
	randv2 "math/rand/v2"
	"testing"

	"golem_century/internal/game"
)

// deckDrawer replays the engine's real deck so sim refills match exactly.
type deckDrawer struct {
	t     *testing.T
	st    *State
	nextM int // merchant index the engine will draw, -1 if none
	nextG int
}

func (d *deckDrawer) Merchant(n int) int { return d.find(d.st.MPool[:n], d.nextM, "merchant") }
func (d *deckDrawer) Golem(n int) int    { return d.find(d.st.GPool[:n], d.nextG, "golem") }
func (d *deckDrawer) find(pool []uint8, want int, what string) int {
	for i, v := range pool {
		if int(v) == want {
			return i
		}
	}
	d.t.Fatalf("sim pool has no %s %d", what, want)
	return 0
}

func drawerFor(t *testing.T, gs *game.GameState, st *State) *deckDrawer {
	d := &deckDrawer{t: t, st: st, nextM: -1, nextG: -1}
	if len(gs.Market.ActionDeck) > 0 {
		m, _ := MerchantIndex(gs.Market.ActionDeck[0])
		d.nextM = int(m)
	}
	if len(gs.Market.PointDeck) > 0 {
		g, _ := GolemIndex(gs.Market.PointDeck[0])
		d.nextG = int(g)
	}
	return d
}

func legalKeys(t *testing.T, gs *game.GameState) map[uint64]bool {
	keys := map[uint64]bool{}
	for _, a := range gs.LegalActions() {
		sa, err := FromGameAction(gs, a)
		if err != nil {
			t.Fatalf("FromGameAction(%+v): %v", a, err)
		}
		keys[sa.Key()] = true
	}
	return keys
}

// TestDifferential_SimMatchesEngine plays random games on both implementations and compares the
// full state and the legal move sets after every step.
func TestDifferential_SimMatchesEngine(t *testing.T) {
	games := 2000
	if testing.Short() {
		games = 200
	}
	for g := 0; g < games; g++ {
		n := 2 + g%4
		seed := int64(5000 + g)
		rng := rand.New(rand.NewSource(seed))
		gs := game.NewGameState(n, seed)
		st, err := FromGame(gs)
		if err != nil {
			t.Fatal(err)
		}
		for step := 0; step < 3000 && !gs.GameOver; step++ {
			acts := gs.LegalActions()
			want := legalKeys(t, gs)
			got := map[uint64]bool{}
			for _, a := range st.AppendLegal(nil, Full) {
				got[a.Key()] = true
			}
			if len(got) != len(want) {
				t.Fatalf("game %d step %d: sim has %d legal moves, engine %d", g, step, len(got), len(want))
			}
			for k := range want {
				if !got[k] {
					t.Fatalf("game %d step %d: sim misses a legal move (key %x)", g, step, k)
				}
			}

			a := acts[rng.Intn(len(acts))]
			for _, c := range acts {
				if c.Type == game.ClaimPointCard && rng.Float64() < 0.6 {
					a = c
					break
				}
			}
			sa, err := FromGameAction(gs, a)
			if err != nil {
				t.Fatal(err)
			}
			d := drawerFor(t, gs, &st)
			if _, err := gs.Step(a); err != nil {
				t.Fatalf("engine rejected a legal action: %v", err)
			}
			st.Apply(sa, d)

			exp, err := FromGame(gs)
			if err != nil {
				t.Fatal(err)
			}
			if st.Canonical() != exp {
				t.Fatalf("game %d step %d: state diverged after %+v\nsim:    %+v\nengine: %+v", g, step, sa, st.Canonical(), exp)
			}
		}
	}
}

func TestToGameAction_RoundTrip(t *testing.T) {
	gs := game.NewGameState(3, 42)
	rng := rand.New(rand.NewSource(1))
	for step := 0; step < 400 && !gs.GameOver; step++ {
		st, _ := FromGame(gs)
		for _, sa := range st.AppendLegal(nil, Full) {
			ga, err := ToGameAction(gs, sa)
			if err != nil {
				t.Fatalf("ToGameAction(%+v): %v", sa, err)
			}
			if _, err := gs.Validate(ga); err != nil {
				t.Fatalf("converted action %+v invalid: %v", ga, err)
			}
		}
		acts := gs.LegalActions()
		gs.Step(acts[rng.Intn(len(acts))])
	}
}

// FromGame must not depend on the real deck order (the AI never sees it).
func TestFromGame_IgnoresDeckOrder(t *testing.T) {
	gs := game.NewGameState(4, 9)
	a, _ := FromGame(gs)
	c := gs.Clone()
	rng := rand.New(rand.NewSource(3))
	rng.Shuffle(len(c.Market.ActionDeck), func(i, j int) {
		c.Market.ActionDeck[i], c.Market.ActionDeck[j] = c.Market.ActionDeck[j], c.Market.ActionDeck[i]
	})
	rng.Shuffle(len(c.Market.PointDeck), func(i, j int) {
		c.Market.PointDeck[i], c.Market.PointDeck[j] = c.Market.PointDeck[j], c.Market.PointDeck[i]
	})
	b, _ := FromGame(c)
	if a != b {
		t.Fatal("sim state must be identical for different deck orders")
	}
}

func BenchmarkSimCopyApply(b *testing.B) {
	gs := game.NewGameState(4, 1)
	st, _ := FromGame(gs)
	r := RandDrawer{R: randv2.New(randv2.NewPCG(1, 2))}
	acts := st.AppendLegal(nil, Search)
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		c := st
		c.Apply(acts[i%len(acts)], r)
	}
}

func BenchmarkSimLegal(b *testing.B) {
	gs := game.NewGameState(4, 1)
	st, _ := FromGame(gs)
	buf := make([]Action, 0, 256)
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		buf = st.AppendLegal(buf[:0], Search)
	}
}

func BenchmarkGameCloneStep(b *testing.B) {
	gs := game.NewGameState(4, 1)
	acts := gs.LegalActions()
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		c := gs.Clone()
		c.Step(acts[i%len(acts)])
	}
}
