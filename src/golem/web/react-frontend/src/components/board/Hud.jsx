import React from 'react'
import useGameStore from '../../store/gameStore'
import DifficultyBadge from '../DifficultyBadge'
import SoundToggleButton from '../SoundToggleButton'
import ThemeToggleButton from '../ThemeToggleButton'
import CollapsibleInfo from '../CollapsibleInfo'
import Pill from '../ui/Pill'

/** "Round N · AI level · Last round". */
export const RoundInfo = ({ compact = false, className = '' }) => {
  const round = useGameStore((s) => s.gameState?.round)
  const lastRound = useGameStore((s) => s.gameState?.lastRound)
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <span className="font-display text-sm font-bold text-bronze-100">{compact ? `R${round || 1}` : `Round ${round || 1}`}</span>
      <DifficultyBadge />
      {lastRound ? <Pill tone="ember">Last round</Pill> : null}
    </span>
  )
}

/** ✨ layout switch (desktop) · sound · activity & chat. `size="sm"` (36px) inside a desktop panel header. */
export const HudButtons = ({ sessionId, showSkinToggle = false, size = 'md' }) => (
  <span className="flex items-center gap-2">
    {showSkinToggle ? <ThemeToggleButton size={size} /> : null}
    <SoundToggleButton size={size} />
    <CollapsibleInfo sessionId={sessionId} size={size} />
  </span>
)

/**
 * Floating corner controls (phones, ✨ table, waiting room): top-left plaque with the round, top-right
 * buttons. The standard desktop board puts the same pieces in its Market header instead (no empty band on top).
 */
const Hud = ({ sessionId, showSkinToggle = false, compact = false, showRound = true }) => {
  const started = useGameStore((s) => !!s.gameState?.market && Object.keys(s.gameState.market).length > 0)
  const inset = { top: 'max(8px, var(--safe-top))' }
  return (
    <>
      {started && showRound ? (
        <div className="fixed z-hud flex items-center gap-2" style={{ ...inset, left: 'max(12px, var(--safe-left))' }}>
          <div className="surface-stone flex h-11 items-center px-3"><RoundInfo compact={compact} /></div>
        </div>
      ) : null}
      <div className="fixed z-hud" style={{ ...inset, right: 'max(12px, var(--safe-right))' }}>
        <HudButtons sessionId={sessionId} showSkinToggle={showSkinToggle} />
      </div>
    </>
  )
}

export default Hud
