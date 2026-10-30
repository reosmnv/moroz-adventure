import * as Phaser from 'phaser';
import { CHAIN, CHARACTERS, HEAVY, HERO_ID, KRIS_ID, MOVE_NAMES, NADYA_ID, PLAYER_HP, STORM_MS, TEST_TOOLS, ULT_MS, VIEW_H } from '@bc/shared';
import type { Button, EntitySnap, GameSession } from './session.ts';

// Интерфейс поверх боя: стик, кнопки, панели игроков. Отдельная сцена, поэтому встряска
// и хитстоп боя его не задевают. Координаты экранные: 0..ширина игры, высота 270.

export const FONT = '"Press Start 2P", monospace';
// Пиксельный шрифт чёткий только на кратных 8 размерах
export const textStyle = (size = 8, color = '#d7d1c7') =>
  ({ fontFamily: FONT, fontSize: `${size}px`, color, stroke: '#120c19', strokeThickness: 2 });

// Палитра героини: тёмный контур, сине-фиолетовый, лаванда, кремовый
const INK = 0x120c19, NAVY = 0x2e3049, PLUM = 0x5a495d, LAV = 0x9d74d4, CREAM = 0xd7d1c7;
const HP_COLOR = 0x7bd36b, ULTIMATE_COLOR = 0xff7a1a;

const BTN_SCALE = 1.5, BTN_HIT = 69;
const RING_RADIUS = 40, RING_OUTLINE = 7, RING_LINE = 4;
const JOY_SCALE = 1.3, JOY_RADIUS = 47;
const RUN_STICK = 0.9;
const JOY_REST = { x: 75, y: VIEW_H - 75 };
const PORTRAIT_PAD = 8, PRESS_MS = 90;
const HINT_GAP = 42, PIP_Y = 39;
const PANEL_W = 138, BAR_W = 82, PANEL_X = 6, PANEL_Y = 6, PANEL_GAP = 6;
const PORTRAIT_DROP = 1, ICON_Y = -1, ICON_DROP = 2;
const JOY_CAPTURE = 0.45, JOY_IDLE_ALPHA = 0.35;
const ULT_PULSE_SCALE = 1.1, ULT_PULSE_MS = 380;
const PIP_STEP = 8, PIP_SIZE = 4;

type Placement = { id: Button; dx: number; dy: number };
const LAYOUT: Record<number, Placement[]> = {
  3: [{ id: 'attack', dx: 52, dy: 52 }, { id: 'heavy', dx: 132, dy: 52 }, { id: 'ult', dx: 52, dy: 132 }],
  4: [{ id: 'attack', dx: 52, dy: 52 }, { id: 'heavy', dx: 132, dy: 52 }, { id: 'ult', dx: 52, dy: 132 }, { id: 'ult2', dx: 132, dy: 132 }],
};
const BUTTONS: { id: Button; icon: string; color: number }[] = [
  { id: 'attack', icon: 'ui-icon-attack', color: 0xe0457b },
  { id: 'heavy', icon: 'ui-icon-heavy', color: 0x5a609a },
  { id: 'ult', icon: 'ui-icon-ult', color: LAV },
  { id: 'ult2', icon: 'ui-icon-snow', color: LAV },
];
const btnPos = (b: Placement, w: number) => ({ x: w - b.dx, y: VIEW_H - b.dy });
const heroColor = (char?: string) => CHARACTERS.find(c => c.id === char)?.color ?? LAV;
const colorHex = (color: number) => '#' + color.toString(16).padStart(6, '0');

