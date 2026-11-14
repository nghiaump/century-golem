import React, { useState } from 'react'
import useGameStore from '../store/gameStore'
import { avatarSrc, resolveAvatarId } from '../utils/avatar'

// In-game player avatar image. Size, shape and border come from `className`; falls back to the name initial
// if the image fails to load. Looks the player up in the game state so partial objects (e.g. `winner`) work.
const PlayerAvatar = ({ player, className = '' }) => {
  const players = useGameStore((state) => state.gameState?.players) || []
  const [failedSrc, setFailedSrc] = useState(null)

  const fullPlayer = players.find((p) => p.id === player?.id) || player
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
