package session

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"slices"
	"strings"
	"sync"
	"time"

	"golem_century/internal/ai"
	"golem_century/internal/eventstore"
	"golem_century/internal/game"
	"golem_century/internal/logger"

	"github.com/gorilla/websocket"
	"go.uber.org/zap"
)

type GameStatus string

const (
	GameStatusWaiting GameStatus = "waiting"
	GameStatusPlaying GameStatus = "playing"
	GameStatusEnded   GameStatus = "ended"
)

type PlayerInfo struct {
	PlayerID  int    // in-game player ID, 0 if not assigned
	ClientID  string // unique client ID for each unique device
	Conn      *websocket.Conn
	Name      string
	Avatar    string
	JoinedAt  time.Time
	WriteChan chan []byte   // channel for writing to Conn
	Done      chan struct{} // signal to stop goroutines
}

func (p PlayerInfo) GetAvatar() string {
	if p.Avatar == "" {
		return fmt.Sprintf("%d", p.PlayerID)
	}
	return p.Avatar
}

type Spectator struct {
	SpectatorID string // unique spectator ID for each unique device
	Conn        *websocket.Conn
	Name        string
	WriteChan   chan []byte   // channel for writing to Conn
	Done        chan struct{} // signal to stop goroutines
}

// GameSession represents a multiplayer game session
type GameSession struct {
	ID            string
	GameState     *game.GameState
	CreatedAt     time.Time             // When session was created
	LastActivity  time.Time             // Last time someone was in the room
	EventStore    eventstore.EventStore // Event store for recording actions
	TurnTimeout   time.Duration         // Maximum time per turn (default 60s)
	TurnStartTime time.Time             // When the current turn started
	mu            sync.RWMutex
	ActionChan    chan PlayerAction
	logger        *logger.Logger
	maxChatMsgs   int // Max chat messages from config

	maxPlayers       int                    // maximum number of players in the game
	connectedPlayers map[string]*PlayerInfo // Client ID -> PlayerInfo (game players)
	assignedPlayers  map[int]string         // Player ID -> Client ID
	spectators       map[string]*Spectator  // Spectator ID -> SpectatorInfo
	status           GameStatus

	// WebSocket connection health check settings
	pingInterval time.Duration // Interval for sending ping messages (default 15s)
	readTimeout  time.Duration // Timeout for read operations (default 60s)
	writeTimeout time.Duration // Timeout for write operations (default 10s)

	// stop is closed by Close to end the game loop; ActionChan is never closed (senders could panic).
	stop      chan struct{}
	closeOnce sync.Once

	// AI (see ai_turns.go). Guarded by mu; agents run on cloned snapshots outside the lock.
	mode           Mode
	aiLevels       []ai.Level                           // single-player: level per AI (AI 1..n)
	aiRuntime      *ai.Runtime                          // server-wide thread pool and budgets
	pauseWhenEmpty bool                                 // no AI moves while nobody is connected
	intentMessages bool                                 // send aiIntent messages (off by default)
	avatarOrder    []string                             // random avatar order of this room (AI avatars)
	aiAvatars      map[int]string                       // player ID -> avatar of an AI seat
	agentFactory   func(ai.Level, *ai.Runtime) ai.Agent // tests
	agents         map[int]ai.Agent                     // player ID -> agent (AI seats)
	timeoutAgents  map[int]ai.Agent                     // player ID -> who plays for a timed-out human
	humans         []bool                               // seats played by people
	seed           int64                                // game seed (reproducible AI randomness)
	stepSeq        uint64                               // bumped on every applied step; stale AI results are dropped
	aiJob          *aiJob                               // in-flight AI decision, if any
	aiResults      chan aiResult                        // AI goroutine -> game loop
	ctx            context.Context                      // cancelled by Close (stops searches)
	cancel         context.CancelFunc
}

// PlayerAction represents an action from a player
type PlayerAction struct {
	PlayerID int
	ClientID string
	Action   game.Action
}

// NewGameSession creates a new game session
func NewGameSession(sessionID string, maxPlayers int, turnTimeoutInSecond int, eventstore eventstore.EventStore, logger *logger.Logger) *GameSession {
	now := time.Now()
	ctx, cancel := context.WithCancel(context.Background())
	return &GameSession{
		ctx:           ctx,
		cancel:        cancel,
		aiResults:     make(chan aiResult, 1),
		ID:            sessionID,
		CreatedAt:     now,
		LastActivity:  now,
		EventStore:    eventstore,
		TurnTimeout:   time.Duration(turnTimeoutInSecond) * time.Second, // Default 60s timeout
		TurnStartTime: now,
		ActionChan:    make(chan PlayerAction, 10),
		stop:          make(chan struct{}),
		logger:        logger,
		maxChatMsgs:   10, // Default, will be set from config

		maxPlayers:       maxPlayers,
		connectedPlayers: make(map[string]*PlayerInfo),
		assignedPlayers:  make(map[int]string),
		spectators:       make(map[string]*Spectator),
		status:           GameStatusWaiting,

		// WebSocket health check defaults
		pingInterval: 15 * time.Second, // Send ping every 15 seconds
		readTimeout:  60 * time.Second, // Read timeout 60 seconds
		writeTimeout: 10 * time.Second, // Write timeout 10 seconds
	}
}

