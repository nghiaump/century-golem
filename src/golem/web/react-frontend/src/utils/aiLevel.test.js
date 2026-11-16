import { describe, it, expect } from 'vitest'
import { AI_LEVELS, aiLevelInfo, aiLevelLabel, crystalsToPlace, totalCrystals, DEFAULT_AI_LEVEL } from './aiLevel'

describe('aiLevel', () => {
  it('lists the four levels in order with Very Hard as default', () => {
    expect(AI_LEVELS.map((l) => l.value)).toEqual(['easy', 'medium', 'hard', 'veryhard'])
    expect(DEFAULT_AI_LEVEL).toBe('veryhard')
  })
  it('maps wire values to labels', () => {
    expect(aiLevelLabel('veryhard')).toBe('Very Hard')
    expect(aiLevelInfo('nope')).toBeNull()
    expect(aiLevelLabel('')).toBe('')
  })
  it('reads the official market price', () => {
    expect(crystalsToPlace({ placeCrystals: 3, cost: { yellow: 3 } }, 3)).toBe(3)
    expect(crystalsToPlace({ cost: { yellow: 2 } }, 2)).toBe(2)
    expect(crystalsToPlace({}, 4)).toBe(4)
    expect(totalCrystals({ yellow: 1, green: 2, pink: 1 })).toBe(4)
  })
})
