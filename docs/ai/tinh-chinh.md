# Hiệu chỉnh độ khó AI

> Công cụ: `internal/ai/arena` + CLI `internal/ai/arena/aibench`. Thiết kế: [`thiet-ke.md`](thiet-ke.md) ·
> hiệu năng thật: [`hieu-nang.md`](hieu-nang.md) · nghiên cứu (phương pháp đánh giá): [`research.md`](research.md) §4.

## 1. Phương pháp

- Mọi ván chạy trên **engine tham chiếu** qua `game.Step` ⇒ nước AI sai luật làm hỏng lượt chạy (không âm thầm sửa).
- **Xoay ghế**: mỗi seed, bot A ngồi lần lượt mọi ghế (các ghế còn lại là B) ⇒ triệt tiêu lợi thế ghế; seed cố định.
- **Ngân sách theo iteration** (tất định, không phụ thuộc máy) quy đổi từ số đo thật trên Pixel (`hieu-nang.md`):
  Medium 5 000 (1 worker) · Hard 40 000 (2 worker) · Very Hard 200 000 (4 worker) mỗi quyết định.
  Kiểm thêm bằng **ngân sách thời gian** cho thay đổi làm đổi giá mỗi iteration (vd rollout dài hơn).
- Thống kê: tỉ lệ thắng + **khoảng tin cậy Wilson 95%**, Elo quy đổi, chênh điểm trung bình, số vòng trung bình.
  ~160 ván ⇒ ±7.5%; ~400 ván phát hiện được 55% vs 50%.
- Chặn ván treo: `arena.MaxRounds = 150` (ván thật 35–70 vòng) ⇒ ghi lỗi kèm trạng thái để điều tra.
- Mục tiêu (2 người): mỗi cấp thắng cấp dưới **≥ 70%**; Very Hard vs Hard **≥ 60%** (2 người không có liên minh);
  coalition test: "người proxy" thắng ít hẳn khi gặp 3 Very Hard so với 3 Hard.

## 2. Lệnh

```bash
# chạy trong golang:1.24, thư mục src/golem (xem CLAUDE.md) — rtx có 48 core: -parallel mặc định = số CPU
go build -o /tmp/aibench ./internal/ai/arena/aibench
/tmp/aibench variant -level medium -seeds 80 -iters 3000 -crystal 0.75 -cpuct 0.8   # A/B trọng số / tham số
/tmp/aibench ladder -seeds 100                                                       # các cặp cấp + baseline
/tmp/aibench coalition -seeds 25 -players 4 -iter-scale 0.25 -human-iters 100000     # liên minh Very Hard
/tmp/aibench tournament -a hard -b medium -players 4 -seeds 40 -iters-a 40000 -iters-b 5000
```
Cờ của `variant`: `-crystal -p1 -p2 -gamma -contested -engine -played -extracard -cpuct -eps -rollout`.

## 3. Lịch sử trọng số

| Vòng | Ngày | Thay đổi | Bằng chứng |
|---|---|---|---|
| 0 | 2026-11-14 | Trọng số khởi điểm (h_illes + NikhilMittal): CrystalLevel 0.6, Progress 0.75/0.25, Gamma 0.8, Contested 0.55, Engine 0.18, CPuct 1.25, RolloutTurns 1 | — |
| 1 | 2026-11-14 | **CrystalLevel 0.75, Progress2 0.35, CPuct 0.8, RolloutTurns 2** (mọi cấp search) | xem §4: tổ hợp thắng mặc định cũ 62.5% [56.9–67.8] (299 ván, 3000 it) và **59.8%** (199 ván, ngân sách thời gian 300 ms) |
| 1b | 2026-11-14 | `endWeight`: crystal tính theo giá trị chấm điểm ngay khi ai đó còn 1 golem là tới đích (trước: chỉ khi last round) | sửa **ván treo**: 2 AI ở goal−1 đều không chịu claim golem cuối vì claim làm "mất giá" crystal; sau sửa 0 treo / 560 ván |
| 1c | 2026-11-14 | Anti-stall từ vòng 100: claim tốt nhất, không có thì nước tiến gần golem nhất | lưới an toàn (1 ván treo / ~1800 ván AI-vs-AI: caravan toàn hồng, hàng golem cần xanh/vàng) |

