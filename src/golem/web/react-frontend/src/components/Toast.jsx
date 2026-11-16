import React, { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { setToastListener, clearToastListener } from '../utils/toast'

const EDGE = { error: 'border-l-ember', success: 'border-l-moss', ai: 'border-l-gem-pink', info: 'border-l-teal' }

function Icon({ type }) {
  const common = { viewBox: '0 0 24 24', width: 18, height: 18, fill: 'none', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }
  if (type === 'error') return <svg {...common} stroke="rgb(var(--ember))"><path d="M12 8v5M12 16.5v.5" /><circle cx="12" cy="12" r="9" /></svg>
  if (type === 'success') return <svg {...common} stroke="rgb(var(--moss))"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
  return <svg {...common} stroke="rgb(var(--teal))"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.5v.5" /></svg>
}

/** Short messages, top-centre under the HUD: stone pill with a coloured edge. 3 s (AI notes 4.5 s). */
const Toast = () => {
  const [toasts, setToasts] = useState([])
  const removeToast = useCallback((id) => setToasts((prev) => prev.filter((t) => t.id !== id)), [])

  useEffect(() => {
    setToastListener((toast) => {
      setToasts((prev) => [...prev.slice(-2), toast]) // at most 3 on screen
      setTimeout(() => removeToast(toast.id), toast.type === 'ai' ? 4500 : 3000)
    })
    return () => clearToastListener()
  }, [removeToast])

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 z-toast flex flex-col items-center gap-2 px-3"
      style={{ top: 'calc(max(8px, var(--safe-top)) + 56px)' }}
      aria-live="polite"
    >
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            role={toast.type === 'error' ? 'alert' : 'status'}
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96 }}
            className={`surface-stone pointer-events-auto flex w-full max-w-md items-center gap-2.5 border-l-4 py-2 pl-3 pr-1 text-sm font-semibold ${EDGE[toast.type] || EDGE.info}`}
          >
            <Icon type={toast.type} />
            <span className="flex-1 text-fg">{toast.message}</span>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              aria-label="Dismiss"
              className="inline-flex h-9 w-9 items-center justify-center rounded-stone-sm text-fg-muted hover:bg-rock-700/60 hover:text-fg"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    document.body
  )
}

export default Toast
