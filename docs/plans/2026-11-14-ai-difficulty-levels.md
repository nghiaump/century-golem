# Plan: AI thông minh 4 mức (Easy / Medium / Hard / Very Hard) + luật chính thức + refactor engine/session

> Ngày lập: 2026-11-14 · Repo: `/home/nghia/ai/rename-game` (GitHub `nghiaump/century-golem`) · Prod: pixel3xl (Pixel 3 XL, aarch64)
> Sau khi approve: archive nguyên văn file này vào `docs/plans/2026-11-14-ai-difficulty-levels.md` (bước đầu tiên của M0);
> mọi thay đổi plan về sau ghi vào mục **Revision log** cuối file archive.

## 1. Context
- Chơi 1 người với 3–4 AI hiện quá dễ thắng. `internal/game/ai.go` (`BasicAI`) là chuỗi ưu tiên cố định: claim golem
  đầu tiên mua được → chơi mọi lá theo thứ tự → mua lá market index 0 (miễn phí) → **gần như không bao giờ Rest**;
  không lookahead, không hàm đánh giá, không nhìn đối thủ; một `Engine.AI` dùng chung cho mọi ghế; không có difficulty.
- Mục tiêu: AI tham lam, tính trước, nhận diện chiến lược người chơi (rush về đích, đua coin đồng/bạc, golem đang nhắm)
  và **chặn/counter** (kể cả hy sinh); 4 mức; Very Hard thực sự khó về nhất.
- Kèm: refactor theo best practice nơi cần (engine nhiều bug luật, không clone/không sinh nước đi; session loop chạy AI
  không khoá — data race); tối ưu đơn giản để chạy tốt trên **ARM (Pixel 3 XL: 4 core lớn ~2.5 GHz + 4 nhỏ, 3.5 GB RAM)**.
- Thiết kế per-seat ngay từ đầu để sau này mở **phòng trộn N người + M AI (tổng ≤ 5)**.

## 2. Quyết định đã chốt với người dùng
| Chủ đề | Quyết định |
|---|---|
| Utility theo mức | Easy/Medium: tối đa điểm bản thân · Hard: **beat-the-leader** (chặn ai đang dẫn, người hay AI) · **Very Hard: liên minh AI chống người chơi** (team utility, có thể hy sinh để chặn) — lobby ghi rõ |
| Luật chính thức | Hoà ⇒ **người đi sau thắng** · mua market = **đặt 1 crystal (màu bất kỳ) lên mỗi lá bên trái**, crystal nằm lại (bỏ đường "trả N vàng biến mất"; giữ fallback tự đặt crystal rẻ nhất nếu client không gửi) · last round ở **golem thứ 6 khi 2–3 người**, thứ 5 khi 4–5 người. Bug kỹ thuật sửa hết |
| Thời gian nghĩ | Very Hard **3 s/nước cố định** (4 worker) · Hard ~1.4 s (2) · Medium ~0.3 s (1) · Easy greedy · delay tối thiểu 0.8 s chồng lên lúc nghĩ |
| Ghế | **Random ghế** trong 1 người (luật gốc random người đi đầu) |
| Deck trong API | **Ẩn thứ tự deck** ở `/api/events`, `/api/snapshot` khi ván đang chạy (dữ liệu Mongo giữ nguyên) |
| Lobby | Một mức cho mọi AI, mặc định **Medium** (nhớ lựa chọn trong localStorage) |
| UI | Badge mức AI (thay "(offline)") · "AI đang nghĩ…" · AI trong phòng chờ kèm mức · **toast ý đồ AI** |
| Docs | Song ngữ: English cho README + `docs/ai/README.md`; Tiếng Việt cho thiết kế chi tiết/ADR/tuning/runbook |
| Rollout | Test pass ⇒ xem `/api/list` ⇒ rebuild trên pixel3xl ⇒ smoke public ⇒ merge + push GitHub |
| Lưu vết | Archive plan vào `docs/plans/` (như đầu file) |

## 3. Research — điểm chính (chi tiết + link ⇒ `docs/ai/research.md`)
- Century gần như **thông tin hoàn hảo + chance**: tay bài/lá đã chơi công khai, chỉ ẩn thứ tự deck ⇒ không cần ISMCTS
  đầy đủ; dùng MCTS **determinized/open-loop, re-sample phần deck chưa lộ mỗi iteration**; AI không bao giờ đọc deck thật.
- Splendor (Kowalski/Winands 2026): leaf bằng heuristic, không random rollout; **ensemble ~5 cây** (mỗi cây deck riêng)
  gộp visit tốt nhất @1 s. Rinascimento/TAG: rollout ngắn khi điểm thay đổi thường xuyên; dense shaping.
