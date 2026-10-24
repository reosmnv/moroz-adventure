"""Скачивает кадры персонажей PixelLab и собирает выровненные полосы анимаций.

python3 tools/sprites.py fetch   # кадры в assets/pixellab/<state>/<anim>/<dir>/<i>.png
python3 tools/sprites.py build   # полосы в assets/sprites/<state>/<anim>-<dir>.png + anims.json
"""
import json, re, sys, urllib.request
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "assets" / "pixellab"
OUT = ROOT / "assets" / "sprites"
STATES = {
    "prime": "8f079407-9eb2-48f9-9b07-695c53169e9f",
    "ultimate": "fda7726a-5a4b-45df-b0e9-5e5adadc9540",
}
CELL = 128          # итоговая ячейка, общая для всех анимаций
FEET_Y = 112        # линия ступней в ячейке
DIRS = ("east", "west")
# имя группы в PixelLab -> имя в игре; None = не собирать (отбракованный вариант)
ALIAS = {"pilot-idle-skel": "idle", "running": "dash", "full-sprint": "dash",
         "hurricane-pmm": "hurricane", "hurricane": None, "uppercut": None, "uppercut-pmm": None}
# скорость (кадров/с) и зацикливание для игры; удары быстрые, стойка и ходьба петлёй
FPS = {"hurricane": (16, False), "idle": (8, True), "walk": (10, True), "dash": (14, True), "hurt": (14, False), "fall": (12, False),
       "getup": (10, False), "transform-up": (12, False), "transform-down": (12, False), "static": (1, True)}
STRIKE_FPS = 18
# кадр попадания для цельных (не in/out) атак
HIT = {("ultimate", "roundhouse"): 3, ("prime", "highkick"): 3, ("ultimate", "hurricane"): 4}
# несколько попаданий за удар (вихрь бьёт трижды), пишется в anims.json как hits
HITS = {("ultimate", "hurricane"): [4, 8, 12]}
# ручная чистка: (форма, анимация, направление) -> номера кадров итоговой полосы, которые выбросить
DROP = {("prime", "cross", "east"): [2], ("prime", "cross", "west"): [2, 3],
        ("prime", "uppercut", "east"): [3, 4, 7, 8], ("prime", "uppercut", "west"): [1, 2, 7, 8],
        ("prime", "superman", "west"): [1, 2, 3],
        ("ultimate", "flying-knee", "east"): [4]}
# удар = выпад (<name>-in: стойка -> ключевая поза) + возврат (<name>-out: ключевая поза -> стойка);
# общий ключевой кадр берётся один раз, его номер пишется в anims.json как hit


def mcp(tool, args):
    """Вызов инструмента PixelLab MCP по JSON-RPC (токен из ~/.claude.json, в репозиторий не пишется)."""
    cfg = json.loads((Path.home() / ".claude.json").read_text())
    auth = cfg["projects"][str(ROOT)]["mcpServers"]["pixellab"]["headers"]["Authorization"]
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": "tools/call",
                       "params": {"name": tool, "arguments": args}}).encode()
    req = urllib.request.Request("https://api.pixellab.ai/mcp", body, {
        "Authorization": auth, "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream"})
    raw = urllib.request.urlopen(req, timeout=120).read().decode()
    if not raw.lstrip().startswith("{"):
        raw = next(l[5:] for l in raw.splitlines() if l.startswith("data:"))
    return json.loads(raw)["result"]["content"][0]["text"]


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "curl/8.5.0"})
    return urllib.request.urlopen(req, timeout=120).read()


def slug(name):
    return "".join(c if c.isalnum() else "-" for c in name.lower()).strip("-")


def fetch():
    for state, cid in STATES.items():
        text = mcp("get_character", {"character_id": cid, "include_preview": False})
        d = RAW / state
        anim, section = None, None
        for line in text.splitlines():
            if line.startswith("rotations:"):
                section = "rot"
                continue
            if line.startswith("animations"):
                section = "anim"
                continue
            if section == "anim":
                m = re.match(r"^  (\S.*?) — ", line)
                if m:
                    anim = slug(m.group(1))
                    continue
            m = re.match(r"^\s+(east|west): (https://\S+)(?: \(i=0\.\.(\d+)\))?", line)
            if not m:
                continue
            direction, url, last = m.groups()
            if section == "rot":
                out = d / "static" / direction / "0.png"
                out.parent.mkdir(parents=True, exist_ok=True)
                out.write_bytes(get(url))
            elif section == "anim" and anim and last:
                od = d / anim / direction
                n = int(last) + 1
                if od.exists() and len(list(od.glob("*.png"))) == n:
                    continue
                od.mkdir(parents=True, exist_ok=True)
                for i in range(n):
                    (od / f"{i}.png").write_bytes(get(url.replace("{i}", str(i))))
        print(state, "ok")


def feet(img):
    bbox = img.getchannel("A").getbbox()
    return bbox[3] if bbox else img.height


