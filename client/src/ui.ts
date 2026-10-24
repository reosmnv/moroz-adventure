import * as Phaser from 'phaser';
import { CHARACTERS, HEAVY, HERO_ID, MOVE_NAMES, PLAYER_HP, TEST_TOOLS, ULT_MS, VIEW_H } from '@bc/shared';
import type { Button, EntitySnap, GameSession } from './session.ts';

// Интерфейс поверх боя: стик, кнопки, панели игроков. Отдельная сцена, поэтому встряска
// и хитстоп боя его не задевают. Координаты экранные: 0..ширина игры, высота 270.

export const FONT = '"Press Start 2P", monospace';
// Пиксельный шрифт чёткий только на кратных 8 размерах
export const textStyle = (size = 8, color = '#d7d1c7') =>
  ({ fontFamily: FONT, fontSize: `${size}px`, color, stroke: '#120c19', strokeThickness: 2 });

// Палитра героини: тёмный контур, сине-фиолетовый, лаванда, кремовый
const INK = 0x120c19, NAVY = 0x2e3049, PLUM = 0x5a495d, LAV = 0x9d74d4, CREAM = 0xd7d1c7;
const HP_COLOR = 0x7bd36b, ULT_COLOR = 0x9d74d4, ULTIMATE_COLOR = 0xff7a1a;

const JOY_RADIUS = 36;
const RUN_STICK = 0.9; // стик отклонён почти до упора: бег
const BTN_HIT = 46; // зона касания больше видимой кнопки
const JOY_REST = { x: 70, y: VIEW_H - 62 }; // где стик ждёт палец (подсказка)

// dx, dy: отступ центра кнопки от правого нижнего угла экрана
const BUTTONS: { id: Button; icon: string; dx: number; dy: number; color: number }[] = [
  { id: 'attack', icon: 'ui-icon-attack', dx: 46, dy: 44, color: 0xe0457b },
  { id: 'heavy', icon: 'ui-icon-heavy', dx: 104, dy: 30, color: 0x5a609a }, // тёмная: на ней читаются огненные иконки
  { id: 'taunt', icon: 'ui-icon-taunt', dx: 38, dy: 104, color: 0x3f8efc },
  { id: 'ult', icon: 'ui-icon-ult', dx: 98, dy: 92, color: 0x9b59ff },
];
const btnPos = (b: { dx: number; dy: number }, w: number) => ({ x: w - b.dx, y: VIEW_H - b.dy });

interface BtnView { base: Phaser.GameObjects.Image; icon: Phaser.GameObjects.Image; color: number; held: number }
interface Panel { root: Phaser.GameObjects.Container; portrait: Phaser.GameObjects.Image; badge: Phaser.GameObjects.Rectangle; name: Phaser.GameObjects.Text; bars: Phaser.GameObjects.Graphics }

