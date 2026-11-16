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
      <div className="font-bold text-sm">💤 {show.playerName} rested</div>
      <div className="text-xs text-purple-100">
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
          className="fixed z-[9998] pointer-events-none"
          style={{ top: pos.top, left: pos.left, transform: 'translateX(-50%)' }}
        >
          <motion.div
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: -8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.9 }}
            className="relative px-3 py-2 rounded-xl bg-purple-700 border-2 border-purple-300 text-white shadow-2xl whitespace-nowrap"
          >
            <span
              aria-hidden="true"
              className="absolute -top-[7px] w-3 h-3 rotate-45 bg-purple-700 border-l-2 border-t-2 border-purple-300"
              style={{ left: `calc(50% + ${pos.caret}px - 6px)` }}
            />
            {text}
          </motion.div>
        </div>
      )}
      {show && !pos && (
        <div key={show.id} className="fixed inset-x-0 top-24 z-[9998] flex justify-center px-4 pointer-events-none">
          <motion.div
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: -16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.9 }}
            className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-purple-700/90 border-2 border-purple-300 text-white shadow-2xl backdrop-blur-md"
          >
            <img
              src={avatarSrc(show.avatarId)}
              alt=""
              className="w-10 h-10 rounded-full border-2 border-white/60 object-cover flex-shrink-0"
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
