package game

import (
	"fmt"
	"math/rand"
)

// PlayerActionType represents the type of action a player can take
type PlayerActionType int

const (
	PlayCard PlayerActionType = iota
	AcquireCard
	ClaimPointCard
	Rest
	Discard
)

type DepositData struct {
	Crystal CrystalType
}

// Action represents a player action
type Action struct {
	Type             PlayerActionType
	CardIndex        int           // Index in hand/market depending on action type
	Multiplier       int           // Multiplier for the trade action
	InputResources   *Resources    // Input resources for upgrade
	OutputResources  *Resources    // Output resources for upgrade
	DiscardResources *Resources    // Discards for exceeding MaxCrystals
	DepositList      []DepositData // Deposits for AcquireCard action
}

// GameState represents the current state of the game
type GameState struct {
	Players     []*Player
	Market      *Market
	CurrentTurn int
	Round       int
	GameOver    bool
	Winner      *Player
	LastRound   bool // Whether the last round is being played
	RNG         *rand.Rand
}

// NewGameState creates a new game state
func NewGameState(numPlayers int, seed int64) *GameState {
	rng := rand.New(rand.NewSource(seed))

	// Create players (all human by default)
	players := make([]*Player, numPlayers)
	for i := 0; i < numPlayers; i++ {
		name := fmt.Sprintf("Player %d", i+1)
		players[i] = NewPlayer(i+1, name, false)
		players[i].Hand = append(players[i].Hand, CreateInitialActionCards(i)...)
	}

	// Randomize player order using Fisher-Yates shuffle
	for i := len(players) - 1; i > 0; i-- {
		j := rng.Intn(i + 1)
		players[i], players[j] = players[j], players[i]
	}

	// Ensure player IDs reflect seating order after shuffle
	for i := range players {
		players[i].ID = i + 1
	}

	// Give each player starting resources based on turn order (after shuffle)
	// Turn 1: 3 yellow
	// Turn 2: 4 yellow
	// Turn 3: 4 yellow
	// Turn 4: 3 yellow + 1 green
	// Turn 5: 3 yellow + 1 green
	for i := 0; i < numPlayers; i++ {
		turnOrder := i + 1 // 1-based turn order
		switch turnOrder {
		case 1:
			players[i].Resources.Yellow = 3
		case 2, 3:
			players[i].Resources.Yellow = 4
		case 4, 5:
			players[i].Resources.Yellow = 3
			players[i].Resources.Green = 1
		default:
			// For games with more than 5 players, default to 3 yellow
			players[i].Resources.Yellow = 3
		}
	}

	// Create market
	actionCards := CreateDefaultActionCards()
	pointCards := CreateDefaultPointCards()
	coins := CreateCoinCards()
	market := NewMarket(actionCards, pointCards, coins, 6, 5, len(players), rng)

	return &GameState{
		Players:     players,
		Market:      market,
		CurrentTurn: 0,
		Round:       1,
		GameOver:    false,
		Winner:      nil,
		LastRound:   false,
		RNG:         rng,
	}
}

// GetCurrentPlayer returns the current player
func (gs *GameState) GetCurrentPlayer() *Player {
	return gs.Players[gs.CurrentTurn%len(gs.Players)]
}

// NextTurn advances to the next turn
func (gs *GameState) NextTurn() {
	gs.CurrentTurn++
	if gs.CurrentTurn%len(gs.Players) == 0 {
		gs.Round++
		// Reset rest flags
		for _, player := range gs.Players {
			player.HasRested = false
		}
	}
}

// StepResult describes what a successful Step did.
type StepResult struct {
	Applied            Action // the normalised action that was applied (store this one in the event log)
	TurnEnded          bool   // false while the same player still has to Discard
	PendingDiscard     int    // > 0: the same player must Discard this many crystals next
	LastRoundTriggered bool   // this action triggered the last round
	GameOver           bool   // the game ended with this action
}

