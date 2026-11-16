#!/usr/bin/env python3
"""Vẽ 24 avatar golem NGUYÊN BẢN (SVG) — thay bộ sprite Super Mario cũ. Chỉ dùng thư viện chuẩn, tất định.

    python3 -I deploy/make-golem-avatars.py                 # ghi assets-src/avatars/{1..24}.svg + avatars.json
    python3 -I deploy/make-golem-avatars.py --preview OUT.html   # thêm trang xem trước (vòng tròn như UI)

sanitize-src.sh chép assets-src/avatars/*.svg vào src/golem/web/static/images/avatar/ (frontend: /assets/images/avatar/N.svg).
12 nguyên mẫu (id 1–12) rồi mỗi nguyên mẫu đúng 1 biến thể (id 13–24) — quy tắc của người dùng: mỗi nhân vật tối đa 1 biến thể.
Mỗi màu crystal làm lõi cho đúng 6 golem; lõi + mắt dùng hình crystal của màu đó (vàng ▲, lục ◆, lam ⬟, hồng ⬢).
Đổi tên/số lượng ⇒ cập nhật avatarNames (internal/session/ai_turns.go) + AVATAR_IDS/AVATAR_NAMES (utils/avatar.js) + bump AVATAR_VERSION.
UI cắt ảnh thành hình TRÒN (object-cover) ⇒ đầu golem nằm trong ~70% giữa khung.
"""
import json
import math
import os
import sys

S = 512
CX = 256
# drawn on a 512 grid, shown zoomed on head + shoulders so the face reads at 36px
VIEW = '64 64 384 384'
CORE_Y = 398  # chest crystal, fully inside the view
GEM = {  # base, light, dark — giống src/styles/tokens.css
    'yellow': ('#f0cc3a', '#fcec8c', '#96700e'),
    'green': ('#3ea060', '#84d696', '#1a5834'),
    'blue': ('#3a8cd0', '#8cccf4', '#1a4c80'),
    'pink': ('#c84096', '#f28cca', '#6c1656'),
}
SIDES = {'yellow': 3, 'green': 4, 'blue': 5, 'pink': 6}

