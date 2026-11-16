import React, { useState, useEffect } from "react";
import { createLogger } from '../utils/logger';
import { useAuth } from '../contexts/AuthContext';
import LoginButton from './LoginButton';
import { apiFetch } from "../utils/api";
import { showToast } from "../utils/toast";
import { CUSTOM, loadStoredPicture, resolveAvatar } from "../utils/customAvatar";
import StartShell from "./start/StartShell";
import Button from "./ui/Button";
import Field, { FieldLabel } from "./ui/Field";
import Segmented from "./ui/Segmented";
import AvatarPicker from "./ui/AvatarPicker";
import Pill from "./ui/Pill";

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
  try {
    const cachedName = localStorage.getItem("playerName");
    if (cachedName) return cachedName;
    const newName = generatePlayerName();
    localStorage.setItem("playerName", newName);
    return newName;
  } catch {
    return generatePlayerName();
  }
};

const PLAYER_COUNTS = [2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n}` }));

const Note = ({ tone = "neutral", children }) => {
  const cls = {
    neutral: "border-rock-400/40 bg-rock-950/40 text-fg-muted",
    ok: "border-moss/60 bg-moss/15 text-[rgb(200_235_190)]",
    err: "border-ember/60 bg-ember/15 text-[rgb(255_210_196)]",
  }[tone];
  return <div role="status" className={`rounded-stone-sm border px-3 py-2 text-sm ${cls}`}>{children}</div>;
};

const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    showToast("Room ID copied", "success");
  } catch {
    showToast("Could not copy — select the ID and copy it by hand", "error");
  }
};

const Lobby = ({ onJoinGame, onBack, initialRoomId = null }) => {
  const { user, isAuthenticated, loading: authLoading, authAvailable } = useAuth();
  const [playerName, setPlayerName] = useState(getInitialPlayerName);
  const [numPlayers, setNumPlayers] = useState(2);
  const [customSessionId, setCustomSessionId] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState(() => (loadStoredPicture() ? CUSTOM : "4"));
  const [sessionInfo, setSessionInfo] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(initialRoomId ? "join" : "create");
  const [joinId, setJoinId] = useState("");
  // Status of the room from a /room/:id link: null | "checking" | "open" | "gone"
  const [linkedRoomStatus, setLinkedRoomStatus] = useState(initialRoomId ? "checking" : null);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    if (!initialRoomId) return;
    let cancelled = false;
    apiFetch(`/admin/sessions/state?sessionId=${encodeURIComponent(initialRoomId)}`)
      .then((res) => {
        if (cancelled) return;
        setLinkedRoomStatus(res.ok ? "open" : "gone");
        if (res.ok) setJoinId(initialRoomId);
      })
      .catch(() => !cancelled && setLinkedRoomStatus("gone"));
    return () => {
      cancelled = true;
    };
  }, [initialRoomId]);

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
    if (!playerName) return;
    try { localStorage.setItem("playerName", playerName); } catch { /* not remembered */ }
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
        setAuthError(data.error || "Could not create the room. Please try again.");
      }
    } catch (error) {
      logger.error("Error creating game:", error);
      setAuthError("Failed to create game. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const joinGame = async (sessionId, asSpectator = false) => {
    if (authAvailable && !asSpectator && !isAuthenticated) {
      setAuthError("Please login to join a game as a player");
      logger.warn("User attempted to join game without authentication");
      return;
    }

    setAuthError(null);
    if (!sessionId) return;
    // For spectators, use a random name and no picture
    const name = asSpectator ? generatePlayerName() : playerName;
    let avatar = "4";
    if (!asSpectator) {
      try {
        avatar = await resolveAvatar(selectedAvatar); // own picture: upload it for this room
      } catch (error) {
        showToast(`Could not upload your picture: ${error.message}`, "error");
        return;
      }
    }
    onJoinGame(sessionId, name, avatar, asSpectator);
  };

  const tabs = [
    { id: "create", label: "Create Room" },
    { id: "join", label: `Join (${rooms.length})` },
  ];

  return (
    <StartShell
      title="Multiplayer"
      subtitle={activeTab === "create" ? "Create a room and share its ID" : "Pick a room or paste an ID"}
      onBack={onBack}
      width={activeTab === "join" ? "xl" : "lg"}
    >
      {/* Tabs */}
      <div role="tablist" aria-label="Multiplayer" className="grid grid-cols-2 gap-1.5 rounded-stone-sm bg-rock-950/50 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={activeTab === t.id}
            onClick={() => {
              setActiveTab(t.id);
              if (t.id === "join") fetchRooms();
            }}
            className={`min-h-[44px] rounded-stone-sm font-display text-sm font-bold transition-colors
              ${activeTab === t.id ? "bg-gradient-to-b from-bronze-300 to-bronze-500 text-ink shadow-bevel" : "text-fg-muted hover:bg-rock-700/60 hover:text-fg"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Auth (Google login is off on this server; kept for completeness) */}
      {authLoading ? (
        <Note>Loading authentication…</Note>
      ) : (authAvailable || authError) && (
        <div className="flex flex-col gap-2">
          {authAvailable && <LoginButton />}
          {authError && <Note tone="err">{authError}</Note>}
          {authAvailable && !isAuthenticated && (
            <Note>You need to login to create or join a game as a player. Spectators can watch without logging in.</Note>
          )}
        </div>
      )}

      <div className={activeTab === "join" ? "grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]" : "flex flex-col gap-5"}>
        {/* You */}
        <div className="flex flex-col gap-5">
          <Field
            id="mp-name"
            label="Your Name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your name"
            maxLength={24}
            autoComplete="nickname"
          />
          <AvatarPicker value={selectedAvatar} onChange={setSelectedAvatar} />

          {activeTab === "create" && (
            <>
              <Segmented
                name="numPlayers"
                label="Number of Players"
                value={numPlayers}
                onChange={(v) => setNumPlayers(parseInt(v, 10))}
                options={PLAYER_COUNTS}
                columns={4}
              />
              <Field
                id="mp-room-id"
                label="Custom Room ID (optional)"
                value={customSessionId}
                onChange={(e) => setCustomSessionId(e.target.value)}
                placeholder="Leave empty for an automatic ID"
              />
              <Button size="lg" onClick={createGame} disabled={loading} className="self-end">
                {loading ? "Creating…" : "Create Game"}
              </Button>
              {sessionInfo && (
                <Note tone="ok">
                  <div className="mb-2 font-semibold">Room created — share this ID:</div>
                  <div className="flex gap-2">
                    <input type="text" value={sessionInfo} readOnly aria-label="Room ID" className="h-11 min-w-0 flex-1 rounded-stone-sm border border-black/50 bg-rock-950/70 px-3 font-mono text-sm text-fg" />
                    <Button variant="secondary" onClick={() => copyText(sessionInfo)}>Copy</Button>
                  </div>
                </Note>
              )}
            </>
          )}
        </div>

        {/* Rooms (Join tab) */}
        {activeTab === "join" && (
          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <FieldLabel>Open Rooms</FieldLabel>
              <Button size="md" variant="ghost" onClick={fetchRooms}>Refresh</Button>
            </div>

            {rooms.length === 0 ? (
              <div className="surface-inset px-4 py-6 text-center">
                <p className="font-semibold">No open rooms right now.</p>
                <p className="mt-1 text-sm text-fg-muted">Create one and share its ID with friends.</p>
              </div>
            ) : (
              <ul className="surface-inset flex max-h-[44vh] flex-col divide-y divide-black/30 overflow-y-auto">
                {rooms.map((room) => {
                  const timeUntilDelete = room.timeUntilDelete || 0;
                  const minutes = Math.floor(timeUntilDelete / 60);
                  const seconds = timeUntilDelete % 60;
                  const isExpiringSoon = timeUntilDelete > 0 && timeUntilDelete < 60;
                  const isFull = room.connectedPlayers >= room.numPlayers;
                  return (
                    <li key={room.sessionID} className={`flex flex-wrap items-center gap-3 px-3 py-2.5 ${isExpiringSoon ? "bg-ember/10" : ""}`}>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="max-w-full truncate font-mono text-sm font-semibold" title={room.sessionID}>{room.sessionID}</span>
                          <Pill tone={isFull ? "neutral" : "moss"}>{room.connectedPlayers}/{room.numPlayers}</Pill>
                          {room.spectatorCount > 0 && <Pill tone="teal">{room.spectatorCount} watching</Pill>}
                          {timeUntilDelete > 0 && room.connectedPlayers === 0 && (
                            <Pill tone={isExpiringSoon ? "ember" : "bronze"} title="Empty rooms close automatically">
                              closes in {minutes}:{String(seconds).padStart(2, "0")}
                            </Pill>
                          )}
                        </div>
                        {room.players && room.players.length > 0 && (
                          <p className="mt-0.5 truncate text-xs text-fg-muted">{room.players.join(", ")}</p>
                        )}
                      </div>
                      <div className="flex flex-shrink-0 gap-1.5">
                        <Button size="md" variant="ghost" onClick={() => copyText(room.sessionID)} aria-label={`Copy room ID ${room.sessionID}`}>Copy</Button>
                        <Button size="md" variant="secondary" onClick={() => joinGame(room.sessionID, true)}>Watch</Button>
                        <Button size="md" onClick={() => joinGame(room.sessionID, false)} disabled={isFull}>Join</Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Join by ID */}
            {linkedRoomStatus === "checking" && <Note>Checking room <b>{initialRoomId}</b>…</Note>}
            {linkedRoomStatus === "open" && <Note tone="ok">Room <b>{initialRoomId}</b> is still open — press Join to enter (or re-enter) it.</Note>}
            {linkedRoomStatus === "gone" && (
              <Note tone="err">
                Room <b>{initialRoomId}</b> no longer exists. Rooms close automatically when nobody has been connected for a
                while — create a new room or pick an open one.
              </Note>
            )}
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (joinId.trim()) joinGame(joinId.trim());
              }}
            >
              <Field
                id="mp-join-id"
                label="Or join by Room ID"
                value={joinId}
                onChange={(e) => setJoinId(e.target.value)}
                placeholder="Paste a room ID"
                className="min-w-0 flex-1"
                mono
              />
              <Button type="submit" disabled={!joinId.trim()}>Join</Button>
            </form>
          </div>
        )}
      </div>
    </StartShell>
  );
};

export default Lobby;
