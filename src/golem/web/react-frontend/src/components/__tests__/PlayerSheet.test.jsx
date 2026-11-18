import React from 'react'
import { render, screen, cleanup, act, fireEvent, within } from '@testing-library/react'
import { describe, test, expect, afterEach } from 'vitest'
import PlayersInfoBar from '../PlayersInfoBar'
import useGameStore from '../../store/gameStore'

const me = { id: 1, name: 'Me', hand: [], playedCards: [], pointCards: [], caravan: { yellow: 3 } }
const ai = {
  id: 3, name: 'AI 2', isAI: true, hand: [{}, {}], caravan: { yellow: 1, blue: 2 },
  playedCards: [{ id: 11, name: 'mint_0002' }, { id: 12, name: 'upgrade_2', actionType: 1 }],
  pointCards: [{ id: 40, name: 'golem_2200', points: 10 }],
}

describe('opponent chip → player sheet (phones)', () => {
  afterEach(() => {
    cleanup()
    act(() => useGameStore.setState({ gameState: null, myPlayer: null, currentPlayer: null, actionHistory: [] }))
  })

  test('tapping a chip shows their last moves, played cards (newest first) and golems', () => {
    act(() => {
      useGameStore.setState({
        gameState: { players: [me, ai], market: { actionCards: [] }, currentPlayer: 1 },
        myPlayer: me, currentPlayer: me, isSpectator: false, actionHistory: [],
      })
      const st = useGameStore.getState()
      st.addActionToHistory({ type: 'acquire', playerId: 3, playerName: 'AI 2', card: { id: 9, name: 'trade_0002_0100', actionType: 2, input: { yellow: 2 }, output: { blue: 1 } }, isOpponent: true })
      st.addActionToHistory({ type: 'play', playerId: 1, playerName: 'Me', card: { id: 5, name: 'mint_0002' } })
    })
    render(<PlayersInfoBar />)
    const chip = screen.getByRole('button', { name: /AI 2, 2nd to play, last in the round: 10 points, 1 golems, 2 in hand, 2 played/ })
    expect(chip.getAttribute('data-rest-anchor')).toBe('3')
    fireEvent.click(chip)

    const sheet = screen.getByRole('dialog')
    const moves = within(sheet).getByRole('list', { name: /last moves/ })
    expect(within(moves).getAllByRole('listitem')).toHaveLength(1) // only AI 2's move, not mine
    expect(moves.textContent).toContain('Took')
    expect(moves.textContent).toContain('Trade 2 yellow for 1 blue')
    expect(within(sheet).getByText('Played since last rest · 2')).toBeTruthy()
    const played = within(sheet).getAllByRole('img').map((el) => el.getAttribute('alt') || el.getAttribute('aria-label')).filter(Boolean)
    expect(played.indexOf('upgrade_2')).toBeLessThan(played.indexOf('mint_0002'))
    expect(within(sheet).getByText('Golems · 1')).toBeTruthy()

    fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
