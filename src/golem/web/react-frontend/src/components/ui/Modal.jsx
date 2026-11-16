import React, { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

const SURFACE = { parchment: 'surface-parchment', stone: 'surface-stone' }
const WIDTH = { sm: 'md:max-w-sm', md: 'md:max-w-lg', lg: 'md:max-w-2xl', xl: 'md:max-w-4xl' }

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

/**
 * Popup shell: parchment (default) or stone, title + Close, body, footer. Below 768px it is a bottom
 * sheet. Escape and the backdrop close it unless `dismissible={false}` (e.g. the discard step).
 * Focus moves into the popup (Tab stays inside) and returns to where it was when it closes; the page
 * behind can't scroll.
 */
const Modal = ({ open, onClose, title, icon, dismissible = true, variant = 'parchment', size = 'md', footer, children, className = '', labelledBy }) => {
  const autoId = useId()
  const titleId = labelledBy || `modal-title-${autoId}`
  const panelRef = useRef(null)
  const restoreRef = useRef(null)
  // latest onClose without re-running the effect (parents re-render on every game update; re-running
  // would steal focus back to the first button each time)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return undefined
    restoreRef.current = document.activeElement
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // focus the dialog itself (Tab then walks its controls); an element with data-autofocus wins
    const t = setTimeout(() => {
      const target = panelRef.current?.querySelector('[data-autofocus]') || panelRef.current
      target?.focus?.()
    }, 0)
    const onKey = (e) => {
      if (e.key === 'Escape' && dismissible) {
        e.stopPropagation()
        onCloseRef.current?.()
      } else if (e.key === 'Tab' && panelRef.current) {
        // keep Tab inside the popup
        const items = [...panelRef.current.querySelectorAll(FOCUSABLE)]
        if (!items.length) return
        const first = items[0]
        const last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      clearTimeout(t)
      document.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = prevOverflow
      restoreRef.current?.focus?.()
    }
  }, [open, dismissible])

  const dark = variant === 'stone'
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="modal"
          className="fixed inset-0 z-modal flex items-end justify-center md:items-center md:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div
            className="absolute inset-0 bg-rock-950/75"
            onClick={dismissible ? onClose : undefined}
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            tabIndex={-1}
            className={`${SURFACE[variant] || SURFACE.parchment} relative flex w-full flex-col
              max-h-[92dvh] rounded-b-none md:rounded-stone-lg ${WIDTH[size] || WIDTH.md}
              pb-[var(--safe-bottom)] md:pb-0 outline-none ${className}`}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          >
            {title || dismissible ? (
              <header className={`flex items-center gap-3 px-5 pt-4 pb-2 ${dark ? '' : 'border-b border-ink/15'}`}>
                {icon ? <span className="flex-shrink-0" aria-hidden="true">{icon}</span> : null}
                {title ? (
                  <h2 id={titleId} className={`flex-1 font-display text-lg md:text-xl font-bold ${dark ? 'text-bronze-100 text-engrave' : 'text-ink'}`}>
                    {title}
                  </h2>
                ) : <span className="flex-1" />}
                {dismissible ? (
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className={`-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-stone transition-colors
                      ${dark ? 'text-fg-muted hover:bg-rock-700/60 hover:text-fg' : 'text-ink-muted hover:bg-ink/10 hover:text-ink'}`}
                  >
                    <CloseIcon />
                  </button>
                ) : null}
              </header>
            ) : null}
            <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
            {footer ? (
              <footer className={`flex flex-wrap items-center justify-end gap-2 px-5 pb-4 pt-2 ${dark ? '' : 'border-t border-ink/15'}`}>
                {footer}
              </footer>
            ) : null}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}

export default Modal
