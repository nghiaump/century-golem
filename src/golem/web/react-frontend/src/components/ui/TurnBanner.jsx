import React from 'react'
import Gem from './Gem'

/** "Your turn" ribbon (+ seconds left). Announced once to screen readers when it appears. */
const TurnBanner = ({ show, seconds, label = 'Your turn', className = '' }) => {
  if (!show) return null
  return (
    <div
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-2 rounded-stone border border-bronze-700 bg-gradient-to-b from-bronze-300 to-bronze-500
        px-3 py-1.5 text-ink shadow-bevel ${className}`}
    >
      <Gem color="yellow" size={16} label={false} />
      <span className="whitespace-nowrap font-display text-sm font-bold uppercase tracking-wider">{label}</span>
      {typeof seconds === 'number' ? (
        <span className={`tabular-nums text-sm font-bold ${seconds <= 10 ? 'text-[rgb(140_28_14)] animate-pulse' : ''}`}>{seconds}s</span>
      ) : null}
    </div>
  )
}

export default TurnBanner
