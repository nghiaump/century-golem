import React from 'react'
import useGameStore from '../../store/gameStore'
import DepositModal from '../DepositModal'
import UpgradeModal from '../UpgradeModal'
import TradeModal from '../TradeModal'
import ConfirmGolemModal from '../ConfirmGolemModal'

/** The popups opened by useBoardActions handlers (buy, upgrade, trade, claim). */
const BoardModals = ({ actions }) => {
  const { modals, myPlayer } = actions
  const { depositModal, upgradeModal, tradeModal, confirmGolem } = modals
  const resources = myPlayer?.resources || myPlayer?.caravan
  return (
    <>
      {depositModal.show && (
        <DepositModal card={depositModal.card} cardIndex={depositModal.index} onClose={modals.closeDeposit} />
      )}
      {upgradeModal.show && (
        <UpgradeModal
          card={upgradeModal.card}
          playerResources={resources}
          maxTurnUpgrade={upgradeModal.card?.turnUpgrade || 1}
          onConfirm={(input, output) => {
            useGameStore.getState().playCardWithUpgrade(upgradeModal.index, input, output, upgradeModal.card)
            modals.closeUpgrade()
          }}
          onCancel={modals.closeUpgrade}
        />
      )}
      {tradeModal.show && (
        <TradeModal
          card={tradeModal.card}
          playerResources={resources}
          onConfirm={(multiplier) => {
            useGameStore.getState().playCardWithTrade(tradeModal.index, multiplier, tradeModal.card)
            modals.closeTrade()
          }}
          onCancel={modals.closeTrade}
        />
      )}
      <ConfirmGolemModal
        isOpen={confirmGolem.show}
        golem={confirmGolem.golem}
        coin={confirmGolem.coin}
        onConfirm={() => {
          if (confirmGolem.golem) useGameStore.getState().claimPointCard(confirmGolem.index, confirmGolem.golem)
          modals.closeGolem()
        }}
        onCancel={modals.closeGolem}
      />
    </>
  )
}

export default BoardModals
