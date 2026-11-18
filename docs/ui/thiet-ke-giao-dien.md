# Thiết kế giao diện "Đá & Pha lê" — chi tiết

> Tổng quan (EN): [`README.md`](README.md) · Quyết định: [ADR 0009](../adr/0009-giao-dien-da-va-pha-le.md) ·
> Plan + revision log: [`../plans/2026-11-16-golem-ui.md`](../plans/2026-11-16-golem-ui.md)
> Mã: `src/golem/web/react-frontend/src/{styles,components/ui,components/board,components/start,components/mobile,components/desktop,hooks}`

## 1. Nguyên tắc
- **Một** ngôn ngữ thiết kế cho mọi màn (không còn XP, kính mờ, popup trắng viền màu…). Nguyên bản, chỉ lấy cảm hứng không khí
  Golem Edition (núi, đá, pha lê); ảnh lá bài giữ nguyên, **không** chép logo/trade dress của nhà phát hành.
- Dựng màn hình **chỉ** từ token + primitive. Thiếu thứ gì ⇒ thêm primitive mới vào `components/ui`, không viết style lẻ.
- Truy cập: không thông tin nào chỉ bằng màu; chữ ≥ 12px; nút ≥ 44px trên điện thoại; focus ring cho bàn phím; Escape đóng popup
  (trừ Discard); giảm chuyển động khi hệ điều hành yêu cầu.

## 2. Token (`src/styles/tokens.css`)
Màu lưu dạng kênh RGB (`--rock-800: 42 47 69`) để Tailwind dùng độ mờ (`bg-rock-800/80`); map trong `tailwind.config.js`.

| Nhóm | Token | Dùng cho |
|---|---|---|
| Đá | `rock-950…200` (`#12131c` → `#c9cbd8`) | nền, panel, khay lõm |
| Đồng | `bronze-700/500/300/100` | viền, nút chính, lượt hiện tại; **bronze-500 chỉ cho viền/chữ lớn**, chữ nhỏ dùng bronze-300 |
| Giấy da | `parch-100/200/400`, `ink`, `ink-muted` | popup |
| Chữ trên đá | `fg`, `fg-muted` | |
| Trạng thái | `ember` (lỗi/nguy hiểm), `moss` (ổn/✓), `teal` (thông tin) | |
| Crystal | `gem-{yellow,green,blue,pink}` + `-light`/`-dark` | `Gem`, nền núi |
| Đồng xu | `coin-copper`, `coin-silver` (+ `-dark`) | `Coin` |
| Hình khối | `--r-sm/md/lg` (6/10/14px) · `--bevel` · `--elev-1/2` · `--glow-turn` | `rounded-stone*`, `shadow-bevel/elev-*/turn` |
| An toàn | `--safe-top/bottom/left/right` | tai thỏ, thanh home |

Cỡ chữ = thang mặc định Tailwind (12/14/16/18/20/24/30). **z-index** chỉ theo thang: `z-board` 10 · `z-hud` 20 · `z-drawer` 30 ·
`z-banner` 40 · `z-overlay` 50 · `z-popover` 60 · `z-modal` 70 · `z-toast` 80 · `z-system` 90.

Bề mặt (`index.css`, lớp `surface-*`): `surface-stone` (gradient đá + hạt nhiễu SVG nội tuyến + viền đồng + bevel),
`surface-inset` (khay lõm), `surface-parchment` (giấy da + viền đồng trong). `text-engrave` cho tiêu đề Cinzel; `turn-glow`
(viền sáng nhấp nháy bằng opacity của `::after` — rẻ hơn animate box-shadow). Không `backdrop-filter` (máy yếu).

## 3. Font
`assets-src/fonts/` (OFL, README có version + sha256) → `sanitize-src.sh` chép vào `src/assets/fonts/` → `src/styles/fonts.css`
(`@font-face` theo subset + `unicode-range`, `font-display: swap`; Vite băm tên file khi build).
- **Cinzel 600/700** (`font-display`): chỉ chữ tiếng Anh **tĩnh** — tiêu đề, header panel, nhãn nút. Không có dấu tiếng Việt.
- **Be Vietnam Pro 400/600/700** (`font-sans`, mặc định toàn trang): mọi chữ còn lại, kể cả tên người chơi.

