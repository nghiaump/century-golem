package arena

import (
	"context"
	"fmt"
	"math"
	"runtime"
	"sync"

	"golem_century/internal/ai"
	"golem_century/internal/game"
)

// GameResult is the outcome of one game.
type GameResult struct {
	Seed   int64
	Bots   []string // bot name per seat
	Final  []int    // final points per seat
	Winner int      // winning seat
	Rounds int
	Err    error
}

// MaxRounds aborts a game that stalls (no real game gets close: ~35–70 rounds).
var MaxRounds = 150

// PlayGame plays one game with bots[i] in seat i. teams (optional) is passed to every agent.
func PlayGame(seed int64, bots []Bot, teams []int) GameResult {
	n := len(bots)
	gs := game.NewGameState(n, seed)
	agents := make([]ai.Agent, n)
	res := GameResult{Seed: seed, Bots: make([]string, n), Final: make([]int, n)}
	for i, b := range bots {
		agents[i] = b.New()
		res.Bots[i] = b.Name
		gs.Players[i].IsAI = true
	}
	for step := 0; !gs.GameOver; step++ {
		if gs.Round > MaxRounds {
			desc := ""
			for _, p := range gs.Players {
				desc += fmt.Sprintf(" [golems %d, crystals %s, hand %d, played %d]", len(p.PointCards), p.Resources, len(p.Hand), len(p.PlayedCards))
			}
			res.Err = fmt.Errorf("game %d still running after %d rounds (stall):%s", seed, MaxRounds, desc)
			res.Rounds = gs.Round
			return res
		}
		seat := gs.CurrentTurn % n
		d, err := agents[seat].Decide(context.Background(), gs.Clone(), ai.DecideOptions{
			Seed: uint64(seed)*1000003 + uint64(step), Iterations: bots[seat].Iterations, Teams: teams,
		})
		if err != nil {
			res.Err = fmt.Errorf("seat %d (%s) step %d: %w", seat, bots[seat].Name, step, err)
			return res
		}
		r, err := gs.Step(d.Action)
		if err != nil {
			res.Err = fmt.Errorf("seat %d (%s) step %d: illegal %+v: %w", seat, bots[seat].Name, step, d.Action, err)
			return res
		}
		if r.PendingDiscard > 0 {
			disc := d.Discard
			if disc == nil {
				disc = game.AutoDiscard(gs.Players[seat].Resources, r.PendingDiscard)
			}
			if _, err := gs.Step(game.Action{Type: game.Discard, DiscardResources: disc}); err != nil {
				res.Err = fmt.Errorf("seat %d (%s): discard: %w", seat, bots[seat].Name, err)
				return res
			}
		}
	}
	for i, p := range gs.Players {
		res.Final[i] = p.GetFinalPoints()
		if p == gs.Winner {
			res.Winner = i
		}
	}
	res.Rounds = gs.Round
	return res
}

// Summary aggregates head-to-head results for bot A.
type Summary struct {
	A, B         string
	Players      int
	Games        int
	WinsA        int
	MarginA      float64 // mean (A points − best other points)
	Errors       []error
	MeanRounds   float64
	WinRate      float64
	WilsonLo, Hi float64
}

