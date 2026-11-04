"""Катя (V3, PixelLab 04.11): кадры -> полосы 128x128, данные KATYA_ANIMS.
python3 tools/char_fetch.py 9283a76c-e26b-4bcc-a7ff-88a5d289bf65 assets/pixellab/enemies/katya && python3 tools/katya_build.py
Отдельно от enemy_build.py, чтобы не пересобирать остальных врагов."""
import json, shutil, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from sprites import load, anchor, place

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "assets/pixellab/enemies/katya"
OUT = ROOT / "assets/sprites/enemies/katya-pl"
PUB = ROOT / "client/public/sprites/enemies/katya-pl"
TS = ROOT / "shared/src/katya-anims-data.ts"
BASE = {"idle": (8, True), "walk": (10, True), "hurt": (14, False), "fall": (12, False)}
# attack 17 кадров: замах (кулак назад), удар, возврат; cast: кулаки вверх, удар в пол и подъём
ATTACK = {"windup": ([0, 2, 4, 5, 6, 7, 8], 11), "strike": ([9, 10, 11], 18), "recover": ([12, 13, 14, 15, 16], 12)}
CAST = {"cast": ([0, 2, 3, 4, 5, 6, 7], 9), "release": ([8, 9, 10, 11, 12, 13, 14, 15, 16], 12)}

def build():
    OUT.mkdir(parents=True, exist_ok=True)
    data = {}
    def save(clip, cells, ax, ay, fps, loop):
        place(cells, ax, ay).save(OUT / f"{clip}-east.png")
        data[clip] = {"frames": len(cells), "fps": fps, "loop": loop}
    for clip, (fps, loop) in BASE.items():
        cells = load(RAW / clip / "east")
        save(clip, cells, *anchor(cells), fps, loop)
    for src, table in (("attack", ATTACK), ("cast", CAST)):
        cells = load(RAW / src / "east")
        ax, ay = anchor([cells[0]])
        for clip, (idx, fps) in table.items():
            save(clip, [cells[i] for i in idx], ax, ay, fps, False)
    if PUB.exists(): shutil.rmtree(PUB)
    shutil.copytree(OUT, PUB)
    TS.write_text("// Генерирует tools/katya_build.py. Руками не править.\n"
                  "import type { EnemyClip } from './enemy-anims-data.ts';\n"
                  f"export const KATYA_ANIMS: Record<string, EnemyClip> = {json.dumps(data, indent=2)};\n")
    print(data)

if __name__ == "__main__":
    build()
