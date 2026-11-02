"""Стебли Рамиля v2 (mr.R 02.11: гибрид «лоза-аркан» + «дымовой хлыст»). Кодом, бесплатно.
Живой стебель дугой от ладони к врагу, по нему раскрываются листья конопли, вокруг клубится зеленоватый дым,
кончик-петля обвивает врага, потом рывок: дуга выпрямляется и укорачивается, враг едет к герою.
python3 tools/ramil_vine2.py -> assets/vfx/ramil/vine2/ (leaf-up, leaf-down, wisp 8 кадров, coil 4 кадра), превью assets/gen/hero4/moves/a1-v2.gif
Алгоритм draw_vine() — образец для клиента (порт в Phaser Graphics + спрайты листьев/дыма)."""
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets/vfx/ramil/vine2'; OUT.mkdir(parents=True, exist_ok=True)
K = (16, 34, 18, 255)                      # контур
G = [(34, 92, 38, 255), (58, 138, 50, 255), (98, 182, 70, 255), (168, 226, 112, 255)]  # тени -> блики
LEAF = ["........L........",
        "...L....L....L...",
        "...LL..LLL..LL...",
        "....LL.LLL.LL....",
        "....LLL.L.LLL....",
        "L....LL.L.LL....L",
        ".LLL..LLLLL..LLL.",
        "..LLLL.LLL.LLLL..",
        "....LLLLLLLLL....",
        ".......LLL.......",
        "........s........"]


def leaf_img(flip=False):
    h, w = len(LEAF), len(LEAF[0])
    im = Image.new('RGBA', (w + 2, h + 2))
    for r, row in enumerate(LEAF):
        for c, ch in enumerate(row):
            if ch == '.': continue
            col = G[0] if ch == 's' else (G[3] if c == 8 else (G[1] if (r + c) % 3 == 0 else G[2]))
            im.putpixel((c + 1, r + 1), col)
    outline(im)
    return ImageOps.flip(im) if flip else im


