import React, { useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import useGameStore from '../store/gameStore'
import soundManager from '../utils/sounds'
import { avatarSrc } from '../utils/avatar'
import { restAnchorPosition } from '../utils/rest'

// "<name> rested · took back N cards", shown for ~2 s when an opponent rests (store.restPopup).
// Desktop boards: just below the resting player's avatar, with a caret pointing at it, so it is clear
// who rested. Elsewhere (mobile, avatar not on screen): centered at the top, with the avatar.
const RestPopup = () => {
  const restPopup = useGameStore((s) => s.restPopup)
  const id = restPopup?.id
  const [placed, setPlaced] = useState(null) // { id, pos } — measured before paint

  useEffect(() => {
    if (id) soundManager.play('rest')
  }, [id])

  useLayoutEffect(() => {
    if (id) setPlaced({ id, pos: restAnchorPosition(restPopup.playerId) })
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const show = restPopup && placed?.id === id ? restPopup : null
  const pos = show ? placed.pos : null
  const text = show && (
    <div className="leading-tight">
      <div className="text-sm font-bold text-bronze-100">{show.playerName} rested</div>
      <div className="text-xs text-fg-muted">
        took back {show.cards} card{show.cards === 1 ? '' : 's'}
      </div>
    </div>
  )

  return createPortal(
    <AnimatePresence>
      {show && pos && (
        <div
          key={show.id}
          data-testid="rest-popup-anchored"
          className="fixed z-toast pointer-events-none"
          style={{ top: pos.top, left: pos.left, transform: 'translateX(-50%)' }}
        >
          <motion.div
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: -8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.9 }}
            className="surface-stone relative whitespace-nowrap border-bronze-300/70 px-3 py-2 shadow-elev-2"
          >
            <span
              aria-hidden="true"
              className="absolute -top-[7px] h-3 w-3 rotate-45 border-l border-t border-bronze-300/70 bg-rock-700"
              style={{ left: `calc(50% + ${pos.caret}px - 6px)` }}
            />
            {text}
          </motion.div>
        </div>
      )}
      {show && !pos && (
        <div key={show.id} className="fixed inset-x-0 top-24 z-toast flex justify-center px-4 pointer-events-none">
          <motion.div
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: -16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.9 }}
            className="surface-stone flex items-center gap-3 border-bronze-300/70 px-4 py-2.5 shadow-elev-2"
          >
            <img
              src={avatarSrc(show.avatarId)}
              alt=""
              className="h-10 w-10 flex-shrink-0 rounded-full border-2 border-bronze-500/80 object-cover"
            />
            {text}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}

export default RestPopup
