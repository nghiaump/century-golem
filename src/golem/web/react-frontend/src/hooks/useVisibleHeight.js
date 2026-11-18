import { useLayoutEffect, useState } from 'react'

// `100svh` (the viewport with the browser bars shown) and the safe-area insets, measured with a probe.
function probe() {
  const el = document.createElement('div')
  el.style.cssText = 'position:fixed;top:0;left:0;width:0;visibility:hidden;pointer-events:none;height:100vh;height:100svh;' +
    'padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);box-sizing:content-box'
  document.body.appendChild(el)
  const s = getComputedStyle(el)
  const out = { svh: parseFloat(s.height), safeTop: parseFloat(s.paddingTop), safeBottom: parseFloat(s.paddingBottom) }
  el.remove()
  return out
}

/** The heights the browser reports — for the `?vp` diagnostic box and for picking the visible height. */
export function viewportReport() {
  const vv = window.visualViewport
  const p = probe()
  return {
    inner: window.innerHeight, vv: vv ? Math.round(vv.height) : null, vvTop: vv ? Math.round(vv.offsetTop) : null,
    svh: Math.round(p.svh), safeTop: Math.round(p.safeTop), safeBottom: Math.round(p.safeBottom),
  }
}

/**
 * Phones: the height that is really visible, and the page locked so it cannot scroll.
 * Safari on iOS 26 floats its toolbar over the page: `100dvh` and `env(safe-area-inset-bottom)` still
 * count the strip under it, so a `100dvh` board ended behind the toolbar (half of the hand hidden, the
 * page scrolled). We take the smallest of innerHeight, visualViewport.height and 100svh, and refresh it on
 * resize / rotation / toolbar changes. Sets `--app-h` on <html> and returns the number.
 */
export default function useVisibleHeight(enabled = true) {
  const [height, setHeight] = useState(() => (typeof window === 'undefined' ? 0 : window.innerHeight))
  useLayoutEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined
    const root = document.documentElement
    root.classList.add('phone-lock')
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const r = viewportReport()
        const h = Math.floor(Math.min(r.inner, r.vv || Infinity, r.svh || Infinity))
        root.style.setProperty('--app-h', `${h}px`)
        setHeight((p) => (p === h ? p : h))
        if (window.scrollY) window.scrollTo(0, 0) // a page scrolled before the lock: back to the top
      })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    window.visualViewport?.addEventListener('resize', update)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
      window.visualViewport?.removeEventListener('resize', update)
      root.classList.remove('phone-lock')
      root.style.removeProperty('--app-h')
    }
  }, [enabled])
  return height
}
