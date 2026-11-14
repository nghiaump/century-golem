package game

import (
	"fmt"
	"math/rand"
)

// Market represents the card market
type Market struct {
	ActionCards      []*Card // Available action cards (face up)
	PointCards       []*Card // Available point cards (face up)
	ActionDeck       []*Card // Deck of action cards
	PointDeck        []*Card // Deck of point cards
	Coins            []*Card // Available bonus coins (face up)
	MaxActionVisible int     // Maximum visible action cards in market
	MaxPointVisible  int     // Maximum visible point cards in market
}

// NewMarket creates a new market with shuffled decks
func NewMarket(actionCards, pointCards []*Card, coins []*Card, maxActionVisible int, maxPointVisible int, numPlayers int, rng *rand.Rand) *Market {
	// Shuffle decks
	shuffledActions := make([]*Card, len(actionCards))
	copy(shuffledActions, actionCards)
	shuffledPoints := make([]*Card, len(pointCards))
	copy(shuffledPoints, pointCards)

	// Shuffle using Fisher-Yates
	for i := len(shuffledActions) - 1; i > 0; i-- {
		j := rng.Intn(i + 1)
		shuffledActions[i], shuffledActions[j] = shuffledActions[j], shuffledActions[i]
	}
	for i := len(shuffledPoints) - 1; i > 0; i-- {
		j := rng.Intn(i + 1)
		shuffledPoints[i], shuffledPoints[j] = shuffledPoints[j], shuffledPoints[i]
	}

	market := &Market{
		ActionCards:      make([]*Card, 0),
		PointCards:       make([]*Card, 0),
		ActionDeck:       shuffledActions,
		PointDeck:        shuffledPoints,
		Coins:            coins,
		MaxActionVisible: maxActionVisible,
		MaxPointVisible:  maxPointVisible,
	}

	// Draw initial cards
	market.RefillActionCards()
	market.RefillPointCards()
	market.RefillCoins(numPlayers)

	return market
}

// RefillActionCards refills the action card market up to MaxVisible.
//
// A card entering the market is copied so the market OWNS it: deposits are then mutated only on
// market-owned cards, never on deck cards. This keeps deck, hand and golem cards immutable after
// setup, which is what lets GameState.Clone share them between clones.
func (m *Market) RefillActionCards() {
	for len(m.ActionCards) < m.MaxActionVisible && len(m.ActionDeck) > 0 {
		m.ActionCards = append(m.ActionCards, ownMarketCard(m.ActionDeck[0]))
		m.ActionDeck = m.ActionDeck[1:]
	}
}

// ownMarketCard returns a copy of c with its own (empty) deposits.
func ownMarketCard(c *Card) *Card {
	cp := *c
	cp.Deposits = NewResources()
	return &cp
}

// CrystalsToPlace returns how many crystals (any colour, one per card) must be placed on the cards
// to the left of position `pos` to acquire the card there (official rule: one per skipped card).
func (m *Market) CrystalsToPlace(pos int) int {
	if pos < 0 {
		return 0
	}
	return pos
}

// RefillPointCards refills the point card market up to MaxVisible
func (m *Market) RefillPointCards() {
	for len(m.PointCards) < m.MaxPointVisible && len(m.PointDeck) > 0 {
		m.PointCards = append(m.PointCards, m.PointDeck[0])
		m.PointDeck = m.PointDeck[1:]
	}
}

func (m *Market) RefillCoins(numPlayers int) {
	for i := range m.Coins {
		m.Coins[i].Amount = numPlayers * 2
	}
}

// GetActionCardCost returns the legacy "cost" of a market position as `position` yellow.
//
// Deprecated: under the official rule the price is CrystalsToPlace(position) crystals of ANY
// colour, placed on the cards to the left. Kept only because the serializer still emits `cost`
// for older clients.
func (m *Market) GetActionCardCost(position int) *Resources {
	if position < 0 || position >= len(m.ActionCards) {
		return nil
	}
	// Cost formula: position determines base cost
	// Position 0: 0 yellow
	// Position 1: 1 yellow
	// Position 2: 2 yellow
	// Position 3: 3 yellow
	// Position 4: 4 yellow
	// TODO: need update to using different crystals
	cost := NewResources()
	cost.Yellow = position

	return cost
}

// AcquireActionCard removes and returns an action card from the market
func (m *Market) AcquireActionCard(position int) *Card {
	if position < 0 || position >= len(m.ActionCards) {
		return nil
	}
	card := m.ActionCards[position]
	m.ActionCards = append(m.ActionCards[:position], m.ActionCards[position+1:]...)
	m.RefillActionCards()
	return card
}

// AcquirePointCard removes and returns a point card from the market
func (m *Market) AcquirePointCard(position int) *Card {
	if position < 0 || position >= len(m.PointCards) {
		return nil
	}
	card := m.PointCards[position]
	m.PointCards = append(m.PointCards[:position], m.PointCards[position+1:]...)
	m.RefillPointCards()
	return card
}

// String returns a string representation of the market
func (m *Market) String() string {
	actionStr := "Action Cards:\n"
	for i, card := range m.ActionCards {
		cost := m.GetActionCardCost(i)
		actionStr += fmt.Sprintf("  [%d] %s (Cost: %s)\n", i, card.String(), cost.String())
	}
	pointStr := "Point Cards:\n"
	for i, card := range m.PointCards {
		pointStr += fmt.Sprintf("  [%d] %s\n", i, card.String())
	}
	return actionStr + pointStr
}
