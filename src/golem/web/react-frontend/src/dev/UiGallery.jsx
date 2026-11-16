import React, { useState } from 'react'
import {
  Avatar, Button, IconButton, Coin, CrystalRow, CrystalCost, Gem, CRYSTALS, GolemIcon, Modal, NightBackdrop, Panel, Pill, TurnBanner,
} from '../components/ui'

// Dev-only page (vite dev + ?gallery): every primitive, for screenshots and design review.
const SWATCHES = [
  ['rock', [950, 900, 800, 700, 600, 400, 200]],
  ['bronze', [700, 500, 300, 100]],
  ['parch', [100, 200, 400]],
]
const SINGLE = ['ink', 'fg', 'fg-muted', 'ember', 'moss', 'teal', 'gem-yellow', 'gem-green', 'gem-blue', 'gem-pink']

const Swatch = ({ name }) => (
  <div className="flex flex-col items-center gap-1 text-xs">
    <span className="h-10 w-14 rounded-stone-sm border border-black/40" style={{ background: `rgb(var(--${name}))` }} />
    <span className="text-fg-muted">{name}</span>
  </div>
)

const players = [
  { id: 1, name: 'Đặng Thị Ngọc Ánh', avatar: '3' },
  { id: 2, name: 'Mossback', avatar: '7', isAI: true, aiAvatar: true },
  { id: 3, name: 'Cinder', avatar: '11', isAI: true, aiAvatar: true },
  { id: 4, name: 'Rime', avatar: '5', isAI: true, aiAvatar: true },
  { id: 5, name: 'Offline', avatar: '9' },
]

const Section = ({ title, children }) => (
  <Panel title={title} className="w-full">
    <div className="flex flex-wrap items-center gap-4">{children}</div>
  </Panel>
)

import ModalGallery from './ModalGallery'

