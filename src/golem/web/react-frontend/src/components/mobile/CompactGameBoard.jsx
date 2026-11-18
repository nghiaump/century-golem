import React, { useState } from 'react'
import useBoardActions from '../../hooks/useBoardActions'
import WaitingRoom from '../WaitingRoom'
import CardTile from '../board/CardTile'
import CardSheet from '../board/CardSheet'
import BoardModals from '../board/BoardModals'
import Coin from '../ui/Coin'
import DifficultyBadge from '../DifficultyBadge'
import { cardBox } from '../../utils/phoneLayout'

const Section = ({ title, actions, children }) => (
  <section className="flex flex-col">
    <div className="flex h-6 items-center justify-between px-0.5">
      <h2 className="font-display text-xs font-bold uppercase tracking-wider text-bronze-300 text-engrave">{title}</h2>
      {actions}
    </div>
    {children}
  </section>
)

const FALLBACK = { golem: 110, market: 100, marketCols: 6 }

/**
 * Phones: the five golems in one row and the six market cards in one compact row,
 * sized by `plan` (utils/phoneLayout) so the whole board fits the screen. Tapping a card opens its
 * sheet with the action (take / claim) — no accidental buys from a mis-tap.
 */
const CompactGameBoard = ({ plan = FALLBACK }) => {
  const a = useBoardActions()
  const [sheet, setSheet] = useState(null)
  const { gameState, isSpectator, isWaiting, isMyTurn } = a

  if (isWaiting) {
    return (
      <div className="flex h-full w-full items-center justify-center px-3 py-3">
        <WaitingRoom players={gameState.players || []} isSpectator={isSpectator} onStart={a.onStartGame} mode={gameState?.mode} />
      </div>
    )
  }

  const notNow = isSpectator ? 'You are watching this game.' : !isMyTurn ? 'Wait for your turn.' : null

  const openMarket = (card, i) => {
    const cost = a.placeCost(i)
    const affordable = a.canAfford(i)
    setSheet({
      card, type: 'action', slot: i + 1, placeCost: cost,
      action: {
        label: cost === 0 ? 'Take card' : `Place ${cost} & take`,
        onClick: () => a.onMarketCard(i),
        disabled: !!notNow || !affordable,
        reason: notNow || (!affordable ? `You need ${cost} crystals to place.` : null),
      },
    })
  }
  const openGolem = (card, i) => {
    const claimable = a.canClaim(card)
    setSheet({
      card, type: 'point', slot: i + 1, coin: a.coinFor(i),
      action: { label: 'Claim golem', onClick: () => a.onGolem(i), disabled: !!notNow || !claimable, reason: notNow || (!claimable ? 'You don’t have the crystals it costs yet.' : null) },
    })
  }

  return (
    <div className="flex min-h-full flex-col justify-center gap-2.5 px-3">
      <Section
        title="Golems"
        actions={(
          <span className="flex items-center gap-2 text-xs text-fg-muted">
            <span className="inline-flex items-center gap-1"><Coin kind="copper" size={16} />{a.coins[0]?.amount ?? 0}</span>
            <span className="inline-flex items-center gap-1"><Coin kind="silver" size={16} />{a.coins[1]?.amount ?? 0}</span>
          </span>
        )}
      >
        <div className="flex items-end justify-between pt-2" role="list">
          {a.pointCards.slice(0, 5).map((card, i) => {
            const claimable = a.canClaim(card)
            return (
              <div key={card.id || `g${i}`} role="listitem" className="flex-shrink-0" style={cardBox(plan.golem)}>
                <CardTile card={card} type="point" slot={i + 1} showSlot={false} coin={a.coinFor(i)} ready={isMyTurn && claimable} dim={isMyTurn && !claimable} onInspect={() => openGolem(card, i)} />
              </div>
            )
          })}
        </div>
      </Section>

      <Section title="Market" actions={<DifficultyBadge />}>
        <div className="flex items-end justify-between pt-2" role="list">
          {a.actionCards.slice(0, 6).map((card, i) => {
            const affordable = a.canAfford(i)
            return (
              <div key={card.id || `m${i}`} role="listitem" className="flex-shrink-0" style={cardBox(plan.market)}>
                <CardTile card={card} slot={i + 1} showSlot={false} placeCost={a.placeCost(i)} ready={isMyTurn && affordable} dim={isMyTurn && !affordable} onInspect={() => openMarket(card, i)} />
              </div>
            )
          })}
        </div>
      </Section>

      <CardSheet sheet={sheet} onClose={() => setSheet(null)} />
      <BoardModals actions={a} />
    </div>
  )
}

export default CompactGameBoard
