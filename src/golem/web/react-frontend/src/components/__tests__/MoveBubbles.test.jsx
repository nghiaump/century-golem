import React from 'react'
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react'
import { describe, test, expect, vi, afterEach, beforeEach } from 'vitest'

// no exit animations here: a hidden bubble leaves the DOM at once
vi.mock('framer-motion', async (importOriginal) => ({ ...(await importOriginal()), AnimatePresence: ({ children }) => <>{children}</> }))

import MoveBubbles, { BUBBLE_MS, freshMoves } from '../mobile/MoveBubbles'
import useGameStore, { HISTORY_SIZE } from '../../store/gameStore'

const add = (move) => act(() => useGameStore.getState().addActionToHistory(move))
const took = { type: 'acquire', playerId: 3, playerName: 'AI 2', card: { id: 9, name: 'trade_0002_0100', actionType: 2 }, isOpponent: true }

describe('MoveBubbles', () => {
  let anchor
  beforeEach(() => {
    act(() => useGameStore.setState({ actionHistory: [] }))
    anchor = document.createElement('button')
    anchor.setAttribute('data-rest-anchor', '3')
    anchor.getBoundingClientRect = () => ({ left: 100, width: 120, top: 60, bottom: 150, height: 90, right: 220 })
    document.body.appendChild(anchor)
  })
  afterEach(() => {
    cleanup()
    anchor.remove()
    vi.useRealTimers()
  })

  test('an opponent\'s new card move pops up below their chip, then hides', () => {
    vi.useFakeTimers()
    render(<MoveBubbles />)
    add(took)
    const box = screen.getByTestId('move-bubble')
    expect(box.style.top).toBe('158px')
    expect(box.style.left).toBe('160px')
    expect(box.textContent).toContain('took')
    act(() => vi.advanceTimersByTime(BUBBLE_MS + 500))
    expect(screen.queryByTestId('move-bubble')).toBeNull()
  })

  test('no bubble for moves made before it was shown, my own moves, or rests', () => {
    add(took)
    render(<MoveBubbles />)
    expect(screen.queryByTestId('move-bubble')).toBeNull()
    add({ ...took, isOpponent: undefined, playerId: 1 })
    add({ type: 'rest', playerId: 3, playerName: 'AI 2', card: null, isOpponent: true })
    expect(screen.queryByTestId('move-bubble')).toBeNull()
  })

  test('a tap anywhere hides it; the newest move per player replaces the older one', () => {
    render(<MoveBubbles />)
    add(took)
    add({ ...took, type: 'claim', card: { id: 40, name: 'golem_2200', points: 10 } })
    expect(screen.getAllByTestId('move-bubble')).toHaveLength(1)
    expect(screen.getByTestId('move-bubble').textContent).toContain('claimed')
    fireEvent.pointerDown(document.body)
    expect(screen.queryByTestId('move-bubble')).toBeNull()
  })

  test('freshMoves: newest card move per opponent after a seq', () => {
    const h = [
      { seq: 5, playerId: 3, isOpponent: true, card: { name: 'b' } },
      { seq: 4, playerId: 4, isOpponent: true, card: { name: 'c' } },
      { seq: 3, playerId: 3, isOpponent: true, card: { name: 'a' } },
      { seq: 2, playerId: 4, isOpponent: true, card: { name: 'old' } },
    ]
    expect(freshMoves(h, 2).map((m) => m.card.name)).toEqual(['c', 'b'])
    expect(freshMoves(h, 5)).toEqual([])
  })

  test('history keeps the last HISTORY_SIZE moves, each with a growing seq', () => {
    for (let i = 0; i < HISTORY_SIZE + 5; i++) add({ type: 'play', playerId: 1, card: { name: `c${i}` } })
    const h = useGameStore.getState().actionHistory
    expect(h).toHaveLength(HISTORY_SIZE)
    expect(h[0].card.name).toBe(`c${HISTORY_SIZE + 4}`)
    expect(h[0].seq).toBeGreaterThan(h[1].seq)
  })
})
