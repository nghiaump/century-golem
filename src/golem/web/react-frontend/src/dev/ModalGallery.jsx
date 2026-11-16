import React, { useEffect, useState } from 'react'
import useGameStore from '../store/gameStore'
import NightBackdrop from '../components/ui/NightBackdrop'
import TradeModal from '../components/TradeModal'
import UpgradeModal from '../components/UpgradeModal'
import DepositModal from '../components/DepositModal'
import DiscardModal from '../components/DiscardModal'
import ConfirmGolemModal from '../components/ConfirmGolemModal'
import GameOverModal from '../components/GameOverModal'

// Dev only (?gallery&modal=trade|upgrade|deposit|discard|claim|gameover): one popup on fake game data.
const golem = (id, points, req) => ({ id, name: 'golem_2022', points, requirement: req })
const card = (name, extra = {}) => ({ name, ...extra })
const players = [
  { id: 1, name: 'Basalt', isAI: true, aiAvatar: true, avatar: '1', aiLevel: 'veryhard', caravan: { yellow: 1, green: 2, blue: 0, pink: 1 },
    pointCards: [{ points: 12 }, { points: 8 }, { points: 16 }, { points: 6 }, { points: 10 }], coins: [{ points: 3 }, { points: 3 }, { points: 3 }] },
  { id: 2, name: 'Mossback', isAI: true, aiAvatar: true, avatar: '2', aiLevel: 'veryhard', caravan: { yellow: 2, green: 4 },
    pointCards: [{ points: 8 }, { points: 12 }, { points: 10 }, { points: 9 }], coins: [{ points: 3 }, { points: 3 }] },
  { id: 3, name: 'Đặng Thị Ngọc Ánh', avatar: '4', caravan: { yellow: 9, green: 3, blue: 1, pink: 0 }, pendingDiscard: 3, canUndo: true,
    pointCards: [{ points: 8 }, { points: 9 }, { points: 11 }, { points: 13 }], coins: [{ points: 3 }, { points: 1 }, { points: 3 }, { points: 3 }] },
  { id: 4, name: 'Cinder', isAI: true, aiAvatar: true, avatar: '4', aiLevel: 'veryhard', caravan: {},
    pointCards: [{ points: 17 }, { points: 15 }, { points: 20 }], coins: [] },
]

export default function ModalGallery({ which }) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    useGameStore.setState({
      myPlayer: players[2],
      gameState: { gameOver: which === 'gameover', currentTurn: 115, winner: { id: 1 }, players, market: { coins: [{ amount: 1 }, { amount: 6 }] } },
    })
    setReady(true)
  }, [which])
  if (!ready) return null
  const res = { yellow: 4, green: 2, blue: 1, pink: 0 }
  const noop = () => {}
  return (
    <div className="min-h-screen">
      <NightBackdrop />
      {which === 'trade' && <TradeModal card={card('trade_0002_0020', { input: { yellow: 2 }, output: { green: 2 } })} playerResources={{ yellow: 6, green: 1, blue: 1 }} onConfirm={noop} onCancel={noop} />}
      {which === 'upgrade' && <UpgradeModal card={card('upgrade_3')} playerResources={res} maxTurnUpgrade={3} onConfirm={noop} onCancel={noop} />}
      {which === 'deposit' && <DepositModal card={card('trade_0003_0110', { deposits: { yellow: 1, pink: 1 } })} cardIndex={3} onClose={noop} />}
      {which === 'discard' && <DiscardModal />}
      {which === 'claim' && <ConfirmGolemModal isOpen golem={golem(124, 17, { yellow: 2, blue: 2, pink: 2 })} coin="copper" onConfirm={noop} onCancel={noop} />}
      {which === 'gameover' && <GameOverModal onNewGame={noop} onBackToMenu={noop} />}
    </div>
  )
}
