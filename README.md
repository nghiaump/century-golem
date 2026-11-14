<div align="center">

<img src="docs/assets/banner.svg" alt="Century: Golem Edition — collect crystals, trade with merchants, summon golems" width="100%"/>

<h3>💎 A self-hosted, real-time multiplayer crystal-trading card game</h3>

<p>
An unofficial web take on the <b>Century: Golem Edition</b> board game.<br/>
Play solo against 1–4 AI opponents or with up to 5 friends, right in the browser, on desktop or phone.
</p>

<p>
<a href="https://century.pentium.ink"><img alt="Play now at century.pentium.ink" src="https://img.shields.io/badge/%E2%96%B6%20PLAY%20NOW-century.pentium.ink-8b5cf6?style=for-the-badge&labelColor=4c1d95"/></a>
</p>

<p>
<img alt="Go 1.24" src="https://img.shields.io/badge/Go-1.24-00ADD8?style=flat-square&logo=go&logoColor=white"/>
<img alt="React 18" src="https://img.shields.io/badge/React-18-20232A?style=flat-square&logo=react&logoColor=61DAFB"/>
<img alt="Vite 4" src="https://img.shields.io/badge/Vite-4-646CFF?style=flat-square&logo=vite&logoColor=white"/>
<img alt="Tailwind CSS 3" src="https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white"/>
<img alt="WebSocket" src="https://img.shields.io/badge/WebSocket-real--time-010101?style=flat-square&logo=socketdotio&logoColor=white"/>
<img alt="MongoDB 7" src="https://img.shields.io/badge/MongoDB-7-47A248?style=flat-square&logo=mongodb&logoColor=white"/>
<img alt="Redis 7" src="https://img.shields.io/badge/Redis-7-DC382D?style=flat-square&logo=redis&logoColor=white"/>
<img alt="nginx" src="https://img.shields.io/badge/nginx-1.27-009639?style=flat-square&logo=nginx&logoColor=white"/>
<img alt="Docker Compose" src="https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white"/>
<img alt="Cloudflare Tunnel" src="https://img.shields.io/badge/Cloudflare-Tunnel-F38020?style=flat-square&logo=cloudflare&logoColor=white"/>
</p>

<p>
<img alt="2–5 players" src="https://img.shields.io/badge/players-2%E2%80%935-f59e0b?style=flat-square"/>
<img alt="1–4 AI opponents" src="https://img.shields.io/badge/AI_opponents-1%E2%80%934-a855f7?style=flat-square"/>
<img alt="Runs on amd64 and arm64" src="https://img.shields.io/badge/runs_on-amd64_%7C_arm64-64748b?style=flat-square"/>
<img alt="Telemetry: none" src="https://img.shields.io/badge/telemetry-none-0ea5e9?style=flat-square"/>
<img alt="Status: live" src="https://img.shields.io/badge/status-live-22c55e?style=flat-square"/>
</p>

<p><a href="#-features">Features</a> • <a href="#-screenshots">Screenshots</a> • <a href="#-how-to-play">How to play</a> • <a href="#-quick-start">Quick start</a> • <a href="#-architecture">Architecture</a> • <a href="#-configuration">Configuration</a> • <a href="#-operations">Operations</a> • <a href="#-credits--disclaimer">Credits</a></p>

<img src="docs/assets/screenshots/board.webp" alt="In-game board: opponents on top, the merchant market, golems for sale and your hand with the turn timer" width="100%"/>

</div>

<img src="docs/assets/divider.svg" width="100%" height="6" alt=""/>

## ✨ Features

<table>
<tr>
<td width="50%" valign="top">

#### 🎮 Gameplay
- **Solo vs AI**: pick 1–4 AI opponents and start right away
- **Online multiplayer** for 2–5 players: create a room (optional custom ID) or join one from the open-room list
- **Spectate** rooms that are already in progress
- **Turn timer** (60 s by default); when it runs out, the AI plays the turn for you
- **Full rules engine**: market deposits, crystal upgrades, multi-trades, the 10-crystal limit, copper and silver coin bonuses

