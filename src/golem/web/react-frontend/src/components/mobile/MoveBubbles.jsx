import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import useGameStore from '../../store/gameStore'
import CardImage from '../ui/CardImage'
import { cardBox } from '../../utils/phoneLayout'
import { anchorBelow } from '../../utils/rest'

export const BUBBLE_MS = 3000
const CARD = cardBox(84)
const BORDER = 2
const WIDTH = CARD.width + BORDER * 2 // the frame hugs the card: nothing around it covers the board
const VERB = { play: 'played', upgrade: 'upgraded', trade: 'traded', acquire: 'took', claim: 'claimed' }

/** Moves by others that came in after `after` (store seq) and have a card: the newest per player. */
export function freshMoves(history, after) {
  const out = new Map()
  for (const m of history) { // newest first
    if (m.seq > after && m.isOpponent && m.card && m.playerId != null && !out.has(m.playerId)) out.set(m.playerId, m)
  }
  return [...out.values()].reverse()
}

/**
 * Phones: when someone else plays, takes or claims a card, that card pops up for a few seconds just
 * below their chip ("took", "played"…), so you see the move as it happens without any room taken
 * from the board. Only the card shows — a thin bronze frame tight around it, a caret up to the chip and
 * the verb as a tag on its bottom edge — so it hides as little of the golems below as possible. Never blocks a tap (and any tap hides them); the full list is in the player's sheet.
 */
const MoveBubbles = () => {
  const history = useGameStore((s) => s.actionHistory)
  const [bubbles, setBubbles] = useState([]) // [{ move, pos }]
  const seen = useRef(null)
  const timers = useRef(new Map())

  useLayoutEffect(() => {
    const top = history.reduce((n, m) => Math.max(n, m.seq || 0), 0)
    if (seen.current === null) { // moves from before this screen was up: no bubbles
      seen.current = top
      return
    }
    const fresh = freshMoves(history, seen.current)
    seen.current = Math.max(seen.current, top)
    const placed = fresh.map((move) => ({ move, pos: anchorBelow(move.playerId, WIDTH) })).filter((b) => b.pos)
    if (!placed.length) return
    setBubbles((prev) => [...prev.filter((b) => !placed.some((p) => p.move.playerId === b.move.playerId)), ...placed])
    placed.forEach(({ move }) => {
      clearTimeout(timers.current.get(move.playerId))
      timers.current.set(move.playerId, setTimeout(() => setBubbles((prev) => prev.filter((b) => b.move.seq !== move.seq)), BUBBLE_MS))
    })
  }, [history])

  useEffect(() => {
    const t = timers.current
    return () => t.forEach(clearTimeout)
  }, [])

  // a tap anywhere, a rotation or a resize hides them
  const showing = bubbles.length > 0
  useEffect(() => {
    if (!showing) return undefined
    const hide = () => setBubbles([])
    document.addEventListener('pointerdown', hide, true)
    window.addEventListener('resize', hide)
    return () => {
      document.removeEventListener('pointerdown', hide, true)
      window.removeEventListener('resize', hide)
    }
  }, [showing])

  return createPortal(
    <AnimatePresence>
      {bubbles.map(({ move, pos }) => (
        <div
          key={move.playerId}
          data-testid="move-bubble"
          className="pointer-events-none fixed z-popover"
          style={{ top: pos.top, left: pos.left, transform: 'translateX(-50%)' }}
          aria-hidden="true"
        >
          <motion.div
            key={move.seq} // a newer move by the same player pops in again
            initial={{ opacity: 0, y: -6, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.18 }}
            className="relative rounded-[5px] border-bronze-300 bg-rock-950 shadow-elev-2"
            style={{ width: WIDTH, height: CARD.height + BORDER * 2, borderWidth: BORDER }}
          >
            {/* caret pointing up at the player's chip */}
            <span
              className="absolute -top-[8px] h-0 w-0 border-x-[6px] border-b-[6px] border-x-transparent border-b-bronze-300"
              style={{ left: `calc(50% + ${pos.caret}px - 6px)` }}
            />
            <CardImage name={move.card.name} className="block h-full w-full overflow-hidden rounded-[3px]" />
            {/* what they did, as a tag on the card's bottom edge */}
            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-bronze-300 bg-rock-950 px-1.5 py-0.5 text-xs font-bold leading-none text-bronze-100">
              {VERB[move.type] || 'played'}
            </span>
          </motion.div>
        </div>
      ))}
    </AnimatePresence>,
    document.body
  )
}

export default MoveBubbles
