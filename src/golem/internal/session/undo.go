package session

import "golem_century/internal/game"

// Taking back an overflowing card play. A person who plays a card that leaves them with more than
// 10 crystals must discard before the turn ends; until they do, they may take the play back (e.g.
// a trade multiplier picked one too high) and choose again. Only card plays qualify: they reveal
// nothing, whereas buying a card refills the market from the deck. AIs never undo.

// actionUndo marks a taken-back play in the event log (like -1 marks the initial state).
const actionUndo game.PlayerActionType = -2

// undoPoint is the mover's cards and crystals from before the play.
type undoPoint struct {
	playerID int
	seq      uint64 // stepSeq right after the play: any later step (the discard, a timeout) voids it
	res      game.Resources
	hand     []*game.Card
	played   []*game.Card
}

func undoPointOf(p *game.Player) *undoPoint {
	u := &undoPoint{
		playerID: p.ID,
		hand:     append([]*game.Card(nil), p.Hand...),
		played:   append([]*game.Card(nil), p.PlayedCards...),
	}
	if p.Resources != nil {
		u.res = *p.Resources
	}
	return u
}

// canUndoLocked reports whether playerID may take back the play they still have to discard for.
// Caller holds gs.mu (read or write).
func (gs *GameSession) canUndoLocked(playerID int) bool {
	u := gs.undo
	if u == nil || u.seq != gs.stepSeq || u.playerID != playerID || gs.GameState == nil || gs.GameState.GameOver {
		return false
	}
	cur := gs.GameState.GetCurrentPlayer()
	return cur != nil && cur.ID == playerID && cur.PendingDiscard > 0
}

// undoLocked restores the mover's cards and crystals from before the play. Card plays change
// nothing else (no market refill, no turn change while a discard is pending), so the game is back
// exactly where it was. Caller holds gs.mu.
func (gs *GameSession) undoLocked(playerID int) bool {
	if !gs.canUndoLocked(playerID) {
		return false
	}
	u := gs.undo
	p := gs.GameState.GetCurrentPlayer()
	res := u.res
	p.Resources = &res
	p.Hand = append([]*game.Card(nil), u.hand...)
	p.PlayedCards = append([]*game.Card(nil), u.played...)
	p.PendingDiscard = 0
	gs.undo = nil
	gs.stepSeq++ // in-flight timeout jobs saw the overflowing state
	return true
}