// GolemsToEnd is the number of golems (point cards) that triggers the last round:
// 6 with 2–3 players, 5 with 4–5 players (official rule).
func (gs *GameState) GolemsToEnd() int {
	if len(gs.Players) <= 3 {
		return 6
	}
	return 5
}

// Step is THE turn function shared by the session, the simulators and the AI: it validates the
// action for the current player, applies it, and then either keeps the turn (pending discard) or
// ends it — finishing the game when the last seat completes the last round, else advancing.
// On error the state is unchanged.
func (gs *GameState) Step(a Action) (StepResult, error) {
	norm, err := gs.Validate(a)
	if err != nil {
		return StepResult{}, err
	}
	player := gs.GetCurrentPlayer()
	wasLast := gs.LastRound
	gs.apply(norm)

	res := StepResult{Applied: norm, LastRoundTriggered: !wasLast && gs.LastRound}
	if player.PendingDiscard > 0 {
		res.PendingDiscard = player.PendingDiscard
		return res, nil
	}
	res.TurnEnded = true
	if gs.LastRound && gs.CurrentTurn%len(gs.Players) == len(gs.Players)-1 {
		gs.finishGame()
	} else {
		gs.NextTurn()
	}
	res.GameOver = gs.GameOver
	return res, nil
}

// ExecuteAction validates and applies an action for the current player WITHOUT ending the turn
// (legacy API: the caller then calls CheckGameOver and advances the turn itself). Prefer Step.
// On error the state is unchanged.
func (gs *GameState) ExecuteAction(action Action) error {
	norm, err := gs.Validate(action)
	if err != nil {
		return err
	}
	gs.apply(norm)
	return nil
}

// Validate checks an action for the current player without mutating anything and returns the
// normalised action that apply() expects (multiplier fixed up, deposits filled in, …).
func (gs *GameState) Validate(a Action) (Action, error) {
	if gs.GameOver {
		return a, ErrGameOver
	}
	p := gs.GetCurrentPlayer()
	if p.PendingDiscard > 0 && a.Type != Discard {
		return a, ErrMustDiscard
	}

	switch a.Type {
	case PlayCard:
		if a.CardIndex < 0 || a.CardIndex >= len(p.Hand) {
			return a, ErrInvalidIndex
		}
		card := p.Hand[a.CardIndex]
		if card.Type != ActionCard {
			return a, fmt.Errorf("%w: not an action card", ErrCannotPlay)
		}
		switch card.ActionType {
		case Produce:
			return Action{Type: PlayCard, CardIndex: a.CardIndex, Multiplier: 1}, nil
		case Upgrade:
			in, out := a.InputResources, a.OutputResources
			if card.TurnUpgrade <= 0 || in == nil || out == nil {
				return a, fmt.Errorf("%w: upgrade needs input and output resources", ErrCannotPlay)
			}
			if !in.NonNegative() || !out.NonNegative() {
				return a, ErrInvalidResources
			}
			if !p.Resources.HasAll(in, 1) {
				return a, fmt.Errorf("%w: missing crystals to upgrade", ErrCannotPlay)
			}
			if !in.CanUpgraded(out, card.TurnUpgrade) {
				return a, fmt.Errorf("%w: invalid upgrade (max %d steps)", ErrCannotPlay, card.TurnUpgrade)
			}
			return Action{Type: PlayCard, CardIndex: a.CardIndex, Multiplier: 1,
				InputResources: in.Copy(), OutputResources: out.Copy()}, nil
		case Trade:
			m := a.Multiplier
			if m < 1 {
				m = 1
			}
			maxM := p.Resources.GetMaxMultiplier(card.Input)
			if maxM < 1 {
				return a, fmt.Errorf("%w: cannot afford trade", ErrCannotPlay)
			}
			if m > maxM {
				return a, fmt.Errorf("%w: multiplier %d exceeds affordable %d", ErrCannotPlay, m, maxM)
			}
			return Action{Type: PlayCard, CardIndex: a.CardIndex, Multiplier: m}, nil
		}
		return a, fmt.Errorf("%w: unknown card action", ErrCannotPlay)

	case AcquireCard:
		k := a.CardIndex
		if k < 0 || k >= len(gs.Market.ActionCards) {
			return a, ErrInvalidIndex
		}
		deposits := a.DepositList
		if len(deposits) == 0 && k > 0 {
			// Lenient fallback for clients/bots that send no deposits: place the cheapest crystals.
			deposits = AutoDeposits(p.Resources, k)
			if deposits == nil {
				return a, fmt.Errorf("%w: need %d crystals to place, have %d", ErrBadDeposits, k, p.Resources.Total())
			}
		}
		if len(deposits) != k {
			return a, fmt.Errorf("%w: need exactly %d deposits, got %d", ErrBadDeposits, k, len(deposits))
		}
		var need [4]int
		for _, d := range deposits {
			if d.Crystal < Yellow || d.Crystal > Pink {
				return a, fmt.Errorf("%w: unknown crystal", ErrBadDeposits)
			}
			need[d.Crystal]++
		}
		if !p.Resources.HasAll(ResourcesFromVec(need), 1) {
			return a, fmt.Errorf("%w: not enough crystals for these deposits", ErrBadDeposits)
		}
		return Action{Type: AcquireCard, CardIndex: k, DepositList: append([]DepositData(nil), deposits...)}, nil

	case ClaimPointCard:
		if a.CardIndex < 0 || a.CardIndex >= len(gs.Market.PointCards) {
			return a, ErrInvalidIndex
		}
		if !gs.Market.PointCards[a.CardIndex].CanClaim(p) {
			return a, ErrCannotClaim
		}
		return Action{Type: ClaimPointCard, CardIndex: a.CardIndex}, nil

	case Rest:
		return Action{Type: Rest}, nil

	case Discard:
		if p.PendingDiscard <= 0 {
			return a, ErrNoDiscard
		}
		d := a.DiscardResources
		if d == nil || !d.NonNegative() {
			return a, ErrInvalidResources
		}
		if d.Total() != p.PendingDiscard {
			return a, fmt.Errorf("%w: must discard exactly %d crystals, got %d", ErrInvalidResources, p.PendingDiscard, d.Total())
		}
		if !p.Resources.HasAll(d, 1) {
			return a, fmt.Errorf("%w: insufficient crystals to discard", ErrInvalidResources)
		}
		return Action{Type: Discard, DiscardResources: d.Copy()}, nil
	}
	return a, ErrUnknownActionType
}