// AddPlayer adds a player to the session, or reconnects an existing player
func (gs *GameSession) AddPlayer(playerID int, clientID string, name string, avatar string, conn *websocket.Conn) error {
	gs.mu.Lock()
	defer gs.mu.Unlock()

	if clientID == "" {
		clientID = fmt.Sprintf("client_%d", time.Now().UnixNano())
	}
	if avatar == "" {
		avatar = fmt.Sprintf("%d", playerID) // Default to player ID
	}
	if name == "" {
		name = fmt.Sprintf("Player %d", len(gs.connectedPlayers)+1)
	}
	gs.LastActivity = time.Now() // Update activity time

	// Check if player is reconnecting (client ID already exists)
	existingPlayer, isReconnection := gs.connectedPlayers[clientID]
	if isReconnection {
		gs.logger.Info("Player reconnected",
			zap.String("clientID", clientID),
			zap.Int("playerID", existingPlayer.PlayerID),
			zap.String("name", existingPlayer.Name),
		)
		// Stop old goroutines first
		if existingPlayer.Done != nil {
			close(existingPlayer.Done) // Signal old goroutines to stop
		}
		// Close old connection and write channel
		if existingPlayer.Conn != nil {
			existingPlayer.Conn.Close()
		}
		if existingPlayer.WriteChan != nil {
			close(existingPlayer.WriteChan)
		}
		// Small delay to allow old goroutines to exit
		time.Sleep(50 * time.Millisecond)

		// Create new connection, channels, and done signal
		existingPlayer.Conn = conn
		existingPlayer.WriteChan = make(chan []byte, 100)
		existingPlayer.Done = make(chan struct{})
		// Update player name/avatar if provided
		if name != "" {
			existingPlayer.Name = name
		}
		if avatar != "" {
			existingPlayer.Avatar = avatar
		}
		// Start new read and write handlers
		go gs.runPlayerWriteHandler(existingPlayer, existingPlayer.Conn, existingPlayer.WriteChan, existingPlayer.Done)
		go gs.runPlayerReadHandler(existingPlayer, existingPlayer.Conn)

		// Send playerAssigned message first so client knows its player ID
		assignedMsg := map[string]interface{}{
			"type":     "playerAssigned",
			"playerID": existingPlayer.PlayerID,
		}
		gs.sendToPlayer(clientID, assignedMsg)

		// Send current game state to reconnected player
		gs.sendToPlayer(clientID, gs.serializeState())
		// Notify others that player is back online
		gs.broadcastMemberStatusChanged(clientID, existingPlayer.Name, false, true)
		return nil
	}

	// New player joining
	if gs.status == GameStatusWaiting {
		err := gs.addToWaitingList(clientID, name, avatar, conn)
		if err != nil {
			return fmt.Errorf("failed to add player to waiting list: %w", err)
		}
	}

	if gs.status == GameStatusPlaying {
		err := gs.addPlayerToGame(playerID, clientID, name, avatar, conn)
		if err != nil {
			// If room is full and this looks like a reconnection attempt (player has same name or was recently in game),
			// we should still clean up old goroutines to prevent "websocket: close sent" errors
			// This ensures old write handlers don't try to write after we've closed the connection
			gs.logger.Debug("Failed to add player to game, will close new connection",
				zap.String("clientID", clientID),
				zap.Error(err),
			)
			// Close the new connection to prevent dangling references
			if conn != nil {
				conn.Close()
			}
			return fmt.Errorf("failed to add player to game: %w", err)
		}
	}

	// Start read and write handlers in other goroutines
	player := gs.connectedPlayers[clientID]
	if player != nil { // player should never be nil, if it is, it means our code has a bug :)
		go gs.runPlayerWriteHandler(player, player.Conn, player.WriteChan, player.Done)
		go gs.runPlayerReadHandler(player, player.Conn)
	}

	// Send assigned player ID back to client -> only after the game is started
	// Send initial state -> only after the game is started

	// Notify all users (players and spectators) that a player joined
	gs.broadcastMemberStatusChanged(clientID, name, false, true)

	// Broadcast updated state to all players so they see the new player's name
	gs.broadcastState()

	// // Auto-start game for single player sessions when first player joins
	// isSinglePlayer := strings.HasPrefix(gs.ID, "single")
	// isWaiting := gs.status == GameStatusWaiting
	// playerCount := len(gs.connectedPlayers)

	// gs.logger.Debug("Checking auto-start conditions",
	// 	zap.Bool("isSinglePlayer", isSinglePlayer),
	// 	zap.Bool("isWaiting", isWaiting),
	// 	zap.Int("playerCount", playerCount),
	// )

	// shouldAutoStart := isSinglePlayer && isWaiting && playerCount == 1

	// if shouldAutoStart {
	// 	gs.logger.Info("Auto-starting single player game", zap.String("sessionID", gs.ID))
	// 	gs.mu.Unlock()
	// 	if err := gs.StartGame(); err != nil {
	// 		gs.logger.Error("Failed to auto-start single player game", zap.Error(err))
	// 	}
	// 	return nil
	// }

	// // Normal path - unlock and return
	// gs.mu.Unlock()
	return nil
}

func (gs *GameSession) StartGame() error {
	gs.mu.Lock()
	defer gs.mu.Unlock()

	// Check that game is in waiting status
	if gs.status != GameStatusWaiting {
		return fmt.Errorf("game is not in waiting status")
	}

	if !gs.isSingle() {
		// Check that we have at least 2 players
		// When it's player vs player room
		if len(gs.connectedPlayers) < 2 {
			return fmt.Errorf("need at least 2 players")
		}
	}

	// Initialize game state
	seed := time.Now().UnixNano()

	// Single player: every seat (humans + AIs); multiplayer: the connected humans.
	numPlayers := len(gs.connectedPlayers)
	if gs.isSingle() {
		numPlayers = gs.maxPlayers
		gs.logger.Info("Single player mode: using maxPlayers for game state",
			zap.Int("maxPlayers", gs.maxPlayers),
			zap.Int("connectedPlayers", len(gs.connectedPlayers)),
			zap.Strings("aiLevels", sortedLevels(gs.aiLevels)),
		)
	}

	gs.GameState = game.NewGameState(numPlayers, seed)
	gs.seed = seed
	gs.status = GameStatusPlaying
	gs.TurnStartTime = time.Now()

	// Seat humans (random seats in single player) and create one agent per AI seat.
	gs.assignSeats(rand.New(rand.NewSource(seed)))

	// Update number of players in the game equals to the number of connected players
	gs.maxPlayers = len(gs.connectedPlayers)

	// Store initial game state in event store
	if gs.EventStore != nil {
		req := eventstore.StoreEventRequest{
			GameID:    gs.ID,
			PlayerID:  0,                     // System event
			Action:    game.Action{Type: -1}, // Special marker for initial state
			GameState: gs.GameState.Clone(),
		}
		resp := gs.EventStore.StoreEvent(req)
		if resp.Error != nil {
			gs.logger.Warn("Failed to store initial game state", zap.Error(resp.Error))
		}
	}
	// Send playerAssigned messages to all players
	for clientID, playerInfo := range gs.connectedPlayers {
		if playerInfo.PlayerID > 0 {
			assignedMsg := map[string]interface{}{
				"type":     "playerAssigned",
				"playerID": playerInfo.PlayerID,
			}
			gs.sendToPlayer(clientID, assignedMsg)
		}
	}

	// Broadcast initial state
	gs.broadcastState()

	// Start the game loop
	go gs.runGameLoop()

	gs.logger.Info("Game started",
		zap.String("sessionID", gs.ID),
		zap.Int("totalPlayers", len(gs.GameState.Players)),
	)

	return nil
}

