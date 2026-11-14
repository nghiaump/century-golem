# Hiệu năng AI trên máy chạy thật (pixel3xl)

> Máy: Pixel 3 XL — Snapdragon 845 (4 core lớn ~2.5 GHz + 4 core nhỏ), 3.5 GB RAM, Ubuntu 24.04 aarch64.
> Đo bằng `aibench bench` (binary arm64 cross-compile), 12 quyết định/cấp trên thế cờ giữa ván ngẫu nhiên, 4 người chơi,
> `AI_MAX_THREADS=4`. Ngày đo: 2026-11-14.

## Kết quả

| Cấp | Worker | Think p50 | Think p95 | Iteration/quyết định | Iteration/s | Node/quyết định | Heap đỉnh |
|---|---|---|---|---|---|---|---|
| Medium | 1 | 306 ms | 309 ms | 5 344 | 17 543 | 34 778 | 7.6 MiB |
| Hard | 2 | 1.408 s | 1.410 s | 43 733 | 31 088 | 290 795 | 46.6 MiB |
| Very Hard | 4 | 3.004 s | 3.007 s | 234 912 | 78 195 | 800 000 (chạm cap) | 62.0 MiB |

Nhiệt độ sau 36 quyết định liên tiếp: ~67 °C (thermal_zone0). Máy đang **chạy pin** (charger offline).

So sánh rtx (Threadripper 3960X, cùng lệnh): Medium 9.6k it/quyết định, Hard 95k, Very Hard 530k — Pixel ≈ 2.2× chậm hơn mỗi core.

### Sau vòng hiệu chỉnh 1 (RolloutTurns 2), 2 người, pin 19%

| Cấp | Think p95 | Iteration/quyết định | Heap đỉnh |
|---|---|---|---|
| Medium | 312 ms | 6 067 | 11.1 MiB |
| Hard | 1.410 s | 46 732 | 46.4 MiB |
| Very Hard | — (máy tắt giữa chừng, xem sự cố bên dưới) | | |

## ⚠ Sự cố 2026-11-14: Pixel tắt khi benchmark Very Hard lúc pin 19%

Chạy `aibench bench -level veryhard` (4 luồng, liên tục) khi máy đang **chạy pin 19%, không sạc** ⇒ máy tắt (Tailscale
offline, site trả 530 — tunnel mất). Bài học:
- ⛔ Không chạy benchmark/tải nặng kéo dài trên Pixel khi `pmi8998-charger/online = 0` hoặc pin < 40%.
- Kiểm trước: `cat /sys/class/power_supply/{max1720x/capacity,pmi8998-charger/online}`.
- Very Hard ở production chỉ dùng 3 s/nước rồi nghỉ (không liên tục như benchmark) — nhưng máy chạy pin thì rủi ro vẫn còn.

## Vi mô (rtx, `go test -bench`)

| Thao tác | Thời gian | Cấp phát |
|---|---|---|
| `sim` copy + Apply | 25 ns | 0 |
| `sim` sinh nước hợp lệ (Search) | 303 ns | 0 |
| engine `Clone()` + `Step()` | 3 370 ns | 39 alloc / 3 KB |

## Ghi chú vận hành

- p95 = ngân sách + < 10 ms ⇒ deadline kiểm mỗi 128 iteration là đủ.
- Very Hard chạm `AI_MAX_NODES=200000` mỗi cây (4 cây ⇒ 800k node ≈ 51 MB). Hết node thì vẫn chạy iteration (đánh giá tại
  lá) — sức mạnh giảm nhẹ, bộ nhớ không tăng.
- Nhiều ván Very Hard cùng nghĩ: chia nhau 4 token ⇒ mỗi ván ít worker hơn, thời gian nghĩ không đổi.
- Máy nóng/pin yếu: hạ `AI_THINK_SCALE_PCT` (vd 60) và/hoặc `AI_MAX_THREADS=2` trong `deploy/docker-compose.yml`, rồi
  `docker compose up -d --no-deps server` (⚠ kết thúc ván đang chơi).

## Đo lại

```bash
# trên rtx: build binary arm64 rồi chạy trên Pixel
docker run --rm -v "$PWD/src/golem":/src:ro -v golem-gomod:/go/pkg -v /tmp:/out -w /src \
  -e GOFLAGS=-buildvcs=false -e GOCACHE=/tmp/gocache -e GOOS=linux -e GOARCH=arm64 -e CGO_ENABLED=0 \
  golang:1.24 go build -o /out/aibench-arm64 ./internal/ai/arena/aibench
scp /tmp/aibench-arm64 ubuntu@100.71.99.38:/tmp/aibench
ssh ubuntu@100.71.99.38 'for l in medium hard veryhard; do /tmp/aibench bench -level $l -n 12 -threads 4; done'
```
