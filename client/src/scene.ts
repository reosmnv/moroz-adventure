import * as Phaser from 'phaser';
import { AIM_MS, AIR_MS, BALL_FLIGHT_MS, BEAM_MS, FLASH_SPEED, KISS_SPEED, HERO_FORM, KRIS_ID, NADYA_ID, PLAYER_HP, STORM_RADIUS, CHARACTERS, isSpriteHero, moveSpeed, HERO_ANIMS, LANE_BOTTOM, LANE_TOP, LEVEL_W, TICK_MS, VIEW_H, VIEW_W, dirOf, type Form, type SimEvent } from '@bc/shared';
import { VFX, VFX_IMAGES } from './vfx-data.ts';
import type { EntitySnap, GameSession, Snapshot } from './session.ts';
import { beep } from './audio.ts';
import { FONT, UIScene, textStyle } from './ui.ts';
import { buildLevel, preloadLevel, showCard } from './level.ts';

const CAM_LEAD = 0.33;
const INTERP_MS = 60; // буфер интерполяции чужих и врагов: мир на 60 мс в прошлом. Свою героиню рисуем без отставания
const CELL = 128; // кадр спрайта героини
const FEET_Y = 112; // ступни в кадре
const SCALE = 1.5; // героиня крупнее исходных 128 px по просьбе mr.R
const HEAD = 62 * SCALE; // высота над ступнями для полоски жизни и имени
const LAUNCH_H = 90; // высота подброса апперкотом, px
const FLAKES = 90; // снежинок в буре
const ICE = 0x66b8ff; // цвет замороженного врага

interface Storm { zone: Phaser.GameObjects.Ellipse; flakes: Phaser.GameObjects.Rectangle[]; seed: number[] }
interface View { status?: Phaser.GameObjects.Sprite; storm?: Storm; sprite?: Phaser.GameObjects.Image; shadow?: Phaser.GameObjects.Ellipse; body: Phaser.GameObjects.Rectangle; fist: Phaser.GameObjects.Rectangle; label?: Phaser.GameObjects.Text; hp: Phaser.GameObjects.Rectangle; bubble?: Phaser.GameObjects.Text }

export class GameScene extends Phaser.Scene {
  session!: GameSession;
  private views = new Map<string, View>();
  constructor() { super('game'); }

  preload() {
    preloadLevel(this);
    for (const [k, v] of Object.entries(VFX)) this.load.spritesheet('fx-' + k, `vfx/${k}.png`, { frameWidth: v.w, frameHeight: v.h });
    for (const k of VFX_IMAGES) this.load.image('fx-' + k, `vfx/${k}.png`);
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
    for (const [k, v] of Object.entries(VFX)) {
      this.anims.create({ key: 'fx-' + k, frames: this.anims.generateFrameNumbers('fx-' + k, { start: 0, end: v.n - 1 }), frameRate: v.fps, repeat: v.loop ? -1 : 0 });
    }
    buildLevel(this);
    showCard(this);
    this.layout();
    this.scale.on('resize', () => this.layout());
    this.session.onEvents = evs => this.onEvents(evs);
  }

  // Камера ездит по уровню за своей героиней; интерфейс в отдельной сцене ui.ts
  private layout() {
    this.cameras.main.setBounds(0, 0, LEVEL_W, VIEW_H);
  }

  private camX?: number;
  private follow(x: number) {
    const cam = this.cameras.main;
    const target = Math.max(0, Math.min(LEVEL_W - this.scale.width, x - this.scale.width * CAM_LEAD));
    // T1: здесь можно ограничить target сверху границей незачищенной волны.
    // Мягкое следование без дрожи пикселей
    this.camX = this.camX === undefined ? target : this.camX + (target - this.camX) * 0.15;
    cam.setScroll(Math.round(this.camX), 0);
  }

