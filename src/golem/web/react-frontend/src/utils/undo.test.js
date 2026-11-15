import { describe, test, expect } from 'vitest'
import { resolveUndo } from './undo'

const trade = { id: 43, actionType: 2 }
const pending = { kind: 'trade', card: trade, cardIndex: 1 }

describe('resolveUndo', () => {
  test('waits while the discard is still pending', () => {
    expect(resolveUndo(pending, { pendingDiscard: 2, hand: [] })).toBeNull()
    expect(resolveUndo(null, { pendingDiscard: 0, hand: [] })).toBeNull()
  })
  test('card back in hand: reopen the trade picker and drop the play from history', () => {
    const history = [{ type: 'trade', card: trade }, { type: 'play', card: { id: 7 }, isOpponent: true }]
    const out = resolveUndo(pending, { pendingDiscard: 0, hand: [{ id: 1 }, trade] }, history)
    expect(out.reopenPlay).toBe(pending)
    expect(out.actionHistory).toEqual([history[1]])
  })
  test('produce cards just go back to hand; history kept when the card is not back', () => {
    const produce = { kind: 'produce', card: { id: 501 }, cardIndex: 0 }
    expect(resolveUndo(produce, { pendingDiscard: 0, hand: [{ id: 501 }] }).reopenPlay).toBeNull()
    const history = [{ type: 'trade', card: trade }]
    const out = resolveUndo(pending, { pendingDiscard: 0, hand: [{ id: 1 }] }, history)
    expect(out.reopenPlay).toBeNull()
    expect(out.actionHistory).toBe(history)
  })
})
