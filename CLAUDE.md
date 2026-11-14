# CLAUDE.md — Century Golem self-host (century.pentium.ink)

Self-host board game **Century: Golem Edition** (Go backend + React/Vite frontend + MongoDB + Redis) trên máy này,
public qua Cloudflare Tunnel tại **https://century.pentium.ink**. Nguồn: `golem.zip` (Google Drive, repo gốc của bên
thứ ba). Yêu cầu cứng: **chạy độc lập, không dính/không gửi gì về deployment gốc** (game.anhtran.dev, 157.66.101.66,
Jenkins, Telegram, Firebase của tác giả) và không mang dấu vết định danh tác giả.

Tuỳ biến của người dùng so với upstream: tắt đăng nhập Google · 15 avatar sprite Super Mario Bros. (màn khởi tạo +
trong ván, AI không trùng avatar) · theme **Windows XP × brutalism** cho màn chính + màn tạo/vào phòng (+ hộp thoại kết
nối, phòng chờ) — **bàn chơi giữ style upstream**: người dùng đã thử XP trong ván và thấy xấu · tự dọn phòng ma ·
**luật chính thức** (hoà ⇒ ghế sau thắng, mua lá = đặt crystal bất kỳ lên lá bên trái, golem 6/5) · **AI 4 mức**
(Easy/Medium/Hard/Very Hard; Very Hard = các AI liên minh chống người chơi, công bố ở lobby) — `docs/ai/`.

> **Máy chạy từ 2026-11-14: `pixel3xl`** — Pixel 3 XL, Ubuntu 24.04 **aarch64**, 3.5 GB RAM, Wi-Fi; `ssh ubuntu@100.71.99.38`
> (Tailscale), repo `/home/ubuntu/ai/rename-game`, tunnel `century-tunnel` (systemd --user, linger bật), `sudo` không cần mật khẩu.
> Bản ở rtx (`/home/nghia/ai/rename-game`) = bản làm việc + dự phòng: stack đã `docker compose stop`, tunnel đã disable.
> ⛔ Không chạy tunnel `century` ở CẢ HAI máy (Cloudflare chia tải ⇒ phòng/ván tách đôi). Đồng bộ code / rollback: runbook §11.
> **Git:** `git@github.com:nghiaump/century-golem.git` (private, nhánh `main`, gốc repo = `rename-game/`; xem `.gitignore`).
> README tiếng Anh + ảnh minh hoạ ở `docs/assets/` (banner/divider SVG động, screenshot WebP chụp bằng playwright-core).
> Lịch sử git của upstream (tên/email tác giả + `.env` cũ) đã dời khỏi repo sang `/home/nghia/ai/golem-upstream.git` — ⛔ không push.

## Tài liệu (mục lục: `docs/README.md`)
- `docs/architecture.md` — luồng request, service, cổng, state, dọn phòng, AI, API game
- `docs/runbook.md` — vận hành: kiểm tra, deploy lại, đổi avatar, nhận source mới, backup, tunnel, sự cố, gỡ bỏ
- `docs/privacy.md` — đã gỡ/tắt gì, đã kiểm gì, rủi ro còn lại
- `docs/upstream-changes.md` — mọi thay đổi so với upstream (patch 0001–0003), kết quả test
- `docs/ai/` — AI: `README.md` (EN, tổng quan), `thiet-ke.md`, `tinh-chinh.md`, `hieu-nang.md`, `research.md` (EN)
- `docs/adr/` — quyết định kiến trúc (0001 luật · 0002 simulator · 0003 MCTS · 0004 utility/liên minh · 0005 luồng ·
  0006 patch · 0007 ghế/ẩn deck) · `docs/plans/` — plan đã duyệt (lưu nguyên văn + revision log)

## Bố cục
```
rename-game/
├── deploy/                       ★ cấu hình deploy của mình (không thuộc upstream)
│   ├── docker-compose.yml        project `century-golem`: mongodb, redis, server (mạng internal), web (127.0.0.1:8400)
│   │                             + env dọn phòng SESSION_IDLE_*_SECONDS, MAX_SESSIONS
│   ├── Dockerfile.web, nginx.conf   build React (base "/", API cùng origin) → nginx (conf mount ro)
│   ├── Dockerfile.server         build Go theo kiến trúc máy build (upstream Dockerfile ép GOARCH=amd64 ⇒ hỏng trên arm64)
│   ├── patches/                  0001 auth-404 · 0002-frontend (XP, avatar, UI AI) · 0003-backend (dọn phòng, luật, AI, loop)
│   │   └── attic/                bản thử bị bỏ (không được áp): ingame-xp-theme.patch
│   ├── regen-patches.sh          sinh lại 0002/0003 từ src/golem + kiểm tái lập — chạy sau MỌI lần sửa src
│   ├── sanitize-src.sh           làm sạch source mới: gỡ .env máy khác → áp patch → sinh avatar → xoá metadata ảnh
│   ├── make-avatars.py           cắt sprite SMB → avatar 1..15.webp (cần Pillow: PY=/home/nghia/ai/venvs/mda5-asr/bin/python)
│   ├── strip-image-metadata.py   xoá EXIF/XMP PNG/JPEG (stdlib, python3 -I)
│   ├── smoke-test.sh             kiểm chức năng (mặc định qua domain; tham số http://127.0.0.1:8400 để local)
│   ├── privacy-audit.sh          kiểm riêng tư/không rò rỉ
│   └── tunnel.log                log cloudflared
├── src/golem/                    mã upstream ĐÃ sanitize + vá (tái lập được từ golem.zip)
│   └── internal/ai/              AI: sim/ (simulator gọn), arena/ (+aibench CLI), eval/mcts/utility/intent…
├── assets-src/smb-enemies-sheet.png   sprite sheet nguồn của avatar
├── removed-foreign-config/       .env/inventory máy khác, favicon + avatar ảnh người thật gốc — ⛔ không chép lại
├── backups/                      mongodump *.archive.gz
└── golem.zip                     bản tải gốc (dùng cho sanitize/regen-patches — ⛔ không xoá)
```
Ngoài thư mục: `~/.config/century-golem/{tunnel.yml,tunnel-creds.json}` (creds 0400, secret),
`~/.config/systemd/user/century-tunnel.service` (tunnel `century`, metrics 127.0.0.1:20261).