</td>
<td width="50%" valign="top">

#### 🌐 Experience
- **Real-time** state sync over WebSocket, with ping/pong disconnect detection
- **Reconnect** to your seat after a dropped connection (30-day client cookie)
- **Responsive** desktop and mobile layouts
- **Sound effects** for your turn, plays, purchases, golem claims, the last round and game over
- **Retro lobby** with a Windows XP × brutalism theme and 15 pixel-art avatars

</td>
</tr>
<tr>
<td width="50%" valign="top">

#### 🐳 Self-hosting
- **One-command deploy** with `docker compose up -d --build`
- **Multi-arch**: builds natively on `amd64` and `arm64` (production runs on a phone 📱)
- **HTTPS without open ports** through a dedicated Cloudflare Tunnel
- **Game history** kept as events and snapshots in MongoDB
- **Self-cleaning**: idle rooms are removed automatically, and a room cap blocks spam

</td>
<td width="50%" valign="top">

#### 🔒 Privacy by design
- No analytics, web fonts or CDNs; every asset is served locally
- Backend sits on an **internal Docker network with no internet egress**
- Third-party integrations (Telegram, Firebase, Google OAuth) are removed or disabled
- `privacy-audit.sh` checks for regressions on every change

</td>
</tr>
</table>

## 📸 Screenshots

<table>
<tr>
<td align="center" width="51%"><img src="docs/assets/screenshots/menu.webp" alt="Main menu with the Windows XP style window"/><br/><sub><b>Main menu</b>: choose Single Player or Multiplayer</sub></td>
<td align="center" width="27%"><img src="docs/assets/screenshots/lobby.webp" alt="Multiplayer lobby with avatar picker"/><br/><sub><b>Lobby</b>: name, avatar, player count, room ID</sub></td>
<td align="center" width="22%"><img src="docs/assets/screenshots/mobile.webp" alt="Mobile layout of the game board"/><br/><sub><b>Mobile</b>: the full board on a phone</sub></td>
</tr>
</table>

## 🎲 How to play

> **Goal:** have the most **victory points** when the game ends. Points come from golems, coins and leftover crystals.

**Crystals** go up in value: 🟡 **Yellow** → 🟢 **Green** → 🔵 **Blue** → 🟣 **Pink**. You can hold at most **10**, and any excess must be discarded.

**Setup.** Everyone starts with two merchant cards (*produce 2 yellow* and *upgrade ×2*) and crystals based on seat order:

| Seat | 1st | 2nd | 3rd | 4th | 5th |
|:--|:--:|:--:|:--:|:--:|:--:|
| Crystals | 🟡×3 | 🟡×4 | 🟡×4 | 🟡×3 🟢×1 | 🟡×3 🟢×1 |

**On your turn, take exactly one action:**

| Action | What happens |
|:--|:--|
| 🃏 **Play** a merchant card | **Produce** crystals, **upgrade** crystals one step at a time (`Lv.2` / `Lv.3` = number of steps) or **trade** one set for another, as many times as you can afford |
| 🛒 **Acquire** a merchant card | The leftmost card in the market is free. For any other card, leave 1 crystal on each card to its left, and take any crystals already sitting on the card you pick |
| 🗿 **Claim** a golem | Pay the crystals shown on it. The 1st slot also pays a **copper coin (+3)** and the 2nd a **silver coin (+1)**, while they last |
| 💤 **Rest** | Return all your played merchant cards to your hand |

**Game end.** When someone claims their **5th golem**, the current round is played out and the game ends.
Final score = golem points + coins + **1 point per non-yellow crystal**.

## 🚀 Quick start

**Requirements:** Docker Engine with the Compose v2 and Buildx plugins, on Linux `amd64` or `arm64`.

```bash
git clone git@github.com:nghiaump/century-golem.git
cd century-golem/deploy
DOCKER_BUILDKIT=1 docker compose up -d --build   # first build takes a few minutes
./smoke-test.sh http://127.0.0.1:8400             # expect: ALL PASS
```

