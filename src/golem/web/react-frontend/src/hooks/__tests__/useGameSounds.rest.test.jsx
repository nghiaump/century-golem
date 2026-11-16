import { renderHook, cleanup, act } from '@testing-library/react'
import { describe, test, expect, vi, afterEach } from 'vitest'

const play = vi.fn()
vi.mock('../../utils/sounds', () => ({ default: { play: (...a) => play(...a), toggleMute: vi.fn(), setMuted: vi.fn(), getMuted: () => false } }))

import useGameSounds from '../useGameSounds'
import useGameStore from '../../store/gameStore'

const me = (hand, played, extra = {}) => ({ id: 1, name: 'Me', hand: Array(hand).fill({}), playedCards: Array(played).fill({}), pointCards: [], ...extra })

// My player goes from `prev` to `cur`; another player is to move (no "my turn" sound).
const soundsFor = (prev, cur) => {
  act(() => useGameStore.setState({
    playerId: 1, isSpectator: false, myPlayer: cur, currentPlayer: { id: 2 },
    previousGameState: { players: [prev] }, gameState: { players: [cur], gameOver: false },
  }))
  renderHook(() => useGameSounds())
  return play.mock.calls.map((c) => c[0])
}

describe('useGameSounds', () => {
  afterEach(() => {
    cleanup()
    play.mockReset()
  })

  test('my rest plays only the rest sound (same as an opponent rest)', () => {
    expect(soundsFor(me(3, 4), me(7, 0))).toEqual(['rest'])
  })
  test('buying a card plays the acquire sound', () => {
    expect(soundsFor(me(3, 2), me(4, 2))).toEqual(['acquireMerchant'])
  })
  test('taking back an overflowing card play is silent', () => {
    expect(soundsFor(me(3, 1, { pendingDiscard: 2 }), me(4, 0))).toEqual([])
  })
})
