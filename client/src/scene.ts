import * as Phaser from 'phaser';
import { CHARACTERS, LANE_BOTTOM, LANE_TOP, VIEW_H, VIEW_W, type SimEvent } from '@bc/shared';
import type { Button, EntitySnap, GameSession, Snapshot } from './session.ts';
import { beep } from './audio.ts';

const INTERP_MS = 100; // буфер интерполяции: рисуем мир на 100 мс в прошлом
const JOY_RADIUS = 36;
const BTN_HIT = 46; // зона касания больше видимой кнопки

interface View { body: Phaser.GameObjects.Rectangle; fist: Phaser.GameObjects.Rectangle; label?: Phaser.GameObjects.Text; hp: Phaser.GameObjects.Rectangle; bubble?: Phaser.GameObjects.Text }

// dx, dy: отступ от правого нижнего угла экрана
const BUTTONS: { id: Button; label: string; dx: number; dy: number; color: number }[] = [
  { id: 'attack', label: 'A', dx: 50, dy: 45, color: 0xe0457b },
  { id: 'heavy', label: 'B', dx: 105, dy: 30, color: 0xf2a541 },
  { id: 'taunt', label: '😜', dx: 40, dy: 105, color: 0x3f8efc },
  { id: 'ult', label: 'U', dx: 100, dy: 90, color: 0x9b59ff },
];
const btnPos = (b: { dx: number; dy: number }, w: number) => ({ x: w - b.dx, y: VIEW_H - b.dy });

export class GameScene extends Phaser.Scene {
  session!: GameSession;
  private views = new Map<string, View>();
  private joyId = -1;
  private joyOrigin = new Phaser.Math.Vector2();
  private joyBase!: Phaser.GameObjects.Arc;
  private joyKnob!: Phaser.GameObjects.Arc;
  private btnViews = new Map<Button, Phaser.GameObjects.Arc>();
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private ultBar!: Phaser.GameObjects.Rectangle;
  private ultBg!: Phaser.GameObjects.Rectangle;
  private btnLabels = new Map<Button, Phaser.GameObjects.Text>();
  private waveText!: Phaser.GameObjects.Text;

  constructor() { super('game'); }

  init(data: { session: GameSession }) { this.session = data.session; }