## 4. Primitive (`components/ui`)
| Component | Ghi chú |
|---|---|
| `Panel` | `variant` stone / inset / parchment, `title` khắc, `actions`, `glow` (lượt của chủ panel) |
| `Button`, `IconButton` | primary (đồng) · secondary (đá) · danger · ghost · outline (trên giấy da); size sm 36px (chỉ desktop) / md 44px / lg 52px; IconButton cần `label` |
| `Modal` | portal; `title`, `icon`, `footer`; Close `aria-label="Close"`; `dismissible={false}` (Discard, GameOver); Escape + bấm nền để đóng; focus vào dialog, Tab quẩn trong, trả focus khi đóng; khoá cuộn; **< 768px = bottom sheet** có safe-area; `onClose` giữ trong ref |
| `Gem` | SVG mặt cắt phẳng, hình theo màu ▲◆⬟⬢ (số cạnh − 2 = cấp), viền tối đọc được trên đá lẫn giấy da; `label={false}` khi đứng cạnh số |
| `CrystalRow` / `CrystalCost` | hàng crystal của người chơi (số 0 mờ, tuỳ chọn `capacity` "7/10", đỏ khi vượt) / giá, vế trade (lặp gem, > 5 thì "gem ×n"); ép số (server có chỗ gửi chuỗi) |
| `Coin`, `GolemIcon` | đồng 3 điểm / bạc 1 điểm; đầu golem thay emoji 🗿/🎭 |
| `Avatar` | bọc `PlayerAvatar`; vòng đồng; `turn` = viền sáng; `timer={remaining,total}` = vòng đếm giờ (xanh → đồng → đỏ nhấp nháy); `restAnchor` cho popup Rest |
| `TurnBanner` | ruy băng "Your turn" + số giây (đỏ đậm ≤ 10s), `aria-live` |
| `Field`, `Segmented`, `AvatarPicker`, `Stepper` | form: ô nhập trên đá; nhóm radio thật (ẩn) vẽ thành ô đá; lưới avatar có tên golem; − giá trị + với nút 44px |
| `CardImage`, `GemLoader`, `NightBackdrop`, `Pill` (+ `pips`) | ảnh lá (sprite hoặc ảnh lẻ); 4 gem nhấp nháy; nền núi đêm SVG tất định; nhãn nhỏ, độ khó thêm 1–4 chấm |

`LevelPill` (`components/LevelPill.jsx`) = độ khó AI dạng Pill (`utils/aiLevel.js`: `tone` + `pips`).

## 5. Màn hình
- **Khởi tạo** (`components/start`): `StartShell` (nền núi + wordmark "Century · Golem Edition" + một panel đá; thanh nút dính đáy),
  `ModeMenu`, `ConnectionDialog` (chỉ khi chưa có state ván), `ReconnectBanner` (mất kết nối giữa ván: bàn chơi giữ nguyên, `inert`,
  phủ tối; Retry sau 2 lần thử/lỗi, Back to Menu sau 3). `SinglePlayerLobby` (mặc định 3 AI · Very Hard), `Lobby` (tab Create/Join,
  danh sách phòng, join theo ID), `WaitingRoom`.
- **HUD** (`board/Hud`: `RoundInfo` + `HudButtons`): bàn chơi desktop đặt chúng **trên thanh tiêu đề Market** (nút 36px) để hàng
  người chơi bắt đầu sát mép trên, không chừa dải trống (2026-11-16, ý người dùng); skin ✨ và phòng chờ dùng bản nổi ở
  góc: trái "Round N · độ khó · Last round", phải ✨ (desktop) · âm thanh · Activity; điện thoại trong ván dùng `PhoneTopBar` (dưới)
  (`CollapsibleInfo`: ngăn đá phải 420px / bottom sheet trên điện thoại; chat; xoá có bước xác nhận trong trang). `Toast` giữa-trên
  dưới HUD, tối đa 3, không còn `alert()`.
- **Desktop** (`desktop/WebGameLayout`, ≥ 768px rộng và ≥ 500px cao khi ngang): hàng người chơi (`PlayerCard`, rộng tới 21rem, avatar
  68px — 56px dưới 1280px: tên · golem · ★ điểm = golem + coin, hàng crystal, "n in hand · n played", vòng giờ người, AI đang nghĩ, offline), panel Market 6 lá + Golems 5 lá (`CardTile`), hàng dưới History · Played · tay bài
  (ruy băng lượt + Rest luôn hiện, mờ kèm gợi ý khi chưa chơi lá nào) · My Golems (`CardPile` → popup danh sách).
