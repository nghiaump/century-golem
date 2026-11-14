package config

import (
	"os"
	"strconv"
)

// Config holds application configuration
type Config struct {
	ServerHost                  string
	ServerPort                  string
	MongoURI                    string
	MongoDB                     string
	MongoEventsColl             string
	MongoSnapshotsColl          string
	RedisAddr                   string
	RedisDB                     int
	LogLevel                    string
	LogFormat                   string
	DefaultTurnTimeoutInSeconds int
	MaxChatMessages             int
	TelegramBotToken            string
	TelegramChatID              string
	WebSocketPingInterval       int // Interval in seconds for WebSocket ping messages (default 15s)
	WebSocketReadTimeout        int // Timeout in seconds for WebSocket read operations (default 60s)
	WebSocketWriteTimeout       int // Timeout in seconds for WebSocket write operations (default 10s)

	// Room cleanup: a room is deleted once nobody has had an open connection to it for this long.
	SessionIdleWaitingSeconds int // waiting room, not started (default 300)
	SessionIdlePlayingSeconds int // started game; disconnected players keep their seat until then (default 600)
	SessionIdleEndedSeconds   int // finished game (default 120)
	MaxSessions               int // cap on rooms in memory; creating more returns 503 (default 100, 0 = unlimited)

	// Computer opponents (see docs/ai/README.md).
	AIMaxThreads     int  // server-wide cap on AI search threads (default 0 = auto: min(4, NumCPU/2))
	AIThinkScalePct  int  // multiplies every AI think budget, in percent (default 100, clamped 10..300)
	AIMinDelayMs     int  // minimum visible thinking time per AI move (default 800)
	AIMaxNodes       int  // node cap per search tree (default 200000)
	AIPauseWhenEmpty bool // no AI moves while nobody is connected to the room (default true)
	AIIntentMessages bool // send "AI intent" toasts ("AI 2 took the golem you were going for") (default false)

	// Firebase authentication
	FirebaseCredentialsFile string // Path to Firebase service account JSON
	GoogleOAuthClientID     string // Google OAuth client ID
	GoogleOAuthClientSecret string // Google OAuth client secret
	GoogleOAuthRedirectURL  string // OAuth redirect URL
	SessionCookieDomain     string // Domain for session cookies (e.g., ".anhtran.dev" for SSO)
}

// LoadConfig loads configuration from environment variables with defaults
func LoadConfig() Config {
	return Config{
		ServerHost:                  getEnv("SERVER_HOST", "0.0.0.0"),
		ServerPort:                  getEnv("SERVER_PORT", "8080"),
		MongoURI:                    getEnv("MONGO_URI", "mongodb://localhost:27017"),
		MongoDB:                     getEnv("MONGO_DB", "golem_game"),
		MongoEventsColl:             getEnv("MONGO_EVENTS_COLL", "game_events"),
		MongoSnapshotsColl:          getEnv("MONGO_SNAPSHOTS_COLL", "game_snapshots"),
		RedisAddr:                   getEnv("REDIS_ADDR", "localhost:6379"),
		RedisDB:                     getEnvInt("REDIS_DB", 0),
		LogLevel:                    getEnv("LOG_LEVEL", "info"),
		LogFormat:                   getEnv("LOG_FORMAT", "json"),
		DefaultTurnTimeoutInSeconds: getEnvInt("DEFAULT_TURN_TIMEOUT_SECONDS", 60),
		MaxChatMessages:             getEnvInt("MAX_CHAT_MESSAGES", 10),
		TelegramBotToken:            getEnv("TELEGRAM_BOT_TOKEN", ""),
		TelegramChatID:              getEnv("TELEGRAM_CHAT_ID", ""),
		WebSocketPingInterval:       getEnvInt("WEBSOCKET_PING_INTERVAL", 15),
		WebSocketReadTimeout:        getEnvInt("WEBSOCKET_READ_TIMEOUT", 60),
		WebSocketWriteTimeout:       getEnvInt("WEBSOCKET_WRITE_TIMEOUT", 10),

		SessionIdleWaitingSeconds: getEnvInt("SESSION_IDLE_WAITING_SECONDS", 300),
		SessionIdlePlayingSeconds: getEnvInt("SESSION_IDLE_PLAYING_SECONDS", 600),
		SessionIdleEndedSeconds:   getEnvInt("SESSION_IDLE_ENDED_SECONDS", 120),
		MaxSessions:               getEnvInt("MAX_SESSIONS", 100),

		AIMaxThreads:     getEnvInt("AI_MAX_THREADS", 0),
		AIThinkScalePct:  clamp(getEnvInt("AI_THINK_SCALE_PCT", 100), 10, 300),
		AIMinDelayMs:     clamp(getEnvInt("AI_MIN_DELAY_MS", 800), 0, 10000),
		AIMaxNodes:       getEnvInt("AI_MAX_NODES", 200000),
		AIPauseWhenEmpty: getEnvInt("AI_PAUSE_WHEN_EMPTY", 1) != 0,
		AIIntentMessages: getEnvInt("AI_INTENT_MESSAGES", 0) != 0,

		// Firebase authentication
		FirebaseCredentialsFile: getEnv("FIREBASE_CREDENTIALS_FILE", ""),
		GoogleOAuthClientID:     getEnv("GOOGLE_OAUTH_CLIENT_ID", ""),
		GoogleOAuthClientSecret: getEnv("GOOGLE_OAUTH_CLIENT_SECRET", ""),
		GoogleOAuthRedirectURL:  getEnv("GOOGLE_OAUTH_REDIRECT_URL", ""),
		SessionCookieDomain:     getEnv("SESSION_COOKIE_DOMAIN", ""),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func clamp(v, lo, hi int) int {
	return max(lo, min(hi, v))
}
