import React from 'react'
import Gem, { CRYSTALS } from './Gem'

const totalOf = (res) => CRYSTALS.reduce((n, c) => n + (res?.[c] || 0), 0)

const TEXT = { xs: 'text-xs', sm: 'text-sm', md: 'text-base', lg: 'text-lg' }
const GEM = { xs: 14, sm: 16, md: 20, lg: 24 }

/**
 * A player's crystals: one gem + count per colour (zeros dimmed). `capacity` adds "7/10".
 * Accessible as one label ("3 yellow, 1 green, …") instead of eight separate images.
 */
const CrystalRow = ({ resources, size = 'sm', capacity, showZero = true, className = '', tone = 'stone' }) => {
  const total = totalOf(resources)
  const label = CRYSTALS.map((c) => `${resources?.[c] || 0} ${c}`).join(', ') + (capacity ? `, ${total} of ${capacity}` : '')
  const muted = tone === 'parchment' ? 'text-ink-muted' : 'text-fg-muted'
  return (
    <div className={`inline-flex items-center gap-2 ${TEXT[size]} ${className}`} role="group" aria-label={`Crystals: ${label}`}>
      {CRYSTALS.map((c) => {
        const n = resources?.[c] || 0
        if (!showZero && n === 0) return null
        return (
          <span key={c} className={`inline-flex items-center gap-0.5 font-semibold tabular-nums ${n === 0 ? 'opacity-40' : ''}`}>
            <Gem color={c} size={GEM[size]} label={false} />
            <span aria-hidden="true">{n}</span>
          </span>
        )
      })}
      {capacity ? (
        <span aria-hidden="true" className={`tabular-nums font-semibold ${total > capacity ? 'text-ember' : muted}`}>
          {total}/{capacity}
        </span>
      ) : null}
    </div>
  )
}

/**
 * A price or a trade side: the gems themselves, repeated (≤ 5 of a colour) or "gem ×n" beyond that.
 * `resources` is a {yellow, green, blue, pink} count map.
 */
export const CrystalCost = ({ resources, size = 16, className = '', max = 5 }) => {
  const label = CRYSTALS.filter((c) => resources?.[c]).map((c) => `${resources[c]} ${c}`).join(', ') || 'nothing'
  return (
    <span className={`inline-flex flex-wrap items-center gap-0.5 ${className}`} role="img" aria-label={label}>
      {CRYSTALS.map((c) => {
        const n = resources?.[c] || 0
        if (!n) return null
        if (n > max) {
          return (
            <span key={c} className="inline-flex items-center gap-0.5 font-semibold tabular-nums">
              <Gem color={c} size={size} label={false} />×{n}
            </span>
          )
        }
        return Array.from({ length: n }, (_, i) => <Gem key={`${c}${i}`} color={c} size={size} label={false} />)
      })}
    </span>
  )
}

export default CrystalRow
