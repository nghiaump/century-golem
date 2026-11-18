import React from 'react'
import useGameStore from '../../store/gameStore'
import useTurnTimer from '../../hooks/useTurnTimer'
import { HudButtons } from '../board/Hud'
import TurnBanner from '../ui/TurnBanner'
import AiThinkingIndicator from '../AiThinkingIndicator'

/**
 * Phones, during a game: one row — round, whose turn it is (with my seconds left), sound · activity.
 * In the page flow (not floating), so nothing on the board hides under it.
 */
const PhoneTopBar = ({ sessionId }) => {
  const { gameState, myPlayer, currentPlayer, isSpectator } = useGameStore()
  const timer = useTurnTimer()
  const round = gameState?.round || 1
  const lastRound = !!gameState?.lastRound
  const isMyTurn = !isSpectator && !!myPlayer && currentPlayer?.id === myPlayer?.id
  const thinking = currentPlayer?.isAI && gameState?.aiThinking?.playerID === currentPlayer?.id
  const name = currentPlayer?.name || 'the next player'

  return (
    <div className="flex h-11 flex-shrink-0 items-center gap-1.5">
      <div
        className={`surface-stone flex h-11 flex-shrink-0 flex-col items-center justify-center px-2.5 font-display font-bold leading-none ${lastRound ? 'text-ember' : 'text-bronze-100'}`}
        title={lastRound ? `Round ${round} — last round` : `Round ${round}`}
        aria-label={lastRound ? `Round ${round}, last round` : `Round ${round}`}
      >
        <span className="text-sm">R{round}</span>
        {lastRound ? <span className="mt-0.5 text-xs">Last</span> : null}
      </div>
      <div className="min-w-0 flex-1">
        {gameState?.gameOver ? (
          <div className="flex h-11 items-center justify-center rounded-stone-sm bg-rock-950/60 px-2 text-sm text-fg-muted">Game over</div>
        ) : isMyTurn ? (
          <TurnBanner show seconds={timer.remaining} label="Your turn" className="h-11 w-full justify-center !gap-1.5 !px-2 max-[359px]:[&>svg]:hidden" />
        ) : (
          <div className="flex h-11 min-w-0 items-center justify-center rounded-stone-sm bg-rock-950/60 px-2 text-sm text-fg-muted" role="status">
            {thinking ? <AiThinkingIndicator label={`${name} is thinking`} className="min-w-0" /> : <span className="truncate">{isSpectator ? `${name}’s turn` : `Waiting for ${name}…`}</span>}
          </div>
        )}
      </div>
      <HudButtons sessionId={sessionId} />
    </div>
  )
}

export default PhoneTopBar
