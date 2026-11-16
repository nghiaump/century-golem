// AI difficulty levels (must match internal/ai/profile.go). `tone` + `pips` style the level Pill
// (components/ui/Pill): the dots carry the level too, not only the colour.
export const AI_LEVELS = [
  { value: 'easy', label: 'Easy', tone: 'moss', pips: 1,
    description: 'Looks one move ahead and sometimes settles for a merely good move.' },
  { value: 'medium', label: 'Medium', tone: 'teal', pips: 2,
    description: 'Plans a few moves ahead with a short search. A solid opponent.' },
  { value: 'hard', label: 'Hard', tone: 'bronze', pips: 3,
    description: 'Searches deeper, reads your plan and blocks whoever is leading.' },
  { value: 'veryhard', label: 'Very Hard', tone: 'ember', pips: 4,
    description: 'The toughest opponents. Good luck.' },
]

export const DEFAULT_AI_LEVEL = 'veryhard'

export const aiLevelInfo = (value) => AI_LEVELS.find((l) => l.value === value) || null

export const aiLevelLabel = (value) => aiLevelInfo(value)?.label || ''

const STORAGE_KEY = 'golem.aiLevel'

// Remember the last choice (localStorage may be unavailable: private mode, blocked storage).
export const loadAiLevel = () => {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    return aiLevelInfo(v) ? v : DEFAULT_AI_LEVEL
  } catch {
    return DEFAULT_AI_LEVEL
  }
}

export const saveAiLevel = (value) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, value)
  } catch {
    // ignore: the choice just is not remembered
  }
}

// Crystals to place for a market card: the server sends `placeCrystals`; older servers only `cost`.
export const crystalsToPlace = (card, index) => {
  if (typeof card?.placeCrystals === 'number') return card.placeCrystals
  const c = card?.cost || {}
  const total = (c.yellow || 0) + (c.green || 0) + (c.blue || 0) + (c.pink || 0)
  return total || index || 0
}

// Total crystals in a caravan/resources map.
export const totalCrystals = (res) =>
  (res?.yellow || 0) + (res?.green || 0) + (res?.blue || 0) + (res?.pink || 0)
