"""Первый кадр стойки (idle), обрезанный до 64x64 с тем же положением тела, что у ротации.
Нужен как start/end кадр для v3-анимаций ударов: удар начинается и заканчивается в стойке.
python3 tools/startframes.py  -> assets/pixellab/keyposes/<state>-idle0-<dir>-64.png (+ .b64)"""
import base64, io, sys
from pathlib import Path
from PIL import Image
sys.path.insert(0, str(Path(__file__).parent))
from sprites import RAW, anchor

IDLE = {"prime": "pilot-idle-skel", "ultimate": "idle"}
out = RAW / "keyposes"
for state, idle in IDLE.items():
    for d in ("east", "west"):
        rot = Image.open(RAW / state / "static" / d / "0.png").convert("RGBA")
        fr = Image.open(RAW / state / idle / d / "0.png").convert("RGBA")
        rx, ry = anchor([rot])
        ix, iy = anchor([fr])
        crop = fr.crop((ix - rx, iy - ry, ix - rx + 64, iy - ry + 64))
        p = out / f"{state}-idle0-{d}-64.png"
        crop.save(p)
        b = io.BytesIO(); crop.save(b, "PNG")
        p.with_suffix(".b64").write_text(base64.b64encode(b.getvalue()).decode())
        print(p.name, crop.getchannel("A").getbbox())
