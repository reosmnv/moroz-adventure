"""Сборка фонов маршрута (ТЗ-04) из сырых экранов PixelLab: assets/level-route/raw/<имя>/0.png.

python3 tools/route_build.py                 -> все стадии: client/public/route/*.png, server/src/floor-data.ts
python3 tools/route_build.py prep <stage> <r> -> окна inpaint раунда r: assets/level-route/win/<имя>/, tools/specs/route-<stage>-r<r>.json
   затем: PYTHONPATH=tools python3 tools/queue.py <spec> && python3 tools/loc_fetch.py <spec>

Идея: PixelLab кладёт линию стена/пол на ~70% высоты, а для боя нужна полоса глубиной 105 мира (70 src).
Поэтому у каждого экрана берём «стену» так, чтобы её низ лёг на y=WALL (55%): срезаем верх (dy) или вырезаем
однородную полосу по высоте (колонны, двери). Пол улицы и двора рисуем заново единым асфальтом; недостающий низ
пола в метро и швы между экранами закрывает inpaint (окна 256x180, Tier 1). Маска пола = всё ниже низа стены."""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).parent.parent
RAW = ROOT / "assets/level-route/raw"
WIN = ROOT / "assets/level-route/win"
BUILD = ROOT / "assets/level-route/build"
OUT = ROOT / "client/public/route"
W, H, WALL = 320, 180, 100  # экран src, низ стены src (y мира 150)
SCALE = 1.5


def load(name):
    return Image.open(RAW / name / "0.png").convert("RGBA")


def cut(name, dy, remove=None, x0=0, x1=W):
    """Стена экрана: без строк remove=(a,b), со сдвигом dy вверх; низ (H-...) пустой."""
    a = np.array(load(name))[:, x0:x1]
    if remove:
        a = np.concatenate([a[:remove[0]], a[remove[1]:]], axis=0)
    a = a[dy:]
    out = np.zeros((H, x1 - x0, 4), np.uint8)
    out[:a.shape[0]] = a[:H]
    return out


