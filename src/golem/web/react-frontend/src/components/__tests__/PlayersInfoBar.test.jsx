import React from 'react'
import { render, screen, cleanup, act, within } from '@testing-library/react'
import { describe, test, expect, afterEach } from 'vitest'
import PlayersInfoBar, { chipLayout, doneForGame } from '../PlayersInfoBar'
import useGameStore from '../../store/gameStore'

const seat = (id, name, extra = {}) => ({ id, name, isAI: id !== 2, hand: [{}], playedCards: [], pointCards: [], caravan: { yellow: id }, ...extra })
const players = [seat(4, 'Magma'), seat(2, 'Me'), seat(7, 'Kiln'), seat(9, 'Rime'), seat(5, 'Onyx')]

const show = (gs) => act(() => useGameStore.setState({
  gameState: { players, market: { actionCards: [{}] }, round: 3, ...gs },
  myPlayer: players[1], currentPlayer: players.find((p) => p.id === (gs.currentPlayer ?? 4)), isSpectator: false,
}))

describe('PlayersInfoBar (phones): everyone in turn order', () => {
  afterEach(() => {
    cleanup()
    act(() => useGameStore.setState({ gameState: null, myPlayer: null, currentPlayer: null }))
  })

  test('all five players, me included, numbered in the order they play; first and last are named', () => {
    show({ currentPlayer: 4 })
    render(<PlayersInfoBar />)
    const chips = within(screen.getByLabelText('Players in turn order')).getAllByRole('button')
    expect(chips).toHaveLength(5)
    expect(chips[0].getAttribute('aria-label')).toMatch(/^Magma, 1st to play, starts the round/)
    expect(chips[1].getAttribute('aria-label')).toMatch(/^You, 2nd to play:/)
    expect(chips[4].getAttribute('aria-label')).toMatch(/^Onyx, 5th to play, last in the round/)
    chips.forEach((c, i) => expect(c.textContent).toContain(String(i + 1)))
  })

  test('last round: players who already had their final turn are marked done', () => {
    show({ currentPlayer: 9, lastRound: true })
    render(<PlayersInfoBar />)
    const chips = within(screen.getByLabelText('Players in turn order')).getAllByRole('button')
    expect(chips.slice(0, 3).every((c) => /done for the game/.test(c.getAttribute('aria-label')))).toBe(true)
    expect(chips.slice(3).some((c) => /done for the game/.test(c.getAttribute('aria-label')))).toBe(false)
  })

  test('helpers', () => {
    expect([130, 112, 104, 80, 70].map(chipLayout)).toEqual(['wide', 'wide', 'medium', 'medium', 'narrow'])
    const gs = { players, currentPlayer: 7, lastRound: true }
    expect([0, 1, 2, 3].map((i) => doneForGame(gs, i))).toEqual([true, true, false, false])
    expect(doneForGame({ ...gs, lastRound: false }, 0)).toBe(false)
  })
})
