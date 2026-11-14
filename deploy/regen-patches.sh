#!/usr/bin/env bash
# Sinh lại deploy/patches/*.patch từ src/golem so với upstream golem.zip, rồi kiểm tái lập.
#   ./regen-patches.sh      # chạy sau MỌI lần sửa code trong ../src/golem
# 0001 = AuthContext (sửa tay, giữ nguyên) · 0002 = toàn bộ frontend còn lại · 0003 = backend Go.
# Tái lập: sanitize-src.sh trên bản giải nén mới của golem.zip phải cho ra đúng src/golem (trừ .git).
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$HERE/.."
SRC="$ROOT/src/golem"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
unzip -q "$ROOT/golem.zip" -d "$TMP" -x '__MACOSX/*'
BASE="$TMP/golem"
patch -d "$BASE" -p1 -s -f < "$HERE/patches/0001-auth-disabled-when-backend-404.patch"

diff_tree() { # out-file path-in-repo [extra diff args...]
  local out="$1" rel="$2"; shift 2
  ( diff -ruN "$@" "$BASE/$rel" "$SRC/$rel" || true ) \
    | sed -e "s|^--- $BASE/|--- a/|" -e "s|^+++ $SRC/|+++ b/|" -e "s|^diff -ruN .*||" \
    | sed -e 's|^\(--- a/[^\t]*\)\t.*|\1|' -e 's|^\(+++ b/[^\t]*\)\t.*|\1|' | sed '/^$/d' > "$out"
}
diff_tree "$HERE/patches/0002-frontend-xp-theme-smb-avatars.patch" web/react-frontend/src
diff_tree "$HERE/patches/0003-backend-idle-room-cleanup.patch" internal
for p in "$HERE"/patches/*.patch; do printf '  %-48s %4d dòng, %2d file\n' "$(basename "$p")" "$(wc -l < "$p")" "$(grep -c '^+++ ' "$p")"; done

# Kiểm tái lập trên bản sạch (quarantine thừa của bản nháp bị xoá ngay)
T2="$TMP/check"; mkdir -p "$T2"; unzip -q "$ROOT/golem.zip" -d "$T2" -x '__MACOSX/*'
before=$(ls -d "$ROOT"/removed-foreign-config/20* 2>/dev/null || true)
"$HERE/sanitize-src.sh" "$T2/golem" >/dev/null
for d in $(ls -d "$ROOT"/removed-foreign-config/20* 2>/dev/null); do grep -qxF "$d" <<<"$before" || rm -rf "$d"; done
if diff -r -x .git "$T2/golem" "$SRC" >/dev/null; then echo "REPRODUCIBLE"; else echo "KHÔNG tái lập được:" >&2; diff -rq -x .git "$T2/golem" "$SRC" >&2; exit 1; fi
