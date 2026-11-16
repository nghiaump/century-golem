import React from 'react'

/** − value + with 44px buttons. `format` shapes the value (e.g. v => `×${v}`). */
const Stepper = ({ value, min = 0, max = Infinity, onChange, label, format = (v) => v, tone = 'parchment', className = '' }) => {
  const btn = tone === 'parchment'
    ? 'border-ink/40 text-ink hover:bg-ink/10'
    : 'border-bronze-500/50 text-fg hover:bg-rock-700/60'
  const cls = `inline-flex h-11 w-11 items-center justify-center rounded-stone border text-2xl font-bold leading-none transition-colors
    disabled:cursor-not-allowed disabled:opacity-35 ${btn}`
  return (
    <div className={`inline-flex items-center gap-2 ${className}`} role="group" aria-label={label}>
      <button type="button" className={cls} onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`Fewer${label ? ` ${label}` : ''}`}>−</button>
      <output aria-live="polite" className="min-w-[3ch] text-center font-display text-2xl font-bold tabular-nums">{format(value)}</output>
      <button type="button" className={cls} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`More${label ? ` ${label}` : ''}`}>+</button>
    </div>
  )
}

export default Stepper
