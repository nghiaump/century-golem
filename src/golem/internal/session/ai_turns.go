package session

import (
	"context"
	"fmt"
	"math/rand"
	"sort"
	"strings"
	"time"

	"golem_century/internal/ai"
	"golem_century/internal/eventstore"
	"golem_century/internal/game"

	"go.uber.org/zap"
)

// Mode tells single-player rooms (1 human + AIs) from multiplayer rooms.
type Mode uint8

const (
	ModeUnset  Mode = iota // decided by the legacy "single" session-ID prefix
	ModeMulti              // humans only; a timed-out human just rests
	ModeSingle             // one human + AI seats
)

// Option configures a session before it starts (see ApplyOptions).
type Option func(*GameSession)

// WithSinglePlayer makes the room a single-player room with one AI per entry of levels
// (len(levels) must equal maxPlayers-1).
func WithSinglePlayer(levels []ai.Level) Option {
	return func(gs *GameSession) {
		gs.mode = ModeSingle
		gs.aiLevels = append([]ai.Level(nil), levels...)
	}
}

// WithAIRuntime sets the server-wide AI runtime (thread pool, budgets) and whether AI turns
// pause while nobody is connected to the room.
func WithAIRuntime(rt *ai.Runtime, pauseWhenEmpty bool) Option {
	return func(gs *GameSession) {
		gs.aiRuntime = rt
		gs.pauseWhenEmpty = pauseWhenEmpty
	}
}

// WithAIIntents turns the "AI intent" messages (aiIntent over WebSocket, shown as toasts) on or
// off. Off by default: the user found explicit "AI 2 took the golem you were going for" too much.
func WithAIIntents(enabled bool) Option {
	return func(gs *GameSession) { gs.intentMessages = enabled }
}

// WithAgentFactory replaces how agents are built (tests).
func WithAgentFactory(f func(ai.Level, *ai.Runtime) ai.Agent) Option {
	return func(gs *GameSession) { gs.agentFactory = f }
}

// ApplyOptions applies options; it is meant to be called right after creation, before start.
func (gs *GameSession) ApplyOptions(opts ...Option) {
	gs.mu.Lock()
	defer gs.mu.Unlock()
	for _, o := range opts {
		o(gs)
	}
}

// isSingle reports whether this is a single-player room. Caller holds gs.mu (any mode).
func (gs *GameSession) isSingle() bool {
	if gs.mode != ModeUnset {
		return gs.mode == ModeSingle
	}
	return strings.HasPrefix(gs.ID, "single")
}

// IsSinglePlayer reports whether this is a single-player room.
func (gs *GameSession) IsSinglePlayer() bool {
	gs.mu.RLock()
	defer gs.mu.RUnlock()
	return gs.isSingle()
}

// AILevels returns the configured AI levels of a single-player room (seat order once started).
func (gs *GameSession) AILevels() []ai.Level {
	gs.mu.RLock()
	defer gs.mu.RUnlock()
	return append([]ai.Level(nil), gs.aiLevels...)
}

// aiLevelAt returns the level of the k-th AI (0-based); rooms created without explicit levels
// (legacy "single_" IDs) get Medium.
func (gs *GameSession) aiLevelAt(k int) ai.Level {
	if k < len(gs.aiLevels) && gs.aiLevels[k] != ai.LevelUnknown {
		return gs.aiLevels[k]
	}
	return ai.Medium
}

func (gs *GameSession) newAgent(l ai.Level) ai.Agent {
	if gs.agentFactory != nil {
		return gs.agentFactory(l, gs.aiRuntime)
	}
	return ai.NewAgent(l, gs.aiRuntime)
}

