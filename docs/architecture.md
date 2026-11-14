# Kiến trúc — Century Golem @ century.pentium.ink

## Luồng request
```
Trình duyệt
  │ HTTPS / WSS  century.pentium.ink
  ▼
Cloudflare edge ── CNAME century → tunnel `century` (acfd8c66-e01f-4990-ae8a-9bc3b7702f57)
  │
  ▼  cloudflared (systemd --user century-tunnel, metrics 127.0.0.1:20261)
127.0.0.1:8400 ── container `web` (nginx 1.27)            networks: edge + backend
  ├─ /                  → index.html (SPA fallback cho /room/:roomId), Cache-Control: no-cache
  ├─ /assets/*.js|css   → bundle Vite (tên có hash), expires 7d
  ├─ /assets/images/*   → ảnh lá bài, nền, avatar (copy từ src/golem/web/static/images)
  ├─ /assets/sounds/*   → mp3 hiệu ứng
  ├─ /api/* /auth/* /admin/* /health  ─┐
  └─ /ws (Upgrade: websocket, 3600s) ──┴→ server:8080
                                          container `server` (Go, ./cmd/server)   network: backend (internal)
                                            ├─ mongodb:27017  (mongo:7, volume century-golem_mongodb_data)
                                            └─ redis:6379     (redis:7-alpine AOF, volume century-golem_redis_data)
```
- Network `backend` là `internal: true` ⇒ server/mongodb/redis **không có đường ra Internet** (cố ý — xem privacy.md).
- Network `edge` chỉ có `web`, để Docker publish cổng `127.0.0.1:8400`. Không gì khác mở cổng ra host.
- Frontend gọi API/WS **cùng origin** (`VITE_API_HOST` rỗng) ⇒ không có CORS, không có host cứng trong bundle.

## Service
| Service | Image | Vai trò | Dữ liệu |
|---|---|---|---|
| `web` | `century-golem-web` (build `deploy/Dockerfile.web`) | nginx: frontend + reverse proxy | không (nginx.conf mount ro) |
| `server` | `century-golem-server` (build `deploy/Dockerfile.server`) | Go game server: REST + WebSocket, AI | state ván trong RAM |
| `mongodb` | `mongo:7` | event store `golem_game.{game_events,game_snapshots}` | volume `century-golem_mongodb_data` |
| `redis` | `redis:7-alpine` | session store cho auth (hiện auth tắt ⇒ gần như không dùng) | volume `century-golem_redis_data` |

Tất cả `restart: unless-stopped`; docker.service + containerd enabled ⇒ tự lên sau reboot.
Tunnel là unit `systemd --user` (linger = yes) ⇒ cũng tự lên sau reboot, không cần đăng nhập.

## State & độ bền
- **Ván đang chơi chỉ nằm trong RAM của `server`.** Server KHÔNG khôi phục ván từ MongoDB khi khởi động ⇒
  restart/rebuild `server` = mọi ván đang diễn ra kết thúc. Mongo chỉ giữ lịch sử event/snapshot (xem qua `/api/games`).
- Cookie `clientId` (host-only, Secure, SameSite=Lax, 30 ngày) giúp người chơi reconnect vào đúng chỗ.
- Turn timeout mặc định 60s (`DEFAULT_TURN_TIMEOUT_SECONDS`), WebSocket ping 15s. Hết giờ ⇒ chơi 1 người: AI Medium
  đánh thay cho ghế đó; nhiều người: Rest (như upstream). Lượt đầu tiên của ván không bao giờ hết giờ.

## Dọn phòng (patch 0003)
Mỗi phòng có một goroutine kiểm tra mỗi 30s: còn **kết nối WebSocket mở** nào (người chơi `Conn != nil` hoặc khán giả)?
Không còn liên tục quá ngưỡng ⇒ xoá khỏi map + `Close()` (dừng vòng lặp game, đóng kết nối), log `Removed idle session`.

| Trạng thái | Ngưỡng (env) | Mặc định |
|---|---|---|
| `waiting` (chưa bắt đầu) | `SESSION_IDLE_WAITING_SECONDS` | 300s |
| `playing` (mọi người rớt/bỏ — chỗ được giữ để reconnect trong khoảng này) | `SESSION_IDLE_PLAYING_SECONDS` | 600s |
| `ended` | `SESSION_IDLE_ENDED_SECONDS` | 120s |

- `MAX_SESSIONS` (100): đủ số phòng trong RAM ⇒ `/api/create`, `/api/single` trả 503 (chống spam tạo phòng).
- `/api/list` không liệt kê ván chơi đơn (`single_*`).
- Ước lượng tải: phòng rảnh ~vài KB RAM + 1 goroutine ngủ; ván bị bỏ chạy AI tối đa 10 phút rồi bị dọn.

