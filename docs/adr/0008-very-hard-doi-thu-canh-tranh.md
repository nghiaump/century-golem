# ADR 0008 — Very Hard = đối thủ cạnh tranh, bỏ liên minh AI

- Trạng thái: Accepted (2026-11-15) · Quyết định theo phản hồi người dùng · Thay phần Very Hard của [ADR 0004](0004-ham-loi-ich-theo-cap-va-lien-minh.md)

## Bối cảnh
Very Hard ban đầu dùng utility **Coalition**: mọi AI chung một phần thưởng σ((max AI − max người)/6). Với hàm này, AI nào
thắng cũng như nhau, nên một AI sẵn sàng tự làm mình yếu đi để AI khác mạnh lên. Người dùng chơi thật và thấy đúng như vậy:
"AI rải ngọc to để lấy bài vô nghĩa, cố tình đưa ngọc to đó cho người đi lượt sau, dù vẫn còn ngọc nhỏ để lấy lá đó".
Người dùng muốn: *AI vẫn đặt mục tiêu là chiến thắng của riêng mình, có gây khó cho người chơi chính, nhưng không gian lận
vô lý như vậy.*

Đo lại cùng điều kiện với coalition test (người proxy Hard 100k iteration vs 3 VH 50k iteration, 4 người, 100 ván):
41.4% lượt AI mua bài có đặt crystal đắt hơn mức rẻ nhất có thể, và 285/374 lần như vậy người đi ngay sau nhặt luôn.

## Quyết định
Utility **Rival** cho Very Hard (`internal/ai/utility.go`):

- Giữa ván: `x = v_i − (0.7·max_j e_j + 0.3·mean_j e_j)`, với `e_j = v_j + 3` nếu ghế j là người, `= v_j` nếu là AI.
  - Phần max: chặn đối thủ mạnh nhất. Người được tính mạnh hơn 3 điểm, nên ai đang bám sát sẽ bị chặn trước.
  - Phần trung bình: "biếu" bất kỳ đối thủ nào, kể cả AI đang đứng sau, đều bị trừ.
- Cuối ván:
  - Thắng: `x = max(0.5, v_i − max v_j)`.
  - Thua: `x = min(−0.5, v_i − max(v_j + 1·[j là người]))`.
  - Thắng luôn tốt hơn thua. Thua người tệ hơn thua AI khoảng 1 điểm: khi buộc phải chọn, AI thà để AI khác thắng, nhưng không
    bao giờ đánh đổi chiến thắng của chính mình.
- Mỗi AI coi các AI khác là Rival như mình, coi người là beat-the-leader. **Không ghế nào chia phần thưởng với ghế khác.**
- `immediateWin` chỉ nhận nước làm chính AI đó thắng.
- Denial prior gồm người dẫn đầu (như Hard) cộng mọi người chơi đang trong vòng 3 điểm (edge) của mức đó.
- Bỏ intent `sacrifice`.
- `DecideOptions.Teams []int` đổi thành `Humans []bool`. Bỏ cờ `coalition` khỏi API và state.
- Hằng số `humanEdgeMid = 3`, `humanEdgeTerminal = 1`, `rivalLeadShare = 0.7` nằm ở đầu `utility.go`.

## Hệ quả (đo 2026-11-15, `docs/ai/tinh-chinh.md` §6)

| 4 người, người proxy vs 3 VH, 100 ván | Coalition (cũ) | Rival (mới) |
|---|---|---|
| Lượt AI mua bài có đặt crystal | 903 | 334 |
| Đặt crystal đắt hơn cần thiết | 41.4% (374) | **4.2%** (14) |
| …người đi ngay sau nhặt được | 285 | 6 |
| Người proxy thắng | 0.0% [0.0–3.7] | **21.0%** [14.2–30.0] |

- Very Hard vẫn khó hơn Hard: người proxy thắng 21% trước 3 VH so với 29% trước 3 Hard (phần chia đều là 25%). Khi chơi
  2 người, VH vs Hard vẫn là 62%: với 2 người, Rival trùng hệt BeatLeader. Đã kiểm bằng cách so ván cũ và mới trên cùng
  seed, kết quả giống hệt.
- Mất mức "0% thắng" do thông đồng. Nếu cần khó hơn mà vẫn công bằng: tăng `humanEdgeMid` (ví dụ 4–5) rồi đo lại bằng
  `aibench vshuman`.

## Phương án đã loại
- **Giữ Coalition, chỉ cấm "biếu" bằng luật cứng** (cấm đặt crystal đắt khi còn crystal rẻ): chữa triệu chứng. Hàm thưởng
  chung vẫn sinh ra các kiểu nhường khác, như nhường golem hay không đua coin với AI khác.
- **Very Hard = BeatLeader như Hard nhưng nghĩ lâu hơn**: công bằng, nhưng không còn "gây khó cho người chơi chính" như
  người dùng muốn.
- **Edge lớn (≥ 6)**: AI chặn người cả khi người đó đang đứng sau. Lối chơi lại gần với liên minh.
