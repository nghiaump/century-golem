import React from 'react'
import useGameStore from '../store/gameStore'
import soundManager from '../utils/sounds'
import { IconButton } from './ui/Button'

// Mute / unmute game sounds (part of the HUD cluster).
export default function SoundToggleButton() {
  const { soundsMuted, toggleSoundsMuted } = useGameStore()
  const toggle = () => soundManager.setMuted(toggleSoundsMuted())
  return (
    <IconButton label={soundsMuted ? 'Unmute sounds' : 'Mute sounds'} onClick={toggle} aria-pressed={soundsMuted}>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z" />
        {soundsMuted ? <path d="M16 9.5l5 5M21 9.5l-5 5" /> : <path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11" />}
      </svg>
    </IconButton>
  )
}
