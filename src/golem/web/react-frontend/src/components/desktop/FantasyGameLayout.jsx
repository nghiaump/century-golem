import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import FantasyMarketArea from '../FantasyMarketArea'
import DiscardModal from '../DiscardModal'
import AcquiredCardOverlay from '../AcquiredCardOverlay'
import GameOverModal from '../GameOverModal'
import useGameStore from '../../store/gameStore'
import AiThinkingIndicator from '../AiThinkingIndicator'
import { getCardSpriteStyle, getCardImagePath } from '../../utils/cardNames'
import useReopenAfterUndo from '../../hooks/useReopenAfterUndo'
import useTurnTimer from '../../hooks/useTurnTimer'
import Avatar from '../ui/Avatar'
import Button from '../ui/Button'
import CardImage from '../ui/CardImage'
import CrystalRow from '../ui/CrystalRow'
import GolemIcon from '../ui/GolemIcon'
import Modal from '../ui/Modal'
import NightBackdrop from '../ui/NightBackdrop'
import TurnBanner from '../ui/TurnBanner'

// ============================================
// LAYOUT SETTINGS - Everything uses % based positioning
// ============================================

// Game arena original dimensions
const GAME_ARENA_WIDTH = 1280
const GAME_ARENA_HEIGHT = 580

// Dock takes this % of total container height (each side)
const DOCK_HEIGHT_PERCENT = 15  // 12% top, 12% bottom = 24% total for docks

// Main container aspect ratio: width / total_height
// total_height = game_arena_height + 2 * dock_height
// If dock is 12% each side, game_arena is 76% of total
const TOTAL_HEIGHT = GAME_ARENA_HEIGHT / (1 - DOCK_HEIGHT_PERCENT * 2 / 100)
const MAIN_ASPECT_RATIO = GAME_ARENA_WIDTH / TOTAL_HEIGHT

// Game arena position inside main container (% based)
const GAME_ARENA_TOP = DOCK_HEIGHT_PERCENT  // starts after top docks
const GAME_ARENA_HEIGHT_PERCENT = 100 - DOCK_HEIGHT_PERCENT * 2  // 76%

// ============================================
// DOCK POSITIONS - All % based, relative to MAIN CONTAINER
// ============================================

// Dock size - image is 256x150 (ratio 1.7:1)
// Adjust width to match image ratio with dock height
const DOCK_LAYOUT = {
  width: 18,                       // % of container width
  height: DOCK_HEIGHT_PERCENT - 1  // % of container height (~11%)
  // Ratio: 18/11 ≈ 1.6 (close to image 1.7)
}

// Last played card layout (% based, relative to dock position)
const LAST_CARD_LAYOUT = {
  offsetX: 18.1,  // % - offset từ dock left (dương = qua phải)
  offsetY: 0,     // % - offset từ dock top (dương = xuống dưới)
  width: 6,       // % của container width
  height: DOCK_HEIGHT_PERCENT - 1,     // % của container height
}

// Hand area layout - dynamic based on available space
const HAND_AREA = {
  start: 25,        // % - bắt đầu sau graveyard
  end: 96,          // % - kết thúc trước dock đối phương
  maxCards: 8,      // số card hiển thị đầy đủ không overlap
  cardHeight: DOCK_HEIGHT_PERCENT - 1,  // % của container height
}

const DOCK_POSITIONS = [
  // Player 0 (You) - BOTTOM LEFT
  { left: 0, top: 100 - DOCK_HEIGHT_PERCENT + 0.5 },
  // TOP ROW: Player 1, 2, 3
  { left: 0, top: 0.5 },
  { left: 38, top: 0.5 },
  // Player 4 - BOTTOM RIGHT
  { left: 76, top: 0.5 },
  { left: 76, top: 100 - DOCK_HEIGHT_PERCENT + 0.5 },
]

// ============================================
// Player Dock — stone plaque: portrait (timer ring on a person's turn; anchor of the rest popup),
// name, points, golems (mine open the list), crystals x/10.
// ============================================
const pointsOf = (p) =>
  (p?.pointCards?.reduce((s, c) => s + (c.points || 0), 0) || 0) + (p?.coins?.reduce((s, c) => s + (c.points || 0), 0) || 0)

