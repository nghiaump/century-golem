# Runbook — Century Golem @ century.pentium.ink

Mọi lệnh chạy từ `cd /home/nghia/ai/rename-game/deploy` trừ khi ghi khác. Không lệnh nào cần sudo.
Sau MỌI thay đổi: `./smoke-test.sh && ./privacy-audit.sh` — cả hai phải in `ALL PASS` / `AUDIT SẠCH` (exit 0).

## 1. Kiểm tra nhanh "có sống không"
```bash
docker compose ps                           # 4 service Up; mongodb/redis/server (healthy)
systemctl --user is-active century-tunnel   # active
./smoke-test.sh                             # qua domain thật (Cloudflare → tunnel → nginx → server)
./smoke-test.sh http://127.0.0.1:8400       # bỏ qua Cloudflare/tunnel — dùng để khoanh vùng lỗi
curl -s http://127.0.0.1:8400/api/list      # các phòng đang có (ai đang chơi)
```

## 2. Start / stop / restart
| Việc | Lệnh | Ghi chú |
|---|---|---|
| Bật toàn bộ | `docker compose up -d` | tự chạy sau reboot (restart: unless-stopped) |
| Tắt (giữ dữ liệu) | `docker compose down` | ⛔ `down -v` = XOÁ volume mongo/redis |
| Restart frontend | `docker compose restart web` | không ảnh hưởng ván đang chơi |
| Restart backend | `docker compose restart server` | ⚠ **kết thúc mọi ván đang chơi** (state trong RAM) |
| Tunnel | `systemctl --user restart century-tunnel` | site gián đoạn vài giây; ván không mất (client tự reconnect) |

Trước khi đụng `server`: `curl -s http://127.0.0.1:8400/api/list` — nếu `count > 0` và có `connectedPlayers`, báo trước.

## 3. Deploy lại sau khi sửa code trong `../src/golem`
```bash
# Chỉ frontend (web/react-frontend/**, ảnh, âm thanh, nginx.conf):
DOCKER_BUILDKIT=1 docker compose up -d --build --no-deps web
# Backend (cmd/**, internal/**):
curl -s http://127.0.0.1:8400/api/list        # xem có ai đang chơi
DOCKER_BUILDKIT=1 docker compose up -d --build --no-deps server
./smoke-test.sh && ./privacy-audit.sh
```
- `DOCKER_BUILDKIT=1` bắt buộc với `web`; `--no-deps` để không vô tình recreate `server`.
- Chỉ sửa `nginx.conf` (mount ro): `docker compose exec web nginx -t && docker compose exec web nginx -s reload`.
- Sửa code upstream ⇒ `./regen-patches.sh` (phải in REPRODUCIBLE) + ghi `docs/upstream-changes.md`.

## 4. Đổi avatar
Avatar = `web/static/images/avatar/<id>.webp`, sinh từ `../assets-src/smb-enemies-sheet.png` bởi `make-avatars.py`.
```bash
PY=/home/nghia/ai/venvs/mda5-asr/bin/python                     # Python có Pillow+WebP
# 1. sửa bảng SPRITES trong make-avatars.py (bbox lấy theo lưới 16px của sheet)
cd .. && $PY -I deploy/make-avatars.py assets-src/smb-enemies-sheet.png src/golem/web/static/images/avatar \
         --preview /tmp/avatars.png                             # xem trước trước khi deploy
# 2. đổi số lượng ⇒ sửa AVATAR_IDS; đổi ảnh ⇒ BUMP AVATAR_VERSION trong src/golem/web/react-frontend/src/utils/avatar.js
#    (Cloudflare + trình duyệt cache /assets 7 ngày; không bump = người chơi vẫn thấy ảnh cũ)
# 3. cd deploy && ./regen-patches.sh   (phải in REPRODUCIBLE), rồi:
cd deploy && DOCKER_BUILDKIT=1 docker compose up -d --build --no-deps web && ./smoke-test.sh && ./privacy-audit.sh
```
Hiện có 23 avatar: 1..12 là 12 nhân vật khác nhau, 13..23 là **tối đa 1 biến thể** cho mỗi nhân vật. AI được server chọn
avatar ngẫu nhiên và mang tên nhân vật ⇒ đổi/thêm avatar phải sửa **cả** `SPRITES` (make-avatars.py), `AVATAR_IDS`
(frontend `utils/avatar.js`, bump `AVATAR_VERSION`) và `avatarNames` (`internal/session/ai_turns.go`).