# (slug, name, core, body(base, light, dark), bg(inner, outer), accent, shape)
# shape: head half-width, head top y, jaw ('square'|'chamfer'|'point'|'round'), eyes ('rect'|'slit'|'gem'|'round'), brow (px)
ARCHETYPES = [
    ('basalt', 'Basalt', 'yellow', ('#4b4f5c', '#717686', '#2c2f38'), ('#27304a', '#0d1019'), '#16181f',
     dict(hw=96, top=118, jaw='chamfer', eyes='rect', brow=18), 'cracks'),
    ('mossback', 'Mossback', 'green', ('#5d6157', '#80857a', '#3a3d36'), ('#1f3a26', '#0a140d'), '#6a9a40',
     dict(hw=102, top=124, jaw='square', eyes='round', brow=14), 'moss'),
    ('rime', 'Rime', 'blue', ('#93bfd4', '#d6eff9', '#557f98'), ('#173048', '#07101a'), '#f2fbff',
     dict(hw=88, top=112, jaw='point', eyes='slit', brow=10), 'ice'),
    ('cinder', 'Cinder', 'yellow', ('#3b302d', '#5b4a45', '#211a18'), ('#3a1a10', '#110705'), '#ff9a32',
     dict(hw=98, top=120, jaw='chamfer', eyes='slit', brow=16), 'lava'),
    ('rivet', 'Rivet', 'blue', ('#7c828c', '#a8aeb7', '#4b5058'), ('#22303d', '#0b1016'), '#cfd4dc',
     dict(hw=92, top=116, jaw='square', eyes='slit', brow=20), 'iron'),
    ('dune', 'Dune', 'yellow', ('#c9a46a', '#e8ca93', '#987440'), ('#43301a', '#160e07'), '#b0824c',
     dict(hw=100, top=126, jaw='round', eyes='round', brow=12), 'strata'),
    ('quartz', 'Quartz', 'blue', ('#b8c2ce', '#eef3f8', '#7b8694'), ('#1e2840', '#090c16'), '#e8f4ff',
     dict(hw=90, top=118, jaw='point', eyes='gem', brow=10), 'shards'),
    ('terra', 'Terra', 'green', ('#b2603a', '#d68058', '#783a21'), ('#33201a', '#120a07'), '#6a2c16',
     dict(hw=96, top=122, jaw='round', eyes='round', brow=14), 'incised'),
    ('onyx', 'Onyx', 'pink', ('#2a2a31', '#4d4d59', '#131317'), ('#2a1b36', '#0b0710'), '#ffffff',
     dict(hw=94, top=114, jaw='point', eyes='gem', brow=12), 'sheen'),
    ('rootling', 'Rootling', 'green', ('#6e5236', '#94704c', '#462f1d'), ('#223019', '#0a0f07'), '#6aa84f',
     dict(hw=92, top=124, jaw='round', eyes='round', brow=12), 'leaves'),
    ('reef', 'Reef', 'pink', ('#66798c', '#8ea1b4', '#3f4f60'), ('#0f3448', '#04111a'), '#ff7f8f',
     dict(hw=96, top=126, jaw='chamfer', eyes='round', brow=12), 'coral'),
    ('nimbus', 'Nimbus', 'green', ('#b4bfd4', '#e6ecf7', '#76829a'), ('#22325a', '#0a1020'), '#f3f6fc',
     dict(hw=100, top=128, jaw='round', eyes='slit', brow=8), 'cloud'),
]
# Biến thể (cùng thứ tự): tên, lõi, thân, nền, màu nhấn, phụ kiện
VARIANTS = [
    ('granite', 'Granite', 'blue', ('#8b8580', '#b2aba3', '#5e5955'), ('#302838', '#100c14'), '#3a3634', 'speckle'),
    ('fernhide', 'Fernhide', 'yellow', ('#6b6a5e', '#8f8e80', '#45443b'), ('#2a3a1c', '#0d1408'), '#4f8a3a', 'ferns'),
    ('glacier', 'Glacier', 'pink', ('#78a9c4', '#c4e8f8', '#3f6a84'), ('#1a2c4a', '#060c18'), '#ffffff', 'crown'),
    ('magma', 'Magma', 'pink', ('#2e2321', '#4e3c37', '#170f0e'), ('#46120a', '#140403'), '#ffc04a', 'horns'),
    ('anvil', 'Anvil', 'green', ('#5e646d', '#868c96', '#383c43'), ('#2c241c', '#0e0b08'), '#b9bec6', 'horns'),
    ('mesa', 'Mesa', 'pink', ('#bf7a4a', '#df9c6a', '#8a4f2f'), ('#3e1c14', '#150806'), '#9c5a34', 'crown'),
    ('amethyst', 'Amethyst', 'pink', ('#7c5aa5', '#b48cdc', '#4a306e'), ('#26163a', '#0b0612'), '#e6d0ff', 'crown'),
    ('kiln', 'Kiln', 'yellow', ('#a5472d', '#c96a4c', '#6e2a18'), ('#36160e', '#120604'), '#f0d27a', 'glaze'),
    ('jet', 'Jet', 'green', ('#1d2126', '#3d434c', '#0c0e11'), ('#10241e', '#040a08'), '#9ff0c8', 'horns'),
    ('thornbark', 'Thornbark', 'blue', ('#5a4630', '#7c6244', '#382a1b'), ('#1f1c12', '#0a0905'), '#2e2216', 'thorns'),
    ('coralline', 'Coralline', 'yellow', ('#c46b7c', '#e48e9e', '#86404f'), ('#123a52', '#04121c'), '#ffd29a', 'crown'),
    ('squall', 'Squall', 'blue', ('#7e89a2', '#aab4cc', '#4d566d'), ('#16203a', '#060912'), '#ffe27a', 'bolt'),
]