func (gs *GameSession) getShuffledClientIDs(players map[string]*PlayerInfo) []string {
	rng := rand.New(rand.NewSource(time.Now().UnixMilli()))
	numPlayers := len(players)

	clientIDs := make([]string, 0, numPlayers)
	for clientId := range gs.connectedPlayers {
		clientIDs = append(clientIDs, clientId)
	}
	rng.Shuffle(numPlayers, func(i, j int) {
		clientIDs[i], clientIDs[j] = clientIDs[j], clientIDs[i]
	})
	return clientIDs
}

// findAvailablePlayerID returns the first human seat without a connected client (AI seats are
// never handed to a human).
func (gs *GameSession) findAvailablePlayerID() int {
	if gs.GameState == nil {
		return 0
	}
	for _, p := range gs.GameState.Players {
		if p.IsAI {
			continue
		}
		if _, ok := gs.assignedPlayers[p.ID]; !ok {
			return p.ID
		}
	}
	return 0
}

// addPlayerToGame add a new player or a disconnected player back to the game
func (gs *GameSession) addPlayerToGame(playerID int, clientID string, name string, avatar string, conn *websocket.Conn) error {
	if gs.status != GameStatusPlaying {
		return fmt.Errorf("game is not playing")
	}
	if len(gs.connectedPlayers) >= gs.maxPlayers {
		return fmt.Errorf("game is full")
	}

	// AI seats and out-of-range IDs are never handed to a human
	if playerID < 0 || playerID > len(gs.GameState.Players) || (playerID > 0 && gs.GameState.Players[playerID-1].IsAI) {
		playerID = 0
	}
	// check if playerID is already in the players list
	if _, ok := gs.assignedPlayers[playerID]; ok && playerID > 0 {
		gs.logger.Warn("playerID is in use by another player", zap.Int("playerID", playerID))
		playerID = 0 // auto-assign next available player ID
	}
	if playerID == 0 {
		playerID = gs.findAvailablePlayerID()
		if playerID == 0 {
			return fmt.Errorf("failed to assign player ID, game is full")
		}
	}

	gs.connectedPlayers[clientID] = &PlayerInfo{
		PlayerID:  playerID,
		Conn:      conn,
		Name:      name,
		Avatar:    avatar,
		ClientID:  clientID,
		JoinedAt:  time.Now(),
		WriteChan: make(chan []byte, 100),
		Done:      make(chan struct{}),
	}

	// add mapping from player ID to client ID
	gs.assignedPlayers[playerID] = clientID

	// sync player name with the game state's player name
	gs.GameState.Players[playerID-1].Name = name

	assignedMsg := map[string]interface{}{
		"type":     "playerAssigned",
		"playerID": playerID,
	}
	gs.sendToPlayer(clientID, assignedMsg)

	gs.logger.Info("added player back to the game",
		zap.Int("playerID", playerID),
		zap.String("clientID", clientID),
		zap.String("name", name),
	)

	return nil
}

func (gs *GameSession) addToWaitingList(clientID string, name string, avatar string, conn *websocket.Conn) error {
	// check to remove the player with the same clientID if exists
	if _, ok := gs.connectedPlayers[clientID]; ok {
		return fmt.Errorf("player with the same clientID already exists")
	}

	if len(gs.connectedPlayers) >= gs.maxPlayers {
		return fmt.Errorf("waiting list is full")
	}

	gs.connectedPlayers[clientID] = &PlayerInfo{
		ClientID:  clientID,
		Conn:      conn,
		Name:      name,
		Avatar:    avatar,
		JoinedAt:  time.Now(),
		WriteChan: make(chan []byte, 100),
		Done:      make(chan struct{}),
	}
	gs.logger.Info("added player to waiting list",
		zap.String("clientID", clientID),
		zap.String("name", name),
	)

	return nil
}

// runPlayerWriteHandler handles writes to the player's websocket connection.
// Should be invoked in a goroutine by the caller, with the connection and channels captured under
// gs.mu: the PlayerInfo fields are replaced on reconnection and cleared on removal, so reading
// them here would race (and could write to the wrong connection).
func (gs *GameSession) runPlayerWriteHandler(player *PlayerInfo, conn *websocket.Conn, writeChan chan []byte, done chan struct{}) {
	// Start ping ticker to keep connection alive
	ticker := time.NewTicker(gs.pingInterval)
	defer ticker.Stop()

	for {
		select {
		case <-done:
			// Stop signal received, exit goroutine
			return
		case msg, ok := <-writeChan:
			if !ok {
				// Channel closed, exit goroutine
				return
			}
			if conn != nil {
				conn.SetWriteDeadline(time.Now().Add(gs.writeTimeout))
				err := conn.WriteMessage(websocket.TextMessage, msg)

				if err != nil {
					// Check if this is a connection closed error
					if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) ||
						strings.Contains(err.Error(), "close sent") ||
						strings.Contains(err.Error(), "use of closed network connection") {
						// Connection is closed, stop this goroutine
						gs.logger.Debug("write handler detected closed connection, exiting",
							zap.String("clientID", player.ClientID),
							zap.String("name", player.Name),
							zap.Error(err),
						)
						return
					}
					// Log error and continue processing messages for other errors
					gs.logger.Error("failed to write message to player",
						zap.String("clientID", player.ClientID),
						zap.String("name", player.Name),
						zap.Int("playerID", player.PlayerID),
						zap.Error(err),
					)
					continue
				}
			}
		case <-ticker.C:
			// Send ping message to keep connection alive
			if conn != nil {
				conn.SetWriteDeadline(time.Now().Add(gs.writeTimeout))
				err := conn.WriteMessage(websocket.PingMessage, nil)

				if err != nil {
					// Check if this is a connection closed error
					if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) ||
						strings.Contains(err.Error(), "close sent") ||
						strings.Contains(err.Error(), "use of closed network connection") {
						// Connection is closed, stop this goroutine
						gs.logger.Debug("ping ticker detected closed connection, exiting",
							zap.String("clientID", player.ClientID),
							zap.Error(err),
						)
						return
					}
					gs.logger.Debug("failed to send ping to player",
						zap.String("clientID", player.ClientID),
						zap.Error(err),
					)
				}
			}
		}
	}
}

