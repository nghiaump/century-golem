import React from 'react'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { describe, test, expect, vi, afterEach } from 'vitest'

import DiscardModal from '../DiscardModal'
import useGameStore from '../../store/gameStore'

const me = (extra) => ({ id: 2, hand: [], caravan: { yellow: 9, green: 3, blue: 0, pink: 0 }, pendingDiscard: 2, ...extra })

describe('DiscardModal undo', () => {
  afterEach(() => {
    cleanup()
    act(() => useGameStore.setState({ myPlayer: null, ws: null, pendingUndo: null, lastPlay: null }))
  })

  test('offers undo when the server allows it and sends an undo action', () => {
    const send = vi.fn()
    const lastPlay = { kind: 'trade', card: { id: 43 }, cardIndex: 0 }
    act(() => useGameStore.setState({ myPlayer: me({ canUndo: true }), ws: { readyState: 1, send }, lastPlay }))
    render(<DiscardModal />)
    fireEvent.click(screen.getByRole('button', { name: /undo/i }))
    expect(JSON.parse(send.mock.calls[0][0])).toEqual({ type: 'action', actionType: 'undo' })
    expect(useGameStore.getState().pendingUndo).toEqual(lastPlay)
  })

  test('no undo button for a purchase that overflowed', () => {
    act(() => useGameStore.setState({ myPlayer: me({ canUndo: false }) }))
    render(<DiscardModal />)
    expect(screen.getByText(/Too Many Crystals/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /undo/i })).toBeNull()
  })
})