- **Điện thoại** (`mobile/PhoneShell`, làm lại 2026-11-17 sau góp ý "iPhone 15 Pro rất xấu"): **cả ván trong một màn, không cuộn** —
  Safari trên iPhone chỉ còn ~393×659px (thanh địa chỉ), bản cũ để tay bài đáy che gần hết Market. Dọc: `PhoneTopBar` (R n · ruy băng
  "Your turn n s" / "<AI> is thinking" · âm thanh · Activity, nằm trong luồng trang) · `PlayersInfoBar` = **mọi người chơi, kể cả mình, theo thứ tự lượt
  trong round** (2026-11-18, góp ý: không biết ai đi đầu / cuối round, mình ở lượt mấy): trái → phải = thứ tự ghế (`players[0]` mở
  round, người cuối đóng round) — không ghi số lên chân dung (người dùng: thứ tự ô đã đủ, số thừa); chip của mình viền đồng; round
  cuối: ai đã đi lượt cuối thì chip mờ ("done for the game"). Màn dọc: **chân dung ở giữa, trên cùng, to nhất có thể** (66px khi chip
  ≥ 112px, còn lại 55px, không quá bề ngang chip − 10px), bên dưới: tên (khi chip ≥ 80px) · ★ golem · lá tay / đã chơi (một dòng khi
  ≥ 108px) · crystal (2×2 khi < 80px); chip cao 118–127px (người dùng chấp nhận chip dài xuống vì còn chỗ trên hàng golem). Đo bề ngang
  bằng `useElementSize`, kiểu chip theo `chipLayout`; < 58px thì cuộn ngang (5 người trên máy 320px). Cầm ngang giữ bản gọn cũ (chân dung
  34/28px cạnh số liệu; cột phải thấp, to hơn thì bóp mất tay bài khi 5 người), 5 người xếp 3+2. Chân dung `Avatar fit` — ảnh sát
  viền 2px, chính viền đó nhấp nháy / chạy giờ · golem 5 lá
  1 hàng + Market 6 lá **luôn 1 hàng gọn** (2026-11-18: người dùng muốn lá merchant nhỏ lại để có chỗ; chỗ dư dồn cho lá trên tay, tối đa 140px) · tay bài (1 hàng: crystal x/10 · golem+★ của mình · Rest · đã chơi; dưới là lá
  vuốt ngang). **Cỡ lá tính theo chỗ thật** (`utils/phoneLayout.planPhoneBoard`, đo vùng bàn bằng ResizeObserver; vùng bàn + hàng lá
  trên tay chia nhau phần cao còn lại; mỗi hàng bị giới hạn bởi chiều ngang). Chỉ **tay bài của mình** được cuộn (ngang) — mọi thứ khác
  đứng yên trên một màn để nắm trạng thái ván ngay. **Chiều cao = phần thật sự nhìn thấy** (`hooks/useVisibleHeight`: nhỏ nhất của
  `innerHeight`, `visualViewport.height`, `100svh`; khung `position: fixed`, `html.phone-lock` khoá cuộn trang) — Safari iOS 26 có thanh
  công cụ nổi đè lên trang mà `100dvh`/`safe-area-inset-bottom` vẫn tính cả dải dưới nó (2026-11-18: trên iPhone 15 Pro tay bài bị che
  nửa, trang phải cuộn). Mở site với `?vp` để hiện ô số đo (innerHeight, visualViewport, svh, safe-area) khi cần kiểm máy thật. Lá trên điện thoại không hiện số
  ô (che phần hiệu ứng in trên lá). Ngang (cao < 500px): trái = top bar + bàn, phải (≥ 296px) = đối thủ + tay bài. Chừa tai thỏ/Dynamic
  Island/thanh home bằng `--safe-*`. < 360px rộng: hàng nút tay bài xuống dòng, crystal nhỏ hơn dưới 385px. Phòng chờ: HUD nổi + phòng ở
  giữa. **Chạm lá ⇒ `CardSheet`** (ảnh lớn 128×221, mô tả, nút Take / Place n & take / Claim / Play hoặc lý do không được).
  **Nước đi của đối thủ** (2026-11-18, góp ý "trên mobile không thấy lịch sử các lá vừa chơi của người khác"; không lấy thêm chỗ của bàn):
  khi người khác chơi / lấy / claim một lá, lá đó hiện ~3 s ngay dưới chip của họ kèm "played" / "took" / "claimed"
  (`mobile/MoveBubbles`: chỉ lá 49×84px trong viền đồng 2px ôm sát + mũi tên lên chip + nhãn động từ trên mép dưới lá — 2026-11-18 bỏ khung đá bao ngoài để đỡ che hàng golem, 53×88 thay 63×112px; không chặn chạm, chạm bất kỳ đâu là ẩn; mỗi người một bong bóng, nước mới thay nước cũ). **Chạm chip
  đối thủ ⇒ `mobile/PlayerSheet`**: ★/golem/lá trên tay/đã chơi/crystal, *Last moves* (tối đa 8 nước của người đó đã thấy ở bàn này, có
  ảnh lá + công dụng + bao lâu trước), *Played since last rest* (lấy từ server — đúng cả sau khi tải lại trang, mới nhất trước), *Golems*.
  Ngăn Activity (cả desktop) có ảnh lá nhỏ + công dụng lá thay tên mã (`trade_0002_0100`); lịch sử giữ 30 nước (trước: 4), mỗi nước có
  `playerId` + `seq` tăng dần (`store/gameStore.js`). Dòng nước đi dùng chung `board/MoveRow` (History desktop, PlayerSheet).
