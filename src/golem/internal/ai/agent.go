package ai

import (
	"context"
	"time"

	"golem_century/internal/game"
)

// IntentKind classifies what an AI move did to a human, for the "AI intent" toasts.
type IntentKind string

const (
	IntentTookTargetGolem IntentKind = "took_target_golem" // claimed the golem the target was going for
	IntentBlockCoin       IntentKind = "block_coin"        // took a coin slot the target was racing for
	IntentTookWantedCard  IntentKind = "took_wanted_card"  // acquired a merchant card the target needed
	IntentSacrifice       IntentKind = "sacrifice"         // gave up own value to hinder the target (coalition)
	IntentRushing         IntentKind = "rushing"           // is one golem away from triggering the end
)

// Intent is one explainable consequence of an AI move for a specific opponent.
type Intent struct {
	Kind     IntentKind
	TargetID int  // player ID of the opponent concerned (0 = everyone)
	CardID   int  // card involved, if any
	Motive   bool // true when denial actually changed the choice (wording: "blocking" vs "grabbed first")
}

// SearchStats reports how a decision was made (logged; also used by the benchmark tool).
type SearchStats struct {
	Iterations int
	Nodes      int
	Workers    int
	Elapsed    time.Duration
	Fallback   string // non-empty when the agent fell back to a simpler policy
}

// Decision is an agent's answer for the current player of a snapshot.
type Decision struct {
	Action game.Action
	// Discard is the agent's choice for the excess crystals when Action overflows the caravan
	// (nil: the caller discards the cheapest crystals).
	Discard *game.Resources
	Intents []Intent
	Stats   SearchStats
}

// DecideOptions carries per-decision context the snapshot does not hold.
type DecideOptions struct {
	// Teams[i] is the team of seat i (players with the same team share a coalition reward).
	// nil means everybody is on their own team.
	Teams []int
	// Seed drives every random choice of this decision (reproducible tests and tournaments).
	Seed uint64
	// Iterations > 0 replaces the time budget by a fixed iteration count (deterministic tests).
	Iterations int
}

// Agent chooses moves for one seat. Implementations may keep state between decisions (e.g. the
// opponent model), so the session keeps one agent per AI seat. Decide must not modify snap, must
// return promptly when ctx is cancelled, and must only use public information: the real deck
// order inside snap is never looked at.
type Agent interface {
	Decide(ctx context.Context, snap *game.GameState, o DecideOptions) (Decision, error)
	Level() Level
	Profile() Profile
}

// NewAgent returns the agent for a level.
func NewAgent(l Level, rt *Runtime) Agent {
	if rt == nil {
		rt = DefaultRuntime()
	}
	return newGreedyAgent(rt.Profile(l), rt)
}

// strategyAgent adapts a legacy game.AIStrategy (BasicAI, RestOnlyAI) to the Agent interface.
type strategyAgent struct {
	s     game.AIStrategy
	level Level
}

// FromStrategy wraps a legacy strategy; it reports the given level for display purposes.
func FromStrategy(s game.AIStrategy, l Level) Agent { return &strategyAgent{s: s, level: l} }

func (a *strategyAgent) Level() Level     { return a.level }
func (a *strategyAgent) Profile() Profile { return Profile{Level: a.level} }

func (a *strategyAgent) Decide(_ context.Context, snap *game.GameState, _ DecideOptions) (Decision, error) {
	p := snap.GetCurrentPlayer()
	return Decision{Action: a.s.ChooseAction(p, snap.Market, snap)}, nil
}

// asStrategy adapts an Agent to the legacy game.AIStrategy interface (CLI simulator).
type asStrategy struct{ a Agent }

// AsStrategy exposes an Agent as a game.AIStrategy.
func AsStrategy(a Agent) game.AIStrategy { return asStrategy{a} }

func (s asStrategy) GetName() string { return "ai-" + s.a.Level().String() }

func (s asStrategy) ChooseAction(_ *game.Player, _ *game.Market, gs *game.GameState) game.Action {
	d, err := s.a.Decide(context.Background(), gs.Clone(), DecideOptions{})
	if err != nil {
		return game.Action{Type: game.Rest}
	}
	return d.Action
}