// runSpectatorWriteHandler handles writes to the spectator's websocket connection
// Should be invoked in a goroutine by the caller
func (gs *GameSession) runSpectatorWriteHandler(spectator *Spectator) {
	// Start ping ticker to keep connection alive
	ticker := time.NewTicker(gs.pingInterval)
	defer ticker.Stop()

	for {
		select {
		case <-spectator.Done:
			// Stop signal received, exit goroutine
			return
		case msg, ok := <-spectator.WriteChan:
			if !ok {
				// Channel closed, exit goroutine
				return
			}
			if spectator.Conn != nil {
				spectator.Conn.SetWriteDeadline(time.Now().Add(gs.writeTimeout))
				err := spectator.Conn.WriteMessage(websocket.TextMessage, msg)

				if err != nil {
					// Check if this is a connection closed error
					if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) ||
						strings.Contains(err.Error(), "close sent") ||
						strings.Contains(err.Error(), "use of closed network connection") {
						// Connection is closed, stop this goroutine
						gs.logger.Debug("spectator write handler detected closed connection, exiting",
							zap.String("spectatorID", spectator.SpectatorID),
							zap.Error(err),
						)
						return
					}
					// Log error and continue processing messages for other errors
					gs.logger.Error("failed to write message to spectator",
						zap.String("spectatorID", spectator.SpectatorID),
						zap.Error(err),
					)
					continue
				}
			}
		case <-ticker.C:
			// Send ping message to keep connection alive
			if spectator.Conn != nil {
				spectator.Conn.SetWriteDeadline(time.Now().Add(gs.writeTimeout))
				err := spectator.Conn.WriteMessage(websocket.PingMessage, nil)

				if err != nil {
					// Check if this is a connection closed error
					if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) ||
						strings.Contains(err.Error(), "close sent") ||
						strings.Contains(err.Error(), "use of closed network connection") {
						// Connection is closed, stop this goroutine
						gs.logger.Debug("spectator ping ticker detected closed connection, exiting",
							zap.String("spectatorID", spectator.SpectatorID),
							zap.Error(err),
						)
						return
					}
					gs.logger.Debug("failed to send ping to spectator",
						zap.String("spectatorID", spectator.SpectatorID),
						zap.Error(err),
					)
				}
			}
		}
	}
}

func (gs *GameSession) handleRemovePlayer(clientID string) {
	gs.handleRemovePlayerConn(clientID, nil)
}

// handleRemovePlayerConn removes a player whose connection `conn` failed. A read handler of an old
// connection (the player has since reconnected) must not tear down the new one: then it is a no-op.
// conn == nil removes unconditionally.
func (gs *GameSession) handleRemovePlayerConn(clientID string, conn *websocket.Conn) {
	gs.mu.Lock()
	defer gs.mu.Unlock()

	p := gs.connectedPlayers[clientID]
	if p == nil {
		return
	}
	if conn != nil && p.Conn != conn {
		return // stale handler: the player already reconnected (or was removed) on another connection
	}

	if p.Conn != nil {
		p.Conn.Close()
		p.Conn = nil // Set to nil so GetActivelyConnectedPlayersCount doesn't count this player
	}

	// If game is still waiting/not started, completely remove the player
	switch gs.status {
	case GameStatusWaiting:
		// Signal goroutines to stop and close channels
		if p.Done != nil {
			close(p.Done)
		}
		if p.WriteChan != nil {
			close(p.WriteChan)
		}
		if p.PlayerID > 0 {
			delete(gs.assignedPlayers, p.PlayerID)
		}
		delete(gs.connectedPlayers, clientID)

		gs.logger.Info("player left waiting lobby",
			zap.String("clientID", clientID),
			zap.Int("playerID", p.PlayerID),
			zap.String("name", p.Name),
		)
	case GameStatusPlaying:
		// During active game, keep player in system for reconnection
		// Don't close the WriteChan - they might reconnect and we'll send them state updates
		// The old write handler goroutine will exit when it tries to write to a closed Conn
		// A new write handler will be started on reconnection with a new WriteChan
		gs.logger.Info("player disconnected during game (kept in session for potential reconnection)",
			zap.String("clientID", clientID),
			zap.Int("playerID", p.PlayerID),
			zap.String("name", p.Name),
		)
	}

	// broadcast that player left the game
	gs.broadcastMemberStatusChanged(clientID, p.Name, false, false)
	gs.broadcastState()
}

func (gs *GameSession) runPlayerReadHandler(player *PlayerInfo, conn *websocket.Conn) {
	log := gs.logger.With(zap.String("clientID", player.ClientID)).With(zap.String("name", player.Name))

	// Set up pong handler to reset read deadline when receiving pong messages
	conn.SetPongHandler(func(string) error {
		conn.SetReadDeadline(time.Now().Add(gs.readTimeout))
		log.Debug("received pong from player")
		return nil
	})

	// Set initial read deadline
	conn.SetReadDeadline(time.Now().Add(gs.readTimeout))

	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			log.Error("read error", zap.Error(err))
			break
		}

		// Reset read deadline on each message
		conn.SetReadDeadline(time.Now().Add(gs.readTimeout))

		var req map[string]interface{}
		if err := json.Unmarshal(message, &req); err != nil {
			log.Error("invalid message", zap.Error(err))
			continue
		}

		actionType, ok := req["type"].(string)
		if !ok {
			continue
		}

		switch actionType {
		case "chat":
			gs.handleChatMessage(player.ClientID, req)
		case "action":
			gs.handlePlayerAction(player.ClientID, req)
		}
	}

	// connection error, remove player from session (unless they already reconnected on a new conn)
	gs.handleRemovePlayerConn(player.ClientID, conn)
}

func (gs *GameSession) handleChatMessage(clientID string, req map[string]any) {
	message, _ := req["message"].(string)
	if message == "" {
		return
	}

	gs.mu.RLock()
	defer gs.mu.RUnlock()

	// Get player name
	playerName := gs.connectedPlayers[clientID].Name

	// Broadcast chat message to all players
	chatMsg := map[string]interface{}{
		"type":   "chat",
		"player": playerName,
		// "playerID":  playerID,
		"message":   message,
		"timestamp": time.Now().Unix(),
	}
	gs.broadcast(chatMsg)
}

