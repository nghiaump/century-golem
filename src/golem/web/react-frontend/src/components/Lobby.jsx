import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createLogger } from '../utils/logger';
import { useAuth } from '../contexts/AuthContext';
import LoginButton from './LoginButton';
import useGameStore from "../store/gameStore";
import useOrientation from "../hooks/useOrientation";
import { apiFetch } from "../utils/api";
import { AVATAR_IDS, avatarSrc } from "../utils/avatar";
import XpWindow from "./XpWindow";

const logger = createLogger('Lobby');

// Generate a random player name
const generatePlayerName = () => {
  const adjectives = ["Swift", "Bold", "Clever", "Brave", "Wise", "Noble", "Mighty", "Bright", "Fierce", "Calm"];
  const nouns = ["Golem", "Warrior", "Mage", "Explorer", "Guardian", "Seeker", "Champion", "Hero", "Sage", "Knight"];
  const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
  const randomNum = Math.floor(Math.random() * 1000);
  return `${randomAdjective} ${randomNoun} ${randomNum}`;
};

// Load player name from localStorage or generate a new one
const getInitialPlayerName = () => {
  const cachedName = localStorage.getItem("playerName");
  if (cachedName) {
    return cachedName;
  }
  const newName = generatePlayerName();
  localStorage.setItem("playerName", newName);
  return newName;
};