// assignSeats seats the waiting humans and creates the AI seats. Caller holds gs.mu.
// Single-player: humans get random seats (official rule: random start player), AIs the rest,
// each wearing a random avatar and named after its golem (Basalt, Mossback, …). Multiplayer: humans fill seats 1..n in random order.
func (gs *GameSession) assignSeats(rng *rand.Rand) {
	n := len(gs.GameState.Players)
	clientIDs := gs.getShuffledClientIDs(gs.connectedPlayers)
	seats := make([]int, n)
	for i := range seats {
		seats[i] = i
	}
	if gs.isSingle() {
		rng.Shuffle(n, func(i, j int) { seats[i], seats[j] = seats[j], seats[i] })
	}
	human := make([]bool, n)
	for i, clientID := range clientIDs {
		if i >= n {
			break
		}
		seat := seats[i]
		human[seat] = true
		pi := gs.connectedPlayers[clientID]
		pi.PlayerID = seat + 1
		gs.assignedPlayers[seat+1] = clientID
		gs.GameState.Players[seat].Name = pi.Name
		gs.GameState.Players[seat].IsAI = false
	}

	gs.agents = map[int]ai.Agent{}
	gs.timeoutAgents = map[int]ai.Agent{}
	gs.aiAvatars = map[int]string{}
	avatars := gs.aiAvatarsLocked(n)
	gs.humans = append([]bool(nil), human...)
	levels := make([]ai.Level, 0, n)
	k := 0
	for seat := 0; seat < n; seat++ {
		if human[seat] {
			continue
		}
		p := gs.GameState.Players[seat]
		if !gs.isSingle() { // multiplayer: no AI seats exist (n == humans)
			continue
		}
		level := gs.aiLevelAt(k)
		k++
		p.IsAI = true
		gs.aiAvatars[p.ID] = avatars[k-1]
		p.Name = aiName(avatars[k-1], k)
		gs.agents[p.ID] = gs.newAgent(level)
		levels = append(levels, level)
	}
	if gs.isSingle() {
		gs.aiLevels = levels
	}
}

// timeoutAgentFor returns who plays for a timed-out human: in single-player a Medium AI playing
// for that seat; in multiplayer the upstream behaviour (rest, or discard the cheapest crystals).
// Caller holds gs.mu.
func (gs *GameSession) timeoutAgentFor(playerID int) ai.Agent {
	if a, ok := gs.timeoutAgents[playerID]; ok {
		return a
	}
	var a ai.Agent
	if gs.isSingle() {
		a = gs.newAgent(ai.Medium)
	} else {
		a = ai.FromStrategy(game.NewRestOnlyAI(), ai.LevelUnknown)
	}
	gs.timeoutAgents[playerID] = a
	return a
}

// aiLevelOf returns the level of an AI player ("" for humans). Caller holds gs.mu.
func (gs *GameSession) aiLevelOf(playerID int) string {
	if a, ok := gs.agents[playerID]; ok {
		return a.Level().String()
	}
	return ""
}

// ---- game loop ---------------------------------------------------------------------------------

type aiJob struct {
	seq      uint64
	playerID int
	level    ai.Level
	timeout  bool
	cancel   context.CancelFunc
}

type aiResult struct {
	seq      uint64
	playerID int
	timeout  bool
	decision ai.Decision
	err      error
}

type pendingEvent struct {
	playerID int
	action   game.Action
	state    *game.GameState // clone taken under the lock
}

// runGameLoop owns all game-state mutations. Every mutation and every broadcast happens under
// gs.mu; AI thinking runs in its own goroutine on a cloned snapshot and reports back on aiResults.
func (gs *GameSession) runGameLoop() {
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()
	defer gs.cancelAIJob()

	for {
		var events []pendingEvent
		select {
		case <-gs.stop:
			return
		case act := <-gs.ActionChan:
			events = gs.onHumanAction(act)
		case r := <-gs.aiResults:
			events = gs.onAIResult(r)
		case <-ticker.C:
			gs.onTick()
		}
		gs.storeEvents(events) // outside the lock: Mongo round-trips must not block readers
		if gs.finishIfOver() {
			return
		}
	}
}

// finishIfOver marks the room ended and sends the final state once the game is over.
func (gs *GameSession) finishIfOver() bool {
	gs.mu.Lock()
	defer gs.mu.Unlock()
	if gs.GameState == nil || !gs.GameState.GameOver {
		return false
	}
	gs.status = GameStatusEnded
	gs.broadcastState()
	return true
}

// onTick starts an AI job when it is an AI's turn, or a timeout job for a human who ran out of time.
func (gs *GameSession) onTick() {
	gs.mu.Lock()
	defer gs.mu.Unlock()
	if gs.GameState == nil || gs.GameState.GameOver || gs.aiJob != nil {
		return
	}
	cur := gs.GameState.GetCurrentPlayer()
	if gs.pauseWhenEmpty && gs.activeConnectionsLocked() == 0 {
		gs.TurnStartTime = time.Now() // a returning human gets a fresh timer
		return
	}
	if cur.IsAI {
		if agent, ok := gs.agents[cur.ID]; ok {
			gs.startAIJobLocked(cur.ID, agent, false)
			return
		}
		gs.startAIJobLocked(cur.ID, gs.newAgent(ai.Medium), false) // should not happen
		return
	}
	if gs.GameState.Round == 1 && gs.GameState.CurrentTurn == 0 {
		return // the very first turn never times out (players are still loading)
	}
	if time.Since(gs.TurnStartTime) < gs.TurnTimeout {
		return
	}
	gs.broadcast(map[string]any{
		"type":     "turnTimeout",
		"playerID": cur.ID,
		"message":  fmt.Sprintf("%s took too long. AI is making a move.", cur.Name),
	})
	gs.startAIJobLocked(cur.ID, gs.timeoutAgentFor(cur.ID), true)
}

