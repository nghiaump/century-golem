import React from 'react'
import NightBackdrop from '../ui/NightBackdrop'
import Wordmark from './Wordmark'

const WIDTH = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  )
}

/**
 * Frame of the screens before a game (menu, lobbies, connecting): night mountains, the wordmark and
 * one carved stone panel. `onBack` adds a back arrow to the panel header.
 */
const StartShell = ({ title, subtitle, onBack, width = 'md', wordmark = 'sm', footer, children }) => (
  <div className="relative min-h-screen min-h-[100dvh] overflow-x-hidden">
    <NightBackdrop />
    <main
      className="relative z-board mx-auto flex min-h-screen min-h-[100dvh] w-full flex-col items-center gap-5 px-4 py-6 sm:py-10"
      style={{ paddingTop: 'max(24px, var(--safe-top))', paddingBottom: 'max(24px, var(--safe-bottom))' }}
    >
      {wordmark ? <Wordmark size={wordmark} /> : null}
      <section className={`surface-stone w-full ${WIDTH[width] || WIDTH.md} flex flex-col`}>
        {title || onBack ? (
          <header className="flex items-center gap-2 border-b border-black/40 px-3 py-2 sm:px-4">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                aria-label="Back"
                className="-ml-1 inline-flex h-11 w-11 items-center justify-center rounded-stone text-fg-muted hover:bg-rock-700/60 hover:text-fg"
              >
                <BackIcon />
              </button>
            ) : null}
            <div className="min-w-0 flex-1">
              {title ? <h1 className="font-display text-xl font-bold text-bronze-100 text-engrave">{title}</h1> : null}
              {subtitle ? <p className="text-sm text-fg-muted">{subtitle}</p> : null}
            </div>
          </header>
        ) : null}
        <div className="flex flex-col gap-5 p-4 sm:p-5">{children}</div>
        {/* the main action stays on screen while the form scrolls */}
        {footer ? (
          <footer
            className="sticky bottom-0 z-hud flex flex-wrap items-center justify-end gap-2 rounded-b-stone border-t border-black/40 bg-rock-800/95 px-4 py-3 sm:px-5"
            style={{ paddingBottom: 'max(12px, var(--safe-bottom))' }}
          >
            {footer}
          </footer>
        ) : null}
      </section>
    </main>
  </div>
)

export default StartShell
