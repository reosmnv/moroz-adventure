import * as Phaser from 'phaser';
import { CHARACTERS, TEST_TOOLS, HEAVY, HERO_ANIMS, HERO_ID, MOVE_NAMES, LANE_BOTTOM, LANE_TOP, TICK_MS, ULT_MS, VIEW_H, VIEW_W, dirOf, type Form, type SimEvent } from '@bc/shared';
import type { Button, EntitySnap, GameSession, Snapshot } from './session.ts';
import { beep } from './audio.ts';

const INTERP_MS = 100; // буфер интерполяции: рисуем мир на 100 мс в прошлом
const JOY_RADIUS = 36;
const BTN_HIT = 46; // зона касания больше видимой кнопки
const CELL = 128; // кадр спрайта героини
const FEET_Y = 112; // ступни в кадре
const SCALE = 1.5; // героиня крупнее исходных 128 px по просьбе mr.R
const HEAD = 62 * SCALE; // высота над ступнями для полоски жизни и имени
const RUN_STICK = 0.9; // стик отклонён почти до упора: бег

interface View { sprite?: Phaser.GameObjects.Image; shadow?: Phaser.GameObjects.Ellipse; body: Phaser.GameObjects.Rectangle; fist: Phaser.GameObjects.Rectangle; label?: Phaser.GameObjects.Text; hp: Phaser.GameObjects.Rectangle; bubble?: Phaser.GameObjects.Text }

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
  private aHint!: Phaser.GameObjects.Text;
  private bHint!: Phaser.GameObjects.Text;
  private runKey!: Phaser.Input.Keyboard.Key;
  private stickRun = false;

  constructor() { super('game'); }

  preload() {
    for (const form of Object.keys(HERO_ANIMS) as Form[]) {
      for (const name of Object.keys(HERO_ANIMS[form])) {
        for (const d of ['east', 'west']) {
          this.load.spritesheet(`${form}/${name}-${d}`, `sprites/${form}/${name}-${d}.png`, { frameWidth: CELL, frameHeight: CELL });
        }
      }
    }
  }

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
    const hint = { fontSize: '10px', color: '#fff', stroke: '#000', strokeThickness: 3 };
    this.aHint = this.add.text(0, 0, '', hint).setOrigin(0.5, 0).setDepth(2001).setScrollFactor(0);
    this.bHint = this.add.text(0, 0, '', hint).setOrigin(1, 0.5).setDepth(2001).setScrollFactor(0);
    this.layout();
    this.scale.on('resize', () => this.layout());

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onDown(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
    this.input.on('pointerupoutside', (p: Phaser.Input.Pointer) => this.onUp(p));

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as any;
    this.runKey = kb.addKey('SHIFT');
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
      if (b.id === 'attack') this.aHint.setPosition(x, y + 25);
      if (b.id === 'heavy') this.bHint.setPosition(x - 26, y);
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

  private onEvents(evs: SimEvent[]) {
    for (const e of evs) {
      if (e.t === 'hit') {
        const t = this.add.text(e.x, e.y - 70, '-' + e.dmg, { fontSize: '11px', color: '#ff6' }).setOrigin(0.5).setDepth(1500);
        this.tweens.add({ targets: t, y: t.y - 16, alpha: 0, duration: 500, onComplete: () => t.destroy() });
        if (e.target.startsWith('e') && e.dmg >= 18) this.cameras.main.shake(90, 0.004); // сильный удар встряхивает кадр
        beep(e.target.startsWith('e') ? 520 : 180, 0.05);
      } else if (e.t === 'taunt') {
        const v = this.views.get('p:' + e.id);
        if (v) {
          v.bubble?.destroy();
          v.bubble = this.add.text(v.body.x, v.body.y - HEAD - 18, e.line, { fontSize: '11px', color: '#000', backgroundColor: '#fff', padding: { x: 4, y: 2 } }).setOrigin(0.5).setDepth(1600);
          const b = v.bubble;
          this.time.delayedCall(2000, () => { b.destroy(); if (v.bubble === b) v.bubble = undefined; });
        }
        beep(880, 0.08);
      } else if (e.t === 'ult') {
        const v = this.views.get('p:' + e.id);
        if (v) {
          const c = this.add.circle(v.body.x, v.body.y - 45, 20, 0x9b59ff, 0.5).setDepth(1400);
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
      const color = isPlayer ? (ch?.color ?? 0xffffff) : snap.dummy ? 0xb08d57 : 0x8a8f98;
      v = {
        body: this.add.rectangle(0, 0, 30, isPlayer ? 82 : 75, color).setOrigin(0.5, 1),
        fist: this.add.rectangle(0, 0, 10, 5, 0xffffff).setVisible(false),
        hp: this.add.rectangle(0, 0, 40, 3, isPlayer ? 0x4cd964 : 0xff3b30).setOrigin(0, 0.5),
      };
      if (isPlayer && snap.char === HERO_ID) {
        v.body.setVisible(false);
        v.shadow = this.add.ellipse(0, 0, 38 * SCALE, 9 * SCALE, 0x000000, 0.3);
        v.sprite = this.add.image(0, 0, 'prime/idle-east', 0).setOrigin(0.5, FEET_Y / CELL).setScale(SCALE);
      }
      if (isPlayer) {
        const me = key === 'p:' + this.session.me;
        v.label = this.add.text(0, 0, (ch?.name ?? '?') + (me ? ' (я)' : ''), { fontSize: '10px', color: '#fff' }).setOrigin(0.5, 1);
      }
      this.views.set(key, v);
    }
    return v;
  }

  // Кадр героини из снимка: анимация по имени и времени с её начала, east/west отдельными полосами
  private drawHero(v: View, sb: EntitySnap, x: number, y: number, f: number, away: boolean) {
    const form = sb.form ?? 'prime';
    const dir = dirOf(sb.facing);
    let move = sb.move ?? 'idle';
    if (!HERO_ANIMS[form][move]) move = 'idle';
    const def = HERO_ANIMS[form][move];
    const n = def[dir];
    const t = Math.max(0, (sb.moveT ?? 0) - (1 - f) * TICK_MS);
    const raw = Math.floor((t * def.fps) / 1000);
    const frame = def.loop ? raw % n : Math.min(n - 1, raw);
    const sprite = v.sprite!;
    sprite.setTexture(`${form}/${move}-${dir}`, frame).setPosition(x, y).setDepth(y);
    // Неуязвимость после удара мигает; во время превращения не мигает, там своя анимация
    const blink = sb.invuln && form === 'prime' && !move.startsWith('transform') && move !== 'getup' && Math.floor(this.time.now / 70) % 2 === 0;
    sprite.setAlpha(away ? 0.35 : blink ? 0.45 : 1);
    v.shadow!.setPosition(x, y).setDepth(y - 0.1).setAlpha(away ? 0.1 : 0.3);
  }

  update() {
    const [mx, my, run] = this.readMove();
    if (this.session.hasMe()) this.session.move(mx, my, run);

    const smp = this.sample();
    if (!smp) return;
    const { a, b, f } = smp;
    const seen = new Set<string>();
    const draw = (key: string, isPlayer: boolean, sa: EntitySnap | undefined, sb: EntitySnap) => {
      seen.add(key);
      const x = sa ? sa.x + (sb.x - sa.x) * f : sb.x;
      const y = sa ? sa.y + (sb.y - sa.y) * f : sb.y;
      const v = this.viewFor(key, isPlayer, sb);
      const down = sb.anim === 'down' && !v.sprite;
      v.body.setPosition(x, y).setDepth(y).setAngle(down ? 90 * sb.facing : 0);
      const away = sb.connected === false || sb.away;
      v.body.setAlpha(away ? 0.35 : 1);
      if (v.sprite) {
        this.drawHero(v, sb, x, y, f, !!away);
      }
      v.body.setFillStyle(sb.anim === 'hurt' ? 0xffffff : (isPlayer ? (CHARACTERS.find(c => c.id === sb.char)?.color ?? 0xffffff) : sb.dummy ? 0xb08d57 : 0x8a8f98));
      const hitting = !v.sprite && (sb.anim === 'attack' || sb.anim === 'heavy');
      v.fist.setVisible(hitting).setPosition(x + sb.facing * (sb.anim === 'heavy' ? 16 : 12), y - 18).setSize(sb.anim === 'heavy' ? 14 : 10, 5).setDepth(y + 0.5);
      const maxHp = sb.maxHp ?? 100;
      const head = v.sprite ? HEAD : isPlayer ? 86 : 80;
      v.hp.setPosition(x - 20, y - head).setDepth(y + 0.6).setSize(40 * Math.max(0, sb.hp) / maxHp, 3);
      v.label?.setPosition(x, y - head - 3).setDepth(y + 0.7);
      v.bubble?.setPosition(x, y - HEAD - 18);
    };
    for (const [id, sb] of b.players) draw('p:' + id, true, a.players.get(id), sb);
    for (const [id, sb] of b.enemies) draw('e:' + id, false, a.enemies.get(id), sb);
    for (const [key, v] of this.views) {
      if (seen.has(key)) continue;
      v.sprite?.destroy(); v.shadow?.destroy(); v.body.destroy(); v.fist.destroy(); v.hp.destroy(); v.label?.destroy(); v.bubble?.destroy();
      this.views.delete(key);
    }
    const me = b.players.get(this.session.me);
    const ultimate = me?.form === 'ultimate';
    this.ultBar.setSize(me ? (ultimate ? 100 * Math.max(0, me.formMs ?? 0) / ULT_MS : me.ult ?? 0) : 0, 6);
    this.ultBar.setFillStyle(ultimate ? 0xff7a1a : 0x9b59ff);
    this.waveText.setText(TEST_TOOLS ? 'Тест: манекен' : `Волна ${b.wave}`);
    // Подсказки к кнопкам: сколько ударов серии набрано и что даст B прямо сейчас
    if (me?.char === HERO_ID) {
      const c = Math.min(me.combo ?? 0, 2);
      this.aHint.setText('●'.repeat(c) + '○'.repeat(3 - c));
      this.bHint.setText(MOVE_NAMES[HEAVY[me.form ?? 'prime'][c]] ?? '');
    } else {
      this.aHint.setText('');
      this.bHint.setText('');
    }
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