def asphalt(width, height, src="rt_a_podezd", rows=(137, 180)):
    """Асфальт из чистого куска экрана, плитками с зеркалом (стыки без шва)."""
    tile = np.array(load(src).crop((0, rows[0], W, rows[1])))
    th = tile.shape[0]
    col = []
    for j in range((height + th - 1) // th):
        t = tile if j % 2 == 0 else tile[::-1]
        row = [t if i % 2 == 0 else t[:, ::-1] for i in range((width + W - 1) // W)]
        col.append(np.concatenate(row, axis=1))
    return np.concatenate(col, axis=0)[:height, :width]


def shade(a, y0, rows, k):
    """Тень у основания стены: несколько строк темнее, к низу слабее."""
    for i in range(rows):
        f = 1 - k * (1 - i / rows)
        a[y0 + i, :, :3] = (a[y0 + i, :, :3] * f).astype(np.uint8)


def outdoor(parts):
    """Стены (массивы H x w) подряд, ниже WALL единый асфальт с тенью у стены."""
    width = sum(p.shape[1] for p in parts)
    a = np.zeros((H, width, 4), np.uint8)
    floor = asphalt(width, H - WALL)
    shade(floor, 0, 4, 0.25)
    a[WALL:] = floor
    x = 0
    for p in parts:
        a[:WALL, x:x + p.shape[1]] = p[:WALL]
        x += p.shape[1]
    return Image.fromarray(a)


def indoor(parts):
    """Экраны целиком подряд (низ пола у каждого пустой: дорисует inpaint), пустоту временно залить зеркалом пола."""
    a = np.concatenate(parts, axis=1)
    for x in range(a.shape[1]):
        col = a[:, x]
        empty = np.where(col[:, 3] == 0)[0]
        if len(empty):
            e0 = empty[0]
            n = H - e0
            col[e0:] = col[e0 - n:e0][::-1]
    return Image.fromarray(a)


# ---------- стадии: база (до окон) ----------

def base_street():
    screens = [("rt_s_start_v1", 34), ("rt_a_podezd", 34), ("rt_c_column", 36), ("rt_d_passage", 20)]
    img = outdoor([cut(n, dy) for n, dy in screens])
    return img, [WALL] * img.width


def zone_decal(img):
    """Красно-белая зона со старта (rt_s_start_v1): только красные и белые пиксели с контуром, на асфальт."""
    s = np.array(load("rt_s_start_v1"))
    zone = s[135:171, 130:310].copy()
    r, g, b = (zone[..., i].astype(int) for i in range(3))
    m = ((r > 150) & (g < 110)) | ((r > 200) & (g > 200) & (b > 200))
    keep = m.copy()
    keep[1:] |= m[:-1]; keep[:-1] |= m[1:]; keep[:, 1:] |= m[:, :-1]; keep[:, :-1] |= m[:, 1:]
    zone[..., 3] = np.where(keep, 255, 0)
    img.alpha_composite(Image.fromarray(zone), (130, WALL + 6))


def base_yard():
    img = outdoor([cut("yard_a", 28, x0=50), cut("rt_e_metro", 30)])
    return img, [WALL] * img.width


def base_vestibule():
    img = indoor([cut("vest_a", 20), cut("vest_b", 13)])
    return img, [WALL] * img.width


def base_wagon_tile():
    img = indoor([cut("wagon_w1", 8, remove=(52, 72))])
    return img, [WALL] * img.width


def base_mayak():
    m = cut("mayak_w1", 9, remove=(88, 112))
    img = indoor([m, m.copy()])
    return img, [WALL] * img.width


def floor_color(name, rows):
    """Медианный цвет пола сырого экрана (строки rows)."""
    a = np.array(load(name))[rows[0]:rows[1], :, :3].reshape(-1, 3)
    return np.median(a, axis=0)


def slabs(width, height, base, seed=1, sw=40, glows=(), section=W):
    """Пол секциями по экрану (своя лёгкая перспектива в каждой), между секциями тёмная полоса-бордюр."""
    parts = [slabs1(min(section, width - x0), height, base, seed + i, sw, [(gx - x0, c) for gx, c in glows if x0 - 20 <= gx < x0 + section + 20])
             for i, x0 in enumerate(range(0, width, section))]
    out = np.concatenate(parts, axis=1)
    for x0 in range(section, width, section):
        out[:, x0 - 1:x0 + 1, :3] = (out[:, x0 - 1:x0 + 1, :3] * 0.7).astype(np.uint8)
    return out


def slabs1(width, height, base, seed=1, sw=40, glows=()):
    """Плитка без ИИ: сетка плит, поперечные швы реже к зрителю, продольные сходятся к центру (лёгкая перспектива).
    glows: (x, (r,g,b)) — мокрые отсветы неона под экранами, мягкие по краям."""
    rng = np.random.default_rng(seed)
    a = np.zeros((height, width, 3), np.float32) + base
    cx = width / 2
    ys, y, j = [], 0, 0
    while y < height:
        ys.append(y)
        y += 6 + 3 * j
        j += 1
    tone = rng.normal(0, 0.03, (len(ys) + 1, width // sw + 4))
    for yy in range(height):
        row = max(i for i, v in enumerate(ys) if v <= yy)
        k = 0.88 + 0.3 * yy / height  # швы расходятся к зрителю
        u = (np.arange(width) - cx) / k + cx  # координата «на плите»
        col = np.floor(u / sw).astype(int) + 2
        a[yy] *= (1 + tone[row, np.clip(col, 0, tone.shape[1] - 1)])[:, None]
        joint = np.abs((u % sw)) < (0.7 + 0.5 * yy / height)
        a[yy, joint] *= 0.78
    for v in ys:
        a[v] *= 0.74
        if v + 1 < height:
            a[v + 1] *= 1.06
    a += rng.normal(0, 2.0, a.shape)
    for gx, col in glows:
        for yy in range(min(height, 50)):
            for dx in range(-16, 17):
                x = gx + dx
                if 0 <= x < width:
                    k = 0.30 * (1 - yy / 50) * (1 - abs(dx) / 17)
                    a[yy, x] = a[yy, x] * (1 - k) + np.array(col) * k
    out = np.zeros((height, width, 4), np.uint8)
    out[..., :3] = np.clip(a, 0, 255)
    out[..., 3] = 255
    return out


def gloss(img, rows=22, k=0.18):
    """Глянец: под стеной слабое перевёрнутое отражение её низа."""
    a = np.array(img).astype(np.float32)
    ref = a[WALL - rows:WALL][::-1]
    for i in range(rows):
        f = k * (1 - i / rows)
        a[WALL + i, :, :3] = a[WALL + i, :, :3] * (1 - f) + ref[i, :, :3] * f
    return Image.fromarray(a.astype(np.uint8))


def walls_with_floor(parts, floor):
    """Стены (H x w, низ стены на WALL) подряд, ниже WALL готовый пол floor (H-WALL x ширина)."""
    width = sum(p.shape[1] for p in parts)
    a = np.zeros((H, width, 4), np.uint8)
    a[WALL:] = floor[:, :width]
    shade(a[WALL:], 0, 4, 0.3)
    x = 0
    for p in parts:
        a[:WALL, x:x + p.shape[1]] = p[:WALL]
        x += p.shape[1]
    return Image.fromarray(a)


def base_city():
    """Улица у Москва-Сити (день): c1, c2, зеркало c2, зеркало c1, вход в МФЦ. Шов c1|c2 повторяется зеркально на стыке зеркал."""
    c1, c2, ext = cut("cityd_1", 41), cut("cityd_2", 28), cut("mfc_ext", 30)
    parts = [c1, c2, c2[:, ::-1].copy(), c1[:, ::-1].copy(), ext]
    floor = slabs(W * len(parts), H - WALL, floor_color("cityd_2", (150, 178)), seed=7, sw=44)
    img = walls_with_floor(parts, floor)
    return img, [WALL] * img.width


MFC_DY = 18  # у всех экранов МФЦ один срез: фриз и потолок на одной высоте
MFC = [("mfc_in", 0), ("mfc_int", 0), ("mfc_wait", 0), ("mfc_arch", 0), ("mfc_int", 1),
       ("mfc_doors", 0), ("mfc_wait", 1), ("mfc_arch", 1), ("mfc_main", 0)]  # (экран, зеркало)


def base_mfc():
    """Главный МФЦ, 9 экранов: вход, окна 1-6, ожидание, архив, окна 7-12, кабинеты, ожидание, архив, главное окно.
    Стыки закрыты пилястрой из mfc_int (x 170-188): потолок и фриз у всех экранов совпадают по высоте."""
    parts = []
    for n, f in MFC:
        c = cut(n, MFC_DY)
        parts.append(c[:, ::-1].copy() if f else c)
    width = W * len(parts)
    floor = slabs(width, H - WALL, floor_color("mfc_int", (150, 178)), seed=5, sw=48)
    carpet(floor, W * 8 + 160)
    img = gloss(walls_with_floor(parts, floor))
    pil = Image.fromarray(cut("mfc_int", MFC_DY)[:WALL + 2, 170:188])
    for k in range(1, len(parts)):
        img.paste(pil, (W * k - 9, 0), pil)
    return img, [WALL] * img.width


def carpet(floor, cx):
    """Красная дорожка к главному окну: от стены вниз, расширяется к зрителю, кромки темнее."""
    h = floor.shape[0]
    for y in range(h):
        half = 18 + int(22 * y / h)
        x0, x1 = cx - half, cx + half
        floor[y, x0:x1, :3] = (178, 52, 52)
        floor[y, x0:x0 + 2, :3] = (120, 30, 34)
        floor[y, x1 - 2:x1, :3] = (120, 30, 34)
        floor[y, x0 + 2:x1 - 2, :3] = np.clip(floor[y, x0 + 2:x1 - 2, :3].astype(int) + np.random.default_rng(y).integers(-6, 7, (x1 - x0 - 4, 1)), 0, 255)


def final_city():
    img, top = BASES["city"]()
    apply_windows(img, "city")
    # шов c1|c2 (окно ct2_seam1 на x 192..448) зеркально на стыке зеркал c2'|c1' (x 832..1088)
    p = RAW / "ct2_seam1/0.png"
    if p.exists():
        res = Image.open(p).convert("RGBA").transpose(Image.FLIP_LEFT_RIGHT)
        mask = Image.open(WIN / "ct2_seam1/mask.png").convert("L").transpose(Image.FLIP_LEFT_RIGHT)
        img.paste(res, (1280 - 448, 0), mask)
    return {"city": img}, top


def pieces(img, spec):
    """Куски готовой картинки подряд: (x0, x1, flip). Зеркальный стык по общему краю без шва."""
    a = np.array(img)
    return np.concatenate([a[:, x0:x1][:, ::-1] if f else a[:, x0:x1] for x0, x1, f in spec], axis=1)


def refloor(a):
    """Новый единый асфальт под стенами (для уличных стадий после перестановки кусков)."""
    a = a.copy()
    floor = asphalt(a.shape[1], H - WALL)
    shade(floor, 0, 4, 0.25)
    a[WALL:] = floor
    return a


def base_street6():
    """Улица длиннее: подъезд 3, подъезд 4, его зеркало (подъезд 5), столпы, зеркало столпов, проход."""
    img, _ = BASES["street"]()
    apply_windows(img, "street", upto=1, only=["st_seam1"])
    a = refloor(pieces(img, [(0, 640, 0), (320, 640, 1), (640, 960, 0), (640, 960, 1), (960, 1280, 0)]))
    return Image.fromarray(a), [WALL] * a.shape[1]


def base_yard2():
    img, _ = BASES["yard"]()
    apply_windows(img, "yard")
    a = refloor(pieces(img, [(0, 270, 1), (0, 590, 0)]))
    return Image.fromarray(a), [WALL] * a.shape[1]


BASES = {"street6": base_street6, "yard2": base_yard2, "street": base_street, "yard": base_yard, "vestibule": base_vestibule, "wagon_tile": base_wagon_tile, "mayak": base_mayak, "city": base_city, "mfc": base_mfc}

SEAM = "seamless continuation, the two halves join into one continuous flat side view, same light and colors, no text, no people"
WINDOWS = {
    "street": [
        {"name": "st_seam1", "round": 1, "x": 192, "mask": [(104, 0, 152, WALL + 2)], "desc": "base of a modern Moscow residential building, white and grey striped panels, sidewalk with white bollards, " + SEAM},
        {"name": "st_seam2", "round": 1, "x": 512, "mask": [(104, 0, 152, WALL + 2)], "desc": "base of a modern building, white and grey panels turning into massive white tiled pillars under an overhang, " + SEAM},
        {"name": "st_seam3", "round": 1, "x": 832, "mask": [(104, 0, 152, WALL + 2)], "desc": "massive white tiled pillars and grey wall of a passage under a building, " + SEAM},
    ],
    "street6": [
        {"name": "st_seam4", "round": 1, "x": 832, "mask": [(104, 0, 152, WALL + 2)], "desc": "base of a modern Moscow residential building, white and grey striped panels turning into massive white tiled pillars under an overhang, sidewalk with white bollards, " + SEAM},
        {"name": "st_seam5", "round": 1, "x": 1472, "mask": [(104, 0, 152, WALL + 2)], "desc": "massive white tiled pillars and grey concrete wall of a passage under a building, " + SEAM},
    ],
    "yard": [
        {"name": "yd_seam1", "round": 1, "x": 142, "mask": [(104, 0, 152, WALL + 2)], "desc": "courtyard with green hedge and black metal fence joining the dark red brick and glass metro exit pavilion, residential towers behind, " + SEAM},
    ],
    "vestibule": [
        {"name": "vs_floor1", "round": 1, "x": 0, "mask": [(0, 152, 256, H)], "desc": "grey polished granite floor slabs, continue the floor pattern and perspective lines, flat side view, no objects"},
        {"name": "vs_floor2", "round": 1, "x": 384, "mask": [(0, 160, 256, H)], "desc": "grey polished granite floor slabs, continue the floor pattern and perspective lines, flat side view, no objects"},
        {"name": "vs_seam", "round": 2, "x": 192, "mask": [(104, 0, 152, H), (64, 152, 192, H)], "desc": "metro vestibule: dark red granite wall, light panel ceiling, grey granite floor slabs, " + SEAM},
    ],
    "wagon_tile": [
        {"name": "wg_floor", "round": 1, "x": 0, "mask": [(0, 148, 256, H)], "desc": "dark blue-grey rubber floor of a metro car, plain, continue the floor, no objects"},
        {"name": "wg_seam", "round": 2, "src": lambda img: Image.fromarray(np.concatenate([np.array(img)[:, 192:320], np.array(img)[:, 0:128]], axis=1)),
         "targets": [(0, 128, 192), (128, 256, 0)], "mask": [(104, 0, 152, H), (64, 148, 128, H)],
         "desc": "interior of a modern Moscow metro car seen from the side: sliding door, light grey panels, handrail pole, blue-grey rubber floor, " + SEAM},
    ],
    "city": [
        {"name": "ct2_seam1", "round": 1, "x": 192, "mask": [(104, 0, 152, WALL + 2)], "desc": "street at the foot of Moscow City: stone and glass office tower bases, trees, glass skyscrapers behind, overcast daylight, " + SEAM},
        {"name": "ct2_seam2", "round": 1, "x": 1152, "mask": [(104, 0, 152, WALL + 2)], "desc": "street at the foot of Moscow City joining the glass facade of a big state services center building, planters, glass skyscrapers behind, overcast daylight, " + SEAM},
    ],
    "mayak": [
        {"name": "my_floor1", "round": 1, "x": 0, "mask": [(0, 144, 256, H)], "desc": "polished light cream marble platform floor with red and dark square inlays, continue the floor pattern, no objects"},
        {"name": "my_floor2", "round": 1, "x": 384, "mask": [(0, 144, 256, H)], "desc": "polished light cream marble platform floor with red and dark square inlays, continue the floor pattern, no objects"},
        {"name": "my_seam", "round": 2, "x": 192, "mask": [(104, 0, 152, H), (64, 144, 192, H)], "desc": "Mayakovskaya metro hall: steel arches with pink stone trim, ceiling oval niches with sky mosaics, cream marble floor with red inlays, " + SEAM},
    ],
}


def apply_windows(img, stage, upto=99, only=None):
    """Готовые окна inpaint (RAW/<имя>/0.png) вклеиваются только по маске, по раундам."""
    for w in WINDOWS.get(stage, []):
        p = RAW / w["name"] / "0.png"
        if w["round"] > upto or not p.exists() or (only and w["name"] not in only):
            continue
        res = Image.open(p).convert("RGBA")
        mask = Image.open(WIN / w["name"] / "mask.png").convert("L")
        for sx0, sx1, tx in w.get("targets", [(0, 256, w.get("x", 0))]):
            img.paste(res.crop((sx0, 0, sx1, H)), (tx, 0), mask.crop((sx0, 0, sx1, H)))
    return img


def prep(stage, rnd):
    img = apply_windows(BASES[stage]()[0], stage, rnd - 1)
    specs = []
    for w in WINDOWS[stage]:
        if w["round"] != rnd:
            continue
        d = WIN / w["name"]
        d.mkdir(parents=True, exist_ok=True)
        src = w["src"](img) if "src" in w else img.crop((w["x"], 0, w["x"] + 256, H))
        src.convert("RGB").save(d / "in.png")
        m = Image.new("L", (256, H), 0)
        for box in w["mask"]:
            m.paste(255, box)
        m.save(d / "mask.png")
        specs.append({"name": w["name"], "tool": "inpaint_image", "args": {
            "description": w["desc"], "image_base64": f"@{d.relative_to(ROOT)}/in.png",
            "mask_image_base64": f"@{d.relative_to(ROOT)}/mask.png", "no_background": False}})
    out = ROOT / f"tools/specs/route-{stage}-r{rnd}.json"
    out.write_text(json.dumps(specs, indent=1, ensure_ascii=False))
    print(out.relative_to(ROOT), len(specs))


# ---------- финальные стадии ----------

def final_street():
    img, top = BASES["street6"]()
    apply_windows(img, "street6")
    zone_decal(img)
    return {"street": img}, top


def final_yard():
    img, top = BASES["yard2"]()
    return {"yard": img}, top


def final_vestibule():
    img, top = BASES["vestibule"]()
    apply_windows(img, "vestibule")
    # спереди зеркало vest_a (двойные двери); справа эскалатор вниз (с x=320+515 src): не пол, туда не ходят (walkX)
    img = Image.fromarray(pieces(img, [(0, 320, 1), (0, 640, 0)]))
    return {"vestibule": img}, [WALL] * 835 + [H] * (img.width - 835)


def window_alpha(img, rows):
    """Окна вагона: почти чёрные пиксели внутри строк rows -> прозрачные (под ними бежит тоннель)."""
    a = np.array(img)
    y0, y1 = rows
    dark = np.zeros(a.shape[:2], bool)
    dark[y0:y1] = a[y0:y1, :, :3].max(axis=2) < 40
    win = big_parts(opening(dark), 150)
    a[..., 3] = np.where(win, 0, a[..., 3])
    return Image.fromarray(a)


def opening(m):
    """Убрать тонкие линии (контуры поручней): эрозия 3x3, затем дилатация 3x3."""
    e = m.copy()
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            e &= np.roll(np.roll(m, dy, 0), dx, 1)
    d = e.copy()
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            d |= np.roll(np.roll(e, dy, 0), dx, 1)
    return d & m


def big_parts(mask, min_size):
    """Связные области маски (4-соседство) не меньше min_size пикселей."""
    from collections import deque
    seen = np.zeros_like(mask)
    out = np.zeros_like(mask)
    hh, ww = mask.shape
    for y, x in zip(*np.nonzero(mask)):
        if seen[y, x]:
            continue
        q, comp = deque([(y, x)]), []
        seen[y, x] = True
        while q:
            cy, cx = q.popleft()
            comp.append((cy, cx))
            for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                if 0 <= ny < hh and 0 <= nx < ww and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    q.append((ny, nx))
        if len(comp) >= min_size:
            for cy, cx in comp:
                out[cy, cx] = True
    return out


def final_wagon():
    tile, _ = BASES["wagon_tile"]()
    apply_windows(tile, "wagon_tile")
    t = np.array(tile)
    img = Image.fromarray(np.concatenate([t] * WAGON_TILES, axis=1))
    return {"wagon": window_alpha(img, WAGON_WINDOWS)}, [WALL] * img.width


WAGON_TILES = 5
WAGON_WINDOWS = (20, 80)  # строки src, где ищем чёрные окна (уточняется по картинке)


def final_mayak():
    """Экран M (сжатый mayak_w1) с дорисованным низом пола, второй экран = зеркало M: стык симметричный, без шва.
    Пол M: окно my_floor1 (столбцы 0-256) и хвост окна my_floor2 (оно стояло на 2-й копии M, столбцы 64-320)."""
    m = Image.fromarray(cut("mayak_w1", 9, remove=(88, 112)))
    f1 = Image.open(RAW / "my_floor1/0.png").convert("RGBA")
    f2 = Image.open(RAW / "my_floor2/0.png").convert("RGBA")
    m.paste(f1.crop((0, 0, 256, H)), (0, 0), Image.open(WIN / "my_floor1/mask.png").convert("L"))
    m.paste(f2.crop((192, 0, 256, H)), (256, 0), Image.open(WIN / "my_floor2/mask.png").convert("L").crop((192, 0, 256, H)))
    # оси симметрии M: центры арок x=67, 161, 255. Куски стыкуются зеркалом по центру арки
    a = np.array(m)
    mid = [a[:, 67:255][:, ::-1], a[:, 67:255]] * MAYAK_PAIRS  # длина: пары «зеркало + прямо» по 188
    img = oval_fix(Image.fromarray(np.concatenate([a[:, 0:255]] + mid, axis=1)))
    return {"mayak-back": img, "mayak": arch_cut(img)}, [WALL] * img.width


def arch_cut(img):
    """Слой арок: проёмы (тёмная стена тоннеля внутри арок) прозрачные, за ними едет поезд.
    Маска: крупные тёмные области в строках проёмов, без тонких линий, с заполненными дырами по строкам."""
    a = np.array(img)
    L = a[..., :3].mean(axis=2)
    dark = np.zeros(L.shape, bool)
    dark[ARCH_ROWS[0]:ARCH_ROWS[1]] = L[ARCH_ROWS[0]:ARCH_ROWS[1]] < 80
    m = big_parts(opening(dark), 300)
    for y in range(*ARCH_ROWS):  # дыры внутри проёма (блики на стене тоннеля) тоже прозрачные
        xs = np.nonzero(m[y])[0]
        if len(xs):
            runs = np.split(xs, np.nonzero(np.diff(xs) > 6)[0] + 1)
            for r in runs:
                m[y, r[0]:r[-1] + 1] = True
    a[..., 3] = np.where(m, 0, a[..., 3])
    Image.fromarray((m * 255).astype(np.uint8)).save(BUILD / "mayak-openings.png")
    return Image.fromarray(a)


MAYAK_PAIRS = 2
ARCH_ROWS = (36, 92)  # строки src, где ищем проёмы арок


def oval_fix(img):
    """Окно my_ovals: зеркальные стыки по центру арки дали «капли» вместо овалов наверху (x 255 и 443)."""
    p = RAW / "my_ovals/0.png"
    if p.exists():
        for k in range(MAYAK_PAIRS):  # «капли» повторяются с периодом 376
            img.paste(Image.open(p).convert("RGBA"), (220 + 376 * k, 0), Image.open(WIN / "my_ovals/mask.png").convert("L"))
    return img


def final_simple(stage):
    def f():
        img, top = BASES[stage]()
        apply_windows(img, stage)
        return {stage: img}, top
    return f


FINALS = {"city": final_city, "mfc": final_simple("mfc"), "street": final_street, "yard": final_yard, "vestibule": final_vestibule, "wagon": final_wagon, "mayak": final_mayak}


def floor_ts(tops):
    lines = ["// Сгенерировано tools/route_build.py из масок пола картинок маршрута. Не править руками.",
             "// top[i] = верх пола (y мира) при x = i * step.",
             "export const FLOOR: Record<string, { step: number; top: number[] }> = {"]
    for k, t in tops.items():
        lines.append(f"  {k}: {{ step: {SCALE}, top: [{','.join(str(round(v * SCALE, 1)) for v in t)}] }},")
    lines.append("};")
    (ROOT / "server/src/floor-data.ts").write_text("\n".join(lines) + "\n")


if __name__ == "__main__":
    BUILD.mkdir(parents=True, exist_ok=True)
    if len(sys.argv) > 1 and sys.argv[1] == "prep":
        prep(sys.argv[2], int(sys.argv[3]))
        sys.exit()
    names = sys.argv[1:] or list(FINALS)
    tops_path = BUILD / "floor-tops.json"
    tops = json.loads(tops_path.read_text()) if tops_path.exists() else {}
    for name in names:
        imgs, top = FINALS[name]()
        for fname, img in imgs.items():
            img.save(OUT / f"{fname}.png")
            img.resize((img.width * 3, img.height * 3), Image.NEAREST).save(BUILD / f"{fname}-x3.png")
            print(fname, img.size)
        tops[name] = top
    tops_path.write_text(json.dumps(tops))
    floor_ts(tops)
