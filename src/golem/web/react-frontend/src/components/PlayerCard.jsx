import React from 'react'
import PlayerAvatar from './PlayerAvatar'

const PlayerCard = ({ player, isCurrentPlayer }) => {
  if (!player) return null

  const golemsCount = player.pointCards?.length || 0
  
  // Crystal colors
  const crystalColors = {
    yellow: 'bg-yellow-400',
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    pink: 'bg-pink-400'
  }

  return (
    <div 
      className={`
        relative bg-white/10 backdrop-blur-md rounded-xl border p-2
        ${isCurrentPlayer 
          ? 'border-yellow-400 ring-2 ring-yellow-400/50 bg-yellow-500/10' 
          : 'border-white/20'
        }
      `}
    >
      {/* Current Turn Indicator */}
      {isCurrentPlayer && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse" />
      )}

      {/* Avatar on the left, as tall as both rows (name row + crystal row) */}
      <div className="flex items-center gap-2.5">
        <div className="relative flex-shrink-0">
          <PlayerAvatar
            player={player}
            restAnchor
            className={`
              w-12 h-12 rounded-full text-base
              border-2 ${isCurrentPlayer ? 'border-yellow-400' : 'border-white'} shadow
              ${isCurrentPlayer ? 'bg-yellow-500 text-black' : 'bg-purple-600 text-white'}
              ${player.online === false ? 'opacity-50' : ''}
            `}
          />
          {/* Online/Offline status indicator (humans only; AIs are always there) */}
          {player.online !== undefined && !player.isAI && (
            <div
              className={`
                absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white shadow
                ${player.online ? 'bg-green-500' : 'bg-gray-500'}
              `}
              title={player.online ? 'Online' : 'Offline'}
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Row 1: Name + Golems */}
          <div className="flex items-center gap-2 mb-1">
            <div className={`text-white font-bold text-sm flex-1 min-w-0 flex items-center ${player.online === false ? 'opacity-60' : ''}`}>
              <span className="truncate" title={player.name || 'Player'}>{player.name || 'Player'}</span>
              {!player.isAI && player.online === false && (
                <span className="text-gray-400 text-xs ml-1 flex-shrink-0">(offline)</span>
              )}
            </div>
            <div className={`flex-shrink-0 flex items-center gap-1 bg-purple-600/50 rounded-lg px-2 py-0.5 ${golemsCount >= 4 ? 'animate-bounce ring-2 ring-red-500' : ''}`}>
              <span className="text-base leading-5">🗿</span>
              <span className="text-white font-bold text-sm">{golemsCount}</span>
            </div>
          </div>

          {/* Row 2: Crystals */}
          <div className="flex items-center gap-1.5">
            {['yellow', 'green', 'blue', 'pink'].map((color) => {
              const count = player.caravan?.[color] || 0
              return (
                <div key={color} className="flex items-center gap-0.5">
                  <div className={`w-4 h-4 rounded-full ${crystalColors[color]}`} />
                  <span className="text-white text-sm font-bold">{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default PlayerCard

