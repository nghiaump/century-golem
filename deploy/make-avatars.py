#!/usr/bin/env python3
"""Sinh avatar người chơi (1..15.webp) từ sprite sheet Super Mario Bros. (NES) — thay avatar ảnh người thật của upstream.

    PY=/home/nghia/ai/venvs/mda5-asr/bin/python   # cần Pillow có WebP
    $PY -I deploy/make-avatars.py assets-src/smb-enemies-sheet.png \
        src/golem/web/static/images/avatar      # web/react-frontend/public/images là symlink tới web/static/images
    # thêm --preview out.png để xuất ảnh xem trước (vòng tròn + ô vuông như UI)

Avatar được dùng ở: Lobby (create/join room), SinglePlayerLobby, OpponentArea (trong ván); AI lấy avatar = player ID (1..5); người chơi chọn trong 1..15.
UI hiển thị `object-cover` trong khung TRÒN ⇒ sprite chiếm ≤ 68% cạnh để không bị cắt góc.
"""
import os
import sys

from PIL import Image, ImageDraw

SKY = (146, 144, 255, 255)  # màu trời SMB = màu nền ô sprite trong sheet
SIZE = 512
FILL = 0.68
# số avatar -> (tên, bbox x0, y0, x1, y1 trong sheet) — bbox dò tự động theo khung nền tím của từng ô
# 1..5 cũng là avatar mặc định của AI (avatar = player ID, ván tối đa 5 người) ⇒ giữ 5 loài dễ phân biệt nhất ở đầu.
# Đổi/thêm số ở đây ⇒ cập nhật AVATAR_IDS trong web/react-frontend/src/utils/avatar.js (+ bump AVATAR_VERSION).
SPRITES = {
    1: ("goomba", (0, 16, 16, 32)),
    2: ("koopa-troopa", (0, 112, 16, 136)),
    3: ("lakitu", (54, 138, 70, 162)),
    4: ("bowser", (0, 208, 32, 240)),
    5: ("hammer-bro", (0, 182, 16, 206)),
    6: ("red-koopa", (0, 318, 16, 342)),
    7: ("paratroopa", (36, 112, 52, 136)),
    8: ("red-paratroopa", (36, 318, 52, 342)),
    9: ("piranha-plant", (0, 138, 16, 162)),
    10: ("buzzy-beetle", (0, 34, 16, 50)),
    11: ("blooper", (0, 52, 16, 76)),
    12: ("bullet-bill", (54, 52, 70, 68)),
    13: ("cheep-cheep", (0, 370, 16, 386)),
    14: ("spiny", (72, 352, 88, 368)),
    15: ("podoboo", (90, 370, 106, 386)),
}


def render(sheet, box):
    sprite = sheet.crop(box)
    # Ô sprite không luôn là hình chữ nhật đầy ⇒ có thể lẫn nền sheet (xanh đậm): đổi mọi pixel nền thành trong suốt,
    # rồi cắt sát theo hình nhân vật để các avatar có cỡ hiển thị đồng đều.
    sheet_bg = sheet.getpixel((sheet.width - 1, sheet.height // 2))
    sprite.putdata([(0, 0, 0, 0) if p in (SKY, sheet_bg) else p for p in sprite.getdata()])
    sprite = sprite.crop(sprite.getbbox())
    w, h = sprite.size
    k = max(1, int(SIZE * FILL) // max(w, h))  # phóng to bội số nguyên, NEAREST ⇒ giữ nét pixel
    sprite = sprite.resize((w * k, h * k), Image.NEAREST)
    canvas = Image.new("RGBA", (SIZE, SIZE), SKY)
    canvas.alpha_composite(sprite, ((SIZE - w * k) // 2, (SIZE - h * k) // 2))
    return canvas.convert("RGB")


def preview(avatars, path):
    t, pad = 128, 12
    out = Image.new("RGB", (pad + len(avatars) * (t + pad), 2 * t + 3 * pad), (49, 46, 129))
    for i, im in enumerate(avatars):
        small = im.resize((t, t), Image.LANCZOS)
        x = pad + i * (t + pad)
        mask = Image.new("L", (t, t), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, t - 1, t - 1), fill=255)
        out.paste(small, (x, pad), mask)          # khung tròn (Lobby / OpponentArea)
        out.paste(small, (x, 2 * pad + t))        # ô vuông (SinglePlayerLobby)
    out.save(path)


def main(argv):
    prev = None
    if "--preview" in argv:
        i = argv.index("--preview")
        prev = argv[i + 1]
        argv = argv[:i] + argv[i + 2:]
    if len(argv) < 2:
        print(__doc__)
        return 2
    sheet = Image.open(argv[0]).convert("RGBA")
    avatars = []
    for num, (name, box) in sorted(SPRITES.items()):
        im = render(sheet, box)
        avatars.append(im)
        for outdir in argv[1:]:
            os.makedirs(outdir, exist_ok=True)
            path = os.path.join(outdir, "%d.webp" % num)
            im.save(path, "WEBP", lossless=True, method=6)  # không ghi EXIF/XMP
            print("%s  %-13s %s  (%d bytes)" % (path, name, box, os.path.getsize(path)))
    if prev:
        preview(avatars, prev)
        print("preview:", prev)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
