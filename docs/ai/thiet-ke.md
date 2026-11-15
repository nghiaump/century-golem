# Thiết kế AI — chi tiết

> Tổng quan (EN): [`README.md`](README.md) · Quyết định: [`../adr/`](../adr/) · Nghiên cứu: [`research.md`](research.md)
> Mã: `src/golem/internal/ai/**`, `internal/game/{game,legal,clone}.go`, `internal/session/ai_turns.go`

## 1. Bản đồ mã

```
internal/game        engine tham chiếu: Validate/Step (lượt chuẩn), LegalActions, Clone, RedactDeckOrder
internal/ai/sim      simulator gọn (state giá trị ~300 B, pool lá không thứ tự, Apply 0 alloc) + chuyển đổi ↔ game.Action
internal/ai          profile.go (cấp, utility, tham số) · scheduler.go (pool luồng) · agent.go (interface)
                     eval.go (evaluator) · utility.go (reward theo cấp) · policy.go (prior + rollout)
                     mcts.go (cây open-loop) · search_agent.go (ensemble, chọn nước, discard, blunder guard)
                     intent.go (toast ý đồ — tắt mặc định, AI_INTENT_MESSAGES) · greedy.go (baseline cũ)
internal/ai/arena    giải đấu AI-vs-AI (+ aibench CLI)
internal/session     ai_turns.go: options, ghế, agent theo ghế, game loop có khoá, job AI, intent
```

Luồng một nước AI: `runGameLoop.onTick` (dưới lock) → `startAIJobLocked`: `Clone()` + broadcast `aiThinking` → goroutine
`agent.Decide(ctx, snap)` → ngủ nốt `AI_MIN_DELAY_MS` → `aiResults` → `onAIResult` (dưới lock): bỏ nếu `seq` cũ, `Step`
action (+ discard), gửi `aiIntent`, broadcast state → lưu event ngoài lock (bản clone).

## 2. Engine: Validate / Step

- `Validate(a)` không mutate, trả action **chuẩn hoá** (multiplier hợp lệ, deposits điền sẵn, upgrade copy). Mọi lỗi trả
  sentinel (`ErrMustDiscard`, `ErrBadDeposits`, …) — state không đổi.
- `Step(a)`: Validate → apply → nếu >10 crystal ⇒ `PendingDiscard`, **cùng người đi tiếp** (chỉ được Discard) → hết lượt:
  last round & ghế cuối ⇒ `finishGame` (duyệt ghế với `>=` ⇒ hoà thì ghế sau thắng), ngược lại `NextTurn`.
- Market sở hữu bản sao lá khi lá vào hàng (`ownMarketCard`) ⇒ lá trong deck/tay/golem bất biến ⇒ `Clone()` chỉ copy
  slice + lá market + coin. Người chơi nhận **bản sao** coin (không alias đống coin market).
- `LegalActions` dạng chuẩn: upgrade = mỗi vector kết quả 1 action (mã hoá tối giản bằng `UpgradeIO`), trade = mỗi
  multiplier, mua lá k = mỗi multiset k crystal (rẻ nhất đặt bên trái), discard = mỗi multiset.

## 3. Simulator (`ai/sim`)

- `State`: `P[5]Player{Res [4]int8, Hand/Played uint64, Golems, GolemPts, CoinPts, Pending}`, `Market[6]`+`MDep[6]`,
  `Row[5]`, `MPool/GPool` (lá chưa lộ, không thứ tự), `Copper/Silver`, `Turn/Round/LastRound/Over/Winner/Goal`.
- Chỉ số lá: merchant 0..42 = ID−1, 43 = `mint_0002`, 44 = `upgrade_2` (lá khởi đầu); golem = ID−101.
- `Apply(a, Drawer)` phản chiếu `game.Step`; refill gọi `Drawer.Merchant(n)/Golem(n)` (search: ngẫu nhiên; test: replay
  deck thật). `GenMode Search` giới hạn ≤2 biến thể deposit/ô, ≤3 discard.

## 4. Evaluator (`eval.go`) — đơn vị: điểm

