import React from 'react'
import XpWindow from './XpWindow'
import PlayerAvatar from './PlayerAvatar'
import { avatarSrc } from '../utils/avatar'

// Pre-game waiting room (XP dialog): who has joined + Start Game. Shared by desktop and mobile layouts.
const XpWaitingRoom = ({ players = [], isSpectator, onStart, className = '', mode }) => (
  <XpWindow
    title="Waiting for players"
    icon={avatarSrc('3')}
    className={`max-w-md ${className}`}
    status={<><span>{players.length} player(s) in lobby</span><span>Room open</span></>}
  >
    <div className="xp-stack">
      <p>{mode === 'single'
        ? 'Your AI opponents are ready. Start whenever you are.'
        : 'Waiting for other players to join. Start whenever everyone is in.'}</p>
      <div className="xp-progress" role="progressbar" aria-label="Waiting for players" />

      <div className="xp-listview">
        {players.map((player, i) => (
          <div key={`${player.name}-${i}`} className="xp-row">
            <PlayerAvatar player={player} className="w-8 h-8 text-xs border-2 border-black bg-white" />
            <span className="font-bold truncate">{player.name || 'Player'}</span>
            {player.isAI && (
              <span className="xp-badge xp-badge--blue ml-auto" title="Computer opponent">AI</span>
            )}
          </div>
        ))}
      </div>

      {!isSpectator && (
        <button
          type="button"
          onClick={onStart}
          className="xp-btn xp-btn--go xp-btn--lg xp-btn--block touch-target"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          Start Game ›
        </button>
      )}
    </div>
  </XpWindow>
)

export default XpWaitingRoom
