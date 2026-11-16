import React from 'react'

const TONE = {
  neutral: 'bg-rock-700 text-fg border-rock-400/40',
  bronze: 'bg-bronze-500/25 text-bronze-100 border-bronze-500/60',
  moss: 'bg-moss/25 text-[rgb(190_230_180)] border-moss/60',
  ember: 'bg-ember/25 text-[rgb(255_200_185)] border-ember/60',
  teal: 'bg-teal/25 text-[rgb(190_232_228)] border-teal/60',
  ink: 'bg-ink/10 text-ink border-ink/30',
}

/** Small label. `pips` (1–4) adds dots, e.g. AI difficulty, so the meaning isn't carried by colour alone. */
const Pill = ({ tone = 'neutral', pips, className = '', children, ...rest }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold leading-4 whitespace-nowrap ${TONE[tone] || TONE.neutral} ${className}`}
    {...rest}
  >
    {pips ? (
      <span className="inline-flex gap-0.5" aria-hidden="true">
        {Array.from({ length: 4 }, (_, i) => (
          <span key={i} className={`h-1.5 w-1.5 rounded-full ${i < pips ? 'bg-current' : 'bg-current opacity-25'}`} />
        ))}
      </span>
    ) : null}
    {children}
  </span>
)

export default Pill
