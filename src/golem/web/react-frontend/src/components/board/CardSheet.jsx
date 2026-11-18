import React from 'react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { CardDetails } from './CardInspect'

/**
 * Phones: tapping a card opens this sheet — the card large, what it does, and the one action you
 * can take with it (or why not). `action` = { label, onClick, disabled, reason }.
 */
const CardSheet = ({ sheet, onClose }) => {
  if (!sheet) return null
  const { card, type, slot, placeCost, coin, action } = sheet
  return (
    <Modal
      open
      onClose={onClose}
      title={type === 'point' ? 'Golem' : slot ? `Market · card ${slot}` : 'Your card'}
      variant="stone"
      size="sm"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          {action ? (
            <Button disabled={action.disabled} onClick={() => { onClose(); action.onClick() }}>{action.label}</Button>
          ) : null}
        </>
      )}
    >
      <CardDetails card={card} type={type} slot={slot} placeCost={placeCost} coin={coin} large />
      {action?.disabled && action.reason ? <p className="mt-3 text-sm text-fg-muted">{action.reason}</p> : null}
    </Modal>
  )
}

export default CardSheet