- **Skin ✨** (`desktop/FantasyGameLayout`, chỉ desktop, ẩn khi `isCompact`): đặt theo % trên ảnh bàn `game_dock.jpg`; dock đá,
  dải trạng thái trên bàn (Round, deck, ruy băng lượt + Rest), popup chung, lưng bài `golem_bg.JPG`/`merchant_bg.JPG`. Bàn lùi xuống
  56px để HUD không đè.
- **Popup**: Trade (bộ đếm ×n, "After" + cảnh báo sẽ phải bỏ bớt), Upgrade (chạm crystal để nâng 1 cấp — 3 nút vàng→lục, lục→lam, lam→hồng **đứng yên khi bấm liên tiếp**: Reset luôn hiện cạnh "n of N upgrades left" (mờ khi chưa nâng), chân chỉ Cancel + Confirm, popup không đổi cao — 2026-11-18, trước đó nút Reset xuất hiện làm chân xuống dòng và đẩy cả sheet lên trên điện thoại; gửi in/out = hiệu trước/sau
  như `game.UpgradeIO`), Place Crystals (chọn sẵn crystal rẻ nhất cho từng lá bên trái, hiện crystal sẽ nhặt + cảnh báo tràn; lá 1
  không có crystal đặt sẵn thì lấy ngay một chạm), Discard (chọn sẵn rẻ nhất, Undo), Claim Golem (chi phí + điểm + coin), Game Over
  (bảng điểm: golem · coin · crystal · tổng; hoà ⇒ ghế sau). **Người thắng** (chỉ chính mình, không phải người xem): tiêu đề "Victory!"
  ánh vàng + vương miện, khung sáng, tia sáng xoay sau bảng, pha lê nổ từ giữa rồi mưa (tính một lần, tắt hẳn khi reduced-motion),
  nhạc chiến thắng `soundManager.playVictory()` (Web Audio tự tổng hợp ~2.5 s, không thêm file; thiếu Web Audio ⇒ âm game over).
  **Người thua/người xem**: "Game Over" tĩnh, âm game over cũ, thêm dòng "You finished 2nd of 4 with 55 points".

## 6. Logic chung — `hooks/useBoardActions`
Mọi bố cục (desktop, điện thoại, ✨ một phần) dùng chung: `isWaiting`, `isMyTurn`, `placeCost(i)`, `canAfford(i)`, `canClaim(card)`,
`coinFor(i)` (ô 1: đồng nếu còn, không thì bạc; ô 2: bạc khi còn đồng), handler `onMarketCard/onGolem/onHandCard/onRest/onStartGame`
mở popup qua `<BoardModals actions={…}/>`. **Chỉ một instance mỗi màn** được `reopenAfterUndo: true`. Đồng hồ lượt: `useTurnTimer`
(đếm ở trình duyệt, đặt lại theo `gameState.currentTurn`).

