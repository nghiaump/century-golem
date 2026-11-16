import React from 'react'
import useGameStore from '../store/gameStore'
import useTurnTimer from '../hooks/useTurnTimer'
import useOrientation from '../hooks/useOrientation'
import Avatar from './ui/Avatar'
import CrystalRow from './ui/CrystalRow'
import GolemIcon from './ui/GolemIcon'
import Pill from './ui/Pill'
import AiThinkingIndicator from './AiThinkingIndicator'

// Points so far = golems + coins (non-yellow crystals only count at the end).
const pointsOf = (p) =>
  (p?.pointCards?.reduce((s, c) => s + (c.points || 0), 0) || 0) + (p?.coins?.reduce((s, c) => s + (c.points || 0), 0) || 0)

/**
 * A player's plaque on the desktop board: portrait (timer ring on their turn; anchor of the rest
 * popup), name, points, golems, crystals, cards in hand / played, AI thinking, offline.
 */
const PlayerCard = ({ player, isCurrentPlayer }) => {
  const aiThinking = useGameStore((s) => s.gameState?.aiThinking)
  const golemsToEnd = useGameStore((s) => s.gameState?.golemsToEnd)
  const myId = useGameStore((s) => s.myPlayer?.id)
  const timer = useTurnTimer()
  const { width } = useOrientation()
  const roomy = width >= 1280 // narrower desktops: smaller portrait and crystals so all plaques fit one row
  if (!player) return null

  const golems = player.pointCards?.length || 0
  const offline = !player.isAI && player.online === false
  const thinking = player.isAI && isCurrentPlayer && aiThinking?.playerID === player.id
  const nearEnd = golemsToEnd && golems >= golemsToEnd - 1

  return (
    <div className={`surface-stone flex items-center gap-3 px-3 py-2.5 ${isCurrentPlayer ? 'turn-glow' : ''}`}>
      <Avatar
        player={player}
        size={roomy ? 68 : 56}
        turn={isCurrentPlayer}
        timer={isCurrentPlayer && !player.isAI ? timer : undefined}
        offline={offline}
        restAnchor
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`min-w-0 truncate font-bold ${roomy ? 'text-base' : 'text-sm'} ${offline ? 'text-fg-muted' : 'text-fg'}`} title={player.name}>
            {player.name || 'Player'}{player.id === myId ? <span className="font-normal text-fg-muted"> (you)</span> : null}
          </span>
          <span
            className={`ml-auto inline-flex flex-shrink-0 items-center gap-1 rounded-full px-1.5 text-sm font-bold ${nearEnd ? 'bg-ember/30 text-[rgb(255_210_196)]' : 'text-bronze-300'}`}
            title={nearEnd ? 'One golem away from ending the game' : 'Golems'}
          >
            <GolemIcon size={roomy ? 17 : 15} label="Golems" />{golems}
          </span>
          <span className={`flex-shrink-0 font-display font-bold leading-none text-bronze-100 tabular-nums ${roomy ? 'text-lg' : 'text-base'}`} title="Golems + coins so far">★{pointsOf(player)}</span>
        </div>
        <div className="mt-1.5 flex min-w-0 items-center">
          {thinking ? (
            <AiThinkingIndicator label="thinking" className="text-sm" />
          ) : (
            <CrystalRow resources={player.caravan} size={roomy ? 'sm' : 'xs'} className={roomy ? '' : '!gap-1.5'} />
          )}
        </div>
        <div className={`mt-1 flex items-center gap-2 whitespace-nowrap text-fg-muted ${roomy ? 'text-sm' : 'text-xs'}`}>
          <span className="truncate" title="Cards in hand · played since the last rest">{player.hand?.length || 0} in hand · {player.playedCards?.length || 0} played</span>
          {offline ? <Pill tone="ember" className="ml-auto">Offline</Pill> : null}
        </div>
      </div>
    </div>
  )
}

export default PlayerCard
