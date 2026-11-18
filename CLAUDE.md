# CLAUDE.md — Century Golem self-host (century.pentium.ink)

Self-host board game **Century: Golem Edition** (Go backend + React/Vite frontend + MongoDB + Redis) trên máy này,
public qua Cloudflare Tunnel tại **https://century.pentium.ink**. Nguồn: `golem.zip` (Google Drive, repo gốc của bên
thứ ba). Yêu cầu cứng: **chạy độc lập, không dính/không gửi gì về deployment gốc** (game.anhtran.dev, 157.66.101.66,
Jenkins, Telegram, Firebase của tác giả) và không mang dấu vết định danh tác giả.

Tuỳ biến của người dùng so với upstream: tắt đăng nhập Google · **giao diện thống nhất "Đá & Pha lê"** (cảm hứng Golem Edition,
nguyên bản) cho MỌI màn — màn chính, lobby, kết nối, phòng chờ, bàn chơi desktop/mobile, skin ✨, popup (2026-11-16, thay theme
XP; `docs/ui/`) · **24 avatar golem tự vẽ** (12 golem + 1 biến thể mỗi con; AI mang avatar ngẫu nhiên và tên golem đó) · tự dọn phòng ma ·
**luật chính thức** (hoà ⇒ ghế sau thắng, mua lá = đặt crystal bất kỳ lên lá bên trái, golem 6/5) · **AI 4 mức**
(Easy/Medium/Hard/Very Hard; Very Hard = mỗi AI tự chơi để thắng, chặn đối thủ đe doạ nhất; người chơi chỉ là đối thủ chính
khi **ngang** AI dẫn đầu (lệch < 1 điểm) — **không liên minh/không "biếu" nhau, không chặn người chỉ để hại**, ADR 0008) ·
rút lại nước chơi lá làm tràn >10 crystal (nút Undo ở popup discard) — `docs/ai/` · **avatar ảnh riêng** (≤ 5 MB, cắt/thu ở trình
duyệt, server chỉ giữ trong RAM theo phòng — `internal/avatars`).

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
- `docs/ui/` — giao diện: `README.md` (EN, tổng quan), `thiet-ke-giao-dien.md` (token, component, bố cục, quy tắc UX, kiểm thử)
- `docs/adr/` — quyết định kiến trúc (0001 luật · 0002 simulator · 0003 MCTS · 0004 utility · 0005 luồng ·
  0006 patch · 0007 ghế/ẩn deck · 0008 VH đối thủ cạnh tranh · 0009 giao diện Đá & Pha lê) · `docs/plans/` — plan đã duyệt
  (lưu nguyên văn + revision log)

