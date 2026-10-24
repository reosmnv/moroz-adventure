"""Скачивает все кандидаты create_image_pro и собирает лист для выбора.
python3 tools/ui_sheet.py <name> [zoom]  -> assets/ui/raw/<name>/c<i>.png и /tmp/ui/sheet-<name>.png"""
import re, sys
from pathlib import Path
from PIL import Image, ImageDraw
sys.path.insert(0, str(Path(__file__).parent))
from sprites import get

d = Path(__file__).parent.parent / "assets/ui/raw" / sys.argv[1]
zoom = int(sys.argv[2]) if len(sys.argv) > 2 else 2
txt = (d / "result.txt").read_text()
n = int(re.search(r"frames: (\d+)", txt).group(1))
base = re.search(r"(https://api\.pixellab\.ai/mcp/images/\S+/download)", txt).group(1)
ims = []
for i in range(n):
    p = d / f"c{i}.png"
    if not p.exists():
        p.write_bytes(get(f"{base}?index={i}"))
    ims.append(Image.open(p).convert("RGBA"))
w, h = ims[0].size
cols = 8 if n > 16 else 4
rows = (n + cols - 1) // cols
cw, ch = w * zoom + 4, h * zoom + 14
sheet = Image.new("RGBA", (cols * cw, rows * ch), (80, 90, 110, 255))
dr = ImageDraw.Draw(sheet)
for i, im in enumerate(ims):
    x, y = (i % cols) * cw, (i // cols) * ch
    sheet.alpha_composite(im.resize((w * zoom, h * zoom), Image.NEAREST), (x + 2, y + 12))
    dr.text((x + 2, y), str(i), fill=(255, 255, 0, 255))
sheet.save(f"/tmp/ui/sheet-{sys.argv[1]}.png")
print(n, w, h)
