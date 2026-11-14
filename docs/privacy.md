# Riêng tư & cô lập — Century Golem

Mục tiêu: deployment này **không gửi gì** về deployment gốc / bên thứ ba và **không mang dấu vết định danh**
của tác giả gốc. Kiểm tự động: `deploy/privacy-audit.sh` (exit 0 = sạch).

## Đã gỡ khỏi mã nguồn (cất ở `removed-foreign-config/`, ⛔ không khôi phục)
| File | Vì sao |
|---|---|
| `.env.example`, `web/react-frontend/.env.local`, `.env.production` | Jenkins `157.66.101.66:8080`, repo `vietky/golem`, API `game.anhtran.dev`; Vite đọc `.env.local` ở MỌI mode |
| `ansible/inventory.ini` | IP server gốc + đường dẫn SSH key của tác giả |
| `web/static/images/favicon.png` (bản gốc) | XMP/EXIF Canva: doc ID, user ID, tên team, tác giả "Táo", Facebook ad ID |
| `web/static/images/avatar/1..4.webp` (bản gốc) | ảnh chụp **người thật** (định danh) → thay bằng sprite SMB |

Ngoài ra đã xoá metadata EXIF/comment của 90 ảnh JPG (chỉ có kích thước/encoder, vô hại — làm để audit có mốc 0).
`web/react-frontend/public/images` là **symlink** tới `web/static/images` (một bộ ảnh duy nhất).

## Đã tắt
| Thứ | Cách tắt | Kiểm |
|---|---|---|
| Telegram notifier (báo "room created" về chat của tác giả) | `TELEGRAM_BOT_TOKEN=`/`TELEGRAM_CHAT_ID=` rỗng | log `Telegram notifier disabled` |
| Firebase / Google OAuth | `FIREBASE_*`, `GOOGLE_OAUTH_*` rỗng | log `Firebase authentication not configured`; `/auth/profile` → 404 |
| Đường ra Internet của backend | network `backend: internal: true` | `wget api.telegram.org` từ `server` thất bại |

Không có token/secret thật nào trong code hay 220 commit lịch sử git (chỉ giá trị mẫu `123456:ABC-DEF…`).

## Những gì đã kiểm và sạch
- **Bundle frontend** (JS/CSS/HTML/source map): không host ngoài, không font CDN, không analytics/beacon, không
  `game.anhtran.dev`/IP/tên tác giả. Chỉ còn chuỗi `w3.org` (namespace SVG) và link tài liệu lỗi React — không fetch.
- **API/WS** gọi cùng origin `century.pentium.ink`. Cloudflare không chèn script (Web Analytics không bật cho host này).
- **Cookie** `clientId` host-only (không `Domain`) ⇒ không chia sẻ với domain khác.
- **Image `server`**: chỉ binary + `web/static` + CA certs Alpine; không `.git`/`.env`; binary không chứa chuỗi định danh.
- **Mongo/Redis** volume mới, không dữ liệu cũ; không publish cổng ra host.
- **Tunnel/credential/DNS**: của tài khoản người dùng; tunnel riêng `century`.
- **AI** (2026-11-14): chạy hoàn toàn trong process `server` (Go stdlib), không gọi dịch vụ ngoài, không model tải về,
  không gửi dữ liệu ván đi đâu. Backend vẫn nằm trên mạng `internal` (privacy-audit kiểm).

## Rủi ro còn lại (đã chấp nhận / cần biết)
- **Asset game giống hệt bản gốc** (ảnh lá bài, âm thanh, giao diện) ⇒ ai so sánh vẫn nhận ra cùng một game.
- **Ảnh avatar cũ có thể còn trong cache Cloudflare** ở URL không version `/assets/images/avatar/1.webp` (tối đa 7
  ngày kể từ 2026-10-07). App không còn trỏ tới URL đó (dùng `?v=`). Muốn xoá ngay: Cloudflare dashboard →
  pentium.ink → Caching → Purge → Custom URL `https://century.pentium.ink/assets/images/avatar/1.webp`.
- **Endpoint xem lịch sử công khai** `/api/games`, `/api/events`, `/api/snapshot`, `/admin/sessions/state` — không
  auth (như upstream): ai cũng xem được tên người chơi + diễn biến ván. Từ 2026-11-14 thứ tự deck của ván **đang chơi**
  được ẩn (sắp theo ID) để người chơi không xem trước lá — AI cũng không bao giờ nhìn (ADR 0007).
- **Không đăng nhập** ⇒ ai có link cũng tạo phòng. Bật đăng nhập = Firebase project + OAuth client CỦA NGƯỜI DÙNG.
- **`clientId` đoán được** (`client_<UnixNano>`) ⇒ về lý thuyết chiếm được chỗ người khác khi reconnect.
- **Source map** (`.js.map`) công khai ⇒ lộ mã frontend (vốn là mã upstream; không có secret).
- Lịch sử git của upstream (remote + email tác giả) đã dời khỏi repo sang `/home/nghia/ai/golem-upstream.git` (chỉ trên
  đĩa rtx, ⛔ không push); repo `nghiaump/century-golem` có lịch sử mới.
