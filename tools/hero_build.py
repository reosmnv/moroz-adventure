"""Сборка полос для героев 2-4 (одна форма, генерируется только east, west зеркалом).
python3 tools/hero_build.py nadya  -> assets/sprites/nadya/<анимация>-<east|west>.png, anims.json, gif/
Кадры: assets/pixellab/<герой>/<анимация>/east/<i>.png (tools/char_fetch.py)."""
import json, sys
from pathlib import Path
from PIL import Image, ImageOps
sys.path.insert(0, str(Path(__file__).parent))
from sprites import CELL, FEET_Y, LOOP_TRIM, anchor, load, place

ROOT = Path(__file__).resolve().parent.parent
HEROES = {
    "nadya": {
        # анимация -> части по порядку (каждая следующая без первого кадра: он = последний кадр прошлой)
        "seq": {"a1": ["a1-in", "a1-out"], "a2": ["a2-in", "a2-out"], "a3": ["a3-in", "a3-out"],
                "b1": ["b1-in", "b1-out"], "b2": ["b2-in", "b2-out"],
                "ult": ["ult-in", "ult-out"]},
        # кадр попадания в собранной полосе; по умолчанию последний кадр первой части (ключевая поза)
        # номера кадров до чистки DROP (проверено глазами 29.10)
        "hit": {"a1": 4, "a2": 7, "a3": 8, "b1": 4, "b2": 4, "ult": 6},
        # мусорные кадры: a2 бурый смаз, b1 Т-поза и красная полоса на груди, b2 длинные волосы, b3 белая «коса» и хвост
        "drop": {"a2": [6], "b1": [2, 6, 7], "b2": [3, 6, 7]},
        # PixelLab сдвигает фигуру внутри холста, и Надя «скакала» по карте в серии с сумкой (mr.R 30.10):
        # эти полосы выравниваются покадрово по ногам
        "stab": ["a1", "a2", "a3"],
        "fps": {"idle": (10, True), "walk": (10, True), "dash": (14, True), "hurt": (14, False),
                "fall": (12, False), "getup": (10, False), "static": (1, True)},
        "strike_fps": 16,
    },
    "kris": {
        # cam-*: переходы от стойки с камерой наготове (mr.R 30.10); a3 убран из серии, старые a*-in/out не собираются
        "seq": {"a1": ["cam-a1-in", "cam-a1-out"], "a2": ["cam-a2-in", "cam-a2-out"],
                "b": ["cam-b-in", "cam-b-out"], "ball": ["cam-ball-in", "cam-ball-out"],
                # новая серия A (mr.R 30.10): обратный взмах и отскок назад
                "a1-back": ["kris-a1back-in", "kris-a1back-out"], "hop": ["kris-hop-in", "kris-hop-out"]},
        "hit": {},
        # a2: штатив стал «ромбом» на возврате; ball: синяя дуга на возврате (проверено глазами 30.10)
        "drop": {"a2": [7, 8], "ball": [6], "a1-back": [2, 3, 4]},  # a1-back: разворот к зрителю (30.10)
        # ходьба и бег с камерой в руках (pixminimax от стойки с камерой, mr.R 30.10) вместо skeleton-v3 с кулаками
        "alias": {"walk": None, "dash": None, "walk-cam8": "walk", "dash-cam8": "dash", "walk-cam16": None, "dash-cam16": None},
        "fps": {"idle": (10, True), "walk": (10, True), "dash": (14, True), "hurt": (14, False),
                "fall": (12, False), "getup": (10, False), "static": (1, True)},
        "strike_fps": 16,
    },
}


