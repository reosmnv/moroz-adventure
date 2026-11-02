"""Стебли Рамиля для приёма A «Иди сюда» (рисуются кодом, бесплатно).
python3 tools/ramil_vines.py -> assets/vfx/ramil/vines/: seg-0..2.png (кусок 24x16, повторяется по длине, 3 фазы шевеления),
head.png (наконечник-лист 20x20), wrap-0..3.png (петля вокруг врага 34x22), preview.png.
Код игры: стебель растёт от руки к врагу кусками seg, на конце head, у пойманного врага wrap на поясе."""
import math
from pathlib import Path
from PIL import Image

OUT = Path(__file__).resolve().parent.parent / 'assets/vfx/ramil/vines'
OUT.mkdir(parents=True, exist_ok=True)
K = (18, 36, 20, 255)
G = [(38, 96, 40, 255), (64, 140, 52, 255), (112, 186, 76, 255), (176, 222, 120, 255)]


def put(im, x, y, c):
    x, y = int(round(x)), int(round(y))
    if 0 <= x < im.width and 0 <= y < im.height:
        im.putpixel((x, y), c)


def outline(im):
    src = im.copy(); px = src.load()
    for y in range(im.height):
        for x in range(im.width):
            if px[x, y][3] == 0 and any(0 <= x + dx < im.width and 0 <= y + dy < im.height and px[x + dx, y + dy][3] and px[x + dx, y + dy] != K
                                        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                im.putpixel((x, y), K)


LEAF_S = ["....L....",
          ".L..L..L.",
          "..L.L.L..",
          "L..LLL..L",
          ".LLLLLLL.",
          "...LLL...",
          "....s...."]
LEAF_B = [".....L.....",
          "..L..L..L..",
          "..L..L..L..",
          "...L.L.L...",
          "L...LLL...L",
          ".LL.LLL.LL.",
          "..LLLLLLL..",
          "....LLL....",
          ".....s....."]


def tleaf(im, cx, cy, tpl, rot):
    """Лист по шаблону; rot: 0 вверх, 2 вниз, 1 вправо. (cx, cy) = черенок."""
    h, w = len(tpl), len(tpl[0])
    for r, row in enumerate(tpl):
        for c, ch in enumerate(row):
            if ch == '.':
                continue
            dx, dy = c - w // 2, r - (h - 1)
            if rot == 2:
                dx, dy = dx, -dy
            elif rot == 1:
                dx, dy = -dy, dx
            col = G[0] if ch == 's' else (G[3] if (r + c) % 5 == 0 else G[2])
            put(im, cx + dx, cy + dy, col)


def leaf(im, cx, cy, ang, size):
    """Лист конопли: 7 узких долей веером."""
    for i, (da, ln) in enumerate(zip((-75, -50, -25, 0, 25, 50, 75), (0.45, 0.7, 0.9, 1.0, 0.9, 0.7, 0.45))):
        a = math.radians(ang + da); L = size * ln
        for t in range(int(L * 4)):
            r = t / 4
            w = 1 if r < L * 0.8 else 0
            x, y = cx + math.cos(a) * r, cy + math.sin(a) * r
            put(im, x, y, G[2] if r > 1 else G[1])
            if w and r > 1.5:
                put(im, x - math.sin(a) * 0.8, y + math.cos(a) * 0.8, G[1])
    put(im, cx, cy, G[0])


def seg(phase):
    W, H = 24, 24
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for s, off in ((0, 0), (1, math.pi)):
        for x10 in range(W * 10):
            x = x10 / 10
            y = H / 2 + 3.2 * math.sin(2 * math.pi * x / W + off + phase)
            c = G[1] if math.cos(2 * math.pi * x / W + off + phase) > 0 else G[0]  # кто сверху в переплёте
            put(im, x, y, c); put(im, x, y + 1, G[0] if c == G[1] else G[0])
            if c == G[1]:
                put(im, x, y - 1, G[2])
    tleaf(im, 6, H / 2 - 4, LEAF_S, 0)
    tleaf(im, 18, H / 2 + 4, LEAF_S, 2)
    outline(im)
    return im


def head():
    im = Image.new('RGBA', (20, 20), (0, 0, 0, 0))
    tleaf(im, 3, 10, LEAF_B, 1)
    outline(im)
    return im


def wrap(phase):
    W, H = 34, 26
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for k in range(2):
        for t in range(400):
            a = 2 * math.pi * t / 400
            x = W / 2 + 14 * math.cos(a)
            y = H / 2 + 4 * math.sin(a) + k * 5 - 2 + 1.2 * math.sin(3 * a + phase)
            front = math.sin(a) > 0
            put(im, x, y, G[2] if front else G[0])
            put(im, x, y + 1, G[1] if front else G[0])
    tleaf(im, 4, 9, LEAF_S, 0); tleaf(im, 29, 15, LEAF_S, 2)
    outline(im)
    return im


segs = [seg(p) for p in (0, 2.1, 4.2)]
for i, s in enumerate(segs):
    s.save(OUT / f'seg-{i}.png')
head().save(OUT / 'head.png')
wraps = [wrap(p) for p in (0, 1.6, 3.2, 4.8)]
for i, w in enumerate(wraps):
    w.save(OUT / f'wrap-{i}.png')
for i, s_ in enumerate(segs):
    s_.save(OUT / f'seg-{i}.png')
# превью: стебель длиной 5 кусков + наконечник, рядом петля
pv = Image.new('RGBA', (24 * 5 + 20 + 50, 34), (58, 60, 70, 255))
for i in range(5):
    pv.alpha_composite(segs[i % 3], (i * 24, 2))
pv.alpha_composite(head(), (120, 5))
pv.alpha_composite(wraps[0], (145, 4))
pv.resize((pv.width * 5, pv.height * 5), Image.NEAREST).save(OUT / 'preview.png')
print('ok', OUT)
