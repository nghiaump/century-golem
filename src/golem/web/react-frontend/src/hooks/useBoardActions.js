import { useState } from 'react'
import useGameStore from '../store/gameStore'
import useReopenAfterUndo from './useReopenAfterUndo'
import { showToast } from '../utils/toast'
import { crystalsToPlace } from '../utils/aiLevel'
import { COLORS, total } from '../utils/crystals'

const NAMES = { yellow: 'Yellow', green: 'Green', blue: 'Blue', pink: 'Pink' }
const CLOSED = { show: false, card: null, index: null }

/**
 * Everything a board needs to act on the game, shared by the desktop, mobile and ✨ layouts:
 * whose turn it is, what the player can afford, the coin on each golem slot, and the handlers that
 * open the right popup (rendered by <BoardModals actions={…} />).
 * `reopenAfterUndo`: this instance reopens the trade/upgrade picker after an Undo (only one per screen).
 */
export default function useBoardActions({ reopenAfterUndo = false } = {}) {
  const gameState = useGameStore((s) => s.gameState)
  const myPlayer = useGameStore((s) => s.myPlayer)
  const currentPlayer = useGameStore((s) => s.currentPlayer)
  const isSpectator = useGameStore((s) => s.isSpectator)
  const store = useGameStore.getState

  const [depositModal, setDepositModal] = useState(CLOSED)
  const [upgradeModal, setUpgradeModal] = useState(CLOSED)
  const [tradeModal, setTradeModal] = useState(CLOSED)
  const [confirmGolem, setConfirmGolem] = useState({ show: false, golem: null, index: null, coin: null })

  useReopenAfterUndo(({ kind, card, cardIndex }) => {
    if (kind === 'upgrade') setUpgradeModal({ show: true, card, index: cardIndex })
    else if (kind === 'trade') setTradeModal({ show: true, card, index: cardIndex })
  }, reopenAfterUndo)

  // Waiting room: the server sends no market (or an empty one) before the game starts
  const market = gameState?.market
  const isWaiting = gameState?.status === 'waiting' || !market || Object.keys(market).length === 0
  const actionCards = market?.actionCards || []
  const pointCards = market?.pointCards || []
  const coins = market?.coins || []
  const caravan = myPlayer?.caravan || myPlayer?.resources || {}
  const isMyTurn = !isSpectator && !isWaiting && !!myPlayer && currentPlayer?.id === myPlayer?.id
  const hand = myPlayer?.hand || []
  const playedCards = myPlayer?.playedCards || []
  const canRest = isMyTurn && playedCards.length > 0

  // Market card k costs k crystals (one on each card to its left)
  const placeCost = (index) => crystalsToPlace(actionCards[index], index)
  const canAfford = (index) => !isSpectator && total(caravan) >= placeCost(index)
  const canClaim = (card) => !isSpectator && !!card?.requirement && COLORS.every((c) => (caravan[c] || 0) >= (card.requirement[c] || 0))

  // Coin on golem slot: slot 1 takes the first coin left (copper, then silver); slot 2 the silver one
  // while copper coins remain (official rules).
  const coinFor = (index) => {
    const copper = coins[0]?.amount > 0 ? coins[0] : null
    const silver = coins[1]?.amount > 0 ? coins[1] : null
    if (index === 0) {
      if (copper) return { kind: 'copper', left: copper.amount }
      if (silver) return { kind: 'silver', left: silver.amount }
    } else if (index === 1 && copper && silver) {
      return { kind: 'silver', left: silver.amount }
    }
    return null
  }

  const guard = () => {
    if (isSpectator) { showToast('You are watching — spectators cannot act', 'info'); return false }
    if (!isMyTurn) { showToast('Not your turn yet', 'info'); return false }
    return true
  }

  const onMarketCard = (index) => {
    if (!guard()) return
    const card = actionCards[index]
    if (!canAfford(index)) {
      showToast(`Card ${index + 1} needs ${placeCost(index)} crystals to place`, 'error')
      return
    }
    // the free first card is taken at once unless crystals lie on it (then show what you pick up)
    if (index === 0 && total(card?.deposits) === 0) {
      store().acquireCard(0, [], card)
      return
    }
    setDepositModal({ show: true, card, index })
  }

  const onGolem = (index) => {
    if (!guard()) return
    const card = pointCards[index]
    if (!canClaim(card)) {
      const missing = COLORS.filter((c) => (card?.requirement?.[c] || 0) > (caravan[c] || 0))
        .map((c) => `${card.requirement[c] - (caravan[c] || 0)} ${NAMES[c]}`)
      showToast(`Missing ${missing.join(', ')}`, 'error')
      return
    }
    setConfirmGolem({ show: true, golem: card, index, coin: coinFor(index)?.kind || null })
  }

  const onHandCard = (card, index) => {
    if (!guard()) return
    if (card.actionType === 1) setUpgradeModal({ show: true, card, index })
    else if (card.actionType === 2) setTradeModal({ show: true, card, index })
    else store().playCard(index, card)
  }

  const onRest = () => {
    if (canRest) store().rest()
  }

  const onStartGame = async () => {
    const result = await store().startGame()
    if (!result?.success) showToast(result?.error || 'Could not start the game', 'error')
  }

  const modals = {
    depositModal, upgradeModal, tradeModal, confirmGolem,
    closeDeposit: () => setDepositModal(CLOSED),
    closeUpgrade: () => setUpgradeModal(CLOSED),
    closeTrade: () => setTradeModal(CLOSED),
    closeGolem: () => setConfirmGolem({ show: false, golem: null, index: null, coin: null }),
  }

  return {
    gameState, myPlayer, currentPlayer, isSpectator, isWaiting, isMyTurn,
    actionCards, pointCards, coins, caravan, hand, playedCards, canRest,
    placeCost, canAfford, canClaim, coinFor,
    onMarketCard, onGolem, onHandCard, onRest, onStartGame,
    modals,
  }
}
