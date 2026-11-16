import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import SinglePlayerLobby from './components/SinglePlayerLobby'
import Lobby from './components/Lobby'
import PlayersInfoBar from './components/PlayersInfoBar'
import CompactGameBoard from './components/mobile/CompactGameBoard'
import CompactPlayerHand from './components/mobile/CompactPlayerHand'
import DiscardModal from './components/DiscardModal'
import RestPopup from './components/RestPopup'
import GameOverModal from './components/GameOverModal'
import Toast from './components/Toast'
import ModeMenu from './components/start/ModeMenu'
import ConnectionDialog from './components/start/ConnectionDialog'
import ReconnectBanner from './components/start/ReconnectBanner'
import NightBackdrop from './components/ui/NightBackdrop'
import { apiFetch } from './utils/api'
import { showToast } from './utils/toast'
import WebGameLayout from './components/desktop/WebGameLayout'
import Hud from './components/board/Hud'
import FantasyGameLayout from './components/desktop/FantasyGameLayout'
import useGameStore from './store/gameStore'
import useOrientation from './hooks/useOrientation'
import useGameSounds from './hooks/useGameSounds'
import { MobileLayoutProvider } from './contexts/MobileLayoutContext'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'

// Game Content with Theme Support
function GameContentWithTheme({ useWebLayout, isMobile, isPortrait, sessionId, onNewGame, onBackToMenu }) {
  const { isFantasy } = useTheme()
  
  // Initialize game sounds hook
  useGameSounds()

  // Upstream reloaded the page here; with the URL still at /room/<id> the reload opened the
  // multiplayer Join screen. The parent now restarts / exits in place.
  const handleNewGame = onNewGame
  const handleBackToMenu = onBackToMenu

  // ✨ table layout: desktop only (phones and short landscape screens always get the compact board)
  if (isFantasy && useWebLayout) {
    return (
      <>
        <Hud sessionId={sessionId} showSkinToggle showRound={false} />
        <FantasyGameLayout
          onNewGame={handleNewGame}
          onBackToMenu={handleBackToMenu}
        />
        <RestPopup />
        <Toast />
      </>
    )
  }

  // Standard layout
  return (
    <>
      {/* Round · difficulty (left), ✨ · sound · activity (right) */}
      <Hud sessionId={sessionId} showSkinToggle={useWebLayout} compact={!useWebLayout} />

      {/* "<opponent> rested" popup */}
      <RestPopup />

      {/* Night mountains behind the board */}
      <NightBackdrop />

      {useWebLayout ? (
        /* Desktop/Tablet - WebGameLayout */
        <div className="h-screen h-[100dvh] relative z-10">
          <WebGameLayout />

          {/* Discard Modal (when crystals exceed max) */}
          <DiscardModal />
        </div>
      ) : (
        /* Phones (and phones held sideways): compact board */
        isPortrait ? (
          <div className="relative z-board flex h-screen h-[100dvh] flex-col overflow-hidden" style={{ paddingTop: 'calc(max(8px, var(--safe-top)) + 52px)' }}>
            <PlayersInfoBar />
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <CompactGameBoard />
            </div>
            <CompactPlayerHand />
            <DiscardModal />
          </div>
        ) : (
          <div
            className="relative z-board grid h-screen h-[100dvh] grid-cols-[minmax(0,1fr)_minmax(280px,34%)] gap-2 overflow-hidden"
            style={{ paddingTop: 'calc(max(8px, var(--safe-top)) + 52px)', paddingLeft: 'var(--safe-left)', paddingRight: 'max(8px, var(--safe-right))' }}
          >
            <div className="min-h-0 overflow-y-auto overscroll-contain">
              <CompactGameBoard landscape />
            </div>
            <div className="flex min-h-0 flex-col gap-1 pb-1">
              <PlayersInfoBar compact />
              <div className="min-h-0 flex-1"><CompactPlayerHand landscape /></div>
            </div>
            <DiscardModal />
          </div>
        )
      )}

      {/* Game Over Modal */}
      <GameOverModal 
        onNewGame={handleNewGame}
        onBackToMenu={handleBackToMenu}
      />
      
      {/* Global Toast Notifications */}
      <Toast />
    </>
  )
}

