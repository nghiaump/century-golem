// Reconciles an "Undo" sent from the discard popup with the next state from the server.
// pendingUndo: { kind, card, cardIndex } of the play being taken back; me: my player in the new
// state; history: actionHistory (newest first). Returns null while the server has not answered
// (a discard is still pending), else { reopenPlay, actionHistory } to store.
export function resolveUndo(pendingUndo, me, history = []) {
  if (!pendingUndo || !me || me.pendingDiscard > 0) return null
  const back = !!pendingUndo.card && me.hand?.[pendingUndo.cardIndex]?.id === pendingUndo.card.id
  const top = history[0]
  return {
    reopenPlay: back && (pendingUndo.kind === 'trade' || pendingUndo.kind === 'upgrade') ? pendingUndo : null,
    actionHistory: back && top && !top.isOpponent && top.card?.id === pendingUndo.card.id ? history.slice(1) : history,
  }
}
