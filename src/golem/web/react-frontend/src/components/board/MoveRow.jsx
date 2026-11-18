import React from 'react'
import CardImage from '../ui/CardImage'
import Gem from '../ui/Gem'
import { cardSummary } from './cardInfo'

export const MOVE_VERB = { play: 'played', upgrade: 'upgraded with', trade: 'traded with', acquire: 'took', claim: 'claimed', rest: 'rested' }
export const MOVE_EDGE = {
  play: 'border-l-gem-blue', upgrade: 'border-l-gem-blue', trade: 'border-l-gem-blue',
  acquire: 'border-l-moss', claim: 'border-l-bronze-300', rest: 'border-l-gem-pink',
}

export const ago = (t, now = Date.now()) => {
  const s = Math.max(0, Math.floor((now - t) / 1000))
  if (s < 60) return `${s}s`
  return s < 3600 ? `${Math.floor(s / 60)}m` : `${Math.floor(s / 3600)}h`
}

/** What the move's card does, in words ("Trade 2 yellow for 1 blue", "Golem worth 9 points…"). */
export const moveDetail = (move) => (move?.card ? cardSummary(move.card, move.type === 'claim' ? 'point' : undefined) : null)

/** Stand-in for the card of a rest (it has none): blue + pink gem over "Rest". */
export const RestMark = ({ className = '' }) => (
  <span className={`flex flex-col items-center justify-center gap-0.5 rounded-sm border border-black/50 bg-rock-800 ${className}`} aria-hidden="true">
    <span className="flex gap-0.5"><Gem color="blue" size={10} label={false} /><Gem color="pink" size={10} label={false} /></span>
    <span className="font-display text-xs font-bold text-bronze-100">Rest</span>
  </span>
)

/**
 * One move in a history list: its card (or a rest marker), who did what and with which card, how long
 * ago. `showName={false}` inside one player's sheet ("Took · Trade 2 yellow for 1 blue").
 */
const MoveRow = ({ move, showName = true, now }) => {
  const verb = MOVE_VERB[move.type] || 'acted'
  const detail = moveDetail(move)
  return (
    <li className={`flex items-center gap-3 rounded-stone-sm border-l-4 bg-rock-900/70 px-3 py-2 ${MOVE_EDGE[move.type] || 'border-l-rock-400'}`}>
      {move.card
        ? <CardImage name={move.card.name} className="h-14 w-10 flex-shrink-0 rounded-sm border border-black/50" />
        : <RestMark className="h-14 w-10 flex-shrink-0" />}
      <span className="min-w-0 flex-1 text-sm leading-snug">
        {showName ? <><b className="text-fg">{move.playerName}</b> <span className="text-fg-muted">{verb}</span></> : <span className="font-semibold text-fg">{verb[0].toUpperCase() + verb.slice(1)}</span>}
        {detail ? <span className="block text-xs text-fg-muted">{detail}</span> : null}
      </span>
      <span className="flex-shrink-0 text-xs tabular-nums text-fg-muted">{ago(move.timestamp, now)}</span>
    </li>
  )
}

export default MoveRow