## Bố cục
```
rename-game/
├── deploy/                       ★ cấu hình deploy của mình (không thuộc upstream)
│   ├── docker-compose.yml        project `century-golem`: mongodb, redis, server (mạng internal), web (127.0.0.1:8400)
│   │                             + env dọn phòng SESSION_IDLE_*_SECONDS, MAX_SESSIONS
│   ├── Dockerfile.web, nginx.conf   build React (base "/", API cùng origin) → nginx (conf mount ro)
│   ├── Dockerfile.server         build Go theo kiến trúc máy build (upstream Dockerfile ép GOARCH=amd64 ⇒ hỏng trên arm64)
│   ├── ship.sh, Dockerfile.*.prebuilt   ★ deploy prod: build nặng ở rtx (deploy/build/, gitignore), Pixel chỉ COPY + restart
│   ├── patches/                  0001 auth-404 · 0002-frontend (src/ + index.html + tailwind.config.js: UI, AI UI)
│   │                             · 0003-backend (dọn phòng, luật, AI, loop) — file nhị phân KHÔNG đi qua patch
│   │   └── attic/                bản thử bị bỏ (không được áp): ingame-xp-theme.patch
│   ├── regen-patches.sh          sinh lại 0002/0003 từ src/golem + kiểm tái lập — chạy sau MỌI lần sửa src
│   ├── sanitize-src.sh           làm sạch source mới: gỡ .env máy khác → áp patch → chép avatar + font từ assets-src → xoá metadata
│   ├── make-golem-avatars.py     vẽ 24 avatar golem SVG → assets-src/avatars (stdlib, tất định; --preview OUT.html)
│   ├── ui-shots.mjs              chụp mọi màn ở 6 viewport + kiểm tự động (request ngoài, console, tràn, chữ <12px, nút <44px)
│   ├── strip-image-metadata.py   xoá EXIF/XMP PNG/JPEG (stdlib, python3 -I)
│   ├── smoke-test.sh             kiểm chức năng (mặc định qua domain; tham số http://127.0.0.1:8400 để local)
│   ├── privacy-audit.sh          kiểm riêng tư/không rò rỉ
│   └── tunnel.log                log cloudflared
├── src/golem/                    mã upstream ĐÃ sanitize + vá (tái lập được từ golem.zip)
│   ├── internal/ai/              AI: sim/ (simulator gọn), arena/ (+aibench CLI), eval/mcts/utility/intent…
│   └── web/react-frontend/src/   UI: styles/{tokens,fonts}.css · components/ui (primitive) · board/ · start/ · mobile/ · desktop/
├── assets-src/                   nguồn NHỊ PHÂN sanitize chép vào src: avatars/ (24 SVG + avatars.json) · fonts/ (woff2 + OFL)
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
./ship.sh web                                                     # PROD: vite build ở rtx → Pixel đóng gói + restart web (an toàn)
./ship.sh server                                                  # PROD: go build arm64 ở rtx → Pixel restart server — ⚠ mất ván
# (`docker compose up -d --build --no-deps web|server` = compile tại chỗ: chỉ trên rtx; ⛔ trên Pixel — runbook §11)
./regen-patches.sh && ./smoke-test.sh && ./privacy-audit.sh       # BẮT BUỘC sau mỗi thay đổi; tất cả exit 0
node ui-shots.mjs http://127.0.0.1:8400 /tmp/shots [--only desktop|mobile] [--rest]   # stack local: ảnh + kiểm UI (exit 1 nếu lỗi)
# Safari (WebKit) — iPhone 15 Pro + Mac: xem lệnh docker ở đầu deploy/webkit-shots.cjs (exit 1 nếu lá rộng 0 / chạm không mở sheet)
python3 -I make-golem-avatars.py --preview /tmp/av.html          # đổi avatar → rồi chép sang src (như sanitize) + bump AVATAR_VERSION
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
- ⛔ Thêm dịch vụ ngoài (CDN, **web font ngoài**, analytics, OAuth, telemetry) mà không hỏi người dùng (font OFL đóng gói trong repo thì được).
- Sửa code trong `src/golem` ⇒ `./regen-patches.sh` (phải in REPRODUCIBLE) + cập nhật `docs/upstream-changes.md`.
- Avatar = 24 golem SVG do `deploy/make-golem-avatars.py` vẽ (nguyên bản, ⛔ ảnh người thật / sprite có bản quyền). Đổi ⇒ chạy script
  (ghi `assets-src/avatars/`), chép vào `src/golem/web/static/images/avatar/` (như sanitize), bump `AVATAR_VERSION`; đổi tên/số lượng ⇒
  `AVATAR_NAMES` (`utils/avatar.js`) **và** `avatarNames` (`internal/session/ai_turns.go`) — test Go `TestAvatarNames_*` so khớp hai bên.
  Mỗi golem tối đa 1 biến thể (ý người dùng).
- Toast ý đồ AI tắt mặc định (`AI_INTENT_MESSAGES=0`) — người dùng không muốn thông báo tường minh.
- **Style = hệ thống "Đá & Pha lê"** (`docs/ui/thiet-ke-giao-dien.md`): màu/bo góc/bóng chỉ lấy từ `src/styles/tokens.css` (map trong
  `tailwind.config.js`: `rock` `bronze` `parch` `ink` `fg` `gem` `ember` `moss` `teal`); dựng màn hình từ `components/ui/*` (Panel, Button,
  Modal, Gem, CrystalRow, Avatar, …) — ⛔ màu Tailwind thô kiểu `bg-purple-600`, ⛔ `backdrop-blur`, ⛔ emoji thay crystal/coin/golem,
  ⛔ class ghép chuỗi động (Tailwind không thấy). Chữ ≥ 12px, nút ≥ 44px trên điện thoại, z-index chỉ theo thang `z-board…z-system`.
- Font: chỉ 2 font OFL tự phục vụ (Cinzel, Be Vietnam Pro — `assets-src/fonts`); ⛔ font/CDN ngoài. **Cinzel chỉ cho chữ tiếng Anh
  tĩnh** (không có dấu tiếng Việt) — tên người chơi và mọi chữ động dùng font thường.
- ⛔ Theme Windows XP (đã bỏ 2026-11-16 theo yêu cầu người dùng; bản thử cũ còn ở `deploy/patches/attic/`, không được áp).
- Bật đăng nhập Google: chỉ với Firebase project + OAuth client CỦA NGƯỜI DÙNG.
- ⛔ Build nặng trên pixel3xl (`compose up --build`, npm, go build): **build ở rtx, Pixel chỉ deploy** bằng `deploy/ship.sh`
  (quy ước người dùng 2026-11-15).
- Restart/rebuild `server` = mất mọi ván đang chơi (state trong RAM) ⇒ xem `/api/list` trước (ván đơn KHÔNG hiện ở
  đó — xem log/`docker compose logs server` nếu cần biết có ván đơn đang chạy).
- ⛔ Đổi `go.mod`/`package.json` hay sửa `cmd/` (regen-patches không bắt ⇒ hết REPRODUCIBLE). AI chỉ dùng stdlib (ADR 0006).
- Đổi luật ⇒ sửa **cả** `internal/game` và `internal/ai/sim`; `TestDifferential_SimMatchesEngine` phải pass.
- ⛔ AI đọc thứ tự deck thật: chỉ đi qua `sim.FromGame` (pool không thứ tự). Mọi nước AI được `Validate` lại trên engine.
- Đổi tên patch ⇒ `git mv` + xoá file cũ (sanitize áp mọi `patches/*.patch`); patch đặt tên theo phạm vi thư mục.
- **Commit message**: một dòng ngắn gọn, prefix `feat:` `fix:` `chore:` `docs:` `ci:` `refactor:` `test:` (có thể kèm scope,
  vd `feat(ai): …`); ⛔ không body dài, ⛔ không dòng `Co-Authored-By` / không nhắc Claude.

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
- **File nhị phân không đi qua patch** (`diff -ruN` văn bản): font/avatar để ở `assets-src/`, `sanitize-src.sh` chép vào `src/golem`
  (diff src có `-x fonts`). `index.html` + `tailwind.config.js` nằm ngoài `src/` ⇒ `regen-patches.sh` nối diff của chúng vào 0002.
  Chỉ xoá file DO MÌNH THÊM; xoá file upstream ⇒ hết REPRODUCIBLE (code chết cứ để đó).
- Vite build có `publicDir: false` ⇒ file trong `public/` không vào bản build; font import bằng `url()` từ CSS (Vite băm tên).
- Server gửi số crystal đặt trên lá market dạng **chuỗi** (`deposits: {"yellow": "1"}`, `Resources.ToMap`) ⇒ luôn qua `num()`/`of()`
  trong `utils/crystals.js` (đã từng hiện đủ 4 viên trên mọi lá).
- `useBoardActions` (hooks): logic chung của mọi bố cục; chỉ MỘT instance mỗi màn được `reopenAfterUndo: true` (instance đó tiêu thụ
  sự kiện mở lại popup trade/upgrade sau Undo). `Modal` giữ `onClose` trong ref — đừng đưa hàm inline vào deps (giật focus mỗi lần render).
- **Thêm route HTTP mà không sửa `cmd/`**: mọi request đi qua `server.WrapWithCORS` ⇒ chặn path ở đó (vd `/api/avatars` →
  `avatars.Default`). Ảnh riêng gắn với phòng ở `HandleWebSocketV2` (`Attach`) và bị xoá ở dọn phòng `startCleanupTimerV2`
  (`ReleaseSession`) — thêm chỗ xoá phòng mới thì phải gọi `ReleaseSession` theo. ⛔ ghi ảnh người chơi ra đĩa/Mongo.
- **Safari/WebKit ≠ Chrome**: lá có `aspect-ratio` + chiều cao % trong khung co theo nội dung (thêm `max-width:100%`) bị WebKit vẽ
  **rộng 0px** — 2026-11-17 mọi lá golem/tay bài trên iPhone thành vạch mỏng mà Chrome headless không thấy. Hàng lá luôn đặt kích
  thước pixel tường minh (`cardBox(h)` + `hooks/useElementSize`); `CardTile` ⛔ `max-w-full` mặc định (chỉ lưới desktop truyền vào).
  Sửa UI ⇒ chạy cả `deploy/webkit-shots.cjs` (lệnh ở đầu file; image playwright).
- **Safari iOS 26**: thanh công cụ nổi đè lên đáy trang; `100dvh` và `env(safe-area-inset-bottom)` KHÔNG trừ phần bị che ⇒ khung
  điện thoại cao theo `hooks/useVisibleHeight` (min innerHeight / visualViewport / 100svh) + `html.phone-lock`; ⛔ quay lại `100dvh`.
  Kiểm máy thật: mở `https://century.pentium.ink/?vp` (ô số đo). Giả lập: viewport 393×852 + safe-top 59 + `visualViewport.height` 772.
- **Âm thanh trên điện thoại** (`utils/sounds.js`): iOS chỉ cho một `<audio>` phát ngoài cú chạm nếu chính phần tử đó đã phát một lần
  *trong* cú chạm ⇒ `installUnlock` mồi mọi âm (phát câm rồi dừng) + resume AudioContext ở lần chạm đầu; "đang phát" hỏi thẳng phần tử
  (`paused`/`ended`), ⛔ không dựa vào sự kiện `ended` (âm bị ngắt khi khoá màn hình không bao giờ gửi ⇒ trước đây mất hẳn âm "tới lượt");
  ⛔ `cloneNode()` cho âm chồng khi phần tử gốc rảnh (bản sao chưa mở khoá trên iOS). Playwright WebKit không mô phỏng luật này.
  Âm đánh lá = WAV tổng hợp (`cardSlapSamples`, blob URL) — muốn đổi tiếng thì sửa hàm đó, không thêm file mp3.
- **Bố cục điện thoại** (`mobile/PhoneShell`): cả ván vừa một màn, cỡ lá do `utils/phoneLayout.planPhoneBoard` tính từ vùng đo được —
  thêm hàng/nút cố định vào màn điện thoại thì cập nhật `BOARD_CHROME`/test. Kiểm bằng viewport thật của Safari iPhone (393×659 có
  thanh địa chỉ, 393×852 + safe-area 59/34, ngang 852×341 + safe 59 trái/phải): `Emulation.setSafeAreaInsetsOverride` qua CDP.
- Chạm lá trên điện thoại mở `CardSheet` (xem + nút hành động), desktop click là hành động ngay + hover xem chi tiết (`CardInspect`).
- Avatar AI do server chọn ngẫu nhiên (`aiAvatar: true`); frontend `resolveAvatarId` chỉ dùng luật cũ theo ghế khi thiếu cờ.
  `PlayerAvatar` ⛔ tra người chơi theo `id 0` (phòng chờ: mọi dòng chưa có ghế đều id 0).
- Code chết (không render, file upstream nên giữ): `OpponentArea`, `Simple*`, `CollectModal`, `Chat`, `MarketArea`, `PlayerHand`,
  `ResourcePanel`, `ActionLog`, `PlayedCardsView`, `CompactCard`, `Card*`, `CrystalIcon/Stack`, `AcquiredCardOverlay`,
  `Mobile{NavBar,HistoryButton}`, `MobileLayoutContext`. Skin ✨ (`FantasyGameLayout`) = bố cục phụ CHỈ desktop, đặt theo % trên ảnh
  bàn `game_dock.jpg`; đã restyle (dock đá, popup chung, ảnh lưng bài `golem_bg/merchant_bg`).
- vitest cần `--environment jsdom` (cấu hình upstream không bật DOM).
- Link `/room/:id` mở trực tiếp đi qua lobby (patch 0002(e)); đừng khôi phục auto-join kiểu upstream (kẹt "Connecting...").
- Ván chơi đơn nhận diện bằng tiền tố `single` của sessionID (quy ước upstream, dùng trong `StartGame` và `/api/list`).
- `sudo` cần mật khẩu ⇒ mọi thứ thiết kế để không cần root (docker group + systemd --user, linger bật).
- Test UI thật: Chrome headless qua playwright-core có sẵn ở `~/.npm/_npx/f0a362733743bae2/node_modules/playwright-core`
  với `executablePath: '/usr/bin/google-chrome'` — dùng `deploy/ui-shots.mjs`. Gallery dev: `vite dev` trên bản sao + `?gallery`
  (mọi primitive) / `?gallery&modal=trade|upgrade|deposit|discard|claim|gameover|victory` (popup với dữ liệu giả; không vào bản build).

## Lỗi upstream đã biết (chưa sửa)
- `session.sendToPlayer`/broadcast gửi vào `WriteChan` của người chơi vừa bị gỡ (kênh đã đóng) ⇒ **panic "send on
  closed channel" làm sập process** (test `session_concurrency_test.go` tái hiện). Docker tự restart nhưng mọi ván mất.
- Package `session` có nhiều data race / test fail sẵn (xem docs/upstream-changes.md §Test).
- `clientId` đoán được (`client_<UnixNano>`); endpoint lịch sử `/api/games`, `/api/events`... công khai không auth.
