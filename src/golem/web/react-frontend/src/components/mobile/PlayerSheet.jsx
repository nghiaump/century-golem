import React from 'react'
import useGameStore from '../../store/gameStore'
import Modal from '../ui/Modal'
import Avatar from '../ui/Avatar'
import CardImage from '../ui/CardImage'
import CrystalRow from '../ui/CrystalRow'
import GolemIcon from '../ui/GolemIcon'
import { HandIcon, PlayedIcon } from '../ui/CardIcons'
import MoveRow from '../board/MoveRow'
import { pointsOf } from '../PlayersInfoBar'

const MAX_MOVES = 8

const Section = ({ title, children }) => (
  <section className="flex flex-col gap-2">
    <h3 className="font-display text-xs font-bold uppercase tracking-wider text-bronze-300">{title}</h3>
    {children}
  </section>
)

const Cards = ({ cards }) => (
  <div className="grid grid-cols-4 gap-2">
    {cards.map((c, i) => (
      <CardImage key={`${c.id ?? c.name}-${i}`} name={c.name} alt={c.name} className="aspect-[0.58] w-full rounded-stone-sm border border-black/50" />
    ))}
  </div>
)

/**
 * Phones: tap an opponent's chip for what they have been doing — their last moves seen at this table
 * (with the cards), the cards they played since their last rest (newest first) and their golems.
 */
const PlayerSheet = ({ playerId, onClose }) => {
  const player = useGameStore((s) => (playerId == null ? null : s.gameState?.players?.find((p) => p.id === playerId)))
  const history = useGameStore((s) => s.actionHistory)
  const myId = useGameStore((s) => s.myPlayer?.id)
  if (!player) return null

  const moves = history.filter((m) => m.playerId === playerId).slice(0, MAX_MOVES)
  const played = [...(player.playedCards || [])].reverse()
  const golems = player.pointCards || []
  const now = Date.now()

  return (
    <Modal
      open
      onClose={onClose}
      title={player.id === myId ? 'You' : player.name}
      icon={<Avatar player={player} size={40} fit />}
      variant="stone"
      size="sm"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold tabular-nums text-fg-muted">
          <span className="font-display text-base font-bold text-bronze-100" aria-label={`${pointsOf(player)} points`}>★{pointsOf(player)}</span>
          <span className="inline-flex items-center gap-1 text-bronze-300" aria-label={`${golems.length} golems`}><GolemIcon size={16} label={false} />{golems.length}</span>
          <span className="inline-flex items-center gap-1" aria-label={`${player.hand?.length || 0} cards in hand`}><HandIcon size={16} />{player.hand?.length || 0}</span>
          <span className="inline-flex items-center gap-1" aria-label={`${played.length} cards played`}><PlayedIcon size={16} />{played.length}</span>
          <CrystalRow resources={player.caravan} size="xs" className="!gap-1.5" />
        </div>

        <Section title="Last moves">
          {moves.length ? (
            <ol className="flex flex-col gap-1.5" aria-label={`${player.name}'s last moves`}>
              {moves.map((m) => <MoveRow key={m.seq ?? m.timestamp} move={m} showName={false} now={now} />)}
            </ol>
          ) : (
            <p className="text-sm text-fg-muted">No moves seen yet — they show up here as they happen.</p>
          )}
        </Section>

        <Section title={`Played since last rest · ${played.length}`}>
          {played.length ? <Cards cards={played} /> : <p className="text-sm text-fg-muted">None right now — they have rested or not played yet.</p>}
        </Section>

        {golems.length ? (
          <Section title={`Golems · ${golems.length}`}>
            <Cards cards={golems} />
          </Section>
        ) : null}
      </div>
    </Modal>
  )
}

export default PlayerSheet