const PlayerDock = ({ player, isCurrentTurn, isMe, position }) => {
  const [showGolems, setShowGolems] = useState(false)
  const timer = useTurnTimer()
  const golemCount = player.pointCards?.length || 0
  return (
    <>
      <div
        className={`surface-stone absolute flex flex-col justify-center gap-1 px-2 py-1.5 ${isCurrentTurn ? 'turn-glow' : ''}`}
        style={{ left: `${position.left}%`, top: `${position.top}%`, width: `${DOCK_LAYOUT.width}%`, height: `${DOCK_LAYOUT.height}%` }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <Avatar player={player} size={30} turn={isCurrentTurn} timer={isCurrentTurn && !player.isAI ? timer : undefined} restAnchor={!isMe} />
          <span className="min-w-0 flex-1 truncate text-sm font-bold text-fg">{player.name || 'Player'}{isMe ? <span className="font-normal text-fg-muted"> (you)</span> : null}</span>
          <span className="font-display text-sm font-bold text-bronze-100">★{pointsOf(player)}</span>
          <button
            type="button"
            onClick={() => isMe && golemCount > 0 && setShowGolems(true)}
            disabled={!isMe || golemCount === 0}
            aria-label={`${golemCount} golem${golemCount === 1 ? '' : 's'}${isMe ? ', show' : ''}`}
            className="inline-flex items-center gap-0.5 rounded-full bg-rock-950/60 px-2 py-0.5 text-sm font-bold text-bronze-300 enabled:hover:bg-rock-700"
          >
            <GolemIcon size={14} />{golemCount}
          </button>
        </div>
        <CrystalRow resources={player.caravan || player.resources} capacity={10} size="sm" />
      </div>
      <Modal open={isMe && showGolems} onClose={() => setShowGolems(false)} title={`My golems (${golemCount})`} variant="stone" size="lg">
        <p className="mb-3 text-sm text-fg-muted">Golems and coins: <b className="font-display text-lg text-bronze-100">★{pointsOf(player)}</b></p>
        <div className="grid grid-cols-3 gap-3 md:grid-cols-5">
          {player.pointCards?.map((card, idx) => (
            <CardImage key={idx} name={card.name} alt={`Golem, ${card.points} points`} className="aspect-[0.58] w-full rounded-stone-sm border border-black/50" />
          ))}
        </div>
      </Modal>
    </>
  )
}

// ============================================
// Last Played Card Component - Shows beside dock
// For others: hover to see last card
// For me: click to see graveyard (all played cards)
// ============================================
const LastPlayedCard = ({ player, dockPosition, isMe, isMyTurn }) => {
  const [isHovered, setIsHovered] = React.useState(false)
  const [showGraveyard, setShowGraveyard] = React.useState(false)
  const { rest } = useGameStore()
  const playedCards = player?.playedCards || []
  const lastCard = playedCards.length > 0 ? playedCards[playedCards.length - 1] : null
  const canRest = isMe && isMyTurn && playedCards.length > 0
  
  if (!lastCard) return null
  
  return (
    <>
      {/* Small card beside dock - use sprite */}
      <motion.div
        className="absolute z-10 cursor-pointer overflow-hidden rounded-stone-sm border border-black/50 shadow-elev-1"
        style={{
          left: `${dockPosition.left + LAST_CARD_LAYOUT.offsetX}%`,
          top: `${dockPosition.top + LAST_CARD_LAYOUT.offsetY}%`,
          width: `${LAST_CARD_LAYOUT.width}%`,
          height: `${LAST_CARD_LAYOUT.height}%`,
        }}
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        onMouseEnter={() => !isMe && setIsHovered(true)}
        onMouseLeave={() => !isMe && setIsHovered(false)}
        onClick={() => isMe && setShowGraveyard(true)}
      >
        {(() => {
          const spriteStyle = getCardSpriteStyle(lastCard.name)
          if (spriteStyle) {
            return <div className="w-full h-full" style={spriteStyle} />
          }
          return (
            <img
              src={getCardImagePath(lastCard.name)}
              alt={lastCard.name}
              className="w-full h-full object-cover"
              onError={(e) => { e.target.src = '/assets/images/golem_bg.JPG' }}
            />
          )
        })()}
        {/* Card count badge */}
        {playedCards.length > 1 && (
          <div className="absolute right-0 top-0 rounded-bl bg-rock-950/85 px-1.5 text-xs font-bold text-fg">
            {playedCards.length}
          </div>
        )}
        {/* my pile opens the list (with Rest) */}
        {isMe && (
          <div className="absolute bottom-0 left-0 right-0 bg-rock-950/80 py-0.5 text-center text-xs font-semibold text-bronze-100">
            Played
          </div>
        )}
      </motion.div>

      {/* For others: Large card in center when hovered */}
      <AnimatePresence>
        {!isMe && isHovered && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50" />
            {/* Large card - maintain aspect ratio, use sprite */}
            <motion.div
              className="relative rounded-xl overflow-hidden shadow-2xl"
              style={{ 
                width: 'auto',
                height: '60vh',
                aspectRatio: '2/3',
              }}
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.5 }}
              transition={{ duration: 0.2 }}
            >
              {(() => {
                const spriteStyle = getCardSpriteStyle(lastCard.name)
                if (spriteStyle) {
                  return <div className="w-full h-full" style={spriteStyle} />
                }
                return (
                  <img
                    src={getCardImagePath(lastCard.name)}
                    alt={lastCard.name}
                    className="w-full h-full object-contain"
                    onError={(e) => { e.target.src = '/assets/images/golem_bg.JPG' }}
                  />
                )
              })()}
              {/* Player name */}
              <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-center py-2">
                <span className="font-bold">{player.name}</span>
                <span className="text-gray-300 ml-2">({playedCards.length} cards played)</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* For me: all played cards (+ Rest) */}
      <Modal
        open={isMe && showGraveyard}
        onClose={() => setShowGraveyard(false)}
        title={`Played cards (${playedCards.length})`}
        variant="stone"
        size="lg"
        footer={canRest ? <Button onClick={() => { rest(); setShowGraveyard(false) }}>Rest</Button> : null}
      >
        <p className="mb-3 text-sm text-fg-muted">Rest to take them all back to your hand.</p>
        <div className="grid grid-cols-4 gap-3">
          {playedCards.map((card, idx) => (
            <CardImage key={idx} name={card.name} alt={card.name} className="aspect-[0.58] w-full rounded-stone-sm border border-black/50" />
          ))}
        </div>
      </Modal>
    </>
  )
}

