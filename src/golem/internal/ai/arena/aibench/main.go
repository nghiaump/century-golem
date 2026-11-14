// Command aibench benchmarks and calibrates the Century Golem AI (docs/ai/tinh-chinh.md).
//
//	aibench bench      -level veryhard -n 30            # think time / iterations on THIS machine
//	aibench tournament -a hard -b medium -players 2 -seeds 200 -iters-a 40000 -iters-b 6000
//	aibench ladder     -seeds 100                       # every adjacent pair + baselines
//	aibench vshuman    -seeds 50 -players 4             # proxy human vs 3 Very Hard / 3 Hard
//
// It lives under internal/ so it ships in the backend patch, but it is never built into the
// production image.
package main

import (
	"context"
	"flag"
	"fmt"
	"math/rand"
	"os"
	"runtime"
	"sort"
	"time"

	"golem_century/internal/ai"
	"golem_century/internal/ai/arena"
	"golem_century/internal/game"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "usage: aibench bench|tournament|ladder|vshuman|variant [flags]")
		os.Exit(2)
	}
	switch os.Args[1] {
	case "bench":
		bench(os.Args[2:])
	case "tournament":
		tournament(os.Args[2:])
	case "ladder":
		ladder(os.Args[2:])
	case "vshuman":
		vsHuman(os.Args[2:])
	case "variant":
		variant(os.Args[2:])
	default:
		fmt.Fprintln(os.Stderr, "unknown command", os.Args[1])
		os.Exit(2)
	}
}

func level(s string) ai.Level {
	l, err := ai.ParseLevel(s)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}
	return l
}

func botFor(name string, iters, workers int) arena.Bot {
	switch name {
	case "random":
		return arena.RandomBot
	case "greedy":
		return arena.GreedyBot
	case "legacy":
		return arena.LegacyBot
	case "rusher":
		return arena.RusherBot
	case "coinchaser":
		return arena.CoinChaserBot
	}
	return arena.LevelBot(level(name), iters, workers)
}

// bench measures real decisions with the level's time budget on mid-game positions.
func bench(args []string) {
	fs := flag.NewFlagSet("bench", flag.ExitOnError)
	lv := fs.String("level", "veryhard", "level")
	n := fs.Int("n", 30, "decisions")
	players := fs.Int("players", 4, "players")
	threads := fs.Int("threads", 0, "AI_MAX_THREADS (0 = auto)")
	scale := fs.Int("scale", 100, "AI_THINK_SCALE_PCT")
	fs.Parse(args)

	rt := &ai.Runtime{Sched: ai.NewScheduler(*threads), ScalePct: *scale}
	agent := ai.NewAgent(level(*lv), rt)
	var elapsed []time.Duration
	iters, nodes := 0, 0
	var ms runtime.MemStats
	peak := uint64(0)
	rng := rand.New(rand.NewSource(1))
	for i := 0; i < *n; i++ {
		gs := game.NewGameState(*players, int64(1000+i))
		for k := 0; k < 8+rng.Intn(30) && !gs.GameOver; k++ { // random mid-game position
			acts := gs.LegalActions()
			gs.Step(acts[rng.Intn(len(acts))])
			if p := gs.GetCurrentPlayer(); p.PendingDiscard > 0 {
				gs.Step(game.Action{Type: game.Discard, DiscardResources: game.AutoDiscard(p.Resources, p.PendingDiscard)})
			}
		}
		if gs.GameOver {
			continue
		}
		start := time.Now()
		d, err := agent.Decide(context.Background(), gs.Clone(), ai.DecideOptions{Seed: uint64(i)})
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		elapsed = append(elapsed, time.Since(start))
		iters += d.Stats.Iterations
		nodes += d.Stats.Nodes
		runtime.ReadMemStats(&ms)
		peak = max(peak, ms.HeapInuse)
	}
	sort.Slice(elapsed, func(i, j int) bool { return elapsed[i] < elapsed[j] })
	k := len(elapsed)
	if k == 0 {
		fmt.Println("no decisions")
		return
	}
	total := time.Duration(0)
	for _, e := range elapsed {
		total += e
	}
	fmt.Printf("level=%s players=%d decisions=%d cpus=%d threads=%d\n", *lv, *players, k, runtime.NumCPU(), rt.Sched.Capacity())
	fmt.Printf("think p50=%v p95=%v max=%v\n", elapsed[k/2], elapsed[k*95/100], elapsed[k-1])
	fmt.Printf("iterations/decision=%d  iterations/s=%.0f  nodes/decision=%d  heap-in-use peak=%.1f MiB\n",
		iters/k, float64(iters)/total.Seconds(), nodes/k, float64(peak)/(1<<20))
}

