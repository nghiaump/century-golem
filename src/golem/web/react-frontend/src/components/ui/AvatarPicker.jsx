import React from 'react'
import { AVATAR_IDS, avatarName, avatarSrc } from '../../utils/avatar'
import { FieldLabel } from './Field'

/** Grid of golem portraits; the picked one is ringed and named. */
const AvatarPicker = ({ value, onChange, label = 'Your Golem', className = '' }) => (
  <div className={`flex flex-col gap-1.5 ${className}`}>
    <div className="flex items-baseline justify-between gap-2">
      <FieldLabel id="avatar-picker-label">{label}</FieldLabel>
      <span className="truncate font-display text-sm font-bold text-bronze-100">{avatarName(value)}</span>
    </div>
    <div role="group" aria-labelledby="avatar-picker-label" className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 md:grid-cols-12">
      {AVATAR_IDS.map((id) => {
        const selected = String(value) === id
        return (
          <button
            type="button"
            key={id}
            onClick={() => onChange(id)}
            aria-pressed={selected}
            aria-label={avatarName(id)}
            title={avatarName(id)}
            className={`relative aspect-square min-h-[44px] overflow-hidden rounded-full border-2 transition-[transform,border-color] duration-150
              ${selected ? 'scale-105 border-bronze-300 shadow-turn' : 'border-black/50 opacity-80 hover:opacity-100 hover:border-bronze-500/70'}`}
          >
            <img src={avatarSrc(id)} alt="" className="h-full w-full object-cover" draggable="false" />
          </button>
        )
      })}
    </div>
  </div>
)

export default AvatarPicker