func (gs *GameSession) handlePlayerAction(clientID string, req map[string]any) {
	gs.mu.RLock()
	if gs.status != GameStatusPlaying { // game not started yet
		gs.mu.RUnlock()
		return
	}
	pi, ok := gs.connectedPlayers[clientID]
	if !ok { // invalid clientID from obsolete connection
		gs.mu.RUnlock()
		return
	}
	playerID := pi.PlayerID
	gs.mu.RUnlock() // never hold the lock while handing the action to the game loop

	actionTypeStr, _ := req["actionType"].(string)
	cardIndex, _ := req["cardIndex"].(float64)

	// Parse input and output resources if present
	var inputResources *game.Resources
	var outputResources *game.Resources

	if inputRes, ok := req["inputResources"].(map[string]interface{}); ok {
		getInt := func(m map[string]interface{}, key string) int {
			if val, exists := m[key]; exists {
				if f, ok := val.(float64); ok {
					return int(f)
				}
			}
			return 0
		}
		inputResources = &game.Resources{
			Yellow: getInt(inputRes, "yellow"),
			Green:  getInt(inputRes, "green"),
			Blue:   getInt(inputRes, "blue"),
			Pink:   getInt(inputRes, "pink"),
		}
	}

	if outputRes, ok := req["outputResources"].(map[string]interface{}); ok {
		getInt := func(m map[string]interface{}, key string) int {
			if val, exists := m[key]; exists {
				if f, ok := val.(float64); ok {
					return int(f)
				}
			}
			return 0
		}
		outputResources = &game.Resources{
			Yellow: getInt(outputRes, "yellow"),
			Green:  getInt(outputRes, "green"),
			Blue:   getInt(outputRes, "blue"),
			Pink:   getInt(outputRes, "pink"),
		}
	}

	// Parse multiplier if present
	multiplier := 1
	if mult, ok := req["multiplier"].(float64); ok {
		multiplier = int(mult)
		if multiplier < 1 {
			multiplier = 1
		}
	}

	// Parse deposit list if present (for acquireCard action)
	var depositList []game.DepositData
	if deposits, ok := req["deposits"].([]interface{}); ok {
		for _, dep := range deposits {
			if depMap, ok := dep.(map[string]interface{}); ok {
				if crystalStr, ok := depMap["crystal"].(string); ok {
					var crystal game.CrystalType
					switch crystalStr {
					case "yellow":
						crystal = game.Yellow
					case "green":
						crystal = game.Green
					case "blue":
						crystal = game.Blue
					case "pink":
						crystal = game.Pink
					default:
						continue
					}
					depositList = append(depositList, game.DepositData{Crystal: crystal})
				}
			}
		}
	}

	var gameAction game.Action
	switch actionTypeStr {
	case "playCard":
		gameAction = game.Action{
			Type:            game.PlayCard,
			CardIndex:       int(cardIndex),
			Multiplier:      multiplier,
			InputResources:  inputResources,
			OutputResources: outputResources,
		}
	case "acquireCard":
		gameAction = game.Action{
			Type:        game.AcquireCard,
			CardIndex:   int(cardIndex),
			DepositList: depositList,
		}
	case "claimPointCard":
		gameAction = game.Action{
			Type:      game.ClaimPointCard,
			CardIndex: int(cardIndex),
		}
	case "rest":
		gameAction = game.Action{
			Type: game.Rest,
		}
	case "discard":
		// Parse discard resources
		var discardResources *game.Resources
		if discardRes, ok := req["discardResources"].(map[string]interface{}); ok {
			getInt := func(m map[string]interface{}, key string) int {
				if val, exists := m[key]; exists {
					if f, ok := val.(float64); ok {
						return int(f)
					}
				}
				return 0
			}
			discardResources = &game.Resources{
				Yellow: getInt(discardRes, "yellow"),
				Green:  getInt(discardRes, "green"),
				Blue:   getInt(discardRes, "blue"),
				Pink:   getInt(discardRes, "pink"),
			}
		}
		gameAction = game.Action{
			Type:             game.Discard,
			DiscardResources: discardResources,
		}
	default:
		return
	}
	select {
	case gs.ActionChan <- PlayerAction{
		PlayerID: playerID,
		ClientID: clientID,
		Action:   gameAction,
	}:
	case <-gs.stop: // session closed: drop the action instead of blocking forever
	default: // the loop is far behind (flooding client): tell the sender instead of blocking
		gs.mu.RLock()
		gs.sendToPlayer(clientID, map[string]any{"type": "error", "error": "server busy, please retry"})
		gs.mu.RUnlock()
	}
}

// AddSpectator adds a spectator to the session
// Similar to AddPlayer, this handles all spectator connection logic:
// - Creates spectatorID if not provided
// - Sends spectator assignment message
// - Sends initial state
// - Broadcasts member status change
// - Starts message handler goroutine
func (gs *GameSession) AddSpectator(name string, conn *websocket.Conn) error {
	gs.mu.Lock()
	defer gs.mu.Unlock()

	if name == "" {
		name = fmt.Sprintf("Spectator %d", len(gs.spectators)+1)
	}
	spectatorID := fmt.Sprintf("spectator_%d", time.Now().UnixNano())

	// Create spectator info
	spectator := &Spectator{
		SpectatorID: spectatorID,
		Conn:        conn,
		Name:        name,
		WriteChan:   make(chan []byte, 100),
		Done:        make(chan struct{}),
	}
	gs.spectators[spectatorID] = spectator
	gs.LastActivity = time.Now()

	// Send spectator assignment message
	assignedMsg := map[string]interface{}{
		"type":        "spectatorAssigned",
		"spectatorID": spectatorID,
		"isSpectator": true,
	}
	gs.sendToSpectator(spectatorID, assignedMsg)

	// Send initial state & broadcast that spectator joined
	gs.sendToSpectator(spectatorID, gs.serializeState())
	gs.broadcastMemberStatusChanged(spectatorID, name, true, true)

	// Start message read/write handler goroutine (spectators can send chat messages)
	go gs.runSpectatorReadHandler(spectatorID, conn)
	go gs.runSpectatorWriteHandler(spectator)

	gs.logger.Info("spectator added to session",
		zap.String("spectatorID", spectatorID),
		zap.String("name", name),
	)

	return nil
}

