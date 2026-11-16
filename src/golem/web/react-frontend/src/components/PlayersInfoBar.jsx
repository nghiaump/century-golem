import React from 'react'
import useGameStore from '../store/gameStore'
import useTurnTimer from '../hooks/useTurnTimer'
import Avatar from './ui/Avatar'
import CrystalRow from './ui/CrystalRow'
import GolemIcon from './ui/GolemIcon'
import TurnBanner from './ui/TurnBanner'
import AiThinkingIndicator from './AiThinkingIndicator'

const pointsOf = (p) =>
  (p?.pointCards?.reduce((s, c) => s + (c.points || 0), 0) || 0) + (p?.coins?.reduce((s, c) => s + (c.points || 0), 0) || 0)

/**
 * Phones: every player as a chip (one scrolling row; a column when `vertical`), then whose turn it is.
 * The player to move glows; people get a timer ring. `compact` (phone held sideways): portrait, points
 * and golems only, no status line (the hand panel glows on your turn).
 */
const PlayersInfoBar = ({ vertical = false, compact = false }) => {
  const { gameState, myPlayer, currentPlayer } = useGameStore()
  const timer = useTurnTimer()
  if (!gameState?.players?.length) return null
  const started = !!gameState.market && Object.keys(gameState.market).length > 0
  const isMyTurn = started && currentPlayer?.id === myPlayer?.id
  const thinking = currentPlayer?.isAI && gameState?.aiThinking?.playerID === currentPlayer?.id

  return (
    <div data-players-info-bar className="flex flex-shrink-0 flex-col gap-2 px-3 pb-2">
      <div className={vertical ? 'flex flex-col gap-1.5' : 'scrollbar-hide -mx-3 flex snap-x scroll-pl-3 gap-2 overflow-x-auto px-3 pb-1 pt-1'}>
        {gameState.players.map((p) => {
          const current = started && currentPlayer?.id === p.id
          const offline = !p.isAI && p.online === false
          return (
            <div
              key={p.id || p.name}
              className={`surface-stone flex min-h-[52px] flex-shrink-0 snap-start items-center gap-2 px-2 py-1.5 ${vertical ? 'w-full' : compact ? '' : 'min-w-[156px]'} ${current ? 'turn-glow' : ''}`}
            >
              <Avatar player={p} size={30} turn={current} timer={current && !p.isAI ? timer : undefined} offline={offline} restAnchor />
              {compact ? (
                <div className="flex flex-col items-start leading-tight">
                  <span className="font-display text-xs font-bold text-bronze-100">★{pointsOf(p)}</span>
                  <span className="inline-flex items-center gap-0.5 text-xs font-bold text-bronze-300"><GolemIcon size={12} label="Golems" />{p.pointCards?.length || 0}</span>
                </div>
              ) : (
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="truncate text-xs font-bold text-fg">{p.id === myPlayer?.id ? 'You' : p.name}</span>
                  <span className="ml-auto flex-shrink-0 font-display text-xs font-bold text-bronze-100">★{pointsOf(p)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CrystalRow resources={p.caravan} size="xs" className="!gap-1" />
                  <span className="ml-auto inline-flex flex-shrink-0 items-center gap-0.5 text-xs font-bold text-bronze-300"><GolemIcon size={12} label="Golems" />{p.pointCards?.length || 0}</span>
                </div>
              </div>
              )}
            </div>
          )
        })}
      </div>
      {started && !compact ? (
        isMyTurn ? (
          <TurnBanner show seconds={timer.remaining} label="Your turn — tap a card" className="w-full justify-center" />
        ) : (
          <div className="flex min-h-[36px] items-center justify-center rounded-stone-sm bg-rock-950/60 px-3 text-sm text-fg-muted">
            {thinking ? <AiThinkingIndicator label={`${currentPlayer.name} is thinking`} /> : `Waiting for ${currentPlayer?.name || 'the next player'}…`}
          </div>
        )
      ) : null}
    </div>
  )
}

export default PlayersInfoBar
