package game

// Clone returns an independent deep copy of the game state, cheap enough to take once per AI
// decision (session snapshot) or per candidate move in a 1-ply search.
//
// What is copied vs shared:
//   - copied: players (Resources and every card slice), market slices, market action cards
//     (they carry mutable Deposits) and the market coin piles (mutable Amount);
//   - shared: card objects in decks, hands, played piles, golem rows and player coins. They are
//     immutable after setup because the market copies a card when it enters the row
//     (Market.RefillActionCards) and players receive their own coin copies (awardCoin).
//
// The RNG is shared: it is only used during setup (NewGameState) and must not be used afterwards.
func (gs *GameState) Clone() *GameState {
	c := &GameState{
		CurrentTurn: gs.CurrentTurn,
		Round:       gs.Round,
		GameOver:    gs.GameOver,
		LastRound:   gs.LastRound,
		RNG:         gs.RNG,
	}
	c.Players = make([]*Player, len(gs.Players))
	for i, p := range gs.Players {
		c.Players[i] = p.clone()
		if gs.Winner == p {
			c.Winner = c.Players[i]
		}
	}
	if gs.Market != nil {
		c.Market = gs.Market.clone()
	}
	return c
}

func (p *Player) clone() *Player {
	cp := *p
	if p.Resources != nil {
		cp.Resources = p.Resources.Copy()
	} else {
		cp.Resources = NewResources()
	}
	cp.Hand = cloneCardSlice(p.Hand)
	cp.PlayedCards = cloneCardSlice(p.PlayedCards)
	cp.PointCards = cloneCardSlice(p.PointCards)
	cp.Coins = cloneCardSlice(p.Coins)
	return &cp
}

func (m *Market) clone() *Market {
	cm := *m
	cm.ActionCards = make([]*Card, len(m.ActionCards))
	for i, card := range m.ActionCards {
		cm.ActionCards[i] = card.cloneMutable()
	}
	cm.PointCards = cloneCardSlice(m.PointCards)
	cm.ActionDeck = cloneCardSlice(m.ActionDeck)
	cm.PointDeck = cloneCardSlice(m.PointDeck)
	cm.Coins = make([]*Card, len(m.Coins))
	for i, coin := range m.Coins {
		cm.Coins[i] = coin.cloneMutable()
	}
	return &cm
}

// cloneMutable copies a card together with its mutable Deposits.
func (c *Card) cloneMutable() *Card {
	cp := *c
	if c.Deposits != nil {
		cp.Deposits = c.Deposits.Copy()
	}
	return &cp
}

// cloneCardSlice copies the slice header and backing array (never returns nil, so JSON stays []).
func cloneCardSlice(s []*Card) []*Card {
	out := make([]*Card, len(s))
	copy(out, s)
	return out
}