Với mỗi ghế i (ván đã xong ⇒ điểm cuối chính xác):

```
phase φ = max golem / Goal (=1 ở last round);  λ = clamp((φ−0.6)/0.4, 0, 1)
v_i = banked
    + (1−λ)·CrystalLevel·Σlevel + λ·#crystal không vàng
    + Progress1·best + Progress2·second            # golem trên hàng, net = điểm + coin − giá trị crystal tiêu,
                                                    #   × Gamma^(turns−1), × Contested/Tied nếu đối thủ tới trước/cùng lúc
    + (1−φ)·Engine·min(Σ potential, EngineCap)      # potential = "step value" của lá
    − (1−φ)·ExtraCard·max(0, #lá − 8) − (1−φ)·Played·#lá đã chơi
```

- `turnsToAfford`: crystal thiếu được làm từ crystal **thừa** cao nhất bên dưới (chi phí = chênh level, tức upgrade) hoặc
  sản xuất mới (chi phí = level); tổng chi phí / tốc độ engine (trung bình 3 lá tốt nhất × n/(n+1) vì phải rest, ≥ 2).
- Ở last round chỉ tính golem lấy được trong số lượt còn lại (0 hoặc 1) ⇒ endgame chính xác.
- Progress1 < 1 ⇒ claim luôn có lãi một chút ⇒ AI không "ôm" golem mãi; vẫn có thể hoãn claim khi nước khác tăng giá trị hơn
  (claim như "cổ tức").
- `cardPotential`: produce = level output; upgrade = số bước; trade = (level ra − level vào) × số lần lặp vừa caravan 10.
  Khớp số liệu chuyên gia (YY>GG, P>BB = +10; YYY>GGG = +9; YYYYY>BBB = +8).

Trọng số hiện tại: xem `DefaultWeights` và lịch sử ở [`tinh-chinh.md`](tinh-chinh.md).

## 5. Utility (`utility.go`)

Reward mỗi ghế trong [0,1] = σ(x/scale), scale 6 giữa ván, 2.5 khi ván kết thúc (điểm chính xác):
Own `x = v_i − mean(v_đối thủ)` · BeatLeader `x = v_i − max(v_đối thủ)` ·
Rival (Very Hard) giữa ván `x = v_i − (0.7·max e_j + 0.3·mean e_j)` với `e_j = v_j + 1` nếu j là người, `v_j` nếu là AI
(+1 chỉ để **phân định khi ngang nhau**: người và AI mạnh nhất lệch dưới 1 điểm ⇒ người là đối thủ chính; AI dẫn rõ vẫn
là đối thủ chính); cuối ván Rival: thắng ⇒ `x = max(0.5, v_i − max v_j)`, thua ⇒ `x = min(−0.5, v_i − max(v_j + 0.25·người))`
(thắng luôn hơn thua; 0.25 < 1 điểm nên chỉ phân định hai đối thủ bằng điểm). Hằng số `humanTieMid/humanTieTerminal/
rivalLeadShare` ở đầu `utility.go`. Trước 2026-11-15 là +3/+1 — xem ADR 0008 (sửa đổi).
Hoà (x = 0) ở cuối ván được giải theo luật ghế sau. Góc nhìn (`perspective`): Easy/Medium coi mọi ghế là Own; Hard coi mọi
ghế là BeatLeader; Very Hard: AI khác = Rival (đối thủ như mình), người = BeatLeader; không biết ai là người
(`DecideOptions.Humans` nil, vd giải đấu 2 bot) ⇒ Rival không cộng edge — với 2 người trùng hệt BeatLeader.
**Không ghế nào chia sẻ phần thưởng với ghế khác** — bản "Coalition" cũ (max AI − max người, chung cho mọi AI) làm AI
"biếu" crystal cho AI đi sau và đã bị bỏ ([ADR 0008](../adr/0008-very-hard-doi-thu-canh-tranh.md)).

## 6. MCTS (`mcts.go`, `search_agent.go`)