const PANEL_W = 138;
const BAR_W = 82;

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
  private bHint!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private panels: Panel[] = [];
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private runKey!: Phaser.Input.Keyboard.Key;
  private stickRun = false;

  constructor() { super('ui'); }

  init(data: { session: GameSession }) { this.session = data.session; }

  preload() {
    for (const k of ['btn', 'stick', 'frame', 'icon-attack', 'icon-heavy', 'icon-ult', 'icon-taunt', 'face-prime', 'face-ultimate']) {
      this.load.image('ui-' + k, `ui/${k}.png`);
    }
    // Своя иконка B на каждый завершающий удар обеих форм
    for (const m of new Set(Object.values(HEAVY).flat())) this.load.image('ui-heavy-' + m, `ui/heavy-${m}.png`);
  }

  create() {
    this.waveText = this.add.text(0, 8, '', textStyle()).setOrigin(0.5, 0);
    for (let i = 0; i < 2; i++) this.panels.push(this.makePanel(6 + i * (PANEL_W + 6), 6));

    this.joyBase = this.add.image(JOY_REST.x, JOY_REST.y, 'ui-stick').setAlpha(0.35);
    this.joyKnob = this.add.image(JOY_REST.x, JOY_REST.y, 'ui-btn').setScale(0.5).setTint(LAV).setAlpha(0.35);

    this.ultRing = this.add.graphics();
    for (const b of BUTTONS) {
      const base = this.add.image(0, 0, 'ui-btn').setTint(b.color);
      const icon = this.add.image(0, 0, b.icon);
      this.btns.set(b.id, { base, icon, color: b.color, held: 0 });
    }
    const u = this.btns.get('ult')!;
    this.ultPulse = this.tweens.add({ targets: [u.base, u.icon], scale: 1.1, duration: 380, yoyo: true, repeat: -1, paused: true });
    this.pips = this.add.graphics();
    this.bHint = this.add.text(0, 0, '', textStyle()).setOrigin(1, 0.5);

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
    return { root, portrait, badge, name, bars };
  }

  private layout() {
    const w = this.scale.width;
    this.waveText.setX(w / 2);
    for (const b of BUTTONS) {
      const { x, y } = btnPos(b, w);
      const v = this.btns.get(b.id)!;
      v.base.setPosition(x, y);
      v.icon.setPosition(x, y - 1 + v.held * 2);
    }
    const h = btnPos(BUTTONS[1], w);
    this.bHint.setPosition(h.x - 30, h.y);
  }

  private tap(b: Button) {
    if (!this.session.hasMe()) return;
    this.session.press(b);
    this.setHeld(b, true);
    this.time.delayedCall(90, () => { if (![...this.heldBy.values()].includes(b)) this.setHeld(b, false); });
  }

  // Нажатая кнопка темнеет и проседает, пока палец на ней
  private setHeld(b: Button, on: boolean) {
    const v = this.btns.get(b)!;
    v.held = on ? 1 : 0;
    v.base.setTint(on ? Phaser.Display.Color.ValueToColor(v.color).darken(30).color : v.color);
    v.icon.setY(v.base.y - 1 + v.held * 2);
  }

  // Плавающий стик в левой части экрана, кнопки справа; каждый палец сам по себе
  private onDown(p: Phaser.Input.Pointer) {
    if (p.x < this.scale.width * 0.45) {
      if (this.joyId !== -1) return;
      this.joyId = p.id;
      this.joyOrigin.set(p.x, p.y);
      this.joyBase.setPosition(p.x, p.y).setAlpha(0.9);
      this.joyKnob.setPosition(p.x, p.y).setAlpha(1);
      return;
    }
    let best: Button | null = null, bestD = BTN_HIT;
    for (const b of BUTTONS) {
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
    this.joyBase.setPosition(JOY_REST.x, JOY_REST.y).setAlpha(0.35);
    this.joyKnob.setPosition(JOY_REST.x, JOY_REST.y).setAlpha(0.35);
  }

  // Иконка B показывает удар, который выйдет сейчас; смена с коротким «щелчком»
  private setHeavyIcon(key: string) {
    const icon = this.btns.get('heavy')!.icon;
    if (icon.texture.key === key || !this.textures.exists(key)) return;
    icon.setTexture(key);
    this.tweens.add({ targets: icon, scale: { from: 1.35, to: 1 }, duration: 140, ease: 'Back.easeOut' });
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
    const hero = sb.char === HERO_ID;
    const ultimate = sb.form === 'ultimate';
    p.portrait.setVisible(hero);
    p.badge.setFillStyle(hero ? NAVY : ch?.color ?? PLUM);
    const face = ultimate ? 'ui-face-ultimate' : 'ui-face-prime';
    if (hero && p.portrait.texture.key !== face) p.portrait.setTexture(face);
    p.name.setText((ch?.name ?? '?') + (me ? '' : ' 2P'));
    const g = p.bars.clear();
    const x = p.name.x;
    this.bar(g, x, 16, BAR_W, 6, Math.max(0, sb.hp) / (sb.maxHp ?? PLAYER_HP), HP_COLOR);
    const full = !ultimate && (sb.ult ?? 0) >= 100;
    const flash = full && Math.floor(this.time.now / 160) % 2 === 0;
    this.bar(g, x, 26, BAR_W, 3, ultimate ? (sb.formMs ?? 0) / ULT_MS : (sb.ult ?? 0) / 100, ultimate ? ULTIMATE_COLOR : flash ? CREAM : ULT_COLOR);
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
    const u = this.btns.get('ult')!;
    const ultimate = me?.form === 'ultimate';
    const charge = ultimate ? (me?.formMs ?? 0) / ULT_MS : (me?.ult ?? 0) / 100;
    const ready = !!me && !ultimate && charge >= 1;
    u.base.setAlpha(ready || ultimate ? 1 : 0.5);
    u.icon.setAlpha(ready || ultimate ? 1 : 0.5);
    if (ready && this.ultPulse.isPaused()) this.ultPulse.restart(); // с начала, без рывка масштаба
    if (!ready && !this.ultPulse.isPaused()) { this.ultPulse.pause(); u.base.setScale(1); u.icon.setScale(1); }
    this.ultRing.clear();
    if (me && charge > 0) {
      const start = -Math.PI / 2;
      this.ultRing.lineStyle(5, INK).beginPath().arc(u.base.x, u.base.y, 27, 0, Math.PI * 2).strokePath();
      this.ultRing.lineStyle(3, ultimate ? ULTIMATE_COLOR : ready ? CREAM : ULT_COLOR)
        .beginPath().arc(u.base.x, u.base.y, 27, start, start + Math.PI * 2 * Math.min(1, charge)).strokePath();
    }

    // Под A точки серии, слева от B удар, который выйдет сейчас
    this.pips.clear();
    if (me?.char === HERO_ID) {
      const a = this.btns.get('attack')!;
      const c = Math.min(me.combo ?? 0, 2);
      for (let i = 0; i < 3; i++) {
        const x = a.base.x - 10 + i * 8, y = a.base.y + 27;
        this.pips.fillStyle(INK).fillRect(x - 1, y - 1, 6, 6);
        this.pips.fillStyle(i < c ? CREAM : NAVY).fillRect(x, y, 4, 4);
      }
      const move = HEAVY[me.form ?? 'prime'][c];
      this.bHint.setText(MOVE_NAMES[move] ?? '');
      this.setHeavyIcon('ui-heavy-' + move);
    } else {
      this.bHint.setText('');
      this.setHeavyIcon('ui-icon-heavy');
    }
  }
}
