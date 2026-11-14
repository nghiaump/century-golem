#!/usr/bin/env python3
"""Xoá metadata (EXIF/XMP/text/ICC-comment) khỏi PNG và JPEG, chỉ dùng thư viện chuẩn.

Dùng khi nhận mã nguồn mới: ảnh xuất từ Canva/Photoshop/điện thoại mang ID tài khoản, tên tác giả, GPS...
    python3 -I deploy/strip-image-metadata.py src/golem/web/static/images
    python3 -I deploy/strip-image-metadata.py --check <dir>...   # chỉ báo, không sửa; exit 1 nếu còn metadata

Giữ nguyên dữ liệu điểm ảnh: PNG chỉ bỏ chunk phụ (tEXt/iTXt/zTXt/eXIf/tIME), JPEG chỉ bỏ segment APP1..APP15 và COM
(giữ APP0/JFIF; APP2 ICC cũng bị bỏ — ảnh game là sRGB nên không đổi màu thấy được).
"""
import os
import struct
import sys

PNG_SIG = b"\x89PNG\r\n\x1a\n"
PNG_DROP = {b"tEXt", b"iTXt", b"zTXt", b"eXIf", b"tIME"}


def strip_png(data):
    out, pos, dropped = [PNG_SIG], 8, []
    while pos < len(data):
        (length,) = struct.unpack(">I", data[pos:pos + 4])
        ctype = data[pos + 4:pos + 8]
        chunk = data[pos:pos + 12 + length]
        if ctype in PNG_DROP:
            dropped.append(ctype.decode())
        else:
            out.append(chunk)
        pos += 12 + length
        if ctype == b"IEND":
            break
    return b"".join(out), dropped


def strip_jpeg(data):
    out, pos, dropped = [data[:2]], 2, []
    while pos < len(data):
        if data[pos] != 0xFF:
            raise ValueError("JPEG marker lệch tại offset %d" % pos)
        marker = data[pos + 1]
        if marker == 0xDA:  # SOS: phần còn lại là dữ liệu ảnh
            out.append(data[pos:])
            break
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:  # marker không có độ dài
            out.append(data[pos:pos + 2])
            pos += 2
            continue
        (length,) = struct.unpack(">H", data[pos + 2:pos + 4])
        seg = data[pos:pos + 2 + length]
        if 0xE1 <= marker <= 0xEF or marker == 0xFE:
            dropped.append("APP%d" % (marker - 0xE0) if marker != 0xFE else "COM")
        else:
            out.append(seg)
        pos += 2 + length
    return b"".join(out), dropped


def main(argv):
    check = "--check" in argv
    roots = [a for a in argv if a != "--check"]
    if not roots:
        print(__doc__)
        return 2
    dirty = 0
    for root in roots:
        for dirpath, _, files in os.walk(root):
            for name in sorted(files):
                path = os.path.join(dirpath, name)
                with open(path, "rb") as fh:
                    data = fh.read()
                try:
                    if data.startswith(PNG_SIG):
                        new, dropped = strip_png(data)
                    elif data[:2] == b"\xff\xd8":
                        new, dropped = strip_jpeg(data)
                    else:
                        continue
                except (ValueError, struct.error) as exc:
                    print("SKIP  %s (%s)" % (path, exc))
                    continue
                if not dropped:
                    continue
                dirty += 1
                print("%s %s: %s" % ("DIRTY" if check else "CLEAN", path, ",".join(sorted(set(dropped)))))
                if not check:
                    with open(path, "wb") as fh:
                        fh.write(new)
    print("%d file %s" % (dirty, "còn metadata" if check else "đã làm sạch"))
    return 1 if (check and dirty) else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
