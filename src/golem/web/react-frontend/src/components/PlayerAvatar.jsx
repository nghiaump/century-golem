import React, { useState } from 'react'
import useGameStore from '../store/gameStore'
import { avatarSrc, resolveAvatarId } from '../utils/avatar'

// In-game player avatar image. Size, shape and border come from `className`; falls back to the name initial
// if the image fails to load. Looks the player up in the game state so partial objects (e.g. `winner`) work.
const PlayerAvatar = ({ player, className = '' }) => {
  const players = useGameStore((state) => state.gameState?.players) || []
  const [failedSrc, setFailedSrc] = useState(null)

  // Look the player up only by a real seat ID: in the waiting room every not-yet-seated row
  // (humans and AIs) has id 0, and matching on it gave every AI the human's avatar.
  const fullPlayer = (player?.id ? players.find((p) => p.id === player.id) : null) || player
  const src = avatarSrc(resolveAvatarId(fullPlayer, players))
  const initial = fullPlayer?.name?.charAt(0)?.toUpperCase() || '?'

  return (
    <div className={`overflow-hidden flex items-center justify-center font-bold ${className}`}>
      {failedSrc === src ? (
        initial
      ) : (
        <img
          src={src}
          alt={fullPlayer?.name || 'Player'}
          className="w-full h-full object-cover"
          onError={() => setFailedSrc(src)}
        />
      )}
    </div>
  )
}

export default PlayerAvatar
