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

  test('defaults to Medium and sends the chosen difficulty', async () => {
    const onStartGame = vi.fn()
    render(<SinglePlayerLobby onStartGame={onStartGame} onBack={() => {}} />)

    const medium = screen.getByDisplayValue('medium')
    expect(medium.checked).toBe(true)

    fireEvent.click(screen.getByDisplayValue('hard'))
    fireEvent.click(screen.getByRole('button', { name: /start game/i }))

    await waitFor(() => expect(onStartGame).toHaveBeenCalled())
    const body = JSON.parse(apiFetch.mock.calls[0][1].body)
    expect(body.difficulty).toBe('hard')
    expect(body.numAI).toBe(1)
  })

  test('discloses the coalition for Very Hard', () => {
    render(<SinglePlayerLobby onStartGame={() => {}} onBack={() => {}} />)
    expect(screen.queryByText(/play as one team against you/i)).toBeNull()
    fireEvent.click(screen.getByDisplayValue('veryhard'))
    expect(screen.getByText(/All AIs play as one team against you/i)).toBeTruthy()
  })
})