- Multiplayer: **max-n backup** (vector reward) tốt nhất cho MCTS; utility biến đổi theo mức (own / leader / coalition).
- Heuristic chuyên gia (h_illes, BGA, >5000 ván): giá crystal 1/2/3/4; "step value" của lá (starter ≈ +2/lượt, trade tốt
  +8..+10); có ít nhất 1 trade mạnh sớm, phủ màu vào/ra, tránh trùng input, ngừng draft khi combo chạy; claim như "cổ tức",
  giữ ~4 crystal cao để restart; đua coin (dẫn tempo ⇒ nhắm 3 đồng); deny lá hoàn thiện combo đối thủ; endgame attacker/
  defender. Bot mở NikhilMittal/century-spice-road có bộ trọng số khởi điểm.
- Độ khó best practice: cùng engine, khác ngân sách/nhiễu softmax/mô hình đối thủ/utility; **blunder guard** mọi mức;
  không ăn gian; hiệu chỉnh bằng giải đấu xoay ghế + seed cố định (≥400 ván/cặp ⇒ phát hiện 55% vs 50%).

## 4. Kiến trúc tổng thể
```
game (engine tham chiếu, luật chuẩn)  ←  ai/sim (state gọn, zero-alloc)  ←  ai (eval, model, MCTS, agent)  ←  session  ←  server
                                                                         ai/arena (+ aibench CLI) dùng ai, ai/sim, game
```
- `internal/game` là **nguồn sự thật duy nhất** cho ván thật; `ai/sim` là bản luật gọn cho search, giữ đồng nhất bằng
  **differential fuzz test** chạy trong test suite.
- AI không giữ lock, không chặn game loop: snapshot (Clone) dưới RLock → nghĩ ở goroutine riêng → loop áp dụng dưới Lock.
- **Không đổi `go.mod`/`package.json`, không đụng `cmd/`** (regen-patches chỉ bắt `internal/` + `web/react-frontend/src`):
  chỉ dùng stdlib (`math/rand/v2` PCG, `context`, `sync/atomic`); CLI benchmark đặt ở `internal/ai/arena/aibench`
  (package main hợp lệ trong internal, vào patch 0003, không build vào image prod).

## 5. Milestones (mỗi mốc kết thúc ở trạng thái kiểm chứng được)

### M0 — Chuẩn bị & baseline (không đổi hành vi)
- Archive plan → `docs/plans/2026-11-14-ai-difficulty-levels.md`; tạo `docs/README.md` (index song ngữ) trỏ tới nó.
- Branch git `feat/strong-ai`.
- Đo baseline: `go test -race -count=1 ./internal/...` từng package (session: số FAIL/race), `go vet ./...`,
  vitest trên **bản sao** (`npm ci` + `npx vitest run --environment jsdom`). Ghi vào nháp `docs/upstream-changes.md` §Test.

### M1 — Engine đúng luật & sẵn sàng cho search (`src/golem/internal/game`)
Sửa: `resources.go`, `game.go`, `market.go`, `player.go`, `engine.go`, `ai.go`; mới: `errors.go`, `clone.go`, `legal.go`.
- `resources.go`: `HasAll` nhân multiplier; `NonNegative()`; chặn input âm (client gửi số âm hiện làm *tăng* crystal) + cap multiplier.
- `game.go`:
  - `Validate(a) (Action, error)` (không mutate, trả action chuẩn hoá) · `Step(a) (StepResult, error)` = **hàm lượt duy nhất**:
    game over? → đang PendingDiscard mà không phải Discard ⇒ lỗi → Validate → apply → >10 crystal ⇒ PendingDiscard, chưa hết
    lượt → LastRound & ghế cuối ⇒ GameOver (winner duyệt ghế theo thứ tự với `>=` ⇒ **người sau thắng hoà**) → NextTurn.
    Sửa luôn "game over trước khi ghế cuối discard". `ExecuteAction` giữ cho caller cũ (Validate + apply).
  - `StepResult{Applied, TurnEnded, PendingDiscard, LastRoundTriggered, GameOver}` (Applied = action đã chuẩn hoá, lưu event).
  - Acquire luật chính thức: k = index; thiếu deposits & k>0 ⇒ `AutoDeposits` (màu rẻ nhất, đặt trái→phải); số deposit ≠ k ⇒ lỗi;
    kiểm **cộng dồn** theo màu; rồi trừ deposits → lấy deposits của lá đích → **xoá Deposits lá đích** → bỏ lá + refill → đặt
    deposit lên các lá bên trái → cộng crystal nhặt được. Xoá đường "trả vàng biến mất".
  - `GolemsToEnd()` = 6 nếu ≤3 người, ngược lại 5; claim dùng nó. Bỏ `Player.CheckLastRound` (chỉ test dùng).
