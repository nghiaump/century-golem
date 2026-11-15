# ADR 0008 — Very Hard = đối thủ cạnh tranh, bỏ liên minh AI

- Trạng thái: Accepted (2026-11-15), sửa đổi cùng ngày (xem cuối file) · Quyết định theo phản hồi người dùng · Thay phần Very Hard của [ADR 0004](0004-ham-loi-ich-theo-cap-va-lien-minh.md)

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
- Hằng số `humanEdgeMid = 3`, `humanEdgeTerminal = 1`, `rivalLeadShare = 0.7` nằm ở đầu `utility.go` (hai hằng số đầu đã đổi, xem sửa đổi 2).

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
- Mất mức "0% thắng" do thông đồng. (Gợi ý cũ "tăng `humanEdgeMid` lên 4–5 để khó hơn" đã bị bỏ: thiên vị lớn làm AI
  chặn người thay vì chơi để thắng — xem sửa đổi bên dưới.)

## Phương án đã loại
- **Giữ Coalition, chỉ cấm "biếu" bằng luật cứng** (cấm đặt crystal đắt khi còn crystal rẻ): chữa triệu chứng. Hàm thưởng
  chung vẫn sinh ra các kiểu nhường khác, như nhường golem hay không đua coin với AI khác.
- **Very Hard = BeatLeader như Hard nhưng nghĩ lâu hơn**: công bằng, nhưng không còn "gây khó cho người chơi chính" như
  người dùng muốn.
- **Edge lớn (≥ 6)**: AI chặn người cả khi người đó đang đứng sau. Lối chơi lại gần với liên minh.

## Sửa đổi 2026-11-15 (2) — người chơi chỉ phân định khi ngang nhau

**Bối cảnh.** Người dùng nhắc lại yêu cầu: *mục tiêu của mỗi AI luôn là chiến thắng của nó, không phải thắng để hại người
chơi; nhưng ở Very Hard, nếu mức độ đe doạ ngang nhau thì AI coi người chơi là đối thủ chính.* Phân tích ván
`single_1794710864973537105` (3 VH + người, 87 nước AI). Mỗi thế cờ được dựng lại và chạy lại agent với 200k iteration,
3 seed; 80/87 nước khớp nước đã đi thật. +3 điểm đổi 9/87 quyết định so với khi không thiên vị. Ca rõ nhất là nước 105:
Hammer Bro (31 điểm, kém Bowser 16 điểm) bỏ 5Y2G lấy golem 7 điểm đúng lúc người chơi có đủ crystal lấy nó. Không thiên
vị thì cả 3 seed đều mua lá upgrade x3 để xây máy.

Hai nguyên nhân:
- Cộng 3 điểm cho người khiến người thành "đối thủ mạnh nhất" cả khi một AI dẫn rõ.
- Denial prior đánh dấu mọi người không kém chính AI đó quá 5 điểm, kể cả khi người đó không dẫn đầu.

**Quyết định.**
- `humanEdgeMid 3 → humanTieMid 1` (người và AI mạnh nhất lệch dưới 1 điểm ⇒ người là đối thủ chính).
- `humanEdgeTerminal 1 → humanTieTerminal 0.25` (< 1 điểm, điểm cuối là số nguyên ⇒ chỉ phân định hai đối thủ bằng điểm).
- Denial prior chỉ nhắm **một** ghế: `perspective.mainRival`, tức người dẫn đầu (Very Hard: người chơi thay chỗ khi
  ngang), và chỉ khi ghế đó không kém mình quá 2 điểm. Hard không đổi.
- Test: `TestRivalUtility_PersonIsMainRivalOnlyOnATie` (AI dẫn rõ vẫn là đối thủ chính), `TestPerspective_MainRival`.

**Kết quả.** Chạy lại 9 nước bị ảnh hưởng bằng code mới (5 seed): nước 2, 59, 114 chọn giống hệt khi không thiên vị
(5/5). Nước 105 thành ca sát nút: mua bài 2/5, lấy golem 2/5, Rest 1/5, thay vì 3/3 lấy golem.

`aibench vshuman -seeds 25 -players 4 -iter-scale 0.25 -human-iters 100000` (100 ván mỗi cặp, cùng seed):

| Người proxy thắng (4 người) | vs 3 Hard | vs 3 VH |
|---|---|---|
| Rival +3/+1 (trước) | 29.0% [21.0–38.5] | 21.0% [14.2–30.0] |
| Rival phân định khi ngang (sau) | 29.0% [21.0–38.5] | **24.0%** [16.7–33.2] |

Very Hard vẫn khó hơn Hard. Mức chênh 21% → 24% nằm trong sai số; phần chia đều là 25%.

**Phương án đã loại.** Bỏ hẳn thiên vị (tie = 0): không đúng yêu cầu "ngang nhau thì coi người là đối thủ chính".