def pts(lst):
    return ' '.join(f'{x:.1f},{y:.1f}' for x, y in lst)


def poly_center(lst):
    return (sum(p[0] for p in lst) / len(lst), sum(p[1] for p in lst) / len(lst))


def faceted(points, base, light, dark, outline='#0b0c12', stroke=5, center=None):
    """Low-poly look: the shape cut into triangles from its centre, each shaded by facing (light from top-left)."""
    c = center or poly_center(points)
    out = [f'<polygon points="{pts(points)}" fill="{base}"/>']
    n = len(points)
    for i in range(n):
        p, q = points[i], points[(i + 1) % n]
        mx, my = (p[0] + q[0]) / 2 - c[0], (p[1] + q[1]) / 2 - c[1]
        d = math.hypot(mx, my) or 1
        lit = (-mx - my * 1.3) / d
        tone = light if lit > 0.45 else dark if lit < -0.4 else base
        if tone != base:
            out.append(f'<polygon points="{pts([c, p, q])}" fill="{tone}" opacity="0.85"/>')
    out.append(f'<polygon points="{pts(points)}" fill="none" stroke="{outline}" stroke-width="{stroke}" stroke-linejoin="round"/>')
    return ''.join(out)


def reg(n, cx, cy, r, rot=-90.0):
    return [(cx + r * math.cos(math.radians(rot + 360 * i / n)), cy + r * math.sin(math.radians(rot + 360 * i / n))) for i in range(n)]


def gem(color, cx, cy, r, outline='#0b0c12'):
    base, light, dark = GEM[color]
    n = SIDES[color]
    cy2 = cy + (r * 0.14 if n == 3 else 0)
    outer = reg(n, cx, cy2, r)
    table = reg(n, cx, cy2, r * 0.46)
    s = [f'<polygon points="{pts(outer)}" fill="{base}"/>']
    for i in range(n):
        p, q = outer[i], outer[(i + 1) % n]
        mx, my = (p[0] + q[0]) / 2 - cx, (p[1] + q[1]) / 2 - cy2
        lit = (-mx - my * 1.4) / (math.hypot(mx, my) or 1)
        tone = light if lit > 0.55 else dark if lit < -0.35 else base
        s.append(f'<polygon points="{pts([p, q, table[(i + 1) % n], table[i]])}" fill="{tone}"/>')
    s.append(f'<polygon points="{pts(table)}" fill="{light}" opacity="0.85"/>')
    s.append(f'<polygon points="{pts(outer)}" fill="none" stroke="{outline}" stroke-width="{max(2.5, r / 9):.1f}" stroke-linejoin="round"/>')
    return ''.join(s)


def head_points(hw, top, jaw):
    l, r = CX - hw, CX + hw
    bottom = 300
    if jaw == 'square':
        return [(l + 18, top + 6), (r - 18, top + 6), (r + 4, top + 34), (r, bottom - 10), (r - 22, bottom), (l + 22, bottom), (l, bottom - 10), (l - 4, top + 34)]
    if jaw == 'point':
        return [(l + 26, top), (r - 26, top), (r + 6, top + 44), (r - 6, bottom - 40), (CX + 34, bottom + 6), (CX - 34, bottom + 6), (l + 6, bottom - 40), (l - 6, top + 44)]
    if jaw == 'round':
        return [(l + 30, top + 4), (r - 30, top + 4), (r + 2, top + 40), (r + 6, bottom - 54), (r - 22, bottom - 8), (CX, bottom + 4), (l + 22, bottom - 8), (l - 6, bottom - 54), (l - 2, top + 40)]
    # chamfer
    return [(l + 24, top), (r - 24, top), (r + 4, top + 30), (r + 4, bottom - 44), (r - 32, bottom), (l + 32, bottom), (l - 4, bottom - 44), (l - 4, top + 30)]