// activeConnectionsLocked counts open player and spectator connections. Caller holds gs.mu.
func (gs *GameSession) activeConnectionsLocked() int {
	n := 0
	for _, p := range gs.connectedPlayers {
		if p.Conn != nil {
			n++
		}
	}
	for _, s := range gs.spectators {
		if s.Conn != nil {
			n++
		}
	}
	return n
}

// startAIJobLocked snapshots the state and lets the agent think in its own goroutine.
// The minimum visible delay overlaps the thinking time. Caller holds gs.mu.
func (gs *GameSession) startAIJobLocked(playerID int, agent ai.Agent, timeout bool) {
	snap := gs.GameState.Clone()
	seq := gs.stepSeq
	ctx, cancel := context.WithCancel(gs.ctx)
	gs.aiJob = &aiJob{seq: seq, playerID: playerID, level: agent.Level(), timeout: timeout, cancel: cancel}

	prof := agent.Profile()
	gs.broadcast(map[string]any{
		"type":     "aiThinking",
		"playerID": playerID,
		"level":    agent.Level().String(),
		"budgetMs": prof.Budget.Milliseconds(),
		"timeout":  timeout,
	})

	minDelay := 800 * time.Millisecond
	if gs.aiRuntime != nil {
		minDelay = gs.aiRuntime.MinDelay
	}
	opts := ai.DecideOptions{
		Humans: append([]bool(nil), gs.humans...),
		Seed:   uint64(gs.seed) ^ (seq << 8) ^ uint64(playerID),
	}
	go func() {
		start := time.Now()
		d, err := agent.Decide(ctx, snap, opts)
		if wait := minDelay - time.Since(start); wait > 0 {
			t := time.NewTimer(wait)
			select {
			case <-t.C:
			case <-ctx.Done():
				t.Stop()
			}
		}
		select {
		case gs.aiResults <- aiResult{seq: seq, playerID: playerID, timeout: timeout, decision: d, err: err}:
		case <-gs.stop:
		}
	}()
}

// cancelAIJob cancels the in-flight AI job, if any.
func (gs *GameSession) cancelAIJob() {
	gs.mu.Lock()
	defer gs.mu.Unlock()
	gs.cancelAIJobLocked()
}

func (gs *GameSession) cancelAIJobLocked() {
	if gs.aiJob != nil {
		gs.aiJob.cancel()
		gs.aiJob = nil
	}
}

// onAIResult applies an AI (or timeout) decision if it is still current.
func (gs *GameSession) onAIResult(r aiResult) []pendingEvent {
	gs.mu.Lock()
	defer gs.mu.Unlock()
	if gs.aiJob != nil && gs.aiJob.seq == r.seq && gs.aiJob.playerID == r.playerID {
		gs.aiJob.cancel()
		gs.aiJob = nil
	}
	if gs.GameState == nil || gs.GameState.GameOver || r.seq != gs.stepSeq {
		return nil // stale: someone moved meanwhile
	}
	cur := gs.GameState.GetCurrentPlayer()
	if cur.ID != r.playerID {
		return nil
	}

	var events []pendingEvent
	var res game.StepResult
	var err error
	if r.err == nil { // on a decide error the zero-value action must not be applied
		res, err = gs.applyLocked(r.decision.Action)
	}
	if r.err != nil || err != nil {
		gs.logger.Warn("AI decision rejected, falling back",
			zap.String("sessionID", gs.ID), zap.Int("playerID", cur.ID),
			zap.NamedError("decideErr", r.err), zap.NamedError("applyErr", err))
		if res, err = gs.applyLocked(gs.fallbackActionLocked(cur)); err != nil {
			gs.logger.Error("AI fallback failed", zap.String("sessionID", gs.ID), zap.Error(err))
			return nil
		}
	}
	events = append(events, pendingEvent{playerID: cur.ID, action: res.Applied, state: gs.GameState.Clone()})

	if res.PendingDiscard > 0 {
		d := r.decision.Discard
		dres, derr := gs.applyLocked(game.Action{Type: game.Discard, DiscardResources: d})
		if d == nil || derr != nil {
			dres, derr = gs.applyLocked(game.Action{Type: game.Discard,
				DiscardResources: game.AutoDiscard(cur.Resources, cur.PendingDiscard)})
		}
		if derr == nil {
			events = append(events, pendingEvent{playerID: cur.ID, action: dres.Applied, state: gs.GameState.Clone()})
		}
	}

	if !r.timeout {
		if gs.intentMessages {
			gs.sendIntentsLocked(cur, r.decision.Intents)
		}
		st := r.decision.Stats
		gs.logger.Info("AI move",
			zap.String("sessionID", gs.ID), zap.Int("playerID", cur.ID),
			zap.String("level", gs.aiLevelOf(cur.ID)), zap.Int("action", int(res.Applied.Type)),
			zap.Int("iterations", st.Iterations), zap.Int("workers", st.Workers),
			zap.Duration("elapsed", st.Elapsed), zap.String("fallback", st.Fallback))
	}
	gs.broadcastState()
	return events
}

