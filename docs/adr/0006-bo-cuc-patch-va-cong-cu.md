# ADR 0006 — Bố cục patch, không đổi go.mod/package.json, aibench trong internal/

- Trạng thái: Accepted (2026-11-14)

## Bối cảnh
`deploy/regen-patches.sh` tái lập `src/golem` từ `golem.zip` + patch, nhưng chỉ diff `internal/` và
`web/react-frontend/src`. Thay đổi ở `cmd/`, `go.mod`, `package.json` sẽ làm bước kiểm "REPRODUCIBLE" thất bại.

## Quyết định
- Chỉ dùng stdlib cho AI (`math/rand/v2`, `context`, `sync/atomic`); không thêm npm package.
- CLI `aibench` đặt ở `internal/ai/arena/aibench` (package main hợp lệ trong internal) ⇒ vào patch backend, không build
  vào image prod.
- Đổi tên patch theo phạm vi để khỏi lỗi thời: `0002-frontend.patch`, `0003-backend.patch` (git mv + **xoá file cũ**, vì
  `sanitize-src.sh` áp mọi `patches/*.patch`).

## Hệ quả
Không cần patch 0004 cho `cmd/`. Nếu sau này phải sửa `cmd/`: thêm `diff_tree … 0004-cmd.patch cmd` vào script.
