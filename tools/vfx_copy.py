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
    # Рамиль (02.11): телепорт, удары, огонь, горение
    "ramil-poof": ("ramil", "poof", "smoke_poof"),
    "ramil-hit": ("ramil", "hits", "hit_star"),
    "ramil-crit": ("ramil", "hits", "crit_hit"),
    "ramil-rise": ("ramil", "hits", "rising_slash"),
    "ramil-dash": ("ramil", "hits", "dash_slash"),
    "ramil-ring": ("ramil", "hits", "shockwave_ring"),
    "ramil-dust": ("ramil", "hits", "dust_kick"),
    "ramil-fire": ("ramil", "fire", "flamethrower"),
    "ramil-burn-back": ("ramil", "burn", "flame_aura"),
    "ramil-burn": ("ramil", "burn", "burn_status"),
}
# полосы, нарисованные скриптами (tools/ramil_smoke.py, ramil_mark.py): ключ -> (файл, w, h, fps, loop)
STRIPS = {"ramil-smoke": ("ramil/smoke-idle.png", 18, 30, 10, True),
          "ramil-smoke-heavy": ("ramil/smoke-heavy.png", 28, 40, 10, True),
          "ramil-mark": ("ramil/mark.png", 20, 14, 10, True),
          "ramil-wrap": (None, 34, 26, 10, True),
          "ramil-coil": ("ramil/vine2/coil.png", 36, 30, 10, True)}
# одиночные картинки (рисованы скриптом)
SINGLE = {"heart": "nadya/heart-big.png", "ball": "kris/ball.png", "aim": "kris/aim-mid.png",
          **{f"beam-{p}-{i}": f"kris/beam-{p}-{i}.png" for p in ("start", "mid", "end") for i in range(3)},
          **{f"ramil-vine-{i}": f"ramil/vines/seg-{i}.png" for i in range(3)}, "ramil-vine-head": "ramil/vines/head.png",
          "ramil-leaf-up": "ramil/vine2/leaf-up.png", "ramil-leaf-down": "ramil/vine2/leaf-down.png"}

DST.mkdir(parents=True, exist_ok=True)
rows = []
for key, (hero, pack, part) in PICK.items():
    m = json.loads((SRC / hero / pack / "manifest.json").read_text())
    c = next(c for c in m["clips"] if c["name"] == f"part-{part}")
    shutil.copyfile(SRC / hero / pack / f"part-{part}.png", DST / f"{key}.png")
    rows.append(f"  '{key}': {{ w: {c['frame']['w']}, h: {c['frame']['h']}, n: {c['frames']}, fps: {m['fps']}, loop: {str(c['loop']).lower()} }},")
# эффекты боссов (vfx_workbench, лист-сетка + json) -> полоса кадров в строку
from PIL import Image
BOSS = {"boss-ring": "boss-vstayu-ring", "boss-slam": "boss-stamp-slam", "boss-pyro": "boss-pyro-pillar",
        "boss-firework": "boss-firework", "boss-ban": "boss-ban-strike"}
for key, name in BOSS.items():
    j = json.loads((SRC / "boss" / f"{name}.json").read_text())
    sheet = Image.open(SRC / "boss" / f"{name}.png")
    fr = [f["frame"] for f in j["frames"]]
    w, h = fr[0]["w"], fr[0]["h"]
    strip = Image.new("RGBA", (w * len(fr), h))
    for i, f in enumerate(fr):
        strip.paste(sheet.crop((f["x"], f["y"], f["x"] + w, f["y"] + h)), (i * w, 0))
    strip.save(DST / f"{key}.png")
    fps = round(1000 / j["frames"][0]["duration"])
    loop = name == "boss-pyro-pillar"
    rows.append(f"  '{key}': {{ w: {w}, h: {h}, n: {len(fr)}, fps: {fps}, loop: {str(loop).lower()} }},")
for key, (rel, w, h, fps, loop) in STRIPS.items():
    if rel is None:  # петля стеблей: 4 кадра в полосу
        strip = Image.new("RGBA", (w * 4, h))
        for i in range(4):
            strip.paste(Image.open(SRC / f"ramil/vines/wrap-{i}.png"), (i * w, 0))
        strip.save(DST / f"{key}.png"); n = 4
    else:
        shutil.copyfile(SRC / rel, DST / f"{key}.png"); n = Image.open(SRC / rel).width // w
    rows.append(f"  '{key}': {{ w: {w}, h: {h}, n: {n}, fps: {fps}, loop: {str(loop).lower()} }},")
for key, rel in SINGLE.items():
    shutil.copyfile(SRC / rel, DST / f"{key}.png")
ts = ["// Сгенерировано tools/vfx_copy.py, руками не править.",
      "export const VFX: Record<string, { w: number; h: number; n: number; fps: number; loop: boolean }> = {", *rows, "};",
      f"export const VFX_IMAGES = {json.dumps(list(SINGLE))};", ""]
(ROOT / "client/src/vfx-data.ts").write_text("\n".join(ts))
print(len(PICK), len(SINGLE))
