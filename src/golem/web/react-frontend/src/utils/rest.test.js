import { describe, test, expect } from 'vitest'
import { restedCards, restAnchorPosition } from './rest'

const p = (hand, played, extra = {}) => ({ hand: Array(hand).fill({}), playedCards: Array(played).fill({}), ...extra })

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
  test('taking back the only played card (undo) is not a rest', () => {
    expect(restedCards(p(3, 1, { pendingDiscard: 2 }), p(4, 0))).toBe(0)
  })
})

describe('restAnchorPosition', () => {
  const docWith = (rect) => ({
    querySelector: (sel) => (sel === '[data-rest-anchor="3"]' && rect ? { getBoundingClientRect: () => rect } : null),
  })
  const win = { innerWidth: 1200 }

  test('just below the avatar, centered on it', () => {
    const rect = { left: 500, width: 48, top: 40, bottom: 88, height: 48 }
    expect(restAnchorPosition(3, docWith(rect), win)).toEqual({ top: 96, left: 524, caret: 0 })
  })
  test('kept inside the window; the caret still points at the avatar', () => {
    const rect = { left: 10, width: 40, top: 40, bottom: 80, height: 40 }
    expect(restAnchorPosition(3, docWith(rect), win)).toEqual({ top: 88, left: 158, caret: -128 })
  })
  test('null when the avatar is not on screen', () => {
    expect(restAnchorPosition(3, docWith(null), win)).toBeNull()
    expect(restAnchorPosition(3, docWith({ left: 0, width: 0, top: 0, bottom: 0, height: 0 }), win)).toBeNull()
    expect(restAnchorPosition(undefined, docWith(null), win)).toBeNull()
  })
})
