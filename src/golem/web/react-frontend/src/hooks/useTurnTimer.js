import { useEffect, useState } from 'react'
import useGameStore from '../store/gameStore'

/**
 * Seconds left in the current turn (counted down in the browser, restarted when the turn passes to
 * another player). `total` = the room's turn timeout. One shared implementation for every layout.
 */
export default function useTurnTimer() {
  // currentTurn counts every turn (a discard keeps the same turn); fall back to the player to move
  const turnKey = useGameStore((s) => s.gameState?.currentTurn ?? s.gameState?.currentPlayer)
  const total = useGameStore((s) => s.gameState?.turnTimeout) || 60
  const [remaining, setRemaining] = useState(total)
  useEffect(() => {
    setRemaining(total)
    const t = setInterval(() => setRemaining((p) => Math.max(0, p - 1)), 1000)
    return () => clearInterval(t)
  }, [turnKey, total])
  return { remaining, total }
}
