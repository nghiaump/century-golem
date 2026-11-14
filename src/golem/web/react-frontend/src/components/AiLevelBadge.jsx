import React from 'react'
import { aiLevelInfo } from '../utils/aiLevel'

// Small level pill next to an AI's name on the board (upstream Tailwind style, not XP).
const AiLevelBadge = ({ level, className = '' }) => {
  const info = aiLevelInfo(level)
  if (!info) return null
  return (
    <span
      className={`inline-block align-middle ml-1 px-1.5 py-px rounded text-[10px] leading-4 font-bold text-white ${info.board} ${className}`}
      title={`AI · ${info.label}`}
    >
      {info.label}
    </span>
  )
}

export default AiLevelBadge
