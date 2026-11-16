import React, { useEffect, useState } from 'react'
import useGameStore from '../store/gameStore'
import Modal from './ui/Modal'
import Button from './ui/Button'
import Gem from './ui/Gem'
import Stepper from './ui/Stepper'
import CrystalRow from './ui/CrystalRow'
import { COLORS, MAX_CARAVAN, cheapest, of, sub, total } from '../utils/crystals'

const NAME = { yellow: 'Yellow', green: 'Green', blue: 'Blue', pink: 'Pink' }

/**
 * More than 10 crystals after a move: discard the excess before the turn ends. Starts with the cheapest
 * crystals chosen; adjust per colour. Can't be dismissed — but a card play can be taken back (Undo).
 */
const DiscardModal = () => {
  const { myPlayer, discardCrystals, undoPlay } = useGameStore()
  const pending = myPlayer?.pendingDiscard || 0
  const caravan = of(myPlayer?.caravan)
  const [discardCounts, setDiscardCounts] = useState(() => cheapest(caravan, pending))

  // a new overflow (or the same one after an undo + replay): start again from the cheapest crystals
  const key = `${pending}:${COLORS.map((c) => caravan[c]).join(',')}`
  useEffect(() => {
    if (pending > 0) setDiscardCounts(cheapest(caravan, pending))
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!myPlayer || pending <= 0) return null

  const chosen = total(discardCounts)
  const remaining = pending - chosen
  const canConfirm = chosen === pending

  const setCount = (c, v) => setDiscardCounts((prev) => ({ ...prev, [c]: Math.max(0, Math.min(caravan[c], v)) }))

  const handleUndo = () => {
    setDiscardCounts({ yellow: 0, green: 0, blue: 0, pink: 0 })
    undoPlay()
  }

  const handleConfirm = () => {
    if (canConfirm && chosen > 0) discardCrystals(discardCounts)
  }

  return (
    <Modal
      open
      dismissible={false}
      title="Too Many Crystals!"
      footer={(
        <>
          {/* take back the card play that overflowed (e.g. a trade multiplier one too high) */}
          {myPlayer.canUndo && (
            <Button variant="outline" onClick={handleUndo}>↩ Undo — take the card back</Button>
          )}
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            {canConfirm ? 'Confirm Discard' : `Select ${remaining} more`}
          </Button>
        </>
      )}
    >
      <div className="flex flex-col gap-3">
        <p className="text-center text-sm text-ink">
          You can keep {MAX_CARAVAN}. Discard <span className="font-bold">{pending}</span> crystal{pending > 1 ? 's' : ''} — the cheapest are picked.
        </p>
        {COLORS.map((c) => (
          <div key={c} className={`flex items-center gap-3 rounded-stone border border-ink/15 bg-ink/5 px-3 py-1.5 ${caravan[c] === 0 ? 'opacity-40' : ''}`}>
            <Gem color={c} size={26} label={false} />
            <div className="flex flex-1 flex-col">
              <span className="text-sm font-semibold text-ink">{NAME[c]}</span>
              <span className="text-xs text-ink-muted">have {caravan[c]}</span>
            </div>
            <Stepper
              label={`${NAME[c]} to discard`}
              value={discardCounts[c]}
              min={0}
              max={Math.min(caravan[c], discardCounts[c] + remaining)}
              onChange={(v) => setCount(c, v)}
            />
          </div>
        ))}
        <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-ink-muted">
          Keep: <CrystalRow resources={sub(caravan, discardCounts)} capacity={MAX_CARAVAN} size="sm" tone="parchment" />
        </div>
      </div>
    </Modal>
  )
}

export default DiscardModal
