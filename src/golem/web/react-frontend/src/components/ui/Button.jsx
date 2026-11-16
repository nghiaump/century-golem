import React, { forwardRef } from 'react'

// Full class strings only (Tailwind can't see class names built from pieces).
const VARIANT = {
  primary:
    'text-ink border-bronze-700 bg-gradient-to-b from-bronze-300 to-bronze-500 shadow-bevel ' +
    'hover:from-bronze-100 hover:to-bronze-300 active:to-bronze-700',
  secondary:
    'surface-stone text-fg hover:brightness-125 active:brightness-95',
  danger:
    'text-white border-black/40 bg-gradient-to-b from-ember/80 to-ember shadow-bevel hover:brightness-110',
  ghost:
    'text-fg border-transparent bg-transparent hover:bg-rock-700/60',
  // on parchment (popups): ink outline instead of a stone slab
  outline:
    'text-ink border-ink/40 bg-transparent hover:bg-ink/10',
}
const SIZE = {
  sm: 'h-9 px-3 text-sm gap-1.5',   // desktop only (< 44px)
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-[52px] px-6 text-base gap-2',
}

/** Game button. Labels are static English, set in Cinzel. */
const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', block = false, icon, className = '', children, type = 'button', ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex items-center justify-center rounded-stone border font-display font-bold tracking-wide
        select-none transition-[filter,background-color,transform] duration-150 active:translate-y-px
        disabled:opacity-45 disabled:cursor-not-allowed disabled:active:translate-y-0 disabled:hover:brightness-100
        ${VARIANT[variant] || VARIANT.primary} ${SIZE[size] || SIZE.md} ${block ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {icon ? <span className="inline-flex flex-shrink-0" aria-hidden="true">{icon}</span> : null}
      {children}
    </button>
  )
})

/** Square icon-only button (44px; 36px with size="sm", desktop only). Needs an aria-label. */
export const IconButton = forwardRef(function IconButton(
  { label, variant = 'secondary', size = 'md', className = '', children, type = 'button', ...rest },
  ref
) {
  const box = size === 'sm' ? 'h-9 w-9' : 'h-11 w-11'
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center rounded-stone border transition-[filter,background-color] duration-150
        disabled:opacity-45 disabled:cursor-not-allowed ${VARIANT[variant] || VARIANT.secondary} ${box} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
})

export default Button