## Lệnh hay dùng
```bash
cd /home/nghia/ai/rename-game/deploy
docker compose ps
curl -s http://127.0.0.1:8400/api/list                            # phòng nhiều người đang mở (ván đơn bị ẩn)
DOCKER_BUILDKIT=1 docker compose up -d --build --no-deps web      # deploy lại frontend (an toàn)
DOCKER_BUILDKIT=1 docker compose up -d --build --no-deps server   # backend — ⚠ kết thúc mọi ván đang chơi
./regen-patches.sh && ./smoke-test.sh && ./privacy-audit.sh       # BẮT BUỘC sau mỗi thay đổi; tất cả exit 0
# AI: benchmark / giải đấu (trong container golang:1.24, từ src/golem) — xem docs/ai/tinh-chinh.md
go run ./internal/ai/arena/aibench bench -level veryhard -n 20      # thời gian nghĩ + iteration trên máy hiện tại
go run ./internal/ai/arena/aibench ladder -seeds 100                # các cặp cấp liền kề + baseline
docker compose logs server | grep "Removed idle session"          # phòng đã được dọn
```
Test (chạy trong container, không cần toolchain trên host):
```bash
# Go — dùng volume cache golem-gomod / golem-gocache-deb
docker run --rm -v "$PWD/../src/golem":/src:ro -v golem-gomod:/go/pkg -v golem-gocache-deb:/root/.cache -w /src \
  -e GOFLAGS=-buildvcs=false golang:1.24 go test -race -count=1 ./internal/server/
# Frontend — trên BẢN SAO (npm ci tạo node_modules, đừng làm bẩn src): xem docs/upstream-changes.md §Test
```

## Quy tắc (⛔ = không được làm)
- ⛔ Đặt `TELEGRAM_*`, `FIREBASE_*`, `GOOGLE_OAUTH_*` khác rỗng; ⛔ khôi phục thứ gì từ `removed-foreign-config/`.
- ⛔ Bỏ `internal: true` của network `backend` hay publish cổng mongodb/redis/server. Chỉ `web` có cổng, chỉ `127.0.0.1:8400`.
- ⛔ Sửa tunnel `homelab` (`/etc/cloudflared`, root) — century có tunnel RIÊNG; ⛔ wildcard ingress.
- ⛔ Thêm dịch vụ ngoài (CDN, **web font**, analytics, OAuth, telemetry) mà không hỏi người dùng. Theme XP dùng font hệ thống.
- Sửa code trong `src/golem` ⇒ `./regen-patches.sh` (phải in REPRODUCIBLE) + cập nhật `docs/upstream-changes.md`.
- Đổi ảnh avatar ⇒ bump `AVATAR_VERSION` (`src/golem/web/react-frontend/src/utils/avatar.js`); đổi số lượng ⇒ `AVATAR_IDS`.
- Style màn khởi tạo: class `xp-*` trong `theme-xp.css` (+ `XpWindow`); ⛔ glass/gradient tím-hồng ở đó.
  ⛔ Áp theme XP vào bàn chơi (đã bị người dùng từ chối; bản thử ở `deploy/patches/attic/`).
  `theme-xp.css` nạp SAU Tailwind ⇒ cùng thuộc tính thì `xp-*` thắng; muốn đè dùng inline style hoặc `!` (vd `!p-1`).
- Bật đăng nhập Google: chỉ với Firebase project + OAuth client CỦA NGƯỜI DÙNG.
- Restart/rebuild `server` = mất mọi ván đang chơi (state trong RAM) ⇒ xem `/api/list` trước (ván đơn KHÔNG hiện ở
  đó — xem log/`docker compose logs server` nếu cần biết có ván đơn đang chạy).
