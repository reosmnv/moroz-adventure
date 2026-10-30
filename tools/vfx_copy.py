"""Нужные игре листы эффектов героев -> client/public/vfx/<герой>/ и таблица кадров client/src/vfx-data.ts.
python3 tools/vfx_copy.py  (после пересборки эффектов в assets/vfx/<герой>/<пачка>/)"""
import json, shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC, DST = ROOT / "assets/vfx", ROOT / "client/public/vfx"
# ключ в игре -> (герой, пачка, часть)
PICK = {
    "nadya-hit": ("nadya", "hits", "hit_star"),
    "nadya-slap": ("nadya", "glint", "flash_burst"),
    "nadya-boom": ("nadya", "ult", "crackle_burst"),
    "nadya-twinkle": ("nadya", "ult", "twinkles"),
    "nadya-charm": ("nadya", "jealous", "charm_hearts"),
    "stun": ("nadya", "status", "stun_stars"),
    "slow": ("nadya", "status", "debuff_arrows"),
    "kris-hit": ("kris", "flash", "hit_star"),
    "kris-bolt": ("kris", "flash", "blaster_bolt"),
    "kris-muzzle": ("kris", "flash", "muzzle_flash"),
    "kris-flash": ("kris", "flash", "flash_burst"),
    "kris-ring": ("kris", "flash", "shockwave_ring"),
    "kris-charge": ("kris", "flash", "charge_up"),
    "kris-boom": ("kris", "ball", "cartoon_boom"),
}
# одиночные картинки (рисованы скриптом)
SINGLE = {"heart": "nadya/heart-big.png", "ball": "kris/ball.png", "aim": "kris/aim-mid.png",
          **{f"beam-{p}-{i}": f"kris/beam-{p}-{i}.png" for p in ("start", "mid", "end") for i in range(3)}}

DST.mkdir(parents=True, exist_ok=True)
rows = []
for key, (hero, pack, part) in PICK.items():
    m = json.loads((SRC / hero / pack / "manifest.json").read_text())
    c = next(c for c in m["clips"] if c["name"] == f"part-{part}")
    shutil.copyfile(SRC / hero / pack / f"part-{part}.png", DST / f"{key}.png")
    rows.append(f"  '{key}': {{ w: {c['frame']['w']}, h: {c['frame']['h']}, n: {c['frames']}, fps: {m['fps']}, loop: {str(c['loop']).lower()} }},")
for key, rel in SINGLE.items():
    shutil.copyfile(SRC / rel, DST / f"{key}.png")
ts = ["// Сгенерировано tools/vfx_copy.py, руками не править.",
      "export const VFX: Record<string, { w: number; h: number; n: number; fps: number; loop: boolean }> = {", *rows, "};",
      f"export const VFX_IMAGES = {json.dumps(list(SINGLE))};", ""]
(ROOT / "client/src/vfx-data.ts").write_text("\n".join(ts))
print(len(PICK), len(SINGLE))
