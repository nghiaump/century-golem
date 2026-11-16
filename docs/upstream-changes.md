# Thay đổi so với mã upstream

Upstream: `golem.zip` (2026-10-07, commit `fec8db3 add staging env`, repo gốc `github.com/vietky/golem`).
Mọi thay đổi được tái lập tự động: `deploy/sanitize-src.sh` trên bản giải nén mới của `golem.zip` cho ra cây
**giống từng byte** với `src/golem` đang deploy (trừ `.git`). `deploy/regen-patches.sh` sinh lại patch + kiểm điều này.

## 1. Patch code — `deploy/patches/` (áp theo thứ tự tên)
| Patch | Phạm vi | Nội dung |
|---|---|---|
| `0001-auth-disabled-when-backend-404.patch` | `contexts/AuthContext.jsx` | `setAuthAvailable(false)` khi `/auth/profile` 404 — bug upstream: auth tắt mà Lobby vẫn đòi "Sign in with Google" |
| `0002-frontend.patch` (đổi tên 2026-11-14, trước là `0002-frontend-xp-theme-smb-avatars.patch`) | `web/react-frontend/src` + `index.html` + `tailwind.config.js` | (b) avatar trong màn chơi, (e) sửa link `/room/:id`, (f) UI AI 4 mức, **(g) giao diện "Đá & Pha lê" (2026-11-16; thay (a) avatar SMB và (c) theme XP)** — chi tiết bên dưới. File nhị phân (font, avatar) không ở trong patch: `sanitize-src.sh` chép từ `assets-src/` |
| `0003-backend.patch` (đổi tên 2026-11-14, trước là `0003-backend-idle-room-cleanup.patch`) | 47 file `internal/` | dọn phòng ma, đóng phòng an toàn, trần số phòng, ẩn ván chơi đơn; **luật chính thức + engine Validate/Step**; **AI 4 mức** (`internal/ai`); **game loop có khoá** — chi tiết bên dưới |

Tên patch theo **phạm vi thư mục** (không theo tính năng) để không lỗi thời. Đổi tên phải `git mv` và xoá file cũ
(`sanitize-src.sh` áp mọi `patches/*.patch`).

### 0002 (a) Avatar SMB ở màn khởi tạo — *đã thay bởi (g) ngày 2026-11-16*
- `utils/avatar.js` (mới): `AVATAR_IDS` (15), `avatarSrc(id)` có `?v=AVATAR_VERSION` (vượt cache 7 ngày).
- `Lobby.jsx` (create/join room), `SinglePlayerLobby.jsx`: lưới chọn 3×5. `OpponentArea.jsx` (code chết) cũng dùng `avatarSrc`.

### 0002 (b) Avatar trong màn chơi
- `components/PlayerAvatar.jsx` (mới): ảnh avatar, fallback chữ cái đầu khi lỗi; tự tra người chơi trong store.
- `resolveAvatarId(player, players)` trong `utils/avatar.js`: người thật = avatar đã chọn; AI (server gán avatar =
  player ID nên dễ trùng) lấy lần lượt avatar chưa ai chọn theo thứ tự ghế — tất định, mọi client thấy giống nhau.
- Thay chữ cái đầu / 🤖 ở: `PlayersInfoBar.jsx`, `PlayerCard.jsx`, `desktop/WebGameLayout.jsx`,
  `desktop/FantasyGameLayout.jsx`, `mobile/CompactPlayerHand.jsx` (2 chỗ), thêm avatar vào `GameOverModal.jsx`.
- Test: `utils/avatar.test.js` (5 test, vitest).

### 0002 (c) Theme Windows XP × brutalism (chỉ các màn trước khi vào ván) — *đã bỏ ngày 2026-11-16, xem (g)*
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
  rival — bản liên minh ban đầu đã bỏ, xem bên dưới), MCTS open-loop ensemble, mô hình đối thủ, intent, scheduler luồng toàn server, profile theo cấp.
- `ai/arena` + `ai/arena/aibench` (CLI benchmark/giải đấu, không build vào image). Chi tiết: `docs/ai/`.

