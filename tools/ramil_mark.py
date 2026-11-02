"""Метка Рамиля над врагом (после B-телепорта): дымное кольцо крутится, внутри тлеющий огонёк. Кодом, бесплатно.
python3 tools/ramil_mark.py -> assets/vfx/ramil/mark.png (полоса 8 кадров 20x14), mark-x6.png"""
import math
from pathlib import Path
from PIL import Image
OUT = Path(__file__).resolve().parent.parent / 'assets/vfx/ramil'
W, H, N = 20, 14, 8
sheet = Image.new('RGBA', (W * N, H))
for f in range(N):
    im = Image.new('RGBA', (W, H)); ph = 2 * math.pi * f / N
    for t in range(360):
        a = math.radians(t)
        x, y = W / 2 + 8 * math.cos(a), H / 2 + 3.2 * math.sin(a)
        br = 0.5 + 0.5 * math.cos(a - ph)                 # светлый блик бежит по кольцу
        c = (int(150 + 90 * br), int(152 + 88 * br), int(168 + 72 * br), 255)
        im.putpixel((int(round(x)) % W, int(round(y)) % H), c)
    glow = (255, 190, 80, 255) if f % 4 < 2 else (245, 120, 40, 255)
    for dx, dy in ((0, 0), (1, 0), (0, 1), (1, 1)):
        im.putpixel((W // 2 - 1 + dx, H // 2 - 1 + dy), glow)
    sheet.paste(im, (f * W, 0))
sheet.save(OUT / 'mark.png')
bg = Image.new('RGBA', sheet.size, (58, 60, 70, 255)); bg.alpha_composite(sheet)
bg.resize((sheet.width * 6, H * 6), Image.NEAREST).save(OUT / 'mark-x6.png')
print('ok')
