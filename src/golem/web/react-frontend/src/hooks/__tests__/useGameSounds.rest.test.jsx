import { renderHook, cleanup, act } from '@testing-library/react'
import { describe, test, expect, vi, afterEach } from 'vitest'

const play = vi.fn()
const playVictory = vi.fn()
vi.mock('../../utils/sounds', () => ({ default: { play: (...a) => play(...a), playVictory: (...a) => playVictory(...a), toggleMute: vi.fn(), setMuted: vi.fn(), getMuted: () => false } }))

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
    playVictory.mockReset()
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

  test('every card played makes the same card slap: mine and the other players\'', () => {
    expect(soundsFor(me(3, 0), me(2, 1))).toEqual(['playCard'])
    cleanup(); play.mockReset()
    const ai = (played) => ({ id: 2, name: 'AI', hand: [{}], playedCards: Array(played).fill({}), pointCards: [] })
    act(() => useGameStore.setState({
      playerId: 1, isSpectator: false, myPlayer: me(3, 0), currentPlayer: { id: 2 },
      previousGameState: { players: [me(3, 0), ai(0)] }, gameState: { players: [me(3, 0), ai(1)], gameOver: false },
    }))
    renderHook(() => useGameSounds())
    expect(play.mock.calls.map((c) => c[0])).toEqual(['playCard'])
  })

  test('game end: the winner hears the victory fanfare, the others the game-over sound', () => {
    const end = (winnerId) => {
      act(() => useGameStore.setState({
        playerId: 1, isSpectator: false, myPlayer: me(3, 0), currentPlayer: { id: 2 },
        previousGameState: { players: [me(3, 0)] }, gameState: { players: [me(3, 0)], gameOver: true, winner: { id: winnerId } },
      }))
      renderHook(() => useGameSounds())
    }
    end(1)
    expect(playVictory).toHaveBeenCalledTimes(1)
    expect(play).not.toHaveBeenCalledWith('gameOver', true)
    cleanup()
    end(2)
    expect(play).toHaveBeenCalledWith('gameOver', true)
    expect(playVictory).toHaveBeenCalledTimes(1)
  })
})
