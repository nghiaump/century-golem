# deploy/ — Century Golem @ century.pentium.ink

Cấu hình deploy (docker compose + nginx + tunnel) và công cụ vận hành. Tài liệu đầy đủ ở `../docs/`:
[runbook](../docs/runbook.md) · [kiến trúc](../docs/architecture.md) · [riêng tư](../docs/privacy.md) ·
[thay đổi so với upstream](../docs/upstream-changes.md) · [AI](../docs/ai/README.md) · [mục lục](../docs/README.md).
Tổng quan + quy tắc: [../CLAUDE.md](../CLAUDE.md).

```bash
docker compose ps                                              # trạng thái
./ship.sh web | server | all                                   # PROD (pixel3xl): build ở rtx, Pixel chỉ đóng gói + restart
./smoke-test.sh && ./privacy-audit.sh                          # kiểm sau mỗi thay đổi (exit 0)
systemctl --user status century-tunnel                         # tunnel (log: ./tunnel.log)
```

| File | Vai trò |
|---|---|
| `docker-compose.yml` | mongodb, redis, server (mạng `backend` internal), web (`127.0.0.1:8400`) |
| `Dockerfile.web`, `nginx.conf` | build frontend + phục vụ/proxy |
| `Dockerfile.server` | build backend theo kiến trúc máy build (amd64 / arm64) — build tại chỗ, dùng trên rtx |
| `ship.sh`, `Dockerfile.server.prebuilt`, `Dockerfile.web.prebuilt` | deploy prod: build nặng ở rtx (`build/`, gitignore) → Pixel chỉ COPY artifact + restart (runbook §11) |
| `patches/`, `regen-patches.sh` | sửa code upstream (0001 auth, 0002-frontend: `src/` + `index.html` + `tailwind.config.js`, 0003-backend: dọn phòng + luật + AI); script sinh lại + kiểm tái lập. File nhị phân (font, avatar) đi qua `../assets-src/` + sanitize |
| `sanitize-src.sh` | làm sạch source mới (idempotent): gỡ config máy khác, áp patch, chép avatar + font từ `../assets-src/`, xoá metadata |
| `make-golem-avatars.py` | vẽ 24 avatar golem SVG → `../assets-src/avatars/` (12 golem + 1 biến thể; `--preview OUT.html`) |
| `ui-shots.mjs` | chụp mọi màn ở 6 viewport + kiểm UI tự động (request ngoài, console, tràn, chữ < 12px, nút < 44px) |
| `webkit-shots.cjs` | engine Safari (WebKit) ở iPhone 15 Pro dọc/ngang + Mac Safari: ảnh bàn chơi + kiểm lá không rộng 0, chạm mở sheet (chạy trong image `mcr.microsoft.com/playwright:v1.58.2-noble`, lệnh ở đầu file) |
| `strip-image-metadata.py` | xoá metadata ảnh |
| `smoke-test.sh`, `privacy-audit.sh` | kiểm chức năng (gồm `difficulty` của AI) / riêng tư |

Biến AI trong `docker-compose.yml` (`AI_MAX_THREADS`, `AI_THINK_SCALE_PCT`, `AI_MIN_DELAY_MS`, `AI_MAX_NODES`,
`AI_PAUSE_WHEN_EMPTY`, `GOMEMLIMIT`): xem [runbook §12](../docs/runbook.md) và [docs/ai](../docs/ai/README.md).
