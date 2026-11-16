import React from 'react'
import Modal from './ui/Modal'
import Button from './ui/Button'
import CardImage from './ui/CardImage'
import Coin from './ui/Coin'
import { CrystalCost } from './ui/CrystalRow'
import { total } from '../utils/crystals'

/** Confirm claiming a golem (spends its crystals; can't be taken back). `coin`: 'copper' | 'silver' | undefined. */
const ConfirmGolemModal = ({ isOpen, golem, coin, onConfirm, onCancel }) => {
  if (!isOpen || !golem) return null
  const requirement = golem.requirement || {}
  return (
    <Modal
      open
      onClose={onCancel}
      title="Claim Golem"
      size="sm"
      footer={(
        <>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={onConfirm}>Claim</Button>
        </>
      )}
    >
      <div className="flex items-center gap-4">
        <div className="relative flex-shrink-0">
          <CardImage name={golem.name} alt={`Golem worth ${golem.points} points`} className="h-36 w-24 rounded-stone border border-ink/30 shadow-elev-1" />
          {coin ? <Coin kind={coin} size={30} className="absolute -right-2 -top-2" /> : null}
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Points</div>
            <div className="font-display text-3xl font-bold text-ink">{golem.points}{coin ? <span className="text-lg text-ink-muted"> + {coin === 'copper' ? 3 : 1}</span> : null}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Costs</div>
            {total(requirement) > 0 ? <CrystalCost resources={requirement} size={22} /> : <span className="text-sm font-semibold text-ink">Free</span>}
          </div>
        </div>
      </div>
      <p className="mt-4 text-center text-sm text-ink-muted">Claiming spends these crystals and can't be undone.</p>
    </Modal>
  )
}

export default ConfirmGolemModal