- `market.go`: `CrystalsToPlace(pos)`; `GetActionCardCost` deprecated (serializer/CLI còn dùng).
- `clone.go` `Clone()`: deep-copy players/Resources/mọi slice/market action cards (+Deposits)/2 coin card (player.Coins
  trỏ lại coin clone theo ID); share con trỏ card bất biến; Winner remap theo index. Test băm card table để bảo đảm bất biến.
- `legal.go`: `LegalActions()`, `AppendLegalActions(dst, LegalOptions)`, `UpgradeResults` (dedupe theo vector kết quả),
  `UpgradeIO`, `DepositMultisets`, `DiscardOptions`; trade = 1 action/multiplier 1..max; PendingDiscard ⇒ chỉ Discard.
- `engine.go` `Run` dùng `Step` (cmd/game vẫn biên dịch); `BasicAI` giữ làm baseline "legacy".
- Test mới: `rules_official_test.go`, `step_test.go`, `clone_test.go`, `legal_test.go`, `invariants_test.go` (fuzz 10k ván:
  kết thúc ≤400 step, không crystal âm, ≤10 cuối lượt, mỗi card đúng 1 chỗ, bảo toàn crystal, card table bất biến).
  Thay 2 test hỏng theo thiết kế (`…TriggerLastRound` 2p-5 golem, `TestGameRules_WinCondition`).
- **Xong khi**: `go test -race ./internal/game/` xanh; `go build ./... && go vet ./...` xanh.

### M2 — Khung AI + tích hợp session/server (Easy chạy end-to-end)
Package mới `src/golem/internal/ai` (chỉ import `internal/game`):
- `profile.go`: `Level` (Easy/Medium/Hard/VeryHard, `ParseLevel` nhận "veryhard|very_hard|very-hard"), `UtilityKind`
  (Own/BeatLeader/Coalition), `Profile{Level, Utility, Search, Budget, Workers, RootTemp, RootWindow, Epsilon,
  RolloutTurns, OppModel, CPuct, MaxNodes, EndgameToTerminal}`, `DefaultProfile`, `Scaled(pct)`.
- `agent.go`: `Agent.Decide(ctx, snap *game.GameState, DecideOptions{Seat, Teams, Seed, Iterations}) (Decision, error)`;
  `Decision{Action, Discard, Intents, Stats}`; `FromStrategy` (bọc RestOnly/Basic), `AsStrategy` (cho CLI).
- `scheduler.go`: `Scheduler` token pool toàn server (`Acquire(ctx, want)` chờ 1 token, lấy thêm không chờ); `Runtime{Sched, ScalePct, MaxNodes, MinDelay}`.
- `greedy.go`: Easy (1-ply trên engine tham chiếu, eval tạm) — tạm map mọi mức về greedy ở M2.

Session (`internal/session/session.go` + mới `options.go`, `ai_turns.go`):
- Options pattern (không đổi chữ ký ~36 `NewGameSession` / ~18 `CreateSessionV2`): `WithSinglePlayer(levels)`,
  `WithAIRuntime(rt, pauseWhenEmpty)`, `WithAgentFactory` (test), `ApplyOptions`; `Mode` (Unset/Multi/Single) + fallback prefix `single`.
- Field mới: `agents map[playerID]ai.Agent`, `timeoutAgent` (1 người: Medium chơi cho chính ghế đó; nhiều người: giữ RestOnly),
  `seed`, `stepSeq`, `ctx/cancel`, job AI đang bay + `aiResults chan` (cap 1). Bỏ field `Engine`.
- `StartGame`: lưu seed; 1 người ⇒ **random ghế người**; AI đặt tên "AI 1..n" theo ghế; Coalition: mọi AI cùng team 1, mỗi người 1 team.
- `runGameLoop` viết lại (select stop / ActionChan / aiResults / ticker):
  - tick: chưa có job ⇒ khởi job cho ghế AI; người hết giờ ⇒ job timeout + broadcast `turnTimeout`. Grace lượt đầu chỉ áp cho
    người (**sửa treo khi AI ngồi ghế 1**).
  - job: Clone dưới RLock → goroutine `Decide(ctx)` → ngủ nốt phần còn lại của MinDelay → gửi kết quả.
  - kết quả: bỏ nếu `seq != stepSeq`; dưới Lock: `applyLocked` + discard (AI chọn / `AutoDiscard`); action lỗi ⇒ fallback nước
    hợp lệ tốt nhất → Rest (log warn); broadcast; gửi intent cho người bị nhắm; **lưu event ngoài lock bằng bản clone**.
  - người đi xong ⇒ huỷ job đang bay. `applyLocked` thay `advanceTurn`/`executeAITurn`/`handleAIDiscard`.
