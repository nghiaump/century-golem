# ADR 0005 — Giới hạn luồng AI toàn server + search ngoài lock

- Trạng thái: Accepted (2026-11-14)

## Bối cảnh
Production là Pixel 3 XL (4 core lớn + 4 nhỏ, 3.5 GB, đang chạy pin). Upstream chạy AI ngay trong game loop, không lock
(data race), không huỷ được; nhiều phòng cùng lúc có thể ăn hết CPU.

## Quyết định
- `ai.Scheduler`: pool token toàn server (`AI_MAX_THREADS`, mặc định min(4, NumCPU/2)); search giữ ≥1 token mỗi worker,
  lấy thêm không chờ ⇒ nhiều ván cùng nghĩ thì mỗi ván ít worker hơn (đổi sức mạnh lấy độ trễ, không quá giờ).
- Session: snapshot `Clone()` dưới lock → agent nghĩ ở goroutine riêng → loop áp kết quả dưới lock; kết quả cũ (seq lệch)
  bị bỏ; `Close()` huỷ context; delay tối thiểu chồng lên thời gian nghĩ; không nghĩ trong lượt người; phòng trống
  (`AI_PAUSE_WHEN_EMPTY`) ⇒ AI dừng.
- `AI_THINK_SCALE_PCT` để hạ ngân sách khi máy nóng; `GOMEMLIMIT` cho container server.

## Hệ quả
Đo trên Pixel: p95 = ngân sách + < 10 ms; heap đỉnh 62 MiB khi Very Hard 4 luồng. Suite session có ít race hơn baseline.

## Phương án đã loại
Mỗi phòng tự do dùng luồng (quá tải khi nhiều ván); nghĩ trước trong lượt người (nóng máy, hao pin).
