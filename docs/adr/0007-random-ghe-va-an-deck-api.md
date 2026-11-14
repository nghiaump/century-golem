# ADR 0007 — Random ghế người chơi; ẩn thứ tự deck trong API công khai

- Trạng thái: Accepted (2026-11-14) · Quyết định của người dùng

## Bối cảnh
(1) Chơi 1 người: người luôn ngồi ghế 1 (3 vàng, đi trước) — với luật hoà mới (ghế sau thắng) thì luôn thua khi hoà.
(2) `/api/events`, `/api/snapshot` công khai, không auth, trả cả thứ tự deck ⇒ người chơi có thể xem trước lá sắp ra
trong khi AI cam kết không nhìn.

## Quyết định
- Ghế người chơi được random mỗi ván (luật gốc random người đi đầu); AI có thể ngồi ghế 1 (đã sửa lỗi treo lượt đầu).
- Hai endpoint trên **sắp deck theo ID** (xoá thứ tự) cho ván còn trong RAM và đang chơi; dữ liệu Mongo giữ nguyên, ván đã
  xong vẫn xem đầy đủ.

## Hệ quả
Công bằng thông tin giữa người và AI. `/admin/sessions/state` vốn chỉ trả số lượng lá trong deck nên không đổi.
