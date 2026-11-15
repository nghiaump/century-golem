# Computer opponents (AI)

> English overview. Details in Vietnamese: design [`thiet-ke.md`](thiet-ke.md) · tuning [`tinh-chinh.md`](tinh-chinh.md) ·
> performance [`hieu-nang.md`](hieu-nang.md) · decisions [`../adr/`](../adr/) · research [`research.md`](research.md) ·
> plan [`../plans/2026-11-14-ai-difficulty-levels.md`](../plans/2026-11-14-ai-difficulty-levels.md)

## Levels

Pick one level for every AI in the single-player lobby (default **Medium**, remembered per browser). The lobby only
says Very Hard is the toughest level.

| Level | How it plays | Think time* |
|---|---|---|
| **Easy** | Looks one move ahead and picks among the near-best moves at random (softmax). Never makes silly moves (resting with nothing to pick up, missing a game-winning claim). | ~0.8 s (min. delay) |
| **Medium** | Monte-Carlo tree search, 1 worker, maximises its own score; mild randomness in the final choice. | 0.3 s |
| **Hard** | Search with 2 workers, reads opponents' plans, plays to **beat whoever is leading** (human or AI) — denial included. | 1.4 s |
| **Very Hard** | Search with 4 workers, plan recognition, exact endgame rollouts. **Every AI plays for its own win** — it never feeds another AI and never blocks you just to hurt you. It goes after whoever threatens its win most; when you and an AI are equally dangerous, it treats you as its main rival. With a single AI it simply searches deeper than Hard. | 3.0 s |

\* per move on the production phone (Pixel 3 XL); a minimum visible delay of 0.8 s applies to every level.

## How it thinks (short)

1. **Fair information.** Everything a careful human could know is public (hands, played cards, market); only the
   order of the two decks is hidden. The AI converts the game into a compact simulator state in which unseen cards are an
   **unordered pool** — it cannot read the real deck order, by construction (tested).
2. **Search.** Each worker runs an open-loop Monte-Carlo tree search: every iteration starts from the current position,
   samples the refills afresh, follows moves chosen by PUCT (priors from the evaluator), plays a short "heavy" rollout and
   scores the result. Workers' root statistics are summed (an ensemble).
3. **Evaluation** (in points): banked points (golems + coins); crystals (their conversion value mid-game, their scoring
   value at the end); progress towards the visible golems — net points (golem + coin − crystals spent) discounted by the
   estimated turns to afford it and by whether an opponent gets there first; the "step value" of the player's cards
   (e.g. `2 yellow → 2 green` repeated 5× = +10 levels per play); clutter and tempo costs.
4. **Utility per level.** Easy/Medium: own score. Hard: margin over the best other player. Very Hard ("rival"): margin
   over 0.7 × the strongest + 0.3 × the average opponent, so a gift to any opponent always costs. Humans only break
   ties: +1 point mid-game, +0.25 at the end (final scores are whole numbers), so on equal threat the human is the main
   rival, while an AI that clearly leads stays the one to stop. No AI ever shares another AI's reward
   ([ADR 0008](../adr/0008-very-hard-doi-thu-canh-tranh.md)).
5. **Opponent model.** For every opponent: which golem they are going for (softmax over discounted value), how close
   they are, coin races. It biases the search towards denial against one seat — the leader when close (Very Hard: the
   human instead on equal threat) — and
   can produce **intent toasts** ("Bowser took the golem you were going for") — off by default (`AI_INTENT_MESSAGES`).

## Configuration (server, `deploy/docker-compose.yml`)

| Variable | Default | Meaning |
|---|---|---|
| `AI_MAX_THREADS` | `0` (auto: min(4, CPUs/2)) | server-wide cap on AI search threads; concurrent AI turns share it |
| `AI_THINK_SCALE_PCT` | `100` | multiplies every think budget (10–300); lower it if the host runs hot |
| `AI_MIN_DELAY_MS` | `800` | minimum visible thinking time per AI move |
| `AI_MAX_NODES` | `200000` | node cap per search tree (memory bound: ~13 MB per tree) |
| `AI_PAUSE_WHEN_EMPTY` | `1` | AI turns pause while nobody is connected to the room |
| `AI_INTENT_MESSAGES` | `0` | send intent toasts to humans (off by default) |

API: `POST /api/single {"numAI": 1..4, "difficulty": "easy|medium|hard|veryhard"}` (default `medium`), optional
`"aiLevels": [...]` per AI. The response echoes `difficulty` and `aiLevels`. WebSocket adds `aiThinking`
and `aiIntent` messages; the state carries `aiLevel` per player, `aiThinking`, `golemsToEnd`.

## Tools

`internal/ai/arena/aibench` (never built into the production image):

```bash
go run ./internal/ai/arena/aibench bench -level veryhard -n 30      # think time + iterations on this machine
go run ./internal/ai/arena/aibench ladder -seeds 100                # every adjacent level + baselines
go run ./internal/ai/arena/aibench vshuman -seeds 50 -players 4     # proxy human vs 3 Very Hard / 3 Hard
go run ./internal/ai/arena/aibench variant -level medium -gamma 0.7 # A/B test evaluator weights
```

Results and how to read them: [`tinh-chinh.md`](tinh-chinh.md). Phone numbers: [`hieu-nang.md`](hieu-nang.md).
