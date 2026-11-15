// Number of cards a player took back by resting between two states, 0 if they did not rest.
// A rest moves every played card back to the hand: played goes to 0 and the hand grows.
export function restedCards(prev, cur) {
  if (!prev || !cur) return 0
  const prevPlayed = prev.playedCards?.length || 0
  const curPlayed = cur.playedCards?.length || 0
  const prevHand = prev.hand?.length || 0
  const curHand = cur.hand?.length || 0
  if (prevPlayed > 0 && curPlayed === 0 && curHand > prevHand) return prevPlayed
  return 0
}
