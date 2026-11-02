"""Дым сигареты Рамиля: зацикленный, рисуется кодом (без генераций).
python3 tools/ramil_smoke.py -> assets/vfx/ramil/smoke-{idle,heavy}.png (полоса кадров), x6 и gif для просмотра.
Якорь: низ по центру кадра = кончик сигареты. Дым сносит назад (влево при взгляде вправо)."""
import math
from pathlib import Path
from PIL import Image

OUT = Path(__file__).resolve().parent.parent / 'assets/vfx/ramil'
RAMP = [(242, 242, 246), (214, 215, 224), (182, 184, 198), (150, 153, 170)]


def put(px, w, h, x, y, c, a):
    x, y = int(round(x)), int(round(y))
    if 0 <= x < w and 0 <= y < h and px[x, y][3] < a:
        px[x, y] = (*c, int(a))


def disc(px, w, h, cx, cy, r, c, a):
    ri = int(math.ceil(r))
    for dy in range(-ri, ri + 1):
        for dx in range(-ri, ri + 1):
            d = math.hypot(dx, dy)
            if d <= r:
                # край темнее и прозрачнее: объём
                cc = RAMP[min(3, 1 + int(2 * d / max(r, 1)))] if r >= 1.5 else c
                put(px, w, h, cx + dx, cy + dy, cc, a * (1 - 0.35 * d / max(r, 1)))


def make(name, w, h, frames, ribbon_h, n_puffs, puff_r, drift, alpha0, wobble):
    ims = []
    for f in range(frames):
        ph = f / frames
        im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); px = im.load()
        x0 = w * 0.62
        # тонкая струйка у кончика: волна бежит вверх, период = длина цикла
        for i in range(ribbon_h):
            t = i / ribbon_h
            x = x0 - drift * 0.4 * t + wobble * t * math.sin(2 * math.pi * (t * 1.3 - ph))
            put(px, w, h, x, h - 1 - i, RAMP[0 if t < 0.5 else 1], alpha0 * (1 - 0.5 * t))
        # клубки: каждый живёт один цикл со своим сдвигом фазы
        for k in range(n_puffs):
            t = (ph + k / n_puffs) % 1.0
            y = h - 1 - ribbon_h - t * (h - ribbon_h - 2)
            x = x0 - drift * (0.4 + t) + wobble * 1.4 * math.sin(2 * math.pi * (t * 1.1 + k * 0.37))
            r = puff_r * (0.5 + t)
            a = alpha0 * (1 - t) ** 1.3
            if a > 30:
                disc(px, w, h, x, y, r, RAMP[min(3, int(t * 4))], a)
        ims.append(im)
    sheet = Image.new('RGBA', (w * frames, h))
    for i, im in enumerate(ims):
        sheet.paste(im, (i * w, 0))
    sheet.save(OUT / f'smoke-{name}.png')
    bg = Image.new('RGBA', sheet.size, (60, 62, 72, 255)); bg.alpha_composite(sheet)
    bg.resize((sheet.width * 6, sheet.height * 6), Image.NEAREST).save(OUT / f'smoke-{name}-x6.png')
    g = [Image.alpha_composite(Image.new('RGBA', (w, h), (60, 62, 72, 255)), im).resize((w * 8, h * 8), Image.NEAREST) for im in ims]
    g[0].save(OUT / f'smoke-{name}.gif', save_all=True, append_images=g[1:], duration=90, loop=0, disposal=2)


make('idle', 18, 30, 16, 9, 5, 0.9, 6, 245, 1.6)     # постоянный дымок
make('heavy', 28, 40, 16, 7, 7, 2.6, 9, 235, 2.5)    # перед телепортом и во время «Перекура»
print('ok', OUT)