function SinglePlayerApp() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const [gameMode, setGameMode] = useState(null) // null, 'single', 'multi'
  const [inGame, setInGame] = useState(false)
  const [pendingRoomId, setPendingRoomId] = useState(null) // room from a /room/:id link opened without a live connection
  const { 
    connectWebSocket, 
    gameState, 
    connected, 
    sessionId,
    isConnecting,
    connectionError,
    isReconnecting,
    reconnectAttempts,
    forceReconnect,
    playerName: storedPlayerName,
    playerAvatar: storedPlayerAvatar,
    isSpectator,
  } = useGameStore()
  const { isPortrait, isCompact } = useOrientation()

  // While disconnected the board is inert (no clicks, no focus). React 18 has no `inert` prop.
  const boardRef = useRef(null)
  useEffect(() => {
    const el = boardRef.current
    if (!el) return
    if (!connected) el.setAttribute('inert', '')
    else el.removeAttribute('inert')
  }, [connected, gameState])

  // Opening /room/:roomId directly (page reload, invite link, old link) has no live connection yet. Upstream jumped
  // straight to the in-game screen without ever connecting, so it hung on "Connecting..." forever. Instead, open the
  // multiplayer lobby on the Join tab with the room prefilled; it checks whether the room still exists.
  // The room we just left on purpose (Back to Menu / Play Again): while the URL still says
  // /room/<id> for one more render, it must not be mistaken for an invite link.
  const leftRoomRef = useRef(null)

  useEffect(() => {
    if (roomId && roomId === leftRoomRef.current) return
    if (roomId && !inGame && !isConnecting) {
      setPendingRoomId(roomId)
      setGameMode('multi')
      navigate('/', { replace: true })
    }
  }, [roomId, inGame, isConnecting])

  const handleStartSinglePlayer = (sessionId, playerName, playerAvatar) => {
    connectWebSocket(sessionId, playerName, playerAvatar)
    setGameMode('single')
    setInGame(true)
    navigate(`/room/${sessionId}`)
  }

  const handleJoinMultiplayer = (sessionId, playerName, playerAvatar, asSpectator) => {
    connectWebSocket(sessionId, playerName, playerAvatar, asSpectator)
    setGameMode('multi')
    setInGame(true)
    navigate(`/room/${sessionId}`)
  }

  const handleBackToMenu = () => {
    setPendingRoomId(null)
    setGameMode(null)
    setInGame(false)
    navigate('/')
  }

  const leaveGame = useGameStore((s) => s.leaveGame)

  // Game over → "Back to Menu": leave the room and show the main menu (no page reload).
  const handleExitToMenu = () => {
    leftRoomRef.current = roomId || null
    leaveGame()
    handleBackToMenu()
  }

  // Game over → "Play Again". Single player: a new game with the same opponents (count and level),
  // name and avatar, straight into the waiting room. Multiplayer: back to the multiplayer lobby.
  const handlePlayAgain = async () => {
    leftRoomRef.current = roomId || null
    const st = useGameStore.getState()
    const finished = st.gameState
    const name = st.myPlayer?.name || st.playerName || 'Player 1'
    const avatar = String(st.myPlayer?.avatar || st.playerAvatar || '4')
    if (finished?.mode !== 'single') {
      leaveGame()
      setPendingRoomId(null)
      setInGame(false)
      setGameMode('multi')
      navigate('/')
      return
    }
    const ais = (finished.players || []).filter((p) => p.isAI)
    const body = { numAI: Math.min(4, Math.max(1, ais.length || 1)), seed: Date.now() }
    const levels = ais.map((p) => p.aiLevel).filter(Boolean)
    if (levels.length === ais.length && levels.length > 0) body.aiLevels = levels
    leaveGame()
    try {
      const response = await apiFetch('/api/single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`)
      handleStartSinglePlayer(data.sessionID, name, avatar)
    } catch (error) {
      showToast(`Could not start a new game: ${error.message}`, 'error')
      setGameMode('single') // fall back to the single-player lobby
      setInGame(false)
      navigate('/')
    }
  }

  // Mode selection screen
  if (gameMode === null) {
    return (
      <>
        <Toast />
        <ModeMenu onSingle={() => setGameMode('single')} onMulti={() => setGameMode('multi')} />
      </>
    )
  }

  // Show appropriate lobby based on mode
  if (!inGame) {
    return (
      <>
        <Toast />
        {gameMode === 'single'
          ? <SinglePlayerLobby onStartGame={handleStartSinglePlayer} onBack={handleBackToMenu} />
          : <Lobby onJoinGame={handleJoinMultiplayer} onBack={handleBackToMenu} initialRoomId={pendingRoomId} />}
      </>
    )
  }

  // Connection state shared by the first-connect dialog and the in-game reconnect banner
  const showRetryButton = !!connectionError || (isReconnecting && reconnectAttempts >= 2)
  // Not connecting, not reconnecting, no error: nothing will happen by itself — offer a way back.
  const isIdle = !connected && !isConnecting && !isReconnecting && !connectionError
  const backToMenu = () => {
    setInGame(false)
    setGameMode(null)
  }
  const retry = () => {
    if (sessionId && storedPlayerName) forceReconnect()
  }

  // Before the first game state: a connecting dialog
  if (!gameState) {
    const title = connectionError
      ? 'Connection Failed'
      : isReconnecting
        ? `Reconnecting (${reconnectAttempts}/10)`
        : !connected
          ? 'Connecting…'
          : 'Loading…'
    return (
      <>
        <Toast />
        <ConnectionDialog
          title={title}
          error={connectionError}
          message={isReconnecting ? 'Trying to reach the game server again…' : 'Connecting to the game server…'}
          busy={(isConnecting || isReconnecting || connected) && !showRetryButton}
          onRetry={showRetryButton || isIdle ? retry : undefined}
          onBack={reconnectAttempts >= 3 || isIdle || connectionError ? backToMenu : undefined}
        />
      </>
    )
  }

  // Desktop board from 768px wide; phones (and phones held sideways, < 500px tall) get the compact board
  const useWebLayout = !isCompact

  return (
    <ThemeProvider>
      <MobileLayoutProvider>
        {/* Lost the connection mid-game: keep the board visible but inert, and show the attempts on top */}
        <div ref={boardRef} aria-hidden={!connected || undefined}>
          <GameContentWithTheme
            useWebLayout={useWebLayout}
            isMobile={isCompact}
            isPortrait={isPortrait}
            sessionId={sessionId}
            onNewGame={handlePlayAgain}
            onBackToMenu={handleExitToMenu}
          />
        </div>
        {!connected && (
          <ReconnectBanner
            attempts={reconnectAttempts}
            error={connectionError || (isIdle ? 'The connection to the game server was closed.' : null)}
            onRetry={showRetryButton || isIdle ? retry : undefined}
            onBack={reconnectAttempts >= 3 || isIdle ? handleExitToMenu : undefined}
          />
        )}
      </MobileLayoutProvider>
    </ThemeProvider>
  )
}

export default SinglePlayerApp
