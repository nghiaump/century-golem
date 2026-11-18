import React, { useState } from 'react'
import useGameStore from '../store/gameStore'
import useTurnTimer from '../hooks/useTurnTimer'
import Avatar from './ui/Avatar'
import Gem, { CRYSTALS } from './ui/Gem'
import GolemIcon from './ui/GolemIcon'
import { HandIcon, PlayedIcon } from './ui/CardIcons'
import PlayerSheet from './mobile/PlayerSheet'
import useElementSize from '../hooks/useElementSize'

export const pointsOf = (p) =>
  (p?.pointCards?.reduce((s, c) => s + (c.points || 0), 0) || 0) + (p?.coins?.reduce((s, c) => s + (c.points || 0), 0) || 0)

const count = (res, c) => Number(res?.[c]) || 0

const ORDINAL = ['1st', '2nd', '3rd', '4th', '5th']
const GAP = 6 // gap-1.5

/**
 * Chip layout for a chip `w` px wide: wide (biggest portrait, name, ★ golems and hand / played on one line) ·
 * medium (name, two lines of numbers, crystals in one row) · narrow (no name, crystals 2×2). Phones held
 * sideways use compact side-by-side versions (34 / 28px portraits). Below MIN_CHIP the row scrolls sideways instead (5 players on a 320px phone).
 * Sizes allow for two-digit points and Safari's wider text.
 */
export function chipLayout(w) {
  if (w >= 112) return 'wide'
  if (w >= 80) return 'medium'
  return 'narrow'
}
const MIN_CHIP = 58

/** Players who already had their final turn: in the last round, everyone seated before the player to move. */
export function doneForGame(gameState, index) {
  if (!gameState?.lastRound || gameState.gameOver) return false
  const cur = gameState.players?.findIndex((p) => p.id === gameState.currentPlayer)
  return cur >= 0 && index < cur
}

const Counts = ({ hand, played, className = '' }) => (
  <span className={`inline-flex items-center gap-2 text-xs font-semibold leading-none tabular-nums text-fg-muted ${className}`}>
    <span className="inline-flex items-center gap-0.5"><HandIcon size={12} />{hand}</span>
    <span className="inline-flex items-center gap-0.5"><PlayedIcon size={12} />{played}</span>
  </span>
)

const Points = ({ p, golems }) => (
  <>
    <span className="font-display tabular-nums text-bronze-100">★{pointsOf(p)}</span>
    <span className="inline-flex items-center gap-0.5 tabular-nums text-bronze-300"><GolemIcon size={12} label={false} />{golems}</span>
  </>
)
const Stack = ({ children, className = '' }) => (
  <span className={`flex min-w-0 flex-col items-start gap-1 text-xs font-bold leading-none ${className}`}>{children}</span>
)

const Crystals = ({ caravan, gem, grid = false }) => (
  <span className={`text-xs font-semibold leading-none tabular-nums ${grid ? 'grid grid-cols-2 gap-x-1 gap-y-0.5' : 'flex items-center justify-between'}`}>
    {CRYSTALS.map((c) => (
      <span key={c} className={`inline-flex items-center gap-px ${count(caravan, c) ? 'text-fg' : 'text-fg-muted opacity-50'}`}>
        <Gem color={c} size={gem} label={false} />{count(caravan, c)}
      </span>
    ))}
  </span>
)

/**
 * Phones: **everyone at the table in turn order** — left to right is the order of play in a round (the
 * first chip opens it, the last one closes it; no numbers on the portraits, the order says it), my own chip
 * outlined in bronze — so you see who opens and closes the round and where you sit. Each stone chip: portrait, name (when
 * there is room), ★ points, golems, cards in hand / played, crystals. The player to move glows; people get
 * a timer ring. In the last round, players who already had their final turn are dimmed.
 * Chips get denser as the row fills (`chipLayout`), so all five players fit a phone without scrolling.
 * Tapping a chip opens that player's sheet (last moves, played cards, golems); the chip is also where
 * their rest popup and move bubbles (MoveBubbles) point. `landscape`: the column beside the board.
 */
