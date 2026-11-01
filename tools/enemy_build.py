"""Сборка спрайтов врагов и боссов: кадры PixelLab -> полосы 128x128 (ступни y=112), данные ENEMY_ANIMS.
python3 tools/enemy_build.py
Вход: assets/pixellab/enemies/<вид>/<анимация>/east/<i>.png (tools/char_fetch.py).
Выход: assets/sprites/enemies/<вид>/<клип>-east.png, копия в client/public/sprites/enemies/, shared/src/enemy-anims-data.ts.
Атака (pixminimax 16 кадров стойка -> стойка) режется на windup / strike / recover по таблице CUT."""
import json, shutil, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from sprites import load, anchor, place, CELL

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "assets" / "pixellab" / "enemies"
OUT = ROOT / "assets" / "sprites" / "enemies"
PUB = ROOT / "client" / "public" / "sprites" / "enemies"
TS = ROOT / "shared" / "src" / "enemy-anims-data.ts"

# вид -> роль (темп атаки подгоняется под тайминги роли из enemy-data.ts)
ROLE = {"shaman": "boss", "pizdulina": "boss", "omon": "grunt", "omon_shield": "tank", "vatnik": "grunt", "zek": "fast", "clerk": "tank", "info_m": "fast", "info_f": "grunt"}
# атака: кадры замаха, удара, восстановления (номера в исходных 17 кадрах); fast бьёт рывком (клип dash)
CUT = {
    "omon":        ([0, 2, 4, 5, 6, 7, 8], [9, 10, 11], [12, 13, 14, 15, 16]),
    "omon_shield": ([0, 2, 3, 4, 5, 6, 8], [9, 11], [12, 13, 14, 15, 16]),
    "vatnik":      ([0, 2, 3, 4, 5, 6, 8], [9, 10, 11], [12, 13, 14, 15, 16]),
    "zek":         ([0, 2, 3, 4, 5, 7], [8, 9, 10, 11], [12, 13, 14, 15, 16]),
    "clerk":       ([0, 1, 2, 3, 4, 6, 8], [9, 10, 11, 12], [13, 14, 15, 16]),
    "info_m":      ([0, 2, 3, 4, 5, 7], [8, 9, 10, 11, 12], [13, 14, 15, 16]),
    "info_f":      ([0, 2, 3, 4, 5, 6, 8], [9, 10, 11], [12, 13, 14, 15, 16]),
    "shaman":      ([0, 2, 4, 5, 6, 7, 8], [9, 10, 11], [12, 13, 14, 15, 16]),
    "pizdulina":   ([0, 2, 3, 4, 5, 6, 7], [8, 9, 10], [11, 12, 13, 14, 15, 16]),
}
# особые атаки боссов (pixminimax cast): cast = замах до кульминации (держится весь windup), release = выпуск и возврат
CAST = {"shaman": ([0, 2, 3, 4, 5, 6, 7, 8], [9, 10, 11, 12, 13, 14, 15, 16]),
        "pizdulina": ([0, 2, 3, 4, 5, 6, 7], [8, 9, 10, 11, 12, 13, 14, 15, 16])}
# замах, удар, восстановление по ролям, мс (как в shared/src/enemy-data.ts)
TIMING = {"grunt": (450, 100, 350), "tank": (750, 120, 550), "fast": (550, 340, 450), "boss": (600, 120, 480)}
BASE = {"idle": (8, True), "walk": (10, True), "hurt": (14, False), "fall": (12, False), "getup": (10, False)}


def fps_for(frames, ms, lo=6, hi=24):
    return max(lo, min(hi, round(frames * 1000 / ms)))


def save(kind, clip, cells, ax, ay, data, fps, loop):
    od = OUT / kind
    od.mkdir(parents=True, exist_ok=True)
    place(cells, ax, ay).save(od / f"{clip}-east.png")
    data.setdefault(kind, {})[clip] = {"frames": len(cells), "fps": fps, "loop": loop}


def build():
    data = {}
    for kdir in sorted(p for p in RAW.iterdir() if p.is_dir() and (p / "idle").exists()):
        kind = kdir.name
        for clip, (fps, loop) in BASE.items():
            d = kdir / clip / "east"
            if d.exists():
                cells = load(d)
                save(kind, clip, cells, *anchor(cells), data, fps, loop)
        if kind in CUT and (kdir / "attack" / "east").exists():
            cells = load(kdir / "attack" / "east")
            ax, ay = anchor([cells[0]])  # опора по стойке, а не по самому высокому кадру с поднятой рукой
            wu, st, rc = CUT[kind]
            tw, ta, tr = TIMING[ROLE[kind]]
            strike = "dash" if ROLE[kind] == "fast" else "strike"
            save(kind, "windup", [cells[i] for i in wu], ax, ay, data, fps_for(len(wu), tw), False)
            save(kind, strike, [cells[i] for i in st], ax, ay, data, fps_for(len(st), max(ta, 160)), False)
            save(kind, "recover", [cells[i] for i in rc], ax, ay, data, fps_for(len(rc), tr), False)
        if kind in CAST and (kdir / "cast" / "east").exists():
            cells = load(kdir / "cast" / "east")
            ax, ay = anchor([cells[0]])
            wu, rl = CAST[kind]
            save(kind, "cast", [cells[i] for i in wu], ax, ay, data, fps_for(len(wu), 800), False)
            save(kind, "release", [cells[i] for i in rl], ax, ay, data, 12, False)
    if PUB.exists():
        shutil.rmtree(PUB)
    shutil.copytree(OUT, PUB)
    body = json.dumps(data, indent=2, ensure_ascii=False)
    TS.write_text("// Генерирует tools/enemy_build.py (Claude). Руками не править.\n"
                  "export interface EnemyClip { frames: number; fps: number; loop: boolean; hit?: number }\n"
                  f"export const ENEMY_ANIMS: Partial<Record<string, Record<string, EnemyClip>>> = {body};\n")
    print({k: list(v) for k, v in data.items()})


if __name__ == "__main__":
    build()
