import React from 'react'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

const apiFetch = vi.fn()
vi.mock('../../utils/api', () => ({ apiFetch: (...args) => apiFetch(...args) }))

import SinglePlayerLobby from '../SinglePlayerLobby'

describe('SinglePlayerLobby', () => {
  afterEach(() => cleanup())

  beforeEach(() => {
    apiFetch.mockReset()
    apiFetch.mockResolvedValue({ ok: true, json: async () => ({ sessionID: 'single_1' }) })
    try { window.localStorage.clear() } catch { /* ignore */ }
  })

  test('defaults to 3 AIs at Very Hard and sends the chosen difficulty', async () => {
    const onStartGame = vi.fn()
    render(<SinglePlayerLobby onStartGame={onStartGame} onBack={() => {}} />)

    expect(screen.getByDisplayValue('veryhard').checked).toBe(true)
    expect(screen.getByDisplayValue('3').checked).toBe(true)

    fireEvent.click(screen.getByDisplayValue('hard'))
    fireEvent.click(screen.getByRole('button', { name: /start game/i }))

    await waitFor(() => expect(onStartGame).toHaveBeenCalled())
    const body = JSON.parse(apiFetch.mock.calls[0][1].body)
    expect(body.difficulty).toBe('hard')
    expect(body.numAI).toBe(3)
  })

  test('Very Hard shows no extra note about how the AIs play', () => {
    render(<SinglePlayerLobby onStartGame={() => {}} onBack={() => {}} />)
    fireEvent.click(screen.getByDisplayValue('veryhard'))
    expect(screen.queryByText(/one team/i)).toBeNull()
  })
})
