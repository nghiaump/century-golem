import React from 'react'
import useGameStore from '../store/gameStore'
import LevelPill from './LevelPill'
import Pill from './ui/Pill'

// The AIs' difficulty for the whole game ("Mixed" if a room ever mixes levels); nothing when there
// are no AIs (multiplayer). Placed by the HUD (top-left plaque).
const DifficultyBadge = ({ className = '' }) => {
  const players = useGameStore((s) => s.gameState?.players) || []
  const levels = [...new Set(players.filter((p) => p.isAI && p.aiLevel).map((p) => p.aiLevel))]
  if (levels.length === 0) return null
  return (
    <span className={`inline-flex ${className}`} title="AI difficulty">
      {levels.length === 1 ? <LevelPill level={levels[0]} /> : <Pill>Mixed</Pill>}
    </span>
  )
}

export default DifficultyBadge