def eyes(style, color, y=208, dx=44):
    base, light, dark = GEM[color]
    s = []
    for side in (-1, 1):
        x = CX + side * dx
        s.append(f'<circle cx="{x}" cy="{y}" r="34" fill="url(#eyeglow)"/>')
        if style == 'rect':
            s.append(f'<rect x="{x - 17}" y="{y - 10}" width="34" height="20" rx="3" fill="{light}" stroke="#0b0c12" stroke-width="4"/>')
        elif style == 'slit':
            s.append(f'<polygon points="{pts([(x - 22, y + 2), (x - 6, y - 9), (x + 22, y - 3), (x + 8, y + 9)])}" fill="{light}" stroke="#0b0c12" stroke-width="4" stroke-linejoin="round"/>')
        elif style == 'gem':
            s.append(gem(color, x, y, 16))
        else:  # round
            s.append(f'<circle cx="{x}" cy="{y}" r="13" fill="{light}" stroke="#0b0c12" stroke-width="4"/>')
            s.append(f'<circle cx="{x - 4}" cy="{y - 4}" r="4" fill="#ffffff" opacity="0.8"/>')
    return ''.join(s)


def torso():
    left_pad = [(42, 432), (70, 360), (150, 326), (186, 352), (178, 412), (120, 446)]
    right_pad = [(S - x, y) for x, y in left_pad]
    chest = [(150, 330), (CX, 318), (S - 150, 330), (S - 170, 512), (170, 512)]
    neck = [(214, 288), (298, 288), (306, 336), (206, 336)]
    return left_pad, right_pad, chest, neck


