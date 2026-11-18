import React, { useRef, useState } from 'react'
import { getCardSpriteStyle, getCardImagePath } from '../../utils/cardNames'
import Coin from '../ui/Coin'
import Gem from '../ui/Gem'
import CardInspect from './CardInspect'
import { cardSummary } from './cardInfo'

const DEPOSIT_ORDER = ['yellow', 'green', 'blue', 'pink']

/**
 * One card on the board (market, golem row, hand). The art stays as printed; around it:
 * slot number, crystals lying on it, the coin a golem slot carries, and the state —
 * `ready` (you can take/claim/play it now: bronze glow + check) or `dim` (your turn, can't afford).
 * Hover/focus shows the details (desktop); `onInspect` replaces that (mobile tap → sheet). `showSlot={false}`
 * hides the slot number (small phone cards: it would cover the printed effect).
 * ⚠ Safari/WebKit: no `max-width: 100%` here — inside a shrink-to-fit wrapper it collapses the card to 0 px
 * wide (height comes from the parent, width from aspect-ratio). Grid layouts pass `className="max-w-full"`.
 */
const CardTile = ({ card, type = 'action', slot, placeCost, coin, ready = false, dim = false, onClick, onInspect, inspect = true, showSlot = true, className = '' }) => {
  const ref = useRef(null)
  const [hover, setHover] = useState(false)
  const timer = useRef(null)
  if (!card) return null

  const sprite = getCardSpriteStyle(card.name)
  const art = sprite || {
    backgroundImage: `url(${encodeURI(getCardImagePath(card.name))})`,
    backgroundSize: 'contain',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  }
  const deposits = DEPOSIT_ORDER.flatMap((c) => Array(Number(card.deposits?.[c]) || 0).fill(c))
  const label = [
    slot ? `${type === 'point' ? 'Golem' : 'Card'} ${slot}` : null,
    cardSummary(card, type),
    typeof placeCost === 'number' && type !== 'point' ? (placeCost === 0 ? 'free' : `place ${placeCost}`) : null,
    deposits.length ? `${deposits.length} crystal${deposits.length > 1 ? 's' : ''} on it` : null,
    coin ? `${coin.kind} coin` : null,
    ready ? 'available' : null,
  ].filter(Boolean).join(', ')

  const show = () => { if (inspect && !onInspect) { clearTimeout(timer.current); timer.current = setTimeout(() => setHover(true), 220) } }
  const hide = () => { clearTimeout(timer.current); setHover(false) }

  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-label={label}
        onClick={onInspect ? () => onInspect(card) : onClick}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className={`group relative block h-full max-h-full rounded-stone-sm transition-[transform,filter] duration-150
          ${ready ? 'hover:-translate-y-0.5' : ''} ${className}`}
        style={{ aspectRatio: '0.58' }}
      >
        <span
          className={`absolute inset-0 rounded-stone-sm border shadow-elev-1 transition-[filter]
            ${ready ? 'border-bronze-300 shadow-turn' : 'border-black/50'} ${dim ? 'saturate-50 brightness-75' : ''}`}
          style={{ ...art, backgroundColor: 'rgb(var(--rock-950))' }}
        />
        {slot && showSlot ? (
          <span className="absolute -left-1.5 -top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-bronze-700 bg-gradient-to-b from-bronze-300 to-bronze-500 font-display text-xs font-bold text-ink shadow-elev-1">
            {slot}
          </span>
        ) : null}
        {deposits.length ? (
          <span className="absolute -right-1.5 -top-1.5 z-10 flex max-w-[60%] flex-wrap justify-end gap-0.5 rounded-full bg-rock-950/85 px-1 py-0.5">
            {deposits.map((c, i) => <Gem key={i} color={c} size={13} label={false} />)}
          </span>
        ) : null}
        {coin ? (
          <span className="absolute -right-1.5 -top-1.5 z-10 flex items-center gap-0.5 rounded-full bg-rock-950/85 py-0.5 pl-0.5 pr-1.5 text-xs font-bold text-fg" title={`${coin.kind} coin, ${coin.left} left`}>
            <Coin kind={coin.kind} size={18} label={false} />{coin.left}
          </span>
        ) : null}
        {card.actionType === 1 && type !== 'point' && !(typeof placeCost === 'number' && dim) ? (
          <span className="absolute bottom-1 left-1/2 z-10 -translate-x-1/2 rounded-full bg-rock-950/85 px-2 py-0.5 text-xs font-bold text-bronze-100">
            ⇧{card.turnUpgrade || 1}
          </span>
        ) : null}
        {typeof placeCost === 'number' && type !== 'point' && dim ? (
          <span className="absolute bottom-1 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-rock-950/90 px-2 py-0.5 text-xs font-semibold text-fg">Place {placeCost}</span>
        ) : null}
        {ready ? (
          <span className="absolute -bottom-1.5 -right-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-bronze-700 bg-moss text-sm font-bold text-white shadow-elev-1" aria-hidden="true">✓</span>
        ) : null}
      </button>
      {hover ? <CardInspect anchor={ref.current} card={card} type={type} slot={slot} placeCost={type !== 'point' ? placeCost : undefined} coin={coin} /> : null}
    </>
  )
}

export default CardTile
