import React, { useRef, useState } from 'react'
import { AVATAR_IDS, avatarName, avatarSrc } from '../../utils/avatar'
import { CUSTOM, loadImageFile, loadStoredPicture, storePicture } from '../../utils/customAvatar'
import { showToast } from '../../utils/toast'
import AvatarCropper from '../AvatarCropper'
import { FieldLabel } from './Field'

const tile = (selected) => `relative aspect-square min-h-[44px] overflow-hidden rounded-full border-2 transition-[transform,border-color] duration-150
  ${selected ? 'scale-105 border-bronze-300 shadow-turn' : 'border-black/50 opacity-80 hover:opacity-100 hover:border-bronze-500/70'}`

/**
 * Grid of golem portraits, plus the player's own picture: "Upload" picks an image (≤ 5 MB), the
 * cropper fits it into the circle, and the result (256 px) is kept in this browser. `value` CUSTOM =
 * "my picture" (uploaded when the game starts — see utils/customAvatar).
 */
const AvatarPicker = ({ value, onChange, label = 'Your Golem', allowUpload = true, className = '' }) => {
  const [picture, setPicture] = useState(loadStoredPicture)
  const [cropping, setCropping] = useState(null)
  const fileRef = useRef(null)

  const pick = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // picking the same file again still fires
    if (!file) return
    try {
      setCropping(await loadImageFile(file))
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const done = (dataUrl) => {
    setCropping(null)
    setPicture(dataUrl)
    storePicture(dataUrl)
    onChange(CUSTOM)
  }

  const remove = () => {
    setPicture(null)
    storePicture(null)
    if (value === CUSTOM) onChange('4')
  }

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-baseline justify-between gap-2">
        <FieldLabel id="avatar-picker-label">{label}</FieldLabel>
        <span className="truncate font-display text-sm font-bold text-bronze-100">{value === CUSTOM ? 'Your picture' : avatarName(value)}</span>
      </div>
      <div role="group" aria-labelledby="avatar-picker-label" className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 md:grid-cols-12">
        {allowUpload && picture ? (
          <span className="relative">
            <button type="button" onClick={() => onChange(CUSTOM)} aria-pressed={value === CUSTOM} aria-label="Your picture" title="Your picture" className={`${tile(value === CUSTOM)} w-full`}>
              <img src={picture} alt="" className="h-full w-full object-cover" draggable="false" />
            </button>
            <button
              type="button"
              onClick={remove}
              aria-label="Remove your picture"
              title="Remove your picture"
              data-allow-small
              className="absolute -right-1 -top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-black/60 bg-rock-800 text-xs font-bold text-fg hover:bg-ember"
            >
              ×
            </button>
          </span>
        ) : null}
        {allowUpload ? (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label={picture ? 'Upload a different picture' : 'Upload your own picture'}
            title={picture ? 'Upload a different picture' : 'Upload your own picture (up to 5 MB)'}
            className="flex aspect-square min-h-[44px] flex-col items-center justify-center rounded-full border-2 border-dashed border-bronze-500/70 text-bronze-300 hover:border-bronze-300 hover:bg-rock-700/50"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 16V5M7.5 9.5L12 5l4.5 4.5M5 19h14" />
            </svg>
          </button>
        ) : null}
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
              className={tile(selected)}
            >
              <img src={avatarSrc(id)} alt="" className="h-full w-full object-cover" draggable="false" />
            </button>
          )
        })}
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pick} aria-hidden="true" tabIndex={-1} />
      {cropping ? <AvatarCropper image={cropping} onCancel={() => setCropping(null)} onDone={done} /> : null}
    </div>
  )
}

export default AvatarPicker