## 7. Avatar
`deploy/make-golem-avatars.py` (stdlib, tất định) vẽ 24 SVG 512px vào `assets-src/avatars/` + `avatars.json`: id 1–12 là 12 nguyên
mẫu (Basalt, Mossback, Rime, Cinder, Rivet, Dune, Quartz, Terra, Onyx, Rootling, Reef, Nimbus), 13–24 là đúng 1 biến thể mỗi
nguyên mẫu (Granite … Squall). Lõi ngực + mắt mang hình crystal; mỗi màu lõi 6 con; khung nhìn phóng vào đầu-vai để đọc được ở 36px.
`sanitize-src.sh` xoá avatar cũ (kể cả ảnh người thật của upstream) rồi chép SVG vào `web/static/images/avatar/`.
**Ảnh riêng**: `AvatarPicker` có ô Upload (+ ô "Your picture" có nút ×) → `AvatarCropper` (kéo, thanh zoom, bánh xe, phím mũi tên; khung
tròn đánh dấu phần sẽ hiện) → `utils/customAvatar.js` (≤ 5 MB, ≤ 40 MP, thu từng nửa rồi JPEG 256px q0.88, localStorage) → lúc Start/Join/
Play Again `resolveAvatar()` tải lên lại (`POST /api/avatars`, cùng ảnh ⇒ cùng giá trị `u_…`). `avatarSrc('u_…')` → `/api/avatars/<id>.jpg`;
ảnh đã bị xoá (phòng cũ) ⇒ `PlayerAvatar` hiện chữ cái đầu. Tên phải khớp
`AVATAR_NAMES` (frontend) và `avatarNames` (server; test `TestAvatarNames_MatchFrontendAndAreUnique`). Đổi ảnh ⇒ bump `AVATAR_VERSION`.

## 8. Kiểm thử
- `deploy/ui-shots.mjs [URL] [DIR] [--only desktop|mobile] [--rest]`: menu → lobby đơn → lobby nhiều người → phòng chờ → bàn chơi
  (AI Easy, 5 s/lượt) → popup Rest → ✨, ở 1440×900, 1280×720, 1024×768, 390×844, 320×640, 844×390. **Exit 1** khi có request ra
  ngoài BASE_URL, lỗi console, HTTP ≥ 400, tràn ngang; trên viewport cảm ứng: chữ < 12px (trừ chữ trong SVG) hoặc nút < 44px.
- **`deploy/webkit-shots.cjs`** (engine của Safari, trong image `mcr.microsoft.com/playwright:v1.58.2-noble`): iPhone 15 Pro dọc 393×659 /
  ngang 852×341 + Mac Safari 1440×900; exit 1 khi lá rộng < 20px, chạm lá không mở sheet, tràn ngang, lỗi trang. **Chrome không bắt được
  lỗi WebKit**: 2026-11-17 mọi lá golem/tay bài trên iPhone rộng 0px (`max-width:100%` + `aspect-ratio` + chiều cao % trong khung
  co theo nội dung) ⇒ hàng lá luôn đặt **kích thước pixel tường minh** (`cardBox(h)`, đo hàng bằng `hooks/useElementSize`).
- Giả lập Safari iPhone trong Chrome: viewport 393×659 (có thanh địa chỉ) / 393×852 + safe-area 59/34 / ngang 852×341 + 59 trái-phải,
  safe-area qua CDP `Emulation.setSafeAreaInsetsOverride`.
- Gallery dev (`vite dev` trên bản sao + `?gallery`, `?gallery&modal=…`) để chụp primitive/popup không cần ván thật.
- Vitest: `TradeModal`, `DiscardModal`, `RestPopup`, `SinglePlayerLobby`, `useGameSounds*`, `utils/{crystals,rest,undo,avatar,aiLevel,phoneLayout,customAvatar}`.

## 9. Việc còn mở
- Chưa thử trên iPhone thật (Safari: `dvh`, safe-area) — chỉ giả lập Chrome.
- Code chết của upstream (`CompactCard`, `Card*`, `Simple*`, `MarketArea`, `Chat`, …) vẫn còn trong repo (không xoá file upstream).
