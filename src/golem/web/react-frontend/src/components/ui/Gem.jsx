import React from 'react'

// Crystal colours in game order (level 1 → 4). Each colour has its own silhouette so the game reads
// without colour vision: yellow ▲ (3 sides), green ◆ (4), blue ⬟ (5), pink ⬢ (6) — sides − 2 = level.
export const CRYSTALS = ['yellow', 'green', 'blue', 'pink']
const SIDES = { yellow: 3, green: 4, blue: 5, pink: 6 }
const LABEL = { yellow: 'yellow', green: 'green', blue: 'blue', pink: 'pink' }

const C = 12 // centre of the 24×24 box
const round = (n) => Math.round(n * 100) / 100

// Vertices of a regular polygon pointing up; triangles sit a little lower so they look centred.
function vertices(n, r) {
  const cy = n === 3 ? C + 1.6 : C
  return Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n
    return [round(C + r * Math.cos(a)), round(cy + r * Math.sin(a))]
  })
}

// Precomputed facet geometry per colour: outer outline, the facets between outline and table, and the table.
const GEOMETRY = Object.fromEntries(
  CRYSTALS.map((color) => {
    const n = SIDES[color]
    const r = n === 3 ? 12 : 11
    const outer = vertices(n, r)
    const table = vertices(n, r * 0.46)
    // light comes from the top-left: a facet is lit when its outward normal points that way
    const facets = outer.map((p, i) => {
      const q = outer[(i + 1) % n]
      const mx = (p[0] + q[0]) / 2 - C
      const my = (p[1] + q[1]) / 2 - C
      const lit = (-mx - my * 1.4) / Math.hypot(mx, my)
      const tone = lit > 0.55 ? 'light' : lit < -0.35 ? 'dark' : 'base'
      return { points: [p, q, table[(i + 1) % n], table[i]], tone }
    })
    return [color, { outer, table, facets }]
  })
)

const pts = (list) => list.map((p) => p.join(',')).join(' ')
const fill = (color, tone) => `rgb(var(--gem-${color}${tone === 'base' ? '' : `-${tone}`}))`

/**
 * One crystal. `size` in px. Decorative by default when `label` is false (e.g. next to a number that
 * a screen reader already gets from the row's label); otherwise it announces "<colour> crystal".
 */
const Gem = ({ color = 'yellow', size = 16, label, className = '', style }) => {
  const g = GEOMETRY[color] || GEOMETRY.yellow
  const a11y = label === false
    ? { 'aria-hidden': true }
    : { role: 'img', 'aria-label': label || `${LABEL[color] || color} crystal` }
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={`inline-block flex-shrink-0 ${className}`}
      style={style}
      {...a11y}
    >
      <polygon points={pts(g.outer)} style={{ fill: fill(color, 'base') }} />
      {g.facets.map((f, i) => (
        <polygon key={i} points={pts(f.points)} style={{ fill: fill(color, f.tone) }} />
      ))}
      <polygon points={pts(g.table)} style={{ fill: fill(color, 'light'), opacity: 0.85 }} />
      <polygon
        points={pts(g.outer)}
        fill="none"
        strokeWidth={1.3}
        strokeLinejoin="round"
        style={{ stroke: 'rgb(var(--rock-950) / 0.85)' }}
      />
    </svg>
  )
}

export default Gem