### 0003 Session / server cho AI (2026-11-14)
- `session/ai_turns.go` (mới): options (`WithSinglePlayer`, `WithAIRuntime`, `WithAgentFactory`), `Mode`, ghế random cho
  người chơi đơn, agent theo ghế, **game loop mới**: mọi mutate + broadcast dưới `gs.mu`, AI nghĩ trên bản clone ở goroutine
  riêng, bỏ kết quả cũ theo `stepSeq`, huỷ search khi `Close`/người đi, event lưu ngoài lock từ bản clone.
- `session.go`: bỏ `Engine`; `handlePlayerAction` không giữ RLock khi gửi action; `findAvailablePlayerID` không giao ghế AI
  cho người; state thêm `aiLevel`, `mode`, `turnTimeout`, `golemsToEnd`, `aiThinking`, `placeCrystals`; phòng chờ
  hiện dòng AI; AI không còn "(offline)".
- `server`: runtime AI dùng chung, `CreateSinglePlayerSession`, `/api/single` nhận `difficulty`/`aiLevels`, ID tự đặt bị ép
  `single_`; `/api/events`, `/api/snapshot` ẩn thứ tự deck của ván đang chơi. `config.go`: biến `AI_*`.
- Test mới: `session/ai_session_test.go` (7), `server/single_ai_test.go`.

### Very Hard: bỏ liên minh, thành đối thủ cạnh tranh (2026-11-15, ADR 0008, theo phản hồi người dùng)
- `ai/utility.go`: `UtilityCoalition` → `UtilityRival` (mỗi AI tự chơi để thắng; người được tính mạnh hơn 3 điểm giữa ván,
  1 điểm cuối ván; trừ 0.7·đối thủ mạnh nhất + 0.3·trung bình ⇒ "biếu" ai cũng thiệt). `immediateWin` chỉ tính AI tự thắng;
  denial prior VH = người dẫn đầu + người đang bám sát; bỏ intent `sacrifice`.
- `DecideOptions.Teams []int` → `Humans []bool` (session `gs.humans`, arena `PlayGame(..., humans)`); bỏ field `coalition`
  ở response `/api/single`, state ván và state phòng chờ; `aibench coalition` → `aibench vshuman`; smoke-test kiểm `aiLevels`.
- Test mới `ai/utility_test.go` (biếu AI khác bị trừ, chặn người được ưu tiên, thứ tự thắng/thua cuối ván).
- Sửa đổi cùng ngày (ADR 0008, sửa đổi 2): người chơi chỉ **phân định khi ngang nhau** (`humanTieMid = 1`,
  `humanTieTerminal = 0.25`); denial prior chỉ nhắm một ghế (`perspective.mainRival`). Test
  `TestRivalUtility_PersonIsMainRivalOnlyOnATie`, `TestPerspective_MainRival`. Người proxy vs 3 VH: 24% (trước 21%).

### Rút lại nước chơi lá làm tràn crystal (2026-11-15, theo yêu cầu người dùng)
Chọn nhầm hệ số trade (x3 thay vì x2, vẫn hợp lệ) làm vượt 10 crystal thì upstream chuyển thẳng sang popup "Too Many
Crystals!" và không quay lại được.
- Backend `session/undo.go`: khi **người** chơi lá (produce/upgrade/trade) mà phải discard, session giữ crystal + tay bài +
  lá đã chơi của trước nước đó. Trước khi discard, action `undo` khôi phục đúng trạng thái cũ (nước chơi lá không đổi gì
  khác: không refill market, chưa hết lượt). Mua bài làm tràn thì **không** cho undo (đã lật lá mới từ deck). Bất kỳ step nào
  sau đó (discard, timeout) làm mất quyền undo (`stepSeq`). Event log ghi `type -2`. State có `players[].canUndo`.
- Frontend: nút "↩ Undo — take the card back" trong `DiscardModal.jsx` (chỉ hiện khi `canUndo`); `gameStore.undoPlay`, lưu
  `lastPlay`; `utils/undo.js` (`resolveUndo`) bỏ nước đó khỏi lịch sử và mở lại popup chọn hệ số/upgrade qua
  `hooks/useReopenAfterUndo.js` (desktop, mobile, fantasy).
- Test: `session/undo_test.go`, `utils/undo.test.js`, `components/__tests__/DiscardModal.test.jsx`.

