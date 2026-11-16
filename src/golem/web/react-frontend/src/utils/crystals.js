// Crystal maps {yellow, green, blue, pink} — small helpers shared by the popups.
export const COLORS = ['yellow', 'green', 'blue', 'pink']
export const LEVEL = { yellow: 1, green: 2, blue: 3, pink: 4 }
export const MAX_CARAVAN = 10

export const empty = () => ({ yellow: 0, green: 0, blue: 0, pink: 0 })
export const of = (res) => Object.fromEntries(COLORS.map((c) => [c, res?.[c] || 0]))
export const total = (res) => COLORS.reduce((n, c) => n + (res?.[c] || 0), 0)
export const levels = (res) => COLORS.reduce((n, c) => n + (res?.[c] || 0) * LEVEL[c], 0)
export const add = (a, b) => Object.fromEntries(COLORS.map((c) => [c, (a?.[c] || 0) + (b?.[c] || 0)]))
export const sub = (a, b) => Object.fromEntries(COLORS.map((c) => [c, (a?.[c] || 0) - (b?.[c] || 0)]))
export const times = (a, k) => Object.fromEntries(COLORS.map((c) => [c, (a?.[c] || 0) * k]))

/** The n cheapest crystals of `res`, yellow first (what you give away when the choice doesn't matter). */
export function cheapest(res, n) {
  const out = empty()
  let left = n
  for (const c of COLORS) {
    const take = Math.min(left, res?.[c] || 0)
    out[c] = take
    left -= take
  }
  return out
}

/** Colours of the n cheapest crystals in order, e.g. ['yellow', 'yellow', 'green']. */
export function cheapestList(res, n) {
  const pick = cheapest(res, n)
  return COLORS.flatMap((c) => Array(pick[c]).fill(c))
}