  create() {
    // Фон шире мира: на вытянутом экране по бокам не чёрные поля, а продолжение сцены
    this.add.rectangle(VIEW_W / 2, VIEW_H / 2, VIEW_W * 3, VIEW_H, 0x1b1f33);
    this.add.rectangle(VIEW_W / 2, (LANE_TOP + LANE_BOTTOM) / 2 + 8, VIEW_W * 3, LANE_BOTTOM - LANE_TOP + 40, 0x2c3350);
    this.waveText = this.add.text(0, 6, '', { fontSize: '12px', color: '#fff' }).setOrigin(0.5, 0).setDepth(1000).setScrollFactor(0);
    this.ultBg = this.add.rectangle(0, 26, 102, 8, 0x000000).setDepth(1000).setScrollFactor(0);
    this.ultBar = this.add.rectangle(0, 26, 0, 6, 0x9b59ff).setOrigin(0, 0.5).setDepth(1001).setScrollFactor(0);

    this.joyBase = this.add.circle(0, 0, JOY_RADIUS, 0xffffff, 0.12).setStrokeStyle(2, 0xffffff, 0.4).setDepth(2000).setVisible(false).setScrollFactor(0);
    this.joyKnob = this.add.circle(0, 0, 16, 0xffffff, 0.45).setDepth(2001).setVisible(false).setScrollFactor(0);
    for (const b of BUTTONS) {
      const c = this.add.circle(0, 0, 22, b.color, 0.55).setStrokeStyle(2, 0xffffff, 0.6).setDepth(2000).setScrollFactor(0);
      const t = this.add.text(0, 0, b.label, { fontSize: '16px', color: '#fff' }).setOrigin(0.5).setDepth(2001).setScrollFactor(0);
      this.btnViews.set(b.id, c);
      this.btnLabels.set(b.id, t);
    }
    this.layout();
    this.scale.on('resize', () => this.layout());

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onDown(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
    this.input.on('pointerupoutside', (p: Phaser.Input.Pointer) => this.onUp(p));

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as any;
    kb.on('keydown-J', () => this.press('attack'));
    kb.on('keydown-K', () => this.press('heavy'));
    kb.on('keydown-L', () => this.press('taunt'));
    kb.on('keydown-U', () => this.press('ult'));

    this.session.onEvents = evs => this.onEvents(evs);
  }

  // Раскладка под текущую ширину экрана: мир по центру, кнопки у правого края
  private layout() {
    const w = this.scale.width;
    this.cameras.main.setScroll((VIEW_W - w) / 2, 0);
    this.waveText.setX(w / 2);
    this.ultBg.setX(w / 2);
    this.ultBar.setX(w / 2 - 50);
    for (const b of BUTTONS) {
      const { x, y } = btnPos(b, w);
      this.btnViews.get(b.id)!.setPosition(x, y);
      this.btnLabels.get(b.id)!.setPosition(x, y);
    }
  }

  private press(b: Button) {
    this.session.press(b);
    const v = this.btnViews.get(b);
    if (v) { v.setScale(0.85); this.time.delayedCall(90, () => v.setScale(1)); }
  }

  // Плавающий джойстик в левой половине, кнопки справа; каждый палец сам по себе
  private onDown(p: Phaser.Input.Pointer) {
    if (p.x < this.scale.width * 0.45) {
      if (this.joyId !== -1) return;
      this.joyId = p.id;
      this.joyOrigin.set(p.x, p.y);
      this.joyBase.setPosition(p.x, p.y).setVisible(true);
      this.joyKnob.setPosition(p.x, p.y).setVisible(true);
      return;
    }
    let best: Button | null = null, bestD = BTN_HIT;
    for (const b of BUTTONS) {
      const { x, y } = btnPos(b, this.scale.width);
      const d = Phaser.Math.Distance.Between(p.x, p.y, x, y);
      if (d < bestD) { bestD = d; best = b.id; }
    }
    if (best) this.press(best);
  }

  private onMove(p: Phaser.Input.Pointer) {
    if (p.id !== this.joyId) return;
    const v = new Phaser.Math.Vector2(p.x - this.joyOrigin.x, p.y - this.joyOrigin.y);
    if (v.length() > JOY_RADIUS) v.setLength(JOY_RADIUS);
    this.joyKnob.setPosition(this.joyOrigin.x + v.x, this.joyOrigin.y + v.y);
  }

  private onUp(p: Phaser.Input.Pointer) {
    if (p.id !== this.joyId) return;
    this.joyId = -1;
    this.joyBase.setVisible(false);
    this.joyKnob.setVisible(false);
  }

  private readMove(): [number, number] {
    let mx = 0, my = 0;
    if (this.joyId !== -1) {
      mx = (this.joyKnob.x - this.joyOrigin.x) / JOY_RADIUS;
      my = (this.joyKnob.y - this.joyOrigin.y) / JOY_RADIUS;
      if (Math.hypot(mx, my) < 0.25) mx = my = 0; // мёртвая зона
    }
    const k = this.keys;
    if (k.A.isDown || k.LEFT.isDown) mx = -1;
    if (k.D.isDown || k.RIGHT.isDown) mx = 1;
    if (k.W.isDown || k.UP.isDown) my = -1;
    if (k.S.isDown || k.DOWN.isDown) my = 1;
    return [Math.round(mx * 10) / 10, Math.round(my * 10) / 10];
  }

  private onEvents(evs: SimEvent[]) {
    for (const e of evs) {
      if (e.t === 'hit') {
        const t = this.add.text(e.x, e.y - 40, '-' + e.dmg, { fontSize: '11px', color: '#ff6' }).setOrigin(0.5).setDepth(1500);
        this.tweens.add({ targets: t, y: t.y - 16, alpha: 0, duration: 500, onComplete: () => t.destroy() });
        beep(e.target.startsWith('e') ? 520 : 180, 0.05);
      } else if (e.t === 'taunt') {
        const v = this.views.get('p:' + e.id);
        if (v) {
          v.bubble?.destroy();
          v.bubble = this.add.text(v.body.x, v.body.y - 52, e.line, { fontSize: '11px', color: '#000', backgroundColor: '#fff', padding: { x: 4, y: 2 } }).setOrigin(0.5).setDepth(1600);
          const b = v.bubble;
          this.time.delayedCall(2000, () => { b.destroy(); if (v.bubble === b) v.bubble = undefined; });
        }
        beep(880, 0.08);
      } else if (e.t === 'ult') {
        const v = this.views.get('p:' + e.id);
        if (v) {
          const c = this.add.circle(v.body.x, v.body.y, 20, 0x9b59ff, 0.5).setDepth(1400);
          this.tweens.add({ targets: c, scale: 7, alpha: 0, duration: 450, onComplete: () => c.destroy() });
        }
        beep(220, 0.3);
      } else if (e.t === 'restart') {
        this.cameras.main.flash(300, 255, 0, 0);
      }
    }
  }

  // Позиция между двумя снимками вокруг момента «сейчас минус буфер»
  private sample(): { a: Snapshot; b: Snapshot; f: number } | null {
    const s = this.session.snapshots;
    if (s.length === 0) return null;
    const rt = performance.now() - INTERP_MS;
    for (let i = s.length - 1; i > 0; i--) {
      if (s[i - 1].t <= rt) {
        const a = s[i - 1], b = s[i];
        return { a, b, f: Math.min(1, Math.max(0, (rt - a.t) / (b.t - a.t || 1))) };
      }
    }
    return { a: s[0], b: s[0], f: 0 };
  }

  private viewFor(key: string, isPlayer: boolean, snap: EntitySnap): View {
    let v = this.views.get(key);
    if (!v) {
      const ch = CHARACTERS.find(c => c.id === snap.char);
      const color = isPlayer ? (ch?.color ?? 0xffffff) : 0x8a8f98;
      v = {
        body: this.add.rectangle(0, 0, 16, isPlayer ? 30 : 26, color).setOrigin(0.5, 1),
        fist: this.add.rectangle(0, 0, 10, 5, 0xffffff).setVisible(false),
        hp: this.add.rectangle(0, 0, 18, 3, isPlayer ? 0x4cd964 : 0xff3b30).setOrigin(0, 0.5),
      };
      if (isPlayer) {
        const me = key === 'p:' + this.session.me;
        v.label = this.add.text(0, 0, (ch?.name ?? '?') + (me ? ' (я)' : ''), { fontSize: '10px', color: '#fff' }).setOrigin(0.5, 1);
      }
      this.views.set(key, v);
    }
    return v;
  }

  update() {
    const [mx, my] = this.readMove();
    if (this.session.hasMe()) this.session.move(mx, my);

    const smp = this.sample();
    if (!smp) return;
    const { a, b, f } = smp;
    const seen = new Set<string>();
    const draw = (key: string, isPlayer: boolean, sa: EntitySnap | undefined, sb: EntitySnap) => {
      seen.add(key);
      const x = sa ? sa.x + (sb.x - sa.x) * f : sb.x;
      const y = sa ? sa.y + (sb.y - sa.y) * f : sb.y;
      const v = this.viewFor(key, isPlayer, sb);
      const down = sb.anim === 'down';
      v.body.setPosition(x, y).setDepth(y).setAngle(down ? 90 * sb.facing : 0);
      v.body.setAlpha(sb.connected === false || sb.away ? 0.35 : 1);
      v.body.setFillStyle(sb.anim === 'hurt' ? 0xffffff : (isPlayer ? (CHARACTERS.find(c => c.id === sb.char)?.color ?? 0xffffff) : 0x8a8f98));
      const hitting = sb.anim === 'attack' || sb.anim === 'heavy';
      v.fist.setVisible(hitting).setPosition(x + sb.facing * (sb.anim === 'heavy' ? 16 : 12), y - 18).setSize(sb.anim === 'heavy' ? 14 : 10, 5).setDepth(y + 0.5);
      const maxHp = sb.maxHp ?? 100;
      v.hp.setPosition(x - 9, y - (isPlayer ? 34 : 30)).setDepth(y + 0.6).setSize(18 * Math.max(0, sb.hp) / maxHp, 3);
      v.label?.setPosition(x, y - 36).setDepth(y + 0.7);
      v.bubble?.setPosition(x, y - 52);
    };
    for (const [id, sb] of b.players) draw('p:' + id, true, a.players.get(id), sb);
    for (const [id, sb] of b.enemies) draw('e:' + id, false, a.enemies.get(id), sb);
    for (const [key, v] of this.views) {
      if (seen.has(key)) continue;
      v.body.destroy(); v.fist.destroy(); v.hp.destroy(); v.label?.destroy(); v.bubble?.destroy();
      this.views.delete(key);
    }
    const me = b.players.get(this.session.me);
    this.ultBar.setSize(me ? me.ult ?? 0 : 0, 6);
    this.waveText.setText(`Волна ${b.wave}`);
  }
}

// Высота мира фиксирована, ширина повторяет пропорции видимой области (iPhone в Safari ~3:1)
function viewWidth(): number {
  const el = document.getElementById('game')!;
  const aspect = el.clientWidth / Math.max(1, el.clientHeight);
  return Math.round(Math.min(Math.max(VIEW_H * aspect, VIEW_W), VIEW_H * 3));
}

export function startGame(parent: string, session: GameSession): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: viewWidth(),
    height: VIEW_H,
    backgroundColor: '#111111',
    pixelArt: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 4 },
    scene: [],
    callbacks: {
      postBoot: game => { game.scene.add('game', GameScene, true, { session }); },
    },
  });
  // Поворот, появление/исчезновение панелей Safari: подгоняем ширину
  const refit = () => game.scale.setGameSize(viewWidth(), VIEW_H);
  window.addEventListener('resize', () => setTimeout(refit, 100));
  return game;
}