### Avatar & tên AI (2026-11-14, theo yêu cầu người dùng — *avatar thay bằng 24 golem ngày 2026-11-16, xem (g)*)
- 23 avatar: 12 nhân vật khác nhau + tối đa 1 biến thể mỗi nhân vật (trước: 15, trong đó 4 biến thể Koopa). `AVATAR_VERSION`
  = `smb2`. Server chọn avatar AI ngẫu nhiên (không trùng nhau/người chơi) và đặt tên AI theo nhân vật; `PlayerAvatar` không
  tra người chơi theo `id 0` nữa (phòng chờ: mọi AI từng hiện avatar của người chơi).
- Toast ý đồ AI (`aiIntent`) **tắt mặc định** (`AI_INTENT_MESSAGES=0`) — người dùng thấy thông báo quá tường minh.

### 0002 (f) UI AI 4 mức (2026-11-14)
- `SinglePlayerLobby.jsx`: chọn độ khó (nhớ trong localStorage; giao diện xem (g)), gửi `difficulty`. Mặc định
  **3 AI, Very Hard** (2026-11-16, ý người dùng; trước: 1 AI, Medium — API `/api/single` vẫn mặc định `medium`). `XpWaitingRoom.jsx`: dòng AI kèm mức, sửa key trùng.
- Bàn chơi (style upstream): **một** badge độ khó `DifficultyBadge.jsx` dưới nút ✨ (góc trái; 2026-11-15 thay cho badge
  trong từng ô người chơi — người dùng thấy thừa và che tên); `AiThinkingIndicator.jsx` ở thanh bài (desktop) / thanh người
  chơi (mobile); ô người chơi desktop: avatar cao bằng 2 hàng (tên + crystal); AI không hiện "(offline)"; timer đọc
  `turnTimeout` từ server.
- `gameStore.js`: xử lý `aiThinking`, `aiIntent` (toast 🤖 4.5 s), `turnTimeout`. `Toast.jsx`: loại `ai`.
- Giá market theo luật chính thức ("đặt k× crystal bất kỳ") ở `WebGameLayout`, `CompactGameBoard`, `FantasyMarketArea`,
  `CompactCard`; GameOver ghi chú thắng hoà do đi sau. `utils/aiLevel.js` (+ test), `utils/avatar.js` dùng `aiIndex`.
- Test mới: `utils/aiLevel.test.js`, `components/__tests__/SinglePlayerLobby.test.jsx`, `utils/rest.test.js`,
  `components/__tests__/RestPopup.test.jsx`.
- Màn kết thúc (2026-11-15): **Play Again** không còn reload trang (reload ở URL `/room/<id>` mở nhầm lobby Multiplayer):
  ván 1 người ⇒ tạo ngay ván mới cùng số AI + mức + tên + avatar (vào phòng chờ); nhiều người ⇒ về lobby Multiplayer;
  **Back to Menu** ⇒ màn chính. `gameStore.leaveGame()` đóng WS bình thường (gỡ handler trước để onclose muộn không xoá
  kết nối mới) và xoá state; `connectWebSocket` lưu tên/avatar (upstream không lưu ⇒ Retry Connection dùng tên rỗng);
  phòng vừa rời không bị hiểu nhầm là link mời.
- Popup Rest của đối thủ (2026-11-15, theo phản hồi người dùng "AI ra bài liên tục không rest"; số liệu thật: AI Rest
  10.7% số lượt, người chơi 8.2%): upstream tắt overlay lá bài (`AcquiredCardOverlay` trả `null`), còn Rest không có lá,
  nên Rest của đối thủ chỉ là một dòng trong lịch sử. Ô History lại hiện lá mới nhất trong 4 nước gần nhất, nên Rest bị
  lá cũ che. Sửa: `RestPopup.jsx` ("💤 <tên> rested · took back N cards", ~2 s, kèm âm thanh rest), state
  `restPopup`/`showRestPopup` trong `gameStore.js`, `utils/rest.js` (`restedCards`, + test), gắn ở cả 2 theme trong
  `SinglePlayerApp.jsx`. `HistorySection.jsx` hiện đúng nước mới nhất (Rest ⇒ 💤).
