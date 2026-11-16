import React from 'react'
import StartShell from './StartShell'
import Button from '../ui/Button'
import GemLoader from '../ui/GemLoader'

/**
 * Connecting / reconnecting before the board exists (no game state yet). Retry and Back to Menu
 * appear when something went wrong or nothing is in progress.
 */
const ConnectionDialog = ({ title, message, error, busy, onRetry, onBack }) => (
  <StartShell
    title={title}
    width="sm"
    footer={onRetry || onBack ? (
      <>
        {onBack ? <Button variant="secondary" onClick={onBack}>Back to Menu</Button> : null}
        {onRetry ? <Button onClick={onRetry}>Retry Connection</Button> : null}
      </>
    ) : null}
  >
    {error ? (
      <p role="alert" className="rounded-stone-sm border border-ember/60 bg-ember/15 px-3 py-2 text-sm text-[rgb(255_210_196)]">{error}</p>
    ) : (
      <p className="text-sm text-fg-muted">{message}</p>
    )}
    {busy ? <GemLoader className="self-center" label={title} /> : null}
  </StartShell>
)

export default ConnectionDialog
