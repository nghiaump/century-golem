// Plain-language summary of a card, shared by the hover popover, the mobile sheet and aria-labels.
import { total } from '../../utils/crystals'

const words = (res) => ['yellow', 'green', 'blue', 'pink'].filter((c) => res?.[c]).map((c) => `${res[c]} ${c}`).join(', ')

export function cardKind(card, type) {
  if (type === 'point') return 'Golem'
  if (card?.actionType === 1) return 'Upgrade'
  if (card?.actionType === 2) return 'Trade'
  return 'Produce'
}

export function cardSummary(card, type) {
  const kind = cardKind(card, type)
  if (kind === 'Golem') return `Golem worth ${card.points} points, costs ${words(card.requirement) || 'nothing'}`
  if (kind === 'Upgrade') return `Upgrade up to ${card.turnUpgrade || 1} crystal level${(card.turnUpgrade || 1) > 1 ? 's' : ''}`
  if (kind === 'Trade') return `Trade ${words(card.input)} for ${words(card.output)}`
  return `Produce ${words(card.output) || 'crystals'}`
}

export const hasDeposits = (card) => total(card?.deposits) > 0
