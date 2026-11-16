import { useEffect } from 'react'
import useGameStore from '../store/gameStore'

// After "Undo" in the discard popup the card is back in hand: reopen the picker the player used
// (trade multiplier / upgrade choice) so they can choose again. open({ kind, card, cardIndex }).
// Only one component per screen may pass `enabled` (the one that owns the trade/upgrade popups):
// the first enabled caller consumes the event.
export default function useReopenAfterUndo(open, enabled = true) {
  const reopenPlay = useGameStore((s) => s.reopenPlay)
  useEffect(() => {
    if (!enabled || !reopenPlay) return
    useGameStore.getState().consumeReopenPlay()
    open(reopenPlay)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reopenPlay, enabled])
}
