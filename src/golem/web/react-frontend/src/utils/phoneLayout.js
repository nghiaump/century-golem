// Card sizes for the phone board, so that everything fits on one screen without scrolling
// (only my own hand scrolls sideways when it is long). Cards are printed at width : height = 0.58.

export const CARD_RATIO = 0.58

/** Explicit box for a card of height h (Safari needs the width spelled out — see hooks/useElementSize). */
export const cardBox = (h) => ({ height: Math.round(h), width: Math.round(h * CARD_RATIO) })

export const HAND_MIN = 84
export const HAND_MAX = 160
const CARD_MIN = 56
// Section headers ("Golems", "Market") + room for the badges that stick out of the cards + gap between sections.
export const BOARD_CHROME = 2 * 24 + 2 * 8 + 10

const fitWidth = (width, n, gap) => (width - gap * (n - 1)) / n / CARD_RATIO
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

/**
 * Split the height left for cards between the golem row (5 cards), the market (always one compact row
 * of 6 — the user prefers room over big merchant cards, 2026-11-18) and, in portrait, my hand row.
 * `avail` = board area height + current hand-card row height (the two flex with each other, so their sum
 * is fixed). Each row is capped by what the width allows; what is left goes to the hand, then to spacing.
 * Returns integer heights { golem, market, marketCols: 6, hand, spare }.
 */
export function planPhoneBoard({ width, avail, withHand = true }) {
  const T = avail - BOARD_CHROME
  const golemCap = fitWidth(width, 5, 6)
  const marketCap = fitWidth(width, 6, 5)
  let hand = withHand ? clamp(T * 0.24, HAND_MIN, HAND_MAX) : 0
  const R = T - hand
  // golems and market share equally; a width cap frees height for the other row
  let market = Math.min(marketCap, R / 2)
  const golem = Math.min(golemCap, R - market)
  market = Math.min(marketCap, R - golem)
  let spare = R - golem - market
  if (withHand) {
    const add = Math.min(spare, HAND_MAX - hand)
    hand += add
    spare -= add
  }
  return {
    golem: Math.floor(Math.max(CARD_MIN, golem)),
    market: Math.floor(Math.max(CARD_MIN, market)),
    marketCols: 6,
    hand: Math.floor(hand),
    spare: Math.max(0, Math.floor(spare)),
  }
}
