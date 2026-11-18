// Number of cards a player took back by resting between two states, 0 if they did not rest.
// A rest moves every played card back to the hand: played goes to 0 and the hand grows.
// Taking back an overflowing card play (undo) can look the same when it was the only played card,
// but it happens while a discard is pending, and a rest never does.
export function restedCards(prev, cur) {
  if (!prev || !cur || prev.pendingDiscard > 0) return 0
  const prevPlayed = prev.playedCards?.length || 0
  const curPlayed = cur.playedCards?.length || 0
  const prevHand = prev.hand?.length || 0
  const curHand = cur.hand?.length || 0
  if (prevPlayed > 0 && curPlayed === 0 && curHand > prevHand) return prevPlayed
  return 0
}

// Where the "<name> rested" popup goes: just below that player's avatar on the desktop boards
// (PlayerCard / PlayerDock mark it with data-rest-anchor; on phones the opponent's whole chip). null when
// it is not on screen (hidden panel): the popup then shows centered at the top.
export function restAnchorPosition(playerId, doc = document, win = window) {
  return anchorBelow(playerId, 300, doc, win)
}

// Spot for a popup `width` px wide just below a player's data-rest-anchor element, kept inside the
// window: { top, left (its centre), caret (offset of the caret from the centre) }, or null.
export function anchorBelow(playerId, width, doc = document, win = window) {
  if (playerId == null) return null
  const el = doc.querySelector(`[data-rest-anchor="${playerId}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (!r.width || !r.height) return null
  const half = width / 2
  const center = r.left + r.width / 2
  const left = Math.min(Math.max(center, half + 8), Math.max(half + 8, win.innerWidth - half - 8))
  return { top: Math.round(r.bottom + 8), left: Math.round(left), caret: Math.round(center - left) }
}
