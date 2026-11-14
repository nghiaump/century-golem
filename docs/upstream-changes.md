# Thay đổi so với mã upstream

Upstream: `golem.zip` (2026-10-07, commit `fec8db3 add staging env`, repo gốc `github.com/vietky/golem`).
Mọi thay đổi được tái lập tự động: `deploy/sanitize-src.sh` trên bản giải nén mới của `golem.zip` cho ra cây
**giống từng byte** với `src/golem` đang deploy (trừ `.git`). `deploy/regen-patches.sh` sinh lại patch + kiểm điều này.

## 1. Patch code — `deploy/patches/` (áp theo thứ tự tên)
| Patch | Phạm vi | Nội dung |
|---|---|---|
| `0001-auth-disabled-when-backend-404.patch` | `contexts/AuthContext.jsx` | `setAuthAvailable(false)` khi `/auth/profile` 404 — bug upstream: auth tắt mà Lobby vẫn đòi "Sign in with Google" |
| `0002-frontend.patch` (đổi tên 2026-11-14, trước là `0002-frontend-xp-theme-smb-avatars.patch`) | 27 file `web/react-frontend/src` | (a) avatar SMB, (b) avatar trong màn chơi, (c) theme XP × brutalism màn khởi tạo, (e) sửa link `/room/:id`, (f) UI AI 4 mức — chi tiết bên dưới |
| `0003-backend.patch` (đổi tên 2026-11-14, trước là `0003-backend-idle-room-cleanup.patch`) | 47 file `internal/` | dọn phòng ma, đóng phòng an toàn, trần số phòng, ẩn ván chơi đơn; **luật chính thức + engine Validate/Step**; **AI 4 mức** (`internal/ai`); **game loop có khoá** — chi tiết bên dưới |

Tên patch theo **phạm vi thư mục** (không theo tính năng) để không lỗi thời. Đổi tên phải `git mv` và xoá file cũ
(`sanitize-src.sh` áp mọi `patches/*.patch`).

### 0002 (a) Avatar SMB ở màn khởi tạo
- `utils/avatar.js` (mới): `AVATAR_IDS` (15), `avatarSrc(id)` có `?v=AVATAR_VERSION` (vượt cache 7 ngày).
- `Lobby.jsx` (create/join room), `SinglePlayerLobby.jsx`: lưới chọn 3×5. `OpponentArea.jsx` (code chết) cũng dùng `avatarSrc`.

### 0002 (b) Avatar trong màn chơi
- `components/PlayerAvatar.jsx` (mới): ảnh avatar, fallback chữ cái đầu khi lỗi; tự tra người chơi trong store.
- `resolveAvatarId(player, players)` trong `utils/avatar.js`: người thật = avatar đã chọn; AI (server gán avatar =
  player ID nên dễ trùng) lấy lần lượt avatar chưa ai chọn theo thứ tự ghế — tất định, mọi client thấy giống nhau.
- Thay chữ cái đầu / 🤖 ở: `PlayersInfoBar.jsx`, `PlayerCard.jsx`, `desktop/WebGameLayout.jsx`,
  `desktop/FantasyGameLayout.jsx`, `mobile/CompactPlayerHand.jsx` (2 chỗ), thêm avatar vào `GameOverModal.jsx`.
- Test: `utils/avatar.test.js` (5 test, vitest).

### 0002 (c) Theme Windows XP × brutalism (chỉ các màn trước khi vào ván)
- `theme-xp.css` (mới, import trong `main.jsx`): token `--xp-*`, cửa sổ XP (title bar Luna, mặt beige, status bar),
  viền đen dày + bóng đổ cứng, nút XP/nút xanh "go", tab, list, listview, badge, progress marquee, nền "Bliss" phẳng.
  Chỉ font hệ thống (Tahoma/Trebuchet/Verdana/DejaVu) — không web font.
- `components/XpWindow.jsx` (mới): khung cửa sổ; `onClose` = nút ✕ **hoạt động** (về menu).
- `components/XpWaitingRoom.jsx` (mới): phòng chờ dùng chung desktop (`WebGameLayout.jsx`) + mobile (`CompactGameBoard.jsx`).
- `SinglePlayerApp.jsx`: menu chọn chế độ, hộp thoại Connecting/Reconnecting/Failed; bỏ nút "← Back" nổi, thay
  bằng prop `onBack` cho `Lobby` / `SinglePlayerLobby` (nút ✕ trên title bar + nút Back).