## 4. Kết quả quét vòng 1 (Medium, 2 người, 3000 iteration, 160 ván/biến thể, so với mặc định vòng 0)

| Biến thể | Thắng | Ghi chú |
|---|---|---|
| CrystalLevel 0.45, Progress1 0.6 | 34.2% | crystal rẻ ⇒ claim vội ⇒ kém |
| CrystalLevel 0.5, Played 0.05 | 41.7% | |
| Gamma 0.7 | 55.0% | trong nhiễu |
| **CrystalLevel 0.7** | **60.6%** | tín hiệu rõ nhất |
| CrystalLevel 0.8 | 60.6% | |
| 0.7 + Engine 0.26 / 0.10 | 53.1% / 54.4% | không hơn 0.7 đơn lẻ |
| 0.7 + Progress1 0.9 | 49.1% | |
| 0.7 + Contested 0.4 | 49.7% | |
| 0.7 + Played 0.2 | 53.8% | |
| 0.7 + Progress2 0.4 | 57.5% | |
| **0.7 + CPuct 0.8** | **62.5%** | |
| 0.7 + CPuct 2.0 | 42.1% | khám phá quá nhiều |
| 0.7 + RolloutTurns 0 | 41.9% | rollout có ích |
| **0.7 + RolloutTurns 2** | **61.3%** | |
| 0.7 + Epsilon 0.05 | 60.8% | chưa áp dụng |

## 5. Thang cấp sau vòng 1 (2 người, 200 ván/cặp, ngân sách quy đổi Pixel)

| Cặp | Thắng (A) | Khoảng 95% | Elo | Chênh điểm | Vòng TB | Mục tiêu |
|---|---|---|---|---|---|---|
| Easy vs AI cũ (legacy BasicAI) | 62.5% | 55.6–68.9 | +89 | +6.9 | 59.0 | Easy > AI cũ ✓ |
| Easy vs greedy cũ | 54.5% | 47.6–61.3 | +31 | +1.1 | 61.5 | |
| Medium vs AI cũ | 100% | 98.1–100 | — | +33.5 | 58.3 | |
| Medium vs Easy | 100% | 98.1–100 | — | +34.1 | 54.2 | ≥ 70% ✓ |
| **Hard vs Medium** | **76.0%** | 69.6–81.4 | +200 | +10.5 | 42.3 | ≥ 70% ✓ |
| **Very Hard vs Hard** | **62.0%** | 55.1–68.4 | +85 | +2.9 | 40.5 | ≥ 60% ✓ |
| Hard vs Rusher | 100% | 98.1–100 | — | +32.6 | 62.3 | |
| Hard vs CoinChaser | 100% | 98.1–100 | — | +33.7 | 62.7 | |

Nhận xét: khoảng cách Easy → Medium rất lớn (Easy dành cho người mới, vẫn mạnh hơn AI cũ); Medium (mặc định) đã thắng
AI cũ 100% với +33 điểm. Ván giữa các cấp mạnh ngắn hơn (~40 vòng) — gần số liệu chuyên gia (30–40 lượt/ván 2 người).

## 6. Coalition test (4 người)

COALITION_RESULTS

## 7. Việc tiếp theo (gợi ý)

- Quét tiếp ở Hard/Very Hard (Contested, Engine theo phase, Epsilon) với ngân sách thời gian.
- Tách prior denial weight (0.5) thành tham số và đo ở coalition test.
- Theo dõi tỉ lệ thắng của người thật theo cấp (log `AI move` + kết quả ván) để chỉnh lại sau khi chạy thật.
