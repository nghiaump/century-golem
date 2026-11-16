import React from 'react'

// Copper coin = 3 points, silver coin = 1 point (official rules). Drawn, not the photo, so it stays crisp.
const KIND = {
  copper: { fill: 'var(--coin-copper)', dark: 'var(--coin-copper-dark)', points: 3, name: 'Copper coin' },
  silver: { fill: 'var(--coin-silver)', dark: 'var(--coin-silver-dark)', points: 1, name: 'Silver coin' },
}

const Coin = ({ kind = 'copper', size = 20, label, className = '' }) => {
  const k = KIND[kind] || KIND.copper
  const a11y = label === false ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label || `${k.name} (${k.points} points)` }
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={`inline-block flex-shrink-0 ${className}`} {...a11y}>
      <circle cx="12" cy="12" r="11" style={{ fill: `rgb(${k.dark})` }} />
      <circle cx="12" cy="11.2" r="9.6" style={{ fill: `rgb(${k.fill})` }} />
      <circle cx="12" cy="11.2" r="7.4" fill="none" strokeWidth="1" style={{ stroke: `rgb(${k.dark} / 0.6)` }} />
      <text x="12" y="15" textAnchor="middle" fontSize="10" fontWeight="700" style={{ fill: `rgb(${k.dark})`, fontFamily: 'Cinzel, Georgia, serif' }}>
        {k.points}
      </text>
    </svg>
  )
}

export default Coin
