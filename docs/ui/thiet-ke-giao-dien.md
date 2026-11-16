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
  người chơi bắt đầu sát mép trên, không chừa dải trống (2026-11-16, ý người dùng); điện thoại, skin ✨ và phòng chờ dùng bản nổi ở
  góc: trái "Round N · độ khó · Last round" (điện thoại: "R N"), phải ✨ (desktop) · âm thanh · Activity
  (`CollapsibleInfo`: ngăn đá phải 420px / bottom sheet trên điện thoại; chat; xoá có bước xác nhận trong trang). `Toast` giữa-trên
  dưới HUD, tối đa 3, không còn `alert()`.
- **Desktop** (`desktop/WebGameLayout`, ≥ 768px rộng và ≥ 500px cao khi ngang): hàng người chơi (`PlayerCard`, rộng tới 21rem, avatar
  68px — 56px dưới 1280px: tên · golem · ★ điểm = golem + coin, hàng crystal, "n in hand · n played", vòng giờ người, AI đang nghĩ, offline), panel Market 6 lá + Golems 5 lá (`CardTile`), hàng dưới History · Played · tay bài
  (ruy băng lượt + Rest luôn hiện, mờ kèm gợi ý khi chưa chơi lá nào) · My Golems (`CardPile` → popup danh sách).
- **Điện thoại** (`mobile/*` + `PlayersInfoBar`): dọc = dải người chơi cuộn ngang + dòng lượt · golem 1 hàng vuốt + market 3×2
  (cuộn dọc) · tay bài ở đáy (crystal x/10, Rest · golem · đã chơi, lá vuốt ngang). Ngang (cao < 500px) = bàn trái, cột phải gồm
  dải người chơi thu gọn + tay bài. **Chạm lá ⇒ `CardSheet`** (ảnh lớn, mô tả, nút Take / Place n & take / Claim / Play hoặc lý do không được).
- **Skin ✨** (`desktop/FantasyGameLayout`, chỉ desktop, ẩn khi `isCompact`): đặt theo % trên ảnh bàn `game_dock.jpg`; dock đá,
  dải trạng thái trên bàn (Round, deck, ruy băng lượt + Rest), popup chung, lưng bài `golem_bg.JPG`/`merchant_bg.JPG`. Bàn lùi xuống
  56px để HUD không đè.
- **Popup**: Trade (bộ đếm ×n, "After" + cảnh báo sẽ phải bỏ bớt), Upgrade (chạm crystal để nâng 1 cấp; gửi in/out = hiệu trước/sau
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
- Gallery dev (`vite dev` trên bản sao + `?gallery`, `?gallery&modal=…`) để chụp primitive/popup không cần ván thật.
- Vitest: `TradeModal`, `DiscardModal`, `RestPopup`, `SinglePlayerLobby`, `useGameSounds*`, `utils/{crystals,rest,undo,avatar,aiLevel}`.

## 9. Việc còn mở
- Chưa thử trên iPhone thật (Safari: `dvh`, safe-area) — chỉ giả lập Chrome.
- Code chết của upstream (`CompactCard`, `Card*`, `Simple*`, `MarketArea`, `Chat`, …) vẫn còn trong repo (không xoá file upstream).
