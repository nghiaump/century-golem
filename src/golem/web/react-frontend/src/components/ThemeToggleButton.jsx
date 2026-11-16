import React from 'react'
import { useTheme, THEMES } from '../contexts/ThemeContext'
import { IconButton } from './ui/Button'

// Switch between the standard board and the ✨ table layout (desktop only; part of the HUD cluster).
const ThemeToggleButton = ({ size = 'md' }) => {
  const { theme, toggleTheme } = useTheme()
  const isFantasy = theme === THEMES.FANTASY
  return (
    <IconButton
      size={size}
      data-skin-toggle
      label={isFantasy ? 'Back to the standard board' : 'Switch to the table layout'}
      onClick={toggleTheme}
      aria-pressed={isFantasy}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
        <path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8z" opacity={isFantasy ? 1 : 0.85} />
        <path d="M19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9z" />
      </svg>
    </IconButton>
  )
}

export default ThemeToggleButton
