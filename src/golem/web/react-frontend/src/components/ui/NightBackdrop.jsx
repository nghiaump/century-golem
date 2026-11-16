import React from 'react'

// Night mountains behind every screen: three ridges, stars and a few glowing crystals on the near
// slope. Drawn once from a fixed seed (same picture every load), no image download.
const W = 1600
const H = 900

function prng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// A jagged ridge line around `base` (y), `amp` px high, closed down to the bottom edge.
function ridge(rand, base, amp, step) {
  const pts = []
  let y = base
  for (let x = -step; x <= W + step; x += step) {
    y += (rand() - 0.5) * amp * 0.9
    y = Math.max(base - amp, Math.min(base + amp * 0.35, y))
    // occasional sharp peak
    const peak = rand() < 0.12 ? -amp * (0.4 + rand() * 0.5) : 0
    pts.push([x, Math.round(y + peak)])
  }
  return { d: `M${pts.map((p) => p.join(',')).join(' L')} L${W + step},${H} L${-step},${H} Z`, pts }
}

const rand = prng(1847)
const STARS = Array.from({ length: 90 }, () => ({
  x: Math.round(rand() * W),
  y: Math.round(rand() * H * 0.55),
  r: rand() < 0.15 ? 1.6 : rand() < 0.5 ? 1.1 : 0.7,
  o: 0.25 + rand() * 0.6,
}))
const FAR = ridge(rand, 540, 120, 60)
const MID = ridge(rand, 650, 90, 46)
const NEAR = ridge(rand, 770, 70, 38)
const GEMS = ['yellow', 'green', 'blue', 'pink']
// glints sit on the near ridge line
const GLINTS = Array.from({ length: 7 }, (_, i) => {
  const p = NEAR.pts[3 + Math.floor((i + rand() * 0.8) * ((NEAR.pts.length - 6) / 7))]
  return { x: p[0], y: p[1] + 14 + Math.round(rand() * 26), c: GEMS[i % 4], s: 5 + Math.round(rand() * 4) }
})

const NightBackdrop = ({ className = '' }) => (
  <div className={`pointer-events-none fixed inset-0 z-0 overflow-hidden ${className}`} aria-hidden="true">
    <svg className="h-full w-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice">
      <defs>
        <linearGradient id="nb-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b0e1c" />
          <stop offset="0.55" stopColor="#171b33" />
          <stop offset="1" stopColor="#262b47" />
        </linearGradient>
        <radialGradient id="nb-moon" cx="0.78" cy="0.16" r="0.35">
          <stop offset="0" stopColor="rgb(217 178 111)" stopOpacity="0.28" />
          <stop offset="0.35" stopColor="rgb(140 150 200)" stopOpacity="0.1" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="nb-mist" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a4166" stopOpacity="0" />
          <stop offset="1" stopColor="#3a4166" stopOpacity="0.35" />
        </linearGradient>
        {GEMS.map((c) => (
          <radialGradient key={c} id={`nb-glow-${c}`}>
            <stop offset="0" style={{ stopColor: `rgb(var(--gem-${c}-light))`, stopOpacity: 0.75 }} />
            <stop offset="1" style={{ stopColor: `rgb(var(--gem-${c}))`, stopOpacity: 0 }} />
          </radialGradient>
        ))}
      </defs>
      <rect width={W} height={H} fill="url(#nb-sky)" />
      <rect width={W} height={H} fill="url(#nb-moon)" />
      <circle cx={W * 0.78} cy={H * 0.15} r="22" fill="rgb(248 238 210)" opacity="0.12" />
      <circle cx={W * 0.78} cy={H * 0.15} r="13" fill="rgb(250 242 220)" opacity="0.6" />
      {STARS.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#e9e4f5" opacity={s.o} />
      ))}
      <path d={FAR.d} fill="#232843" />
      <rect y={H * 0.5} width={W} height={H * 0.3} fill="url(#nb-mist)" />
      <path d={MID.d} fill="#1b1f35" />
      <path d={NEAR.d} fill="#12152a" />
      {GLINTS.map((g, i) => (
        <g key={i} transform={`translate(${g.x} ${g.y})`}>
          <circle r={g.s * 4} fill={`url(#nb-glow-${g.c})`} />
          <polygon points={`0,${-g.s} ${g.s * 0.6},0 0,${g.s} ${-g.s * 0.6},0`} style={{ fill: `rgb(var(--gem-${g.c}-light))` }} opacity="0.9" />
        </g>
      ))}
    </svg>
  </div>
)

export default NightBackdrop