// Свои иконки и лица героев 2-4 (client/public/ui/<папка>/)
const HERO_UI: Record<string, { dir: string; icons: string[] }> = {
  [NADYA_ID]: { dir: 'nadya', icons: ['face', 'icon-attack', 'icon-ult', 'heavy-slap', 'heavy-kick', 'heavy-sword'] },
  [KRIS_ID]: { dir: 'kris', icons: ['face', 'icon-attack', 'icon-ult', 'icon-flash', 'icon-ball'] },
};
const NADYA_HEAVY_ICON: Record<string, string> = { b1: 'heavy-slap', b2: 'heavy-kick', 'b3-draw': 'heavy-sword' };
const heroIcon = (char: string, name: string) => `ui-${HERO_UI[char].dir}-${name}`;

interface BtnView { base: Phaser.GameObjects.Image; icon: Phaser.GameObjects.Image; color: number; held: number }
interface Panel { frame: Phaser.GameObjects.Image; root: Phaser.GameObjects.Container; portrait: Phaser.GameObjects.Image; badge: Phaser.GameObjects.Rectangle; name: Phaser.GameObjects.Text; bars: Phaser.GameObjects.Graphics }


// Иконки временно из существующего набора, без новых ассетов.
const NASTYA_HEAVY_ICON: Record<string, string> = { uppercut: 'uppercut', cross: 'superman', slam: 'highkick', 'spin-elbow': 'spin-elbow', knee: 'flying-knee', hurricane: 'hurricane' };
const HITS_SHOW = 5;
const HITS_Y = 55;
const HITS_FONT = '14px';
const HITS_PULSE = 1.2;
const HITS_PULSE_MS = 120;

export class UIScene extends Phaser.Scene {
  session!: GameSession;
  private joyId = -1;
  private joyOrigin = new Phaser.Math.Vector2();
  private joyBase!: Phaser.GameObjects.Image;
  private joyKnob!: Phaser.GameObjects.Image;
  private btns = new Map<Button, BtnView>();
  private heldBy = new Map<number, Button>(); // палец -> кнопка под ним
  private ultRing!: Phaser.GameObjects.Graphics;
  private ultPulse!: Phaser.Tweens.Tween;
  private pips!: Phaser.GameObjects.Graphics;
  private hitText!: Phaser.GameObjects.Text;
  private shownHits = 0;
  private bHint!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private panels: Panel[] = [];
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private runKey!: Phaser.Input.Keyboard.Key;
  private stickRun = false;
  private activeLayout = LAYOUT[4];
  private portraitUntil = 0;

  constructor() { super('ui'); }

  init(data: { session: GameSession }) { this.session = data.session; }

  preload() {
    for (const k of ['btn', 'stick', 'frame', 'icon-attack', 'icon-heavy', 'icon-ult', 'icon-snow', 'icon-taunt', 'face-prime', 'face-ultimate']) {
      this.load.image('ui-' + k, `ui/${k}.png`);
    }
    // Своя иконка B на каждый завершающий удар обеих форм
    for (const m of new Set(Object.values(NASTYA_HEAVY_ICON))) this.load.image('ui-heavy-' + m, `ui/heavy-${m}.png`);
    for (const [char, h] of Object.entries(HERO_UI)) for (const n of h.icons) this.load.image(heroIcon(char, n), `ui/${h.dir}/${n}.png`);
  }

