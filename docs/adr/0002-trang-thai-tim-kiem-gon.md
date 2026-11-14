# ADR 0002 — Simulator gọn riêng cho search

- Trạng thái: Accepted (2026-11-14)

## Bối cảnh
MCTS cần hàng trăm nghìn lần copy-state + áp nước/giây trên Pixel 3 XL. `GameState` của engine dùng con trỏ, slice,
`*Resources`: `Clone()+Step()` đo được **3.4 µs, 39 alloc** mỗi lần (Threadripper) — chậm và tạo nhiều rác cho GC.

## Quyết định
`internal/ai/sim`: state kiểu giá trị ~300 B (crystal `[4]int8`, tay bài/lá đã chơi `uint64` bitset, market/hàng golem là
chỉ số, lá chưa lộ là **pool không thứ tự**). Copy = gán struct; `Apply` không cấp phát. Bảng lá sinh từ chính danh sách lá
của engine (một nguồn dữ liệu). Engine vẫn là **nguồn sự thật duy nhất** cho ván thật; mọi nước AI được chuyển về
`game.Action` và `Validate` lại.

Tính nhất quán: `TestDifferential_SimMatchesEngine` chơi 2000 ván ngẫu nhiên × 2–5 người, so **toàn bộ state và tập
nước hợp lệ** sau mỗi bước (refill được replay từ deck thật qua `Drawer`).

## Hệ quả
- Đo được: copy+apply **25 ns, 0 alloc**; sinh nước hợp lệ 303 ns, 0 alloc (≈ 134× nhanh hơn engine).
- Hai bộ luật phải giữ đồng bộ: mọi đổi luật ở `internal/game` phải sửa `sim` và differential test sẽ bắt lệch.
- `Drawer` nhận kích thước pool thay vì slice để state không thoát ra heap (bài học: interface call + slice ⇒ escape).

## Phương án đã loại
Search thẳng trên `GameState.Clone()`: đơn giản hơn nhưng ít hơn ~10–20× iteration trên điện thoại.
