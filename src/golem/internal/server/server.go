package server

import (
	"net/http"
	"sync"
	"time"

	"golem_century/internal/ai"
	"golem_century/internal/auth"
	"golem_century/internal/config"
	"golem_century/internal/eventstore"
	"golem_century/internal/logger"
	"golem_century/internal/session"
	"golem_century/internal/telegram"

	"github.com/gorilla/websocket"
	"go.uber.org/zap"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for local play
	},
}

// GameServer manages multiple game sessions
type GameServer struct {
	SessionsV2       map[string]*session.GameSession
	EventStore       eventstore.EventStore
	Logger           *logger.Logger
	TelegramNotifier *telegram.Notifier
	FirebaseAuth     *auth.FirebaseAuth
	mu               sync.RWMutex
	config           *config.Config
	cleanupInterval  time.Duration // how often each room checks whether it is idle (30s; tests shorten it)
	aiRuntime        *ai.Runtime   // server-wide AI thread pool and budgets, shared by all rooms
	aiPauseWhenEmpty bool
	aiIntents        bool // send "AI intent" messages to humans (AI_INTENT_MESSAGES, default off)
}

// NewGameServerRequest represents request to create a new game server
type NewGameServerRequest struct {
	EventStore   eventstore.EventStore
	Logger       *logger.Logger
	Config       *config.Config
	FirebaseAuth *auth.FirebaseAuth
}

// NewGameServer creates a new game server
func NewGameServer(req NewGameServerRequest) *GameServer {
	log := req.Logger
	if log == nil {
		log = logger.NewNopLogger()
	}
	if req.Config == nil {
		cfg := config.LoadConfig()
		req.Config = &cfg
	}
	telegramNotifier := telegram.NewNotifier(req.Config.TelegramBotToken, req.Config.TelegramChatID, log)
	return &GameServer{
		SessionsV2:       make(map[string]*session.GameSession),
		EventStore:       req.EventStore,
		Logger:           log,
		TelegramNotifier: telegramNotifier,
		FirebaseAuth:     req.FirebaseAuth,
		config:           req.Config,
		cleanupInterval:  30 * time.Second,
		aiRuntime:        newAIRuntime(req.Config),
		aiPauseWhenEmpty: req.Config.AIPauseWhenEmpty,
		aiIntents:        req.Config.AIIntentMessages,
	}
}

// newAIRuntime builds the shared AI runtime from config (zero values fall back to defaults).
func newAIRuntime(cfg *config.Config) *ai.Runtime {
	rt := &ai.Runtime{
		Sched:    ai.NewScheduler(cfg.AIMaxThreads),
		ScalePct: cfg.AIThinkScalePct,
		MaxNodes: cfg.AIMaxNodes,
		MinDelay: time.Duration(cfg.AIMinDelayMs) * time.Millisecond,
	}
	if rt.ScalePct == 0 {
		rt.ScalePct = 100
	}
	return rt
}

func (gs *GameServer) CreateSessionV2(sessionID string, maxPlayers int, turnTimeoutInSeconds int) *session.GameSession {
	return gs.createSession(sessionID, maxPlayers, turnTimeoutInSeconds)
}

// CreateSinglePlayerSession creates a single-player room: one human plus one AI per level.
func (gs *GameServer) CreateSinglePlayerSession(sessionID string, levels []ai.Level, turnTimeoutInSeconds int) *session.GameSession {
	return gs.createSession(sessionID, 1+len(levels), turnTimeoutInSeconds, session.WithSinglePlayer(levels))
}

func (gs *GameServer) createSession(sessionID string, maxPlayers int, turnTimeoutInSeconds int, opts ...session.Option) *session.GameSession {
	gs.mu.Lock()
	defer gs.mu.Unlock()

	session := session.NewGameSession(sessionID, maxPlayers, turnTimeoutInSeconds, gs.EventStore, gs.Logger)
	session.ApplyOptions(append([]sessionOption{sessionWithAI(gs), sessionIntents(gs)}, opts...)...)
	gs.SessionsV2[sessionID] = session

	gs.Logger.Info("Session V2 created",
		zap.String("sessionID", sessionID),
		zap.Int("maxPlayers", maxPlayers),
		zap.Int("turnTimeoutInSeconds", turnTimeoutInSeconds),
	)

	// Start cleanup timer for empty rooms
	go gs.startCleanupTimerV2(sessionID)

	return session
}