- Mỗi worker một `tree` (node trong slice, nối bằng chỉ số `first/next`, ~64 B/node, cap `AI_MAX_NODES`), RNG PCG riêng.
- Iteration: copy state gốc → đi xuống: nút chưa mở ⇒ `expand` (prior = softmax(điểm evaluator sau nước + denial, τ=1);
  denial chỉ nhắm **một** ghế — đối thủ chính `perspective.mainRival`: người dẫn đầu, với Very Hard người chơi thay chỗ khi
  lệch AI mạnh nhất dưới `humanTieMid` — và chỉ khi ghế đó không kém mình quá 2 điểm);
  nút đã mở ⇒ thêm con cho nước mới xuất hiện do refill khác (prior nhỏ) → chọn PUCT trên các con **hợp lệ ở iteration này**
  (`avail++`, `U = c·prior·√avail/(1+visits)`, FPU = Q cha − 0.1) → tới nút mới ⇒ rollout → backup vector reward.
- Rollout: `RolloutTurns` vòng nước ε-greedy theo `fastScore` (claim > tăng level > mua lá tốt; phạt tràn caravan), gần cuối
  ván (VH) chạy tới hết ván; rồi `values` → `rewards`.
- Gốc: blunder guard (bỏ Rest khi chưa chơi lá nào), kiểm nước thắng ngay (`immediateWin`), chọn theo tổng visit (Medium:
  softmax visit^(1/τ)). Nước tràn caravan ⇒ chọn discard tốt nhất theo evaluator (`bestDiscard`).
- Dừng: hết ngân sách thời gian (kiểm mỗi 128 iteration) / `ctx` huỷ / đủ `Iterations` (test, giải đấu).

## 7. Mô hình đối thủ & intent (`intent.go`)

- `golemTargets(h)`: xác suất golem mục tiêu ∝ exp(0.6·(giá trị chiết khấu − max)), kèm số lượt cần.
- Intent (≤1/nước, không lặp cùng loại+mục tiêu trong 2 vòng):
  `took_target_golem` (claim golem người đó nhắm với P≥0.45, ≤2 lượt) · `block_coin` (claim ô có coin người đó sắp lấy) ·
  `took_wanted_card` (mua trade mạnh người đó đủ input dùng) · `rushing` (AI còn 1 golem là kích hoạt kết thúc). `Motive=true` khi denial thực sự đổi
  lựa chọn ⇒ chữ "is blocking" thay vì "grabbed … before you".

## 8. Giao thức WebSocket (thêm, tương thích ngược)

| Hướng | Message / field | Nội dung |
|---|---|---|
| S→C | `aiThinking` | `{playerID, level, budgetMs, timeout}` khi AI (hoặc AI chơi thay người hết giờ) bắt đầu nghĩ |
| S→C | `aiIntent` | `{playerID, playerName, targetPlayerID, kind, cardID, message}` chỉ tới người bị nhắm (+ spectator); `targetPlayerID=0` ⇒ broadcast |
| S→C | `state.players[].aiLevel` | `easy|medium|hard|veryhard` hoặc `""` |
| S→C | `state.{mode, turnTimeout, golemsToEnd, aiThinking}` | `aiThinking` = `{playerID, level, timeout}` hoặc `null` |
| S→C | `state.market.actionCards[].placeCrystals` | số crystal phải đặt (luật chính thức) |
| S→C | waiting state: `mode`, `numPlayers`, dòng AI `{isAI, aiLevel, aiIndex}` | phòng chờ hiện AI |
| S→C | `state.players[].canUndo` | người này vừa chơi lá làm tràn >10 crystal và chưa discard ⇒ được rút lại |
| C→S | `{type:"action", actionType:"undo"}` | rút lại nước chơi lá đó (chỉ lá bài, không phải mua bài — mua bài lật lá mới từ deck); event log ghi `type -2` |

## 9. Thêm cấp/thử nghiệm mới

1. Sửa `DefaultProfile` (profile.go) hoặc thêm trường; 2. `aibench variant`/`ladder` để đo; 3. ghi kết quả vào
`tinh-chinh.md`; 4. quyết định lớn ⇒ ADR mới. Đổi luật ⇒ sửa **cả** `internal/game` và `ai/sim` (differential test sẽ báo).