// HeadToHead plays `seeds` seeds; for each seed A takes every seat once (the other seats are B),
// so seat advantages cancel out. parallel <= 0 uses all CPUs.
func HeadToHead(a, b Bot, players, seeds int, firstSeed int64, parallel int) Summary {
	if parallel <= 0 {
		parallel = runtime.NumCPU()
	}
	type job struct {
		seed int64
		seat int
	}
	type done struct {
		r     GameResult
		aSeat int
	}
	jobs := make(chan job)
	results := make(chan done)
	var wg sync.WaitGroup
	for w := 0; w < parallel; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := range jobs {
				bots := make([]Bot, players)
				for i := range bots {
					bots[i] = b
				}
				bots[j.seat] = a
				results <- done{r: PlayGame(j.seed, bots, nil), aSeat: j.seat}
			}
		}()
	}
	go func() {
		for s := 0; s < seeds; s++ {
			for seat := 0; seat < players; seat++ {
				jobs <- job{seed: firstSeed + int64(s), seat: seat}
			}
		}
		close(jobs)
		wg.Wait()
		close(results)
	}()

	sum := Summary{A: a.Name, B: b.Name, Players: players}
	for d := range results {
		r := d.r
		if r.Err != nil {
			sum.Errors = append(sum.Errors, r.Err)
			continue
		}
		sum.Games++
		if r.Winner == d.aSeat {
			sum.WinsA++
		}
		sum.MeanRounds += float64(r.Rounds)
		best := math.Inf(-1)
		for i, p := range r.Final {
			if i != d.aSeat {
				best = math.Max(best, float64(p))
			}
		}
		sum.MarginA += float64(r.Final[d.aSeat]) - best
	}
	if sum.Games > 0 {
		sum.WinRate = float64(sum.WinsA) / float64(sum.Games)
		sum.MarginA /= float64(sum.Games)
		sum.MeanRounds /= float64(sum.Games)
		sum.WilsonLo, sum.Hi = Wilson(sum.WinsA, sum.Games)
	}
	return sum
}

// Wilson returns the 95% Wilson score interval of a win rate.
func Wilson(wins, n int) (lo, hi float64) {
	if n == 0 {
		return 0, 1
	}
	const z = 1.96
	p := float64(wins) / float64(n)
	den := 1 + z*z/float64(n)
	center := p + z*z/(2*float64(n))
	half := z * math.Sqrt(p*(1-p)/float64(n)+z*z/(4*float64(n)*float64(n)))
	return (center - half) / den, (center + half) / den
}

// Elo converts a win rate into an Elo difference.
func Elo(winRate float64) float64 {
	winRate = math.Min(0.999, math.Max(0.001, winRate))
	return -400 * math.Log10(1/winRate-1)
}

func (s Summary) String() string {
	return fmt.Sprintf("%-11s vs %-11s %dp: %4d games  win %5.1f%% [%4.1f–%4.1f]  Elo %+5.0f  margin %+5.1f  rounds %.1f  errors %d",
		s.A, s.B, s.Players, s.Games, 100*s.WinRate, 100*s.WilsonLo, 100*s.Hi, Elo(s.WinRate), s.MarginA, s.MeanRounds, len(s.Errors))
}

// CoalitionResult is the outcome of 1 proxy-human vs (players−1) AIs.
type CoalitionResult struct {
	Opponents string
	Games     int
	HumanWins int
	WinRate   float64
	Lo, Hi    float64
	Errors    []error
}

// Coalition seats a proxy human against players−1 copies of opp, rotating the human's seat, with
// teams set so coalition-utility AIs play together against the human.
func Coalition(human, opp Bot, players, seeds int, firstSeed int64, parallel int) CoalitionResult {
	if parallel <= 0 {
		parallel = runtime.NumCPU()
	}
	var mu sync.Mutex
	out := CoalitionResult{Opponents: opp.Name}
	sem := make(chan struct{}, parallel)
	var wg sync.WaitGroup
	for s := 0; s < seeds; s++ {
		for seat := 0; seat < players; seat++ {
			wg.Add(1)
			sem <- struct{}{}
			go func(seed int64, hs int) {
				defer wg.Done()
				defer func() { <-sem }()
				bots := make([]Bot, players)
				teams := make([]int, players)
				for i := range bots {
					bots[i], teams[i] = opp, 1
				}
				bots[hs], teams[hs] = human, 100+hs
				r := PlayGame(seed, bots, teams)
				mu.Lock()
				defer mu.Unlock()
				if r.Err != nil {
					out.Errors = append(out.Errors, r.Err)
					return
				}
				out.Games++
				if r.Winner == hs {
					out.HumanWins++
				}
			}(firstSeed+int64(s), seat)
		}
	}
	wg.Wait()
	if out.Games > 0 {
		out.WinRate = float64(out.HumanWins) / float64(out.Games)
		out.Lo, out.Hi = Wilson(out.HumanWins, out.Games)
	}
	return out
}
