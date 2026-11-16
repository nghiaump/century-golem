import React, { useState } from 'react'
import useBoardActions from '../../hooks/useBoardActions'
import WaitingRoom from '../WaitingRoom'
import CardTile from '../board/CardTile'
import CardSheet from '../board/CardSheet'
import BoardModals from '../board/BoardModals'
import Coin from '../ui/Coin'

const Section = ({ title, actions, children }) => (
  <section className="flex flex-col gap-2">
    <div className="flex items-center justify-between px-1">
      <h2 className="font-display text-xs font-bold uppercase tracking-wider text-bronze-300 text-engrave">{title}</h2>
      {actions}
    </div>
    {children}
  </section>
)

/**
 * Phones: golems (one row, swipe) and the market (3 × 2; one row when held sideways). Tapping a card
 * opens its sheet with the action (take / claim) — no accidental buys from a mis-tap.
 */
const CompactGameBoard = ({ landscape = false }) => {
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
    <div className="flex flex-col gap-4 px-3 pb-4 pt-1">
      <Section
        title="Golems"
        actions={(
          <span className="flex items-center gap-2 text-xs text-fg-muted">
            <span className="inline-flex items-center gap-1"><Coin kind="copper" size={16} />{a.coins[0]?.amount ?? 0}</span>
            <span className="inline-flex items-center gap-1"><Coin kind="silver" size={16} />{a.coins[1]?.amount ?? 0}</span>
          </span>
        )}
      >
        <div className="scrollbar-hide -mx-3 flex snap-x scroll-pl-3 gap-3 overflow-x-auto px-3 pb-1 pt-2" role="list">
          {a.pointCards.slice(0, 5).map((card, i) => {
            const claimable = a.canClaim(card)
            return (
              <div key={card.id || `g${i}`} role="listitem" className="h-[150px] flex-shrink-0 snap-start">
                <CardTile card={card} type="point" slot={i + 1} coin={a.coinFor(i)} ready={isMyTurn && claimable} dim={isMyTurn && !claimable} onInspect={() => openGolem(card, i)} />
              </div>
            )
          })}
        </div>
      </Section>

      <Section title="Market">
        <div className={`grid gap-3 pt-2 ${landscape ? 'grid-cols-6' : 'grid-cols-3'}`}>
          {a.actionCards.slice(0, 6).map((card, i) => {
            const affordable = a.canAfford(i)
            return (
              <div key={card.id || `m${i}`} className="flex justify-center">
                <CardTile card={card} slot={i + 1} placeCost={a.placeCost(i)} ready={isMyTurn && affordable} dim={isMyTurn && !affordable} onInspect={() => openMarket(card, i)} className="!h-auto w-full" />
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
