import React, { useState } from 'react'
import CardPile from './board/CardPile'
import Modal from './ui/Modal'
import CardImage from './ui/CardImage'

// Cards played since the last rest (a rest takes them all back to hand).
const GraveyardPanel = ({ playedCards = [] }) => {
  const [open, setOpen] = useState(false)
  return (
    <>
      <CardPile
        title="Played"
        count={playedCards.length}
        top={playedCards[playedCards.length - 1]}
        empty="None yet"
        dim
        onOpen={() => setOpen(true)}
      />
      <Modal open={open} onClose={() => setOpen(false)} title={`Played cards (${playedCards.length})`} variant="stone" size="lg">
        <p className="mb-3 text-sm text-fg-muted">Rest to take them all back to your hand.</p>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {playedCards.map((card, i) => <CardImage key={i} name={card.name} alt={card.name} className="aspect-[2/3] w-full rounded-stone-sm border border-black/50" />)}
        </div>
      </Modal>
    </>
  )
}

export default GraveyardPanel
