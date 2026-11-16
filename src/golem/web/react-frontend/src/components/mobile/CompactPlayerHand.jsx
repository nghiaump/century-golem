import React, { useState } from 'react'
import useBoardActions from '../../hooks/useBoardActions'
import CardTile from '../board/CardTile'
import CardSheet from '../board/CardSheet'
import BoardModals from '../board/BoardModals'
import { cardKind } from '../board/cardInfo'
import Avatar from '../ui/Avatar'
import Button from '../ui/Button'
import CrystalRow from '../ui/CrystalRow'
import Modal from '../ui/Modal'
import CardImage from '../ui/CardImage'
import GolemIcon from '../ui/GolemIcon'
import { MAX_CARAVAN } from '../../utils/crystals'

function CardsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
      <rect x="7" y="3" width="11" height="16" rx="2" /><path d="M5 6.5v12a2 2 0 002 2h8" />
    </svg>
  )
}

const CardGrid = ({ cards, dim }) => (
  <div className="grid grid-cols-3 gap-3">
    {cards.map((c, i) => <CardImage key={i} name={c.name} alt={c.name} className={`aspect-[0.58] w-full rounded-stone-sm border border-black/50 ${dim ? 'opacity-80 saturate-50' : ''}`} />)}
  </div>
)

/**
 * Phones: my crystals, Rest, my golems / played cards, and my hand (swipe). Tapping a hand card opens
 * its sheet with Play. Sits at the bottom of the screen, clear of the home indicator.
 */
const CompactPlayerHand = ({ landscape = false }) => {
  const a = useBoardActions({ reopenAfterUndo: true })
  const [sheet, setSheet] = useState(null)
  const [list, setList] = useState(null) // 'golems' | 'played'
  const { myPlayer, isSpectator, isWaiting, isMyTurn } = a
  if (isWaiting || isSpectator || !myPlayer) return null

  const golems = myPlayer.pointCards || []
  const openHand = (card, i) => setSheet({
    card, type: 'action',
    action: {
      label: { Trade: 'Trade…', Upgrade: 'Upgrade…', Produce: 'Play' }[cardKind(card)] || 'Play',
      onClick: () => a.onHandCard(card, i),
      disabled: !isMyTurn,
      reason: !isMyTurn ? 'Wait for your turn.' : null,
    },
  })

  return (
    <div
      className={`surface-stone flex flex-shrink-0 flex-col gap-2 !rounded-b-none border-b-0 px-3 pt-2 ${isMyTurn ? 'turn-glow' : ''} ${landscape ? 'h-full !rounded-stone' : ''}`}
      style={{ paddingBottom: 'max(8px, var(--safe-bottom))' }}
    >
      <div className="flex items-center gap-2">
        <Avatar player={myPlayer} size={28} turn={isMyTurn} />
        <CrystalRow resources={a.caravan} capacity={MAX_CARAVAN} size="sm" className="min-w-0 !gap-1.5" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Button size="md" onClick={a.onRest} disabled={!a.canRest} variant={a.canRest ? 'primary' : 'secondary'} title="Take your played cards back">Rest</Button>
        <Button size="md" variant="secondary" onClick={() => setList('golems')} disabled={!golems.length} icon={<GolemIcon size={16} />} aria-label={`My golems (${golems.length})`}>{golems.length}</Button>
        <Button size="md" variant="secondary" onClick={() => setList('played')} disabled={!a.playedCards.length} icon={<CardsIcon />} aria-label={`Played cards (${a.playedCards.length})`}>{a.playedCards.length}</Button>
      </div>
      <div className={`scrollbar-hide -mx-3 flex snap-x scroll-pl-3 gap-2.5 overflow-x-auto px-3 pb-1 ${landscape ? 'min-h-0 flex-1' : 'h-[132px]'}`} role="list" aria-label="Your hand">
        {a.hand.length ? a.hand.map((card, i) => (
          <div key={`h${i}-${card.id}`} role="listitem" className="h-full flex-shrink-0 snap-start py-1.5">
            <CardTile card={card} ready={isMyTurn} onInspect={() => openHand(card, i)} />
          </div>
        )) : (
          <span className="flex items-center px-1 text-sm text-fg-muted">No cards in hand — rest to take your played cards back.</span>
        )}
      </div>

      <Modal open={list === 'golems'} onClose={() => setList(null)} title={`My golems (${golems.length})`} variant="stone" size="sm">
        <CardGrid cards={golems} />
      </Modal>
      <Modal open={list === 'played'} onClose={() => setList(null)} title={`Played cards (${a.playedCards.length})`} variant="stone" size="sm">
        <p className="mb-3 text-sm text-fg-muted">Rest to take them all back to your hand.</p>
        <CardGrid cards={a.playedCards} dim />
      </Modal>
      <CardSheet sheet={sheet} onClose={() => setSheet(null)} />
      <BoardModals actions={a} />
    </div>
  )
}

export default CompactPlayerHand
