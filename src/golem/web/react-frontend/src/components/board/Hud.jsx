import React from 'react'
import useGameStore from '../../store/gameStore'
import DifficultyBadge from '../DifficultyBadge'
import SoundToggleButton from '../SoundToggleButton'
import ThemeToggleButton from '../ThemeToggleButton'
import CollapsibleInfo from '../CollapsibleInfo'
import Pill from '../ui/Pill'

/**
 * Corner controls of the game screen, in one place: top-left plaque (round, AI level, last round),
 * top-right cluster (✨ layout switch on desktop, sound, activity & chat).
 */
const Hud = ({ sessionId, showSkinToggle = false, compact = false }) => {
  const round = useGameStore((s) => s.gameState?.round)
  const lastRound = useGameStore((s) => s.gameState?.lastRound)
  const started = useGameStore((s) => !!s.gameState?.market && Object.keys(s.gameState.market).length > 0)
  const inset = { top: 'max(8px, var(--safe-top))' }
  return (
    <>
      {!compact && started ? (
        <div className="fixed left-3 z-hud flex items-center gap-2" style={inset}>
          <div className="surface-stone flex h-11 items-center gap-2 px-3">
            <span className="font-display text-sm font-bold text-bronze-100">Round {round || 1}</span>
            <DifficultyBadge />
            {lastRound ? <Pill tone="ember">Last round</Pill> : null}
          </div>
        </div>
      ) : null}
      <div className="fixed right-3 z-hud flex items-center gap-2" style={{ ...inset, right: 'max(12px, var(--safe-right))' }}>
        {showSkinToggle ? <ThemeToggleButton /> : null}
        <SoundToggleButton />
        <CollapsibleInfo sessionId={sessionId} />
      </div>
    </>
  )
}

export default Hud
