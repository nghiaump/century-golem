# Docs index · Mục lục tài liệu

Start with [`../CLAUDE.md`](../CLAUDE.md) (rules, layout, pitfalls) and [`../README.md`](../README.md) (overview).
Bắt đầu từ `CLAUDE.md` (quy tắc, bố cục, bẫy) và `README.md` (tổng quan).

| Doc | EN | VI |
|---|---|---|
| [`architecture.md`](architecture.md) | Request flow, services, ports, state, room cleanup, AI component, WS protocol | Luồng request, service, cổng, state, dọn phòng, thành phần AI, giao thức WS |
| [`runbook.md`](runbook.md) | Operations: health, redeploy, avatars, upstream drops, backup, tunnel, incidents, host/rollback, AI tuning on the host | Vận hành: kiểm tra, deploy lại, avatar, nhận source mới, backup, tunnel, sự cố, chuyển máy/rollback, chỉnh AI trên máy chạy |
| [`privacy.md`](privacy.md) | What was removed/disabled, what is verified, residual risks | Đã gỡ/tắt gì, kiểm gì, rủi ro còn lại |
| [`upstream-changes.md`](upstream-changes.md) | Every change vs upstream (patches 0001–0003), test baselines | Mọi thay đổi so với upstream (patch 0001–0003), số liệu test |
| [`ui/README.md`](ui/README.md) | **UI overview** (English): the Stone & Crystal design system, UX rules, how to check a change | Tổng quan giao diện (tiếng Anh) |
| [`ui/thiet-ke-giao-dien.md`](ui/thiet-ke-giao-dien.md) | UI design in detail (Vietnamese) | **Thiết kế giao diện chi tiết**: token, font, primitive, màn hình, avatar, kiểm thử |
| [`ai/README.md`](ai/README.md) | **AI overview** (English): levels, how it thinks, config, tools | Tổng quan AI (tiếng Anh) |
| [`ai/research.md`](ai/research.md) | Research notes behind the AI, with sources (English) | Ghi chú nghiên cứu + nguồn (tiếng Anh) |
| [`ai/thiet-ke.md`](ai/thiet-ke.md) | AI design in detail (Vietnamese) | **Thiết kế AI chi tiết**: engine, simulator, evaluator, MCTS, intent, WS |
| [`ai/tinh-chinh.md`](ai/tinh-chinh.md) | Calibration method, commands, results (Vietnamese) | **Hiệu chỉnh độ khó**: phương pháp, lệnh, kết quả, lịch sử trọng số |
| [`ai/hieu-nang.md`](ai/hieu-nang.md) | Performance on the production phone (Vietnamese) | **Hiệu năng** trên pixel3xl |
| [`adr/`](adr/README.md) | Architecture decision records (Vietnamese) | **ADR**: mỗi quyết định kiến trúc một file |
| [`plans/`](plans/) | Approved plans, archived verbatim with a revision log | Plan đã duyệt, lưu nguyên văn + revision log |

Plans: [`plans/2026-11-14-ai-difficulty-levels.md`](plans/2026-11-14-ai-difficulty-levels.md) — 4-level AI, official
rules, engine/session refactor · [`plans/2026-11-16-golem-ui.md`](plans/2026-11-16-golem-ui.md) — unified Stone & Crystal UI,
golem avatars, mobile rework.

Conventions · Quy ước: a new architectural decision ⇒ new ADR (never rewrite an accepted one); a new approved plan ⇒
`plans/YYYY-MM-DD-<slug>.md`; tuning results ⇒ `ai/tinh-chinh.md`; UI changes follow `ui/thiet-ke-giao-dien.md` (tokens + primitives).
