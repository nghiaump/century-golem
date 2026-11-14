import React from 'react'
import useGameStore from '../store/gameStore'
import { aiLevelInfo } from '../utils/aiLevel'

// The one difficulty badge of a game, under the theme (✨) toggle in the top-left corner — the
// player cards stay clean. Shows the AIs' level ("Mixed" if a room ever mixes levels); hidden when
// there are no AIs (multiplayer).
const DifficultyBadge = () => {
  const players = useGameStore((s) => s.gameState?.players) || []
  const levels = [...new Set(players.filter((p) => p.isAI && p.aiLevel).map((p) => p.aiLevel))]
  if (levels.length === 0) return null
  const info = levels.length === 1 ? aiLevelInfo(levels[0]) : null
  return (
    <div
      className={`fixed top-[52px] left-2 z-50 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] leading-4 font-bold text-white whitespace-nowrap shadow-lg border border-white/30 pointer-events-none select-none ${info?.board || 'bg-slate-600/80'}`}
      title="AI difficulty"
      aria-label={`AI difficulty: ${info?.label || 'Mixed'}`}
    >
      {info?.label || 'Mixed'}
    </div>
  )
}

export default DifficultyBadge
