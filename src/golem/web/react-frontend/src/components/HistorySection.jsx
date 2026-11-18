import React, { useState } from 'react'
import useGameStore from '../store/gameStore'
import CardPile from './board/CardPile'
import MoveRow from './board/MoveRow'
import Modal from './ui/Modal'

// Recent moves, newest on top of the pile; the list shows who did what with which card.
const HistorySection = () => {
  const { actionHistory } = useGameStore()
  const [open, setOpen] = useState(false)
  const latest = actionHistory[0]
  return (
    <>
      <CardPile
        title="History"
        count={actionHistory.length}
        top={latest?.card || null}
        restTop={latest?.type === 'rest'}
        empty="No moves yet"
        onOpen={() => setOpen(true)}
      />
      <Modal open={open} onClose={() => setOpen(false)} title="Recent moves" variant="stone" size="md">
        <ol className="flex flex-col gap-1.5">
          {actionHistory.map((a) => <MoveRow key={a.seq ?? a.timestamp} move={a} />)}
        </ol>
      </Modal>
    </>
  )
}

export default HistorySection