def texture(kind, accent, body, rng):
    base, light, dark = body
    s = []
    if kind == 'cracks':
        for path in ['M190,140 L214,176 L204,200 L226,236', 'M318,132 L304,160 L322,184', 'M120,370 L150,392 L144,420',
                     'M372,360 L352,388 L366,414', 'M232,372 L246,396 L236,430']:
            s.append(f'<path d="{path}" fill="none" stroke="{accent}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>')
    elif kind == 'speckle':
        for _ in range(70):
            x, y = 120 + rng() * 272, 120 + rng() * 360
            s.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{2 + rng() * 3:.1f}" fill="{accent if rng() < 0.6 else light}" opacity="0.55"/>')
    elif kind in ('moss', 'ferns'):
        for cx, cy, r in [(196, 128, 26), (232, 116, 22), (300, 122, 28), (330, 136, 18), (96, 352, 26), (130, 336, 22), (412, 350, 26), (382, 334, 20)]:
            s.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{accent}"/><circle cx="{cx - r * 0.3:.0f}" cy="{cy - r * 0.3:.0f}" r="{r * 0.5:.0f}" fill="#9ccc6a" opacity="0.6"/>')
        if kind == 'ferns':
            for x0, d in [(150, -1), (362, 1)]:
                for i in range(5):
                    y = 300 - i * 26
                    s.append(f'<path d="M{x0},{y + 40} q{d * 30},-10 {d * 52},-34" fill="none" stroke="#4f8a3a" stroke-width="7" stroke-linecap="round"/>')
    elif kind in ('ice', 'crown') and accent:
        spikes = [(200, 122, 36), (236, 112, 52), (276, 110, 48), (312, 120, 34)]
        for x, y, h in spikes:
            s.append(faceted([(x - 14, y + 8), (x, y - h), (x + 14, y + 8)], accent, '#ffffff', light, stroke=4))
        if kind == 'ice':
            for x, y, h in [(80, 368, 40), (110, 344, 30), (432, 368, 40), (402, 344, 30)]:
                s.append(faceted([(x - 12, y + 8), (x, y - h), (x + 12, y + 8)], accent, '#ffffff', light, stroke=4))
    elif kind == 'lava':
        for path in ['M176,150 L204,186 L192,214', 'M330,142 L314,178 L336,206', 'M210,260 L240,276 L274,262 L300,280',
                     'M118,380 L152,400 L140,432', 'M392,372 L362,398 L380,430', 'M226,350 L250,380 L238,420 L262,452']:
            s.append(f'<path d="{path}" fill="none" stroke="{accent}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" opacity="0.45"/>')
            s.append(f'<path d="{path}" fill="none" stroke="#ffd36a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>')
    elif kind == 'iron':
        for x, y in [(176, 146), (336, 146), (172, 272), (340, 272), (96, 400), (142, 352), (416, 400), (370, 352), (200, 470), (312, 470)]:
            s.append(f'<circle cx="{x}" cy="{y}" r="7" fill="{accent}" stroke="#0b0c12" stroke-width="3"/>')
        s.append(f'<path d="M{CX},126 L{CX},300" stroke="{dark}" stroke-width="6" opacity="0.7"/>')
    elif kind == 'strata':
        for i, y in enumerate([150, 182, 250, 280, 372, 410, 452]):
            s.append(f'<path d="M100,{y} Q256,{y + (12 if i % 2 else -10)} 412,{y}" fill="none" stroke="{accent}" stroke-width="7" opacity="0.7"/>')
    elif kind == 'shards':
        for x, y, h, a in [(186, 132, 50, -18), (226, 116, 66, -6), (288, 114, 60, 8), (326, 130, 44, 20), (92, 360, 46, -24), (420, 360, 46, 24)]:
            s.append(f'<g transform="rotate({a} {x} {y})">' + faceted([(x - 13, y + 10), (x - 9, y - h * 0.7), (x, y - h), (x + 9, y - h * 0.7), (x + 13, y + 10)], accent, '#ffffff', light, stroke=4) + '</g>')
    elif kind in ('incised', 'glaze'):
        for y in (150, 260):
            s.append(f'<path d="M176,{y} L336,{y}" stroke="{accent}" stroke-width="5" stroke-dasharray="14 10" opacity="0.8"/>')
        for x in range(150, 380, 30):
            s.append(f'<circle cx="{x}" cy="410" r="5" fill="{accent}" opacity="0.8"/>')
        if kind == 'glaze':
            s.append(f'<path d="M178,128 Q256,160 334,128 L330,170 Q256,196 182,170 Z" fill="{accent}" opacity="0.55"/>')
    elif kind == 'sheen':
        s.append(f'<path d="M190,130 L226,124 L170,290 L146,286 Z" fill="{accent}" opacity="0.13"/>')
        s.append(f'<path d="M110,350 L140,342 L104,440 L84,430 Z" fill="{accent}" opacity="0.12"/>')
    elif kind in ('leaves', 'thorns'):
        for path in ['M150,500 Q160,440 132,400', 'M362,500 Q352,440 380,400', 'M256,512 Q248,470 262,440']:
            s.append(f'<path d="{path}" fill="none" stroke="{dark}" stroke-width="8" stroke-linecap="round"/>')
        if kind == 'leaves':
            for x, y, a in [(212, 112, -30), (256, 100, 0), (300, 112, 30), (110, 344, -50), (402, 344, 50)]:
                s.append(f'<g transform="rotate({a} {x} {y})"><ellipse cx="{x}" cy="{y - 18}" rx="13" ry="26" fill="{accent}" stroke="#0b0c12" stroke-width="3"/><path d="M{x},{y} L{x},{y - 38}" stroke="#2f5a22" stroke-width="3"/></g>')
        else:
            for x, y, a in [(172, 140, -40), (210, 120, -15), (302, 120, 15), (340, 140, 40), (90, 360, -60), (422, 360, 60), (160, 330, -30), (352, 330, 30)]:
                s.append(f'<g transform="rotate({a} {x} {y})"><polygon points="{pts([(x - 9, y + 6), (x, y - 30), (x + 9, y + 6)])}" fill="{accent}" stroke="#0b0c12" stroke-width="3" stroke-linejoin="round"/></g>')
    elif kind == 'coral':
        for x0, y0, d in [(200, 124, -1), (312, 124, 1), (100, 352, -1), (412, 352, 1)]:
            s.append(f'<path d="M{x0},{y0} l{d * -6},-40 M{x0 - d * 4},{y0 - 24} l{d * -24},-18 M{x0 - d * 5},{y0 - 34} l{d * 18},-22" fill="none" stroke="{accent}" stroke-width="11" stroke-linecap="round"/>')
        for x, y, r in [(150, 220, 6), (372, 196, 8), (390, 240, 5), (128, 180, 5)]:
            s.append(f'<circle cx="{x}" cy="{y}" r="{r}" fill="none" stroke="#bfe9ff" stroke-width="2.5" opacity="0.8"/>')
    elif kind in ('cloud', 'bolt'):
        for cx, cy, r in [(84, 410, 40), (128, 388, 36), (170, 404, 30), (428, 410, 40), (384, 388, 36), (342, 404, 30), (256, 112, 30), (220, 120, 24), (292, 120, 24)]:
            s.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{accent if kind == "cloud" else "#c9d0e0"}" opacity="0.95"/>')
        if kind == 'bolt':
            s.append(f'<polygon points="{pts([(268, 60), (232, 132), (258, 132), (238, 186), (290, 114), (262, 114), (284, 60)])}" fill="{accent}" stroke="#0b0c12" stroke-width="4" stroke-linejoin="round"/>')
    elif kind == 'horns':
        for d in (-1, 1):
            x = CX + d * 84
            s.append(faceted([(x - d * 4, 156), (x + d * 54, 82), (x + d * 34, 160)], accent, '#ffffff', dark, stroke=4))
    return ''.join(s)


