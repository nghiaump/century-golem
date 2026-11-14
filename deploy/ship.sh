#!/usr/bin/env bash
# Build nặng ở rtx, pixel3xl chỉ deploy (quy ước của người dùng, 2026-11-15) — runbook §11.
#   ./ship.sh server      # cross-compile Go arm64 ở rtx → Pixel đóng gói + restart server (⚠ mất ván đang chơi)
#   ./ship.sh web         # vite build ở rtx → Pixel đóng gói + restart web (an toàn)
#   ./ship.sh all
# Biến: HOST (mặc định ubuntu@100.71.99.38) · FORCE=1 bỏ qua kiểm tra ván đang chơi · NO_SYNC=1 không rsync repo.
# Pixel chỉ chạy `docker build` kiểu copy (Dockerfile.*.prebuilt) + `docker compose up -d --no-deps <svc>`.
set -euo pipefail
HOST=${HOST:-ubuntu@100.71.99.38}
ROOT=$(cd "$(dirname "$0")/.." && pwd)
SRC="$ROOT/src/golem"
BUILD="$ROOT/deploy/build"
REMOTE=ai/rename-game
what=${1:-}
case "$what" in server|web|all) ;; *) sed -n 2,8p "$0"; exit 2 ;; esac
want() { [[ $what == all || $what == "$1" ]]; }

build_server() {
  echo "== [rtx] go build linux/arm64"
  rm -rf "$BUILD/server" && mkdir -p "$BUILD/server"
  docker run --rm -v "$SRC":/src:ro -v golem-gomod:/go/pkg -v golem-gocache-deb:/root/.cache -v "$BUILD/server":/out \
    -w /src -e GOFLAGS=-buildvcs=false -e CGO_ENABLED=0 -e GOOS=linux -e GOARCH=arm64 golang:1.24 \
    sh -c "go build -o /out/server ./cmd/server && chown $(id -u):$(id -g) /out/server"
  rsync -a "$SRC/web/static/" "$BUILD/server/static/"
}

build_web() {
  echo "== [rtx] vite build (npm ci trên bản sao, không làm bẩn src)"
  rm -rf "$BUILD/web" && mkdir -p "$BUILD/web"
  docker run --rm -v "$SRC/web/react-frontend":/fe:ro -v golem-npm-cache:/root/.npm -v "$BUILD/web":/out node:18-alpine sh -c "
    set -e; mkdir /app; cd /fe; tar --exclude=./node_modules --exclude=./dist -cf - . | tar -xf - -C /app; cd /app
    npm ci --no-audit --no-fund >/dev/null
    rm -f .env .env.local .env.production .env.production.local
    printf 'VITE_LOG_LEVEL=INFO\nVITE_USE_SPRITE_IMAGES=false\nVITE_BASE_PATH=/\nSOURCE_MAPS=false\n' > .env.production
    npm run release >/dev/null
    cp -r dist /out/dist && chown -R $(id -u):$(id -g) /out/dist"
  mkdir -p "$BUILD/web/static"
  rsync -a "$SRC/web/static/images" "$SRC/web/static/sounds" "$BUILD/web/static/"
}

guard_server() {
  [[ ${FORCE:-0} == 1 ]] && return
  local list recent
  list=$(ssh "$HOST" "curl -s -m 10 http://127.0.0.1:8400/api/list")
  recent=$(ssh "$HOST" "cd $REMOTE/deploy && docker compose logs --since 10m server 2>/dev/null | grep -cE 'AI move|Game started|Player reconnected' || true")
  echo "   /api/list: $list · log hoạt động 10 phút qua: $recent dòng"
  if [[ $list != *'"count":0'* || $recent != 0 ]]; then
    echo "!! Có thể đang có ván — restart server sẽ làm mất ván. Chờ hoặc chạy lại với FORCE=1." >&2
    exit 1
  fi
}

want server && build_server
want web && build_web
want server && guard_server

if [[ ${NO_SYNC:-0} != 1 ]]; then
  echo "== rsync repo + artifact → $HOST"
  rsync -a --exclude deploy/tunnel.log "$ROOT/" "$HOST:$REMOTE/"
else
  rsync -a --delete "$BUILD/" "$HOST:$REMOTE/deploy/build/"
fi

for svc in server web; do
  want $svc || continue
  echo "== [pixel] đóng gói + restart $svc"
  # giữ image đang chạy làm :prev để rollback nhanh: docker tag century-golem-$svc:prev century-golem-$svc:latest && compose up -d --no-deps $svc
  ssh "$HOST" "cd $REMOTE/deploy && (docker tag century-golem-$svc:latest century-golem-$svc:prev 2>/dev/null || true) \
    && docker build -q -t century-golem-$svc:latest -f Dockerfile.$svc.prebuilt build/$svc \
    && docker compose up -d --no-deps $svc && docker image prune -f >/dev/null"
done
echo "== xong. Kiểm: ssh $HOST 'cd $REMOTE/deploy && ./smoke-test.sh http://127.0.0.1:8400' && ./smoke-test.sh"