// handleRemoveSpectator removes a spectator from the session
func (gs *GameSession) handleRemoveSpectator(spectatorID string) {
	gs.mu.Lock()
	defer gs.mu.Unlock()

	spectator := gs.spectators[spectatorID]
	if spectator == nil {
		return
	}
	// Signal goroutines to stop and close channels
	if spectator.Done != nil {
		close(spectator.Done)
	}
	if spectator.WriteChan != nil {
		close(spectator.WriteChan)
	}
	delete(gs.spectators, spectatorID)

	// Close connection if still open
	if spectator.Conn != nil {
		spectator.Conn.Close()
	}

	// Broadcast that spectator is leaving before removing
	gs.broadcastMemberStatusChanged(spectatorID, spectator.Name, true, false)

	gs.logger.Info("spectator removed from session",
		zap.String("spectatorID", spectatorID),
		zap.String("name", spectator.Name),
	)
}

// runSpectatorReadHandler handles incoming messages from a spectator
func (gs *GameSession) runSpectatorReadHandler(spectatorID string, conn *websocket.Conn) {
	log := gs.logger.With(zap.String("spectatorID", spectatorID))

	// Set up pong handler to reset read deadline when receiving pong messages
	conn.SetPongHandler(func(string) error {
		conn.SetReadDeadline(time.Now().Add(gs.readTimeout))
		log.Debug("received pong from spectator")
		return nil
	})

	// Set initial read deadline
	conn.SetReadDeadline(time.Now().Add(gs.readTimeout))

	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			log.Error("read error", zap.Error(err))
			break
		}

		// Reset read deadline on each message
		conn.SetReadDeadline(time.Now().Add(gs.readTimeout))

		var req map[string]interface{}
		if err := json.Unmarshal(message, &req); err != nil {
			log.Error("invalid message", zap.Error(err))
			continue
		}

		actionType, ok := req["type"].(string)
		if !ok {
			continue
		}

		switch actionType {
		case "chat":
			gs.handleSpectatorChatMessage(spectatorID, req)
			// Spectators can only send chat messages, not game actions
		}
	}

	// Connection error, remove spectator from session
	gs.handleRemoveSpectator(spectatorID)
}

// handleSpectatorChatMessage handles chat messages from spectators
func (gs *GameSession) handleSpectatorChatMessage(spectatorID string, req map[string]any) {
	message, _ := req["message"].(string)
	if message == "" {
		return
	}

	gs.mu.RLock()
	defer gs.mu.RUnlock()

	// Get spectator name
	spectator := gs.spectators[spectatorID]
	if spectator == nil {
		return
	}

	// Broadcast chat message to all players and spectators
	chatMsg := map[string]interface{}{
		"type":      "chat",
		"player":    spectator.Name,
		"message":   message,
		"timestamp": time.Now().Unix(),
	}
	gs.broadcast(chatMsg)
}

// sendToSpectator sends a message to a specific spectator
func (gs *GameSession) sendToSpectator(spectatorID string, data map[string]any) error {
	spectatorInfo := gs.spectators[spectatorID]

	if spectatorInfo == nil || spectatorInfo.Conn == nil {
		return nil
	}

	msg, _ := json.Marshal(data)

	// Asynchronous write - non-blocking, drops message if channel is full
	select {
	case spectatorInfo.WriteChan <- msg:
		return nil
	default:
		// Channel is full or closed - drop message for spectators
		return fmt.Errorf("spectator write channel is full or closed")
	}
}

// CanBeDeleted checks if the session can be deleted
func (gs *GameSession) CanBeDeleted() bool {
	gs.mu.RLock()
	defer gs.mu.RUnlock()

	hasPlayers := len(gs.connectedPlayers) > 0
	hasSpectators := len(gs.spectators) > 0
	timeSinceActivity := time.Since(gs.LastActivity)

	return !hasPlayers && !hasSpectators && timeSinceActivity >= 5*time.Minute
}

// GetStatus returns the status of the session
func (gs *GameSession) GetStatus() GameStatus {
	gs.mu.RLock()
	defer gs.mu.RUnlock()
	return gs.status
}

func (gs *GameSession) GetMaxPlayers() int {
	gs.mu.RLock()
	defer gs.mu.RUnlock()
	return gs.maxPlayers
}

// GetConnectedPlayersCount returns the number of connected players
func (gs *GameSession) GetConnectedPlayersCount() int {
	gs.mu.RLock()
	defer gs.mu.RUnlock()
	return len(gs.connectedPlayers)
}

// GetActivelyConnectedPlayersCount returns the number of players with active connections
// This counts only players who have an open WebSocket connection (not disconnected/offline players)
// Used by the /list endpoint to determine if room is full for new joins
func (gs *GameSession) GetActivelyConnectedPlayersCount() int {
	gs.mu.RLock()
	defer gs.mu.RUnlock()

	count := 0
	for _, player := range gs.connectedPlayers {
		// Count only players with active connections
		// During gameplay, disconnected players are kept for reconnection but have Conn = nil
		if player.Conn != nil {
			count++
		}
	}
	return count
}

// GetConnectedSpectatorsCount returns the number of connected spectators
func (gs *GameSession) GetConnectedSpectatorsCount() int {
	gs.mu.RLock()
	defer gs.mu.RUnlock()
	return len(gs.spectators)
}

// GetPlayerNames returns a list of all connected player names
func (gs *GameSession) GetPlayerNames() []string {
	gs.mu.RLock()
	defer gs.mu.RUnlock()

	playerNames := make([]string, 0)
	for _, playerInfo := range gs.connectedPlayers {
		if playerInfo.Name != "" {
			playerNames = append(playerNames, playerInfo.Name)
		}
	}
	return playerNames
}

// broadcastMemberStatusChanged notifies all users when a player or spectator joins/leaves the game
func (gs *GameSession) broadcastMemberStatusChanged(clientID string, name string, isSpectator bool, online bool) {
	joinMsg := map[string]interface{}{
		"type":        "memberStatusChanged",
		"clientID":    clientID,
		"playerName":  name,
		"isSpectator": isSpectator,
		"online":      online,
	}
	gs.broadcast(joinMsg, clientID)
}

