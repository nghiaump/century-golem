import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import useGameStore from '../store/gameStore'
import soundManager from '../utils/sounds'
import { avatarSrc } from '../utils/avatar'

// "<name> rested · took back N cards", shown for ~2 s when an opponent rests (store.restPopup).
const RestPopup = () => {
  const restPopup = useGameStore((s) => s.restPopup)
  const id = restPopup?.id

  useEffect(() => {
    if (id) soundManager.play('rest')
  }, [id])

  return createPortal(
    <div className="fixed inset-x-0 top-24 z-[9998] flex justify-center px-4 pointer-events-none">
      <AnimatePresence>
        {restPopup && (
          <motion.div
            key={restPopup.id}
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: -16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.9 }}
            className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-purple-700/90 border-2 border-purple-300 text-white shadow-2xl backdrop-blur-md"
          >
            <img
              src={avatarSrc(restPopup.avatarId)}
              alt=""
              className="w-10 h-10 rounded-full border-2 border-white/60 object-cover flex-shrink-0"
            />
            <div className="leading-tight">
              <div className="font-bold text-sm">💤 {restPopup.playerName} rested</div>
              <div className="text-xs text-purple-100">
                took back {restPopup.cards} card{restPopup.cards === 1 ? '' : 's'}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body
  )
}

export default RestPopup
