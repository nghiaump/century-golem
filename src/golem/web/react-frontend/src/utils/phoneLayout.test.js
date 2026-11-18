import { describe, test, expect } from 'vitest'
import { planPhoneBoard, cardBox, BOARD_CHROME, CARD_RATIO, HAND_MIN, HAND_MAX } from './phoneLayout'

const used = (p) => p.golem + p.market + p.hand + p.spare + BOARD_CHROME
const fitsWidth = (p, width) => p.golem * CARD_RATIO * 5 + 24 <= width + 1 && p.market * CARD_RATIO * 6 + 25 <= width + 1

describe('planPhoneBoard', () => {
  test('iPhone in Safari (toolbar shown): one market row, everything fits', () => {
    const p = planPhoneBoard({ width: 369, avail: 400 })
    expect(p.marketCols).toBe(6)
    expect(used(p)).toBeLessThanOrEqual(400)
    expect(fitsWidth(p, 369)).toBe(true)
    expect(p.hand).toBeGreaterThanOrEqual(HAND_MIN)
    expect(p.hand).toBeLessThanOrEqual(HAND_MAX)
  })

  test('tall screen: market stays one compact row, the spare height goes to the hand', () => {
    const p = planPhoneBoard({ width: 369, avail: 520 })
    expect(p.marketCols).toBe(6)
    expect(fitsWidth(p, 369)).toBe(true)
    expect(p.hand).toBe(HAND_MAX)
    expect(used(p)).toBeLessThanOrEqual(520)
  })

  test('small phone still fits; landscape (no hand row) too', () => {
    const small = planPhoneBoard({ width: 351, avail: 290 })
    expect(used(small)).toBeLessThanOrEqual(290 + 1)
    const side = planPhoneBoard({ width: 470, avail: 280, withHand: false })
    expect(side.hand).toBe(0)
    expect(side.golem + side.market + BOARD_CHROME).toBeLessThanOrEqual(280)
  })

  test('cardBox spells out both sides', () => {
    expect(cardBox(100)).toEqual({ height: 100, width: 58 })
  })
})
