package ai

import (
	"context"
	"runtime"
	"time"
)

// Scheduler is a server-wide pool of search threads. Every search must hold at least one token
// per worker goroutine it runs, so concurrent AI turns in different games never oversubscribe the
// CPU (the production host is a phone with 4 fast cores). A nil *Scheduler grants everything.
type Scheduler struct {
	tokens chan struct{}
}

// NewScheduler creates a pool of max tokens; max <= 0 means auto: min(4, NumCPU/2), at least 1.
func NewScheduler(max int) *Scheduler {
	if max <= 0 {
		max = min(4, runtime.NumCPU()/2)
	}
	if max < 1 {
		max = 1
	}
	s := &Scheduler{tokens: make(chan struct{}, max)}
	for i := 0; i < max; i++ {
		s.tokens <- struct{}{}
	}
	return s
}

// Capacity returns the pool size (0 for a nil scheduler).
func (s *Scheduler) Capacity() int {
	if s == nil {
		return 0
	}
	return cap(s.tokens)
}

// Acquire waits for one token (or ctx), then takes up to want-1 more without waiting. It returns
// the number granted (0 if ctx ended first) and a release func that must be called exactly once.
func (s *Scheduler) Acquire(ctx context.Context, want int) (int, func()) {
	if want < 1 {
		want = 1
	}
	if s == nil {
		return want, func() {}
	}
	select {
	case <-s.tokens:
	case <-ctx.Done():
		return 0, func() {}
	}
	got := 1
	for got < want {
		select {
		case <-s.tokens:
			got++
			continue
		default:
		}
		break
	}
	n := got
	return got, func() {
		for i := 0; i < n; i++ {
			s.tokens <- struct{}{}
		}
	}
}

// Runtime is the server-wide AI context shared by all agents.
type Runtime struct {
	Sched    *Scheduler
	ScalePct int           // multiplies every think budget (AI_THINK_SCALE_PCT, 100 = as tuned)
	MaxNodes int           // node cap per search tree (AI_MAX_NODES; 0 = profile default)
	MinDelay time.Duration // minimum visible "thinking" time per AI move (AI_MIN_DELAY_MS)
}

// DefaultRuntime is used when no runtime is configured (tests, CLI).
func DefaultRuntime() *Runtime {
	return &Runtime{Sched: nil, ScalePct: 100, MinDelay: 0}
}

// Profile returns the level's profile adjusted by the runtime settings.
func (rt *Runtime) Profile(l Level) Profile {
	p := DefaultProfile(l)
	if rt == nil {
		return p
	}
	p = p.Scaled(rt.ScalePct)
	if rt.MaxNodes > 0 {
		p.MaxNodes = rt.MaxNodes
	}
	return p
}
