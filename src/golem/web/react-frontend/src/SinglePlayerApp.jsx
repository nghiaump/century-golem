import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import SinglePlayerLobby from './components/SinglePlayerLobby'
import Lobby from './components/Lobby'
import PlayersInfoBar from './components/PlayersInfoBar'
import CompactGameBoard from './components/mobile/CompactGameBoard'
import CompactPlayerHand from './components/mobile/CompactPlayerHand'
import CollapsibleInfo from './components/CollapsibleInfo'
import DiscardModal from './components/DiscardModal'
import AcquiredCardOverlay from './components/AcquiredCardOverlay'
import GameOverModal from './components/GameOverModal'
import Toast from './components/Toast'
import XpWindow from './components/XpWindow'
import { avatarSrc } from './utils/avatar'
import WebGameLayout from './components/desktop/WebGameLayout'
import ThemeToggleButton from './components/ThemeToggleButton'
import SoundToggleButton from './components/SoundToggleButton'
import DifficultyBadge from './components/DifficultyBadge'
import FantasyGameLayout from './components/desktop/FantasyGameLayout'
import useGameStore from './store/gameStore'
import useOrientation from './hooks/useOrientation'
import useGameSounds from './hooks/useGameSounds'
import { MobileLayoutProvider } from './contexts/MobileLayoutContext'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'

