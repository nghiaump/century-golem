# ADR 0004 — Hàm lợi ích theo cấp; Very Hard = liên minh AI

- Trạng thái: Accepted (2026-11-14) · Quyết định của người dùng

## Bối cảnh
Người dùng muốn AI "tham lam", chặn chiến lược của người chơi, thậm chí hy sinh để counter. Research khuyến nghị AI không
phối hợp chống người chơi — trừ khi được công bố rõ.

## Quyết định
| Cấp | Utility | Ý nghĩa |
|---|---|---|
| Easy, Medium | Own: σ((v_i − trung bình đối thủ)/6) | tối đa điểm bản thân |
| Hard | BeatLeader: σ((v_i − max đối thủ)/6) | chặn ai đang dẫn (người **hoặc** AI) |
| Very Hard | Coalition: σ((max AI − max người)/6) cho mọi ghế AI | cả đội AI chống người chơi; có thể hy sinh |

Đối thủ là người luôn được mô hình như beat-the-leader. Ván kết thúc: điểm cuối chính xác, scale 2.5, hoà giải theo luật
ghế sau. Lobby ghi rõ ở Very Hard: "All AIs play as one team against you…"; state có cờ `coalition`.

## Hệ quả
- Với 1 AI, Very Hard không có liên minh ⇒ chỉ là search sâu hơn (lobby ghi rõ). Mục tiêu hiệu chỉnh 2 người VH>Hard ≥ 60%.
- Coalition test (proxy người vs 3 VH) là thước đo chính của Very Hard.

## Phương án đã loại
Liên minh ở cả Hard; không liên minh ở mọi cấp (người dùng chọn phương án hiện tại).

## Cập nhật 2026-11-15
Người dùng yêu cầu **bỏ dòng công bố liên minh** ở lobby ("All AIs play as one team…") và mô tả Very Hard chỉ còn
"The toughest opponents. Good luck." — người chơi chỉ cần biết đây là mức khó nhất. Hành vi liên minh giữ nguyên; cờ
`coalition` vẫn có trong state (không hiển thị).