// startCleanupTimerV2 deletes a room once nobody has had an open connection to it for the idle limit of its
// status (see idleLimit). "Connected" means an open WebSocket: players who drop out of a started game keep their
// seat (Conn == nil) for reconnection, which used to keep abandoned games — still being auto-played by the AI on
// turn timeouts — in memory forever.
func (gs *GameServer) startCleanupTimerV2(sessionID string) {
	ticker := time.NewTicker(gs.cleanupInterval)
	defer ticker.Stop()

	lastConnected := time.Now()
	for range ticker.C {
		s, exists := gs.GetSessionV2(sessionID)
		if !exists {
			return // Session already deleted
		}

		if s.GetActivelyConnectedPlayersCount()+s.GetConnectedSpectatorsCount() > 0 {
			lastConnected = time.Now()
			continue
		}
		status := s.GetStatus()
		idle := time.Since(lastConnected)
		if idle < gs.idleLimit(status) {
			continue
		}

		gs.mu.Lock()
		delete(gs.SessionsV2, sessionID)
		remaining := len(gs.SessionsV2)
		gs.mu.Unlock()
		if err := s.Close(); err != nil {
			gs.Logger.Error("Error closing idle session", zap.String("sessionID", sessionID), zap.Error(err))
		}
		gs.Logger.Info("Removed idle session",
			zap.String("sessionID", sessionID),
			zap.String("status", string(status)),
			zap.Duration("idle", idle.Round(time.Second)),
			zap.Int("remainingSessions", remaining),
		)
		return
	}
}

// idleLimit is how long a room may have no open connections before it is deleted.
func (gs *GameServer) idleLimit(status session.GameStatus) time.Duration {
	seconds := func(v, def int) time.Duration {
		if v <= 0 {
			v = def
		}
		return time.Duration(v) * time.Second
	}
	cfg := gs.config
	if cfg == nil {
		cfg = &config.Config{}
	}
	switch status {
	case session.GameStatusPlaying:
		return seconds(cfg.SessionIdlePlayingSeconds, 600)
	case session.GameStatusEnded:
		return seconds(cfg.SessionIdleEndedSeconds, 120)
	default:
		return seconds(cfg.SessionIdleWaitingSeconds, 300)
	}
}

// atSessionLimit reports whether creating another room would exceed MaxSessions (0 = unlimited).
func (gs *GameServer) atSessionLimit() bool {
	if gs.config == nil || gs.config.MaxSessions <= 0 {
		return false
	}
	gs.mu.RLock()
	defer gs.mu.RUnlock()
	return len(gs.SessionsV2) >= gs.config.MaxSessions
}

func (gs *GameServer) GetSessionV2(sessionID string) (*session.GameSession, bool) {
	gs.mu.RLock()
	defer gs.mu.RUnlock()
	session, ok := gs.SessionsV2[sessionID]
	return session, ok
}

func (gs *GameServer) checkSessionExists(sessionID string) bool {
	gs.mu.RLock()
	defer gs.mu.RUnlock()
	if _, ok := gs.SessionsV2[sessionID]; ok {
		return true
	}
	return false
}

// Shutdown gracefully shuts down the game server, closing all sessions and connections
func (gs *GameServer) Shutdown() error {
	gs.Logger.Info("Starting graceful shutdown of game server")

	gs.mu.Lock()
	defer gs.mu.Unlock()

	// Close all V2 sessions
	for sessionID, session := range gs.SessionsV2 {
		gs.Logger.Info("Closing V2 session", zap.String("sessionID", sessionID))
		if err := session.Close(); err != nil {
			gs.Logger.Error("Error closing V2 session",
				zap.String("sessionID", sessionID),
				zap.Error(err),
			)
		}
	}

	// Clear session map
	gs.SessionsV2 = make(map[string]*session.GameSession)

	gs.Logger.Info("Game server shutdown complete")
	return nil
}

type sessionOption = session.Option

func sessionWithAI(gs *GameServer) session.Option {
	return session.WithAIRuntime(gs.aiRuntime, gs.aiPauseWhenEmpty)
}

func sessionIntents(gs *GameServer) session.Option { return session.WithAIIntents(gs.aiIntents) }

// isLiveGame reports whether a game is still being played in memory (deck order must stay hidden).
func (gs *GameServer) isLiveGame(gameID string) bool {
	s, ok := gs.GetSessionV2(gameID)
	return ok && s.GetStatus() == session.GameStatusPlaying
}
