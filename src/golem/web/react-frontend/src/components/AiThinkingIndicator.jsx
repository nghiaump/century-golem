import React from 'react'

// "thinking…" marker shown on the AI whose turn it is (Hard/Very Hard think for 1.4–3 s).
const AiThinkingIndicator = ({ label = 'thinking', className = '' }) => (
  <span className={`inline-flex items-center gap-1 text-purple-200 ${className}`} role="status" aria-live="polite">
    <span className="flex gap-0.5" aria-hidden="true">
      <span className="w-1.5 h-1.5 rounded-full bg-purple-300 animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-1.5 h-1.5 rounded-full bg-purple-300 animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-1.5 h-1.5 rounded-full bg-purple-300 animate-bounce" style={{ animationDelay: '300ms' }} />
    </span>
    <span>{label}…</span>
  </span>
)

export default AiThinkingIndicator
