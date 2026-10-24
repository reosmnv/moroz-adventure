"""GIF каждой анимации (x3, на сером фоне) для просмотра без браузера: assets/sprites/gif/<state>-<anim>-<dir>.gif"""
import json, sys
from pathlib import Path
from PIL import Image
sys.path.insert(0, str(Path(__file__).parent))
from sprites import OUT, CELL

meta = json.loads((OUT / "anims.json").read_text())
gd = OUT / "gif"
gd.mkdir(exist_ok=True)
for state, anims in meta["states"].items():
    for name, a in anims.items():
        for d in ("east", "west"):
            if d not in a or a[d] < 2:
                continue
            strip = Image.open(OUT / state / f"{name}-{d}.png").convert("RGBA")
            frames = []
            for i in range(a[d]):
                bg = Image.new("RGBA", (CELL, CELL), (70, 72, 84, 255))
                c = strip.crop((i * CELL, 0, (i + 1) * CELL, CELL))
                bg.alpha_composite(c)
                frames.append(bg.convert("RGB").resize((CELL * 3, CELL * 3), Image.NEAREST))
            dur = [int(1000 / a["fps"])] * len(frames)
            if not a["loop"]:
                dur[-1] = 500
            frames[0].save(gd / f"{state}-{name}-{d}.gif", save_all=True, append_images=frames[1:], duration=dur, loop=0)
print(len(list(gd.glob("*.gif"))), "gif")