export default function UiGallery() {
  const params = new URLSearchParams(window.location.search)
  if (params.get('modal') && params.get('modal') !== '1' && params.get('modal') !== '') return <ModalGallery which={params.get('modal')} />
  const [open, setOpen] = useState(params.has('modal'))
  const [mult, setMult] = useState(2)
  return (
    <div className="relative min-h-screen">
      <NightBackdrop />
      <main className="relative z-board mx-auto flex max-w-6xl flex-col gap-4 p-4 md:p-8">
        <header className="flex flex-col items-center gap-1 py-4 text-center">
          <div className="flex items-center gap-3">
            <Gem color="blue" size={28} label={false} />
            <h1 className="font-display text-3xl font-bold text-bronze-100 text-engrave md:text-5xl">Century</h1>
            <Gem color="pink" size={28} label={false} />
          </div>
          <p className="font-display text-sm uppercase tracking-[0.35em] text-bronze-300">Golem Edition</p>
        </header>

        <Section title="Palette">
          {SWATCHES.map(([n, steps]) => steps.map((s) => <Swatch key={`${n}${s}`} name={`${n}-${s}`} />))}
          {SINGLE.map((n) => <Swatch key={n} name={n} />)}
        </Section>

        <Section title="Typography">
          <div className="flex flex-col gap-2">
            <div className="font-display text-3xl font-bold text-bronze-100 text-engrave">Claim Golem</div>
            <div className="font-display text-xl font-bold text-bronze-300">Market · Golems · Your Hand</div>
            <div className="text-base">Body — Be Vietnam Pro: Đặng Thị Ngọc Ánh, Nguyễn Văn Bảo, Phạm Quỳnh Hương</div>
            <div className="text-sm text-fg-muted">Muted 14px — Waiting for Mossback… · Round 12 · 0123456789</div>
            <div className="text-xs text-fg-muted">Smallest allowed 12px — took back 3 cards</div>
          </div>
        </Section>

        <div className="grid gap-4 md:grid-cols-2">
          <Panel title="Gems on stone">
            <div className="flex flex-col gap-3">
              {[12, 16, 20, 28, 40].map((s) => (
                <div key={s} className="flex items-center gap-3">
                  <span className="w-10 text-xs text-fg-muted">{s}px</span>
                  {CRYSTALS.map((c) => <Gem key={c} color={c} size={s} />)}
                </div>
              ))}
              <CrystalRow resources={{ yellow: 3, green: 1, blue: 0, pink: 2 }} capacity={10} size="md" />
              <CrystalRow resources={{ yellow: 5, green: 2, blue: 1, pink: 3 }} capacity={10} size="sm" />
              <div className="flex items-center gap-3">
                <CrystalCost resources={{ yellow: 2 }} size={20} />
                <span className="text-fg-muted">→</span>
                <CrystalCost resources={{ green: 2 }} size={20} />
                <span className="ml-4 flex items-center gap-2"><Coin kind="copper" size={28} /><Coin kind="silver" size={28} /></span>
                <span className="ml-4 flex items-center gap-1 text-bronze-300"><GolemIcon size={22} label="Golems" /> 3</span>
              </div>
            </div>
          </Panel>
          <Panel variant="parchment" title="Gems on parchment">
            <div className="flex flex-col gap-3">
              {[12, 16, 20, 28, 40].map((s) => (
                <div key={s} className="flex items-center gap-3">
                  <span className="w-10 text-xs text-ink-muted">{s}px</span>
                  {CRYSTALS.map((c) => <Gem key={c} color={c} size={s} />)}
                </div>
              ))}
              <CrystalRow resources={{ yellow: 3, green: 1, blue: 0, pink: 2 }} capacity={10} size="md" tone="parchment" />
              <div className="flex items-center gap-3">
                <CrystalCost resources={{ yellow: 3 }} size={20} />
                <span className="text-ink-muted">→</span>
                <CrystalCost resources={{ green: 1, blue: 1 }} size={20} />
              </div>
            </div>
          </Panel>
        </div>

        <Section title="Buttons">
          <Button size="lg">Start Game</Button>
          <Button>Confirm</Button>
          <Button variant="secondary">Cancel</Button>
          <Button variant="danger">Leave</Button>
          <Button variant="ghost">Back</Button>
          <Button size="sm">Rest</Button>
          <Button disabled>Disabled</Button>
          <Button icon={<Gem color="green" size={16} label={false} />}>Rest</Button>
          <IconButton label="Sound">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 9v6h4l5 4V5L8 9H4z" /><path d="M16 9a4 4 0 010 6" /></svg>
          </IconButton>
          <IconButton label="Activity" variant="ghost">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 5h16v11H8l-4 4z" /></svg>
          </IconButton>
        </Section>

        <Panel variant="parchment" title="Buttons on parchment">
          <div className="flex flex-wrap gap-3">
            <Button>Confirm Trade</Button>
            <Button variant="outline">Cancel</Button>
            <Button variant="outline" disabled>Undo</Button>
          </div>
        </Panel>

        <Section title="Pills">
          <Pill tone="neutral">Waiting</Pill>
          <Pill tone="bronze">Last round</Pill>
          <Pill tone="moss">Online</Pill>
          <Pill tone="ember">Offline</Pill>
          <Pill tone="teal">AI</Pill>
          <Pill tone="moss" pips={1}>Easy</Pill>
          <Pill tone="teal" pips={2}>Medium</Pill>
          <Pill tone="bronze" pips={3}>Hard</Pill>
          <Pill tone="ember" pips={4}>Very Hard</Pill>
        </Section>

        <div className="grid gap-4 md:grid-cols-3">
          <Panel title="Stone panel">Carved stone with a bronze edge.</Panel>
          <Panel variant="inset" title="Inset">Sunken tray (history, played cards).</Panel>
          <Panel title="Your turn" glow>Glowing edge on your turn.</Panel>
        </div>

        <Section title="Avatars">
          {players.map((p, i) => (
            <div key={p.id} className="flex flex-col items-center gap-1">
              <Avatar
                player={p}
                size={48}
                turn={i === 1}
                timer={i === 1 ? { remaining: 42, total: 60 } : i === 2 ? { remaining: 18, total: 60 } : i === 3 ? { remaining: 5, total: 60 } : undefined}
                offline={i === 4}
              />
              <span className="max-w-[7rem] truncate text-xs">{p.name}</span>
            </div>
          ))}
          <TurnBanner show seconds={42} />
          <TurnBanner show seconds={7} />
          <Button variant="secondary" onClick={() => setOpen(true)}>Open popup</Button>
        </Section>
      </main>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Trade"
        footer={(
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => setOpen(false)}>Confirm Trade</Button>
          </>
        )}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-3 text-lg">
            <CrystalCost resources={{ yellow: 2 * mult }} size={24} />
            <span className="text-ink-muted">→</span>
            <CrystalCost resources={{ green: 2 * mult }} size={24} />
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => setMult(Math.max(1, mult - 1))} aria-label="Fewer">−</Button>
            <span className="w-12 text-center font-display text-2xl font-bold tabular-nums">×{mult}</span>
            <Button variant="outline" onClick={() => setMult(mult + 1)} aria-label="More">+</Button>
          </div>
          <div className="flex items-center gap-2 text-sm text-ink-muted">After: <CrystalRow resources={{ yellow: 1, green: 4, blue: 1, pink: 0 }} capacity={10} size="xs" tone="parchment" /></div>
        </div>
      </Modal>
    </div>
  )
}