  // Одноразовый эффект из листа: проигрался и исчез (frames: сколько кадров показать у петельных)
  private fx(key: string, x: number, y: number, opts: { scale?: number; flip?: boolean; depth?: number; frames?: number } = {}) {
    const v = VFX[key];
    const sp = this.add.sprite(x, y, 'fx-' + key, 0).setScale(opts.scale ?? SCALE).setDepth(opts.depth ?? 1450).setFlipX(!!opts.flip);
    sp.play('fx-' + key);
    const ms = ((opts.frames ?? v.n) * 1000) / v.fps;
    this.time.delayedCall(ms, () => sp.destroy());
    return sp;
  }

  private charOf(id?: string) {
    const last = this.session.snapshots[this.session.snapshots.length - 1];
    return id ? last?.players.get(id)?.char : undefined;
  }

  // Комиксное слово над попаданием: «ШЛЁП!», «БАМ!»
  private word(x: number, y: number, text: string, color: string) {
    const t = this.add.text(x, y, text, { ...textStyle(16, color), strokeThickness: 4 }).setOrigin(0.5).setDepth(1550).setAngle(-8).setScale(0.4);
    this.tweens.add({ targets: t, scale: 1, duration: 120, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, y: y - 12, alpha: 0, delay: 350, duration: 300, onComplete: () => t.destroy() });
  }

  // Прицел и луч Kris: красная линия мигает, потом салатовый луч кусками до края
  private aim(x: number, y: number, dir: number) {
    const len = this.scale.width + 200;
    const line = this.add.tileSprite(x, y, len, 3, 'fx-aim').setOrigin(dir > 0 ? 0 : 1, 0.5).setDepth(1600);
    this.fx('kris-charge', x, y, { depth: 1601 });
    const blink = this.time.addEvent({ delay: 90, loop: true, callback: () => line.setVisible(!line.visible) });
    this.time.delayedCall(AIM_MS, () => { blink.remove(); line.destroy(); });
  }

  private beam(x: number, y: number, dir: number) {
    const len = this.scale.width + 200;
    const parts: Phaser.GameObjects.GameObject[] = [];
    const start = this.add.image(x, y, 'fx-beam-start-0').setOrigin(dir > 0 ? 0 : 1, 0.5).setScale(SCALE, SCALE).setFlipX(dir < 0).setDepth(1600);
    const mid = this.add.tileSprite(x + dir * 12 * SCALE, y, len / SCALE, 64, 'fx-beam-mid-0').setOrigin(dir > 0 ? 0 : 1, 0.5).setScale(SCALE).setDepth(1600);
    parts.push(start, mid);
    let f = 0;
    const pulse = this.time.addEvent({ delay: 70, loop: true, callback: () => { f = (f + 1) % 3; start.setTexture('fx-beam-start-' + f); mid.setTexture('fx-beam-mid-' + f); } });
    this.cameras.main.shake(BEAM_MS, 0.006);
    this.time.delayedCall(BEAM_MS, () => {
      pulse.remove();
      this.tweens.add({ targets: parts, alpha: 0, scaleY: 0.2, duration: 150, onComplete: () => parts.forEach(o => o.destroy()) });
    });
  }

