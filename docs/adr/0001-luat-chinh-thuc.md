# ADR 0001 — Engine theo luật chính thức

- Trạng thái: Accepted (2026-11-14) · Liên quan: plan `docs/plans/2026-11-14-ai-difficulty-levels.md`

## Bối cảnh
Engine upstream lệch luật Century: (1) hoà điểm ⇒ ghế **sớm** thắng (người chơi thường ngồi ghế 1 nên được lợi);
(2) mua lá market thứ k có đường "trả k vàng" làm crystal **biến mất** thay vì nằm lại trên các lá bên trái;
(3) last round luôn ở golem thứ 5 (luật gốc: 6 với 2–3 người). Ngoài ra nhiều bug: `HasAll` bỏ qua multiplier (trade
làm crystal âm), input âm từ client, validate deposit không cộng dồn + mutate dở dang, cho đi tiếp khi đang phải discard,
kết thúc ván trước khi ghế cuối discard, coin của người chơi alias đống coin của market.

## Quyết định
Người dùng chọn đưa cả 3 điểm về luật chính thức. Engine được viết lại theo mô hình **Validate (không mutate) → apply**,
với `Step` là hàm lượt duy nhất (action → pending discard → hết lượt / kết thúc ván). Client không gửi deposits ⇒ server
tự đặt crystal rẻ nhất (tương thích client cũ). Bug kỹ thuật sửa hết; có test cho từng điểm + fuzz invariant 2000 ván.

## Hệ quả
- Ván 2–3 người dài hơn (6 golem). UI market đổi nhãn "đặt k× crystal bất kỳ" (`placeCrystals`).
- AI, simulator, session dùng chung một ngữ nghĩa lượt (`Step`) ⇒ hết sai lệch giữa CLI và server.
- 2 test cũ (ngưỡng 5 golem) được thay bằng test ngưỡng 6/5.

## Phương án đã loại
Giữ luật upstream: AI vẫn làm được nhưng người chơi được lợi khi hoà và chiến thuật deposit sai bản chất game.
