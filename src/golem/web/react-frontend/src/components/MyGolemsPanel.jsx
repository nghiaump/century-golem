import React, { useState } from 'react'
import CardPile from './board/CardPile'
import Modal from './ui/Modal'
import CardImage from './ui/CardImage'
import Coin from './ui/Coin'

// Golems I claimed + coins, with the points they are worth.
const MyGolemsPanel = ({ pointCards = [], coins = [] }) => {
  const [open, setOpen] = useState(false)
  const golemPoints = pointCards.reduce((s, c) => s + (c.points || 0), 0)
  const coinPoints = coins.reduce((s, c) => s + (c.points || 0), 0)
  const copper = coins.filter((c) => c.points === 3).length
  const silver = coins.filter((c) => c.points === 1).length
  return (
    <>
      <CardPile
        title="My Golems"
        count={pointCards.length}
        top={pointCards[pointCards.length - 1]}
        empty="None yet"
        footer={pointCards.length || coins.length ? `★${golemPoints + coinPoints}` : null}
        onOpen={() => setOpen(true)}
      />
      <Modal open={open} onClose={() => setOpen(false)} title={`My golems (${pointCards.length})`} variant="stone" size="lg">
        <div className="mb-3 flex flex-wrap items-center gap-4 text-sm text-fg-muted">
          <span>Golems <b className="text-fg">{golemPoints}</b></span>
          <span className="inline-flex items-center gap-1"><Coin kind="copper" size={18} />×{copper} <Coin kind="silver" size={18} />×{silver} = <b className="text-fg">{coinPoints}</b></span>
          <span>Total <b className="font-display text-lg text-bronze-100">{golemPoints + coinPoints}</b></span>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {pointCards.map((card, i) => <CardImage key={i} name={card.name} alt={`Golem, ${card.points} points`} className="aspect-[2/3] w-full rounded-stone-sm border border-black/50" />)}
        </div>
      </Modal>
    </>
  )
}

export default MyGolemsPanel