## 5. Nhận mã nguồn mới từ upstream (zip/clone mới)
```bash
cd /home/nghia/ai/rename-game
NEW=src-new && mkdir $NEW && unzip -q <file-mới>.zip -d $NEW -x '__MACOSX/*'
deploy/sanitize-src.sh $NEW/golem      # gỡ .env máy khác, áp patch, sinh avatar, xoá metadata ảnh
#   → nếu báo "vá ... KHÔNG KHỚP": upstream đổi file đó; sửa tay trên src mới theo upstream-changes.md rồi chạy deploy/regen-patches.sh
diff -r -x .git src/golem $NEW/golem | less      # đọc kỹ thay đổi upstream (tìm URL/token/telemetry mới!)
grep -rnE 'https?://' $NEW/golem/internal $NEW/golem/cmd $NEW/golem/web/react-frontend/src | grep -v _test
mv src/golem src/golem.prev && mv $NEW/golem src/golem && rmdir $NEW
cd deploy && DOCKER_BUILDKIT=1 docker compose up -d --build && ./smoke-test.sh && ./privacy-audit.sh
# lỗi ⇒ quay lại: rm -rf ../src/golem && mv ../src/golem.prev ../src/golem && docker compose up -d --build
```
`sanitize-src.sh` chạy lại nhiều lần vẫn an toàn (idempotent).

## 6. Backup / restore MongoDB (lịch sử ván)
```bash
mkdir -p ../backups
docker compose exec -T mongodb mongodump --quiet --archive --gzip --db golem_game \
  > ../backups/mongo-$(date +%Y%m%d-%H%M%S).archive.gz
# Restore thử vào DB nháp (an toàn):
docker compose exec -T mongodb mongorestore --quiet --archive --gzip \
  --nsFrom 'golem_game.*' --nsTo 'restoretest.*' < ../backups/<file>.archive.gz
# Restore đè thật (ghi đè collection trùng tên):
docker compose exec -T mongodb mongorestore --quiet --archive --gzip --drop < ../backups/<file>.archive.gz
```
Redis chỉ chứa session auth (đang tắt) ⇒ không cần backup.

## 7. Tunnel Cloudflare
```bash
systemctl --user status century-tunnel
tail -f tunnel.log                                     # "Registered tunnel connection" ×4 = khoẻ
cloudflared tunnel info century                        # connector + vị trí edge
cloudflared tunnel --config ~/.config/century-golem/tunnel.yml ingress validate
```
Config: `~/.config/century-golem/tunnel.yml` (CHỈ century.pentium.ink → `http://127.0.0.1:8400`, rồi 404).
Credentials: `~/.config/century-golem/tunnel-creds.json` (0400, secret — không chép đi đâu).

## 8. Xử lý sự cố
| Triệu chứng | Nguyên nhân hay gặp | Làm gì |
|---|---|---|
| Cloudflare **Error 1033** | tunnel không chạy | `systemctl --user restart century-tunnel`; xem `tunnel.log` |
| Cloudflare **502 Bad Gateway** (trang Cloudflare) | tunnel sống, nginx `web` chết | `docker compose ps`; `docker compose up -d web` |
| nginx **502** (trang trắng chữ nginx) | `server` chết / đang khởi động | `docker compose logs --tail 100 server`; chờ healthcheck |
| **403 / error 1010** khi curl/script | Cloudflare chặn UA script | thêm `-A "Mozilla/5.0 ..."` (trình duyệt thật không bị) |
| "Login Required / Sign in with Google" | mất patch 0001 (source mới) hoặc ai đó bật Firebase | `sanitize-src.sh`, kiểm env, rebuild `web` |
| "Connection timeout" trong game | WS `/ws` không qua được | `./smoke-test.sh http://127.0.0.1:8400` (WS 101?) → nếu local OK thì do tunnel |
| Avatar/ảnh cũ vẫn hiện | cache 7 ngày ở Cloudflare/trình duyệt | bump `AVATAR_VERSION`; hoặc purge cache trên dashboard Cloudflare |
| Server không lưu lịch sử | mongo không healthy | `docker compose logs mongodb`; log server "Event store initialized" |
| Đĩa đầy | image build cũ | `docker image prune -f` (⛔ không `volume prune`) |
| Tạo phòng báo 503 "Too many open rooms" | chạm `MAX_SESSIONS` | xem log `Removed idle session`; tăng `MAX_SESSIONS` trong compose nếu tải thật |
| Vào web chỉ thấy nền / kẹt "Connecting..." (profile thường được, incognito được) | trước bản sửa 0002(e): trình duyệt tự mở lại link `/room/<id>` cũ | đã sửa (lobby + note); người dùng cũ: mở `https://century.pentium.ink/` hoặc tải lại trang |
| Phòng "ma" còn trong danh sách | còn kết nối mở (tab bỏ quên) hoặc chưa tới ngưỡng | chờ ngưỡng (§10); có kết nối thì phòng được giữ — đúng thiết kế |
| Server restart đột ngột, mất ván | panic upstream "send on closed channel" (CLAUDE.md §Lỗi upstream) | `docker compose logs server \| grep -A5 panic` |

## 9. Gỡ bỏ hoàn toàn
```bash
docker compose down                     # thêm -v nếu muốn xoá cả dữ liệu
systemctl --user disable --now century-tunnel
rm ~/.config/systemd/user/century-tunnel.service && systemctl --user daemon-reload
cloudflared tunnel delete century       # rồi xoá CNAME `century` trên dashboard Cloudflare (pentium.ink)
```

