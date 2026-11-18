import React from 'react'
import useGameStore from '../store/gameStore'
import useTurnTimer from '../hooks/useTurnTimer'
import Avatar from './ui/Avatar'
import Gem, { CRYSTALS } from './ui/Gem'
import GolemIcon from './ui/GolemIcon'
import { HandIcon, PlayedIcon } from './ui/CardIcons'

export const pointsOf = (p) =>
  (p?.pointCards?.reduce((s, c) => s + (c.points || 0), 0) || 0) + (p?.coins?.reduce((s, c) => s + (c.points || 0), 0) || 0)

const count = (res, c) => Number(res?.[c]) || 0

/** Opponents in turn order after me (spectators: everyone in seat order). */
export function opponentsOf(players, me) {
  if (!me) return players
  const i = players.findIndex((p) => p.id === me.id)
  if (i < 0) return players
  return [...players.slice(i + 1), ...players.slice(0, i)]
}

/**
 * Phones: every opponent at once (no sideways scrolling), each a small stone chip — portrait, name
 * (when there is room), points, golems, cards in hand / played, and their crystals. The player to move glows; people get a
 * timer ring. My own numbers are in the hand panel. `landscape`: the narrow column beside the board.
 */
const PlayersInfoBar = ({ landscape = false }) => {
  const { gameState, myPlayer, currentPlayer, isSpectator } = useGameStore()
  const timer = useTurnTimer()
  if (!gameState?.players?.length) return null
  const started = !!gameState.market && Object.keys(gameState.market).length > 0
  const shown = isSpectator ? gameState.players : opponentsOf(gameState.players, myPlayer)
  const n = shown.length
  const cols = landscape ? (n <= 3 ? n : 2) : Math.min(n, 4)
  const roomy = landscape ? cols <= 2 : n <= 3 // chip wide enough for the name
  const gem = roomy ? 12 : 10

  return (
    <div
      data-players-info-bar
      className={`grid flex-shrink-0 gap-1.5 ${n > 4 && !landscape ? 'scrollbar-hide auto-cols-[88px] grid-flow-col overflow-x-auto' : ''}`}
      style={n > 4 && !landscape ? undefined : { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      aria-label="Players"
    >
      {shown.map((p) => {
        const current = started && currentPlayer?.id === p.id
        const offline = !p.isAI && p.online === false
        const golems = p.pointCards?.length || 0
        return (
          <div
            key={p.id || p.name}
            title={p.name}
            className={`surface-stone flex min-w-0 flex-col gap-1 px-1.5 py-1.5 ${current ? 'turn-glow' : ''}`}
          >
            <div className="flex min-w-0 items-center gap-1.5">
              <Avatar player={p} size={24} turn={current} timer={current && !p.isAI ? timer : undefined} offline={offline} restAnchor />
              <div className="min-w-0 flex-1 leading-tight">
                {roomy ? <div className="truncate text-xs font-bold text-fg">{p.id === myPlayer?.id ? 'You' : p.name}</div> : null}
                <div className={`flex text-xs font-bold ${roomy ? 'items-center gap-1.5' : 'flex-col items-start'}`}>
                  <span className="font-display text-bronze-100" aria-label={`${pointsOf(p)} points`}>★{pointsOf(p)}</span>
                  <span className="inline-flex items-center gap-0.5 text-bronze-300" aria-label={`${golems} golems`}><GolemIcon size={12} label={false} />{golems}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2.5 text-xs font-semibold tabular-nums text-fg-muted">
              <span className="inline-flex items-center gap-0.5" title="Cards in hand" aria-label={`${p.hand?.length || 0} cards in hand`}><HandIcon size={13} />{p.hand?.length || 0}</span>
              <span className="inline-flex items-center gap-0.5" title="Played since the last rest" aria-label={`${p.playedCards?.length || 0} cards played`}><PlayedIcon size={13} />{p.playedCards?.length || 0}</span>
            </div>
            <div
              className="flex items-center justify-between text-xs font-semibold tabular-nums"
              role="group"
              aria-label={`Crystals: ${CRYSTALS.map((c) => `${count(p.caravan, c)} ${c}`).join(', ')}`}
            >
              {CRYSTALS.map((c) => (
                <span key={c} className={`inline-flex items-center gap-px ${count(p.caravan, c) ? 'text-fg' : 'text-fg-muted opacity-50'}`} aria-hidden="true">
                  <Gem color={c} size={gem} label={false} />{count(p.caravan, c)}
                </span>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default PlayersInfoBar