def frames_of(strip):
    return [strip.crop((i * CELL, 0, (i + 1) * CELL, CELL)) for i in range(strip.width // CELL)]


def build(hero):
    cfg = HEROES[hero]
    raw, od = ROOT / "assets" / "pixellab" / hero, ROOT / "assets" / "sprites" / hero
    od.mkdir(parents=True, exist_ok=True); (od / "gif").mkdir(exist_ok=True)
    parts = {p for seq in cfg["seq"].values() for p in seq} | {"b3-draw", "b3-slash", "b3-out", "ult-setup", "ult-rise", "ult-out"} \
        | {f"{a}-{k}" for a in ("a1", "a2", "a3", "b", "ball") for k in ("in", "out")}
    out = {}
    # опорная точка всех ударов: первый кадр стойки
    idle0 = load(raw / "idle" / "east")[0]
    ax, ay = anchor([idle0])
    alias = {"idle": None, "idle-live": None, "idle-live16": "idle", **cfg.get("alias", {})}  # живая стойка вместо старой (mr.R 30.10)
    for adir in sorted(p for p in raw.iterdir() if p.is_dir()):
        name = alias.get(adir.name, adir.name)
        if name is None or adir.name in parts or adir.name.startswith("cam-") or adir.name == "keyposes" or not (adir / "east").exists():
            continue
        cells = load(adir / "east")
        if adir.name in LOOP_TRIM: cells = cells[:-1]
        out[name] = (frames_of(place(cells, *anchor(cells))), None)
    for name, seq in cfg["seq"].items():
        if not all((raw / p / "east").exists() for p in seq):
            print("нет частей:", name); continue
        fr, hit = [], None
        for k, p in enumerate(seq):
            cells = load(raw / p / "east")
            if k: cells = cells[1:]
            # выравнивание: части, начинающиеся со стойки, по первому кадру; заканчивающиеся стойкой по последнему
            ref = cells[0] if k == 0 else cells[-1]
            ra = anchor([ref]) if (k == 0 or p.endswith("-out")) else None
            if ra is None:  # средняя часть: тот же сдвиг, что у первой части
                ra = anchor([load(raw / seq[0] / "east")[0]])
            fr += frames_of(place(cells, *ra))
            if k == 0: hit = len(fr) - 1
        h = cfg["hit"].get(name)
        drop = cfg["drop"].get(name, [])
        hit = (h if h is not None else hit) - sum(1 for i in drop if i < (h if h is not None else hit))
        out[name] = ([f for i, f in enumerate(fr) if i not in drop], hit)
    if hero == "nadya":
        out.update(nadya_samurai(raw, ax, ay, out))
    if cfg.get("stab") and "idle" in out:
        target = feet(out["idle"][0][0])
        for name in cfg["stab"]:
            if name in out:
                fr, hit = out[name]
                out[name] = ([stabilize(f, target) for f in fr], hit)
    if hero == "kris" and all((raw / p / "east").exists() for p in ("cam-ult-setup", "ult-rise", "cam-ult-out")):
        out.update(kris_ult(raw, ax, ay))
    manifest = {}
    for name, (fr, hit) in out.items():
        for d in ("east", "west"):
            cells = fr if d == "east" else [ImageOps.mirror(f) for f in fr]
            strip = Image.new("RGBA", (CELL * len(cells), CELL))
            for i, f in enumerate(cells): strip.paste(f, (i * CELL, 0))
            strip.save(od / f"{name}-{d}.png")
        fps, loop = cfg["fps"].get(name, (cfg["strike_fps"], False))
        m = {"east": len(fr), "west": len(fr), "fps": fps, "loop": loop}
        if hit is not None: m["hit"] = {"east": hit, "west": hit}
        manifest[name] = m
        bg = [Image.alpha_composite(Image.new("RGBA", (CELL, CELL), (200, 200, 205, 255)), f).resize((CELL * 3, CELL * 3), Image.NEAREST) for f in fr]
        bg[0].save(od / "gif" / f"{name}.gif", save_all=True, append_images=bg[1:], duration=int(1000 / fps), loop=0)
    (od / "anims.json").write_text(json.dumps({"cell": CELL, "feetY": FEET_Y, "states": {hero: manifest}}, indent=1, ensure_ascii=False))
    print(json.dumps(manifest, ensure_ascii=False))


def feet(cell, cx=CELL // 2, win=22):
    """Ноги в ячейке: x = медиана пикселей в нижних 22 px силуэта около центра, y = низ.
    Сумка и цепь сбоку в окно почти не попадают; второй проход центрируется на найденных ногах."""
    a = cell.getchannel("A").load()
    for _ in range(2):
        cols = range(max(0, cx - win), min(CELL, cx + win))
        fy = max(y for x in cols for y in range(CELL) if a[x, y] > 0)
        xs = sorted(x for x in cols for y in range(fy - 22, fy + 1) if a[x, y] > 0)
        cx = xs[len(xs) // 2]
    return cx, fy


def stabilize(cell, target):
    x, y = feet(cell)
    g = Image.new("RGBA", cell.size)
    g.paste(cell, (target[0] - x, target[1] - y), cell)
    return g


def tint(im, rgb, alpha):
    """Полупрозрачная одноцветная копия силуэта (шлейф рывка)."""
    a = im.getchannel("A").point(lambda v: int(v * alpha))
    g = Image.new("RGBA", im.size, rgb + (0,)); g.putalpha(a)
    return g


def nadya_samurai(raw, ax, ay, out):
    """Самурай по частям для кода: b3-draw (достаёт меч и замирает с бликом), b3-dash (рывок со шлейфом),
    b3-end (финальная поза, удар засчитывается с задержкой, затем убирает меч). b3 = всё подряд для просмотра."""
    K = raw / "keyposes"
    pose = lambda n: Image.open(K / f"{n}-pose-east-96.png").convert("RGBA")
    # v3 кладёт исходный кадр 96 px в середину холста пошире (104-136): возвращаем кадры в координаты исходника
    def to96(im):
        g = Image.new("RGBA", im.size)
        g.paste(im, (-((im.width - 96) // 2), -(im.height - 96)), im)
        return g
    cell = lambda im: frames_of(place([to96(im)], ax, ay))[0]
    draw = load(raw / "b3-draw" / "east")
    draw = [d for i, d in enumerate(draw) if i not in (1, 2)]  # белая «коса» и хвост
    hold_src = pose("b3a")
    glint = Image.open(ROOT / "assets" / "vfx" / "nadya" / "glint" / "part-item_glint.png").convert("RGBA")
    gf = [glint.crop(((i % 4) * 27, (i // 4) * 28, (i % 4 + 1) * 27, (i // 4 + 1) * 28)) for i in range(16)]
    hold = []
    for gi in (None, 2, 3, 4, 5, None):  # блик бежит по клинку у рукояти
        im = hold_src.copy()
        if gi is not None:
            im.alpha_composite(gf[gi], (80 - 13, 47 - 14))
        hold.append(im)
    d_draw = [cell(x) for x in draw + hold]
    dash = pose("b3dash")
    d_dash = []
    for off in ((10, 20), (14, 28), (18, 36)):
        im = Image.new("RGBA", (96 + 40, 96), (0, 0, 0, 0))
        im.alpha_composite(tint(dash, (255, 95, 162), 0.25), (40 - off[1], 0))
        im.alpha_composite(tint(dash, (255, 209, 230), 0.45), (40 - off[0], 0))
        im.alpha_composite(dash, (40, 0))
        d_dash.append(frames_of(place([im], ax + 40, ay))[0])
    end = pose("b3b")
    outp = load(raw / "b3-out" / "east")[1:]
    d_end = [cell(end)] * 3 + [cell(x) for x in outp]
    return {"b3-draw": (d_draw, len(d_draw) - 1), "b3-dash": (d_dash, None), "b3-end": (d_end, 1),
            "b3": (d_draw + d_dash + d_end, len(d_draw) + len(d_dash) + 1)}


KRIS_LENS = (84, 33)  # объектив камеры в позе ult2 (холст 96), отсюда идут прицел и луч


def kris_ult(raw, ax, ay):
    """Ульта Kris для кода: ult-setup (ставит камеру, встаёт за неё; последний кадр = начало прицела),
    ult-hold (2 кадра стоит за камерой: прицел 1 с и луч 0,7 с рисует код от KRIS_LENS), ult-out.
    ult = всё подряд с прицелом и лучом, только для просмотра."""
    # v3 кладёт исходный кадр 96 px в середину холста пошире (104-136): возвращаем кадры в координаты исходника
    def to96(im):
        g = Image.new("RGBA", im.size)
        g.paste(im, (-((im.width - 96) // 2), -(im.height - 96)), im)
        return g
    cell = lambda im: frames_of(place([to96(im)], ax, ay))[0]
    # от стойки с камерой наготове (cam-*, 30.10); подъём за камеру прежний
    setup = [f for i, f in enumerate(load(raw / "cam-ult-setup" / "east")) if i != 1] + load(raw / "ult-rise" / "east")[1:]  # 1: штатив висит в воздухе
    hold_im = Image.open(raw / "keyposes" / "ult2-pose-east-96.png").convert("RGBA")
    outp = [f for i, f in enumerate(load(raw / "cam-ult-out" / "east")[1:]) if i not in (2, 3)]  # разворот к зрителю
    d_setup, d_hold, d_out = [cell(x) for x in setup], [cell(hold_im)] * 2, [cell(x) for x in outp]
    # просмотр: прицел (красная линия) и луч поверх позы; луч уходит за край ячейки
    lx, ly = CELL // 2 - ax + KRIS_LENS[0], FEET_Y - ay + KRIS_LENS[1]
    V = ROOT / "assets" / "vfx" / "kris"
    aim, prev = Image.open(V / "aim-mid.png").convert("RGBA"), []
    for i in range(6):
        f = d_hold[0].copy()
        if i % 2 == 0:
            for x in range(lx, CELL, 16): f.alpha_composite(aim, (x, ly - 1))
        prev.append(f)
    for i in range(6):
        f = d_hold[0].copy()
        beam = Image.new("RGBA", (CELL, CELL))
        start = Image.open(V / f"beam-start-{i % 3}.png").convert("RGBA")
        hh = start.height
        beam.alpha_composite(start, (lx, ly - hh // 2))
        for x in range(lx + start.width, CELL, 16):
            beam.alpha_composite(Image.open(V / f"beam-mid-{i % 3}.png").convert("RGBA"), (x, ly - hh // 2))
        f.alpha_composite(beam)
        prev.append(f)
    return {"ult-setup": (d_setup, len(d_setup) - 1), "ult-hold": (d_hold, None), "ult-out": (d_out, None),
            "ult": (d_setup + prev + d_out, len(d_setup) + 6)}


if __name__ == "__main__":
    build(sys.argv[1])
