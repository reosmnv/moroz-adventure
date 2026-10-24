import * as Phaser from 'phaser';
import { AIR_MS, PLAYER_HP, STORM_RADIUS, CHARACTERS, moveSpeed, HERO_ANIMS, HERO_ID, LANE_BOTTOM, LANE_TOP, TICK_MS, VIEW_H, VIEW_W, dirOf, type Form, type SimEvent } from '@bc/shared';
import type { EntitySnap, GameSession, Snapshot } from './session.ts';
import { beep } from './audio.ts';
import { FONT, UIScene, textStyle } from './ui.ts';

const INTERP_MS = 60; // буфер интерполяции чужих и врагов: мир на 60 мс в прошлом. Свою героиню рисуем без отставания
const CELL = 128; // кадр спрайта героини
const FEET_Y = 112; // ступни в кадре
const SCALE = 1.5; // героиня крупнее исходных 128 px по просьбе mr.R
const HEAD = 62 * SCALE; // высота над ступнями для полоски жизни и имени
const LAUNCH_H = 90; // высота подброса апперкотом, px
const FLAKES = 90; // снежинок в буре
const ICE = 0x66b8ff; // цвет замороженного врага

interface Storm { zone: Phaser.GameObjects.Ellipse; flakes: Phaser.GameObjects.Rectangle[]; seed: number[] }
interface View { storm?: Storm; sprite?: Phaser.GameObjects.Image; shadow?: Phaser.GameObjects.Ellipse; body: Phaser.GameObjects.Rectangle; fist: Phaser.GameObjects.Rectangle; label?: Phaser.GameObjects.Text; hp: Phaser.GameObjects.Rectangle; bubble?: Phaser.GameObjects.Text }