def golem_svg(slug, name, core, body, bg, accent, shape, kind, extra=None, seed=1):
    state = [seed * 9301 + 49297]

    def rng():
        state[0] = (state[0] * 1103515245 + 12345) & 0x7FFFFFFF
        return state[0] / 0x7FFFFFFF

    base, light, dark = body
    gb, gl, gd = GEM[core]
    left_pad, right_pad, chest, neck = torso()
    head = head_points(shape['hw'], shape['top'], shape['jaw'])
    brow_y = 186
    brow = [(CX - shape['hw'] + 8, brow_y - shape['brow'] / 2), (CX + shape['hw'] - 8, brow_y - shape['brow'] / 2),
            (CX + shape['hw'] - 16, brow_y + shape['brow'] / 2), (CX - shape['hw'] + 16, brow_y + shape['brow'] / 2)]
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{VIEW}" width="{S}" height="{S}">',
        f'<title>{name}</title>',
        '<defs>',
        f'<radialGradient id="bg" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="{bg[0]}"/><stop offset="1" stop-color="{bg[1]}"/></radialGradient>',
        f'<radialGradient id="eyeglow"><stop offset="0" stop-color="{gl}" stop-opacity="0.7"/><stop offset="1" stop-color="{gb}" stop-opacity="0"/></radialGradient>',
        f'<radialGradient id="coreglow"><stop offset="0" stop-color="{gl}" stop-opacity="0.85"/><stop offset="0.6" stop-color="{gb}" stop-opacity="0.25"/><stop offset="1" stop-color="{gb}" stop-opacity="0"/></radialGradient>',
        '</defs>',
        f'<rect width="{S}" height="{S}" fill="url(#bg)"/>',  # whole grid: the zoomed view is always covered
        f'<circle cx="{CX}" cy="{CORE_Y + 10}" r="150" fill="url(#coreglow)" opacity="0.35"/>',
        faceted(chest, base, light, dark),
        faceted(neck, dark, base, '#0b0c12'),
        faceted(left_pad, base, light, dark),
        faceted(right_pad, base, light, dark),
        f'<circle cx="{CX}" cy="{CORE_Y}" r="70" fill="url(#coreglow)"/>',
        f'<polygon points="{pts(reg(SIDES[core] if SIDES[core] > 3 else 6, CX, CORE_Y, 44, -90 if SIDES[core] != 4 else -45))}" fill="{dark}" stroke="#0b0c12" stroke-width="5" stroke-linejoin="round"/>',
        gem(core, CX, CORE_Y, 30),
        faceted(head, base, light, dark),
        f'<polygon points="{pts(brow)}" fill="{dark}" opacity="0.9"/>',
        eyes(shape['eyes'], core),
        f'<path d="M{CX - 30},{268} L{CX + 30},{268}" stroke="#0b0c12" stroke-width="6" stroke-linecap="round" opacity="0.75"/>',
        texture(kind, accent, body, rng),
    ]
    if extra:
        parts.append(texture(extra, accent, body, rng))
    parts.append('</svg>')
    return ''.join(parts)


