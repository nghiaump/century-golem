import React, { useEffect, useRef, useState } from 'react'
import Modal from './ui/Modal'
import Button from './ui/Button'
import { renderCrop } from '../utils/customAvatar'

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

/**
 * Fit a picked photo into the round avatar: drag to move, slider / mouse wheel to zoom. The square
 * shown is what gets saved (shown as a circle in the game). onDone(dataUrl) with a 256×256 JPEG.
 */
const AvatarCropper = ({ image, onCancel, onDone }) => {
  const { img, url } = image
  const V = typeof window !== 'undefined' ? Math.min(280, window.innerWidth - 72) : 280 // viewport side (px)
  const w = img.naturalWidth
  const h = img.naturalHeight
  const cover = V / Math.min(w, h)
  const [zoom, setZoom] = useState(1)
  const s = cover * zoom
  const [pos, setPos] = useState({ x: (V - w * cover) / 2, y: (V - h * cover) / 2 })
  const drag = useRef(null)

  const bound = (p, scale) => ({ x: clamp(p.x, V - w * scale, 0), y: clamp(p.y, V - h * scale, 0) })

  // zoom around the centre of the viewport
  const zoomTo = (z) => {
    const nz = clamp(z, 1, 4)
    const ns = cover * nz
    setPos((p) => {
      const cx = (V / 2 - p.x) / s
      const cy = (V / 2 - p.y) / s
      return bound({ x: V / 2 - cx * ns, y: V / 2 - cy * ns }, ns)
    })
    setZoom(nz)
  }

  useEffect(() => () => URL.revokeObjectURL(url), [url])

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, start: pos }
  }
  const onPointerMove = (e) => {
    if (!drag.current) return
    const { x, y, start } = drag.current
    setPos(bound({ x: start.x + e.clientX - x, y: start.y + e.clientY - y }, s))
  }
  const onPointerUp = () => { drag.current = null }
  const onKeyDown = (e) => {
    const step = 8
    const d = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key]
    if (d) {
      e.preventDefault()
      setPos((p) => bound({ x: p.x + d[0], y: p.y + d[1] }, s))
    }
  }

  const save = () => onDone(renderCrop(img, { x: -pos.x / s, y: -pos.y / s, size: V / s }))

  return (
    <Modal
      open
      onClose={onCancel}
      title="Your Picture"
      size="sm"
      footer={(
        <>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={save} data-autofocus>Use Picture</Button>
        </>
      )}
    >
      <div className="flex flex-col items-center gap-4">
        <div
          role="application"
          aria-label="Picture position: drag or use the arrow keys"
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={(e) => zoomTo(zoom - Math.sign(e.deltaY) * 0.1)}
          onKeyDown={onKeyDown}
          className="relative cursor-grab touch-none select-none overflow-hidden rounded-stone border border-ink/30 bg-rock-950 active:cursor-grabbing"
          style={{ width: V, height: V }}
        >
          <img
            src={url}
            alt=""
            draggable="false"
            className="pointer-events-none absolute max-w-none"
            style={{ left: pos.x, top: pos.y, width: w * s, height: h * s }}
          />
          {/* the round avatar: everything outside the circle is dimmed */}
          <div className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_9999px_rgb(18_19_28/0.55)] ring-2 ring-bronze-300" />
        </div>
        <label className="flex w-full items-center gap-3 text-sm text-ink-muted">
          <span>Zoom</span>
          <input
            type="range"
            min="1"
            max="4"
            step="0.01"
            value={zoom}
            onChange={(e) => zoomTo(parseFloat(e.target.value))}
            className="h-11 flex-1 accent-[rgb(var(--bronze-500))]"
          />
        </label>
        <p className="text-center text-xs text-ink-muted">Drag to move · it is saved small (256 px) and only kept on the server while your game runs.</p>
      </div>
    </Modal>
  )
}

export default AvatarCropper
