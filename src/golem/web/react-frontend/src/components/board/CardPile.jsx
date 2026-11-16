import React from 'react'
import CardImage from '../ui/CardImage'
import Gem from '../ui/Gem'

/**
 * A small stack of cards (history, played cards, my golems): top card + count, the whole tile is one
 * button that opens the list. `top` = card to show (null + `restTop` shows a rest marker).
 */
const CardPile = ({ title, count, top, restTop = false, empty, onOpen, footer, dim = false }) => (
  <button
    type="button"
    onClick={count ? onOpen : undefined}
    disabled={!count}
    aria-label={count ? `${title}: ${count}, show all` : `${title}: ${empty}`}
    className="surface-inset group flex h-full w-full min-w-0 flex-col items-center gap-1.5 px-2 py-2 text-left enabled:cursor-pointer enabled:hover:border-bronze-500/60 disabled:cursor-default"
  >
    <span className="font-display text-xs font-bold uppercase tracking-wider text-bronze-300">{title}</span>
    <span className="relative flex min-h-0 flex-1 items-center justify-center">
      {count ? (
        <span className="relative h-full max-h-36" style={{ aspectRatio: '0.58' }}>
          {count > 1 && <span className="absolute inset-0 translate-x-1 translate-y-1 rotate-[4deg] rounded-stone-sm border border-black/40 bg-rock-700" />}
          {top ? (
            <CardImage name={top.name} className={`relative h-full w-full rounded-stone-sm border border-black/50 shadow-elev-1 transition-transform group-hover:-translate-y-0.5 ${dim ? 'opacity-75 saturate-50' : ''}`} />
          ) : restTop ? (
            <span className="relative flex h-full w-full flex-col items-center justify-center gap-1 rounded-stone-sm border border-black/50 bg-rock-800">
              <span className="flex gap-0.5"><Gem color="blue" size={12} label={false} /><Gem color="pink" size={12} label={false} /></span>
              <span className="font-display text-xs font-bold text-bronze-100">Rest</span>
            </span>
          ) : null}
          <span className="absolute -right-2 -top-2 flex h-6 min-w-[24px] items-center justify-center rounded-full border border-bronze-700 bg-gradient-to-b from-bronze-300 to-bronze-500 px-1 text-xs font-bold text-ink">{count}</span>
        </span>
      ) : (
        <span className="flex h-full max-h-36 items-center justify-center rounded-stone-sm border-2 border-dashed border-rock-400/40 px-2 text-center text-xs text-fg-muted" style={{ aspectRatio: '0.58' }}>{empty}</span>
      )}
    </span>
    {footer ? <span className="text-xs text-fg-muted">{footer}</span> : null}
  </button>
)

export default CardPile
