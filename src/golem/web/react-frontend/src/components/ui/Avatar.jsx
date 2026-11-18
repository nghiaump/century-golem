import React from 'react'
import PlayerAvatar from '../PlayerAvatar'

// Timer ring colour by time left (share of the turn).
const ringColor = (f) => (f > 0.5 ? 'rgb(var(--moss))' : f > 0.2 ? 'rgb(var(--bronze-300))' : 'rgb(var(--ember))')

/**
 * Player portrait in a bronze ring. `turn` lights the ring; `timer` = {remaining, total} (seconds)
 * draws the time left around it. `restAnchor` marks it as the anchor of the opponent rest popup.
 * `fit`: `size` is the whole box and the portrait fills it up to a thin 2px ring — that ring is what
 * pulses on the player's turn / shows the timer (small phone chips: biggest portrait, no gap).
 */
const Avatar = ({ player, size = 48, turn = false, timer, offline = false, restAnchor = false, fit = false, className = '' }) => {
  const f = timer && timer.total > 0 ? Math.max(0, Math.min(1, timer.remaining / timer.total)) : null
  if (fit) {
    const band = 2
    const r = (size - band) / 2
    const circ = 2 * Math.PI * r
    return (
      <span
        className={`relative inline-flex flex-shrink-0 items-center justify-center rounded-full border-2
          ${f !== null ? 'border-transparent' : turn ? 'turn-ring border-bronze-300' : 'border-bronze-500/60'} ${className}`}
        style={{ width: size, height: size }}
      >
        {f !== null ? (
          <svg className="absolute -inset-[2px] -rotate-90" width={size} height={size} aria-hidden="true">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={band} style={{ stroke: 'rgb(var(--rock-950) / 0.7)' }} />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              strokeWidth={band}
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - f)}
              style={{ stroke: ringColor(f), transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
              className={f <= 0.2 ? 'animate-pulse' : ''}
            />
          </svg>
        ) : null}
        <PlayerAvatar
          player={player}
          restAnchor={restAnchor}
          className={`rounded-full bg-rock-700 text-fg text-sm ${offline ? 'opacity-50 grayscale' : ''}`}
          style={{ width: size - band * 2, height: size - band * 2 }}
        />
      </span>
    )
  }
  const stroke = Math.max(3, Math.round(size / 14))
  const box = size + stroke * 2 + 4
  const r = (box - stroke) / 2
  const circ = 2 * Math.PI * r
  return (
    <span
      className={`relative inline-flex flex-shrink-0 items-center justify-center rounded-full ${turn ? 'turn-glow' : ''} ${className}`}
      style={{ width: box, height: box }}
    >
      {f !== null ? (
        <svg className="absolute inset-0 -rotate-90" width={box} height={box} aria-hidden="true">
          <circle cx={box / 2} cy={box / 2} r={r} fill="none" strokeWidth={stroke} style={{ stroke: 'rgb(var(--rock-950) / 0.7)' }} />
          <circle
            cx={box / 2}
            cy={box / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - f)}
            style={{ stroke: ringColor(f), transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
            className={f <= 0.2 ? 'animate-pulse' : ''}
          />
        </svg>
      ) : null}
      <PlayerAvatar
        player={player}
        restAnchor={restAnchor}
        className={`rounded-full border-2 bg-rock-700 text-fg text-sm ${turn ? 'border-bronze-300' : 'border-bronze-500/70'} ${offline ? 'opacity-50 grayscale' : ''}`}
        style={{ width: size, height: size }}
      />
    </span>
  )
}

export default Avatar