  create() {
    this.shownHits = 0;
    this.hitText = this.add.text(0, HITS_Y, '', { ...textStyle(), fontSize: HITS_FONT }).setOrigin(1, 0).setScrollFactor(0);
    this.waveText = this.add.text(0, 8, '', textStyle()).setOrigin(0.5, 0);
    for (let i = 0; i < 2; i++) this.panels.push(this.makePanel(PANEL_X + i * (PANEL_W + PANEL_GAP), PANEL_Y));

    this.joyBase = this.add.image(JOY_REST.x, JOY_REST.y, 'ui-stick').setScale(JOY_SCALE).setAlpha(JOY_IDLE_ALPHA);
    this.joyKnob = this.add.image(JOY_REST.x, JOY_REST.y, 'ui-btn').setScale(0.5 * JOY_SCALE).setTint(LAV).setAlpha(JOY_IDLE_ALPHA);

    this.ultRing = this.add.graphics();
    for (const b of BUTTONS) {
      const base = this.add.image(0, 0, 'ui-btn').setScale(BTN_SCALE).setTint(b.color);
      const icon = this.add.image(0, 0, b.icon).setScale(BTN_SCALE);
      this.btns.set(b.id, { base, icon, color: b.color, held: 0 });
    }
    const u = this.btns.get('ult')!;
    this.ultPulse = this.tweens.add({ targets: [u.base, u.icon], scale: { from: BTN_SCALE, to: BTN_SCALE * ULT_PULSE_SCALE }, duration: ULT_PULSE_MS, yoyo: true, repeat: -1, paused: true });
    this.pips = this.add.graphics();
    this.bHint = this.add.text(0, 0, '', textStyle()).setOrigin(1, 0.5);

    this.children.list.forEach(o => { if ('setScrollFactor' in o) (o as Phaser.GameObjects.Image).setScrollFactor(0); });
    this.layout();
    this.scale.on('resize', () => this.layout());

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onDown(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
    this.input.on('pointerupoutside', (p: Phaser.Input.Pointer) => this.onUp(p));

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as any;
    this.runKey = kb.addKey('SHIFT');
    // Автоповтор зажатой клавиши не считается новым нажатием
    const key = (b: Button) => (e: KeyboardEvent) => { if (!e.repeat) this.tap(b); };
    kb.on('keydown-J', key('attack'));
    kb.on('keydown-K', key('heavy'));
    kb.on('keydown-L', key('taunt'));
    kb.on('keydown-U', key('ult'));
    kb.on('keydown-I', key('ult2'));
    // Палец ушёл в системный жест или окно потеряло фокус: отпускаем стик и кнопки
    this.game.events.on('blur', () => this.releaseAll());
  }

  // Панель как в Scott Pilgrim: портрет в рамке, имя, здоровье, шкала ульты
  private makePanel(x: number, y: number): Panel {
    const frame = this.add.image(0, 0, 'ui-frame').setOrigin(0);
    const fw = frame.width, fh = frame.height;
    // Окно рамки 24x24: лицо в масштабе 1:1, под ним фон (у героев без портрета это их цвет)
    const badge = this.add.rectangle(fw / 2, fh / 2, 24, 24, NAVY);
    const portrait = this.add.image(fw / 2, fh / 2, 'ui-face-prime');
    const name = this.add.text(fw + 4, 4, '', textStyle());
    const bars = this.add.graphics();
    const root = this.add.container(x, y, [badge, portrait, frame, name, bars]).setVisible(false);
    return { root, frame, portrait, badge, name, bars };
  }

  private layout() {
    const w = this.scale.width;
    this.waveText.setX(w / 2);
    for (const b of this.activeLayout) {
      const { x, y } = btnPos(b, w);
      const v = this.btns.get(b.id)!;
      v.base.setPosition(x, y);
      v.icon.setPosition(x, y + ICON_Y + v.held * ICON_DROP);
    }
    const h = btnPos(this.activeLayout[1], w);
    this.bHint.setPosition(h.x - HINT_GAP, h.y);
  }

  private tap(b: Button) {
    if (!this.session.hasMe()) return;
    this.session.press(b);
    if (b === 'taunt') this.portraitUntil = this.time.now + PRESS_MS;
    else this.setHeld(b, true);
    this.time.delayedCall(PRESS_MS, () => { if (b !== 'taunt' && ![...this.heldBy.values()].includes(b)) this.setHeld(b, false); });
  }

  // Нажатая кнопка темнеет и проседает, пока палец на ней
  private setHeld(b: Button, on: boolean) {
    const v = this.btns.get(b)!;
    v.held = on ? 1 : 0;
    v.base.setTint(on ? Phaser.Display.Color.ValueToColor(v.color).darken(30).color : v.color);
    v.icon.setY(v.base.y + ICON_Y + v.held * ICON_DROP);
  }

  // Плавающий стик в левой части экрана, кнопки справа; каждый палец сам по себе
  private onDown(p: Phaser.Input.Pointer) {
    const panel = this.panels[0];
    if (this.session.hasMe() && panel.root.visible &&
        p.x >= panel.root.x - PORTRAIT_PAD && p.x <= panel.root.x + panel.frame.width + PORTRAIT_PAD &&
        p.y >= PANEL_Y - PORTRAIT_PAD && p.y <= PANEL_Y + panel.frame.height + PORTRAIT_PAD) {
      this.tap('taunt');
      return;
    }
    // Панель напарника не захватывает стик.
    const partner = this.panels[1];
    if (partner.root.visible && partner.root.getBounds().contains(p.x, p.y)) return;
    if (p.x < this.scale.width * JOY_CAPTURE) {
      if (this.joyId !== -1) return;
      this.joyId = p.id;
      this.joyOrigin.set(p.x, p.y);
      this.joyBase.setPosition(p.x, p.y).setAlpha(0.9);
      this.joyKnob.setPosition(p.x, p.y).setAlpha(1);
      return;
    }
    let best: Button | null = null, bestD = BTN_HIT;
    for (const b of this.activeLayout) {
      const { x, y } = btnPos(b, this.scale.width);
      const d = Phaser.Math.Distance.Between(p.x, p.y, x, y);
      if (d < bestD) { bestD = d; best = b.id; }
    }
    if (best) { this.heldBy.set(p.id, best); this.tap(best); }
  }

  private onMove(p: Phaser.Input.Pointer) {
    if (p.id !== this.joyId) return;
    const v = new Phaser.Math.Vector2(p.x - this.joyOrigin.x, p.y - this.joyOrigin.y);
    if (v.length() > JOY_RADIUS) v.setLength(JOY_RADIUS);
    this.joyKnob.setPosition(this.joyOrigin.x + v.x, this.joyOrigin.y + v.y);
  }

  private onUp(p: Phaser.Input.Pointer) {
    const b = this.heldBy.get(p.id);
    if (b) { this.heldBy.delete(p.id); this.setHeld(b, false); }
    if (p.id !== this.joyId) return;
    this.joyId = -1;
    this.joyBase.setPosition(JOY_REST.x, JOY_REST.y).setAlpha(JOY_IDLE_ALPHA);
    this.joyKnob.setPosition(JOY_REST.x, JOY_REST.y).setAlpha(JOY_IDLE_ALPHA);
  }

  // Иконки кнопок под своего героя (A, U, вторая кнопка); у Нади второй кнопки нет
  private iconsFor = '';
  private setHeroIcons(char: string) {
    if (this.iconsFor === char) return;
    this.iconsFor = char;
    const h = HERO_UI[char];
    this.btns.get('attack')!.icon.setTexture(h ? heroIcon(char, 'icon-attack') : 'ui-icon-attack');
    this.btns.get('ult')!.icon.setTexture(h ? heroIcon(char, 'icon-ult') : 'ui-icon-ult');
    const u2 = this.btns.get('ult2')!;
    u2.icon.setTexture(char === KRIS_ID ? heroIcon(char, 'icon-ball') : 'ui-icon-snow');
    const has2 = char !== NADYA_ID;
    this.activeLayout = LAYOUT[has2 ? 4 : 3];
    this.layout();
    u2.base.setVisible(has2); u2.icon.setVisible(has2);
  }

  // Иконка B показывает следующий удар, размер остаётся общим для всех кнопок.
  private setHeavyIcon(key: string) {
    const icon = this.btns.get('heavy')!.icon;
    if (icon.texture.key === key || !this.textures.exists(key)) return;
    icon.setTexture(key);
    icon.setScale(BTN_SCALE);
  }

  private releaseAll() {
    for (const [id, b] of this.heldBy) { this.heldBy.delete(id); this.setHeld(b, false); }
    if (this.joyId !== -1) this.onUp({ id: this.joyId } as Phaser.Input.Pointer);
  }

  private readMove(): [number, number, boolean] {
    let mx = 0, my = 0;
    this.stickRun = false;
    if (this.joyId !== -1) {
      mx = (this.joyKnob.x - this.joyOrigin.x) / JOY_RADIUS;
      my = (this.joyKnob.y - this.joyOrigin.y) / JOY_RADIUS;
      const len = Math.hypot(mx, my);
      if (len < 0.25) mx = my = 0; // мёртвая зона
      else this.stickRun = len >= RUN_STICK; // стик до упора: бег
    }
    const k = this.keys;
    if (k.A.isDown || k.LEFT.isDown) mx = -1;
    if (k.D.isDown || k.RIGHT.isDown) mx = 1;
    if (k.W.isDown || k.UP.isDown) my = -1;
    if (k.S.isDown || k.DOWN.isDown) my = 1;
    return [Math.round(mx * 10) / 10, Math.round(my * 10) / 10, this.stickRun || this.runKey.isDown];
  }

  // Полоска с контуром и бликом сверху, как у пиксельных HUD
  private bar(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, frac: number, color: number) {
    g.fillStyle(INK).fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle(NAVY).fillRect(x, y, w, h);
    const fw = Math.round(w * Phaser.Math.Clamp(frac, 0, 1));
    if (fw > 0) {
      g.fillStyle(color).fillRect(x, y, fw, h);
      g.fillStyle(0xffffff, 0.35).fillRect(x, y, fw, 1);
    }
  }

  private drawPanel(p: Panel, sb: EntitySnap, me: boolean) {
    p.root.setVisible(true);
    const ch = CHARACTERS.find(c => c.id === sb.char);
    const hero = sb.char === HERO_ID || !!HERO_UI[sb.char ?? ''];
    const ultimate = sb.form === 'ultimate';
    p.portrait.setVisible(hero);
    p.badge.setFillStyle(hero ? NAVY : ch?.color ?? PLUM);
    const face = sb.char === HERO_ID ? (ultimate ? 'ui-face-ultimate' : 'ui-face-prime') : HERO_UI[sb.char ?? ''] ? heroIcon(sb.char!, 'face') : '';
    if (face && p.portrait.texture.key !== face) p.portrait.setTexture(face);
    p.name.setText((ch?.name ?? '?') + (me ? '' : ' 2P')).setColor(colorHex(heroColor(sb.char)));
    const pressed = me && this.time.now < this.portraitUntil;
    p.frame.setTint(pressed ? 0xaaaaaa : 0xffffff).setY(pressed ? PORTRAIT_DROP : 0);
    const g = p.bars.clear();
    const x = p.name.x;
    this.bar(g, x, 16, BAR_W, 6, Math.max(0, sb.hp) / (sb.maxHp ?? PLAYER_HP), HP_COLOR);
    const full = !ultimate && (sb.ult ?? 0) >= 100;
    const flash = full && Math.floor(this.time.now / 160) % 2 === 0;
    this.bar(g, x, 26, BAR_W, 3, ultimate ? (sb.formMs ?? 0) / ULT_MS : (sb.ult ?? 0) / 100, ultimate ? ULTIMATE_COLOR : flash ? CREAM : heroColor(sb.char));
    p.root.setAlpha(sb.connected === false || sb.away ? 0.4 : 1);
  }

  update() {
    const s = this.session;
    if (s.hasMe()) s.move(...this.readMove());
    const last = s.snapshots[s.snapshots.length - 1];
    if (!last) return;
    this.waveText.setText(TEST_TOOLS ? 'ТЕСТ: МАНЕКЕН' : `ВОЛНА ${last.wave}`);

    // Своя панель первая, напарник рядом
    const me = last.players.get(s.me);
    const others = [...last.players].filter(([id]) => id !== s.me).map(([, p]) => p);
    const list = me ? [me, ...others] : others;
    this.panels.forEach((p, i) => list[i] ? this.drawPanel(p, list[i], list[i] === me) : p.root.setVisible(false));

    // U: копится кольцом вокруг кнопки, полная шкала пульсирует, в Ultimate кольцо показывает остаток
    if (me?.char) this.setHeroIcons(me.char);
    const color = heroColor(me?.char);
    const hits = me?.char === HERO_ID ? (me.hitCount ?? 0) : 0;
    this.hitText.setPosition(this.scale.width - 10, HITS_Y).setColor('#' + color.toString(16).padStart(6, '0')).setText(hits >= HITS_SHOW ? `${hits} HITS!` : '');
    if (hits >= HITS_SHOW && hits > this.shownHits) {
      this.tweens.killTweensOf(this.hitText);
      this.hitText.setScale(HITS_PULSE);
      this.tweens.add({ targets: this.hitText, scale: 1, duration: HITS_PULSE_MS });
    }
    this.shownHits = hits;
    this.joyKnob.setTint(color);
    for (const id of ['ult', 'ult2'] as Button[]) {
      const v = this.btns.get(id)!;
      v.color = color;
      this.setHeld(id, !!v.held);
    }
    const u = this.btns.get('ult')!;
    const ultimate = me?.form === 'ultimate';
    const charge = ultimate ? (me?.formMs ?? 0) / ULT_MS : (me?.ult ?? 0) / 100;
    const ready = !!me && !ultimate && charge >= 1;
    u.base.setAlpha(ready || ultimate ? 1 : 0.5);
    u.icon.setAlpha(ready || ultimate ? 1 : 0.5);
    if (ready && this.ultPulse.isPaused()) this.ultPulse.restart(); // с начала, без рывка масштаба
    if (!ready && !this.ultPulse.isPaused()) { this.ultPulse.pause(); u.base.setScale(BTN_SCALE); u.icon.setScale(BTN_SCALE); }
    this.ultRing.clear();
    if (me && charge > 0) {
      const start = -Math.PI / 2;
      this.ultRing.lineStyle(RING_OUTLINE, INK).beginPath().arc(u.base.x, u.base.y, RING_RADIUS, 0, Math.PI * 2).strokePath();
      this.ultRing.lineStyle(RING_LINE, ultimate ? ULTIMATE_COLOR : ready ? CREAM : color)
        .beginPath().arc(u.base.x, u.base.y, RING_RADIUS, start, start + Math.PI * 2 * Math.min(1, charge)).strokePath();
    }

    // Буря: тусклая без полного заряда (шкала общая с U), во время бури кольцо показывает остаток.
    // У Kris на этой кнопке шар: своя шкала копится от попаданий вспышкой
    const s2 = this.btns.get('ult2')!;
    const storm = me?.storm ?? 0;
    const kris = me?.char === KRIS_ID;
    const ready2 = !!me && (kris ? (me.charge2 ?? 0) >= 100 : (me.ult ?? 0) >= 100 && storm <= 0);
    s2.base.setAlpha(ready2 ? 1 : 0.5);
    s2.icon.setAlpha(ready2 ? 1 : 0.5);
    if (kris && (me?.charge2 ?? 0) > 0) {
      const start = -Math.PI / 2;
      this.ultRing.lineStyle(RING_OUTLINE, INK).beginPath().arc(s2.base.x, s2.base.y, RING_RADIUS, 0, Math.PI * 2).strokePath();
      this.ultRing.lineStyle(RING_LINE, ready2 ? CREAM : color).beginPath().arc(s2.base.x, s2.base.y, RING_RADIUS, start, start + Math.PI * 2 * Math.min(1, (me!.charge2 ?? 0) / 100)).strokePath();
    } else if (me?.char === HERO_ID && (storm > 0 || (me.ult ?? 0) > 0)) {
      const start = -Math.PI / 2;
      this.ultRing.lineStyle(RING_OUTLINE, INK).beginPath().arc(s2.base.x, s2.base.y, RING_RADIUS, 0, Math.PI * 2).strokePath();
      this.ultRing.lineStyle(RING_LINE, color).beginPath().arc(s2.base.x, s2.base.y, RING_RADIUS, start, start + Math.PI * 2 * (storm > 0 ? storm / STORM_MS : Math.min(1, (me?.ult ?? 0) / 100))).strokePath();
    }

    // Под A точки серии, слева от B удар, который выйдет сейчас
    this.pips.clear();
    if (me && HERO_UI[me.char ?? '']) {
      const a = this.btns.get('attack')!;
      const n = CHAIN[(me.form ?? 'prime') as keyof typeof CHAIN]?.length ?? 3; // у Kris серия A из двух
      const c = Math.min(me.combo ?? 0, n - 1);
      for (let i = 0; i < n; i++) {
        const x = a.base.x - 4 * n + 2 + i * PIP_STEP, y = a.base.y + PIP_Y;
        this.pips.fillStyle(INK).fillRect(x - 1, y - 1, 6, 6);
        this.pips.fillStyle(color, i < c ? 1 : 0.4).fillRect(x, y, PIP_SIZE, PIP_SIZE);
      }
      if (me.char === NADYA_ID) {
        // Серия B своя: под B тоже точки, иконка и подпись следующего удара
        const hb = this.btns.get('heavy')!;
        const bc = Math.min(me.bCombo ?? 0, 2);
        for (let i = 0; i < 3; i++) {
          const x = hb.base.x - 10 + i * PIP_STEP, y = hb.base.y + PIP_Y;
          this.pips.fillStyle(INK).fillRect(x - 1, y - 1, 6, 6);
          this.pips.fillStyle(color, i < bc ? 1 : 0.4).fillRect(x, y, PIP_SIZE, PIP_SIZE);
        }
        const move = HEAVY.nadya[bc];
        this.bHint.setText(MOVE_NAMES[move] ?? '');
        this.setHeavyIcon(heroIcon(me.char, NADYA_HEAVY_ICON[move]));
      } else {
        this.bHint.setText(MOVE_NAMES.b);
        this.setHeavyIcon(heroIcon(me.char!, 'icon-flash'));
      }
    } else if (me?.char === HERO_ID) {
      const a = this.btns.get('attack')!;
      const c = Math.min(me.combo ?? 0, 2);
      for (let i = 0; i < 3; i++) {
        const x = a.base.x - 10 + i * PIP_STEP, y = a.base.y + PIP_Y;
        this.pips.fillStyle(INK).fillRect(x - 1, y - 1, 6, 6);
        this.pips.fillStyle(color, i < c ? 1 : 0.4).fillRect(x, y, PIP_SIZE, PIP_SIZE);
      }
      const bc = Math.min(me.bCombo ?? 0, 2);
      const hb = this.btns.get('heavy')!;
      for (let i = 0; i < 3; i++) {
        const x = hb.base.x - 10 + i * PIP_STEP, y = hb.base.y + PIP_Y;
        this.pips.fillStyle(INK).fillRect(x - 1, y - 1, 6, 6);
        this.pips.fillStyle(color, i < bc ? 1 : 0.4).fillRect(x, y, PIP_SIZE, PIP_SIZE);
      }
      const move = HEAVY[me.form ?? 'prime'][bc];
      this.bHint.setText(MOVE_NAMES[move] ?? '');
      this.setHeavyIcon('ui-heavy-' + NASTYA_HEAVY_ICON[move]);
    } else {
      this.bHint.setText('');
      this.setHeavyIcon('ui-icon-heavy');
    }
  }
}
