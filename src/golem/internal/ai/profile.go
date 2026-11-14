// Package ai implements the computer opponents for Century: Golem Edition.
//
// All levels share one engine (evaluation, opponent model, search); a Profile decides how much
// of it a level uses: search budget and workers, root-choice noise, opponent modelling and the
// utility it maximises. See docs/ai/README.md (overview) and docs/ai/thiet-ke.md (design).
package ai

import (
	"fmt"
	"strings"
	"time"
)

// Level is an AI difficulty level.
type Level uint8

const (
	LevelUnknown Level = iota
	Easy
	Medium
	Hard
	VeryHard
)

// AllLevels lists the selectable levels, weakest first.
var AllLevels = []Level{Easy, Medium, Hard, VeryHard}

// String returns the wire name ("easy", "medium", "hard", "veryhard").
func (l Level) String() string {
	switch l {
	case Easy:
		return "easy"
	case Medium:
		return "medium"
	case Hard:
		return "hard"
	case VeryHard:
		return "veryhard"
	}
	return "unknown"
}

// Label returns the display name ("Easy", …, "Very Hard").
func (l Level) Label() string {
	switch l {
	case Easy:
		return "Easy"
	case Medium:
		return "Medium"
	case Hard:
		return "Hard"
	case VeryHard:
		return "Very Hard"
	}
	return "Unknown"
}

// ParseLevel accepts the wire names case-insensitively, plus "very_hard"/"very-hard"/"very hard".
func ParseLevel(s string) (Level, error) {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "easy":
		return Easy, nil
	case "medium", "normal":
		return Medium, nil
	case "hard":
		return Hard, nil
	case "veryhard", "very_hard", "very-hard", "very hard":
		return VeryHard, nil
	}
	return LevelUnknown, fmt.Errorf("unknown difficulty %q (want easy, medium, hard or veryhard)", s)
}

// UtilityKind is what an AI maximises.
type UtilityKind uint8

const (
	// UtilityOwn maximises the AI's own final score.
	UtilityOwn UtilityKind = iota
	// UtilityBeatLeader maximises the margin over the best other player, whoever leads.
	UtilityBeatLeader
	// UtilityCoalition makes every AI play for the AI team against the human(s): the reward is the
	// best AI score minus the best human score, shared by all AI seats (Very Hard, disclosed in the lobby).
	UtilityCoalition
)

// Profile holds every knob a level turns.
type Profile struct {
	Level   Level
	Utility UtilityKind

	Search  bool          // false: 1-ply greedy policy only (Easy)
	Budget  time.Duration // think time per decision (search levels)
	Workers int           // parallel search trees (each with its own deck samples)

	RootTemp   float64 // softmax temperature for the final choice (0 = best only)
	RootWindow float64 // only moves within this many points of the best are candidates (0 = all)

	Epsilon           float64 // ε-greedy exploration inside rollouts
	RolloutTurns      int     // rollout length in whole rounds before the evaluation cut-off
	OppModel          bool    // plan recognition + denial
	EndgameToTerminal bool    // near the end, roll out to the actual end of the game

	CPuct    float64 // PUCT exploration constant
	MaxNodes int     // node cap per search tree

	Weights *Weights // evaluator weights (nil = DefaultWeights); tuning experiments only
}

// DefaultProfile returns the tuned defaults for a level (see docs/ai/tinh-chinh.md).
func DefaultProfile(l Level) Profile {
	switch l {
	case Easy:
		return Profile{Level: Easy, Utility: UtilityOwn, RootTemp: 1.5, RootWindow: 3}
	case Medium:
		return Profile{Level: Medium, Utility: UtilityOwn, Search: true, Budget: 300 * time.Millisecond,
			Workers: 1, RootTemp: 0.4, Epsilon: 0.25, RolloutTurns: 2, CPuct: 0.8, MaxNodes: 200000}
	case Hard:
		return Profile{Level: Hard, Utility: UtilityBeatLeader, Search: true, Budget: 1400 * time.Millisecond,
			Workers: 2, Epsilon: 0.15, RolloutTurns: 2, OppModel: true, CPuct: 0.8, MaxNodes: 200000}
	case VeryHard:
		return Profile{Level: VeryHard, Utility: UtilityCoalition, Search: true, Budget: 3000 * time.Millisecond,
			Workers: 4, Epsilon: 0.10, RolloutTurns: 2, OppModel: true, EndgameToTerminal: true,
			CPuct: 0.8, MaxNodes: 200000}
	}
	return DefaultProfile(Medium)
}

// Scaled returns the profile with its think time multiplied by pct/100 (AI_THINK_SCALE_PCT).
func (p Profile) Scaled(pct int) Profile {
	if pct <= 0 || pct == 100 {
		return p
	}
	p.Budget = p.Budget * time.Duration(pct) / 100
	return p
}
