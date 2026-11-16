import React, { forwardRef } from 'react'

const INPUT = `h-11 w-full rounded-stone-sm border border-black/50 bg-rock-950/70 px-3 text-base text-fg
  shadow-[inset_0_2px_4px_rgb(0_0_0/0.45)] placeholder:text-fg-muted/60
  focus:border-bronze-300 focus:outline-none focus-visible:outline-2 focus-visible:outline-bronze-300`

/** Label + text input on stone. `hint` shows under the field. Extra props go to the <input>. */
const Field = forwardRef(function Field({ id, label, hint, className = '', inputClassName = '', mono = false, ...rest }, ref) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label ? <label htmlFor={id} className="font-display text-xs font-bold uppercase tracking-wider text-bronze-300">{label}</label> : null}
      <input ref={ref} id={id} className={`${INPUT} ${mono ? 'font-mono text-sm' : ''} ${inputClassName}`} {...rest} />
      {hint ? <span className="text-xs text-fg-muted">{hint}</span> : null}
    </div>
  )
})

/** Section label used above choice groups (not tied to one input). */
export const FieldLabel = ({ children, id }) => (
  <span id={id} className="font-display text-xs font-bold uppercase tracking-wider text-bronze-300">{children}</span>
)

export default Field