const PlayersInfoBar = ({ landscape = false }) => {
  const { gameState, myPlayer, currentPlayer } = useGameStore()
  const timer = useTurnTimer()
  const [sheet, setSheet] = useState(null) // player id
  const [barEl, setBar] = useState(null)
  const bar = useElementSize(barEl)
  if (!gameState?.players?.length) return null
  const started = !!gameState.market && Object.keys(gameState.market).length > 0
  const players = gameState.players // seat order = order of play in every round
  const n = players.length
  const cols = landscape ? (n === 5 ? 3 : n) : n
  const width = bar.width || (typeof window !== 'undefined' ? (landscape ? 296 : window.innerWidth - 24) : 360)
  const chipW = (width - GAP * (cols - 1)) / cols
  const scroll = chipW < MIN_CHIP
  const layout = scroll ? 'narrow' : chipLayout(chipW)
  // Portrait: the portrait centred on top of the chip, as big as it fits (66px when wide, 55px otherwise;
  // user requests 2026-11-18), the numbers below. Held sideways the column is short, so the compact side-by-side
  // layouts with 34 / 28px portraits stay there and the hand keeps its room.
  const big = !landscape

  return (
    <div
      ref={setBar}
      data-players-info-bar
      data-layout={layout}
      className={`grid flex-shrink-0 gap-1.5 ${scroll ? 'scrollbar-hide auto-cols-[64px] grid-flow-col overflow-x-auto' : ''}`}
      style={scroll ? undefined : { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      aria-label="Players in turn order"
    >
      {players.map((p, i) => {
        const current = started && currentPlayer?.id === p.id
        const me = p.id === myPlayer?.id
        const done = started && doneForGame(gameState, i)
        const offline = !p.isAI && p.online === false
        const golems = p.pointCards?.length || 0
        const hand = p.hand?.length || 0
        const played = p.playedCards?.length || 0
        const name = me ? 'You' : p.name
        const turn = i === 0 ? `${ORDINAL[i]} to play, starts the round` : i === n - 1 ? `${ORDINAL[i] || `${i + 1}th`} to play, last in the round` : `${ORDINAL[i] || `${i + 1}th`} to play`
        const portrait = (size) => (
          <span className="relative flex flex-shrink-0">
            <Avatar player={p} size={size} fit turn={current} timer={current && !p.isAI ? timer : undefined} offline={offline} />
          </span>
        )
        return (
          <button
            type="button"
            key={p.id || p.name}
            title={`${name} — ${turn}${done ? ' (done for the game)' : ''}. Tap for last moves and cards`}
            aria-label={`${name}, ${turn}${done ? ', done for the game' : ''}: ${pointsOf(p)} points, ${golems} golems, ${hand} in hand, ${played} played, crystals ${CRYSTALS.map((c) => `${count(p.caravan, c)} ${c}`).join(', ')}. Show last moves and cards`}
            aria-haspopup="dialog"
            onClick={() => setSheet(p.id)}
            data-rest-anchor={p.id}
            className={`surface-stone relative flex min-w-0 flex-col ${layout === 'wide' ? 'gap-1' : 'gap-0.5'} py-1 text-left transition-[filter,opacity] active:brightness-125
              px-1 ${current ? 'turn-glow' : ''} ${done ? 'opacity-55 saturate-50' : ''}`}
          >
            {me ? <span className="pointer-events-none absolute inset-0 rounded-[inherit] bg-bronze-300/10 ring-1 ring-inset ring-bronze-300/80" aria-hidden="true" /> : null}
            {big ? (
              // portrait: the portrait centred on top, as wide as the chip allows, the numbers below it
              <>
                <span className="flex justify-center">{portrait(Math.min(layout === 'wide' ? 66 : 55, Math.floor(scroll ? 64 : chipW) - 10))}</span>
                {layout === 'narrow' ? null : (
                  <span className={`block truncate text-center text-xs font-bold leading-tight ${me ? 'text-bronze-100' : 'text-fg'}`}>{name}</span>
                )}
                {chipW >= 108 ? (
                  <span className="flex items-center justify-center gap-2.5 text-xs font-bold leading-none">
                    <span className="flex items-center gap-1.5"><Points p={p} golems={golems} /></span>
                    <Counts hand={hand} played={played} className="!gap-1.5" />
                  </span>
                ) : (
                  <>
                    <span className="flex items-center justify-center gap-1.5 text-xs font-bold leading-none"><Points p={p} golems={golems} /></span>
                    <Counts hand={hand} played={played} className="justify-center !gap-1.5" />
                  </>
                )}
                <span className={chipW >= 80 ? '' : 'flex justify-center'}>
                  <Crystals caravan={p.caravan} gem={chipW >= 108 ? 12 : 10} grid={chipW < 80} />
                </span>
              </>
            ) : layout === 'wide' ? (
              <>
                <span className="flex min-w-0 items-center gap-1">
                  {portrait(34)}
                  <span className="flex min-w-0 flex-1 flex-col gap-1 leading-none">
                    <span className={`block truncate text-xs font-bold leading-tight ${me ? 'text-bronze-100' : 'text-fg'}`}>{name}</span>
                    <span className="flex items-center gap-1.5 text-xs font-bold"><Points p={p} golems={golems} /></span>
                    <Counts hand={hand} played={played} className="!gap-1.5" />
                  </span>
                </span>
                <Crystals caravan={p.caravan} gem={12} />
              </>
            ) : layout === 'medium' ? (
              <>
                <span className={`block truncate pl-0.5 text-xs font-bold leading-tight ${me ? 'text-bronze-100' : 'text-fg'}`}>{name}</span>
                <span className="flex min-w-0 items-center gap-1">
                  {portrait(28)}
                  <Stack><Points p={p} golems={golems} /></Stack>
                  {chipW >= 86 ? (
                    <Stack className="ml-auto font-semibold text-fg-muted">
                      <span className="inline-flex items-center gap-0.5"><HandIcon size={12} />{hand}</span>
                      <span className="inline-flex items-center gap-0.5"><PlayedIcon size={12} />{played}</span>
                    </Stack>
                  ) : null}
                </span>
                {chipW >= 86 ? null : <Counts hand={hand} played={played} className="!gap-1.5" />}
                <Crystals caravan={p.caravan} gem={10} />
              </>
            ) : (
              <>
                <span className="flex min-w-0 items-center gap-1">
                  {portrait(chipW >= 66 || scroll ? 28 : 26)}
                  <Stack><Points p={p} golems={golems} /></Stack>
                </span>
                <Counts hand={hand} played={played} className="!gap-1.5" />
                <Crystals caravan={p.caravan} gem={10} grid />
              </>
            )}
          </button>
        )
      })}
      <PlayerSheet playerId={sheet} onClose={() => setSheet(null)} />
    </div>
  )
}

export default PlayersInfoBar