- `Lobby.jsx`: 1 cột ở tab Create, 2 cột (cột phải = danh sách phòng) ở tab Join trên màn rộng.

- Bàn chơi (trong ván) giữ style upstream. Đã thử theme XP cho bàn chơi (2026-10-07) — người dùng thấy xấu, **đã
  revert**; bản đó cất ở `deploy/patches/attic/ingame-xp-theme.patch` (KHÔNG được sanitize áp; áp tay lên src hiện tại
  nếu muốn xem lại: `patch -d src/golem -p1 < deploy/patches/attic/ingame-xp-theme.patch`, cần cả khối CSS in-game).

### 0002 (e) Link `/room/:id` mở trực tiếp (F5, link mời, link cũ) — bug upstream
- Upstream: `SinglePlayerApp` thấy `roomId` trên URL thì nhảy thẳng vào màn chơi (`inGame = true`) mà **không gọi
  `connectWebSocket`** ⇒ kẹt vĩnh viễn ở "Connecting..." (không có kết nối nên cũng không có lỗi để hiện). Dọn phòng
  (0003) làm lộ rõ hơn: link cũ trong lịch sử trình duyệt luôn trỏ tới phòng đã bị xoá.
- Sửa: mở lobby nhiều người tab Join, `Lobby` nhận `initialRoomId`, hỏi `GET /admin/sessions/state?sessionId=` (200 = còn,
  404 = đã đóng) ⇒ note xanh + điền sẵn mã phòng, hoặc note đỏ "no longer exists". Join lại phòng đang chơi dở ⇒ cookie
  `clientId` đưa về đúng ghế (đã test: F5 giữa ván đơn → Join → tiếp tục ván).
- Hộp thoại Connecting: khi không kết nối/không thử lại/không lỗi (`isIdle`) hiện ngay nút Back to Menu.

### 0003 Dọn phòng ma (backend)
Vấn đề upstream: `CanBeDeleted` đòi danh sách người chơi rỗng hẳn, nhưng ván đã bắt đầu giữ chỗ người rớt mạng
(`Conn == nil`) để reconnect ⇒ ván bị bỏ **không bao giờ bị xoá**, AI tiếp tục đánh thay mỗi 60s, ghi event Mongo,
vòng lặp 100ms chạy tới hết ván rồi object nằm trong RAM mãi.
- `server.go` `startCleanupTimerV2`: mỗi `cleanupInterval` (30s) xem phòng còn kết nối WebSocket mở nào không
  (người chơi `Conn != nil` + khán giả); không còn trong `idleLimit(status)` ⇒ xoá khỏi map + `Close()`; log
  `Removed idle session`. Ngưỡng: waiting 300s, playing 600s, ended 120s.
- `server.go` `atSessionLimit` + `handlers.go`: `/api/create`, `/api/single` trả **503** khi đủ `MAX_SESSIONS` (100).
- `handlers.go` `/api/list`: bỏ qua phòng `single_*` (ván chơi đơn là riêng tư; upstream đã dùng tiền tố này để
  nhận diện chế độ chơi đơn trong `StartGame`).
- `session.go`: kênh `stop` + `closeOnce`; vòng lặp game thoát khi `stop` đóng; gửi action `select` với `stop`;
  `Close()` idempotent và **không còn `close(ActionChan)`** (upstream: vòng lặp quay rỗng trên kênh đã đóng, sender
  có thể panic "send on closed channel").
- `config.go`: `SESSION_IDLE_WAITING_SECONDS`, `SESSION_IDLE_PLAYING_SECONDS`, `SESSION_IDLE_ENDED_SECONDS`, `MAX_SESSIONS`.
- Test: `internal/server/cleanup_test.go` (6 test: ngưỡng mặc định/cấu hình, phòng trống bị xoá, phòng có người
  được giữ, **ván đã bắt đầu rồi bị bỏ bị xoá**, trần số phòng → 503, ẩn ván chơi đơn).

