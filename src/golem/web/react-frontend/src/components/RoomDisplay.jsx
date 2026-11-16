import React, { useState } from 'react'
import Button from './ui/Button'

// Room ID with a Copy button (activity drawer).
const RoomDisplay = ({ sessionId }) => {
  const [copied, setCopied] = useState(false)
  if (!sessionId) return null
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(sessionId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard refused: the ID stays selectable */ }
  }
  return (
    <div className="flex items-center gap-2">
      <span className="min-w-0 flex-1 select-all truncate font-mono text-sm text-fg" title={sessionId}>{sessionId}</span>
      <Button size="sm" variant="secondary" onClick={copy}>{copied ? 'Copied' : 'Copy'}</Button>
    </div>
  )
}

export default RoomDisplay
