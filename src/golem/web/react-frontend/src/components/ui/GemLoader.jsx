import React from 'react'
import Gem, { CRYSTALS } from './Gem'

/** Busy indicator: the four crystals pulsing in turn (static when the user prefers less motion). */
const GemLoader = ({ size = 16, label = 'Loading', className = '' }) => (
  <span role="status" aria-label={label} className={`inline-flex items-center gap-1.5 ${className}`}>
    {CRYSTALS.map((c, i) => (
      <span key={c} className="animate-pulse" style={{ animationDelay: `${i * 0.18}s` }}>
        <Gem color={c} size={size} label={false} />
      </span>
    ))}
  </span>
)

export default GemLoader
