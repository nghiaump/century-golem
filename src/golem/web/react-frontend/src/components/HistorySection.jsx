import React, { useState } from 'react'
import useGameStore from '../store/gameStore'
import CardPile from './board/CardPile'
import Modal from './ui/Modal'
import CardImage from './ui/CardImage'

const LABEL = { play: 'played', upgrade: 'upgraded with', trade: 'traded with', acquire: 'took', claim: 'claimed', rest: 'rested' }
const EDGE = { play: 'border-l-gem-blue', upgrade: 'border-l-gem-blue', trade: 'border-l-gem-blue', acquire: 'border-l-moss', claim: 'border-l-bronze-300', rest: 'border-l-gem-pink' }

const ago = (t) => {
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000))
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m`
}

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
          {actionHistory.map((a) => (
            <li key={a.timestamp} className={`flex items-center gap-3 rounded-stone-sm border-l-4 bg-rock-900/70 px-3 py-2 ${EDGE[a.type] || 'border-l-rock-400'}`}>
              {a.card ? <CardImage name={a.card.name} className="h-14 w-10 flex-shrink-0 rounded-sm border border-black/50" /> : <span className="h-14 w-10 flex-shrink-0" />}
              <span className="min-w-0 flex-1 text-sm">
                <b className="text-fg">{a.playerName}</b> <span className="text-fg-muted">{LABEL[a.type] || 'acted'}</span>
                {a.card ? <span className="text-fg"> {a.card.name?.replace(/_/g, ' ')}</span> : null}
              </span>
              <span className="text-xs tabular-nums text-fg-muted">{ago(a.timestamp)}</span>
            </li>
          ))}
        </ol>
      </Modal>
    </>
  )
}

export default HistorySection
