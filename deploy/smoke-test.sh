#!/usr/bin/env bash
# Smoke test Century Golem — chạy sau mỗi lần deploy / khi nghi có sự cố.
#   ./smoke-test.sh                       # qua domain công khai (Cloudflare → tunnel → nginx)
#   ./smoke-test.sh http://127.0.0.1:8400 # thẳng vào nginx local (bỏ qua tunnel)
# Exit 0 = mọi check PASS.
set -u
BASE="${1:-https://century.pentium.ink}"
BASE="${BASE%/}"
# Cloudflare zone chặn UA dạng script (error 1010) ⇒ luôn giả UA trình duyệt.
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"
fail=0

check() { # name expected actual
  if [[ "$3" == $2 ]]; then printf 'PASS  %-28s %s\n' "$1" "$3"
  else printf 'FAIL  %-28s got=%s want=%s\n' "$1" "$3" "$2"; fail=1; fi
}
code() { curl -s -o /dev/null -m 15 -A "$UA" -w '%{http_code} %{content_type}' "$@"; }

check "GET /"                   "200 text/html*"   "$(code "$BASE/")"
check "GET /room/x (SPA)"       "200 text/html*"   "$(code "$BASE/room/smoke")"
check "GET /health"             "200 text/plain*"  "$(code "$BASE/health")"
check "GET /api/list"           "200 application/json*" "$(code "$BASE/api/list")"
check "GET image"               "200 image/jpeg"   "$(code "$BASE/assets/images/background.jpg")"
check "GET sound"               "200 audio/mpeg"   "$(code "$BASE/assets/sounds/my_turn.mp3")"
check "GET avatar (versioned)"  "200 image/webp"   "$(code "$BASE/assets/images/avatar/1.webp?v=smb1")"
# Auth phải TẮT: 404 ⇒ frontend bỏ "Login Required" (xem docs/upstream-changes.md)
check "GET /auth/profile (off)" "404*"             "$(code "$BASE/auth/profile")"

# Tạo ván 1 người + 1 AI rồi bắt tay WebSocket (mong 101 Switching Protocols)
resp=$(curl -s -m 15 -A "$UA" -X POST -H 'Content-Type: application/json' -d '{"numAI":1}' "$BASE/api/single")
sid=$(sed -n 's/.*"sessionID":"\([^"]*\)".*/\1/p' <<<"$resp")
check "POST /api/single"        "single_*"         "${sid:-<none: $resp>}"
if [[ -n "$sid" ]]; then
  ws_code=$(curl -s -o /dev/null -m 4 --http1.1 -A "$UA" -w '%{http_code}' \
    -H 'Connection: Upgrade' -H 'Upgrade: websocket' -H 'Sec-WebSocket-Version: 13' \
    -H 'Sec-WebSocket-Key: c21va2UtdGVzdC1rZXk9PQ==' -H "Origin: $BASE" \
    "$BASE/ws?session=$sid&name=SmokeTest&avatar=1")   # curl timeout sau 101 là bình thường
  check "WS /ws handshake"      "101"              "$ws_code"
fi

# Độ khó AI: echo difficulty + aiLevels, giá trị lạ ⇒ 400
resp=$(curl -s -m 15 -A "$UA" -X POST -H 'Content-Type: application/json' -d '{"numAI":2,"difficulty":"veryhard"}' "$BASE/api/single")
check "POST /api/single veryhard" '*"difficulty":"veryhard"*' "$(tr -d ' ' <<<"$resp")"
check "  aiLevels echo"           '*"aiLevels":?"veryhard","veryhard"?*' "$(tr -d ' ' <<<"$resp")"   # ? = [ ] (glob)
check "POST /api/single bad level" "400*" "$(code -X POST -H 'Content-Type: application/json' -d '{"numAI":1,"difficulty":"impossible"}' "$BASE/api/single")"

[[ $fail == 0 ]] && echo "ALL PASS ($BASE)" || echo "SOME CHECKS FAILED ($BASE)"
exit $fail
