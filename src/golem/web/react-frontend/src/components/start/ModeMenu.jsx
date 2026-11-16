import React from 'react'
import StartShell from './StartShell'
import { avatarSrc } from '../../utils/avatar'

function Tile({ title, sub, avatars, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group surface-inset flex w-full items-center gap-4 px-4 py-4 text-left transition-[border-color,filter] duration-150 hover:border-bronze-500/70 hover:brightness-110"
    >
      <span className="flex flex-shrink-0 -space-x-3">
        {avatars.map((id) => (
          <img key={id} src={avatarSrc(id)} alt="" className="h-12 w-12 rounded-full border-2 border-bronze-500/80 object-cover" />
        ))}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-display text-lg font-bold text-bronze-100">{title}</span>
        <span className="text-sm text-fg-muted">{sub}</span>
      </span>
      <span aria-hidden="true" className="font-display text-2xl text-bronze-300 transition-transform group-hover:translate-x-1">›</span>
    </button>
  )
}

/** First screen: pick single player (vs AI) or multiplayer. */
const ModeMenu = ({ onSingle, onMulti }) => (
  <StartShell wordmark="lg" width="md">
    <p className="text-center text-sm text-fg-muted">Collect and upgrade crystals to claim golem cards · 2–5 players</p>
    <div className="flex flex-col gap-3">
      <Tile title="Single Player" sub="Play against 1–4 AI golems" avatars={['4']} onClick={onSingle} />
      <Tile title="Multiplayer" sub="Create a room or join friends online" avatars={['2', '7']} onClick={onMulti} />
    </div>
  </StartShell>
)

export default ModeMenu
