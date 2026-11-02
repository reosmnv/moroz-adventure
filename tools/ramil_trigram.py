"""Огненный круг восьми триграмм под ногами Рамиля (серия A, шаги 3-4, отсылка к «64 ладоням» Неджи).
python3 tools/ramil_trigram.py -> assets/vfx/ramil/trigram.png (полоса 32 кадра, поворот на 360°, петля),
превью assets/gen/hero4/flurry/trigram.gif. Рисуется сверху (круг) и сплющивается в эллипс пола попиксельно."""
import math
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
W, H, N = 112, 40, 32           # кадр, число кадров (11.25° на кадр)
R = 52                           # радиус круга в «виде сверху», px
SQ = (H / 2 - 2) / R             # сплющивание по y
CX, CY = W / 2, H / 2
DARK, RED, ORANGE, YELLOW, WHITE = (120, 20, 10, 255), (220, 60, 25, 255), (255, 140, 60, 255), (255, 210, 110, 255), (255, 250, 220, 255)
# триграммы (снизу вверх): 1 = сплошная черта, 0 = разорванная. Порядок Фу Си по кругу
TRI = [(1, 1, 1), (0, 1, 1), (1, 0, 1), (0, 0, 1), (1, 1, 0), (0, 1, 0), (1, 0, 0), (0, 0, 0)]


def put(img, x, y, c):
    x, y = int(round(x)), int(round(y))
    if 0 <= x < W and 0 <= y < H:
        old = img.getpixel((x, y))
        # ярче поверх тусклого
        if old[3] == 0 or sum(c[:3]) >= sum(old[:3]):
            img.putpixel((x, y), c)


def plot(img, u, v, c):
    """u, v: координаты «сверху» от центра -> пиксель эллипса пола."""
    put(img, CX + u, CY + v * SQ, c)


def ring(img, r, c, step=0.6):
    n = int(2 * math.pi * r / step)
    for i in range(n):
        a = 2 * math.pi * i / n
        plot(img, r * math.cos(a), r * math.sin(a), c)


def frame(k):
    img = Image.new('RGBA', (W, H))
    rot = 2 * math.pi * k / N
    flick = 0.5 + 0.5 * math.sin(2 * math.pi * k / 8)  # пульс 4 раза за оборот
    ring(img, R + 1, DARK); ring(img, R, RED); ring(img, R - 1, ORANGE)
    ring(img, R * 0.42, RED); ring(img, R * 0.42 - 1, ORANGE if flick > 0.5 else YELLOW)
    ring(img, 4, YELLOW); ring(img, 2, WHITE)
    for i, tri in enumerate(TRI):
        a = rot + 2 * math.pi * i / 8
        ca, sa = math.cos(a), math.sin(a)
        for j, solid in enumerate(tri):            # три черты поперёк радиуса
            r = R * (0.62 + 0.11 * j)
            half = 7 + 1.2 * j
            for t in [x * 0.5 for x in range(int(-half * 2), int(half * 2) + 1)]:
                if not solid and abs(t) < 2.2:
                    continue
                u, v = r * ca - t * sa, r * sa + t * ca
                plot(img, u, v, YELLOW if j == 1 and flick > 0.6 else ORANGE)
        # спица от внутреннего кольца к триграмме
        for s in range(int(R * 0.44), int(R * 0.58)):
            plot(img, s * ca, s * sa, RED)
    # мягкое свечение: тусклая копия на пиксель вниз
    glow = Image.new('RGBA', (W, H))
    for (x, y) in [(x, y) for x in range(W) for y in range(H) if img.getpixel((x, y))[3]]:
        if y + 1 < H and not img.getpixel((x, y + 1))[3]:
            glow.putpixel((x, y + 1), (255, 120, 40, 110))
    glow.alpha_composite(img)
    return glow


def main():
    out = ROOT / 'assets/vfx/ramil'; out.mkdir(parents=True, exist_ok=True)
    fr = [frame(k) for k in range(N)]
    strip = Image.new('RGBA', (W * N, H))
    for i, f in enumerate(fr): strip.paste(f, (i * W, 0))
    strip.save(out / 'trigram.png')
    pv = ROOT / 'assets/gen/hero4/flurry'; pv.mkdir(parents=True, exist_ok=True)
    bg = [Image.alpha_composite(Image.new('RGBA', (W, H), (40, 40, 48, 255)), f).resize((W * 4, H * 4), Image.NEAREST) for f in fr]
    bg[0].save(pv / 'trigram.gif', save_all=True, append_images=bg[1:], duration=100, loop=0)
    print('ok', strip.size)


main()