## Avatar
- Người chơi chọn 1 trong 15 avatar (sprite Super Mario Bros.) ở màn create/join room và single player; id gửi
  qua WS `&avatar=<id>` (server nhận chuỗi tuỳ ý, không kiểm). AI nhận `avatar = player ID` (1..5, tối đa 5 người).
- Ảnh: `/assets/images/avatar/<id>.webp?v=<AVATAR_VERSION>` — query version để vượt cache 7 ngày.
- Trong ván: `PlayerAvatar` hiện ảnh avatar ở thanh người chơi, thẻ người chơi, khung "của tôi" (desktop/mobile),
  màn kết thúc. AI lấy avatar chưa ai chọn (`resolveAvatarId`) nên không trùng người thật.

## Giao diện màn khởi tạo
Màn chính, lobby đơn/nhiều người, hộp thoại kết nối và phòng chờ dùng theme Windows XP × brutalism (`theme-xp.css`,
`XpWindow`, `XpWaitingRoom`). **Bàn chơi giữ style upstream** (theme XP trong ván đã thử và bị bỏ theo ý người dùng).

## AI (đối thủ máy) — chi tiết: `docs/ai/thiet-ke.md`, tổng quan EN: `docs/ai/README.md`
```
runGameLoop (goroutine/phòng, mọi mutate + broadcast dưới gs.mu)
  tick: lượt AI ⇒ Clone() state ─▶ goroutine agent.Decide(ctx) ─(≥ AI_MIN_DELAY_MS)─▶ aiResults
        người hết giờ ⇒ như trên với agent chơi thay
  aiResults: seq còn khớp? ⇒ Step(action) (+discard) ⇒ aiIntent ⇒ broadcast ⇒ lưu event (bản clone, ngoài lock)
  ActionChan (người): Step ⇒ huỷ job AI đang bay ⇒ broadcast ⇒ lưu event
internal/ai: agent theo ghế (Easy 1-ply · Medium/Hard/Very Hard MCTS ensemble) chạy trên internal/ai/sim (state gọn,
             deck = pool không thứ tự ⇒ không thể nhìn thứ tự deck); pool luồng toàn server ai.Scheduler (AI_MAX_THREADS)
```
- Engine: `GameState.Step` là hàm lượt duy nhất (luật chính thức: hoà ⇒ ghế sau thắng; mua lá = đặt crystal bất kỳ lên
  các lá bên trái; last round ở golem thứ 6 với 2–3 người, thứ 5 với 4–5). Ghế người chơi đơn được random.
- Phòng chơi đơn: chế độ ghi tường minh (`WithSinglePlayer`), fallback tiền tố `single_`. Phòng không còn ai kết nối ⇒
  AI dừng (`AI_PAUSE_WHEN_EMPTY`).

## API game (backend, không prefix — `API_PREFIX` rỗng)
| Method | Path | Ghi chú |
|---|---|---|
| GET | `/health` | `OK` |
| GET | `/api/list` | danh sách phòng đang có |
| POST | `/api/create` | `{numPlayers, sessionID?, creatorName}` — phòng nhiều người |
| POST | `/api/single` | `{numAI: 1..4, difficulty?: easy\|medium\|hard\|veryhard (mặc định medium), aiLevels?: [...], turnTimeout?, sessionID?}` → `{sessionID: "single_<ns>", difficulty, aiLevels, coalition, …}`; difficulty lạ ⇒ 400; ID tự đặt bị ép tiền tố `single_` |
| POST | `/api/join` | vào phòng |
| POST | `/api/sessions/start` | `{sessionID}` bắt đầu ván |
| WS | `/ws?session=&name=&avatar=[&spectate=true][&clientID=]` | kênh chơi; message `state`, `playerAssigned`, `aiThinking`, `aiIntent`, `turnTimeout`, ... (bảng field: `docs/ai/thiet-ke.md` §8) |
| GET | `/api/games`, `/api/events?gameId=`, `/api/snapshot?gameId=`, `/admin/sessions/state?sessionId=` | xem lịch sử — **công khai, không auth** (như upstream); ván còn đang chơi ⇒ deck trả theo thứ tự ID (ẩn thứ tự thật) |
| — | `/auth/*` | chỉ đăng ký khi bật Firebase; hiện trả 404 (đúng ý) |

Frontend route (react-router): `/` (chọn chế độ / lobby) và `/room/:roomId` (link mời vào phòng).

## Cổng & định danh trên máy
| Thứ | Giá trị |
|---|---|
| nginx local | `127.0.0.1:8400` |
| cloudflared metrics | `127.0.0.1:20261` (homelab 20241–20245, ocrdesk 20251) |
| Docker project | `century-golem` |
| Tunnel | `century` / `acfd8c66-e01f-4990-ae8a-9bc3b7702f57` |
