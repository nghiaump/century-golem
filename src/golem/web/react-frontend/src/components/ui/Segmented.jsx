import React from 'react'
import { FieldLabel } from './Field'

/**
 * Radio group drawn as stone segments. Native radios stay in the DOM (visually hidden) with the given
 * `name` and string values, so forms, tests and screen readers work as usual.
 * options: [{ value, label, hint?, title?, extra? }]  — `extra` renders inside the segment (e.g. a Pill).
 */
const Segmented = ({ name, label, value, onChange, options, columns, stacked = false, className = '' }) => {
  const labelId = `${name}-label`
  const grid = stacked ? 'flex flex-col' : 'grid'
  const cols = columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label ? <FieldLabel id={labelId}>{label}</FieldLabel> : null}
      <div role="radiogroup" aria-labelledby={label ? labelId : undefined} className={`${grid} gap-1.5`} style={cols}>
        {options.map((o) => {
          const selected = String(value) === String(o.value)
          return (
            <label
              key={o.value}
              title={o.title}
              className={`relative flex min-h-[44px] cursor-pointer items-center gap-2 rounded-stone-sm border px-3 py-2 transition-colors
                ${stacked ? 'justify-start' : 'justify-center text-center'}
                ${selected
                  ? 'border-bronze-300 bg-gradient-to-b from-bronze-500/45 to-bronze-700/40 text-bronze-100 shadow-bevel'
                  : 'border-black/40 bg-rock-950/50 text-fg hover:border-bronze-500/60 hover:bg-rock-700/50'}
                has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-bronze-300`}
            >
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={selected}
                onChange={(e) => onChange(e.target.value)}
                className="sr-only"
              />
              {o.extra ? <span className="flex-shrink-0">{o.extra}</span> : null}
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-semibold">{o.label}</span>
                {o.hint ? <span className={`text-xs ${selected ? 'text-bronze-100/80' : 'text-fg-muted'}`}>{o.hint}</span> : null}
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )
}

export default Segmented
