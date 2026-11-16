import React from 'react'
import Button from '../ui/Button'
import GemLoader from '../ui/GemLoader'

/**
 * Lost the connection mid-game: the board stays on screen (inert) and this banner shows the attempts.
 * Retry after 2 attempts or an error; Back to Menu after 3.
 */
const ReconnectBanner = ({ attempts = 0, max = 10, error, onRetry, onBack }) => (
  <>
  {/* dim the paused board */}
  <div className="pointer-events-none fixed inset-0 z-banner bg-rock-950/50" aria-hidden="true" />
  <div
    role="alert"
    className="fixed inset-x-0 top-0 z-banner flex justify-center px-3"
    style={{ paddingTop: 'max(12px, var(--safe-top))' }}
  >
    <div className="surface-stone flex w-full max-w-xl flex-wrap items-center gap-3 border-ember/70 px-4 py-3">
      <GemLoader size={14} label="Reconnecting" />
      <div className="min-w-0 flex-1">
        <div className="font-display text-sm font-bold text-bronze-100">Connection lost</div>
        <div className="text-xs text-fg-muted">
          {error || (attempts > 0 ? `Reconnecting… attempt ${attempts} of ${max}` : 'Reconnecting…')}
        </div>
      </div>
      <div className="flex gap-2">
        {onBack ? <Button size="md" variant="secondary" onClick={onBack}>Back to Menu</Button> : null}
        {onRetry ? <Button size="md" onClick={onRetry}>Retry</Button> : null}
      </div>
    </div>
  </div>
  </>
)

export default ReconnectBanner