- `handlePlayerAction`: đọc playerID dưới RLock rồi nhả; gửi `select{ActionChan<-; <-stop; default: lỗi "server busy"}` (hết deadlock RLock).
- `Close`: thêm `cancel()` (search dừng trong ~128 iteration). `AI_PAUSE_WHEN_EMPTY`: phòng không còn kết nối ⇒ AI/timeout ngừng.
- `serializeState` (chỉ thêm field): player `aiLevel`, `online: pi!=nil || IsAI`; top-level `mode`, `turnTimeout`, `golemsToEnd`,
  `coalition`; market card `placeCrystals`; waiting payload: `mode`, `numPlayers`, dòng AI `{name, isAI, aiLevel, aiIndex}`.
- WS mới: `aiThinking {playerID, level, budgetMs, timeout}` (broadcast), `aiIntent {playerID, targetPlayerID, kind, cardID, message}` (tới người bị nhắm + spectator).

Server/config/API:
- `server.go`: tạo `aiRuntime` từ config trong `NewGameServer`; `CreateSessionV2` luôn áp `WithAIRuntime`; thêm `createSession(..., opts...)`.
- `handlers.go` `/api/single`: `{numAI 1..4, difficulty? (mặc định "medium", sai ⇒ 400), aiLevels? (không UI), sessionID?, turnTimeout?, seed?}`;
  ID custom ép tiền tố `single_`; response thêm `difficulty`, `coalition`, `aiLevels`. Tương thích ngược `{"numAI":1}` (smoke).
- `admin_handlers.go`: `/api/events`, `/api/snapshot` **redact thứ tự deck** (sort theo ID) cho ván còn trong RAM & chưa kết thúc.
- `config.go`: `AI_MAX_THREADS` (0=auto min(4, NumCPU/2)), `AI_THINK_SCALE_PCT` (100, 10–300), `AI_MIN_DELAY_MS` (800),
  `AI_MAX_NODES` (200000), `AI_PAUSE_WHEN_EMPTY` (1).
- Thiết kế sẵn (chưa làm) cho phòng trộn: `/api/create` thêm `aiSeats:[{level}]`, humans = numPlayers − len(aiSeats) ≥ 1, random ghế, coalition = AI team vs người.
- **Xong khi**: `internal/session/ai_session_test.go`, `internal/server/single_ai_test.go` xanh; session FAIL/race ≤ baseline M0;
  stack local trên rtx (tunnel tắt) chơi hết ván với AI greedy; `smoke-test.sh http://127.0.0.1:8400` pass.

### M3 — Simulator gọn `internal/ai/sim` + cổng benchmark
- `cards.go`: bảng tĩnh sinh từ `game.CreateDefaultActionCards/PointCards/InitialActionCards` (một nguồn dữ liệu card).
- `state.go`: `Crystals [4]int8`; `Player{Res, Hand, Played uint64, Golems, GolemPts, CoinPts}`; `State{P [5]Player, N, Turn, Round,
  LastRound, Over, Winner, Goal, Market [6]uint8, MDep [6]Crystals, Golems [5]uint8, MPool/GPool (lá chưa lộ, không thứ tự), Copper, Silver}`
  (~300 B, copy ~15 ns, 0 alloc). `FromGame(gs)` sort pool theo ID ⇒ **xoá thứ tự deck thật**.
- `actions.go`: `Action{Kind, Card, Mult, Vec, Discard}` + `Key() uint64`; `AppendLegal(dst, Full|Search)` (Search: ≤2 biến thể deposit, discard ≤3 ứng viên).
- `step.go`: `Apply(a, rng)` đủ luật (coin, end trigger, hoà ⇒ ghế sau); refill rút ngẫu nhiên từ pool (swap-remove).
- `internal/ai/convert.go`: sim action → `game.Action` (tìm index theo card ID; upgrade qua `game.UpgradeIO`), luôn `Validate` trên snapshot.
- **Xong khi**: differential fuzz 2.000 seed × 2–5 người (random + greedy) khớp mọi field sau từng step; tập nước đi khớp engine (Full);
  benchmark `GameCloneStep` vs `SimCopyApply` + playout 1 vòng chạy trên rtx **và trên Pixel** (cross-compile `go test -c`), ghi ADR-0002.

