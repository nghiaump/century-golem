# AI research notes

> Background research behind the AI design (November 2026). Design: [`thiet-ke.md`](thiet-ke.md) (Vietnamese) ·
> Decisions: [`../adr/`](../adr/) · Plan: [`../plans/2026-11-14-ai-difficulty-levels.md`](../plans/2026-11-14-ai-difficulty-levels.md)

## TL;DR

- No serious published AI exists for *Century: Spice Road / Golem Edition*; open-source bots are shallow. The best
  domain source is an expert guide on the BGA forum by Illes Horvath (h_illes, >5000 competitive games).
- Century is **nearly perfect-information**: played cards are face up and acquisitions are public, so every hand can be
  tracked; only the **deck order** is unknown (to everyone). Treat it as perfect information + chance and re-sample the
  unseen remainder per iteration (open-loop / determinized MCTS) — full ISMCTS with hand sampling is unnecessary. The AI
  must never read the real deck order.
- Recommended core: MCTS on the fast cores, one tree per worker with its own refill samples (ensemble), heuristic priors,
  short ε-greedy rollouts cut off by an evaluation function, max-n backups, and a utility per difficulty level.

## 1. Existing work and expert strategy

Bots:
- [NikhilMittal/century-spice-road](https://github.com/NikhilMittal/century-spice-road) — browser game with Easy /
  Normal / Hard bots ("Hard wins ~9/10 vs Normal"). [`engine.js`](https://raw.githubusercontent.com/NikhilMittal/century-spice-road/main/engine.js)
  scores: golem points + coins; cube value × 0.7; closeness to a golem (0.2 × points × fraction of cost held); engine term
  (trade gain × repeats, upgrade n × 1.5, cap 36, × 0.15); −1.2 per card above 7; +1.5 per golem. Hard searches 2 own
  turns blended 0.4/0.6, no opponent model. Its Easy plays a random legal move half the time — a design to avoid.
- itch.io solo client and the Spicee app: "very basic" AI; nothing reliable about the official Plan B app's AI. BGA has
  hosted the game since 2022 without bots.

Expert heuristics (h_illes, [guide](https://forum.boardgamearena.com/viewtopic.php?p=220732),
[follow-up](https://forum.boardgamearena.com/viewtopic.php?p=240530)) translated to Golem colours (Y1 G2 B3 P4):
- **Valuation**: cube values 1/2/3/4; a golem's cost value = Σ cube values (+1 for 3 colours, +2 for 4). A "step" (turn)
  is worth the cube-value increase it produces: starting cards ≈ +2, good produce ≈ +4, "power step" ≥ +6, best trades
  +10 with full repeats (YY>GG, GG>BB, BB>PP, P>BB), +9 (YYY>GGG, GGG>BBB, BBB>PPP, BYY>PP), +8 (PP>BBBGY, PP>BBGGG,
  YYYYY>BBB).
- **Hand building**: one strong trade early; cover colours in and out; avoid two trades with the same input; prefer
  simple cards; rank produce low except early yellow producers; **stop drafting once the combo works**.
- **Tempo & coins**: tempo = points + cube value. Ahead → aim for 3 copper coins; behind → 2. Blocking a coin by holding
  a golem's cost is rarely worth it.
- **Claiming**: claim as a "dividend", keep ~4 high crystals to restart, don't hold cubes you don't need; claiming is
  committal — do the least committal step first.
- **Denial**: take the card that completes an opponent's combo (e.g. P>BB); create "tension"; choose denial carefully.
- **Endgame**: starts when someone has 4 golems and cubes; the player with more golems attacks (close out while the
  opponent holds unusable cubes), the defender buys the most expensive golem possible then collects non-yellow crystals.
  Precise endgame play is worth 4–10 points. Veteran 2-player games last 30–40 turns.
- Other tips ([BGA tips](https://en.doc.boardgamearena.com/Tips_century)): rest rarely, use multipliers fully, block the
  leftmost card when an opponent is about to take it.

Rules check: the official last round triggers on the **6th golem with 2–3 players** and the 5th with 4–5
([rulebook](https://rulespal.com/century-spice-road/rulebook)); ties go to the player **later in turn order**.

## 2. Search

- Closest studied game is Splendor. [Kowalski, Winands et al. 2026 — Ensemble Determinization MCTS](https://arxiv.org/abs/2607.13007):
  heuristic leaf evaluation (no random rollouts); 5–10 trees each with its own sampled deck work best; at 1 s/move,
  5 trees aggregated by visits reached 72.3% vs single-tree open-loop MCTS.
- [Rinascimento (Bravi et al. 2019)](https://arxiv.org/abs/1904.01883): at 1000 forward calls/move the best MCTS used
  tree depth 2 and c=0; agents preferred short plans because of randomness. [Follow-up](https://arxiv.org/abs/2006.05894):
  dense reward shaping beats sparse rewards.
- [TAG study (Goodman et al.)](https://ar5iv.arxiv.org/html/2202.05773): best rollout length / depth / opponent model
  differ by game; short rollouts suit games whose score moves often.
- Hidden information: [ISMCTS (Cowling, Powley, Whitehouse 2012)](https://eprints.whiterose.ac.uk/75048/1/CowlingPowleyWhitehouse2012.pdf);
  [PIMC analysis (Long et al. 2010)](https://ojs.aaai.org/index.php/AAAI/article/view/7562) — PIMC works when hidden
  information resolves quickly, as here (only refills are unknown).
- Multiplayer: [Sturtevant 2008](https://www.cs.du.edu/~sturtevant/papers/sturtevant2008analysis.html) and the
  [Nijssen & Winands overview](https://dke.maastrichtuniversity.nl/m.winands/documents/Multi_Overview.pdf): MCTS works best
  with max-n backups. [Best-Reply Search](https://dke.maastrichtuniversity.nl/m.winands/documents/BestReplySearch.pdf)
  helps alpha-beta, not MCTS.
- Enhancements: priors from heuristic scores ([progressive bias](https://cris.maastrichtuniversity.nl/en/publications/progressive-strategies-for-monte-carlo-tree-search),
  PUCT); early playout termination with an evaluation function (Lorentz; [MCTS survey 2021](https://arxiv.org/pdf/2103.04931));
  RAVE is a poor fit (move value depends on timing and the current market); macro actions as (card, repeats) and
  deduplicated upgrade results; [root parallelization](https://dke.maastrichtuniversity.nl/m.winands/documents/multithreadedMCTS2.pdf)
  gives near-linear speed-up and, with per-worker samples, a free ensemble.
- Starting numbers: c ≈ 0.7 for rewards in [0,1] (PUCT ≈ 1.25 with priors), final move by most visits.

## 3. Opponent modelling and counter-play

- Target recognition ([Ramírez & Geffner 2010](https://ojs.aaai.org/index.php/AAAI/article/view/7745)):
  P(target = g) ∝ exp(−β·Δcost) from each opponent's turns-to-afford (hands are public).
- Rush detection: golem count, tempo, fast claims, turns-to-afford for coin slots.
- Denial value = Δ(opponent value) − Δ(own value); act when the gap is large.
- [Goodman & Lucas](https://ar5iv.labs.arxiv.org/html/2006.08659): MCTS is robust to inaccurate opponent models.
- Utility shaping: logistic of (own − best other), with a margin term so the AI never plays aimlessly.
- Fairness: research recommends AIs never coordinate against the human. The first Very Hard did (a shared AI-team
  reward, [ADR 0004](../adr/0004-ham-loi-ich-theo-cap-va-lien-minh.md)); in play it produced absurd "gifts" (an AI
  spending big crystals so the next AI could pick them up), so it was replaced by a self-interested **rival** utility
  that only biases attention towards the human ([ADR 0008](../adr/0008-very-hard-doi-thu-canh-tranh.md)).

## 4. Difficulty design

- Temple Gates' [Dominion AI](https://www.templegatesgames.com/dominion-ai) ([phone write-up](https://gametek.substack.com/p/big-brain-small-phone-ai-for-dominion)):
  noise on scores for Easy/Medium, none for Hard. Stockfish/Lichess levels mix skill noise, depth and time. The Splendor
  app uses personalities. [Maia](https://ar5iv.arxiv.org/html/2006.01855) learns human-like errors.
- Proposed tiers: Easy = greedy 1-ply with softmax among near-best moves; Medium = short search with mild noise;
  Hard = longer search + opponent model; Very Hard = longest search, plan recognition, denial, exact endgame.
- Blunder guard at every level; a minimum "thinking" delay (0.6–1.2 s); never peek at the deck; no resource cheats
  (Steve Rabin, [IEEE Spectrum](https://spectrum.ieee.org/mind-games)).
- Calibration: fixed baselines (random, greedy, scripted rusher — the "Big Money" of Century), seat-rotated round robins
  on fixed seeds; ~400 games detect 55% vs 50%; each tier should beat the one below ~70–75% in 2-player; rate with
  Elo / Bradley–Terry (2p) or OpenSkill/TrueSkill (multiplayer); gate changes with SPRT.

## 5. Engineering

- Value-type state with fixed arrays (crystals `[4]uint8`, hands as `uint64` bitsets): cloning is a struct copy. Node pool
  indexed by `int32` (≈ 4× faster than pointers in Go). Deadline checked every ~128 iterations; context cancellation.
- One `rand.Rand` per worker (`math/rand/v2` PCG); iteration budgets for tests/tournaments, time budgets in production.
- Phone: the Pixel 3 XL's Snapdragon 845 runs its 4 big cores at ~2.5 GHz and throttles under sustained load — use ~4
  workers, a server-wide thread cap, and do not think during the human's turn.

Weak spots: BGG threads and the "Following the Leader" paper (Goodman et al., FDG 2023) could not be read; the Lichess
table is community-reported; iteration rates and temperatures above were starting points, measured later in
[`hieu-nang.md`](hieu-nang.md) and [`tinh-chinh.md`](tinh-chinh.md).