// fallbackActionLocked returns an always-legal move: discard the cheapest crystals, else rest.
func (gs *GameSession) fallbackActionLocked(p *game.Player) game.Action {
	if p.PendingDiscard > 0 {
		return game.Action{Type: game.Discard, DiscardResources: game.AutoDiscard(p.Resources, p.PendingDiscard)}
	}
	return game.Action{Type: game.Rest}
}

// onHumanAction applies a human move if it is their turn; errors go back to that client only.
func (gs *GameSession) onHumanAction(act PlayerAction) []pendingEvent {
	gs.mu.Lock()
	defer gs.mu.Unlock()
	if gs.GameState == nil || gs.GameState.GameOver {
		return nil
	}
	if act.PlayerID != gs.GameState.GetCurrentPlayer().ID {
		return nil
	}
	if act.Undo {
		if !gs.undoLocked(act.PlayerID) {
			gs.sendToPlayer(act.ClientID, map[string]any{"type": "error", "error": "nothing to undo"})
			return nil
		}
		gs.cancelAIJobLocked()
		gs.broadcastState()
		return []pendingEvent{{playerID: act.PlayerID, action: game.Action{Type: actionUndo}, state: gs.GameState.Clone()}}
	}
	var before *undoPoint
	if act.Action.Type == game.PlayCard {
		before = undoPointOf(gs.GameState.GetCurrentPlayer())
	}
	res, err := gs.applyLocked(act.Action)
	if err != nil {
		gs.sendToPlayer(act.ClientID, map[string]any{"type": "error", "error": err.Error()})
		return nil
	}
	gs.undo = nil
	if before != nil && res.PendingDiscard > 0 {
		before.seq = gs.stepSeq
		gs.undo = before
	}
	gs.cancelAIJobLocked() // e.g. their own timeout job: its result is stale now
	gs.broadcastState()
	return []pendingEvent{{playerID: act.PlayerID, action: res.Applied, state: gs.GameState.Clone()}}
}

// applyLocked runs one Step and bumps the sequence number. Caller holds gs.mu.
func (gs *GameSession) applyLocked(a game.Action) (game.StepResult, error) {
	res, err := gs.GameState.Step(a)
	if err != nil {
		return res, err
	}
	gs.stepSeq++
	if res.TurnEnded {
		gs.TurnStartTime = time.Now()
	}
	return res, nil
}

// storeEvents writes events to the event store using the clones taken under the lock.
func (gs *GameSession) storeEvents(events []pendingEvent) {
	if gs.EventStore == nil {
		return
	}
	for _, e := range events {
		resp := gs.EventStore.StoreEvent(eventstore.StoreEventRequest{
			GameID: gs.ID, PlayerID: e.playerID, Action: e.action, GameState: e.state,
		})
		if resp.Error != nil {
			gs.logger.Warn("Failed to store game event", zap.String("sessionID", gs.ID), zap.Error(resp.Error))
		}
	}
}

// ---- AI intents --------------------------------------------------------------------------------

// sendIntentsLocked turns the agent's intents into short messages for the humans concerned.
// Caller holds gs.mu.
func (gs *GameSession) sendIntentsLocked(aiPlayer *game.Player, intents []ai.Intent) {
	for _, it := range intents {
		msg := map[string]any{
			"type":           "aiIntent",
			"playerID":       aiPlayer.ID,
			"playerName":     aiPlayer.Name,
			"targetPlayerID": it.TargetID,
			"kind":           string(it.Kind),
			"cardID":         it.CardID,
			"message":        intentMessage(aiPlayer.Name, it),
		}
		if it.TargetID == 0 {
			gs.broadcast(msg)
			continue
		}
		if clientID, ok := gs.assignedPlayers[it.TargetID]; ok {
			gs.sendToPlayer(clientID, msg)
		}
		for id := range gs.spectators {
			gs.sendToSpectator(id, msg)
		}
	}
}