export class GameScene extends Phaser.Scene {
  session!: GameSession;
  private views = new Map<string, View>();
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
    this.layout();
    this.scale.on('resize', () => this.layout());
    this.session.onEvents = evs => this.onEvents(evs);
  }

  // Мир по центру вытянутого экрана; интерфейс в отдельной сцене ui.ts
  private layout() {
    this.cameras.main.setScroll((VIEW_W - this.scale.width) / 2, 0);
  }

  private onEvents(evs: SimEvent[]) {
    for (const e of evs) {
      if (e.t === 'hit') {
        const t = this.add.text(e.x, e.y - 70, '-' + e.dmg, textStyle(8, '#ffd84a')).setOrigin(0.5).setDepth(1500);
        this.tweens.add({ targets: t, y: t.y - 16, alpha: 0, duration: 500, onComplete: () => t.destroy() });
        if (e.target.startsWith('e') && e.dmg >= 18) this.cameras.main.shake(90, 0.004); // сильный удар встряхивает кадр
        beep(e.target.startsWith('e') ? 520 : 180, 0.05);
      } else if (e.t === 'heal') {
        const v = this.views.get('p:' + e.id);
        if (v) {
          const t = this.add.text(v.body.x, v.body.y - HEAD - 10, '+' + e.amount, textStyle(8, '#7bd36b')).setOrigin(0.5).setDepth(1500);
          this.tweens.add({ targets: t, y: t.y - 18, alpha: 0, duration: 600, onComplete: () => t.destroy() });
        }
      } else if (e.t === 'taunt') {
        const v = this.views.get('p:' + e.id);
        if (v) {
          v.bubble?.destroy();
          v.bubble = this.add.text(v.body.x, v.body.y - HEAD - 18, e.line, { fontFamily: FONT, fontSize: '8px', color: '#120c19', backgroundColor: '#d7d1c7', padding: { x: 4, y: 3 }, wordWrap: { width: 150 }, align: 'center' }).setOrigin(0.5).setDepth(1600);
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
      } else if (e.t === 'storm') {
        const v = this.views.get('p:' + e.id);
        if (v) {
          // Кольцо холода расходится до края зоны
          const ring = this.add.circle(v.body.x, v.body.y, 10, 0xbfe9ff, 0.25).setStrokeStyle(2, 0xe8f8ff).setDepth(1400).setScale(1, 0.4);
          this.tweens.add({ targets: ring, scaleX: STORM_RADIUS / 10, scaleY: STORM_RADIUS / 10 * 0.4, alpha: 0, duration: 500, onComplete: () => ring.destroy() });
        }
        beep(660, 0.12);
        this.time.delayedCall(120, () => beep(990, 0.12));
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
      if (!isPlayer) v.shadow = this.add.ellipse(0, 0, 34, 8, 0x000000, 0.3);
      if (isPlayer && snap.char === HERO_ID) {
        v.body.setVisible(false);
        v.shadow = this.add.ellipse(0, 0, 38 * SCALE, 9 * SCALE, 0x000000, 0.3);
        v.sprite = this.add.image(0, 0, 'prime/idle-east', 0).setOrigin(0.5, FEET_Y / CELL).setScale(SCALE);
      }
      if (isPlayer) {
        const me = key === 'p:' + this.session.me;
        // Имя и здоровье своей героини в панели HUD, над головой только метка игрока
        v.label = this.add.text(0, 0, me ? '1P' : (ch?.name ?? '2P'), textStyle(8, me ? '#f2a541' : '#d7d1c7')).setOrigin(0.5, 1);
        if (me) v.hp.setVisible(false);
      }
      this.views.set(key, v);
    }
    return v;
  }

  // Снежная буря: ледяной овал на земле и падающий снег по всей зоне, пока идёт заклинание
  private drawStorm(v: View, sb: EntitySnap, x: number, y: number) {
    if ((sb.storm ?? 0) <= 0) {
      if (v.storm) { v.storm.zone.destroy(); v.storm.flakes.forEach(f => f.destroy()); v.storm = undefined; }
      return;
    }
    if (!v.storm) {
      const zone = this.add.ellipse(0, 0, STORM_RADIUS * 2, STORM_RADIUS * 0.7, 0xbfe9ff, 0.16).setStrokeStyle(1, 0xe8f8ff, 0.5);
      const flakes: Phaser.GameObjects.Rectangle[] = [];
      const seed: number[] = [];
      for (let i = 0; i < FLAKES; i++) {
        flakes.push(this.add.rectangle(0, 0, i % 3 === 0 ? 3 : 2, i % 3 === 0 ? 3 : 2, 0xffffff, 0.9));
        seed.push(Math.random(), Math.random(), 0.6 + Math.random() * 0.8);
      }
      v.storm = { zone, flakes, seed };
    }
    const now = this.time.now / 1000;
    v.storm.zone.setPosition(x, y).setDepth(y - 0.2).setAlpha(0.12 + 0.05 * Math.sin(now * 6));
    v.storm.flakes.forEach((f, i) => {
      const [sx, sy, sp] = [v.storm!.seed[i * 3], v.storm!.seed[i * 3 + 1], v.storm!.seed[i * 3 + 2]];
      const fall = (sy * 170 + now * 70 * sp) % 170; // 0..170 вниз
      const drift = Math.sin(now * 2 + sx * 9) * 8;
      f.setPosition(x + (sx * 2 - 1) * STORM_RADIUS + drift, y - 140 + fall + (sx - 0.5) * 20).setDepth(2000);
    });
  }

  // Кадр героини из снимка: анимация по имени и времени с её начала, east/west отдельными полосами
  private drawHero(v: View, sb: EntitySnap, x: number, y: number, f: number, away: boolean, lead = 0) {
    const form = sb.form ?? 'prime';
    const dir = dirOf(sb.facing);
    let move = sb.move ?? 'idle';
    if (!HERO_ANIMS[form][move]) move = 'idle';
    const def = HERO_ANIMS[form][move];
    const n = def[dir];
    const t = Math.max(0, (sb.moveT ?? 0) - (1 - f) * TICK_MS + lead);
    const raw = Math.floor((t * def.fps * moveSpeed(form, move)) / 1000);
    const frame = def.loop ? raw % n : Math.min(n - 1, raw);
    const sprite = v.sprite!;
    sprite.setTexture(`${form}/${move}-${dir}`, frame).setPosition(x, y).setDepth(y);
    // Неуязвимость после удара мигает; во время превращения не мигает, там своя анимация
    const blink = sb.invuln && form === 'prime' && !move.startsWith('transform') && move !== 'getup' && Math.floor(this.time.now / 70) % 2 === 0;
    sprite.setAlpha(away ? 0.35 : blink ? 0.45 : 1);
    v.shadow!.setPosition(x, y).setDepth(y - 0.1).setAlpha(away ? 0.1 : 0.3);
  }

  update() {
    const smp = this.sample();
    if (!smp) return;
    const { a, b, f } = smp;
    const seen = new Set<string>();
    const draw = (key: string, isPlayer: boolean, sa: EntitySnap | undefined, sb: EntitySnap, live = false) => {
      seen.add(key);
      const x = sa && !live ? sa.x + (sb.x - sa.x) * f : sb.x;
      const y = sa && !live ? sa.y + (sb.y - sa.y) * f : sb.y;
      const v = this.viewFor(key, isPlayer, sb);
      const down = sb.anim === 'down' && !v.sprite;
      // Подброшенный враг летит по дуге; тень остаётся на земле
      const u = sb.air ? 1 - sb.air / AIR_MS : 1;
      const lift = sb.air ? 4 * LAUNCH_H * u * (1 - u) : 0;
      if (!isPlayer && v.shadow) v.shadow.setPosition(x, y).setDepth(y - 0.1).setScale(1 - lift / 200);
      v.body.setPosition(x, y - lift).setDepth(y).setAngle(down ? 90 * sb.facing : 0);
      const away = sb.connected === false || sb.away;
      v.body.setAlpha(away ? 0.35 : 1);
      if (v.sprite) {
        const lead = live ? Math.min(TICK_MS, performance.now() - this.session.snapshots[this.session.snapshots.length - 1].t) : 0;
        this.drawHero(v, sb, x, y, live ? 1 : f, !!away, lead);
      }
      // Замороженный враг синий с ледяной окантовкой
      v.body.setFillStyle(sb.frozen ? ICE : sb.anim === 'hurt' ? 0xffffff : (isPlayer ? (CHARACTERS.find(c => c.id === sb.char)?.color ?? 0xffffff) : sb.dummy ? 0xb08d57 : 0x8a8f98));
      if (sb.frozen) v.body.setStrokeStyle(2, 0xe8f8ff); else v.body.setStrokeStyle();
      if (isPlayer) this.drawStorm(v, sb, x, y);
      const hitting = !v.sprite && (sb.anim === 'attack' || sb.anim === 'heavy');
      v.fist.setVisible(hitting).setPosition(x + sb.facing * (sb.anim === 'heavy' ? 16 : 12), y - 18).setSize(sb.anim === 'heavy' ? 14 : 10, 5).setDepth(y + 0.5);
      const maxHp = sb.maxHp ?? (isPlayer ? PLAYER_HP : 100);
      const head = v.sprite ? HEAD : isPlayer ? 86 : 80;
      v.hp.setPosition(x - 20, y - head - lift).setDepth(y + 0.6).setSize(40 * Math.max(0, sb.hp) / maxHp, 3);
      v.label?.setPosition(x, y - head - 3 - lift).setDepth(y + 0.7);
      v.bubble?.setPosition(x, y - HEAD - 18);
    };
    // Свою героиню рисуем по самому свежему снимку: отставание 60 мс остаётся только у остальных
    const latest = this.session.snapshots[this.session.snapshots.length - 1];
    for (const [id, sb] of b.players) {
      const mine = id === this.session.me ? latest?.players.get(id) : undefined;
      if (mine) draw('p:' + id, true, undefined, mine, true);
      else draw('p:' + id, true, a.players.get(id), sb);
    }
    for (const [id, sb] of b.enemies) draw('e:' + id, false, a.enemies.get(id), sb);
    for (const [key, v] of this.views) {
      if (seen.has(key)) continue;
      v.storm?.zone.destroy(); v.storm?.flakes.forEach(f => f.destroy());
      v.sprite?.destroy(); v.shadow?.destroy(); v.body.destroy(); v.fist.destroy(); v.hp.destroy(); v.label?.destroy(); v.bubble?.destroy();
      this.views.delete(key);
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
      postBoot: game => {
        game.scene.add('game', GameScene, true, { session });
        game.scene.add('ui', UIScene, true, { session }); // поверх боя
      },
    },
  });
  // Поворот, появление/исчезновение панелей Safari: подгоняем ширину
  const refit = () => game.scale.setGameSize(viewWidth(), VIEW_H);
  window.addEventListener('resize', () => setTimeout(refit, 100));
  return game;
}