### 0003 Luật chính thức + engine (2026-11-14, ADR 0001)
- `game.go`: `Validate` (không mutate, trả action chuẩn hoá) + `apply`; `Step` = hàm lượt duy nhất (pending discard →
  hết lượt → kết thúc ván); `ExecuteAction`/`CheckGameOver` giữ cho caller cũ. Hoà ⇒ ghế sau thắng; mua lá k = đặt k
  crystal bất kỳ lên các lá bên trái (không gửi deposits ⇒ server đặt crystal rẻ nhất); `GolemsToEnd()` = 6 (2–3 người) /
  5 (4–5). Bug: `HasAll` bỏ qua multiplier, input âm, deposit không cộng dồn + mutate dở, hành động khi đang phải discard,
  kết thúc trước discard của ghế cuối, lá mua giữ deposits, coin người chơi alias coin market.
- `market.go`: market sở hữu bản sao lá khi lá vào hàng; `CrystalsToPlace`. `clone.go`: `Clone`, `RedactDeckOrder`.
  `legal.go`: `LegalActions` dạng chuẩn. `errors.go`: lỗi sentinel. `engine.go` `Run` dùng `Step`.
- Test mới: `rules_official_test.go`, `step_test.go`, `clone_test.go`, `legal_test.go`, `invariants_test.go` (fuzz 2000 ván);
  2 test ngưỡng 5 golem cũ được thay.

### 0003 AI 4 mức — `internal/ai` (2026-11-14, ADR 0002–0005)
- `ai/sim`: simulator gọn, differential test 2000 ván với engine. `ai`: evaluator, utility theo cấp (own / beat-the-leader /
  liên minh), MCTS open-loop ensemble, mô hình đối thủ, intent, scheduler luồng toàn server, profile theo cấp.
- `ai/arena` + `ai/arena/aibench` (CLI benchmark/giải đấu, không build vào image). Chi tiết: `docs/ai/`.

### 0003 Session / server cho AI (2026-11-14)
- `session/ai_turns.go` (mới): options (`WithSinglePlayer`, `WithAIRuntime`, `WithAgentFactory`), `Mode`, ghế random cho
  người chơi đơn, agent theo ghế, **game loop mới**: mọi mutate + broadcast dưới `gs.mu`, AI nghĩ trên bản clone ở goroutine
  riêng, bỏ kết quả cũ theo `stepSeq`, huỷ search khi `Close`/người đi, event lưu ngoài lock từ bản clone.
- `session.go`: bỏ `Engine`; `handlePlayerAction` không giữ RLock khi gửi action; `findAvailablePlayerID` không giao ghế AI
  cho người; state thêm `aiLevel`, `mode`, `turnTimeout`, `golemsToEnd`, `coalition`, `aiThinking`, `placeCrystals`; phòng chờ
  hiện dòng AI; AI không còn "(offline)".
- `server`: runtime AI dùng chung, `CreateSinglePlayerSession`, `/api/single` nhận `difficulty`/`aiLevels`, ID tự đặt bị ép
  `single_`; `/api/events`, `/api/snapshot` ẩn thứ tự deck của ván đang chơi. `config.go`: biến `AI_*`.
- Test mới: `session/ai_session_test.go` (7), `server/single_ai_test.go`.

### 0002 (f) UI AI 4 mức (2026-11-14)
- `SinglePlayerLobby.jsx`: chọn độ khó (XP list + badge, mặc định Medium, nhớ trong localStorage, ghi chú liên minh ở
  Very Hard), gửi `difficulty`. `XpWaitingRoom.jsx`: dòng AI kèm mức, sửa key trùng.
- Bàn chơi (style upstream): `AiLevelBadge.jsx`, `AiThinkingIndicator.jsx` trong `PlayerCard`, `PlayersInfoBar`,
  `FantasyGameLayout`, `GameOverModal`, `WebGameLayout`; AI không hiện "(offline)"; timer đọc `turnTimeout` từ server.
- `gameStore.js`: xử lý `aiThinking`, `aiIntent` (toast 🤖 4.5 s), `turnTimeout`. `Toast.jsx`: loại `ai`.
- Giá market theo luật chính thức ("đặt k× crystal bất kỳ") ở `WebGameLayout`, `CompactGameBoard`, `FantasyMarketArea`,
  `CompactCard`; GameOver ghi chú thắng hoà do đi sau. `utils/aiLevel.js` (+ test), `utils/avatar.js` dùng `aiIndex`.