func tournament(args []string) {
	fs := flag.NewFlagSet("tournament", flag.ExitOnError)
	a := fs.String("a", "hard", "bot A")
	b := fs.String("b", "medium", "bot B")
	players := fs.Int("players", 2, "players")
	seeds := fs.Int("seeds", 100, "seeds (each played once per seat)")
	itersA := fs.Int("iters-a", 20000, "iterations per decision for A")
	itersB := fs.Int("iters-b", 5000, "iterations per decision for B")
	parallel := fs.Int("parallel", 0, "parallel games (0 = all CPUs)")
	first := fs.Int64("seed", 1, "first seed")
	fs.Parse(args)
	s := arena.HeadToHead(botFor(*a, *itersA, 1), botFor(*b, *itersB, 1), *players, *seeds, *first, *parallel)
	fmt.Println(s)
	for i, e := range s.Errors {
		if i < 5 {
			fmt.Println("  error:", e)
		}
	}
}

// ladderIters are the per-decision iteration budgets that approximate each level on the phone
// (see docs/ai/hieu-nang.md; measured with `aibench bench` on pixel3xl).
var ladderIters = map[ai.Level]int{ai.Easy: 0, ai.Medium: 5000, ai.Hard: 40000, ai.VeryHard: 200000}

func ladder(args []string) {
	fs := flag.NewFlagSet("ladder", flag.ExitOnError)
	seeds := fs.Int("seeds", 100, "seeds per pairing")
	players := fs.Int("players", 2, "players")
	parallel := fs.Int("parallel", 0, "parallel games")
	scale := fs.Float64("iter-scale", 1, "multiply every iteration budget")
	fs.Parse(args)
	it := func(l ai.Level) int { return int(float64(ladderIters[l]) * *scale) }
	pairs := [][2]arena.Bot{
		{arena.LevelBot(ai.Easy, 0, 0), arena.LegacyBot},
		{arena.LevelBot(ai.Easy, 0, 0), arena.GreedyBot},
		{arena.LevelBot(ai.Medium, it(ai.Medium), 0), arena.LegacyBot},
		{arena.LevelBot(ai.Medium, it(ai.Medium), 0), arena.LevelBot(ai.Easy, 0, 0)},
		{arena.LevelBot(ai.Hard, it(ai.Hard), 0), arena.LevelBot(ai.Medium, it(ai.Medium), 0)},
		{arena.LevelBot(ai.VeryHard, it(ai.VeryHard), 0), arena.LevelBot(ai.Hard, it(ai.Hard), 0)},
		{arena.LevelBot(ai.Hard, it(ai.Hard), 0), arena.RusherBot},
		{arena.LevelBot(ai.Hard, it(ai.Hard), 0), arena.CoinChaserBot},
	}
	for _, p := range pairs {
		start := time.Now()
		s := arena.HeadToHead(p[0], p[1], *players, *seeds, 1, *parallel)
		fmt.Printf("%s  (%s)\n", s, time.Since(start).Round(time.Second))
		for i, e := range s.Errors {
			if i < 3 {
				fmt.Println("  error:", e)
			}
		}
	}
}