  // Воздушный поцелуй Нади: розовое сердце со свечением плывёт до края уровня, покачиваясь, за ним шлейф сердечек
  private kiss(x: number, y: number, tx: number) {
    const dir = Math.sign(tx - x) || 1, hy = y - 55;
    const glow = this.add.ellipse(x, hy, 44, 40, 0xff6fb5, 0.35).setDepth(1449).setBlendMode(Phaser.BlendModes.ADD);
    const heart = this.add.image(x, hy, 'fx-heart').setScale(SCALE * 0.6).setDepth(1450);
    const ms = (Math.abs(tx - x) / KISS_SPEED) * 1000;
    const t0 = this.time.now;
    const trail = this.time.addEvent({ delay: 110, loop: true, callback: () => {
      const s = this.fx('nadya-charm', heart.x - dir * 14, heart.y + 6, { depth: 1448, scale: 1, frames: 8 });
      this.tweens.add({ targets: s, y: s.y - 10, alpha: 0, duration: 650 });
    } });
    this.tweens.addCounter({ from: 0, to: 1, duration: ms, onUpdate: c => {
      const k = c.getValue() ?? 0, t = (this.time.now - t0) / 1000;
      heart.setPosition(x + (tx - x) * k, hy + Math.sin(t * 6) * 4).setAngle(Math.sin(t * 4) * 10)
        .setScale(SCALE * (0.6 + 0.6 * Math.min(1, t / 0.22)) * (1 + 0.07 * Math.sin(t * 10))); // вырастает из губ и пульсирует
      glow.setPosition(heart.x, heart.y).setAlpha(0.25 + 0.12 * Math.sin(t * 10));
      // Улетел далеко за экран: дальше рисовать незачем, механика летит в sim
      const cam = this.cameras.main;
      if (heart.x < cam.scrollX - 200 || heart.x > cam.scrollX + cam.width + 200) c.complete();
    }, onComplete: () => { trail.remove(); heart.destroy(); glow.destroy(); } });
  }

