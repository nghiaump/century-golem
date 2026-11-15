import React from 'react'
import { render, screen, cleanup, act } from '@testing-library/react'
import { describe, test, expect, vi, afterEach } from 'vitest'

const play = vi.fn()
vi.mock('../../utils/sounds', () => ({ default: { play: (...a) => play(...a), setMuted: vi.fn(), getMuted: () => false } }))

import RestPopup from '../RestPopup'
import useGameStore from '../../store/gameStore'

describe('RestPopup', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    play.mockReset()
    act(() => useGameStore.setState({ restPopup: null }))
  })

  test('shows an opponent rest with the cards taken back, plays the rest sound, then hides', () => {
    vi.useFakeTimers()
    render(<RestPopup />)
    expect(screen.queryByText(/rested/)).toBeNull()

    act(() => useGameStore.getState().showRestPopup({ id: 3, name: 'AI 2', isAI: true, avatar: '7', aiAvatar: true }, 5, []))
    expect(screen.getByText(/AI 2 rested/)).toBeTruthy()
    expect(screen.getByText('took back 5 cards')).toBeTruthy()
    expect(play).toHaveBeenCalledWith('rest')
    expect(useGameStore.getState().restPopup.avatarId).toBe('7')

    act(() => vi.advanceTimersByTime(2300))
    expect(useGameStore.getState().restPopup).toBeNull()
  })

  test('a newer rest is not cleared by the older timer', () => {
    vi.useFakeTimers()
    const st = useGameStore.getState()
    act(() => st.showRestPopup({ id: 1, name: 'AI 1' }, 2, []))
    act(() => vi.advanceTimersByTime(1500))
    act(() => st.showRestPopup({ id: 2, name: 'AI 2' }, 4, []))
    act(() => vi.advanceTimersByTime(1000)) // first timer fires here
    expect(useGameStore.getState().restPopup?.playerName).toBe('AI 2')
  })
})
