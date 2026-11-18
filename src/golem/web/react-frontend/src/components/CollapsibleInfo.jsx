import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import RoomDisplay from './RoomDisplay'
import useGameStore from '../store/gameStore'
import { IconButton } from './ui/Button'
import Button from './ui/Button'
import CardImage from './ui/CardImage'
import { MOVE_VERB, MOVE_EDGE, moveDetail, RestMark } from './board/MoveRow'

const TONE = { ...MOVE_EDGE, chat: 'border-l-teal', log: 'border-l-rock-400' }

const formatTime = (timestamp) => {
  if (!timestamp) return ''
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return `${Math.max(0, seconds)}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  return `${Math.floor(minutes / 60)}h`
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 5h16v11H9l-5 4z" /><path d="M8 9.5h8M8 12.5h5" strokeLinecap="round" />
    </svg>
  )
}

/**
 * Activity & chat: a HUD button (with unread count) that opens a stone drawer — the room ID, a
 * timeline of moves, chat messages and system notes, and a chat box. Desktop: right-hand drawer;
 * phones: bottom sheet that fits a 320px screen.
 */
const CollapsibleInfo = ({ sessionId, size = 'md' }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [activityFeed, setActivityFeed] = useState([])
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [hoveredCard, setHoveredCard] = useState(null)
  const [unread, setUnread] = useState(0)
  const [confirmClear, setConfirmClear] = useState(false)
  const scrollRef = useRef(null)
  const seenRef = useRef(0)

  const { actionHistory, actionLog, sendChatMessage, setChatMessageCallback } = useGameStore()

  useEffect(() => {
    if (!setChatMessageCallback) return undefined
    setChatMessageCallback((msg) => setChatMessages((prev) => [...prev, msg]))
    return () => setChatMessageCallback(null)
  }, [setChatMessageCallback])

  // one feed: chat + moves (with cards) + system notes, oldest first, last 50
  useEffect(() => {
    const combined = []
    chatMessages.forEach((msg) => combined.push({ id: `chat-${msg.id}`, type: 'chat', player: msg.player, message: msg.message, timestamp: msg.timestamp }))
    ;(actionHistory || []).forEach((a, idx) => combined.push({
      id: `action-${a.seq ?? idx}-${a.timestamp}`, type: 'action', actionType: a.type, player: a.playerName, card: a.card, detail: moveDetail(a), isOpponent: a.isOpponent, timestamp: new Date(a.timestamp),
    }))
    ;(actionLog || []).forEach((log, idx) => combined.push({ id: `log-${idx}`, type: 'log', message: log, timestamp: new Date() }))
    combined.sort((a, b) => a.timestamp - b.timestamp)
    setActivityFeed(combined.slice(-50))
    if (isExpanded) seenRef.current = chatMessages.length
    else setUnread(Math.max(0, chatMessages.length - seenRef.current))
  }, [chatMessages, actionHistory, actionLog, isExpanded])

  useEffect(() => {
    if (scrollRef.current && isExpanded) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [activityFeed, isExpanded])

  // Escape closes the drawer
  useEffect(() => {
    if (!isExpanded) return undefined
    const onKey = (e) => { if (e.key === 'Escape') setIsExpanded(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isExpanded])

  const open = () => {
    setIsExpanded(true)
    setUnread(0)
    seenRef.current = chatMessages.length
  }

  const clearAll = () => {
    setActivityFeed([])
    setChatMessages([])
    useGameStore.setState({ actionLog: [], actionHistory: [] })
    setConfirmClear(false)
  }

  const send = (e) => {
    e?.preventDefault()
    if (chatInput.trim() && sendChatMessage) {
      sendChatMessage(chatInput.trim())
      setChatInput('')
    }
  }

  return (
    <>
      <span className="relative inline-flex">
        <IconButton size={size} label={unread ? `Activity and chat (${unread} new)` : 'Activity and chat'} onClick={() => (isExpanded ? setIsExpanded(false) : open())} aria-expanded={isExpanded}>
          <ChatIcon />
        </IconButton>
        {unread > 0 && (
          <span className="pointer-events-none absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full border-2 border-rock-900 bg-moss px-1 text-xs font-bold text-white">
            {unread}
          </span>
        )}
      </span>

      {isExpanded && createPortal(
        <div
          role="dialog"
          aria-label="Activity and chat"
          className="surface-stone fixed inset-x-2 bottom-2 z-drawer flex max-h-[78dvh] flex-col md:inset-x-auto md:bottom-auto md:right-3 md:top-[68px] md:max-h-[calc(100dvh-84px)] md:w-[420px]"
          style={{ marginBottom: 'var(--safe-bottom)' }}
        >
          <header className="flex items-center gap-2 border-b border-black/40 px-4 py-2">
            <h2 className="flex-1 font-display text-base font-bold text-bronze-100 text-engrave">Activity</h2>
            {activityFeed.length > 0 && (confirmClear ? (
              <>
                <Button size="sm" variant="danger" onClick={clearAll}>Clear all</Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmClear(false)}>Keep</Button>
              </>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setConfirmClear(true)}>Clear</Button>
            ))}
            <IconButton label="Close" variant="ghost" onClick={() => setIsExpanded(false)}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </IconButton>
          </header>

          <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
            <div className="flex items-center gap-2 text-xs text-fg-muted">
              <span>Room</span>
              <div className="min-w-0 flex-1"><RoomDisplay sessionId={sessionId} compact /></div>
            </div>

            <ol ref={scrollRef} className="surface-inset flex min-h-[120px] flex-1 flex-col gap-1.5 overflow-y-auto p-2" aria-label="Timeline">
              {activityFeed.length === 0 ? (
                <li className="py-8 text-center text-sm text-fg-muted">No activity yet</li>
              ) : activityFeed.map((item) => (
                <li
                  key={item.id}
                  className={`rounded-stone-sm border-l-4 bg-rock-800/70 px-2.5 py-1.5 text-sm ${TONE[item.type === 'action' ? item.actionType : item.type] || TONE.log}`}
                  onMouseEnter={() => item.card && setHoveredCard(item.card)}
                  onMouseLeave={() => setHoveredCard(null)}
                >
                  <div className="flex items-start gap-2">
                    {item.type === 'action' ? (
                      item.card
                        ? <CardImage name={item.card.name} className="h-12 w-7 flex-shrink-0 rounded-sm border border-black/50" />
                        : <RestMark className="h-12 w-7 flex-shrink-0 [&>span:last-child]:hidden" />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      {item.type === 'chat' && (<><span className="font-semibold text-[rgb(170_225_220)]">{item.player}</span>: <span className="break-words text-fg">{item.message}</span></>)}
                      {item.type === 'action' && (
                        <>
                          <span className="font-semibold text-fg">{item.player}</span>{' '}
                          <span className="text-fg-muted">{MOVE_VERB[item.actionType] || 'acted'}</span>
                          {item.detail ? <span className="block text-xs text-fg-muted">{item.detail}</span> : null}
                        </>
                      )}
                      {item.type === 'log' && <span className="text-fg-muted">{item.message}</span>}
                    </div>
                    <span className="flex-shrink-0 text-xs tabular-nums text-fg-muted">{formatTime(item.timestamp)}</span>
                  </div>
                </li>
              ))}
            </ol>

            <form className="flex items-center gap-2" onSubmit={send}>
              <label htmlFor="chat-input" className="sr-only">Chat message</label>
              <input
                id="chat-input"
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Say something…"
                maxLength={200}
                className="h-11 min-w-0 flex-1 rounded-stone-sm border border-black/50 bg-rock-950/70 px-3 text-base text-fg placeholder:text-fg-muted/60 focus:border-bronze-300 focus:outline-none"
              />
              <Button type="submit" disabled={!chatInput.trim()}>Send</Button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {hoveredCard && createPortal(
        <div className="pointer-events-none fixed left-1/2 top-1/2 z-popover" style={{ transform: 'translate(calc(-50% - 220px), -50%)' }}>
          <div className="surface-stone p-1.5"><CardImage name={hoveredCard.name} className="aspect-[2/3] w-40 rounded-stone-sm" /></div>
        </div>,
        document.body
      )}
    </>
  )
}

export default CollapsibleInfo