### M4 — AI mạnh (`internal/ai`: cardvalue, planner, eval, utility, model, policy, mcts, ensemble, guard, intent)
- **Evaluator** (đơn vị điểm, `Weights` tune ở M6): điểm đã có (golem+coin) · crystal `(1−λ)·0.7·Σlevel + λ·#non-yellow` (λ tăng khi gần
  kết thúc) · tiến độ golem (best + 0.3·second: điểm·0.85^turnsToAfford·(1−P đối thủ lấy trước)) · đua coin · giá trị engine
  (potential từng lá, phạt >7 lá, trùng input, "cần rest") · endgame (LastRound hoặc ai đó ≥ Goal−1 golem ⇒ rollout tới hết ván).
- **Planner**: ước lượng nhanh turns-to-afford trong search; beam search chính xác (H≤4, width 8) cho opponent model/intent/endgame.
- **Utility** (reward [0,1], backup vector max-n): Own `v/60` · BeatLeader `σ((vᵢ − max khác)/6)` · Coalition `σ((best AI − best người)/6)`
  cho mọi ghế AI · người luôn được mô hình như beat-the-leader · terminal: thắng=1 (áp luật hoà).
- **Opponent model** (Hard/VH; luôn tính rẻ cho intent): P(golem mục tiêu) ∝ exp(β·điểm·γ^t), cập nhật theo snapshot trước (thiếu hụt
  nào giảm), decay 0.7; rush index; coin-chasing. Dùng cho: policy đối thủ trong rollout, **denial bonus** trong prior (Hard: chỉ với
  người dẫn đầu; VH: chỉ với người chơi), intent.
- **MCTS**: node pool cấp sẵn theo worker (index int32, ~52 B/node, cap 200k ⇒ ~10 MB/worker); PUCT + availability counts (mỗi iteration
  sinh legal set của state đã sample); FPU = Q cha − 0.1; prior = softmax điểm policy 1-ply; rollout ε-greedy 0–1 vòng rồi eval; check
  deadline/ctx mỗi 128 iteration; **mỗi worker một cây + deck sample riêng**, chọn nước theo tổng visit.
- **Profiles** (nhân `AI_THINK_SCALE_PCT`):

| Mức | Utility | Search | Budget | Worker | Chọn nước | Opp model | ε |
|---|---|---|---|---|---|---|---|
| Easy | own | greedy 1-ply | ~0 | 0 | softmax τ=1.5 trong cửa sổ 3 điểm | off | – |
| Medium | own | MCTS | 0.3 s | 1 | softmax τ=0.4 theo Q | off | 0.25 |
| Hard | beat-leader | MCTS | 1.4 s | 2 | max visit | on | 0.15 |
| Very Hard | coalition | MCTS + endgame tới hết ván | **3.0 s** | 4 | max visit | on | 0.10 |

- **Blunder guard** (mọi mức): luôn lấy claim thắng ván; tránh tràn vô ích; không rest khi chưa chơi lá nào; không mua ở last round trừ khi lời.
- **Intent** (≤1/nước AI, không lặp cùng loại+mục tiêu trong 2 lượt người): `took_target_golem`, `block_coin` (chỉ nói "chặn" khi denial
  thực sự đổi lựa chọn), `took_wanted_card`, `sacrifice` (VH: lợi ích bản thân <0 và denial > own), `rushing`. Chuỗi hiển thị tạo ở session.
- **Xong khi**: scenario test pass (§7); gate ngắn trong `arena_test`; trên Pixel p95 latency ≤ budget + 150 ms; RAM thêm < 80 MB khi 4 search chạy.

### M5 — Frontend (`src/golem/web/react-frontend/src`, không thêm npm package)
- Lobby/phòng chờ (XP): `SinglePlayerLobby.jsx` đổi `difficulties`→`opponentCounts`, thêm radio `xp-list` chọn mức (mặc định Medium,
  localStorage) + mô tả 1 dòng; chọn VH hiện `xp-note`: "Mọi AI chơi như một đội chống bạn và có thể hy sinh điểm để chặn bạn; điểm
  cao nhất vẫn thắng. Với 1 AI, Very Hard = tìm kiếm sâu hơn". POST `{numAI, difficulty, seed}`. `XpWaitingRoom.jsx`: dòng AI + badge
  mức, key `${name}-${i}` (sửa key trùng).
- Bàn chơi (giữ style upstream/Tailwind): mới `AiLevelBadge.jsx` dùng ở `PlayerCard.jsx`, `PlayersInfoBar.jsx`, `GameOverModal.jsx`,
  `desktop/FantasyGameLayout.jsx`; "(offline)"/chấm xám chỉ cho người; mới `AiThinkingIndicator.jsx` (thay TimerRing ở ghế AI, cả
  "Waiting…" `WebGameLayout.jsx` và "'s Turn" `FantasyGameLayout.jsx`); `TimerRing` đọc `gameState.turnTimeout`.