## 10. Dọn phòng ma (tự động)
Không cần thao tác: phòng không còn kết nối nào bị xoá sau 5 phút (chưa bắt đầu), 10 phút (đang chơi — giữ chỗ cho
người rớt mạng quay lại), 2 phút (đã kết thúc). Chi tiết: architecture.md §Dọn phòng.
```bash
docker compose logs --since 1h server | grep "Removed idle session"   # đã dọn những gì
curl -s http://127.0.0.1:8400/api/list                                # phòng nhiều người còn mở
# Đổi ngưỡng: sửa SESSION_IDLE_*_SECONDS / MAX_SESSIONS trong docker-compose.yml rồi
docker compose up -d --no-deps server                                 # ⚠ kết thúc các ván đang chơi
```

## 11. Máy chạy, đồng bộ code, rollback (chuyển sang pixel3xl ngày 2026-11-14)
Đang chạy trên **pixel3xl** (`ssh ubuntu@100.71.99.38`, Tailscale; repo `/home/ubuntu/ai/rename-game`). Lệnh §1–§10 chạy
trên máy đó (đổi `/home/nghia` → `/home/ubuntu`). Chỉ MỘT máy được chạy tunnel `century` — kiểm từ rtx (có cert.pem):
`cloudflared tunnel info century` phải chỉ có 1 connector (`linux_arm64`).

Sửa code ở rtx rồi đẩy sang (chỉ sửa ở MỘT nơi; rsync đè bản bên kia; không đè log tunnel của pixel3xl):
```bash
rsync -a --exclude deploy/tunnel.log /home/nghia/ai/rename-game/ ubuntu@100.71.99.38:ai/rename-game/
ssh ubuntu@100.71.99.38 'cd ~/ai/rename-game/deploy && DOCKER_BUILDKIT=1 docker compose up -d --build --no-deps web'
#   backend: thay `web` bằng `server` (⚠ mất ván) — xem /api/list trước; build trên máy ~4 phút, build từng service một cho đỡ RAM
```
Khác biệt arm64: server build bằng `deploy/Dockerfile.server` (upstream ép GOARCH=amd64); mongo cache 0.25 GB.

Rollback về rtx (gián đoạn ~10 s):
```bash
ssh ubuntu@100.71.99.38 'systemctl --user disable --now century-tunnel'       # 1. tắt tunnel pixel3xl TRƯỚC
# 2. muốn giữ lịch sử ván mới: mongodump trên pixel3xl → scp → mongorestore --drop trên rtx (§6)
cd /home/nghia/ai/rename-game/deploy && docker compose up -d && systemctl --user enable --now century-tunnel
```
Bản sao lưu lúc chuyển: `backups/mongo-20261114-110032-cutover.archive.gz` (178 events, 22 snapshots).
Rủi ro pixel3xl: lúc chuyển đang chạy pin (`pmi8998-charger online=0`) — hết pin ⇒ Cloudflare **1033**. Kiểm:
`cat /sys/class/power_supply/pmi8998-charger/online /sys/class/power_supply/max1720x/capacity`. Chỉ có Wi-Fi (`wlan0`).

## 12. AI — chỉnh trên máy chạy (2026-11-14)
Tổng quan: `docs/ai/README.md` · hiệu năng đo được: `docs/ai/hieu-nang.md` · hiệu chỉnh: `docs/ai/tinh-chinh.md`.

| Muốn | Làm |
|---|---|
| Máy nóng / pin yếu | `AI_THINK_SCALE_PCT=60` (hoặc `AI_MAX_THREADS=2`) trong `deploy/docker-compose.yml` ⇒ `docker compose up -d --no-deps server` (⚠ mất ván) |
| AI nghĩ chậm hơn ngân sách | `docker compose logs --since 10m server \| grep '"AI move"'` — xem `elapsed`, `iterations`, `workers` |
| Xem AI có đang chạy khi phòng trống | không nên: `AI_PAUSE_WHEN_EMPTY=1` (mặc định) dừng AI khi không còn kết nối |
| Bật lại toast ý đồ AI ("… took the golem you were going for") | `AI_INTENT_MESSAGES=1` (mặc định 0 — người dùng tắt) ⇒ `docker compose up -d --no-deps server` |
| Đo lại hiệu năng trên Pixel | lệnh ở `docs/ai/hieu-nang.md` §Đo lại (binary `aibench` arm64) |
| Nhiệt độ / CPU | `cat /sys/class/thermal/thermal_zone0/temp` · `docker stats --no-stream` · pin: `cat /sys/class/power_supply/{max1720x/capacity,pmi8998-charger/online}` |

`smoke-test.sh` kiểm thêm `/api/single` với `difficulty` (veryhard ⇒ `coalition:true`, giá trị lạ ⇒ 400).