// ============================================
// My Hand Cards Component - Dynamic layout with overlap support
// ============================================
const MyHandCards = ({ dockPosition }) => {
  const { 
    myPlayer, 
    currentPlayer, 
    playCard,
    showUpgradeModal,
    showTradeModal 
  } = useGameStore()
  const hand = myPlayer?.hand || []
  const isMyTurn = currentPlayer?.id === myPlayer?.id
  const [hoveredIndex, setHoveredIndex] = useState(null)
  useReopenAfterUndo(({ kind, card, cardIndex }) => {
    if (kind === 'upgrade') showUpgradeModal(card, cardIndex)
    else if (kind === 'trade') showTradeModal(card, cardIndex)
  })
  
  // Handle card click - same logic as FantasyMarketArea
  const handleCardClick = (cardIndex) => {
    if (!isMyTurn) return
    
    const card = hand[cardIndex]
    if (card && card.actionType === 1) {
      // Upgrade card - show modal
      showUpgradeModal(card, cardIndex)
    } else if (card && card.actionType === 2) {
      // Trade card - show modal
      showTradeModal(card, cardIndex)
    } else {
      // Normal card - play directly
      playCard(cardIndex, card)
    }
  }
  
  if (hand.length === 0) return null
  
  // Calculate dynamic card positions
  const handWidth = HAND_AREA.end - HAND_AREA.start  // 71%
  const cardWidth = handWidth / HAND_AREA.maxCards   // ~8.9% per card
  const cardCount = hand.length
  const isOverlapping = cardCount > HAND_AREA.maxCards
  
  // Calculate offset for each card
  const getCardOffset = (index) => {
    if (!isOverlapping) {
      // Cards fit - show with even spacing
      return index * cardWidth
    } else {
      // Too many cards - overlap them
      const overlapSpacing = (handWidth - cardWidth) / (cardCount - 1)
      return index * overlapSpacing
    }
  }
  
  return (
    <div 
      className="absolute z-10"
      style={{
        left: `${HAND_AREA.start}%`,
        top: `${dockPosition.top}%`,
        width: `${handWidth}%`,
        height: `${HAND_AREA.cardHeight}%`,
      }}
    >
      {hand.map((card, idx) => {
        const offset = getCardOffset(idx)
        const isHovered = hoveredIndex === idx
        
        return (
          <motion.div
            key={card.id || idx}
            className={`
              absolute cursor-pointer overflow-hidden rounded-stone-sm border shadow-elev-1
              ${isMyTurn ? 'border-bronze-300 shadow-turn' : 'border-black/50 brightness-90'}
            `}
            style={{
              left: `${offset}%`,
              width: `${cardWidth}%`,
              height: '100%',
              zIndex: isHovered ? 50 : idx,
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ 
              opacity: 1, 
              y: isHovered ? -25 : 0,
              scale: isHovered ? 1.5 : 1,
            }}
            transition={{ duration: 0.2 }}
            onMouseEnter={() => setHoveredIndex(idx)}
            onMouseLeave={() => setHoveredIndex(null)}
            onClick={() => handleCardClick(idx)}
            title={isMyTurn ? 'Click to play' : 'Wait for your turn'}
          >
            {(() => {
              const spriteStyle = getCardSpriteStyle(card.name)
              if (spriteStyle) {
                return <div className="w-full h-full" style={spriteStyle} />
              }
              return (
                <img
                  src={getCardImagePath(card.name)}
                  alt={card.name}
                  className="w-full h-full object-cover"
                  onError={(e) => { e.target.src = '/assets/images/golem_bg.JPG' }}
                />
              )
            })()}
          </motion.div>
        )
      })}
    </div>
  )
}