// intentMessage renders an intent for the targeted human (English, like the rest of the UI).
func intentMessage(aiName string, it ai.Intent) string {
	switch it.Kind {
	case ai.IntentTookTargetGolem:
		return aiName + " took the golem you were going for"
	case ai.IntentBlockCoin:
		if it.Motive {
			return aiName + " is blocking your coin bonus"
		}
		return aiName + " grabbed the coin bonus before you"
	case ai.IntentTookWantedCard:
		return aiName + " grabbed the merchant card you needed"
	case ai.IntentRushing:
		return aiName + " is one golem away from ending the game"
	}
	return aiName + " made a move"
}

// avatarNames[i] is the golem on avatar i+1; an AI is named after the avatar it wears.
// Keep in sync with AVATAR_IDS/AVATAR_NAMES in web/react-frontend/src/utils/avatar.js and
// deploy/make-golem-avatars.py (assets-src/avatars/avatars.json): 12 golems, then one variant of each.
var avatarNames = []string{
	"Basalt", "Mossback", "Rime", "Cinder", "Rivet", "Dune", "Quartz", "Terra", "Onyx", "Rootling", "Reef", "Nimbus",
	"Granite", "Fernhide", "Glacier", "Magma", "Anvil", "Mesa", "Amethyst", "Kiln", "Jet", "Thornbark", "Coralline", "Squall",
}

// avatarCount is the number of player avatars (1..avatarCount).
var avatarCount = len(avatarNames)

// aiName is the display name of an AI wearing avatar id (fallback "AI k").
func aiName(avatar string, k int) string {
	var i int
	if _, err := fmt.Sscanf(avatar, "%d", &i); err == nil && i >= 1 && i <= len(avatarNames) {
		return avatarNames[i-1]
	}
	return fmt.Sprintf("AI %d", k)
}

// aiAvatarsLocked returns n avatars for the AI seats: a random order fixed per room, skipping the
// avatars humans picked, so AIs never duplicate each other or a human. The waiting room and the
// started game use the same function, so the AIs keep their faces. Caller holds gs.mu.
func (gs *GameSession) aiAvatarsLocked(n int) []string {
	if gs.avatarOrder == nil {
		r := rand.New(rand.NewSource(time.Now().UnixNano()))
		for _, i := range r.Perm(avatarCount) {
			gs.avatarOrder = append(gs.avatarOrder, fmt.Sprintf("%d", i+1))
		}
	}
	taken := map[string]bool{}
	for _, p := range gs.connectedPlayers {
		taken[p.Avatar] = true
	}
	out := make([]string, 0, n)
	for _, a := range gs.avatarOrder {
		if len(out) == n {
			break
		}
		if !taken[a] {
			out = append(out, a)
		}
	}
	for i := 0; len(out) < n; i++ { // more AIs than free avatars (cannot happen with 24): reuse
		out = append(out, gs.avatarOrder[i%len(gs.avatarOrder)])
	}
	return out
}

// waitingAIRows lists the AI seats of a single-player room for the waiting room. Caller holds gs.mu.
func (gs *GameSession) waitingAIRows() []map[string]any {
	if !gs.isSingle() {
		return nil
	}
	numAI := gs.maxPlayers - 1
	avatars := gs.aiAvatarsLocked(numAI)
	rows := make([]map[string]any, 0, numAI)
	for k := 0; k < numAI; k++ {
		rows = append(rows, map[string]any{
			"id":       0,
			"name":     aiName(avatars[k], k+1),
			"avatar":   avatars[k],
			"aiAvatar": true,
			"isAI":     true,
			"aiLevel":  gs.aiLevelAt(k).String(),
			"aiIndex":  k,
			"online":   true,
		})
	}
	return rows
}

// thinkingInfoLocked describes the in-flight AI job for late joiners (nil when none). Caller holds gs.mu.
func (gs *GameSession) thinkingInfoLocked() map[string]any {
	if gs.aiJob == nil {
		return nil
	}
	return map[string]any{"playerID": gs.aiJob.playerID, "level": gs.aiJob.level.String(), "timeout": gs.aiJob.timeout}
}

// sortedLevels is a helper for logs.
func sortedLevels(levels []ai.Level) []string {
	out := make([]string, len(levels))
	for i, l := range levels {
		out[i] = l.String()
	}
	sort.Strings(out)
	return out
}

// modeName returns "single" or "multi". Caller holds gs.mu.
func (gs *GameSession) modeName() string {
	if gs.isSingle() {
		return "single"
	}
	return "multi"
}
