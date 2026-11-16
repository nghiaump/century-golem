import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import useGameStore from '../store/gameStore'
import Modal from './ui/Modal'
import Button from './ui/Button'
import Avatar from './ui/Avatar'
import Coin from './ui/Coin'
import Gem, { CRYSTALS } from './ui/Gem'
import GolemIcon from './ui/GolemIcon'

// Final score = golem points + coin points + 1 per non-yellow crystal (official rules).
export function scoreOf(player) {
  const golems = player?.pointCards?.reduce((s, c) => s + (c.points || 0), 0) || 0
  const coins = player?.coins?.reduce((s, c) => s + (c.points || 0), 0) || 0
  const res = player?.caravan || player?.resources || {}
  const crystals = (res.green || 0) + (res.blue || 0) + (res.pink || 0)
  return { golems, coins, crystals, total: golems + coins + crystals }
}

const reducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

// A short shower of crystals over the result, computed once per finished game.
function GemShower({ seed }) {
  const gems = useMemo(() => {
    let a = seed >>> 0
    const rnd = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296 }
    return Array.from({ length: 24 }, (_, i) => ({
      id: i, color: CRYSTALS[i % 4], left: rnd() * 100, delay: rnd() * 1.6, duration: 2.6 + rnd() * 1.6, size: 14 + rnd() * 14, spin: (rnd() - 0.5) * 540,
    }))
  }, [seed])
  if (reducedMotion()) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-modal overflow-hidden" aria-hidden="true">
      {gems.map((g) => (
        <motion.div
          key={g.id}
          className="absolute -top-8"
          style={{ left: `${g.left}%` }}
          initial={{ y: 0, rotate: 0, opacity: 1 }}
          animate={{ y: '110vh', rotate: g.spin, opacity: [1, 1, 0] }}
          transition={{ duration: g.duration, delay: g.delay, ease: 'easeIn' }}
        >
          <Gem color={g.color} size={g.size} label={false} />
        </motion.div>
      ))}
    </div>
  )
}

const rankLabel = (i) => ['1st', '2nd', '3rd', '4th', '5th'][i] || `${i + 1}th`

/** End of game: winner, full scoreboard with the breakdown, coins left, Play Again / Back to Menu. */
const GameOverModal = ({ onNewGame, onBackToMenu }) => {
  const gameState = useGameStore((s) => s.gameState)
  const myId = useGameStore((s) => s.myPlayer?.id)
  if (!gameState?.gameOver) return null

  const players = gameState.players || []
  const winner = players.find((p) => p.id === gameState.winner?.id) || gameState.winner
  const coins = gameState.market?.coins || []
  const copperLeft = coins[0]?.amount ?? 0
  const silverLeft = coins[1]?.amount ?? 0

  // highest total first; ties: the player later in turn order ranks first (official rule — the server
  // already picked the winner that way)
  const ranked = [...players]
    .map((p, seat) => ({ p, seat, s: scoreOf(p) }))
    .sort((a, b) => b.s.total - a.s.total || b.seat - a.seat)
  const winnerScore = scoreOf(winner).total
  const wonOnTieBreak = ranked.filter((r) => r.s.total === winnerScore).length > 1

  return (
    <>
      <GemShower seed={(gameState.currentTurn || 1) * 7919} />
      <Modal
        open
        dismissible={false}
        variant="stone"
        size="lg"
        title="Game Over"
        footer={(
          <>
            <Button variant="secondary" onClick={onBackToMenu}>Back to Menu</Button>
            <Button onClick={onNewGame}>Play Again</Button>
          </>
        )}
      >
        <div className="flex flex-col gap-5">
          {/* Winner */}
          <div className="flex items-center gap-4 rounded-stone border border-bronze-500/60 bg-bronze-500/15 px-4 py-3">
            <Avatar player={winner} size={64} turn />
            <div className="min-w-0">
              <div className="font-display text-xs font-bold uppercase tracking-widest text-bronze-300">Winner</div>
              <div className="truncate font-display text-2xl font-bold text-bronze-100">
                {winner?.id === myId ? 'You win!' : winner?.name || 'Unknown'}
              </div>
              <div className="text-sm text-fg-muted">
                {winnerScore} points{wonOnTieBreak ? ' · tied on points, the player later in turn order wins' : ''}
              </div>
            </div>
          </div>

          {/* Scoreboard */}
          <ol className="surface-parchment flex flex-col divide-y divide-ink/15 !rounded-stone !shadow-none" aria-label="Final scores">
            {ranked.map(({ p, s }, i) => (
              <li key={p.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 ${p.id === winner?.id ? 'bg-bronze-300/25' : ''}`}>
                <span className="w-9 font-display text-sm font-bold text-ink-muted">{rankLabel(i)}</span>
                <Avatar player={p} size={36} />
                <span className="min-w-0 flex-1 truncate font-semibold text-ink">
                  {p.name}{p.id === myId ? <span className="text-ink-muted"> (you)</span> : null}
                </span>
                <span className="order-last flex w-full flex-wrap items-center gap-x-4 gap-y-1 pl-12 text-sm text-ink-muted sm:order-none sm:w-auto sm:pl-0">
                  <span className="inline-flex items-center gap-1" title="Golems">
                    <GolemIcon size={16} label="Golems" /> {p.pointCards?.length || 0} · {s.golems}
                  </span>
                  <span className="inline-flex items-center gap-1" title="Coins">
                    <Coin kind="copper" size={16} label={false} />×{p.coins?.filter((c) => c.points === 3).length || 0}
                    <Coin kind="silver" size={16} label={false} />×{p.coins?.filter((c) => c.points === 1).length || 0}
                    <span className="sr-only">coins worth</span> · {s.coins}
                  </span>
                  <span className="inline-flex items-center gap-1" title="Green, blue and pink crystals: 1 point each">
                    <Gem color="pink" size={14} label={false} /> {s.crystals}
                  </span>
                </span>
                <span className="font-display text-xl font-bold tabular-nums text-ink">{s.total}</span>
              </li>
            ))}
          </ol>

          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-fg-muted">
            <span>Coins left:</span>
            <span className="inline-flex items-center gap-1"><Coin kind="copper" size={18} /> {copperLeft}</span>
            <span className="inline-flex items-center gap-1"><Coin kind="silver" size={18} /> {silverLeft}</span>
          </div>
        </div>
      </Modal>
    </>
  )
}

export default GameOverModal