def outline(im):
    src = im.copy(); a = src.load()
    for y in range(im.height):
        for x in range(im.width):
            if a[x, y][3] == 0 and any(0 <= x + dx < im.width and 0 <= y + dy < im.height and a[x + dx, y + dy][3] and a[x + dx, y + dy] != K
                                       for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                im.putpixel((x, y), K)


def wisp_frames(n=8, w=22, h=22):
    """Клубок зеленоватого дыма: растёт и тает за n кадров."""
    fr = []
    for i in range(n):
        im = Image.new('RGBA', (w, h)); d = ImageDraw.Draw(im); t = i / (n - 1)
        r = 3 + 6 * t; a = int(225 * (1 - t) ** 0.7)
        cx, cy = w / 2, h / 2 + 2 - 3 * t
        d.ellipse((cx - r - 1, cy - r - 1, cx + r + 1, cy + r + 1), fill=(90, 150, 100, a // 2))
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(150, 205, 150, a))
        d.ellipse((cx - r * 0.55 - 1, cy - r * 0.55 - 1, cx + r * 0.3, cy + r * 0.3), fill=(205, 240, 200, a))
        fr.append(im)
    return fr


def coil_frames(n=4, w=36, h=30):
    """Петля стебля вокруг корпуса врага: 3 витка, перед/за спиной, листья торчат, витки перебегают."""
    fr = []
    for f in range(n):
        im = Image.new('RGBA', (w, h)); ph = 2 * math.pi * f / n
        for k in range(3):
            for s in range(240):
                a = 2 * math.pi * s / 240
                x = w / 2 + 13 * math.cos(a); y = 7 + k * 7 + 3 * math.sin(a) + 1.2 * math.sin(2 * a + ph + k)
                front = math.sin(a) > 0
                for dy, col in ((0, G[2] if front else G[0]), (1, G[1] if front else G[0]), (2, G[0])):
                    xi, yi = int(round(x)), int(round(y + dy))
                    if 0 <= xi < w and 0 <= yi < h: im.putpixel((xi, yi), col)
        outline(im)
        lf = leaf_img().resize((9, 7), Image.NEAREST)
        im.alpha_composite(lf, (0, 0)); im.alpha_composite(ImageOps.mirror(lf), (w - 9, h - 8))
        fr.append(im)
    return fr


L_UP, L_DN = leaf_img(), leaf_img(True)
WISP, COIL = wisp_frames(), coil_frames()
L_UP.save(OUT / 'leaf-up.png'); L_DN.save(OUT / 'leaf-down.png')
for name, frs in (('wisp', WISP), ('coil', COIL)):
    s = Image.new('RGBA', (frs[0].width * len(frs), frs[0].height))
    for i, f in enumerate(frs): s.paste(f, (i * f.width, 0))
    s.save(OUT / f'{name}.png')


def bez(p0, p1, c, t):
    u = 1 - t
    return (u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1])


def draw_vine(im, p0, p1, grow, arc, tick, smoke=False):
    """grow 0..1: доля пути, которую прошёл кончик; arc: высота дуги в px (при рывке -> 0)."""
    d = ImageDraw.Draw(im)
    mid = ((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2 - arc)
    L = math.dist(p0, p1); n = max(8, int(L * grow / 2))
    pts = [bez(p0, p1, mid, grow * i / n) for i in range(n + 1)]
    # 1) дым позади стебля: клубки каждые 9 px, фаза от tick, смещение синусом поперёк
    for i in (range(0, n + 1, 3) if smoke else ()):
        x, y = pts[i]; k = (tick + i) % len(WISP)
        for side in (-1, 1):
            im.alpha_composite(WISP[(k + (side > 0) * 3) % len(WISP)], (int(x - 11 + 4 * math.sin(i + tick * 0.7)), int(y - 11 + side * 5 + 2 * math.cos(i * 0.6 + tick))))
    # 2) стебель: контур, тело, блик; толщина сужается к кончику; две пряди слегка закручены
    for pass_, rad, col in ((0, 4.0, K), (1, 3.0, G[1]), (2, 1.2, G[3])):
        for i, (x, y) in enumerate(pts):
            r = rad * (1 - 0.35 * i / max(1, n))
            tw = 0  # без тряски бликов (mr.R: «не дёрганая»)
            d.ellipse((x - r, y - r + tw - (0.6 if pass_ == 2 else 0), x + r, y + r + tw - (0.6 if pass_ == 2 else 0)), fill=col)
    # 3) листья раскрываются вдоль пройденной части через каждые 16 px, по очереди сверху/снизу
    step = max(1, int(22 / (L * grow / n + 1e-6)))
    for j, i in enumerate(range(step, n, step)):
        x, y = pts[i]
        lf = L_UP if j % 2 == 0 else L_DN
        im.alpha_composite(lf, (int(x - lf.width / 2), int(y - lf.height + 1) if j % 2 == 0 else int(y - 1)))
    # 4) кончик: раскрытый лист вперёд, пока летит
    if grow < 1:
        x, y = pts[-1]; tip = L_UP.rotate(-90, expand=True)
        im.alpha_composite(tip, (int(x - 3), int(y - tip.height / 2)))


# ---------- превью: ладонь (Рамиль a1), враг-ватник, полёт 4 кадра, петля, рывок 5 кадров, втягивание
if __name__ == '__main__':
    import json
    SP = ROOT / 'assets/sprites/ramil'
    a1 = Image.open(SP / 'a1-east.png').convert('RGBA'); A1 = [a1.crop((i * 128, 0, (i + 1) * 128, 128)) for i in range(a1.width // 128)]
    idle = Image.open(SP / 'idle-east.png').convert('RGBA'); IDLE = [idle.crop((i * 128, 0, (i + 1) * 128, 128)) for i in range(idle.width // 128)]
    EN = Image.open(ROOT / 'client/public/sprites/enemies/vatnik/idle-east.png').convert('RGBA'); E0 = ImageOps.mirror(EN.crop((0, 0, 128, 128)))
    EH = Image.open(ROOT / 'client/public/sprites/enemies/vatnik/hurt-east.png').convert('RGBA'); E1 = ImageOps.mirror(EH.crop((0, 0, 128, 128)))
    W, H, GR = 380, 150, 128; RX = 90
    FONT = None
    try:
        from PIL import ImageFont; FONT = ImageFont.truetype('/usr/share/fonts/truetype/freefont/FreeSansBoldOblique.ttf', 15)
    except Exception: pass
    frames = []; ex = 300.0
    def base():
        c = Image.new('RGBA', (W, H), (52, 54, 64, 255)); ImageDraw.Draw(c).rectangle((0, GR, W, H), fill=(40, 41, 50, 255)); return c
    def spr(c, cell, x): c.alpha_composite(cell, (int(x - 64), GR - 112))
    hand = (RX + 36, GR - 49)
    ease_out = lambda t: 1 - (1 - t) ** 3
    ease_io = lambda t: 3 * t * t - 2 * t * t * t
    FL, PU, RE, DT = 200, 300, 180, 40  # мс: полёт, рывок, втягивание; шаг кадра превью
    for fi in (0, 0, 1, 1, 2, 2, 3):
        c = base(); spr(c, E0, ex); spr(c, A1[fi], RX); frames.append(c)
    t = 0; x0 = ex
    while t <= FL + PU + RE:
        c = base()
        if t < FL: kind, v = 'fly', ease_out(t / FL)
        elif t < FL + PU: kind, v = 'pull', ease_io((t - FL) / PU)
        else: kind, v = 'back', 1 - ease_io((t - FL - PU) / RE)
        if kind == 'pull': ex = x0 - (x0 - (RX + 44)) * v
        fi = 4 if kind == 'fly' else (5 + int(v * 3) if kind == 'pull' else 9 + int((1 - v) * 2))
        spr(c, E1 if kind == 'pull' else E0 if kind == 'fly' else E1, ex)
        spr(c, A1[min(fi, len(A1) - 1)], RX)
        target = (ex - 6, GR - 38)
        if kind == 'fly': draw_vine(c, hand, target, v, 30, 0)
        elif kind == 'pull':
            draw_vine(c, hand, target, 1, 30 * (1 - v), 0)
            c.alpha_composite(COIL[int(t / 100) % 4], (int(ex - 18), GR - 54))
        else: draw_vine(c, hand, target, v, 0, 0)
        if FONT and kind != 'back':
            ImageDraw.Draw(c).text((200, 26), 'ИДИ СЮДА!', font=FONT, fill=(160, 235, 110), stroke_width=2, stroke_fill=(16, 30, 14), anchor='mm')
        frames.append(c); t += DT
    for k in range(8):
        c = base(); spr(c, E1, ex); spr(c, IDLE[k % len(IDLE)], RX); frames.append(c)
    big = [f.resize((W * 3, H * 3), Image.NEAREST) for f in frames]
    big[0].save(ROOT / 'assets/gen/hero4/moves/a1-v2.gif', save_all=True, append_images=big[1:], duration=40, loop=0)
    # кадр-проверка
    o = Image.new('RGBA', (W * 2, H * 2)); [o.paste(frames[i], ((j % 2) * W, (j // 2) * H)) for j, i in enumerate((9, 12, 16, 20))]
    o.resize((W * 4, H * 4), Image.NEAREST).save(ROOT / 'scratchpad/a1v2-check.png')
    print('ok')