// apply mutates the state for an action already normalised by Validate.
func (gs *GameState) apply(a Action) {
	p := gs.GetCurrentPlayer()
	switch a.Type {
	case PlayCard:
		card := p.Hand[a.CardIndex]
		switch card.ActionType {
		case Produce:
			if card.Output != nil {
				p.Resources.AddAll(card.Output, 1)
			}
		case Upgrade:
			p.Resources.SubtractAll(a.InputResources, 1)
			p.Resources.AddAll(a.OutputResources, 1)
		case Trade:
			p.Resources.SubtractAll(card.Input, a.Multiplier)
			p.Resources.AddAll(card.Output, a.Multiplier)
		}
		p.PlayedCards = append(p.PlayedCards, card)
		p.Hand = append(p.Hand[:a.CardIndex], p.Hand[a.CardIndex+1:]...)

	case AcquireCard:
		k := a.CardIndex
		target := gs.Market.ActionCards[k]
		collected := NewResources()
		if target.Deposits != nil {
			collected.AddAll(target.Deposits, 1)
		}
		target.Deposits = NewResources() // crystals move to the buyer; the card leaves clean
		for _, d := range a.DepositList {
			p.Resources.Subtract(d.Crystal, 1)
		}
		gs.Market.AcquireActionCard(k) // removes index k; cards 0..k-1 keep their positions
		for i, d := range a.DepositList {
			if gs.Market.ActionCards[i].Deposits == nil {
				gs.Market.ActionCards[i].Deposits = NewResources()
			}
			gs.Market.ActionCards[i].Deposits.Add(d.Crystal, 1)
		}
		p.Resources.AddAll(collected, 1)
		p.Hand = append(p.Hand, target)

	case ClaimPointCard:
		card := gs.Market.PointCards[a.CardIndex]
		p.Resources.SubtractAll(card.Requirement, 1)
		p.Points += card.Points
		p.PointCards = append(p.PointCards, card)
		gs.Market.PointCards = append(gs.Market.PointCards[:a.CardIndex], gs.Market.PointCards[a.CardIndex+1:]...)
		gs.Market.RefillPointCards()
		gs.awardCoin(p, a.CardIndex)
		if len(p.PointCards) >= gs.GolemsToEnd() {
			gs.LastRound = true
		}

	case Rest:
		p.Rest()

	case Discard:
		p.Resources.SubtractAll(a.DiscardResources, 1)
		p.PendingDiscard = 0
	}

	// Caravan limit: more than MaxCrystals at the end of an action means a pending discard.
	if p.Resources.Total() > MaxCrystals {
		p.PendingDiscard = p.Resources.Total() - MaxCrystals
	}
}