// broadcast sends a message to all connected players and spectators
func (gs *GameSession) broadcast(data map[string]any, excludeClientIDs ...string) {
	msg, _ := json.Marshal(data)

	// Send to all players except the ones in the exclude list
	for _, player := range gs.connectedPlayers {
		// Skip if no connection or connection is closed
		if player == nil || player.Conn == nil || player.WriteChan == nil {
			continue
		}
		if slices.Contains(excludeClientIDs, player.ClientID) {
			continue
		}
		// Use non-blocking send to avoid panic on closed channels
		select {
		case player.WriteChan <- msg:
			// Message queued successfully
		default:
			// Channel is full or closed - this is okay during reconnection
			// Don't log to avoid spam during high traffic
		}
	}

	// Send to all spectators except the ones in the exclude list
	// Asynchronous writes for spectators - non-blocking, drops message if channel is full
	for _, spectatorInfo := range gs.spectators {
		if spectatorInfo == nil || spectatorInfo.Conn == nil || spectatorInfo.WriteChan == nil {
			continue
		}
		if slices.Contains(excludeClientIDs, spectatorInfo.SpectatorID) {
			continue
		}
		select {
		case spectatorInfo.WriteChan <- msg:
			// Message queued successfully
		default:
			// Channel is full or closed - drop message for spectators
		}
	}
}

// SendToPlayer sends a message to a specific player
func (gs *GameSession) sendToPlayer(clientID string, data map[string]any) error {
	player := gs.connectedPlayers[clientID]
	if player != nil {
		msg, _ := json.Marshal(data)
		// Use non-blocking send to avoid panic on closed channels
		select {
		case player.WriteChan <- msg:
			// Message queued successfully
		default:
			// Channel is full or closed
			return fmt.Errorf("failed to send message to player %s: channel closed or full", clientID)
		}
	}
	return nil
}

// broadcastState broadcasts the current game state to all players
func (gs *GameSession) broadcastState() {
	gs.broadcast(gs.serializeState())
}

func (gs *GameSession) getPlayerInfo(playerID int) *PlayerInfo {
	clientID := gs.assignedPlayers[playerID]
	return gs.connectedPlayers[clientID]
}

func (gs *GameSession) GetSerializedState() map[string]interface{} {
	gs.mu.RLock()
	defer gs.mu.RUnlock()
	return gs.serializeState()
}

// serializeState serializes the game state for JSON transmission
func (gs *GameSession) serializeState() map[string]interface{} {
	// gs.mu.RLock()
	// defer gs.mu.RUnlock()

	if gs.status == GameStatusWaiting {
		waitingPlayers := make([]map[string]interface{}, 0, len(gs.connectedPlayers))
		for _, p := range gs.connectedPlayers {
			avatar := p.Avatar
			resourcesMap := map[string]int{
				"yellow": 0,
				"green":  0,
				"blue":   0,
				"pink":   0,
			}

			waitingPlayers = append(waitingPlayers, map[string]interface{}{
				"id":        p.PlayerID,
				"name":      p.Name,
				"avatar":    avatar,
				"resources": resourcesMap,
				// Backwards compatibility: some frontends expect `caravan`
				// as the resource container. Provide the same map under that key.
				"caravan": resourcesMap,
				// "points":         0,
				// "hasRested": false,
				"isAI": false,
				// "pendingDiscard": 0,
				"joinedAt": p.JoinedAt.Format(time.RFC3339),
				"online":   true,
			})
		}
		slices.SortFunc(waitingPlayers, func(a, b map[string]interface{}) int {
			aJoinedAt, _ := a["joinedAt"].(string)
			bJoinedAt, _ := b["joinedAt"].(string)
			return strings.Compare(aJoinedAt, bJoinedAt)
		})
		// Single player: show the AI opponents (with their level) before the game starts.
		waitingPlayers = append(waitingPlayers, gs.waitingAIRows()...)

		return map[string]interface{}{
			"type": "state",
			// "currentTurn":     0,
			// "currentPlayer":   0,
			// "round":           0,
			// "gameOver":        false,
			// "lastRound":       false,
			// "winner":          nil,
			"players":         waitingPlayers,
			"maxChatMessages": gs.maxChatMsgs,
			// "market":          map[string]interface{}{},
			"status":     gs.status,
			"mode":       gs.modeName(),
			"numPlayers": gs.maxPlayers,
		}
	}

	players := make([]map[string]interface{}, len(gs.GameState.Players))
	for i, p := range gs.GameState.Players {
		avatar := fmt.Sprintf("%d", p.ID)
		joinedAt := ""

		pi := gs.getPlayerInfo(p.ID)
		aiAvatar := false
		if pi != nil {
			avatar = pi.GetAvatar()
			joinedAt = pi.JoinedAt.Format(time.RFC3339)
		} else if a, ok := gs.aiAvatars[p.ID]; ok {
			avatar, aiAvatar = a, true // random, picked by the server
		}

		resourcesMap := map[string]int{
			"yellow": p.Resources.Yellow,
			"green":  p.Resources.Green,
			"blue":   p.Resources.Blue,
			"pink":   p.Resources.Pink,
		}

		players[i] = map[string]interface{}{
			"id":        p.ID,
			"name":      p.Name,
			"avatar":    avatar,
			"resources": resourcesMap,
			// Backwards compatibility: some frontends expect `caravan`
			// as the resource container. Provide the same map under that key.
			"caravan":        resourcesMap,
			"points":         p.GetPoints(),
			"hand":           serializeCards(p.Hand),
			"playedCards":    serializeCards(p.PlayedCards),
			"pointCards":     serializeCards(p.PointCards),
			"coins":          serializeCards(p.Coins),
			"hasRested":      p.HasRested,
			"isAI":           p.IsAI,
			"aiLevel":        gs.aiLevelOf(p.ID),
			"aiAvatar":       aiAvatar,
			"pendingDiscard": p.PendingDiscard,
			"joinedAt":       joinedAt,
			"online":         pi != nil || p.IsAI,
		}
	}

	marketActionCards := make([]map[string]interface{}, len(gs.GameState.Market.ActionCards))
	for i, card := range gs.GameState.Market.ActionCards {
		cost := gs.GameState.Market.GetActionCardCost(i)
		serialized := serializeCardWithCost(card, cost)
		serialized["placeCrystals"] = gs.GameState.Market.CrystalsToPlace(i) // official price: k crystals of any colour
		// Ensure deposits field exists
		if _, exists := serialized["deposits"]; !exists {
			serialized["deposits"] = make(map[string]string)
		}
		marketActionCards[i] = serialized
	}

	marketPointCards := make([]map[string]interface{}, len(gs.GameState.Market.PointCards))
	for i, card := range gs.GameState.Market.PointCards {
		marketPointCards[i] = serializeCard(card)
	}

	marketCoins := serializeCards(gs.GameState.Market.Coins)

	return map[string]interface{}{
		"type":            "state",
		"currentTurn":     gs.GameState.CurrentTurn,
		"currentPlayer":   gs.GameState.GetCurrentPlayer().ID,
		"round":           gs.GameState.Round,
		"gameOver":        gs.GameState.GameOver,
		"lastRound":       gs.GameState.LastRound,
		"winner":          gs.getWinnerInfo(),
		"players":         players,
		"maxChatMessages": gs.maxChatMsgs,
		"market": map[string]interface{}{
			"actionCards": marketActionCards,
			"pointCards":  marketPointCards,
			"actionDeck":  len(gs.GameState.Market.ActionDeck),
			"pointDeck":   len(gs.GameState.Market.PointDeck),
			"coins":       marketCoins,
		},
		"status":      gs.status,
		"mode":        gs.modeName(),
		"turnTimeout": int(gs.TurnTimeout / time.Second),
		"golemsToEnd": gs.GameState.GolemsToEnd(),
		"aiThinking":  gs.thinkingInfoLocked(),
	}
}