- 2026-11-16 (phản hồi người dùng):
  - Desktop: popup Rest bật ra **ngay dưới avatar** người vừa Rest, có mũi nhọn chỉ lên (trước: giữa màn hình, dễ nhầm ai
    Rest). `PlayerAvatar` nhận `restAnchor` ⇒ `data-rest-anchor=<id>` (bật ở `PlayerCard` và dock đối thủ của skin ✨);
    `utils/rest.js` `restAnchorPosition` đo vị trí, giữ popup trong cửa sổ. Không thấy avatar (mobile) ⇒ vẫn ở giữa.
  - Âm thanh khi **mình** Rest: upstream coi tay bài tăng là "mua lá" nên phát cả `acquireMerchant` lẫn `rest`. Giờ chỉ
    phát `rest` (giống Rest của đối thủ); `useGameSounds.js` chỉ phát âm mua lá khi tay tăng mà số lá đã chơi không đổi
    (Rest/Undo đều lấy lá từ đống đã chơi). `restedCards` không coi Undo (đang chờ discard) là Rest.

### 0002 (g) Giao diện thống nhất "Đá & Pha lê" (2026-11-16, ADR 0009, theo yêu cầu người dùng)
Chi tiết: [`ui/thiet-ke-giao-dien.md`](ui/thiet-ke-giao-dien.md). Tóm tắt thay đổi:
- **Nền tảng**: `styles/tokens.css` (màu dạng kênh RGB, bo góc, bevel, glow, safe-area), `styles/fonts.css` (Cinzel + Be Vietnam Pro,
  OFL, tự phục vụ), `tailwind.config.js` (map token, `fontFamily`, thang z-index `board…system`), `index.css` (nền đêm, lớp
  `surface-*`, `turn-glow`, focus ring, reduced-motion; bỏ 'Inter' chưa từng nạp, ảnh nền, `--golem-*`, z-index tự chế, rule
  `!important` tắt transition, rule ép mọi nút 44px), `index.html` (`viewport-fit=cover`, `theme-color`), `main.jsx` (`MotionConfig
  reducedMotion="user"`, gallery dev `?gallery`).
- **Primitive** `components/ui/*` (Panel, Button/IconButton, Modal, Pill, Gem, CrystalRow/CrystalCost, Coin, GolemIcon, Avatar,
  TurnBanner, Field, Segmented, AvatarPicker, Stepper, CardImage, GemLoader, NightBackdrop) + `LevelPill`, `utils/crystals.js`.
- **Bỏ XP**: xoá `theme-xp.css`, `XpWindow.jsx`, `XpWaitingRoom.jsx` (file do patch 0002 tạo); màn khởi tạo mới `components/start/*`
  (StartShell, Wordmark, ModeMenu, ConnectionDialog, ReconnectBanner), `WaitingRoom.jsx`; viết lại `SinglePlayerLobby.jsx`,
  `Lobby.jsx` (giữ `name`/`value` radio cho test), `alert()` → toast. Mất kết nối giữa ván: giữ bàn chơi (inert) + banner.
- **Popup**: Trade, Upgrade (chạm crystal để nâng 1 cấp), Deposit (chọn sẵn crystal rẻ nhất), Discard (chọn sẵn rẻ nhất, Undo),
  ConfirmGolem (thêm coin), GameOver (bảng điểm; sửa: người thắng hiện tổng điểm có coin/crystal, confetti hết hạn trước khi ván
  xong, random lại mỗi render) — đều dựng trên `Modal`; Trade/Deposit cảnh báo trước khi vượt 10 crystal.
- **Bàn chơi desktop**: `hooks/useBoardActions` + `components/board/{BoardModals,CardTile,CardInspect,CardPile,Hud}`,
  `useTurnTimer`; viết lại `WebGameLayout`, `PlayerCard` (★ điểm, vòng giờ), `HistorySection`, `GraveyardPanel` (→ "Played"),
  `MyGolemsPanel`, `CollapsibleInfo` (ngăn đá, xoá có bước xác nhận), `Toast` (giữa-trên, không `alert`), `RestPopup` (bong bóng
  đá), `AiThinkingIndicator`, `SoundToggleButton`, `ThemeToggleButton`, `DifficultyBadge`, `RoomDisplay`.
- **Điện thoại**: viết lại `PlayersInfoBar`, `mobile/CompactGameBoard`, `mobile/CompactPlayerHand`; `board/CardSheet` (chạm lá ⇒ xem +
  hành động); `useOrientation.isCompact` (cầm ngang thấp ⇒ bố cục điện thoại, cột phải); safe-area; `useReopenAfterUndo(open, enabled)`.