Open **http://127.0.0.1:8400**, choose *Single Player* and play. 🎉

> [!TIP]
> To put it on the internet without opening ports, point a Cloudflare Tunnel at `http://127.0.0.1:8400`.
> See [runbook §7](docs/runbook.md#7-tunnel-cloudflare) and [§11](docs/runbook.md#11-máy-chạy-đồng-bộ-code-rollback-chuyển-sang-pixel3xl-ngày-2026-11-14) for how the production host is wired.

## 🏰 Architecture

```mermaid
flowchart LR
    P(["🧑‍🤝‍🧑 Players<br/>desktop & mobile browsers"]) -- "HTTPS · WSS" --> CF["☁️ Cloudflare edge<br/>century.pentium.ink"]
    CF -- "dedicated tunnel" --> CD["cloudflared<br/>systemd --user"]
    CD -- "127.0.0.1:8400" --> W["🌐 web<br/>nginx + React SPA"]
    subgraph BE["🔒 backend network: internal, no internet egress"]
        S["⚙️ server<br/>Go · REST + WebSocket + AI"]
        M[("🍃 MongoDB 7<br/>event store")]
        R[("🟥 Redis 7")]
    end
    W -- "/api · /ws" --> S
    S --> M
    S --> R
```

- **Live game state stays in the Go server's memory**, so it's fast. MongoDB stores every action as an event, plus snapshots, for history.
- The frontend calls the API and WebSocket on the **same origin**: no CORS and no hard-coded hosts in the bundle.
- Only `web` publishes a port, bound to `127.0.0.1:8400`. MongoDB, Redis and the game server have no route to the internet.

> [!NOTE]
> 📱 **Fun fact:** production runs on a **Pixel 3 XL** phone (Snapdragon 845, Ubuntu 24.04 `arm64`).
> The whole stack idles at about **255 MB of RAM**.

## 🔧 Configuration

Server settings are environment variables. Set them in [`deploy/docker-compose.yml`](deploy/docker-compose.yml); anything not set there uses its default.

| Variable | Default | Description |
|:--|:--:|:--|
| `SESSION_IDLE_WAITING_SECONDS` | `300` | Remove a not-yet-started room after this long with no open connection |
| `SESSION_IDLE_PLAYING_SECONDS` | `600` | Keep an abandoned game this long so players can reconnect |
| `SESSION_IDLE_ENDED_SECONDS` | `120` | Remove finished games |
| `MAX_SESSIONS` | `100` | Room cap in memory; beyond it `/api/create` and `/api/single` return `503` |
| `DEFAULT_TURN_TIMEOUT_SECONDS` | `60` | Turn timer before the AI plays for an idle player |
| `WEBSOCKET_PING_INTERVAL` | `15` | Seconds between WebSocket pings |
| `LOG_LEVEL` / `LOG_FORMAT` | `info` / `json` | Server logging |
| `TELEGRAM_*` `FIREBASE_*` `GOOGLE_OAUTH_*` | *(empty)* | **Must stay empty**: these integrations are deliberately disabled |

## 🧰 Operations

```bash
cd deploy
docker compose ps                                                  # health of all 4 services
curl -s http://127.0.0.1:8400/api/list                             # open multiplayer rooms
DOCKER_BUILDKIT=1 docker compose up -d --build --no-deps web       # redeploy frontend (safe)
DOCKER_BUILDKIT=1 docker compose up -d --build --no-deps server    # redeploy backend (⚠ ends live games)
./smoke-test.sh && ./privacy-audit.sh                              # run after every change
```

> [!IMPORTANT]
> Games in progress live only in the server's memory. Restarting or rebuilding `server` ends all of them, so check `/api/list` first.

| Script | What it does |
|:--|:--|
| [`smoke-test.sh`](deploy/smoke-test.sh) `[URL]` | End-to-end check: pages, assets, API, creates an AI game, WebSocket handshake |
| [`privacy-audit.sh`](deploy/privacy-audit.sh) | Checks for trackers or foreign hosts in the bundle, secrets in the source, and confirms the backend has no internet |
| [`regen-patches.sh`](deploy/regen-patches.sh) | Regenerates patches `0002`/`0003` from `src/golem` and proves the tree can be rebuilt from the original download |
| [`sanitize-src.sh`](deploy/sanitize-src.sh) | Cleans a new upstream drop: strips foreign config, applies patches, builds avatars, removes image metadata |
| [`make-avatars.py`](deploy/make-avatars.py) | Cuts the 15 pixel avatars from the sprite sheet |
| [`strip-image-metadata.py`](deploy/strip-image-metadata.py) | Removes EXIF/XMP metadata from images |

📖 Full operations guide (backup and restore, tunnel, troubleshooting, rollback): [`docs/runbook.md`](docs/runbook.md). The docs are written in Vietnamese.

## 📂 Project structure

```text
.
├── deploy/                    # everything we own: compose, Dockerfiles, nginx, scripts, patches
│   ├── docker-compose.yml     # mongodb · redis · server (internal network) · web (127.0.0.1:8400)
│   ├── Dockerfile.server      # Go build for the host's architecture (amd64 / arm64)
│   ├── Dockerfile.web         # Vite build → nginx
│   ├── nginx.conf             # SPA + /api, /ws reverse proxy, asset caching
│   └── patches/               # 0001 auth-off · 0002 frontend theme + avatars · 0003 idle-room cleanup
├── src/golem/                 # upstream game, sanitized + patched
│   ├── cmd/server/            # Go entry point
│   ├── internal/              # game engine & AI, session, server, event store
│   └── web/                   # React frontend + static images & sounds
├── assets-src/                # source sprite sheet for the avatars
└── docs/                      # architecture, runbook, privacy, upstream changes, README assets
```

## 🔌 API

<details>
<summary>REST & WebSocket endpoints</summary>

<br/>

| Method | Path | Notes |
|:--|:--|:--|
| `GET` | `/health` | Liveness: `OK` |
| `GET` | `/api/list` | Open multiplayer rooms (single-player games are hidden) |
| `POST` | `/api/create` | `{numPlayers, sessionID?, creatorName}`: new multiplayer room |
| `POST` | `/api/single` | `{numAI: 1..4, turnTimeout?}` → `{sessionID: "single_…"}` |
| `POST` | `/api/join` | Join a room |
| `POST` | `/api/sessions/start` | `{sessionID}`: start the game |
| `WS` | `/ws?session=&name=&avatar=[&spectate=true][&clientID=]` | Game channel (`state`, `playerAssigned`, …) |
| `GET` | `/api/games` · `/api/events?gameId=` · `/api/snapshot?gameId=` | Game history |

</details>

## 🐞 Known issues

- An upstream race can crash the server with *send on closed channel* when a player disconnects mid-broadcast. Docker restarts it automatically, but games in progress are lost.
- The `session` package has data races reported by `go test -race`.
- History endpoints (`/api/games`, `/api/events`, …) are public and unauthenticated, and client IDs are guessable.

## 🙏 Credits & disclaimer

- ***Century: Golem Edition*** is a board game designed by **Emerson Matsuuchi** and published by **Plan B Games**.
  This repository is an **unofficial, non-commercial fan project** for private play. It is not affiliated with or endorsed by Plan B Games.
  Game names and card artwork belong to their respective owners.
- The avatar sprites come from ***Super Mario Bros.*** © Nintendo and are used here for fun only.
- The game engine is based on a third-party implementation, sanitized and extended for self-hosting.
  Every change is documented in [`docs/upstream-changes.md`](docs/upstream-changes.md).
- **No license is granted.** This is a private repository.

<img src="docs/assets/divider.svg" width="100%" height="6" alt=""/>

<div align="center">
<sub>Built with 💎 crystals, ☕ coffee and one stubborn old phone · <a href="https://century.pentium.ink">century.pentium.ink</a> · <a href="#top">⬆ back to top</a></sub>
</div>