- ⛔ Đổi `go.mod`/`package.json` hay sửa `cmd/` (regen-patches không bắt ⇒ hết REPRODUCIBLE). AI chỉ dùng stdlib (ADR 0006).
- Đổi luật ⇒ sửa **cả** `internal/game` và `internal/ai/sim`; `TestDifferential_SimMatchesEngine` phải pass.
- ⛔ AI đọc thứ tự deck thật: chỉ đi qua `sim.FromGame` (pool không thứ tự). Mọi nước AI được `Validate` lại trên engine.
- Đổi tên patch ⇒ `git mv` + xoá file cũ (sanitize áp mọi `patches/*.patch`); patch đặt tên theo phạm vi thư mục.

## Bẫy đã gặp
- **AI/game loop**: mọi mutate GameState + broadcast phải dưới `gs.mu`; AI nghĩ trên `Clone()`; ⛔ gọi agent khi đang giữ
  lock. `sim.Drawer` nhận kích thước pool (truyền slice qua interface ⇒ state thoát heap ⇒ 1 alloc/nước).
- ⛔ **Benchmark/tải nặng kéo dài trên pixel3xl khi đang chạy pin** (charger `online=0`) hoặc pin < 40%: 2026-11-14 máy
  tắt giữa lúc bench Very Hard ở 19% ⇒ site 530. Kiểm `cat /sys/class/power_supply/{max1720x/capacity,pmi8998-charger/online}`.
- Giải đấu AI dùng **iteration** (tất định, không phụ thuộc máy); production dùng **thời gian**. rtx 48 core làm benchmark
  "đẹp" hơn Pixel ~2.2×/core — số liệu thật ở `docs/ai/hieu-nang.md`.
- **arm64 (pixel3xl)**: `src/golem/Dockerfile` của upstream ép `GOARCH=amd64` ⇒ compose dùng `deploy/Dockerfile.server`.
  Mongo giới hạn `--wiredTigerCacheSizeGB 0.25` (máy 3.5 GB). Lúc chuyển máy pixel3xl **đang chạy pin** (charger `online=0`).
- **Cloudflare 403 / error 1010** khi test bằng curl/python: zone chặn UA script ⇒ dùng UA trình duyệt.
- **Máy chạy Wi-Fi** (`wlo2`; `enp67s0` DOWN) ⇒ qua domain thỉnh thoảng timeout / `ERR_NETWORK_CHANGED` trong Chrome
  headless. Local (`127.0.0.1:8400`) luôn ổn ⇒ lỗi chập chờn chỉ ở public thì là mạng, chạy lại.
- `docker compose build` web báo *classic builder doesn't support additional contexts* ⇒ `DOCKER_BUILDKIT=1`.
- `up -d --build web` thiếu `--no-deps` có thể recreate `server` (mất ván).
- `/assets` cache 7 ngày (nginx `expires`) ở cả Cloudflare ⇒ thay file cùng URL thì người chơi vẫn thấy bản cũ;
  dùng URL có version. Không có API token Cloudflare để purge (cert.pem chỉ quản tunnel/DNS).
- `web/react-frontend/public/{images,sounds}` là **symlink** tới `web/static/*` — một bộ ảnh duy nhất.
- Vite đọc `.env.local` ở MỌI mode; `.env.production` gốc trỏ `game.anhtran.dev` ⇒ `Dockerfile.web` xoá và tự sinh env.
- Server gán avatar AI = player ID ⇒ trùng người thật; frontend `resolveAvatarId` xử lý (không sửa server).
- Code chết (không render): `OpponentArea`, `Simple*`, `CollectModal`, `Chat`, `MarketArea`, `PlayerHand`, `ResourcePanel`,
  `ActionLog`, `PlayedCardsView`, `Mobile{NavBar,HistoryButton}`. Skin `FantasyGameLayout` (nút ✨) là style upstream.
- vitest cần `--environment jsdom` (cấu hình upstream không bật DOM).
- Link `/room/:id` mở trực tiếp đi qua lobby (patch 0002(e)); đừng khôi phục auto-join kiểu upstream (kẹt "Connecting...").
- Ván chơi đơn nhận diện bằng tiền tố `single` của sessionID (quy ước upstream, dùng trong `StartGame` và `/api/list`).
- `sudo` cần mật khẩu ⇒ mọi thứ thiết kế để không cần root (docker group + systemd --user, linger bật).
- Test UI thật: Chrome headless qua playwright-core có sẵn ở `~/.npm/_npx/f0a362733743bae2/node_modules/playwright-core`
  với `executablePath: '/usr/bin/google-chrome'`.

## Lỗi upstream đã biết (chưa sửa)
- `session.sendToPlayer`/broadcast gửi vào `WriteChan` của người chơi vừa bị gỡ (kênh đã đóng) ⇒ **panic "send on
  closed channel" làm sập process** (test `session_concurrency_test.go` tái hiện). Docker tự restart nhưng mọi ván mất.
- Package `session` có nhiều data race / test fail sẵn (xem docs/upstream-changes.md §Test).
- `clientId` đoán được (`client_<UnixNano>`); endpoint lịch sử `/api/games`, `/api/events`... công khai không auth.
