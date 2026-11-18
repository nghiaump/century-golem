import React, { useState } from 'react'
import useBoardActions from '../../hooks/useBoardActions'
import CardTile from '../board/CardTile'
import CardSheet from '../board/CardSheet'
import BoardModals from '../board/BoardModals'
import { cardKind } from '../board/cardInfo'
import Button from '../ui/Button'
import CrystalRow from '../ui/CrystalRow'
import Modal from '../ui/Modal'
import CardImage from '../ui/CardImage'
import GolemIcon from '../ui/GolemIcon'
import { PlayedIcon } from '../ui/CardIcons'
import { MAX_CARAVAN } from '../../utils/crystals'
import { pointsOf } from '../PlayersInfoBar'
import useOrientation from '../../hooks/useOrientation'
import useElementSize from '../../hooks/useElementSize'
import { cardBox } from '../../utils/phoneLayout'

const CardGrid = ({ cards, dim }) => (
  <div className="grid grid-cols-3 gap-3">
    {cards.map((c, i) => <CardImage key={i} name={c.name} alt={c.name} className={`aspect-[0.58] w-full rounded-stone-sm border border-black/50 ${dim ? 'opacity-80 saturate-50' : ''}`} />)}
  </div>
)

/**
 * Phones: my crystals, my golems + points, Rest, played cards, and my hand (swipe). Tapping a hand card
 * opens its sheet with Play. Sits at the bottom of the screen, clear of the home indicator.
 * `cardHeight`: hand-card height from utils/phoneLayout (portrait); `landscape` fills the side column.
 */
const CompactPlayerHand = ({ landscape = false, cardHeight = 104 }) => {
  const a = useBoardActions({ reopenAfterUndo: true })
  const [sheet, setSheet] = useState(null)
  const [list, setList] = useState(null) // 'golems' | 'played'
  const { myPlayer, isSpectator, isWaiting, isMyTurn } = a
  const { width } = useOrientation()
  const [row, setRow] = useState(null)
  const rowSize = useElementSize(row)
  if (isWaiting || isSpectator || !myPlayer) return null

  const golems = myPlayer.pointCards || []
  const points = pointsOf(myPlayer)
  const openHand = (card, i) => setSheet({
    card, type: 'action',
    action: {
      label: { Trade: 'Trade…', Upgrade: 'Upgrade…', Produce: 'Play' }[cardKind(card)] || 'Play',
      onClick: () => a.onHandCard(card, i),
      disabled: !isMyTurn,
      reason: !isMyTurn ? 'Wait for your turn.' : null,
    },
  })

  const crystals = <CrystalRow resources={a.caravan} capacity={MAX_CARAVAN} size={!landscape && width < 385 ? 'xs' : 'sm'} className="min-w-0 !gap-1" />
  const golemButton = (
    <Button size="md" variant="secondary" onClick={() => setList('golems')} disabled={!golems.length} className="!gap-1.5 !px-2" aria-label={`My golems (${golems.length}), ${points} points`} title="My golems and points">
      <span className="inline-flex items-center gap-1"><GolemIcon size={16} />{golems.length}</span>
      <span className="font-display text-bronze-100">★{points}</span>
    </Button>
  )
  const restButton = <Button size="md" onClick={a.onRest} disabled={!a.canRest} variant={a.canRest ? 'primary' : 'secondary'} className="!px-2.5" title="Take your played cards back">Rest</Button>
  const playedButton = (
    <Button size="md" variant="secondary" onClick={() => setList('played')} disabled={!a.playedCards.length} className="!gap-1 !px-2" icon={<PlayedIcon />} aria-label={`Played cards (${a.playedCards.length})`} title="Played cards">
      {a.playedCards.length}
    </Button>
  )

  return (
    <div
      className={`surface-stone flex flex-shrink-0 flex-col gap-1.5 px-3 pt-2 ${isMyTurn ? 'turn-glow' : ''} ${landscape ? 'h-full' : '!rounded-b-none border-b-0'}`}
      style={{ paddingBottom: 'max(8px, var(--safe-bottom))' }}
    >
      {landscape ? (
        <>
          <div className="flex h-7 items-center">{crystals}</div>
          <div className="grid grid-cols-[auto_1fr_auto] gap-1.5">{restButton}{golemButton}{playedButton}</div>
        </>
      ) : (
        <div className="flex flex-wrap items-center justify-end gap-1">
          <div className="min-w-0 flex-1 basis-[136px] overflow-hidden">{crystals}</div>
          {golemButton}{restButton}{playedButton}
        </div>
      )}
      <div
        className={`scrollbar-hide -mx-3 flex snap-x scroll-pl-3 gap-2.5 overflow-x-auto px-3 py-1.5 ${landscape ? 'min-h-0 flex-1' : ''}`}
        style={landscape ? undefined : { height: cardHeight + 12 }}
        ref={setRow}
        role="list"
        aria-label="Your hand"
      >
        {a.hand.length ? a.hand.map((card, i) => (
          <div key={`h${i}-${card.id}`} role="listitem" className="flex-shrink-0 snap-start" style={cardBox(landscape ? rowSize.height : cardHeight)}>
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