- Test mới: `utils/aiLevel.test.js`, `components/__tests__/SinglePlayerLobby.test.jsx`.

## 2. Asset — sinh bởi script
| Thứ | Script | Chi tiết |
|---|---|---|
| `web/static/images/avatar/1..15.webp` | `deploy/make-avatars.py` | từ `assets-src/smb-enemies-sheet.png` (NES Super Mario Bros. enemies, sheet by SuperJustinBros). 512×512, nền trời SMB, phóng to bội số nguyên, sprite ≤68% để khung tròn không cắt |
| metadata mọi PNG/JPEG | `deploy/strip-image-metadata.py` | bỏ chunk/segment metadata, điểm ảnh giữ nguyên (đã so pixel) |

Avatar: 1 Goomba · 2 Koopa Troopa · 3 Lakitu · 4 Bowser · 5 Hammer Bro · 6 Red Koopa · 7 Paratroopa ·
8 Red Paratroopa · 9 Piranha Plant · 10 Buzzy Beetle · 11 Blooper · 12 Bullet Bill · 13 Cheep Cheep · 14 Spiny · 15 Podoboo.

## 3. File gỡ khỏi cây (xem privacy.md)
`.env.example`, `web/react-frontend/.env.local`, `web/react-frontend/.env.production`, `ansible/inventory.ini`.

## 4. Không sửa trong src, thay bằng cấu hình deploy riêng (`deploy/`)
- `docker-compose.yml` upstream (truyền `${TELEGRAM_*}`, publish mongo/redis) → không dùng; dùng `deploy/docker-compose.yml`.
- `Dockerfile.frontend` upstream (base `/apps/golem/`, API `game.anhtran.dev`) → `deploy/Dockerfile.web`.
- `Dockerfile` upstream (ép `GOARCH=amd64`, hỏng trên arm64) → `deploy/Dockerfile.server` (build theo kiến trúc máy build).
- k8s/ansible/Jenkins/GitHub Actions (`deployment/`, `ansible/`, `scripts/`, `.github/`) → bỏ qua.

## Test
- Frontend (vitest, chạy trong `node:18-alpine` trên bản sao có `node_modules`): cấu hình vitest upstream không bật DOM
  (khoá `vitest.environment` trong package.json không có tác dụng) ⇒ chạy `vitest run --environment jsdom`. Khi đó upstream
  12 pass / 2 fail (useGameSounds) + 2 file không chạy (cardNames, sounds); bản này **giống hệt phần lỗi**, 17 pass
  (thêm 5 test avatar).
- Backend (`go test -race ./internal/...` trong `golang:1.24`): `auth`, `eventstore`, `game`, `server`, `telegram` pass.
  `session` **fail sẵn ở upstream** (10 test, 25 data race, panic "send on closed channel" tại `sendToPlayer` khi
  test gỡ người chơi trong lúc broadcast — xem "Lỗi upstream đã biết" trong CLAUDE.md); sau patch 0003: 7 fail, 22 race,
  panic đó vẫn còn (không thuộc phần đã sửa).

### Số liệu test sau AI (2026-11-14)
- Frontend: 22 pass (thêm 5: aiLevel + SinglePlayerLobby), phần lỗi giữ nguyên như upstream (2 fail useGameSounds,
  2 file không chạy).
- Backend: `game` (gồm fuzz 2000 ván), `ai`, `ai/sim` (differential 2000 ván), `server`, `auth`, `eventstore`, `telegram`
  pass với `-race`. `session`: baseline trước khi sửa (M0) **11 fail / 31 race**; sau: **10 fail / 17–28 race** (3 lần chạy;
  suite vốn flaky), 7 test AI mới luôn pass.

## Sau khi sửa code
```bash
cd /home/nghia/ai/rename-game/deploy
./regen-patches.sh            # sinh lại 0002/0003 từ src/golem + kiểm REPRODUCIBLE (0001 giữ nguyên)
```
Thêm loại thay đổi mới (ngoài `web/react-frontend/src` và `internal/`) ⇒ thêm một dòng `diff_tree` trong script.
