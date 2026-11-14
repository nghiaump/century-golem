#!/usr/bin/env bash
# Audit riêng tư Century Golem — đảm bảo deployment KHÔNG dính/không gửi gì về deployment gốc
# (game.anhtran.dev, 157.66.101.66, Jenkins, Telegram, Firebase/Google) và không lộ metadata tác giả.
#   ./privacy-audit.sh        # chạy từ bất kỳ đâu; cần stack đang chạy
# Exit 0 = sạch. Chạy lại sau MỖI lần thay mã nguồn (xem docs/runbook.md §Cập nhật mã nguồn).
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$HERE/../src/golem"
DC=(docker compose -f "$HERE/docker-compose.yml")
FOREIGN='anhtran|157\.66\.101\.66|jenkins|vietky|viet\.ky'
fail=0
ok()  { printf 'PASS  %s\n' "$1"; }
bad() { printf 'FAIL  %s\n' "$1"; [[ -n "${2:-}" ]] && printf '%s\n' "$2" | sed 's/^/      /' | head -10; fail=1; }

# 1. Không còn file .env / inventory của máy khác trong mã nguồn (ngoài .git)
f=$(find "$SRC" -path "$SRC/.git" -prune -o \( -name '.env*' -o -name 'inventory*' -o -name '*credentials*.json' \) -print)
[[ -z "$f" ]] && ok "src: không có .env/inventory/credentials" || bad "src: còn file cấu hình máy khác" "$f"

# 2. Không có token Telegram thật (dạng 123456789:AA...) trong mã nguồn
f=$(grep -rIlE '[0-9]{8,10}:AA[A-Za-z0-9_-]{30,}' --exclude-dir=.git --exclude-dir=node_modules "$SRC")
[[ -z "$f" ]] && ok "src: không có Telegram bot token" || bad "src: có chuỗi giống bot token" "$f"

# 3. Bundle frontend đang phục vụ: không trỏ host lạ / tracker
hosts=$("${DC[@]}" exec -T web sh -c 'cd /usr/share/nginx/html && grep -ohE "(https?|wss?)://[a-zA-Z0-9._-]+" index.html assets/*.js assets/*.css' 2>/dev/null \
  | sort -u | grep -vE '^https?://(localhost|www\.w3\.org|reactjs\.org|reactrouter\.com)$')
[[ -z "$hosts" ]] && ok "web: bundle không gọi host ngoài" || bad "web: bundle có host lạ" "$hosts"
t=$("${DC[@]}" exec -T web sh -c "grep -lE 'sendBeacon|gtag\\(|googletagmanager|fonts\\.googleapis|cloudflareinsights|$FOREIGN' /usr/share/nginx/html/index.html /usr/share/nginx/html/assets/*" 2>/dev/null)
[[ -z "$t" ]] && ok "web: không tracker / domain gốc trong bundle+map" || bad "web: có tracker/domain gốc" "$t"

# 4. Ảnh: src không còn EXIF/XMP/comment; ảnh đang phục vụ không metadata Canva/XMP/Facebook/GPS
s=$(python3 -I "$HERE/strip-image-metadata.py" --check "$SRC/web/static/images" 2>&1)
[[ $? == 0 ]] && ok "src: ảnh không còn metadata" || bad "src: ảnh còn metadata (chạy strip-image-metadata.py)" "$s"
m=$("${DC[@]}" exec -T web sh -c 'grep -laE "xmpmeta|Canva|FbId|GPSInfo|Photoshop" -r /usr/share/nginx/html/assets/images /usr/share/nginx/html/assets/sounds' 2>/dev/null)
[[ -z "$m" ]] && ok "web: asset không có metadata tác giả" || bad "web: asset còn metadata" "$m"

# 4b. Avatar đang phục vụ KHÔNG được trùng ảnh người thật của upstream (bản gốc cất ở removed-foreign-config)
old=$(find "$HERE/../removed-foreign-config" -path '*avatar*' -name '*.webp' -exec md5sum {} + 2>/dev/null | awk '{print $1}' | sort -u)
live=$("${DC[@]}" exec -T web sh -c 'md5sum /usr/share/nginx/html/assets/images/avatar/*.webp' 2>/dev/null)
hit=$(grep -F -f <(printf '%s\n' $old) <<<"$live")
[[ -n "$live" && -z "$hit" ]] && ok "web: avatar là sprite mới, không còn ảnh người thật" || bad "web: avatar cũ (ảnh người thật) vẫn đang phục vụ" "${hit:-không đọc được avatar}"

# 5. Backend: Telegram + Firebase tắt (theo log khởi động)
logs=$("${DC[@]}" logs server 2>&1)
grep -q 'Telegram notifier disabled' <<<"$logs" && ok "server: Telegram notifier disabled" || bad "server: không thấy 'Telegram notifier disabled' trong log"
grep -q 'Firebase authentication not configured' <<<"$logs" && ok "server: Firebase auth disabled" || bad "server: Firebase có thể đang bật"
e=$("${DC[@]}" exec -T server env | grep -E '^(TELEGRAM_|FIREBASE_|GOOGLE_OAUTH_)' | grep -vE '=$')
[[ -z "$e" ]] && ok "server: env TELEGRAM_/FIREBASE_/GOOGLE_ đều rỗng" || bad "server: có env bí mật khác rỗng" "$e"

# 6. Backend không có đường ra Internet (mạng docker internal)
if "${DC[@]}" exec -T server sh -c 'wget -q -T 5 -O /dev/null https://api.telegram.org' >/dev/null 2>&1; then
  bad "server: RA ĐƯỢC Internet (api.telegram.org) — kiểm tra networks.backend.internal"
else ok "server: không ra được Internet"; fi

# 7. Mongo/Redis không publish cổng ra host
p=$(docker ps --filter label=com.docker.compose.project=century-golem --format '{{.Names}} {{.Ports}}' | grep -E 'mongodb|redis' | grep -- '->')
[[ -z "$p" ]] && ok "db: mongo/redis không mở cổng ra host" || bad "db: có cổng publish" "$p"

[[ $fail == 0 ]] && echo "AUDIT SẠCH" || echo "AUDIT CÓ VẤN ĐỀ"
exit $fail
