import React, { useState } from 'react'
import { createLogger } from '../utils/logger'
import { apiFetch } from '../utils/api'
import useOrientation from '../hooks/useOrientation'
import { AVATAR_IDS, avatarSrc } from '../utils/avatar'
import { AI_LEVELS, loadAiLevel, saveAiLevel, aiLevelInfo } from '../utils/aiLevel'
import XpWindow from './XpWindow'

const logger = createLogger('SinglePlayerLobby');

const SinglePlayerLobby = ({ onStartGame, onBack }) => {
  const [playerName, setPlayerName] = useState('Player 1')
  const [numAI, setNumAI] = useState(1)
  const [selectedAvatar, setSelectedAvatar] = useState('4')
  const [difficulty, setDifficulty] = useState(loadAiLevel)
  const [loading, setLoading] = useState(false)
  const { isMobile } = useOrientation()

  const avatars = AVATAR_IDS
  // one compact row (the status bar shows the total number of players)
  const opponentCounts = [1, 2, 3, 4].map((n) => ({ value: n, label: `${n} AI`, title: `${n} AI opponent${n > 1 ? 's' : ''} (${n + 1} players)` }))

  const startGame = async () => {
    setLoading(true)
    try {
      const response = await apiFetch('/api/single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numAI,
          difficulty,
          seed: Date.now(),
        }),
      })

      const data = await response.json()
      if (response.ok) {
        saveAiLevel(difficulty)
        onStartGame(data.sessionID, playerName, selectedAvatar)
      } else {
        logger.error('Failed to create single-player game:', data.error)
        alert('Failed to create game: ' + (data.error || 'Unknown error'))
      }
    } catch (error) {
      logger.error('Error creating single-player game:', error)
      alert('Error creating game: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="xp-desktop">
      <XpWindow
        title="Single Player — Century: Golem Edition"
        icon={avatarSrc(selectedAvatar)}
        onClose={onBack}
        className="max-w-xl"
        status={<><span>Play against AI · {aiLevelInfo(difficulty)?.label}</span><span>{numAI + 1} players</span></>}
      >
        <div className="xp-stack">
          {/* Player Name */}
          <div>
            <label className="xp-field-label" htmlFor="sp-name">Your Name</label>
            <input
              id="sp-name"
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="xp-input"
              placeholder="Enter your name"
            />
          </div>

          {/* Number of AI Opponents */}
          <div>
            <span className="xp-field-label">AI Opponents</span>
            <div className="xp-list xp-list--row" role="radiogroup" aria-label="Number of AI opponents">
              {opponentCounts.map((diff) => (
                <label key={diff.value} className="xp-list-item" data-selected={numAI === diff.value} title={diff.title}>
                  <input
                    type="radio"
                    name="numAI"
                    value={diff.value}
                    checked={numAI === diff.value}
                    onChange={(e) => setNumAI(parseInt(e.target.value))}
                  />
                  <span>{diff.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Difficulty (one level for every AI) */}
          <div>
            <span className="xp-field-label">Difficulty</span>
            <div className="xp-list" role="radiogroup" aria-label="AI difficulty">
              {AI_LEVELS.map((level) => (
                <label key={level.value} className="xp-list-item" data-selected={difficulty === level.value}>
                  <input
                    type="radio"
                    name="difficulty"
                    value={level.value}
                    checked={difficulty === level.value}
                    onChange={(e) => setDifficulty(e.target.value)}
                  />
                  <span className={`xp-badge xp-badge--${level.badge}`}>{level.label}</span>
                  {!isMobile && <span className="text-xs opacity-80">{level.description}</span>}
                </label>
              ))}
            </div>
          </div>

          {/* Avatar Selection */}
          <div>
            <span className="xp-field-label">Your Avatar</span>
            <div className="xp-avatar-grid">
              {avatars.map((avatar) => (
                <button
                  type="button"
                  key={avatar}
                  onClick={() => setSelectedAvatar(avatar)}
                  className="xp-avatar"
                  aria-pressed={selectedAvatar === avatar}
                  aria-label={`Avatar ${avatar}`}
                >
                  <img
                    src={avatarSrc(avatar)}
                    alt=""
                    onError={(e) => {
                      e.target.style.display = 'none'
                    }}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="xp-actions justify-end">
            <button type="button" className="xp-btn" onClick={onBack}>
              Back
            </button>
            <button
              type="button"
              onClick={startGame}
              disabled={loading || !playerName.trim()}
              className="xp-btn xp-btn--go xp-btn--lg touch-target"
            >
              {loading ? 'Creating game...' : 'Start Game ›'}
            </button>
          </div>
        </div>
      </XpWindow>
    </div>
  )
}

export default SinglePlayerLobby
