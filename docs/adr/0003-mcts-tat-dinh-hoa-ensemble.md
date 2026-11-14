# ADR 0003 — MCTS open-loop determinized, ensemble theo worker

- Trạng thái: Accepted (2026-11-14) · Nguồn: `docs/ai/research.md` §2

## Bối cảnh
Thông tin ẩn duy nhất là thứ tự deck (tay bài công khai). Chance chỉ xảy ra khi refill market/hàng golem.

## Quyết định
- Mỗi worker một cây **open-loop**: mỗi iteration bắt đầu lại từ gốc và rút refill ngẫu nhiên từ pool lá chưa lộ ⇒ AI
  không thể nhìn deck thật (pool đã bị xoá thứ tự từ `sim.FromGame`). Nút con khớp theo `Action.Key()`; nước mới xuất
  hiện do refill khác được thêm động; chọn bằng **PUCT với availability count** (như ISMCTS).
- Prior = softmax điểm của evaluator đầy đủ (+ denial ở Hard/VH); rollout "nặng" bằng đặc trưng rẻ, ε-greedy, dài 1 vòng
  rồi cắt bằng evaluator; gần cuối ván (Very Hard) rollout tới hết ván.
- Max-n backup: mỗi nút lưu vector reward cho mọi ghế; người đi tại nút dùng thành phần của mình.
- Ensemble: N worker độc lập, gộp visit ở gốc, chọn nước nhiều visit nhất (Medium: softmax visit^(1/τ)).

## Hệ quả
Không cần ISMCTS đầy đủ; song song gần tuyến tính; worker trên core chậm chỉ đóng góp ít visit hơn.

## Phương án đã loại
ISMCTS lấy mẫu tay bài (thừa: tay bài công khai); minimax/BRS (nhánh lớn, chance node); RAVE (giá trị nước phụ thuộc
mạnh vào thời điểm/market).
