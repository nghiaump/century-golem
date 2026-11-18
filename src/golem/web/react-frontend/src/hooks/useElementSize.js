import { useLayoutEffect, useState } from 'react'

/**
 * Size of an element's content box (padding excluded), kept up to date with a ResizeObserver.
 * Usage: `const [el, setEl] = useState(null); const { height } = useElementSize(el); <div ref={setEl}>`
 * (a callback ref, so it also works for elements that appear later).
 * Card rows use it to give each card an explicit width: Safari/WebKit gets 0 for a card whose width
 * comes from `aspect-ratio` and a percentage height inside a shrink-to-fit wrapper.
 */
export default function useElementSize(el) {
  const [size, setSize] = useState({ width: 0, height: 0 })
  useLayoutEffect(() => {
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const update = () => {
      const s = getComputedStyle(el)
      const width = Math.max(0, el.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight))
      const height = Math.max(0, el.clientHeight - parseFloat(s.paddingTop) - parseFloat(s.paddingBottom))
      setSize((p) => (p.width === width && p.height === height ? p : { width, height }))
    }
    const ro = new ResizeObserver(update)
    ro.observe(el)
    update()
    return () => ro.disconnect()
  }, [el])
  return size
}
