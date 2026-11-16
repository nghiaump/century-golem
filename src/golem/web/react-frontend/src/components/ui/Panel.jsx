import React from 'react'

const SURFACE = { stone: 'surface-stone', inset: 'surface-inset', parchment: 'surface-parchment' }

/**
 * Carved stone (default), sunken inset, or parchment surface with an optional engraved title.
 * `glow` = it's this panel's owner's turn.
 */
const Panel = ({ variant = 'stone', title, actions, glow = false, className = '', bodyClassName = '', as: Tag = 'section', children, ...rest }) => (
  <Tag className={`${SURFACE[variant] || SURFACE.stone} ${glow ? 'turn-glow' : ''} flex flex-col min-h-0 ${className}`} {...rest}>
    {title || actions ? (
      <header className="flex items-center justify-between gap-2 px-3 pt-2 pb-1">
        {title ? (
          <h2 className={`font-display text-xs font-bold uppercase ${variant === 'parchment' ? 'text-ink-muted' : 'text-bronze-300 text-engrave'}`}>
            {title}
          </h2>
        ) : <span />}
        {actions ? <div className="flex items-center gap-1.5">{actions}</div> : null}
      </header>
    ) : null}
    <div className={`flex-1 min-h-0 ${title || actions ? 'px-3 pb-3' : 'p-3'} ${bodyClassName}`}>{children}</div>
  </Tag>
)

export default Panel
