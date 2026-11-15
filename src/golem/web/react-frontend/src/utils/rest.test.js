import { describe, test, expect } from 'vitest'
import { restedCards } from './rest'

const p = (hand, played) => ({ hand: Array(hand).fill({}), playedCards: Array(played).fill({}) })

describe('restedCards', () => {
  test('counts the cards taken back on a rest', () => {
    expect(restedCards(p(3, 5), p(8, 0))).toBe(5)
  })
  test('is 0 for other moves', () => {
    expect(restedCards(p(4, 2), p(3, 3))).toBe(0) // played a card
    expect(restedCards(p(4, 2), p(5, 2))).toBe(0) // acquired a card
    expect(restedCards(p(4, 0), p(4, 0))).toBe(0) // nothing played, nothing to take back
    expect(restedCards(null, p(4, 0))).toBe(0)
  })
})
