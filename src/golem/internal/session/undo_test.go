package session

import (
	"encoding/json"
	"testing"

	"golem_century/internal/game"
	"golem_century/internal/logger"
)

// undoSession is a 2-seat session whose seat-1 player (a person) is about to overflow: 10 yellow
// and a +2 yellow card in hand. No game loop runs; actions go straight to onHumanAction.
func undoSession(t *testing.T) (*GameSession, *game.Player, int) {
	t.Helper()
	gs := NewGameSession("undo_test", 2, 60, nil, logger.NewNopLogger())
	gs.GameState = game.NewGameState(2, 11)
	gs.status = GameStatusPlaying
	p := gs.GameState.GetCurrentPlayer()
	p.Resources = &game.Resources{Yellow: 10}
	for i, c := range p.Hand {
		if c.ActionType == game.Produce {
			return gs, p, i
		}
	}
	t.Fatal("no produce card in hand")
	return nil, nil, 0
}

func stateJSON(t *testing.T, gs *game.GameState) string {
	t.Helper()
	c := gs.Clone()
	c.RNG = nil
	b, err := json.Marshal(c)
	if err != nil {
		t.Fatal(err)
	}
	return string(b)
}

func canUndoIn(gs *GameSession, playerID int) bool {
	for _, p := range gs.serializeState()["players"].([]map[string]interface{}) {
		if p["id"] == playerID {
			return p["canUndo"] == true
		}
	}
	return false
}

func TestUndo_TakesBackAnOverflowingCardPlay(t *testing.T) {
	gs, p, idx := undoSession(t)
	before := stateJSON(t, gs.GameState)

	ev := gs.onHumanAction(PlayerAction{PlayerID: p.ID, Action: game.Action{Type: game.PlayCard, CardIndex: idx}})
	if len(ev) != 1 || p.PendingDiscard != 2 || !canUndoIn(gs, p.ID) {
		t.Fatalf("the overflowing play must wait for a discard and offer undo: pending=%d events=%d", p.PendingDiscard, len(ev))
	}

	ev = gs.onHumanAction(PlayerAction{PlayerID: p.ID, Undo: true})
	if len(ev) != 1 || ev[0].action.Type != actionUndo {
		t.Fatalf("undo must be logged as an event: %+v", ev)
	}
	if got := stateJSON(t, gs.GameState); got != before {
		t.Fatalf("undo must restore the state from before the play\nbefore %s\nafter  %s", before, got)
	}
	if canUndoIn(gs, p.ID) {
		t.Fatal("nothing left to undo")
	}
	if ev := gs.onHumanAction(PlayerAction{PlayerID: p.ID, Undo: true}); ev != nil {
		t.Fatal("a second undo must be refused")
	}

	// the same play again, then the discard: undo is gone and the turn moves on
	gs.onHumanAction(PlayerAction{PlayerID: p.ID, Action: game.Action{Type: game.PlayCard, CardIndex: idx}})
	gs.onHumanAction(PlayerAction{PlayerID: p.ID, Action: game.Action{Type: game.Discard, DiscardResources: &game.Resources{Yellow: 2}}})
	if gs.GameState.GetCurrentPlayer() == p || canUndoIn(gs, p.ID) {
		t.Fatal("after the discard the turn ends and the play is final")
	}
}

func TestUndo_OnlyCardPlaysThatOverflow(t *testing.T) {
	gs, p, idx := undoSession(t)
	p.Resources = &game.Resources{Yellow: 2}
	gs.onHumanAction(PlayerAction{PlayerID: p.ID, Action: game.Action{Type: game.PlayCard, CardIndex: idx}})
	if canUndoIn(gs, p.ID) {
		t.Fatal("a play that does not overflow ends the turn: nothing to undo")
	}

	// buying a card that picks up deposits past 10 refills the market: no undo (it would reveal a card)
	gs, p, _ = undoSession(t)
	gs.GameState.Market.ActionCards[0].Deposits = &game.Resources{Yellow: 3}
	gs.onHumanAction(PlayerAction{PlayerID: p.ID, Action: game.Action{Type: game.AcquireCard, CardIndex: 0}})
	if p.PendingDiscard == 0 {
		t.Fatal("test setup: the purchase should overflow")
	}
	if canUndoIn(gs, p.ID) {
		t.Fatal("purchases must not be undoable")
	}
	if ev := gs.onHumanAction(PlayerAction{PlayerID: p.ID, Undo: true}); ev != nil || p.PendingDiscard == 0 {
		t.Fatal("undo after a purchase must be refused")
	}
}