// Game Content with Theme Support
function GameContentWithTheme({ useWebLayout, isMobile, isPortrait, sessionId, setInGame, setGameMode }) {
  const { isFantasy } = useTheme()
  
  // Initialize game sounds hook
  useGameSounds()

  const handleNewGame = () => {
    setInGame(false)
    setGameMode(null)
    window.location.reload()
  }

  const handleBackToMenu = () => {
    setInGame(false)
    setGameMode(null)
    window.location.reload()
  }

  // Fantasy Theme Layout
  if (isFantasy) {
    return (
      <>
        <ThemeToggleButton />
        <DifficultyBadge />
        <SoundToggleButton />
        <FantasyGameLayout 
          onNewGame={handleNewGame}
          onBackToMenu={handleBackToMenu}
        />
        <Toast />
      </>
    )
  }

  // Default Theme Layout
  return (
    <>
      {/* Theme Toggle Button - Always visible */}
      <ThemeToggleButton />

      {/* AI difficulty — one badge for the whole game, under the theme toggle */}
      <DifficultyBadge />
      
      {/* Sound Toggle Button - Always visible */}
      <SoundToggleButton />

      {/* Blurred Background Layer */}
      <div className="fixed inset-0 z-0"
        style={{
          backgroundImage: 'url(/assets/images/background.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center center',
          backgroundRepeat: 'no-repeat',
          filter: isMobile ? 'blur(4px) brightness(0.8)' : 'blur(8px) brightness(0.7)',
        }}
      />
      
      {useWebLayout ? (
        /* Desktop/Tablet - WebGameLayout */
        <div className="h-screen h-[100dvh] relative z-10">
          <WebGameLayout />

          {/* Discard Modal (when crystals exceed max) */}
          <DiscardModal />
        </div>
      ) : (
        /* Mobile - CompactGameBoard with mobile-specific layout */
        <div className={`
          ${isPortrait 
            ? 'h-screen h-[100dvh] flex flex-col relative z-10 overflow-hidden' 
            : 'min-h-screen min-h-[100dvh] flex flex-col relative z-10'
          }
          ${isPortrait ? 'mobile-portrait' : 'mobile-landscape'}
        `}>
          {/* Players Info Bar - Top */}
          <PlayersInfoBar />

          {/* Central Game Board */}
          <div 
            className={`
            ${isPortrait 
              ? 'flex-1 overflow-hidden relative z-10 min-h-0 pb-[130px]' 
              : 'flex-1 overflow-y-auto pb-24 relative z-10 min-h-0'
            }
          `}
          >
            <CompactGameBoard />
          </div>

          {/* Player Hand - Bottom (Fixed on mobile, relative on desktop) */}
          {!isPortrait && (
            <div className="flex-shrink-0 relative z-30">
              <CompactPlayerHand />
            </div>
          )}
          
          {/* Player Hand - Fixed on mobile portrait */}
          {isPortrait && <CompactPlayerHand />}

          {/* Discard Modal (when crystals exceed max) */}
          <DiscardModal />
          
          {/* Overlay when other players acquire or play cards */}
          <AcquiredCardOverlay />

          {/* Activity Feed (Chat & History) - Works on all screen sizes */}
          <CollapsibleInfo sessionId={sessionId} />
        </div>
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
  const { isPortrait, isLandscape, isMobile, isTablet, isDesktop, width } = useOrientation()

  // Opening /room/:roomId directly (page reload, invite link, old link) has no live connection yet. Upstream jumped
  // straight to the in-game screen without ever connecting, so it hung on "Connecting..." forever. Instead, open the
  // multiplayer lobby on the Join tab with the room prefilled; it checks whether the room still exists.
  useEffect(() => {
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

  // Mode selection screen
  if (gameMode === null) {
    return (
      <>
      <Toast />
      <div className="xp-desktop">
        <XpWindow
          title="Century: Golem Edition"
          icon={avatarSrc('1')}
          className="max-w-md"
          status={<><span>A classic spice trading game</span><span>2–5 players</span></>}
        >
          <h1 className="xp-heading">
            Choose a game mode
            <small>Collect and upgrade crystals to claim golem cards.</small>
          </h1>
          <div className="xp-stack">
            <button type="button" className="xp-tile" onClick={() => setGameMode('single')}>
              <span className="xp-tile-icons">
                <img src={avatarSrc('4')} alt="" />
              </span>
              <span>
                <span className="xp-tile-title">Single Player</span>
                <span className="xp-tile-sub">Play against 1–4 AI opponents</span>
              </span>
              <span className="xp-tile-arrow" aria-hidden="true">›</span>
            </button>
            <button type="button" className="xp-tile" onClick={() => setGameMode('multi')}>
              <span className="xp-tile-icons">
                <img src={avatarSrc('1')} alt="" />
                <img src={avatarSrc('2')} alt="" />
              </span>
              <span>
                <span className="xp-tile-title">Multiplayer</span>
                <span className="xp-tile-sub">Create a room or join friends online</span>
              </span>
              <span className="xp-tile-arrow" aria-hidden="true">›</span>
            </button>
          </div>
        </XpWindow>
      </div>
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

  // Show loading screen while connecting or waiting for game state
  if (!connected || !gameState) {
    const showRetryButton = connectionError || (isReconnecting && reconnectAttempts >= 2);
    // Not connecting, not reconnecting, no error: nothing will happen by itself — offer a way back.
    const isIdle = !connected && !isConnecting && !isReconnecting && !connectionError;
    const title = connectionError
      ? 'Connection Failed'
      : isReconnecting
        ? `Reconnecting (${reconnectAttempts}/${10})`
        : !connected
          ? 'Connecting...'
          : 'Loading...'

    return (
      <>
        <Toast />
        <div className="xp-desktop">
          <XpWindow title={title} icon={avatarSrc('3')} className="max-w-sm">
            <div className="xp-stack">
              {connectionError ? (
                <div className="xp-note xp-note--err">{connectionError}</div>
              ) : (
                <p>{isReconnecting ? 'Attempting to reconnect...' : 'Connecting to the game server. Please wait...'}</p>
              )}

              {(isConnecting || isReconnecting) && !showRetryButton && <div className="xp-progress" role="progressbar" />}

              {(showRetryButton || reconnectAttempts >= 3 || isIdle) && (
                <div className="xp-actions justify-end">
                  {/* Back to Menu - after multiple failed attempts, or when nothing is in progress at all */}
                  {(reconnectAttempts >= 3 || isIdle) && (
                    <button
                      type="button"
                      className="xp-btn"
                      onClick={() => {
                        setInGame(false);
                        setGameMode(null);
                      }}
                    >
                      Back to Menu
                    </button>
                  )}
                  {showRetryButton && (
                    <button
                      type="button"
                      className="xp-btn xp-btn--go"
                      onClick={() => {
                        if (sessionId && storedPlayerName) {
                          forceReconnect();
                        }
                      }}
                    >
                      Retry Connection
                    </button>
                  )}
                </div>
              )}
            </div>
          </XpWindow>
        </div>
      </>
    )
  }

  // Use WebGameLayout for desktop/tablet (>= 768px), CompactGameBoard for mobile (< 768px)
  const useWebLayout = !isMobile

  return (
    <ThemeProvider>
      <MobileLayoutProvider>
        <GameContentWithTheme
          useWebLayout={useWebLayout}
          isMobile={isMobile}
          isPortrait={isPortrait}
          sessionId={sessionId}
          setInGame={setInGame}
          setGameMode={setGameMode}
        />
      </MobileLayoutProvider>
    </ThemeProvider>
  )
}

export default SinglePlayerApp