const Lobby = ({ onJoinGame, onBack, initialRoomId = null }) => {
  const { user, isAuthenticated, loading: authLoading, authAvailable } = useAuth();
  const [playerName, setPlayerName] = useState(getInitialPlayerName);
  const [numPlayers, setNumPlayers] = useState(2);
  const [customSessionId, setCustomSessionId] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState("4");
  const [sessionInfo, setSessionInfo] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(initialRoomId ? "join" : "create");
  // Status of the room from a /room/:id link: null | "checking" | "open" | "gone"
  const [linkedRoomStatus, setLinkedRoomStatus] = useState(initialRoomId ? "checking" : null);

  useEffect(() => {
    if (!initialRoomId) return;
    let cancelled = false;
    apiFetch(`/admin/sessions/state?sessionId=${encodeURIComponent(initialRoomId)}`)
      .then((res) => !cancelled && setLinkedRoomStatus(res.ok ? "open" : "gone"))
      .catch(() => !cancelled && setLinkedRoomStatus("gone"));
    return () => {
      cancelled = true;
    };
  }, [initialRoomId]);
  const [authError, setAuthError] = useState(null);
  const { isMobile, isTablet, isPortrait, isLandscape } = useOrientation();

  // Auto-populate player name from user profile
  useEffect(() => {
    if (user?.display_name && !playerName) {
      setPlayerName(user.display_name);
    }
  }, [user]);

  // Fetch available rooms
  const fetchRooms = async () => {
    try {
      const response = await apiFetch("/api/list");
      const data = await response.json();
      if (response.ok) {
        setRooms(data.sessions || []);
      }
    } catch (error) {
      logger.error("Error fetching rooms:", error);
    }
  };

  // Cache playerName to localStorage whenever it changes
  useEffect(() => {
    if (playerName) {
      localStorage.setItem("playerName", playerName);
    }
  }, [playerName]);

  // Auto-refresh rooms list
  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 2000);
    return () => clearInterval(interval);
  }, []);

  // Update countdown timers every second
  useEffect(() => {
    const timer = setInterval(() => {
      setRooms((prevRooms) =>
        prevRooms.map((room) => {
          if (room.timeUntilDelete > 0 && room.connectedPlayers === 0) {
            return { ...room, timeUntilDelete: Math.max(0, room.timeUntilDelete - 1) };
          }
          return room;
        })
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const createGame = async () => {
    if (authAvailable && !isAuthenticated) {
      setAuthError("Please login to create a game");
      logger.warn("User attempted to create game without authentication");
      return;
    }

    setLoading(true);
    setAuthError(null);
    try {
      const response = await apiFetch("/api/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          numPlayers,
          seed: Date.now(),
          sessionID: customSessionId || undefined,
          creatorName: playerName,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setSessionInfo(data.sessionID);
        setTimeout(() => {
          fetchRooms();
          setActiveTab("join");
        }, 500);
      } else if (response.status === 401) {
        setAuthError("Authentication required. Please login to create a game.");
        logger.warn("Authentication required for game creation");
      } else {
        logger.error("Error creating game:", data);
      }
    } catch (error) {
      logger.error("Error creating game:", error);
      setAuthError("Failed to create game. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const joinGame = (sessionId, asSpectator = false) => {
    if (authAvailable && !asSpectator && !isAuthenticated) {
      setAuthError("Please login to join a game as a player");
      logger.warn("User attempted to join game without authentication");
      return;
    }

    setAuthError(null);
    if (sessionId) {
      // For spectators, use a random name
      const name = asSpectator ? generatePlayerName() : playerName;
      onJoinGame(sessionId, name, selectedAvatar, asSpectator);
    }
  };

  const copySessionId = (sessionId) => {
    navigator.clipboard.writeText(sessionId);
  };

  // Responsive layout helpers
  const isMobileLayout = isMobile && isPortrait;
  const isCompactLayout = isMobile || (isTablet && isPortrait);
  // Two columns only where there is a second column to show (the room list on the Join tab).
  const twoColumns = activeTab === "join" && !isCompactLayout;

  // Debug: log layout mode
  logger.debug("Layout:", { isMobile, isTablet, isPortrait, isMobileLayout, isCompactLayout });

  return (
    <div className="xp-desktop safe-top safe-bottom">
      <XpWindow
        title="Multiplayer — Century: Golem Edition"
        icon={avatarSrc(selectedAvatar)}
        onClose={onBack}
        className={twoColumns ? "max-w-4xl" : "max-w-xl"}
        status={
          <>
            <span>{activeTab === "create" ? "Create a room and share its ID" : "Pick a room or paste an ID"}</span>
            <span>{rooms.length} room(s) open</span>
          </>
        }
      >
        {/* Tabs */}
        <div className="xp-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={activeTab === "create"} className="xp-tab" onClick={() => setActiveTab("create")}>
            Create Room
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "join"}
            className="xp-tab"
            onClick={() => {
              setActiveTab("join");
              fetchRooms();
            }}
          >
            Join ({rooms.length})
          </button>
        </div>

        {/* Content - Single column on mobile, two columns on desktop */}
        <div className={twoColumns ? "grid grid-cols-2 gap-6" : "xp-stack"}>
          {/* Auth Status Section */}
          {authLoading ? (
            <div className="col-span-full xp-muted">Loading authentication...</div>
          ) : (
            (authAvailable || authError) && (
              <div className="col-span-full xp-stack">
                {authAvailable && <LoginButton />}
                {authError && <div className="xp-note xp-note--err">{authError}</div>}
                {authAvailable && !isAuthenticated && (
                  <div className="xp-note">
                    <p className="font-bold mb-1">Login Required</p>
                    <p>You need to login to create or join a game as a player. Spectators can view games without logging in.</p>
                  </div>
                )}
              </div>
            )
          )}

          {/* Left Column - Player Info (Always visible) */}
          <div className="xp-stack">
            {/* Player Name */}
            <div>
              <label className="xp-field-label" htmlFor="mp-name">Your Name</label>
              <input
                id="mp-name"
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="xp-input"
                placeholder="Enter your name"
              />
            </div>

            {/* Avatar Selection */}
            <div>
              <span className="xp-field-label">Choose Your Character</span>
              <div className="xp-avatar-grid">
                {AVATAR_IDS.map((num) => (
                  <button
                    type="button"
                    key={num}
                    onClick={() => setSelectedAvatar(num.toString())}
                    className="xp-avatar"
                    aria-pressed={selectedAvatar === num.toString()}
                    aria-label={`Avatar ${num}`}
                  >
                    <img
                      src={avatarSrc(num)}
                      alt=""
                      onError={(e) => {
                        e.target.src = avatarSrc(1);
                      }}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Create Game Section */}
            {activeTab === "create" && (
              <>
                {/* Number of Players */}
                <div>
                  <label className="xp-field-label" htmlFor="mp-players">Number of Players</label>
                  <select
                    id="mp-players"
                    value={numPlayers}
                    onChange={(e) => setNumPlayers(parseInt(e.target.value))}
                    className="xp-select"
                  >
                    <option value={2}>2 Players</option>
                    <option value={3}>3 Players</option>
                    <option value={4}>4 Players</option>
                    <option value={5}>5 Players</option>
                  </select>
                </div>

                {/* Custom Session ID */}
                <div>
                  <label className="xp-field-label" htmlFor="mp-room-id">Custom Room ID (optional)</label>
                  <input
                    id="mp-room-id"
                    type="text"
                    value={customSessionId}
                    onChange={(e) => setCustomSessionId(e.target.value)}
                    className="xp-input"
                    placeholder="Leave empty for auto-generated"
                  />
                </div>

                {/* Create Button */}
                <div className="xp-actions justify-end">
                  <button type="button" className="xp-btn" onClick={onBack}>
                    Back
                  </button>
                  <button type="button" onClick={createGame} disabled={loading} className="xp-btn xp-btn--go xp-btn--lg touch-target">
                    {loading ? "Creating..." : "Create Game ›"}
                  </button>
                </div>

                {/* Session Info */}
                {sessionInfo && (
                  <div className="xp-note xp-note--ok">
                    <p className="font-bold mb-1">Game Created!</p>
                    <p className="mb-2">Share this Room ID:</p>
                    <div className="flex gap-2">
                      <input type="text" value={sessionInfo} readOnly className="xp-input xp-input--mono flex-1" />
                      <button type="button" onClick={() => copySessionId(sessionInfo)} className="xp-btn">
                        Copy
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right Column - Available Rooms (Join tab) */}
          {activeTab === "join" && (
            <div className="xp-stack">
              <div className="flex items-center justify-between">
                <span className="xp-field-label" style={{ marginBottom: 0 }}>Available Rooms</span>
                <button type="button" onClick={fetchRooms} className="xp-btn xp-btn--sm">
                  ↻ Refresh
                </button>
              </div>

              {rooms.length === 0 ? (
                <div className="xp-listview xp-empty">
                  <p>No rooms available.</p>
                  <p className="xp-muted mt-1">Create a new room to get started!</p>
                </div>
              ) : (
                <div className="xp-listview" style={{ maxHeight: isMobileLayout ? "40vh" : undefined }}>
                  {rooms.map((room) => {
                    const timeUntilDelete = room.timeUntilDelete || 0;
                    const minutes = Math.floor(timeUntilDelete / 60);
                    const seconds = timeUntilDelete % 60;
                    const isExpiringSoon = timeUntilDelete > 0 && timeUntilDelete < 60;
                    const isFull = room.connectedPlayers >= room.numPlayers;

                    return (
                      <div key={room.sessionID} className={`xp-row ${isExpiringSoon ? "xp-row--expiring" : ""}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            <span className="font-bold truncate text-xs sm:text-sm" style={{ maxWidth: isMobileLayout ? 120 : undefined }}>
                              {room.sessionID.length > (isMobileLayout ? 15 : 20)
                                ? room.sessionID.substring(0, isMobileLayout ? 15 : 20) + "..."
                                : room.sessionID}
                            </span>
                            <span className="xp-badge xp-badge--green">
                              {room.connectedPlayers}/{room.numPlayers}
                            </span>
                            {room.spectatorCount > 0 && <span className="xp-badge xp-badge--blue">👁 {room.spectatorCount}</span>}
                            {timeUntilDelete > 0 && room.connectedPlayers === 0 && (
                              <span className={`xp-badge ${isExpiringSoon ? "xp-badge--red" : "xp-badge--orange"}`}>
                                ⏱ {minutes}:{String(seconds).padStart(2, "0")}
                              </span>
                            )}
                          </div>
                          {room.players && room.players.length > 0 && (
                            <p className="xp-muted truncate">Players: {room.players.join(", ")}</p>
                          )}
                        </div>

                        <div className="flex gap-1.5 flex-shrink-0">
                          <button type="button" onClick={() => copySessionId(room.sessionID)} className="xp-btn xp-btn--sm" title="Copy Session ID">
                            Copy
                          </button>
                          <button type="button" onClick={() => joinGame(room.sessionID, true)} className="xp-btn xp-btn--sm" title="Watch as spectator">
                            Watch
                          </button>
                          <button
                            type="button"
                            onClick={() => joinGame(room.sessionID, false)}
                            disabled={isFull}
                            className="xp-btn xp-btn--sm xp-btn--go touch-target"
                          >
                            Join
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Manual Join by Session ID */}
              <div>
                {linkedRoomStatus && (
                  <div
                    className={`xp-note mb-3 ${linkedRoomStatus === "open" ? "xp-note--ok" : linkedRoomStatus === "gone" ? "xp-note--err" : ""}`}
                    role="status"
                  >
                    {linkedRoomStatus === "checking" && <>Checking room <b>{initialRoomId}</b>...</>}
                    {linkedRoomStatus === "open" && <>Room <b>{initialRoomId}</b> is still open — press Join to enter (or re-enter) it.</>}
                    {linkedRoomStatus === "gone" && (
                      <>
                        Room <b>{initialRoomId}</b> no longer exists. Rooms close automatically when nobody has been
                        connected for a while — create a new room or pick an open one.
                      </>
                    )}
                  </div>
                )}
                <label className="xp-field-label" htmlFor="mp-join-id">Or join by Room ID</label>
                <div className="flex gap-2">
                  <input
                    id="mp-join-id"
                    type="text"
                    defaultValue={linkedRoomStatus === "open" ? initialRoomId : ""}
                    key={linkedRoomStatus || "none"}
                    placeholder="Paste room ID here"
                    onKeyPress={(e) => {
                      if (e.key === "Enter" && e.target.value) {
                        joinGame(e.target.value);
                      }
                    }}
                    className="xp-input flex-1"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      const input = e.currentTarget.previousElementSibling;
                      if (input.value) {
                        joinGame(input.value);
                      }
                    }}
                    className="xp-btn xp-btn--go touch-target"
                  >
                    Join
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </XpWindow>
    </div>
  );
};

export default Lobby;
