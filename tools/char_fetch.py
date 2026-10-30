"""Скачивает ротации и все анимации одного персонажа PixelLab (для героев 2-4).
python3 tools/char_fetch.py <character_id> <папка>  -> <папка>/<анимация>/<dir>/<i>.png, <папка>/static/<dir>/0.png"""
import re, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from sprites import mcp, get, slug

cid, out = sys.argv[1], Path(sys.argv[2])
text = mcp("get_character", {"character_id": cid, "include_preview": False})
anim, section = None, None
for line in text.splitlines():
    if line.startswith("rotations:"): section = "rot"; continue
    if line.startswith("animations"): section = "anim"; continue
    if line.startswith("download:"): section = None
    if section == "rot":
        m = re.match(r"^\s+(\S+): (https\S+)", line)
        if m:
            p = out / "static" / m.group(1) / "0.png"; p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(get(m.group(2)))
    elif section == "anim":
        m = re.match(r"^  (\S.*?) — ", line)
        if m: anim = slug(m.group(1)); continue
        m = re.match(r"^\s+(\S+): (https\S+\{i\}\S+) \(i=0\.\.(\d+)\)", line)
        if m and anim:
            d, url, n = m.group(1), m.group(2), int(m.group(3))
            for i in range(n + 1):
                p = out / anim / d / f"{i}.png"; p.parent.mkdir(parents=True, exist_ok=True)
                p.write_bytes(get(url.replace("{i}", str(i))))
            print(anim, d, n + 1)
