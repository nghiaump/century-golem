#!/usr/bin/env bash
# Làm sạch một bản mã nguồn Century Golem (vừa giải nén từ zip/clone) trước khi build/deploy.
#   ./sanitize-src.sh [SRC_DIR]     # mặc định ../src/golem ; chạy lại nhiều lần vẫn an toàn (idempotent)
# Làm 5 việc — xem docs/upstream-changes.md:
#   1. chuyển file cấu hình máy khác (.env*, ansible/inventory*, secrets/) sang ../removed-foreign-config/<ngày>/
#   2. áp các bản vá deploy/patches/*.patch (bỏ qua nếu đã áp; DỪNG nếu upstream đổi khiến vá không khớp)
#   3. thay avatar ảnh người thật bằng 24 golem tự vẽ (SVG trong ../assets-src/avatars, sinh bằng make-golem-avatars.py)
#   4. xoá metadata EXIF/XMP/comment trong ảnh (strip-image-metadata.py)
#   5. chép font OFL từ ../assets-src/fonts (file nhị phân không đi qua patch)
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$(cd "${1:-$HERE/../src/golem}" && pwd)"
QUAR="$HERE/../removed-foreign-config/$(date +%Y%m%d-%H%M%S)"
echo "Làm sạch: $SRC"

# 1. File cấu hình của máy/deployment khác
moved=0
while IFS= read -r -d '' f; do
  rel="${f#$SRC/}"
  mkdir -p "$QUAR/$(dirname "$rel")"
  mv "$f" "$QUAR/$rel"
  echo "  moved  $rel"
  moved=$((moved + 1))
done < <(find "$SRC" -path "$SRC/.git" -prune -o -path '*/node_modules' -prune -o \
           \( -name '.env' -o -name '.env.*' -o -path '*/ansible/inventory*' -o -path "$SRC/secrets" \) -print0)
echo "1. config máy khác: chuyển $moved mục$( ((moved)) && echo " → $QUAR")"

# 2. Bản vá
for p in "$HERE"/patches/*.patch; do
  name="$(basename "$p")"
  if patch -d "$SRC" -p1 -R --dry-run -s -f < "$p" >/dev/null 2>&1; then
    echo "2. vá $name: đã có, bỏ qua"
  elif patch -d "$SRC" -p1 --dry-run -s -f < "$p" >/dev/null 2>&1; then
    patch -d "$SRC" -p1 -s -f < "$p"
    echo "2. vá $name: ĐÃ ÁP"
  else
    echo "2. vá $name: KHÔNG KHỚP — upstream đã đổi file, phải sửa tay (docs/upstream-changes.md)" >&2
    exit 1
  fi
done

# 3. Avatar: xoá ảnh người thật của upstream (1..4.webp) + mọi avatar cũ, chép 24 golem SVG (idempotent)
AV="$SRC/web/static/images/avatar"   # react-frontend/public/images là symlink tới web/static/images
mkdir -p "$AV" && find "$AV" -maxdepth 1 -type f -delete
cp "$HERE"/../assets-src/avatars/*.svg "$AV/"
echo "3. avatar: $(ls "$AV" | wc -l) golem SVG (Basalt, Mossback, Rime, …)"

# 4. Metadata ảnh
echo "4. metadata ảnh: $(python3 -I "$HERE/strip-image-metadata.py" "$SRC/web/static/images" | tail -1)"

# 5. Font OFL (Cinzel, Be Vietnam Pro) — CSS ở src/styles/fonts.css trỏ tới src/assets/fonts/
FONTS="$SRC/web/react-frontend/src/assets/fonts"
mkdir -p "$FONTS"
cp "$HERE"/../assets-src/fonts/*.woff2 "$HERE"/../assets-src/fonts/OFL-*.txt "$FONTS/"
echo "5. font: chép $(ls "$HERE"/../assets-src/fonts/*.woff2 | wc -l) file woff2 + giấy phép OFL"

# Kiểm nhanh: token Telegram thật / domain gốc còn sót trong code chạy được
left=$(grep -rIlE '[0-9]{8,10}:AA[A-Za-z0-9_-]{30,}|game\.anhtran\.dev|157\.66\.101\.66' \
         --exclude-dir=.git --exclude-dir=node_modules --exclude='*.md' --exclude-dir=docs \
         --exclude-dir=deployment --exclude-dir=ansible --exclude-dir=scripts --exclude-dir=.github \
         --exclude='Dockerfile*' --exclude='Makefile' "$SRC" || true)
if [[ -n "$left" ]]; then echo "CẢNH BÁO: còn tham chiếu deployment gốc trong code:" >&2; echo "$left" >&2; exit 1; fi
echo "OK — giờ build: cd $HERE && DOCKER_BUILDKIT=1 docker compose build && ./privacy-audit.sh"
