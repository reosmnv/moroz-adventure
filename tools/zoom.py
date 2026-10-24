"""Крупный просмотр кадров: python3 tools/zoom.py out.png scale a.png b.png ... (полосы с ячейкой 128)"""
import sys
from PIL import Image
out, scale, files = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
rows = []
for f in files:
    im = Image.open(f).convert("RGBA")
    n = im.width // 128
    r = Image.new("RGBA", (96 * n, 96), (90, 90, 100, 255))
    for i in range(n):
        c = im.crop((i * 128 + 16, 20, i * 128 + 112, 116))
        r.paste(c, (i * 96, 0), c)
    rows.append(r.resize((r.width * scale, r.height * scale), Image.NEAREST))
cv = Image.new("RGBA", (max(r.width for r in rows), sum(r.height for r in rows)), (60, 60, 70, 255))
y = 0
for r in rows:
    cv.paste(r, (0, y))
    y += r.height
cv.save(out)
