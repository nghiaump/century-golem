import React from 'react'

/** Cards played since the last rest (a small stack). */
export const PlayedIcon = ({ size = 16, className = '' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true" className={className}>
    <rect x="7" y="3" width="11" height="16" rx="2" /><path d="M5 6.5v12a2 2 0 002 2h8" />
  </svg>
)

/** Cards in hand (a fan). */
export const HandIcon = ({ size = 16, className = '' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true" className={className}>
    <rect x="3.5" y="6" width="9" height="13" rx="1.5" transform="rotate(-12 8 12.5)" />
    <rect x="11" y="5" width="9" height="13" rx="1.5" transform="rotate(10 15.5 11.5)" />
  </svg>
)
