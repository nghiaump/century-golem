import React from 'react'
import Gem from './ui/Gem'

// "<AI> is thinking…" marker (Hard/Very Hard think for 1.4–3 s): three crystals pulsing in turn.
const AiThinkingIndicator = ({ label = 'thinking', className = '' }) => (
  <span className={`inline-flex items-center gap-1.5 text-fg-muted ${className}`} role="status" aria-live="polite">
    <span className="flex gap-0.5" aria-hidden="true">
      {['blue', 'green', 'pink'].map((c, i) => (
        <span key={c} className="animate-pulse" style={{ animationDelay: `${i * 0.2}s` }}><Gem color={c} size={12} label={false} /></span>
      ))}
    </span>
    <span className="truncate">{label}…</span>
  </span>
)

export default AiThinkingIndicator
