"""Сборка полос Рамиля (pixminimax 128x128 от стойки, только east; west зеркалом).
python3 tools/ramil_build.py -> assets/sprites/ramil/<анимация>-<east|west>.png, anims.json, gif/, tips.json
tips.json: кончик сигареты в каждом кадре {анимация: [[x,y]|null,...]} в координатах ячейки east (west: x' = 127 - x)."""
import json, sys
from pathlib import Path
from PIL import Image, ImageOps
sys.path.insert(0, str(Path(__file__).parent))
from sprites import CELL, FEET_Y, anchor

ROOT = Path(__file__).resolve().parent.parent
RAW, OD = ROOT / 'assets/pixellab/ramil', ROOT / 'assets/sprites/ramil'
STRIKE_FPS = 18  # единый темп ударов у всех героев (mr.R 30.10)
# анимация -> (полоса в assets/pixellab/ramil, кадры, fps, loop, кадр попадания в итоговой полосе)
# кадры отобраны глазами 02.11 (листы assets/gen/hero4/anim/*-sheet.png); у петель последний кадр = первый, он выкинут
CFG = {
    'idle':      ('idle-c',   list(range(8)), 8, True, None),          # дышит, покачивается (mr.R: C в покое)
    'idle-warm': ('idle-d',   list(range(16)), 10, False, None),        # разминка плеч и шеи раз в 4-7 с (mr.R: D)
    'walk':      ('walk-s1',  list(range(8)), 9, True, None),           # вразвалку, руки в карманах
    'dash':      ('run-s1',   list(range(8)), 14, True, None),
    'hurt':      ('hurt-s1',  [3, 4, 5, 6, 7, 8], 14, False, None),     # 0-2: чужой кулак в кадре
    'fall':      ('fall-s2',  [4, 5, 6, 7, 8, 9, 10, 11, 12], 12, False, None),  # 2-3: чужой кулак
    'getup':     ('getup-s1', None, 10, False, None),
    'a1':        ('a1-s2',    list(range(12)), STRIKE_FPS, False, 4),   # стебли: рука вперёд (4), рывок на себя (8)
    'a2':        ('a2-s1',    list(range(9)), STRIKE_FPS, False, 4),    # нога вверх, руки в карманах
    'a3':        ('a3-s2',    list(range(12)), STRIKE_FPS, False, 3),   # выдох огня: 3-8 рот открыт
    'b1':        ('tele-s1',  [0, 1, 2, 3, 4, 5], STRIKE_FPS, False, 3),  # затяжка и выдох, затем исчезает в дыму
    'b2':        ('b2-s3',    [0, 1, 2, 3, 7, 8, 9, 10, 11, 12, 13], STRIKE_FPS, False, 5),  # разворот, удар вправо; 4-6 нога назад выкинуты
    'b3':        ('tele-s1',  [0, 1, 2, 3, 4, 5], STRIKE_FPS, False, 3),
    'slap':      ('slap-s2',  None, STRIKE_FPS, False, 3),              # удары ульты (8 телепортов)
    'smoke':     ('smoke-s1', list(range(16)), 10, True, None),         # «Перекур»: держать кнопку
    'taunt':     ('taunt-s1', list(range(12)), 10, False, None),
}


def tip(cell):
    """Кончик сигареты: самый правый оранжевый пиксель в верхней половине ячейки."""
    px = cell.load(); best = None
    for y in range(20, 80):
        for x in range(40, CELL):
            r, g, b, a = px[x, y]
            if a and r > 200 and 90 < g < 175 and b < 100 and (best is None or x > best[0]):
                best = (x, y)
    return best


def main():
    OD.mkdir(parents=True, exist_ok=True); (OD / 'gif').mkdir(exist_ok=True)
    manifest, tips = {}, {}
    for name, (src, keep, fps, loop, hit) in CFG.items():
        p = RAW / f'{src}.png'
        if not p.exists():
            print('нет', src); continue
        s = Image.open(p).convert('RGBA'); c = s.height; n = s.width // c  # стойки idle-c/d сделаны на холсте 64
        cells = []
        for i in range(n):
            g = Image.new('RGBA', (CELL, CELL)); g.paste(s.crop((i * c, 0, (i + 1) * c, c)), ((CELL - c) // 2, CELL - c)); cells.append(g)
        keep = keep if keep is not None else list(range(n - 1))
        ax, ay = anchor([cells[0]])  # опора по первому кадру (стойка): весь клип сдвигается одинаково
        fr = []
        for i in keep:
            g = Image.new('RGBA', (CELL, CELL)); g.paste(cells[i], (CELL // 2 - ax, FEET_Y - ay), cells[i]); fr.append(g)
        tips[name] = [list(t) if (t := tip(f)) else None for f in fr]
        for d in ('east', 'west'):
            cs = fr if d == 'east' else [ImageOps.mirror(f) for f in fr]
            strip = Image.new('RGBA', (CELL * len(cs), CELL))
            for i, f in enumerate(cs): strip.paste(f, (i * CELL, 0))
            strip.save(OD / f'{name}-{d}.png')
        m = {'east': len(fr), 'west': len(fr), 'fps': fps, 'loop': loop}
        if hit is not None: m['hit'] = {'east': hit, 'west': hit}
        manifest[name] = m
        bg = [Image.alpha_composite(Image.new('RGBA', (CELL, CELL), (200, 200, 205, 255)), f).resize((CELL * 3, CELL * 3), Image.NEAREST) for f in fr]
        bg[0].save(OD / 'gif' / f'{name}.gif', save_all=True, append_images=bg[1:], duration=int(1000 / fps), loop=0)
    # static: первый кадр стойки
    st = Image.open(OD / 'idle-east.png').crop((0, 0, CELL, CELL)); st.save(OD / 'static-east.png'); ImageOps.mirror(st).save(OD / 'static-west.png')
    manifest['static'] = {'east': 1, 'west': 1, 'fps': 1, 'loop': True}
    (OD / 'anims.json').write_text(json.dumps({'cell': CELL, 'feetY': FEET_Y, 'states': {'ramil': manifest}}, indent=1, ensure_ascii=False))
    (OD / 'tips.json').write_text(json.dumps(tips))
    # клиенту: кончик сигареты по кадрам (east, ячейка 128, ступни на FEET_Y) для дыма поверх спрайта
    ts = ['// Сгенерировано tools/ramil_build.py, руками не править.',
          '// Кончик сигареты Рамиля в каждом кадре анимации: [x, y] в ячейке east 128x128 (ступни y=112), null = сигареты не видно.',
          '// Для west: x -> 127 - x.',
          f'export const RAMIL_TIPS: Record<string, ([number, number] | null)[]> = {json.dumps(tips)};', '']
    (ROOT / 'client/src/ramil-tips.ts').write_text('\n'.join(ts))
    print(json.dumps({k: (v['east'], v.get('hit')) for k, v in manifest.items()}, ensure_ascii=False))
    miss = {k: sum(t is None for t in v) for k, v in tips.items() if any(t is None for t in v)}
    print('кадры без сигареты:', miss)


main()
