"""Превью приёмов Рамиля с эффектами для mr.R (не игра, а постановка-референс для кода).
python3 tools/ramil_preview.py -> assets/gen/hero4/moves/<приём>.gif + assets/gen/hero4/moves.html"""
import json, math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SP, VFX, OUT = ROOT / 'assets/sprites/ramil', ROOT / 'assets/vfx/ramil', ROOT / 'assets/gen/hero4/moves'
OUT.mkdir(parents=True, exist_ok=True)
A = json.loads((SP / 'anims.json').read_text())['states']['ramil']
TIPS = json.loads((SP / 'tips.json').read_text())
W, H, GROUND, S = 360, 150, 128, 3
BG = (52, 54, 64, 255)
FONT = ImageFont.truetype('/usr/share/fonts/truetype/freefont/FreeSansBoldOblique.ttf', 15)


def strip(name, d='east'):
    s = Image.open(SP / f'{name}-{d}.png').convert('RGBA')
    return [s.crop((i * 128, 0, (i + 1) * 128, 128)) for i in range(s.width // 128)]


def grid_clip(pack, clip):
    m = json.loads((VFX / pack / 'manifest.json').read_text())
    c = next(c for c in m['clips'] if c['name'] == clip)
    fw, fh = c['frame']['w'], c['frame']['h']; fr = []
    for sh in c['sheets']:
        im = Image.open(VFX / pack / sh['file']).convert('RGBA')
        for k in range(sh['frames']):
            col, row = k % sh['columns'], k // sh['columns']
            fr.append(im.crop((col * fw, row * fh, (col + 1) * fw, (row + 1) * fh)))
    return fr, (c['offset']['x'], c['offset']['y'])


def hstrip(path, w):
    im = Image.open(path).convert('RGBA'); return [im.crop((i * w, 0, (i + 1) * w, im.height)) for i in range(im.width // w)]


SMOKE, HEAVY = hstrip(VFX / 'smoke-idle.png', 18), hstrip(VFX / 'smoke-heavy.png', 28)
MARK = hstrip(VFX / 'mark.png', 20)
POOF, POOF_OFF = grid_clip('poof', 'part-smoke_poof')
FIRE, FIRE_OFF = grid_clip('fire', 'part-flamethrower')
BURN_B, BURN_B_OFF = grid_clip('burn', 'part-flame_aura')
BURN_F, BURN_F_OFF = grid_clip('burn', 'part-burn_status')
HIT, HIT_OFF = grid_clip('hits', 'part-hit_star')
CRIT, CRIT_OFF = grid_clip('hits', 'part-crit_hit')
RISE, RISE_OFF = grid_clip('hits', 'part-rising_slash')
SEG = [Image.open(VFX / f'vines/seg-{i}.png').convert('RGBA') for i in range(3)]
VHEAD = Image.open(VFX / 'vines/head.png').convert('RGBA')
WRAP = [Image.open(VFX / f'vines/wrap-{i}.png').convert('RGBA') for i in range(4)]
EN = Image.open(ROOT / 'client/public/sprites/enemies/vatnik/idle-east.png').convert('RGBA')
EN_IDLE = [ImageOps.mirror(EN.crop((i * 128, 0, (i + 1) * 128, 128))) for i in range(EN.width // 128)]
EH = Image.open(ROOT / 'client/public/sprites/enemies/vatnik/hurt-east.png').convert('RGBA')
EN_HURT = [ImageOps.mirror(EH.crop((i * 128, 0, (i + 1) * 128, 128))) for i in range(EH.width // 128)]


class Scene:
    def __init__(self): self.frames = []

    def new(self):
        c = Image.new('RGBA', (W, H), BG); d = ImageDraw.Draw(c)
        d.rectangle((0, GROUND, W, H), fill=(40, 41, 50, 255)); return c

    @staticmethod
    def sprite(c, cell, x, y=GROUND, flip=False):  # x,y = ступни
        c.alpha_composite(ImageOps.mirror(cell) if flip else cell, (int(x - 64), int(y - 112)))

    @staticmethod
    def at(c, im, x, y):
        c.alpha_composite(im, (int(x), int(y)))

    @staticmethod
    def word(c, x, y, text, col=(255, 210, 90)):
        d = ImageDraw.Draw(c)
        d.text((x, y), text, font=FONT, fill=col, stroke_width=2, stroke_fill=(20, 12, 10), anchor='mm')

    def push(self, c, n=1): self.frames += [c] * n

    def save(self, name, ms=56):
        big = [f.resize((W * S, H * S), Image.NEAREST) for f in self.frames]
        big[0].save(OUT / f'{name}.gif', save_all=True, append_images=big[1:], duration=ms, loop=0, disposal=2)


def smoke_at(c, cell_tip, x, y, k, heavy=False, flip=False):
    if not cell_tip: return
    tx = (127 - cell_tip[0]) if flip else cell_tip[0]
    px, py = x - 64 + tx, y - 112 + cell_tip[1]
    sm = (HEAVY if heavy else SMOKE)[k % 16]; sw = sm.width
    if flip: sm = ImageOps.mirror(sm)
    c.alpha_composite(sm, (int(px - sw * (0.38 if flip else 0.62)), int(py - sm.height + 1)))


def play(sc, name, x, extra=None, flip=False, heavy=False, reps=1, enemy=None):
    fr = strip(name); tips = TIPS[name]
    k0 = len(sc.frames)
    for r in range(reps):
        for i, cell in enumerate(fr):
            c = sc.new()
            if enemy: enemy(c, len(sc.frames) - k0)
            Scene.sprite(c, cell, x, flip=flip)
            smoke_at(c, tips[i], x, GROUND, len(sc.frames), heavy, flip)
            if extra: extra(c, i, len(sc.frames) - k0)
            sc.push(c, 1 if A[name]['fps'] >= 14 else 2)


def basic(name, reps=2, heavy=False):
    sc = Scene(); play(sc, name, 150, reps=reps, heavy=heavy); sc.save(name)


def enemy_idle(ex):
    return lambda c, t: Scene.sprite(c, EN_IDLE[(t // 2) % len(EN_IDLE)], ex)


def mv_a1():
    sc = Scene(); state = {'ex': 270.0}
    def en(c, t):
        Scene.sprite(c, (EN_HURT[min(t // 2, len(EN_HURT) - 1)] if t > 6 else EN_IDLE[0]), state['ex'])
    def ex(c, i, t):
        hand = (110 + 30, GROUND - 52)
        if 4 <= i <= 9:
            if i <= 6:
                reach = (state['ex'] - 14 - hand[0]) * (i - 3) / 3
            else:
                state['ex'] = max(160.0, state['ex'] - 38); reach = state['ex'] - 14 - hand[0]
            n = max(1, int(reach // 24) + 1)
            for k in range(n):
                seg = SEG[(t + k) % 3]
                w = min(24, int(reach - k * 24))
                if w > 0: c.alpha_composite(seg.crop((0, 0, w, 24)), (int(hand[0] + k * 24), hand[1] - 12))
            Scene.at(c, VHEAD, hand[0] + reach - 4, hand[1] - 10)
            if i >= 6: Scene.at(c, WRAP[t % 4], state['ex'] - 17, GROUND - 46)
        if 4 <= i <= 8: Scene.word(c, 200, 30, 'ИДИ СЮДА!', (160, 235, 110))
    play(sc, 'a1', 110, ex, enemy=en)
    for k in range(8):
        c = sc.new(); Scene.sprite(c, EN_IDLE[0], state['ex']); Scene.sprite(c, strip('idle')[k % 8], 110)
        smoke_at(c, TIPS['idle'][k % 8], 110, GROUND, len(sc.frames)); sc.push(c)
    sc.save('a1')


def mv_a2():
    sc = Scene(); st = {'t': -1}
    def en(c, t):
        if st['t'] < 0: Scene.sprite(c, EN_IDLE[0], 170); return
        u = (t - st['t']) / 14; h = max(0, 4 * 70 * u * (1 - u))
        Scene.sprite(c, EN_HURT[min(2, len(EN_HURT) - 1)], 170, GROUND - h)
    def ex(c, i, t):
        if i == 4 and st['t'] < 0: st['t'] = t
        if st['t'] >= 0:
            k = t - st['t']
            if k < len(RISE): Scene.at(c, RISE[k], 165 + RISE_OFF[0] - 10, GROUND + RISE_OFF[1] - 20)
            if k < len(HIT): Scene.at(c, HIT[k], 150 + HIT_OFF[0], GROUND - 60 + HIT_OFF[1] + 40)
            if k < 8: Scene.word(c, 175, 26, 'ОП!')
    play(sc, 'a2', 125, ex, enemy=en)
    for k in range(10):
        c = sc.new(); en(c, len(sc.frames)); Scene.sprite(c, strip('idle')[k % 8], 125); smoke_at(c, TIPS['idle'][k % 8], 125, GROUND, len(sc.frames)); sc.push(c)
    sc.save('a2')


def mv_a3():
    sc = Scene(); st = {'t': -1}
    def en(c, t):
        Scene.sprite(c, EN_HURT[0] if st['t'] >= 0 else EN_IDLE[0], 220)
        if st['t'] >= 0:
            k = len(sc.frames)
            Scene.at(c, BURN_F[k % len(BURN_F)], 220 + BURN_F_OFF[0] - 2, GROUND + BURN_F_OFF[1] + 2)
    def ex(c, i, t):
        tip = TIPS['a3'][i] or TIPS['a3'][0]
        if 3 <= i <= 8:
            mx, my = 110 - 64 + tip[0], GROUND - 112 + tip[1]
            Scene.at(c, FIRE[t % len(FIRE)], mx + FIRE_OFF[0] + 6, my + FIRE_OFF[1] + 2)
            if st['t'] < 0 and i >= 4: st['t'] = t
            Scene.word(c, 200, 26, 'ПЫХ!', (255, 140, 60))
    play(sc, 'a3', 110, ex, enemy=en)
    for k in range(14):
        c = sc.new(); en(c, len(sc.frames)); Scene.sprite(c, strip('idle')[k % 8], 110); smoke_at(c, TIPS['idle'][k % 8], 110, GROUND, len(sc.frames)); sc.push(c)
    sc.save('a3')


def poof(c, k, x):
    if 0 <= k < len(POOF): Scene.at(c, POOF[k], x + POOF_OFF[0] - 4, GROUND - 40 + POOF_OFF[1] + 20)


def mv_b():
    """B, B B, B B B подряд: в тыл к дальнему, пинок к своим, возврат к помеченному."""
    sc = Scene(); ex_ = {'x': 260.0, 'fly': -1}
    def en(c, t):
        if ex_['fly'] >= 0:
            k = len(sc.frames) - ex_['fly']; ex_['x'] = max(70, 260 - k * 22)
            Scene.sprite(c, EN_HURT[1 % len(EN_HURT)], ex_['x'], GROUND - (12 if k < 8 else 0))
        else: Scene.sprite(c, EN_IDLE[0], ex_['x'])
        Scene.at(c, MARK[len(sc.frames) % 8], ex_['x'] - 10, GROUND - 70) if sc.__dict__.get('marked') else None
    def ex1(c, i, t):
        if i >= 3: Scene.word(c, 90, 26, 'ПФФ', (210, 210, 225))
    play(sc, 'b1', 80, ex1, heavy=True, enemy=en)
    # исчезает: клуб на старом месте, через 3 кадра клуб за спиной врага
    for k in range(len(POOF) + 3):
        c = sc.new(); en(c, 0); poof(c, k, 80); poof(c, k - 3, 300)
        if k >= 8:
            Scene.sprite(c, strip('idle')[0], 300, flip=True)
        if k >= 5: sc.marked = True
        if 4 <= k <= 9: Scene.word(c, 300, 26, 'ВЖУХ', (210, 210, 225))
        sc.push(c)
    def ex2(c, i, t):
        if i == 5 and ex_['fly'] < 0: ex_['fly'] = len(sc.frames)
        if ex_['fly'] >= 0:
            k = len(sc.frames) - ex_['fly']
            if k < len(CRIT): Scene.at(c, ImageOps.mirror(CRIT[k]), 270 - CRIT_OFF[0] - CRIT[0].width + 20, GROUND - 50 + CRIT_OFF[1] + 30)
            if k < 2:  # импакт-кадр: инверсия
                inv = ImageOps.invert(c.convert('RGB')).convert('RGBA'); c.paste(inv)
            if k < 10: Scene.word(c, 200, 26, 'ПОКА!', (255, 90, 80))
    play(sc, 'b2', 300, ex2, flip=True, enemy=en)
    for k in range(6):
        c = sc.new(); en(c, 0); Scene.sprite(c, strip('idle')[k % 8], 300, flip=True); sc.push(c)
    play(sc, 'b3', 300, None, flip=True, heavy=True, enemy=en)
    for k in range(len(POOF) + 3):
        c = sc.new(); en(c, 0); poof(c, k, 300); poof(c, k - 3, ex_['x'] + 40)
        if k >= 8: Scene.sprite(c, strip('idle')[0], ex_['x'] + 40, flip=True)
        sc.push(c)
    for k in range(10):
        c = sc.new(); en(c, 0); Scene.sprite(c, strip('idle')[k % 8], ex_['x'] + 40, flip=True); sc.push(c)
    sc.save('b-combo')


def mv_ult():
    sc = Scene(); foes = [150, 215, 285]; slap = strip('slap')  # пощёчина тыльной стороной
    words = ['РАЗ', 'ДВА', 'ТРИ', 'ЧЕТЫРЕ', 'ПЯТЬ', 'ШЕСТЬ', 'СЕМЬ', 'ВСЁ.']
    for h in range(8):
        tx = foes[h % 3]; side = -1 if h % 2 else 1; rx = tx - 34 * side
        for k in range(7):
            c = sc.new()
            for j, fx in enumerate(foes):
                Scene.sprite(c, EN_HURT[0] if j == h % 3 and k >= 3 else EN_IDLE[0], fx)
            poof(c, k, rx)
            if k >= 2: Scene.sprite(c, slap[min(len(slap) - 1, k - 1)], rx, flip=side < 0)
            if k >= 3 and k - 3 < len(HIT): Scene.at(c, HIT[k - 3], tx - 21, GROUND - 60)
            if k >= 3: Scene.word(c, tx, 24, words[h], (255, 230, 120) if h < 7 else (255, 90, 80))
            sc.push(c)
    for k in range(12):
        c = sc.new()
        for fx in foes: Scene.sprite(c, EN_HURT[-1], fx)
        Scene.sprite(c, strip('idle')[k % 8], 90); smoke_at(c, TIPS['idle'][k % 8], 90, GROUND, len(sc.frames)); sc.push(c)
    sc.save('ult')


def mv_smoke():
    sc = Scene()
    def ex(c, i, t):
        Scene.word(c, 150, 22, 'Ща-ща, подождите, докурю', (235, 235, 240))
        d = ImageDraw.Draw(c); fill = min(1.0, t / 64)
        d.rectangle((110, 140, 110 + int(140 * fill), 145), fill=(255, 150, 60)); d.rectangle((110, 140, 250, 145), outline=(200, 200, 210))
    play(sc, 'smoke', 150, ex, heavy=True, reps=2)
    sc.save('smoke')


if __name__ == '__main__':
    for n in ('idle', 'idle-warm', 'walk', 'dash', 'hurt', 'fall', 'taunt'):
        if (SP / f'{n}-east.png').exists(): basic(n, reps=2 if A[n]['loop'] else 1)
    mv_a1(); mv_a2(); mv_a3(); mv_b(); mv_ult(); mv_smoke()
    print('ok', sorted(p.name for p in OUT.glob('*.gif')))
