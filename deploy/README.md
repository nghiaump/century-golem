# deploy/ — Century Golem @ century.pentium.ink

Cấu hình deploy (docker compose + nginx + tunnel) và công cụ vận hành. Tài liệu đầy đủ ở `../docs/`:
[runbook](../docs/runbook.md) · [kiến trúc](../docs/architecture.md) · [riêng tư](../docs/privacy.md) ·
[thay đổi so với upstream](../docs/upstream-changes.md). Tổng quan + quy tắc: [../CLAUDE.md](../CLAUDE.md).

```bash
docker compose ps                                              # trạng thái
DOCKER_BUILDKIT=1 docker compose up -d --build --no-deps web   # deploy lại frontend
./smoke-test.sh && ./privacy-audit.sh                          # kiểm sau mỗi thay đổi (exit 0)
systemctl --user status century-tunnel                         # tunnel (log: ./tunnel.log)
```

| File | Vai trò |
|---|---|
| `docker-compose.yml` | mongodb, redis, server (mạng `backend` internal), web (`127.0.0.1:8400`) |
| `Dockerfile.web`, `nginx.conf` | build frontend + phục vụ/proxy |
| `patches/`, `regen-patches.sh` | sửa code upstream (0001 auth, 0002 frontend, 0003 dọn phòng); script sinh lại + kiểm tái lập |
| `sanitize-src.sh` | làm sạch source mới (idempotent) |
| `make-avatars.py` | sinh avatar 1..15 từ `../assets-src/smb-enemies-sheet.png` |
| `strip-image-metadata.py` | xoá metadata ảnh |
| `smoke-test.sh`, `privacy-audit.sh` | kiểm chức năng / riêng tư |