- `store/gameStore.js`: xử lý `aiThinking`, `aiIntent` (toast loại `ai`, 4.5 s), `turnTimeout`; `Toast.jsx`/`utils/toast.js` thêm loại `ai`.
- Market: `canAfford` + nhãn chi phí dùng `placeCrystals` ("k× crystal bất kỳ") ở `WebGameLayout.jsx`, `CompactGameBoard.jsx`,
  `FantasyMarketArea.jsx`, `CompactCard.jsx`. GameOver: ghi chú thắng hoà do đi sau. `utils/avatar.js` dùng `aiIndex`; mới `utils/aiLevel.js`.
- **Xong khi**: vitest trên bản sao pass (`utils/aiLevel.test.js`, `SinglePlayerLobby.test.jsx` kiểm body có `difficulty`, test store
  `aiIntent`; lỗi có sẵn không tăng); playwright (playwright-core sẵn có + `/usr/bin/google-chrome`) chạy lobby → phòng chờ có AI →
  badge → thinking → toast, lưu screenshot (cập nhật ảnh README).

### M6 — Hiệu chỉnh độ khó
- `internal/ai/arena/{match,bots,stats,positions,arena_test}.go` + CLI `internal/ai/arena/aibench` (`tournament | bench | selfplay`).
  Ván chạy trên `game.GameState` qua `Step` (mọi nước AI được engine tham chiếu kiểm; nước lỗi ⇒ fail). Xoay ghế trên cùng seed.
  Baseline: Random, Greedy, Rusher, CoinChaser, Legacy(`BasicAI`). Output: Wilson 95%, chênh điểm, Elo, iterations/s.
- Ngân sách tính theo **iteration tương đương Pixel** (đo bằng `aibench bench` trên Pixel) để giải đấu trên rtx (48 core) phản ánh prod.
- Mục tiêu (2p, ≥400 ván/cặp): Medium>Easy ≥70% · Hard>Medium ≥70% · VeryHard>Hard ≥60% (2p không có liên minh) · mọi mức vs Random ≈100%;
  thêm 100 ván 4p. **Coalition test**: "proxy người" (beat-leader, 2× budget VH) vs 3 VH ⇒ tỉ lệ thắng ≤10%, thấp rõ so với vs 3 Hard.
- Tune trọng số (SPSA/coordinate) ở budget rẻ rồi xác nhận ở budget thật. **Xong khi**: bảng kết quả + trọng số cuối ở `docs/ai/tinh-chinh.md`.

### M7 — Docs + patch workflow + ops
- Patch: đổi tên theo phạm vi (`git mv`, **xoá file cũ** kẻo sanitize áp 2 lần): `0002-frontend.patch`, `0003-backend.patch`; sửa
  `deploy/regen-patches.sh` (dòng 4, 21–22). Không cần 0004 (không đụng `cmd/`).
- `deploy/docker-compose.yml` (service server): `AI_MAX_THREADS=4`, `AI_THINK_SCALE_PCT=100`, `AI_MIN_DELAY_MS=800`,
  `AI_MAX_NODES=200000`, `AI_PAUSE_WHEN_EMPTY=1`, `GOMEMLIMIT=512MiB` (comment tiếng Việt).
- `deploy/smoke-test.sh`: giữ `{"numAI":1}`; thêm `{"numAI":2,"difficulty":"veryhard"}` (kỳ vọng echo) + difficulty sai ⇒ 400.
- Docs (xem §8). **Xong khi**: `./regen-patches.sh` in REPRODUCIBLE; smoke + privacy-audit exit 0 local.

### M8 — Rollout (đã được duyệt sẵn)
1. Pixel: `curl /api/list` + log xem có ván đang chơi (rebuild server = mất ván).
2. rsync code sang Pixel (runbook §11) → `DOCKER_BUILDKIT=1 docker compose up -d --build --no-deps server` rồi `web`.
3. smoke-test (local Pixel + public domain) + privacy-audit trên Pixel.
4. Chơi 1 ván vs 4 VH, theo dõi `docker stats`, nhiệt độ `/sys/class/thermal`, trạng thái sạc.
5. Merge `feat/strong-ai` → `main`, push `git@github.com:nghiaump/century-golem.git` (commit kèm dòng Co-Authored-By).