  private onEvents(evs: SimEvent[]) {
    for (const e of evs) {
      if (e.t === 'hit') {
        const t = this.add.text(e.x, e.y - 70, '-' + e.dmg, textStyle(8, '#ffd84a')).setOrigin(0.5).setDepth(1500);
        this.tweens.add({ targets: t, y: t.y - 16, alpha: 0, duration: 500, onComplete: () => t.destroy() });
        // Искры по герою: розовые у Нади, салатовые у Kris
        const by = this.charOf(e.by);
        if (by === NADYA_ID) e.word === 'ШЛЁП!' ? this.fx('nadya-slap', e.x, e.y - 50, { frames: 10 }) : this.fx('nadya-hit', e.x, e.y - 45);
        if (by === KRIS_ID) this.fx('kris-hit', e.x, e.y - 45);
        if (e.word === 'БУМ!') this.fx('kris-ring', e.x, e.y, { depth: e.y - 0.3 });
        if (e.word) this.word(e.x, e.y - 95, e.word, by === KRIS_ID ? '#c8ff6a' : '#ff8fc4');
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
      } else if (e.t === 'shot') {
        // Вспышка: блик у камеры, светящийся снаряд летит до цели, вспышка на месте
        const dir = Math.sign(e.tx - e.x) || 1;
        this.fx('kris-muzzle', e.x, e.y, { flip: dir < 0 });
        const bolt = this.add.sprite(e.x, e.y, 'fx-kris-bolt').setScale(SCALE).setFlipX(dir < 0).setDepth(1450).play('fx-kris-bolt');
        const ms = (Math.abs(e.tx - e.x) / FLASH_SPEED) * 1000;
        this.tweens.add({ targets: bolt, x: e.tx, y: e.ty, duration: ms, onComplete: () => { bolt.destroy(); this.fx('kris-flash', e.tx, e.ty, { frames: 6 }); } });
        beep(1200, 0.04);
      } else if (e.t === 'ball') {
        // Шар летит дугой и крутится; взрыв придёт событием boom
        const ball = this.add.image(e.x, e.y, 'fx-ball').setScale(SCALE).setDepth(1450);
        const peak = Math.min(e.y, e.ty - 40) - 40;
        this.tweens.add({ targets: ball, x: e.tx, duration: BALL_FLIGHT_MS, angle: 720 * Math.sign(e.tx - e.x || 1) });
        this.tweens.add({ targets: ball, y: peak, duration: BALL_FLIGHT_MS / 2, ease: 'Quad.easeOut', yoyo: false, onComplete: () => {
          this.tweens.add({ targets: ball, y: e.ty - 10, duration: BALL_FLIGHT_MS / 2, ease: 'Quad.easeIn', onComplete: () => ball.destroy() });
        } });
      } else if (e.t === 'boom') {
        this.fx('kris-boom', e.x, e.y - 30); this.cameras.main.shake(150, 0.006); beep(140, 0.15);
      } else if (e.t === 'kiss') {
        this.kiss(e.x, e.y, e.tx); beep(990, 0.08); this.time.delayedCall(90, () => beep(1320, 0.1));
      } else if (e.t === 'charm') {
        // Задело поцелуем: вспышка сердечек над врагом
        this.fx('nadya-twinkle', e.x, e.y - 70, { depth: 1500 });
        beep(1100, 0.04);
      } else if (e.t === 'aim') {
        this.aim(e.x, e.y, e.dir); beep(1500, 0.05);
      } else if (e.t === 'beam') {
        this.beam(e.x, e.y, e.dir); beep(110, 0.5);
      } else if (e.t === 'dash') {
        // Розовый след рывка самурая
        const x = Math.min(e.x0, e.x1), w = Math.abs(e.x1 - e.x0);
        const trail = this.add.rectangle(x, e.y - 45, w, 26, 0xff8fc4, 0.55).setOrigin(0, 0.5).setDepth(e.y + 0.4);
        const edge = this.add.rectangle(x, e.y - 45, w, 3, 0xffffff, 0.95).setOrigin(0, 0.5).setDepth(e.y + 0.5);
        this.tweens.add({ targets: [trail, edge], alpha: 0, scaleY: 0.2, duration: 380, onComplete: () => { trail.destroy(); edge.destroy(); } });
        beep(1800, 0.05);
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
      if (isPlayer && isSpriteHero(snap.char ?? '')) {
        v.body.setVisible(false);
        v.shadow = this.add.ellipse(0, 0, 38 * SCALE, 9 * SCALE, 0x000000, 0.3);
        v.sprite = this.add.image(0, 0, `${HERO_FORM[snap.char!]}/idle-east`, 0).setOrigin(0.5, FEET_Y / CELL).setScale(SCALE);
      }
      if (isPlayer) {
        const me = key === 'p:' + this.session.me;
        // Имя и здоровье своей героини в панели HUD, над головой только метка игрока
        v.label = this.add.text(0, 0, me ? '1P' : (ch?.name ?? '2P'), textStyle(8, '#' + (ch?.color ?? 0xffffff).toString(16).padStart(6, '0'))).setOrigin(0.5, 1);
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

  // Значок над врагом: ревность (сердечки), оглушение (звёзды), замедление (стрелки)
  private drawStatus(v: View, sb: EntitySnap, x: number, y: number) {
    const key = sb.charm ? 'nadya-charm' : sb.stun ? 'stun' : sb.slow ? 'slow' : '';
    if (!key) { v.status?.destroy(); v.status = undefined; return; }
    if (v.status?.anims.currentAnim?.key !== 'fx-' + key) {
      v.status?.destroy();
      v.status = this.add.sprite(x, y, 'fx-' + key).setScale(key === 'slow' ? 1 : SCALE).play('fx-' + key);
    }
    v.status.setPosition(x, key === 'slow' ? y - 30 : y - 88).setDepth(y + 0.8);
  }

  // Кадр героини из снимка: анимация по имени и времени с её начала, east/west отдельными полосами
  private drawHero(v: View, sb: EntitySnap, x: number, y: number, f: number, away: boolean, lead = 0) {
    const form = sb.form ?? HERO_FORM[sb.char ?? ''] ?? 'prime';
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
    const blink = sb.invuln && form !== 'ultimate' && !/^(transform|ult|b3)/.test(move) && move !== 'getup' && Math.floor(this.time.now / 70) % 2 === 0;
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
      else this.drawStatus(v, sb, x, y - lift);
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
      if (mine) { draw('p:' + id, true, undefined, mine, true); this.follow(mine.x); }
      else draw('p:' + id, true, a.players.get(id), sb);
    }
    for (const [id, sb] of b.enemies) draw('e:' + id, false, a.enemies.get(id), sb);
    for (const [key, v] of this.views) {
      if (seen.has(key)) continue;
      v.storm?.zone.destroy(); v.storm?.flakes.forEach(f => f.destroy()); v.status?.destroy();
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
