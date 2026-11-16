import React, { useState } from 'react'
import { createLogger } from '../utils/logger'
import { apiFetch } from '../utils/api'
import { showToast } from '../utils/toast'
import useOrientation from '../hooks/useOrientation'
import { AI_LEVELS, loadAiLevel, saveAiLevel, aiLevelInfo } from '../utils/aiLevel'
import StartShell from './start/StartShell'
import Button from './ui/Button'
import Field from './ui/Field'
import Segmented from './ui/Segmented'
import AvatarPicker from './ui/AvatarPicker'
import Pill from './ui/Pill'

const logger = createLogger('SinglePlayerLobby')

const OPPONENTS = [1, 2, 3, 4].map((n) => ({ value: String(n), label: `${n} AI`, title: `${n} AI opponent${n > 1 ? 's' : ''} (${n + 1} players)` }))

const SinglePlayerLobby = ({ onStartGame, onBack }) => {
  const [playerName, setPlayerName] = useState('Player 1')
  const [numAI, setNumAI] = useState(3)
  const [selectedAvatar, setSelectedAvatar] = useState('4')
  const [difficulty, setDifficulty] = useState(loadAiLevel)
  const [loading, setLoading] = useState(false)
  const { isCompact } = useOrientation()

  const startGame = async () => {
    setLoading(true)
    try {
      const response = await apiFetch('/api/single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numAI, difficulty, seed: Date.now() }),
      })
      const data = await response.json()
      if (response.ok) {
        saveAiLevel(difficulty)
        onStartGame(data.sessionID, playerName, selectedAvatar)
      } else {
        logger.error('Failed to create single-player game:', data.error)
        showToast(`Could not create the game: ${data.error || 'unknown error'}`, 'error')
      }
    } catch (error) {
      logger.error('Error creating single-player game:', error)
      showToast(`Could not create the game: ${error.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const levels = AI_LEVELS.map((l) => ({
    value: l.value,
    label: l.label,
    hint: isCompact ? undefined : l.description,
    extra: <Pill tone={l.tone} pips={l.pips} aria-hidden="true" className="!px-1.5" />,
  }))

  return (
    <StartShell
      title="Single Player"
      subtitle={`${numAI + 1} players · ${aiLevelInfo(difficulty)?.label || ''} AI`}
      onBack={onBack}
      width="lg"
      footer={(
        <Button size="lg" onClick={startGame} disabled={loading || !playerName.trim()} className="w-full sm:w-auto">
          {loading ? 'Creating game…' : 'Start Game'}
        </Button>
      )}
    >
      <Field
        id="sp-name"
        label="Your Name"
        value={playerName}
        onChange={(e) => setPlayerName(e.target.value)}
        placeholder="Enter your name"
        maxLength={24}
        autoComplete="nickname"
      />
      <Segmented name="numAI" label="AI Opponents" value={numAI} onChange={(v) => setNumAI(parseInt(v, 10))} options={OPPONENTS} columns={4} />
      <Segmented name="difficulty" label="Difficulty" value={difficulty} onChange={setDifficulty} options={levels} stacked />
      <AvatarPicker value={selectedAvatar} onChange={setSelectedAvatar} />
    </StartShell>
  )
}

export default SinglePlayerLobby
