import React from 'react'

// Golem head (claimed golems / golem counts) — replaces the 🗿 / 🎭 emoji. Uses currentColor.
const GolemIcon = ({ size = 16, className = '', label }) => {
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true }
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={`inline-block flex-shrink-0 ${className}`} fill="currentColor" {...a11y}>
      <path d="M7 3h10l3 4v7l-2 3v4H6v-4l-2-3V7z" opacity="0.9" />
      <path d="M8.2 9.2h2.6v2.2H8.2zM13.2 9.2h2.6v2.2h-2.6z" style={{ fill: 'rgb(var(--gem-blue-light))' }} />
      <path d="M9 15h6v1.6H9z" opacity="0.45" fill="rgb(0 0 0)" />
    </svg>
  )
}

export default GolemIcon
