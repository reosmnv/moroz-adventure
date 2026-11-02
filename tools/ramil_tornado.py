"""Смерч в стиле «тасманского дьявола» для урагана Рамиля (TZ-17): пыльная воронка, широкая сверху, узкая снизу,
полосы закручиваются, края рваные, белые дуги скорости. Петля 12 кадров.
python3 tools/ramil_tornado.py -> assets/vfx/ramil/tornado.png (полоса 12x 72x92), превью assets/gen/hero4/throat/tornado.gif"""
import math, random
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
W, H, N = 72, 92, 12
DUST = (196, 174, 140); DARK = (138, 116, 90); DEEP = (98, 80, 62); LIGHT = (232, 218, 192); OUT = (60, 46, 36)


def half_w(y, ph):
    t = y / (H - 1)                       # 0 сверху, 1 внизу
    w = 9 + 25 * (1 - t) ** 0.8 + 2.2 * math.sin(y * 0.16 + ph * 2 * math.pi)
    if y < 14: w *= math.sqrt(max(0.0, 1 - ((14 - y) / 12) ** 2))  # купол сверху
    return w


def center(y, ph):
    return W / 2 + 3 * math.sin(y * 0.06 + ph * 2 * math.pi) * (y / H)


def frame(k):
    ph = k / N
    img = Image.new('RGBA', (W, H)); px = img.load()
    rnd = random.Random(k)
    for y in range(4, H - 2):
        hw, cx = half_w(y, ph), center(y, ph)
        for x in range(W):
            if hw < 1: continue
            u = (x - cx) / hw
            if abs(u) > 1: continue
            a = math.asin(max(-1, min(1, u)))           # угол на «цилиндре»
            band = math.sin(a * 3 + y * 0.32 - ph * 2 * math.pi * 3)
            shade = -u * 0.35                          # слева темнее, справа светлее
            v = band * 0.6 + shade
            c = DEEP if v < -0.55 else DARK if v < -0.1 else DUST if v < 0.45 else LIGHT
            alpha = 235 if abs(u) < 0.85 else 170
            px[x, y] = (*c, alpha)
        # рваный край и контур
        for side in (-1, 1):
            ex = int(round(cx + side * hw))
            if 0 <= ex < W: px[ex, y] = (*OUT, 220)
            if rnd.random() < 0.18:
                fx = int(round(cx + side * (hw + rnd.randint(2, 5))))
                if 0 <= fx < W: px[fx, y] = (*DUST, 200)
    # белые дуги скорости поперёк воронки
    for i in range(4):
        y0 = int((i * 23 + k * 7) % (H - 20)) + 8
        hw, cx = half_w(y0, ph), center(y0, ph)
        if hw < 2: continue
        for s in range(-int(hw * 0.9), int(hw * 0.9)):
            yy = y0 + int(3 * (1 - (s / hw) ** 2))
            if 0 <= yy < H and 0 <= int(cx + s) < W: px[int(cx + s), yy] = (255, 252, 240, 230)
    # клочья пыли у основания
    for _ in range(10):
        bx, by = rnd.randint(14, W - 15), rnd.randint(H - 10, H - 1)
        for dx in (0, 1):
            if 0 <= bx + dx < W: px[bx + dx, by] = (*DUST, 210)
    return img


def main():
    out = ROOT / 'assets/vfx/ramil'; out.mkdir(parents=True, exist_ok=True)
    fr = [frame(k) for k in range(N)]
    strip = Image.new('RGBA', (W * N, H))
    for i, f in enumerate(fr): strip.paste(f, (i * W, 0))
    strip.save(out / 'tornado.png')
    pv = ROOT / 'assets/gen/hero4/throat'; pv.mkdir(parents=True, exist_ok=True)
    bg = [Image.alpha_composite(Image.new('RGBA', (W, H), (110, 110, 118, 255)), f).resize((W * 4, H * 4), Image.NEAREST) for f in fr]
    bg[0].save(pv / 'tornado.gif', save_all=True, append_images=bg[1:], duration=50, loop=0)
    print('ok', strip.size)


main()
