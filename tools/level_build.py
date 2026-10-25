"""Собирает ассеты уровня 1 из assets/level1/raw в client/public/level1/.
python3 tools/level_build.py   (выбор вариантов в PICK)"""
import shutil
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).parent.parent
RAW = ROOT / "assets/level1/raw"
OUT = ROOT / "client/public/level1"
PICK = {"seg-0": "s1_v0", "seg-1": "s2_v0", "seg-2": "s3_v0", "seg-3": "s4_v0"}
PROPS = ["bench", "urn", "scooter", "metro_sign", "planter", "cart", "lamp"]

OUT.mkdir(parents=True, exist_ok=True)
for name, src in PICK.items():
    p = ROOT / "assets/level1" / f"{name}.png"  # склеенная/исправленная версия важнее сырой
    shutil.copy(p if p.exists() else RAW / src / "0.png", OUT / f"{name}.png")
for name in PROPS:
    im = Image.open(RAW / name / "0.png").convert("RGBA")
    im.crop(im.getbbox()).save(OUT / f"{name}.png")
card = Image.open(RAW / "card_pro/0.png").convert("RGBA")
card.crop((0, 6, card.width, card.height - 6)).save(OUT / "card.png")  # белые полосы сверху и снизу
print("ok", sorted(f.name for f in OUT.iterdir()))
