import React, { useLayoutEffect, useRef, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { planPhoneBoard } from '../../utils/phoneLayout'
import PlayersInfoBar from '../PlayersInfoBar'
import CompactGameBoard from './CompactGameBoard'
import CompactPlayerHand from './CompactPlayerHand'
import PhoneTopBar from './PhoneTopBar'
import Hud from '../board/Hud'
import useVisibleHeight, { viewportReport } from '../../hooks/useVisibleHeight'

function ViewportDiag({ visible }) {
  const [r, setR] = useState(viewportReport)
  useLayoutEffect(() => {
    const t = setInterval(() => setR(viewportReport()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="pointer-events-none fixed left-1 top-1/2 z-system rounded bg-black/80 px-2 py-1 font-mono text-xs leading-snug text-white">
      inner {r.inner} · vv {r.vv} (top {r.vvTop}) · svh {r.svh}<br />
      used {visible} · safe top {r.safeTop} bottom {r.safeBottom}<br />
      page {document.documentElement.scrollHeight} · scrollY {Math.round(window.scrollY)}
    </div>
  )
}

// Open the site with ?vp (remembered for the tab) to see what the phone's browser reports — for checking
// phones we cannot test here. Read when the app loads, before any navigation drops the query.
const SHOW_VIEWPORT = (() => {
  try {
    if (window.location.search.includes('vp')) sessionStorage.setItem('golem.vp', '1')
    return sessionStorage.getItem('golem.vp') === '1'
  } catch { return false }
})()

const same = (a, b) => a && b && a.golem === b.golem && a.market === b.market && a.hand === b.hand

/**
 * Phones (and phones held sideways): the whole game on one screen, no page scrolling.
 *   portrait   top bar · opponents · golems + market · my hand
 *   landscape  [top bar · golems + market] [opponents · my hand]
 * The board area is measured and the card sizes planned to fit it (utils/phoneLayout); safe areas
 * (notch / Dynamic Island, home indicator) are padded.
 */
const PhoneShell = ({ sessionId, landscape = false, children }) => {
  const boardRef = useRef(null)
  const [plan, setPlan] = useState(null)
  const plays = useGameStore((s) => !s.isSpectator && !!s.myPlayer)
  const waiting = useGameStore((s) => s.gameState?.status === 'waiting' || !s.gameState?.market || Object.keys(s.gameState.market).length === 0)
  const withHand = plays && !landscape
  const visible = useVisibleHeight()
  const frame = { height: visible ? `${visible}px` : '100svh' } // visible area, not 100dvh (iOS 26 toolbar)

  useLayoutEffect(() => {
    const el = boardRef.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const measure = () => {
      const r = el.getBoundingClientRect()
      setPlan((prev) => {
        // the board area and the hand row flex together: their sum is what we split
        const avail = r.height + (withHand ? prev?.hand ?? 104 : 0)
        const next = planPhoneBoard({ width: r.width - 24, avail, withHand })
        return same(prev, next) ? prev : next
      })
    }
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    measure()
    return () => ro.disconnect()
  }, [withHand, landscape, waiting])

  const diagBox = SHOW_VIEWPORT ? <ViewportDiag visible={visible} /> : null

  // Waiting room: floating sound · activity buttons, the room in the middle
  if (waiting) {
    return (
      <>
        <Hud sessionId={sessionId} compact />
        <div
          className="fixed inset-x-0 top-0 z-board flex flex-col overflow-y-auto overscroll-contain"
          style={{ ...frame, paddingTop: 'calc(max(8px, var(--safe-top)) + 52px)', paddingBottom: 'var(--safe-bottom)', paddingLeft: 'var(--safe-left)', paddingRight: 'var(--safe-right)' }}
        >
          <div className="m-auto w-full"><CompactGameBoard /></div>
          {children}
          {diagBox}
        </div>
      </>
    )
  }

  const board = (
    <div ref={boardRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      {plan ? <CompactGameBoard plan={plan} /> : null}
    </div>
  )

  if (landscape) {
    return (
      <div
        className="fixed inset-x-0 top-0 z-board grid grid-cols-[minmax(0,1fr)_minmax(296px,36%)] gap-2 overflow-hidden"
        style={{ ...frame, paddingTop: 'max(8px, var(--safe-top))', paddingBottom: 'max(6px, var(--safe-bottom))', paddingLeft: 'max(8px, var(--safe-left))', paddingRight: 'max(8px, var(--safe-right))' }}
      >
        <div className="flex min-h-0 flex-col gap-1.5">
          <div className="px-3"><PhoneTopBar sessionId={sessionId} /></div>
          {board}
        </div>
        <div className="flex min-h-0 flex-col gap-1.5">
          <PlayersInfoBar landscape />
          <div className="min-h-0 flex-1"><CompactPlayerHand landscape /></div>
        </div>
        {children}
        {diagBox}
      </div>
    )
  }

  return (
    <div
      className="fixed inset-x-0 top-0 z-board flex flex-col gap-1.5 overflow-hidden"
      style={{ ...frame, paddingTop: 'max(8px, var(--safe-top))', paddingLeft: 'var(--safe-left)', paddingRight: 'var(--safe-right)' }}
    >
      <div className="flex flex-col gap-1.5 px-3">
        <PhoneTopBar sessionId={sessionId} />
        <PlayersInfoBar />
      </div>
      {board}
      <CompactPlayerHand cardHeight={plan?.hand ?? 104} />
      {children}
      {diagBox}
    </div>
  )
}

export default PhoneShell