func (gs *GameSession) getWinnerInfo() map[string]interface{} {
	if gs.GameState.Winner == nil {
		return nil
	}
	return map[string]interface{}{
		"id":     gs.GameState.Winner.ID,
		"name":   gs.GameState.Winner.Name,
		"points": gs.GameState.Winner.GetFinalPoints(),
	}
}

func serializeCards(cards []*game.Card) []map[string]interface{} {
	result := make([]map[string]interface{}, len(cards))
	for i, card := range cards {
		result[i] = serializeCard(card)
	}
	return result
}

func serializeCard(card *game.Card) map[string]interface{} {
	result := map[string]interface{}{
		"id":   card.ID,
		"name": card.Name,
		"type": card.Type,
	}

	if card.Type == game.ActionCard {
		result["actionType"] = card.ActionType
		if card.Input != nil {
			result["input"] = map[string]int{
				"yellow": card.Input.Yellow,
				"green":  card.Input.Green,
				"blue":   card.Input.Blue,
				"pink":   card.Input.Pink,
			}
		}
		if card.Output != nil {
			result["output"] = map[string]int{
				"yellow": card.Output.Yellow,
				"green":  card.Output.Green,
				"blue":   card.Output.Blue,
				"pink":   card.Output.Pink,
			}
		}
		if card.ActionType == game.Upgrade {
			result["turnUpgrade"] = card.TurnUpgrade
			// Frontend expects `upgradeLevel` in some components — include alias for compatibility
			result["upgradeLevel"] = card.TurnUpgrade
		}
	} else if card.Type == game.PointCard {
		result["points"] = card.Points
		if card.Requirement != nil {
			result["requirement"] = map[string]int{
				"yellow": card.Requirement.Yellow,
				"green":  card.Requirement.Green,
				"blue":   card.Requirement.Blue,
				"pink":   card.Requirement.Pink,
			}
		}
	} else if card.Type == game.CoinCard {
		result["points"] = card.Points
		result["amount"] = card.Amount
	}

	// Serialize deposits - ALWAYS include deposits field, even if empty
	// Now supports stacking: each position can have multiple crystals
	if card.Deposits != nil {
		result["deposits"] = card.Deposits.ToMap()
	} else {
		// Always include deposits field, even if empty
		result["deposits"] = make(map[string]string)
	}

	return result
}

func serializeCardWithCost(card *game.Card, cost *game.Resources) map[string]interface{} {
	result := serializeCard(card)
	if cost != nil {
		result["cost"] = map[string]int{
			"yellow": cost.Yellow,
			"green":  cost.Green,
			"blue":   cost.Blue,
			"pink":   cost.Pink,
		}
	}
	return result
}

// Close gracefully closes the game session, disconnecting all players and spectators
func (gs *GameSession) Close() error {
	alreadyClosed := true
	gs.closeOnce.Do(func() { alreadyClosed = false })
	if alreadyClosed {
		return nil
	}

	gs.mu.Lock()
	defer gs.mu.Unlock()

	gs.logger.Info("Closing game session",
		zap.String("sessionID", gs.ID),
		zap.Int("players", len(gs.connectedPlayers)),
		zap.Int("spectators", len(gs.spectators)),
	)

	// Close all player connections
	for clientID, player := range gs.connectedPlayers {
		if player.Conn != nil {
			// Send close message
			closeMsg := websocket.FormatCloseMessage(websocket.CloseNormalClosure, "Server shutting down")
			player.Conn.WriteControl(websocket.CloseMessage, closeMsg, time.Now().Add(5*time.Second))
			player.Conn.Close()
		}
		// Signal goroutines to stop
		if player.Done != nil {
			close(player.Done)
		}
		// Close write channel if not already closed
		if player.WriteChan != nil {
			close(player.WriteChan)
		}
		gs.logger.Debug("Closed player connection",
			zap.String("clientID", clientID),
			zap.String("name", player.Name),
		)
	}

	// Close all spectator connections
	for spectatorID, spectator := range gs.spectators {
		if spectator.Conn != nil {
			closeMsg := websocket.FormatCloseMessage(websocket.CloseNormalClosure, "Server shutting down")
			spectator.Conn.WriteControl(websocket.CloseMessage, closeMsg, time.Now().Add(5*time.Second))
			spectator.Conn.Close()
		}
		// Signal goroutines to stop
		if spectator.Done != nil {
			close(spectator.Done)
		}
		// Close write channel if not already closed
		if spectator.WriteChan != nil {
			close(spectator.WriteChan)
		}
		gs.logger.Debug("Closed spectator connection",
			zap.String("spectatorID", spectatorID),
		)
	}

	// Clear all maps
	gs.connectedPlayers = make(map[string]*PlayerInfo)
	gs.assignedPlayers = make(map[int]string)
	gs.spectators = make(map[string]*Spectator)

	// Stop the game loop and any AI search. ActionChan stays open: closing it would make the loop
	// spin on zero values and make any in-flight sender panic.
	gs.cancel()
	close(gs.stop)

	gs.logger.Info("Game session closed successfully", zap.String("sessionID", gs.ID))
	return nil
}