// awardCoin gives the coin bonus for claiming the golem at `position`.
// Position 0 takes copper while it lasts, then silver; position 1 takes silver only while copper
// is still on offer (silver then slides to position 0). The player receives a copy of the coin
// card (Amount 1) so it never aliases the market's coin pile.
func (gs *GameState) awardCoin(p *Player, position int) {
	coins := gs.Market.Coins
	take := func(i int) {
		c := *coins[i]
		c.Amount = 1
		c.Deposits = NewResources()
		p.Coins = append(p.Coins, &c)
		coins[i].Amount--
	}
	copperLeft := len(coins) > 0 && coins[0].Amount > 0
	silverLeft := len(coins) > 1 && coins[1].Amount > 0
	switch {
	case position == 0 && copperLeft:
		take(0)
	case position == 0 && silverLeft:
		take(1)
	case position == 1 && copperLeft && silverLeft:
		take(1)
	}
}

// AutoDeposits picks k crystals to place when acquiring market card k: cheapest colours first,
// placed left to right (the leftmost card, most likely to be taken next, gets the cheapest).
// Returns nil if the player holds fewer than k crystals.
func AutoDeposits(res *Resources, k int) []DepositData {
	if k <= 0 {
		return []DepositData{}
	}
	if res.Total() < k {
		return nil
	}
	out := make([]DepositData, 0, k)
	for c := Yellow; c <= Pink && len(out) < k; c++ {
		for n := res.Get(c); n > 0 && len(out) < k; n-- {
			out = append(out, DepositData{Crystal: c})
		}
	}
	return out
}

// AutoDiscard picks n crystals to discard, cheapest colours first. Returns nil if impossible.
func AutoDiscard(res *Resources, n int) *Resources {
	if n <= 0 || res.Total() < n {
		return nil
	}
	d := NewResources()
	for c := Yellow; c <= Pink && n > 0; c++ {
		take := min(res.Get(c), n)
		d.Add(c, take)
		n -= take
	}
	return d
}

// CheckGameOver ends the game when the last seat has completed the last round (legacy API used
// with ExecuteAction; Step does this itself). It waits while the current player still has to
// discard, so their final crystal count is what gets scored.
func (gs *GameState) CheckGameOver() {
	if gs.GameOver || !gs.LastRound {
		return
	}
	if gs.CurrentTurn%len(gs.Players) != len(gs.Players)-1 {
		return
	}
	if gs.GetCurrentPlayer().PendingDiscard > 0 {
		return
	}
	gs.finishGame()
}

// finishGame marks the game over and picks the winner: highest final points; ties go to the
// player LATER in turn order (official rule), hence ">=" while walking seats in order.
func (gs *GameState) finishGame() {
	gs.GameOver = true
	gs.Winner = nil
	best := -1
	for _, player := range gs.Players {
		if pts := player.GetFinalPoints(); pts >= best {
			best = pts
			gs.Winner = player
		}
	}
}

// PrintFinalResults prints the final game results