def anchor(cells):
    """Опорная точка анимации: самый высокий кадр (стоячая поза), низ ступней и
    медиана x непрозрачных пикселей в полосе бёдер (45-75% роста): волосы и руки не сдвигают центр."""
    def height(c):
        b = c.getchannel("A").getbbox()
        return b[3] - b[1] if b else 0
    ref = max(cells, key=height)
    l, t, r, b = ref.getchannel("A").getbbox()
    a = ref.getchannel("A").load()
    y0, y1 = t + int((b - t) * 0.45), t + int((b - t) * 0.75)
    xs = sorted(x for y in range(y0, y1) for x in range(l, r) if a[x, y] > 0)
    return xs[len(xs) // 2], b


def despeckle(img, max_area=12):
    """Убирает оторванные крошки до max_area пикселей вне рамки основного силуэта (частицы, мусор генерации)."""
    a = img.getchannel("A").load()
    w, h = img.size
    seen, comps = set(), []
    for y in range(h):
        for x in range(w):
            if a[x, y] == 0 or (x, y) in seen:
                continue
            comp, stack = [], [(x, y)]
            seen.add((x, y))
            while stack:
                cx, cy = stack.pop()
                comp.append((cx, cy))
                for nx in range(cx - 1, cx + 2):
                    for ny in range(cy - 1, cy + 2):
                        if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in seen and a[nx, ny] > 0:
                            seen.add((nx, ny))
                            stack.append((nx, ny))
            comps.append(comp)
    if len(comps) < 2:
        return img
    main = max(comps, key=len)
    l = min(x for x, _ in main); r = max(x for x, _ in main)
    t = min(y for _, y in main); b = max(y for _, y in main)
    px = img.load()
    for comp in comps:
        if len(comp) <= max_area and not any(l <= x <= r and t <= y <= b for x, y in comp):
            for x, y in comp:
                px[x, y] = (0, 0, 0, 0)
    return img


def load(ddir):
    files = sorted(ddir.glob("*.png"), key=lambda p: int(p.stem))
    return [despeckle(Image.open(f).convert("RGBA")) for f in files]


def place(cells, ax, ay):
    strip = Image.new("RGBA", (CELL * len(cells), CELL))
    for i, c in enumerate(cells):
        strip.paste(c, (i * CELL + CELL // 2 - ax, FEET_Y - ay), c)
    return strip


def build_strikes(state, od, manifest):
    for inn in sorted((RAW / state).glob("*-in")):
        name = inn.name[:-3]
        out = RAW / state / f"{name}-out"
        for ddir in sorted(p for p in inn.iterdir() if p.is_dir()):
            if not (out / ddir.name).exists():
                continue
            a, b = load(ddir), load(out / ddir.name)
            # выпад выравнивается по своему первому кадру (стойка), возврат по последнему (та же стойка)
            sa, sb = place(a, *anchor([a[0]])), place(b[1:], *anchor([b[-1]]))
            frames = [sa.crop((i * CELL, 0, (i + 1) * CELL, CELL)) for i in range(len(a))] + \
                     [sb.crop((i * CELL, 0, (i + 1) * CELL, CELL)) for i in range(len(b) - 1)]
            hit = len(a) - 1
            drop = DROP.get((state, name, ddir.name), [])
            hit -= sum(1 for i in drop if i < hit)
            frames = [f for i, f in enumerate(frames) if i not in drop]
            strip = Image.new("RGBA", (CELL * len(frames), CELL))
            for i, f in enumerate(frames):
                strip.paste(f, (i * CELL, 0))
            strip.save(od / f"{name}-{ddir.name}.png")
            manifest[state].setdefault(name, {})[ddir.name] = len(frames)
            manifest[state][name].setdefault("hit", {})[ddir.name] = hit


def build_pre(state, od, manifest):
    """<name>-pre: переход стойка -> первый кадр готовой анимации, приклеивается перед ней."""
    for pre in sorted((RAW / state).glob("*-pre")):
        name = pre.name[:-4]
        for ddir in sorted(p for p in pre.iterdir() if p.is_dir()):
            target = od / f"{name}-{ddir.name}.png"
            if not target.exists():
                continue
            a = load(ddir)[:-1]  # последний кадр перехода = первый кадр анимации
            sa = place(a, *anchor([a[0]]))
            main = Image.open(target)
            strip = Image.new("RGBA", (sa.width + main.width, CELL))
            strip.paste(sa, (0, 0))
            strip.paste(main, (sa.width, 0))
            strip.save(target)
            manifest[state][name][ddir.name] += len(a)
            if "pre" not in manifest[state][name]:
                manifest[state][name]["pre"] = {}
            manifest[state][name]["pre"][ddir.name] = len(a)


def build():
    """Общая ячейка CELL, опорная точка (anchor) каждой анимации в (CELL/2, FEET_Y)."""
    manifest = {}
    for state in STATES:
        od = OUT / state
        od.mkdir(parents=True, exist_ok=True)
        manifest[state] = {}
        for adir in sorted(p for p in (RAW / state).iterdir() if p.is_dir()):
            name = ALIAS.get(adir.name, adir.name)
            if name is None or adir.name.endswith(("-in", "-out", "-pre")) or adir.name == "keyposes":
                continue
            for ddir in sorted(p for p in adir.iterdir() if p.is_dir()):
                cells = load(ddir)
                place(cells, *anchor(cells)).save(od / f"{name}-{ddir.name}.png")
                manifest[state].setdefault(name, {})[ddir.name] = len(cells)
        build_strikes(state, od, manifest)
        build_pre(state, od, manifest)
    for (st, name), hit in HIT.items():
        if name in manifest.get(st, {}):
            pre = manifest[st][name].get("pre", {})
            manifest[st][name]["hit"] = {d: hit + pre.get(d, 0) for d in DIRS}
    for (st, name), hits in HITS.items():
        if name in manifest.get(st, {}):
            manifest[st][name]["hits"] = hits
    for anims in manifest.values():
        for name, a in anims.items():
            a["fps"], a["loop"] = FPS.get(name, (STRIKE_FPS, False))
    (OUT / "anims.json").write_text(json.dumps({"cell": CELL, "feetY": FEET_Y, "states": manifest}, indent=1, ensure_ascii=False))
    print(json.dumps(manifest, ensure_ascii=False))


if __name__ == "__main__":
    {"fetch": fetch, "build": build}[sys.argv[1]]()