## 6. Tối ưu cho ARM (Pixel 3 XL)
Simulator zero-alloc + node pool cấp sẵn · token pool toàn server = số core lớn (search theo deadline ⇒ core nhỏ chỉ giảm số iteration) ·
không nghĩ trong lượt người (nhiệt/pin) · ngừng AI khi phòng trống · event store ghi bản clone ngoài lock · `GOMEMLIMIT` · 1 dòng log
info/quyết định AI · tham số `AI_THINK_SCALE_PCT` để hạ tải nếu máy nóng.

## 7. Kiểm thử & xác minh
- `internal/game`: HasAll×multiplier & input âm; acquire (deposit nằm lại, nhặt deposit, xoá deposit lá mua, fallback rẻ nhất, sai số lượng,
  thiếu cộng dồn ⇒ state không đổi — so JSON clone trước/sau); discard chặn action khác, discard kết thúc lượt, discard ghế cuối kết thúc ván;
  ngưỡng golem 2/3/4/5 người; hoà ⇒ ghế sau; Step sau game over lỗi; Clone độc lập; mọi legal action áp được, không trùng kết quả, upgrade
  = brute force `CanUpgraded`; fuzz invariant.
- `internal/ai`: differential sim↔engine; legal set khớp; planner đúng trên thế cờ dựng tay; eval đơn điệu; search tất định với iteration
  cố định, tìm được nước thắng ngay, trả về ≤50 ms sau cancel, tôn trọng node cap, **không nhìn deck** (2 snapshot chỉ khác thứ tự deck ⇒
  cùng quyết định); scheduler không vượt cap (64 goroutine, `-race`).
- Scenario: (1) người còn 1 lượt tới golem 15 điểm ⇒ Hard (người dẫn) & VH lấy trước; (2) chặn coin đồng cuối; (3) người ở Goal−1 golem ⇒ AI
  kết thúc ván hoặc chặn; (4) ghế cuối endgame tối đa điểm cuối; (5) blunder guard; (6) coalition hy sinh; (7) intent đúng loại/mục tiêu.
- Session (agent giả qua `WithAgentFactory`): AI ghế 1 đi trước được; `GetSerializedState` vẫn phản hồi khi agent đang nghĩ; `Close` khi
  đang nghĩ ⇒ cancel, không rò goroutine; bỏ kết quả cũ; MinDelay; không double action khi PendingDiscard; timeout lúc PendingDiscard ⇒ discard;
  thứ tự discard ghế cuối/last round; field payload; `aiIntent` chỉ tới người bị nhắm; mode vs prefix; timeout policy single/multi; pause khi trống.
- Server: parse difficulty + field response; redact deck ở `/api/events`/`/api/snapshot`.
- Ops: smoke (local, Pixel, public), privacy-audit, playwright UI flow.
- Hiệu năng Pixel: `aibench bench` p50/p95 latency, iterations/s, RAM đỉnh; 30 quyết định VH liên tiếp (throttling); 1 ván thật.
- Lệnh test Go (Docker, theo CLAUDE.md): `docker run --rm -v "$PWD/../src/golem":/src:ro -v golem-gomod:/go/pkg -v golem-gocache-deb:/root/.cache -w /src -e GOFLAGS=-buildvcs=false golang:1.24 go test -race -count=1 ./internal/...`

## 8. Tổ chức tài liệu (song ngữ)
- `docs/README.md` (mới): index — mỗi tài liệu 1 dòng EN + VI.
- `docs/plans/2026-11-14-ai-difficulty-levels.md`: archive plan này + Revision log.
- EN: `docs/ai/README.md` (các mức, cách AI nghĩ, cam kết không nhìn deck, công bố liên minh VH, env vars, hiệu năng Pixel); `docs/ai/research.md`
  (tổng hợp research + link); `README.md` (Features: mức AI; How to play: luật đã sửa — golem 6/5, hoà; Configuration: env AI; API: `difficulty`; Known issues).
- VI: `docs/ai/thiet-ke.md` (sim, legal moves, MCTS, eval, model, intent, scheduler, session, giao thức WS) · `docs/ai/tinh-chinh.md` (phương pháp,
  lệnh, kết quả, lịch sử trọng số) · `docs/ai/hieu-nang.md` (benchmark Pixel) · ADR `docs/adr/`: `0001-luat-chinh-thuc.md`,
  `0002-trang-thai-tim-kiem-gon.md`, `0003-mcts-tat-dinh-hoa-ensemble.md`, `0004-ham-loi-ich-theo-cap-va-lien-minh.md`,
  `0005-gioi-han-luong-ai-toan-server.md`, `0006-bo-cuc-patch-va-cong-cu.md`, `0007-random-ghe-va-an-deck-api.md`.