def build():
    out = []
    for i, (slug, name, core, body, bg, accent, shape, kind) in enumerate(ARCHETYPES):
        out.append(dict(id=i + 1, slug=slug, name=name, core=core,
                        svg=golem_svg(slug, name, core, body, bg, accent, shape, kind, seed=i + 1)))
    for i, (slug, name, core, body, bg, accent, extra) in enumerate(VARIANTS):
        a = ARCHETYPES[i]
        shape = dict(a[6])
        shape['hw'] += 6 if i % 2 else -6  # variants get a slightly different head
        kind = a[7]
        if extra in ('speckle', 'ferns', 'glaze', 'thorns', 'bolt'):
            kind, extra = extra, None  # replaces the base texture
        out.append(dict(id=13 + i, slug=slug, name=name, core=core,
                        svg=golem_svg(slug, name, core, body, bg, accent, shape, kind, extra=extra, seed=40 + i)))
    return out


def preview_html(items):
    cells = []
    for it in items:
        cells.append(f'''<figure><img class="big" src="{it['id']}.svg" alt=""><img class="small" src="{it['id']}.svg" alt="">
<figcaption>{it['id']}. {it['name']} <span class="c c-{it['core']}"></span></figcaption></figure>''')
    return f'''<!doctype html><meta charset="utf-8"><title>Golem avatars</title>
<style>
body{{margin:0;padding:24px;background:#12131c;color:#ece6d6;font:14px system-ui}}
.grid{{display:grid;grid-template-columns:repeat(6,1fr);gap:18px}} .parch{{background:#f3ecd6;color:#2b2118;padding:16px;border-radius:14px;margin-top:20px}}
figure{{margin:0;display:flex;flex-direction:column;align-items:center;gap:6px}}
img{{border-radius:50%;border:2px solid #b8864b;object-fit:cover}} .big{{width:96px;height:96px}} .small{{width:36px;height:36px}}
.c{{display:inline-block;width:10px;height:10px;border-radius:2px;vertical-align:middle}}
.c-yellow{{background:#f0cc3a}}.c-green{{background:#3ea060}}.c-blue{{background:#3a8cd0}}.c-pink{{background:#c84096}}
</style>
<h2>Stone</h2><div class="grid">{''.join(cells)}</div>
<div class="parch"><h2>Parchment</h2><div class="grid">{''.join(cells)}</div></div>'''


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    dest = os.path.join(here, '..', 'assets-src', 'avatars')
    os.makedirs(dest, exist_ok=True)
    items = build()
    counts = {}
    for it in items:
        counts[it['core']] = counts.get(it['core'], 0) + 1
        with open(os.path.join(dest, f"{it['id']}.svg"), 'w', encoding='utf-8') as f:
            f.write(it['svg'] + '\n')
    assert len(items) == 24 and len({i['name'] for i in items}) == 24 and set(counts.values()) == {6}, counts
    with open(os.path.join(dest, 'avatars.json'), 'w', encoding='utf-8') as f:
        json.dump([{k: v for k, v in it.items() if k != 'svg'} for it in items], f, indent=1)
        f.write('\n')
    if '--preview' in sys.argv:
        out = sys.argv[sys.argv.index('--preview') + 1]
        with open(out, 'w', encoding='utf-8') as f:
            f.write(preview_html(items))
    print(f'{len(items)} avatar → {os.path.relpath(dest)} ({", ".join(f"{k} {v}" for k, v in sorted(counts.items()))})')


if __name__ == '__main__':
    main()
