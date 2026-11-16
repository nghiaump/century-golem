import React, { useState } from 'react'
import useGameStore from '../store/gameStore'
import Modal from './ui/Modal'
import Button from './ui/Button'
import Gem from './ui/Gem'
import CardImage from './ui/CardImage'
import CrystalRow from './ui/CrystalRow'
import { COLORS, MAX_CARAVAN, add, cheapestList, of, sub, total } from '../utils/crystals'

const NAME = { yellow: 'yellow', green: 'green', blue: 'blue', pink: 'pink' }

/**
 * Buying market card k: place one crystal on each card to its left (official rule), then take it with
 * any crystals lying on it. Starts with the cheapest crystals placed (yellow first) — change any slot.
 */
const DepositModal = ({ card, cardIndex, isHandCard = false, onClose }) => {
  const { myPlayer, acquireCard } = useGameStore()
  const caravan = of(myPlayer?.caravan)
  const slots = isHandCard ? 0 : cardIndex
  // one entry per card to the left; null while the caravan can't cover it
  const [deposits, setDeposits] = useState(() => {
    const picked = cheapestList(caravan, slots)
    return [...picked, ...Array(Math.max(0, slots - picked.length)).fill(null)]
  })

  if (!card || !myPlayer || isHandCard) return null

  const placed = COLORS.reduce((m, c) => ({ ...m, [c]: deposits.filter((d) => d === c).length }), {})
  const pickedUp = of(card.deposits)
  const after = add(sub(caravan, placed), pickedUp)
  const overflow = total(after) - MAX_CARAVAN
  const canConfirm = deposits.length === slots && deposits.every(Boolean)

  const choose = (slot, color) => setDeposits((prev) => prev.map((d, i) => (i === slot ? color : d)))

  const handleConfirm = () => {
    if (!canConfirm) return
    acquireCard(cardIndex, deposits.map((crystal) => ({ crystal })), card)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={slots === 0 ? 'Take Card' : 'Place Crystals'}
      icon={<CardImage name={card.name} className="h-14 w-10 rounded-stone-sm border border-ink/30" />}
      footer={(
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>{slots === 0 ? 'Take Card' : 'Place & Take'}</Button>
        </>
      )}
    >
      <div className="flex flex-col gap-4">
        <p className="text-center text-sm text-ink-muted">
          {slots === 0
            ? 'The first card is free.'
            : `Card ${cardIndex + 1} costs one crystal on each of the ${slots} card${slots > 1 ? 's' : ''} to its left. Cheapest crystals are picked — tap to change.`}
        </p>

        {deposits.map((chosen, slot) => {
          const othersUse = (c) => deposits.filter((d, i) => d === c && i !== slot).length
          return (
            <div key={slot} className="flex flex-wrap items-center gap-3 rounded-stone border border-ink/15 bg-ink/5 px-3 py-2">
              <span className="w-16 font-display text-sm font-bold text-ink">Card {slot + 1}</span>
              <div role="radiogroup" aria-label={`Crystal for card ${slot + 1}`} className="flex flex-1 flex-wrap gap-1.5">
                {COLORS.map((c) => {
                  const free = caravan[c] - othersUse(c)
                  const selected = chosen === c
                  return (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={`${NAME[c]} (${free} left)`}
                      disabled={!selected && free <= 0}
                      onClick={() => choose(slot, c)}
                      className={`inline-flex h-11 min-w-[56px] items-center justify-center gap-1 rounded-stone border px-2 text-sm font-semibold tabular-nums transition-colors
                        disabled:cursor-not-allowed disabled:opacity-30
                        ${selected ? 'border-bronze-700 bg-bronze-300/50 text-ink shadow-bevel' : 'border-ink/25 text-ink-muted hover:bg-ink/10'}`}
                    >
                      <Gem color={c} size={20} label={false} />
                      {free}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}

        {total(pickedUp) > 0 ? (
          <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-ink-muted">
            You also pick up: <CrystalRow resources={pickedUp} showZero={false} size="sm" tone="parchment" />
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-ink-muted">
          After: <CrystalRow resources={after} capacity={MAX_CARAVAN} size="sm" tone="parchment" />
        </div>
        {overflow > 0 ? (
          <p className="rounded-stone-sm border border-bronze-700/50 bg-bronze-300/25 px-3 py-2 text-center text-sm text-ink">
            You will have {total(after)} crystals and must discard {overflow}.
          </p>
        ) : null}
      </div>
    </Modal>
  )
}

export default DepositModal