- Cập nhật: `docs/architecture.md` (thành phần AI, khoá loop, WS mới) · `docs/runbook.md` (§12 AI: env, hạ budget, bench trên Pixel, theo dõi CPU/nhiệt) ·
  `docs/upstream-changes.md` (đổi tên patch, mục luật/AI/session, số test trước–sau) · `docs/privacy.md` (AI chạy local; ẩn deck API) ·
  `CLAUDE.md` (tên patch, env AI, docs mới, bẫy: không đổi go.mod/package.json, xoá patch cũ khi đổi tên) · `deploy/README.md`.

## 9. Rủi ro & giảm thiểu
- Hai bộ luật (engine ↔ sim) lệch nhau ⇒ differential fuzz trong test suite thường trực.
- Pixel nóng/hết pin (lúc chuyển máy đang chạy pin) ⇒ token cap + `AI_THINK_SCALE_PCT`, hướng dẫn trong runbook.
- Hiệu chỉnh tốn compute (~1 giờ/400 ván VH 2p trên 46 core) ⇒ tune ở budget rẻ, xác nhận ở budget thật.
- VH 2p có thể không đạt 70% so với Hard (không có liên minh khi chỉ 1 AI) ⇒ mục tiêu 2p ≥60%, đánh giá VH chủ yếu bằng coalition test 1v3.
- Patch 0003 lớn (vài nghìn dòng) ⇒ luôn sinh lại bằng script; test data dạng text.
- Session test vốn flaky ⇒ so với baseline M0, không để xấu hơn (kỳ vọng giảm race nhờ khoá đúng).
- Liên minh VH có thể bị cảm nhận là "không công bằng" ⇒ công bố rõ ở lobby + cờ `coalition` hiển thị nhỏ trong ván.

## 10. File trọng yếu
- `src/golem/internal/game/{game.go,resources.go,market.go,clone.go,legal.go}`
- `src/golem/internal/ai/{profile,agent,scheduler,greedy,eval,model,mcts,guard,intent}.go`, `internal/ai/sim/*`, `internal/ai/arena/*`
- `src/golem/internal/session/{session.go,options.go,ai_turns.go}`, `internal/server/{server.go,handlers.go,admin_handlers.go}`, `internal/config/config.go`
- `src/golem/web/react-frontend/src/{components/SinglePlayerLobby.jsx,components/XpWaitingRoom.jsx,components/AiLevelBadge.jsx,components/AiThinkingIndicator.jsx,store/gameStore.js}`
- `deploy/{regen-patches.sh,docker-compose.yml,smoke-test.sh}`, `docs/**`, `CLAUDE.md`, `README.md`

---

## Revision log
| Ngày | Thay đổi | Lý do |
|---|---|---|
| 2026-11-14 | Bản đầu tiên — được người dùng approve, archive nguyên văn từ plan mode | — |
| 2026-11-14 | M3: simulator đặt ở `internal/ai/sim` kèm luôn chuyển đổi `ToGameAction/FromGameAction` (plan ghi `internal/ai/convert.go`) | sim cần bảng lá của engine; gom một chỗ |
| 2026-11-14 | M4/M6: trọng số vòng 1 (CrystalLevel 0.75, Progress2 0.35, CPuct 0.8, RolloutTurns 2); thêm `endWeight` (sửa ván treo ở goal−1) và anti-stall từ vòng 100 | kết quả giải đấu — `docs/ai/tinh-chinh.md` |
| 2026-11-14 | M8: Pixel tắt (pin 19%, không sạc) khi benchmark Very Hard; người dùng chọn **chờ cắm sạc** rồi mới deploy (không phục vụ tạm từ rtx) | sự cố — `docs/ai/hieu-nang.md` |
| 2026-11-14 | M8: deploy lên pixel3xl sau khi cắm sạc (smoke local + public, privacy sạch; VH 3.00 s / 184k–224k iteration ở ván thật) | — |
| 2026-11-14 | Quy ước commit mới của người dùng: một dòng, prefix `feat/fix/chore/docs/ci…`, **không** Co-Authored-By; viết lại toàn bộ message cũ + force push (bước M8.5 trong plan gốc ghi "kèm Co-Authored-By" — không còn áp dụng) | yêu cầu người dùng |
| 2026-11-14 | Sau rollout, theo phản hồi người dùng: tắt toast ý đồ AI (mặc định `AI_INTENT_MESSAGES=0`); avatar AI ngẫu nhiên do server chọn + AI mang tên nhân vật (bỏ "AI 1, AI 2"); 23 avatar (12 nhân vật + tối đa 1 biến thể); sửa giật khung khi AI nghĩ; bỏ chỉ báo trùng trên ô người chơi desktop | yêu cầu người dùng |

