# User interface — "Stone & Crystal"

> Details (Vietnamese): [`thiet-ke-giao-dien.md`](thiet-ke-giao-dien.md) · Decision: [ADR 0009](../adr/0009-giao-dien-da-va-pha-le.md) ·
> Plan: [`../plans/2026-11-16-golem-ui.md`](../plans/2026-11-16-golem-ui.md)

Every screen — main menu, lobbies, connecting, waiting room, the desktop board, the phone board, the ✨ table layout and every
popup — uses one original look inspired by the mood of *Century: Golem Edition*: a night-mountain backdrop, panels that read as
carved stone with a bronze edge, parchment popups, bronze buttons. The printed card art is shown as is; nothing copies the
publisher's logo or graphic design.

## Building blocks

| What | Where |
|---|---|
| Colours, radii, shadows, motion (CSS variables) | `src/styles/tokens.css`, mapped in `tailwind.config.js` (`rock`, `bronze`, `parch`, `ink`, `fg`, `gem`, `ember`, `moss`, `teal`) |
| Fonts (self-hosted, SIL OFL) | `src/styles/fonts.css` — **Cinzel** for static English titles/buttons only, **Be Vietnam Pro** for everything else (full Vietnamese) |
| Primitives | `src/components/ui/`: `Panel`, `Button`/`IconButton`, `Modal` (bottom sheet on phones), `Pill`, `Gem`, `CrystalRow`/`CrystalCost`, `Coin`, `GolemIcon`, `Avatar` (turn glow + timer ring), `TurnBanner`, `Field`, `Segmented`, `AvatarPicker`, `Stepper`, `CardImage`, `GemLoader`, `NightBackdrop` |
| Board pieces | `src/components/board/`: `CardTile` (a card with its slot, deposits, coin, ready/dim state), `CardInspect` (hover details), `CardSheet` (phone: tap → details + action), `CardPile`, `BoardModals`, `Hud` |
| Shared game logic for all layouts | `src/hooks/useBoardActions.js`, `useTurnTimer.js`, `useOrientation.js` (`isCompact`) |
| Avatars | 24 original golems (SVG) drawn by `deploy/make-golem-avatars.py` → `assets-src/avatars/` |

## UX rules

- Crystals have a shape per colour (▲ yellow, ◆ green, ⬟ blue, ⬢ pink — sides − 2 = level), so colour is never the only cue.
- Cards you can act on now glow bronze with a ✓; on your turn, cards you can't afford are dimmed ("Place n").
- Desktop: click acts, hover/focus shows the card details. Phones: tap opens a sheet with the details and the one action.
- Popups pick sensible defaults (cheapest crystals to place or discard) and warn before you go over 10 crystals.
- Text ≥ 12 px, touch targets ≥ 44 px on phones, safe areas for notches, one z-index scale, `prefers-reduced-motion` respected.
- Phones held sideways (short landscape screens) get the compact layout; the ✨ table layout is desktop only.

## Checking a change

```bash
cd deploy && DOCKER_BUILDKIT=1 docker compose up -d --build web     # local stack on the workstation (tunnel off)
node ui-shots.mjs http://127.0.0.1:8400 /tmp/shots                  # 6 viewports; exits 1 on external requests, console
                                                                     # errors, horizontal overflow, text < 12 px, targets < 44 px
```

For one primitive or popup without playing a game: run `vite dev` on a copy of the frontend and open `/?gallery`
(all primitives) or `/?gallery&modal=trade|upgrade|deposit|discard|claim|gameover|victory` (popups on fake data; dev builds only).
