import React from 'react'
import { createPortal } from 'react-dom'
import CardImage from '../ui/CardImage'
import Coin from '../ui/Coin'
import { CrystalCost } from '../ui/CrystalRow'
import { cardKind, hasDeposits } from './cardInfo'

/** Card details: big art + what it does (gems, not emoji). Used by the hover popover and the mobile sheet. */
export const CardDetails = ({ card, type, slot, placeCost, coin }) => {
  const kind = cardKind(card, type)
  return (
    <div className="flex gap-3">
      <CardImage name={card.name} alt="" className="h-44 w-28 flex-shrink-0 rounded-stone-sm border border-black/40 shadow-elev-1" />
      <div className="flex min-w-0 flex-col gap-2 text-sm">
        <div className="font-display text-lg font-bold text-bronze-100">{kind}{slot ? <span className="text-sm text-fg-muted"> · slot {slot}</span> : null}</div>
        {kind === 'Golem' && (
          <>
            <div className="flex items-center gap-2"><span className="w-12 text-fg-muted">Cost</span><CrystalCost resources={card.requirement} size={18} /></div>
            <div className="flex items-center gap-2"><span className="w-12 text-fg-muted">Points</span><span className="font-display text-xl font-bold">{card.points}</span>
              {coin ? <span className="inline-flex items-center gap-1 text-fg-muted">+ <Coin kind={coin.kind} size={18} /> ({coin.left} left)</span> : null}
            </div>
          </>
        )}
        {kind === 'Produce' && <div className="flex items-center gap-2"><span className="text-fg-muted">Gain</span><CrystalCost resources={card.output} size={18} /></div>}
        {kind === 'Trade' && (
          <div className="flex flex-wrap items-center gap-2">
            <CrystalCost resources={card.input} size={18} /><span className="text-fg-muted">→</span><CrystalCost resources={card.output} size={18} />
            <span className="w-full text-xs text-fg-muted">Can be repeated as often as you can pay.</span>
          </div>
        )}
        {kind === 'Upgrade' && <div>Raise crystals by up to <b>{card.turnUpgrade || 1}</b> level{(card.turnUpgrade || 1) > 1 ? 's' : ''} in total.</div>}
        {typeof placeCost === 'number' && (
          <div className="text-fg-muted">{placeCost === 0 ? 'Free to take.' : `To take: place ${placeCost} crystal${placeCost > 1 ? 's' : ''}, one on each card to its left.`}</div>
        )}
        {hasDeposits(card) && (
          <div className="flex flex-wrap items-center gap-2"><span className="text-fg-muted">Crystals on it</span><CrystalCost resources={card.deposits} size={16} /></div>
        )}
      </div>
    </div>
  )
}

/** Hover/focus popover next to a card (portal, so it is never clipped by the panel). */
const CardInspect = ({ anchor, ...details }) => {
  if (!anchor) return null
  const r = anchor.getBoundingClientRect()
  const W = 360
  const H = 210
  const above = r.top > H + 16
  const top = above ? r.top - H - 8 : Math.min(window.innerHeight - H - 8, r.bottom + 8)
  const left = Math.max(8, Math.min(window.innerWidth - W - 8, r.left + r.width / 2 - W / 2))
  return createPortal(
    <div role="tooltip" className="surface-stone pointer-events-none fixed z-popover p-3" style={{ top, left, width: W }}>
      <CardDetails {...details} />
    </div>,
    document.body
  )
}

export default CardInspect
