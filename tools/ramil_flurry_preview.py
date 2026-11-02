"""Превью серии A Рамиля в реальном темпе (TZ-13): flurry-in, f1 2x160, f2 4x80, flurry2-in, f3 8x45, f4 16x30, flurry2-out.
python3 tools/ramil_flurry_preview.py -> assets/gen/hero4/flurry/preview.gif (кадр GIF 20 мс, x3). Огонь здесь условный, в игре рисует клиент."""
import json, math
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SD = ROOT / 'assets/sprites/ramil'
A = json.loads((SD / 'anims.json').read_text())['states']['ramil']
FISTS = json.loads((ROOT / 'client/src/ramil-tips.ts').read_text().split('RAMIL_FISTS: Record<string, [number, number][]> = ')[1].split(';')[0])
TRI = Image.open(ROOT / 'assets/vfx/ramil/trigram.png'); TW = 112
strip = lambda n: Image.open(SD / f'{n}-east.png').convert('RGBA')
S = {n: strip(n) for n in ('flurry-in', 'flurry', 'flurry2-in', 'flurry2', 'flurry2-out', 'idle')}
DT = 20
seq = [('idle', 300, 0, 0), ('flurry-in', 3 * 1000 / 18, 0, 0)]
for lvl, (n, hits, step) in enumerate([('flurry', 2, 160), ('flurry', 4, 80), ('flurry2', 8, 45), ('flurry2', 16, 30)], 1):
    if lvl == 3: seq.append(('flurry2-in', 4 * 1000 / 18, 0, 3))
    seq.append((n, hits * step, step, lvl))
seq.append(('flurry2-out', 3 * 1000 / 18, 0, 0)); seq.append(('idle', 400, 0, 0))
frames, t_tri = [], 0
for name, dur, step, lvl in seq:
    a = A[name]; n = a['east']; per = len(a.get('hits', [1]))
    t = 0
    while t < dur:
        if step:
            ph = (t % (step * per)) / (step * per); fi = int(ph * n) % n
        else:
            fi = min(n - 1, int(t / dur * n)) if name != 'idle' else int(t / 125) % n
        img = Image.new('RGBA', (200, 110), (60, 62, 72, 255))
        if lvl >= 3:
            t_tri += DT; k = int(t_tri / (100 if lvl == 3 else 50)) % 32
            img.alpha_composite(TRI.crop((k * TW, 0, (k + 1) * TW, 40)), (64 - TW // 2 + 6, 112 - 20 - 18 + 0))
        cell = S[name].crop((fi * 128, 0, (fi + 1) * 128, 128))
        img.alpha_composite(cell.crop((0, 18, 128, 128)), (6, 0))
        if name in ('flurry', 'flurry2') and lvl:
            x, y = FISTS[name][fi]; x += 6; y -= 18
            d = ImageDraw.Draw(img); r = [1, 2, 4, 6][lvl - 1]
            for rr, c in ((r + 2, (255, 90, 30, 255)), (r, (255, 170, 60, 255)), (max(1, r - 2), (255, 240, 180, 255))):
                d.ellipse((x - rr, y - rr, x + rr, y + rr), fill=c)
            if lvl >= 3:
                for j in range(1, lvl):
                    d.line((x - 4 * j - 2, y + (j % 2) * 2 - 1, x - 4 * j - 8, y + (j % 2) * 2 - 1), fill=(255, 140, 50, 255))
        frames.append(img.resize((600, 330), Image.NEAREST))
        t += DT
out = ROOT / 'assets/gen/hero4/flurry/preview.gif'
frames[0].save(out, save_all=True, append_images=frames[1:], duration=DT, loop=0, disposal=2)
print(out, len(frames), 'кадров', len(frames) * DT, 'мс')