func vsHuman(args []string) {
	fs := flag.NewFlagSet("vshuman", flag.ExitOnError)
	seeds := fs.Int("seeds", 50, "seeds (human plays every seat)")
	players := fs.Int("players", 4, "players")
	parallel := fs.Int("parallel", 0, "parallel games")
	humanIters := fs.Int("human-iters", 2*ladderIters[ai.VeryHard], "proxy human iterations")
	oppScale := fs.Float64("iter-scale", 1, "multiply the AI opponents' iteration budgets")
	fs.Parse(args)
	human := arena.ProfileBot("proxy-human", ai.DefaultProfile(ai.Hard), *humanIters)
	for _, opp := range []arena.Bot{
		arena.LevelBot(ai.Hard, int(float64(ladderIters[ai.Hard])**oppScale), 0),
		arena.LevelBot(ai.VeryHard, int(float64(ladderIters[ai.VeryHard])**oppScale), 0),
	} {
		start := time.Now()
		r := arena.VsHuman(human, opp, *players, *seeds, 1, *parallel)
		fmt.Printf("proxy human vs %d×%-9s: %4d games, human wins %5.1f%% [%4.1f–%4.1f] (fair share %.0f%%)  errors %d  (%s)\n",
			*players-1, r.Opponents, r.Games, 100*r.WinRate, 100*r.Lo, 100*r.Hi, 100/float64(*players), len(r.Errors), time.Since(start).Round(time.Second))
	}
}

// variant pits a level with modified evaluator weights against the same level with the defaults.
func variant(args []string) {
	fs := flag.NewFlagSet("variant", flag.ExitOnError)
	lv := fs.String("level", "medium", "level")
	iters := fs.Int("iters", 5000, "iterations per decision (both sides)")
	workers := fs.Int("workers", 1, "workers per search")
	players := fs.Int("players", 2, "players")
	seeds := fs.Int("seeds", 100, "seeds")
	parallel := fs.Int("parallel", 0, "parallel games")
	w := ai.DefaultWeights
	fs.Float64Var(&w.CrystalLevel, "crystal", w.CrystalLevel, "CrystalLevel")
	fs.Float64Var(&w.Progress1, "p1", w.Progress1, "Progress1")
	fs.Float64Var(&w.Progress2, "p2", w.Progress2, "Progress2")
	fs.Float64Var(&w.Gamma, "gamma", w.Gamma, "Gamma")
	fs.Float64Var(&w.Contested, "contested", w.Contested, "Contested")
	fs.Float64Var(&w.Engine, "engine", w.Engine, "Engine")
	fs.Float64Var(&w.Played, "played", w.Played, "Played")
	fs.Float64Var(&w.ExtraCard, "extracard", w.ExtraCard, "ExtraCard")
	cpuct := fs.Float64("cpuct", 0, "override CPuct (0 = default)")
	eps := fs.Float64("eps", -1, "override Epsilon (-1 = default)")
	rollout := fs.Int("rollout", -1, "override RolloutTurns (-1 = default)")
	fs.Parse(args)
	l := level(*lv)
	pv := ai.DefaultProfile(l)
	pv.Workers = *workers
	pv.Weights = &w
	if *cpuct > 0 {
		pv.CPuct = *cpuct
	}
	if *eps >= 0 {
		pv.Epsilon = *eps
	}
	if *rollout >= 0 {
		pv.RolloutTurns = *rollout
	}
	base := ai.DefaultProfile(l)
	base.Workers = *workers
	s := arena.HeadToHead(arena.ProfileBot("variant", pv, *iters), arena.ProfileBot("default", base, *iters), *players, *seeds, 1, *parallel)
	fmt.Printf("%+v\n", w)
	for i, e := range s.Errors {
		if i < 5 {
			fmt.Println("  error:", e)
		}
	}
	fmt.Println(s)
}
