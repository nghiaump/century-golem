import React from 'react'
import Panel from './ui/Panel'
import Button from './ui/Button'
import Avatar from './ui/Avatar'
import Pill from './ui/Pill'
import GemLoader from './ui/GemLoader'
import LevelPill from './LevelPill'

// Before the first move: who is in the room + Start Game (desktop board and mobile board).
const WaitingRoom = ({ players = [], isSpectator, onStart, className = '', mode }) => (
  <Panel title="Waiting Room" className={`w-full max-w-md ${className}`}>
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-fg-muted">
          {mode === 'single'
            ? 'Your AI opponents are ready. Start whenever you are.'
            : 'Waiting for other players to join. Start whenever everyone is in.'}
        </p>
        {mode !== 'single' ? <GemLoader size={12} label="Waiting for players" /> : null}
      </div>

      <ul className="surface-inset flex flex-col divide-y divide-black/30">
        {players.map((player, i) => (
          <li key={`${player.name}-${i}`} className="flex items-center gap-3 px-3 py-2">
            <Avatar player={player} size={36} />
            <span className="min-w-0 flex-1 truncate font-semibold">{player.name || 'Player'}</span>
            {player.isAI ? (player.aiLevel ? <LevelPill level={player.aiLevel} /> : <Pill tone="teal">AI</Pill>) : null}
          </li>
        ))}
      </ul>
      <p className="text-xs text-fg-muted">{players.length} player{players.length === 1 ? '' : 's'} in the room</p>

      {!isSpectator && (
        <Button size="lg" block onClick={onStart}>Start Game</Button>
      )}
    </div>
  </Panel>
)

export default WaitingRoom