- **Skin ✨**: dock đá, popup chung, lưng bài `golem_bg.JPG`/`merchant_bg.JPG` (trước trỏ `golem_0/card_0` không tồn tại), dải lượt
  + Rest trên bàn, crystal/coin vẽ bằng SVG; chỉ desktop.
- **Avatar** 24 golem tự vẽ (`deploy/make-golem-avatars.py` → `assets-src/avatars/`), `utils/avatar.js` (`AVATAR_NAMES`, `.svg`,
  `AVATAR_VERSION='golem1'`), `internal/session/ai_turns.go` `avatarNames` (+ test `avatar_names_test.go` so khớp frontend).
- **Hạ tầng**: `regen-patches.sh` nối diff `index.html` + `tailwind.config.js` vào 0002 và loại `fonts/`; `sanitize-src.sh` bước 3 (avatar
  golem) + bước 5 (font); `ui-shots.mjs`; `smoke-test.sh` kiểm `avatar/1.svg?v=golem1`; `privacy-audit.sh` kiểm mọi file avatar.
- Phát hiện khi làm: server gửi `deposits` của lá market dạng chuỗi (`ToMap`) ⇒ frontend luôn ép số (`utils/crystals.js`).

### Avatar ảnh riêng (2026-11-16, theo yêu cầu người dùng: ≤ 5 MB, thu gọn, không lưu sau phiên)
- Backend: package mới `internal/avatars` (giải mã JPEG/PNG ≤ 2048px, cắt vuông giữa, thu ≤ 256px bằng lọc trung bình vùng, mã hoá lại
  JPEG q85 ⇒ mất metadata; RAM, gắn theo phòng, xoá khi phòng bị dọn / 15 phút nếu không vào phòng, trần 400 ảnh / 24 MB; HTTP
  `POST /api/avatars`, `GET /api/avatars/<id>.jpg`); `server/cors.go` định tuyến (không sửa `cmd/`), `handlers.go` `Attach` khi vào phòng,
  `server.go` `ReleaseSession` khi dọn phòng. Test: `internal/avatars/avatars_test.go`, `internal/server/avatar_cleanup_test.go`.
- Frontend: `utils/customAvatar.js` (+ test), `components/AvatarCropper.jsx`, ô Upload trong `ui/AvatarPicker.jsx`, `utils/avatar.js`
  (`isCustomAvatar`, `avatarSrc` cho `u_…`, giá trị lạ ⇒ golem 1); `SinglePlayerLobby`/`Lobby`/Play Again tải ảnh lên trước khi tạo/vào ván.

## 2. Asset — sinh bởi script
| Thứ | Script | Chi tiết |
|---|---|---|
| `web/static/images/avatar/1..24.svg` | `deploy/make-golem-avatars.py` | 24 golem **tự vẽ** (stdlib, tất định) → `assets-src/avatars/`; `sanitize-src.sh` xoá avatar cũ (kể cả ảnh người thật upstream) rồi chép vào |
| `web/react-frontend/src/assets/fonts/*.woff2` + OFL | (`npm pack @fontsource/…` một lần) | `assets-src/fonts/` (README: version + sha256) → `sanitize-src.sh` bước 5 |
| metadata mọi PNG/JPEG | `deploy/strip-image-metadata.py` | bỏ chunk/segment metadata, điểm ảnh giữ nguyên (đã so pixel) |

Avatar: 1 Basalt · 2 Mossback · 3 Rime · 4 Cinder · 5 Rivet · 6 Dune · 7 Quartz · 8 Terra · 9 Onyx · 10 Rootling · 11 Reef ·
12 Nimbus · 13 Granite · 14 Fernhide · 15 Glacier · 16 Magma · 17 Anvil · 18 Mesa · 19 Amethyst · 20 Kiln · 21 Jet · 22 Thornbark ·
23 Coralline · 24 Squall (trước 2026-11-16: 23 sprite Super Mario Bros.).

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
  12 pass / 2 fail (useGameSounds) + 2 file không chạy (cardNames, sounds); bản này **giống hệt phần lỗi**, 50 pass
  (2026-11-16 sau giao diện mới; thêm test avatar, aiLevel, lobby, rest, RestPopup, undo, DiscardModal, crystals,
  `hooks/__tests__/useGameSounds.rest.test.jsx`). Kiểm giao diện thật: `deploy/ui-shots.mjs` (6 viewport, sạch).
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
