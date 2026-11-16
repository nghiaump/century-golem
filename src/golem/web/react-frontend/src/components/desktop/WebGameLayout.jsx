import React from 'react'
import useBoardActions from '../../hooks/useBoardActions'
import useTurnTimer from '../../hooks/useTurnTimer'
import PlayerCard from '../PlayerCard'
import WaitingRoom from '../WaitingRoom'
import AiThinkingIndicator from '../AiThinkingIndicator'
import GraveyardPanel from '../GraveyardPanel'
import MyGolemsPanel from '../MyGolemsPanel'
import HistorySection from '../HistorySection'
import CardTile from '../board/CardTile'
import BoardModals from '../board/BoardModals'
import Panel from '../ui/Panel'
import Button from '../ui/Button'
import Avatar from '../ui/Avatar'
import Coin from '../ui/Coin'
import CrystalRow from '../ui/CrystalRow'
import TurnBanner from '../ui/TurnBanner'
import { MAX_CARAVAN } from '../../utils/crystals'

/**
 * Desktop board (≥ 768px wide, ≥ 500px tall): players across the top, market and golem rows, then
 * history · played · my hand · my golems. Cards you can act on now glow; hover shows card details.
 * The HUD (round, sound, activity) floats above it — see board/Hud.
 */
const WebGameLayout = () => {
  const a = useBoardActions({ reopenAfterUndo: true })
  const timer = useTurnTimer()
  const { gameState, myPlayer, currentPlayer, isSpectator, isWaiting, isMyTurn } = a

  if (!isWaiting && !isSpectator && !myPlayer) {
    return <div className="flex h-full w-full items-center justify-center text-fg-muted">Loading game…</div>
  }

  const players = gameState.players || []
  const thinking = currentPlayer?.isAI && gameState?.aiThinking?.playerID === currentPlayer?.id

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        className="grid h-full w-full gap-2.5 overflow-auto px-3 pb-3 lg:px-4"
        style={{ gridTemplateRows: 'auto minmax(0, 1fr) minmax(0, 1fr) minmax(170px, 1.05fr)', paddingTop: 'calc(max(8px, var(--safe-top)) + 52px)' }}
      >
        {/* Players */}
        <div className="flex flex-wrap items-stretch justify-center gap-2.5">
          {players.map((player) => (
            <div key={player.id || player.name} className="min-w-[12.5rem] max-w-[17rem] flex-1">
              <PlayerCard player={player} isCurrentPlayer={!isWaiting && currentPlayer?.id === player.id} />
            </div>
          ))}
        </div>

        {isWaiting ? (
          <div className="row-span-3 flex items-center justify-center p-6">
            <WaitingRoom players={players} isSpectator={isSpectator} onStart={a.onStartGame} mode={gameState?.mode} />
          </div>
        ) : (
          <>
            {/* Market */}
            <Panel title="Market" className="min-h-[150px]" bodyClassName="grid grid-cols-6 place-items-center gap-3 pt-2">
              {a.actionCards.slice(0, 6).map((card, i) => {
                const affordable = a.canAfford(i)
                return (
                  <CardTile
                    key={card.id || `m${i}`}
                    card={card}
                    slot={i + 1}
                    placeCost={a.placeCost(i)}
                    ready={isMyTurn && affordable}
                    dim={isMyTurn && !affordable}
                    onClick={() => a.onMarketCard(i)}
                  />
                )
              })}
            </Panel>

            {/* Golems */}
            <Panel
              title="Golems"
              className="min-h-[150px]"
              actions={(
                <span className="flex items-center gap-2 text-xs text-fg-muted" title="Coins left">
                  <span className="inline-flex items-center gap-1"><Coin kind="copper" size={16} />{a.coins[0]?.amount ?? 0}</span>
                  <span className="inline-flex items-center gap-1"><Coin kind="silver" size={16} />{a.coins[1]?.amount ?? 0}</span>
                </span>
              )}
              bodyClassName="grid grid-cols-5 place-items-center gap-3 pt-2"
            >
              {a.pointCards.slice(0, 5).map((card, i) => {
                const claimable = a.canClaim(card)
                return (
                  <CardTile
                    key={card.id || `g${i}`}
                    card={card}
                    type="point"
                    slot={i + 1}
                    coin={a.coinFor(i)}
                    ready={isMyTurn && claimable}
                    dim={isMyTurn && !claimable}
                    onClick={() => a.onGolem(i)}
                  />
                )
              })}
            </Panel>

            {/* History · played · my hand · my golems */}
            <div className="flex min-h-[170px] gap-2.5 overflow-x-auto overflow-y-hidden">
              <div className="w-36 flex-shrink-0 lg:w-40"><HistorySection /></div>
              <div className="w-28 flex-shrink-0 lg:w-32"><GraveyardPanel playedCards={a.playedCards} /></div>

              {!isSpectator ? (
                <>
                  <Panel glow={isMyTurn} className="min-w-0 flex-1" bodyClassName="flex h-full flex-col gap-2 p-2.5">
                    <div className="flex items-center gap-x-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <Avatar player={myPlayer} size={32} turn={isMyTurn} />
                        <span className="hidden truncate text-sm font-bold text-fg xl:inline">{myPlayer?.name || 'You'}</span>
                      </div>
                      <CrystalRow resources={a.caravan} capacity={MAX_CARAVAN} size="sm" className="flex-shrink-0" />
                      <div className="ml-auto flex flex-shrink-0 items-center gap-2">
                        {isMyTurn ? (
                          <>
                            <TurnBanner show seconds={timer.remaining} />
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={a.onRest}
                              disabled={!a.canRest}
                              title={a.canRest ? 'Take all played cards back to your hand' : 'Play a card first — nothing to take back yet'}
                            >
                              Rest
                            </Button>
                          </>
                        ) : (
                          <span className="max-w-[16rem] truncate rounded-stone-sm bg-rock-950/50 px-3 py-1.5 text-sm text-fg-muted">
                            {thinking ? <AiThinkingIndicator label={`${currentPlayer.name} is thinking`} /> : `Waiting for ${currentPlayer?.name || 'the next player'}…`}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex min-h-0 flex-1 items-stretch gap-2.5 overflow-x-auto overflow-y-hidden pb-1 scrollbar-thin" role="list" aria-label="Your hand">
                      {a.hand.length ? a.hand.map((card, i) => (
                        <div key={`h${i}-${card.id}`} role="listitem" className="h-full flex-shrink-0">
                          <CardTile card={card} ready={isMyTurn} onClick={() => a.onHandCard(card, i)} />
                        </div>
                      )) : (
                        <span className="flex items-center px-3 text-sm text-fg-muted">No cards in hand — rest to take your played cards back.</span>
                      )}
                    </div>
                  </Panel>
                  <div className="w-28 flex-shrink-0 lg:w-32"><MyGolemsPanel pointCards={myPlayer?.pointCards || []} coins={myPlayer?.coins || []} /></div>
                </>
              ) : (
                <Panel className="min-w-0 flex-1" bodyClassName="flex h-full flex-col items-center justify-center gap-1 text-center">
                  <span className="font-display text-lg font-bold text-bronze-100">Watching</span>
                  <span className="text-sm text-fg-muted">
                    {thinking ? <AiThinkingIndicator label={`${currentPlayer.name} is thinking`} /> : `${currentPlayer?.name || 'A player'} to move · ${timer.remaining}s`}
                  </span>
                </Panel>
              )}
            </div>
          </>
        )}
      </div>
      <BoardModals actions={a} />
    </div>
  )
}

export default WebGameLayout
