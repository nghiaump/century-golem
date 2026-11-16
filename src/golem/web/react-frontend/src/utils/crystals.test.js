import { describe, test, expect } from 'vitest'
import { cheapest, cheapestList, total, levels, add, sub } from './crystals'

describe('crystals', () => {
  test('cheapest takes yellow first, then green, blue, pink', () => {
    expect(cheapest({ yellow: 1, green: 2, blue: 3, pink: 1 }, 3)).toEqual({ yellow: 1, green: 2, blue: 0, pink: 0 })
    expect(cheapestList({ yellow: 0, green: 0, blue: 3, pink: 7 }, 1)).toEqual(['blue'])
    expect(cheapest({ yellow: 1 }, 4)).toEqual({ yellow: 1, green: 0, blue: 0, pink: 0 }) // not enough: what there is
  })
  test('string counts from the server are numbers', () => {
    expect(total({ yellow: '1', pink: '2' })).toBe(3)
    expect(add({ yellow: '1' }, { yellow: 1 })).toEqual({ yellow: 2, green: 0, blue: 0, pink: 0 })
  })
  test('totals, levels and arithmetic', () => {
    expect(total({ yellow: 3, pink: 2 })).toBe(5)
    expect(levels({ yellow: 1, green: 1, blue: 1, pink: 1 })).toBe(10)
    expect(sub(add({ yellow: 2 }, { green: 1 }), { yellow: 1 })).toEqual({ yellow: 1, green: 1, blue: 0, pink: 0 })
  })
})