// ============================================
// Main Layout Component
// ============================================
const FantasyGameLayout = ({ onNewGame, onBackToMenu }) => {
  const { gameState, myPlayer, currentPlayer, rest } = useGameStore()
  const timer = useTurnTimer()
  const allPlayers = gameState?.players || []

  return (
    <div className="relative flex h-screen h-[100dvh] items-center justify-center overflow-hidden">
      <NightBackdrop />
      {/* MAIN CONTAINER - Contains both docks and game arena */}
      {/* Scales to fit viewport while maintaining aspect ratio */}
      <div 
        className="relative"
        style={{
          // leave the top 56px to the HUD (round, sound, activity)
          aspectRatio: `${MAIN_ASPECT_RATIO}`,
          width: '98vw',
          height: 'calc(100dvh - 68px)',
          marginTop: '56px',
          maxWidth: `calc((100dvh - 68px) * ${MAIN_ASPECT_RATIO})`,
          maxHeight: `calc(98vw / ${MAIN_ASPECT_RATIO})`,
        }}
      >
        {/* Player Docks - Positioned with % relative to main container */}
        {allPlayers.map((player, idx) => (
          <React.Fragment key={player.id}>
            <PlayerDock
              player={player}
              isCurrentTurn={currentPlayer?.id === player.id}
              isMe={myPlayer?.id === player.id}
              position={DOCK_POSITIONS[idx] || DOCK_POSITIONS[0]}
            />
            {/* Last played card beside dock */}
            <LastPlayedCard
              player={player}
              dockPosition={DOCK_POSITIONS[idx] || DOCK_POSITIONS[0]}
              isMe={myPlayer?.id === player.id}
              isMyTurn={currentPlayer?.id === myPlayer?.id}
            />
            {/* My hand cards - only for me */}
            {myPlayer?.id === player.id && (
              <MyHandCards dockPosition={DOCK_POSITIONS[idx] || DOCK_POSITIONS[0]} />
            )}
          </React.Fragment>
        ))}

        {/* GAME ARENA - Positioned with % relative to main container */}
        <div 
          className="absolute"
          style={{
            left: '0%',
            top: `${GAME_ARENA_TOP}%`,
            width: '100%',
            height: `${GAME_ARENA_HEIGHT_PERCENT}%`,
          }}
        >
          {/* Game Board Background (game_dock.jpg) */}
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat rounded-lg shadow-2xl"
            style={{
              backgroundImage: 'url(/assets/images/game_dock.jpg)'
            }}
          />

          {/* Turn strip on the board: your turn + seconds + Rest, or who is moving; deck sizes */}
          <div className="absolute left-0 right-0 top-0 z-20 p-2">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="surface-stone px-3 py-1.5 text-xs text-fg-muted">
                <b className="font-display text-bronze-100">Round {gameState?.round || 1}</b>{gameState?.lastRound ? <b className="text-[rgb(255_200_185)]"> · last round</b> : null} · deck {gameState?.market?.actionDeck || 0} cards, {gameState?.market?.pointDeck || 0} golems
              </span>
              {currentPlayer?.id === myPlayer?.id ? (
                <span className="flex items-center gap-2">
                  <TurnBanner show seconds={timer.remaining} />
                  <Button size="sm" variant="secondary" onClick={() => rest()} disabled={!(myPlayer?.playedCards?.length > 0)} title="Take all played cards back to your hand">Rest</Button>
                </span>
              ) : (
                <span className="surface-stone max-w-[50%] truncate px-3 py-1.5 text-fg">
                  {currentPlayer?.isAI && gameState?.aiThinking?.playerID === currentPlayer?.id
                    ? <AiThinkingIndicator label={`${currentPlayer?.name} is thinking`} />
                    : `${currentPlayer?.name || 'Next player'} to move · ${timer.remaining}s`}
                </span>
              )}
            </div>
          </div>

          {/* Market Area - Center */}
          <FantasyMarketArea />

          {/* Discard Modal */}
          <DiscardModal />

          {/* Acquired Card Overlay */}
          <AcquiredCardOverlay />

          {/* Game Over Modal */}
          <GameOverModal 
            onNewGame={onNewGame}
            onBackToMenu={onBackToMenu}
          />
        </div>
      </div>
    </div>
  )
}

export default FantasyGameLayout
