import * as Phaser from 'phaser';
import { Impact } from './impact.ts';
import { BossShow } from './boss-show.ts';
import { RAMIL_ID, RAMIL, ENCOUNTERS, ENEMY_INTRO, HALT_MS, BOSS, BOSS_ATTACK, type BossId, ENEMY_ANIMS, HOP_MS, HOP_HEIGHT, AIM_MS, moveAnim, BALL_FLIGHT_MS, BEAM_MS, FLASH_SPEED, KISS_SPEED, HERO_FORM, KRIS_ID, NADYA_ID, PLAYER_HP, STORM_RADIUS, CHARACTERS, isSpriteHero, moveSpeed, HERO_ANIMS, LEVELS, TICK_MS, VIEW_H, VIEW_W, dirOf, type Form, type SimEvent } from '@bc/shared';
import { RAMIL_TIPS } from './ramil-tips.ts';
import { VFX, VFX_IMAGES } from './vfx-data.ts';
import type { EntitySnap, GameSession, Snapshot } from './session.ts';
import { showFinale } from './story.ts';
import { beep } from './audio.ts';
import { FONT, UIScene, textStyle } from './ui.ts';
import { StageView, preloadStages, debugLane } from './stage.ts';
import { buildLevel, preloadLevel, showCard } from './level.ts';

const ENTER_ANIM_RATE = 1.5;
const CAM_TAU = 0.18;
const CAM_LEAD = 0.33;
const UI_RIGHT = (width: number) => Math.round(width * 0.40);
const INTERP_MS = 60; // буфер интерполяции чужих и врагов: мир на 60 мс в прошлом. Свою героиню рисуем без отставания
const CELL = 128; // кадр спрайта героини
const FEET_Y = 112; // ступни в кадре
const SCALE = 1.5; // героиня крупнее исходных 128 px по просьбе mr.R
const ENEMY_SCALE: Record<string, number> = { omon_shield: 1.08, clerk: 1.08, shaman: 1.15, pizdulina: 1.15 };
const HEAD = 62 * SCALE; // высота над ступнями для полоски жизни и имени
const FLAKES = 90; // снежинок в буре
const ENEMY_LOOK: Record<string, [number, number, number]> = {
  shaman: [0xd8d8d8, 44, 96], pizdulina: [0x8b1e3f, 44, 96],
  omon: [0x3b4a66, 30, 78], omon_shield: [0x2c3850, 38, 84], vatnik: [0x6b6b3a, 32, 74],
  zek: [0x2b2b2b, 24, 72], clerk: [0x777777, 40, 76], info_m: [0x6a3fc4, 26, 76], info_f: [0xd9b98c, 26, 74],
};
const ICE = 0x66b8ff; // цвет замороженного врага

interface Storm { zone: Phaser.GameObjects.Ellipse; flakes: Phaser.GameObjects.Rectangle[]; seed: number[] }
interface View { ramilFx?: Map<string, Phaser.GameObjects.Image>; warmAt?: number; warmSince?: number; ring?: Phaser.GameObjects.Ellipse; castActive?: boolean; enemyClip?: string; enemySince?: number; shield?: Phaser.GameObjects.Rectangle; warning?: Phaser.GameObjects.Text; status?: Phaser.GameObjects.Sprite; storm?: Storm; sprite?: Phaser.GameObjects.Image; shadow?: Phaser.GameObjects.Ellipse; body: Phaser.GameObjects.Rectangle; fist: Phaser.GameObjects.Rectangle; label?: Phaser.GameObjects.Text; hp: Phaser.GameObjects.Rectangle; bubble?: Phaser.GameObjects.Text }

export class GameScene extends Phaser.Scene {
  session!: GameSession;
  private bossShow?: BossShow;
  private impact!: Impact;
  private attackBands: { x: number; y: number; h: number; until: number; grid: boolean }[] = [];
  private stageView?: StageView;
  private locationKey = '';
  private worldWidth = 1920;
  private prompt?: Phaser.GameObjects.Text;
  private lockNoticeUntil = 0;
  private forwardFrom?: number;
  private floorFx?: Phaser.GameObjects.Graphics;
  private shotFx?: Phaser.GameObjects.Graphics;
  private bossHp?: Phaser.GameObjects.Rectangle;
  private bossName?: Phaser.GameObjects.Text;
  private phaseUntil = 0;
  private cineKey = '';
  private cineStart = 0;
  private cineShade?: Phaser.GameObjects.Rectangle;
  private cinePanel?: Phaser.GameObjects.Container;
  private cineBubble?: Phaser.GameObjects.Text;
  private guide?: Phaser.GameObjects.Graphics;
  private exitLabel?: Phaser.GameObjects.Text;
  private stopped = false;
  private stoppedAt = 0;
  private telegraphs: { ev: Extract<SimEvent, { t: 'tele'; shape: string }>; until: number }[] = [];
  private vines: { ev: Extract<SimEvent, { t: 'vine' }>; since: number }[] = [];
  private vineParts: Phaser.GameObjects.Image[] = [];
  private vineG?: Phaser.GameObjects.Graphics;
  private views = new Map<string, View>();
  constructor() { super('game'); }

  preload() {
    for (const [kind, clips] of Object.entries(ENEMY_ANIMS)) for (const clip of Object.keys(clips!)) {
      this.load.spritesheet(`enemy/${kind}/${clip}`, `sprites/enemies/${kind}/${clip}-east.png`, { frameWidth: CELL, frameHeight: CELL });
    }
    preloadLevel(this);
    preloadStages(this);
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
    this.impact = new Impact(this);
    for (const [k, v] of Object.entries(VFX)) {
      this.anims.create({ key: 'fx-' + k, frames: this.anims.generateFrameNumbers('fx-' + k, { start: 0, end: k === 'boss-firework' ? 4 : v.n - 1 }), frameRate: v.fps, repeat: v.loop ? -1 : 0 });
    }
    this.layout();
    this.scale.on('resize', () => this.layout());
    this.session.onEvents = evs => this.onEvents(evs);
  }

  // Камера ездит по уровню за своей героиней; интерфейс в отдельной сцене ui.ts
  private layout() {
    this.cameras.main.setBounds(0, 0, this.worldWidth, VIEW_H);
  }

  private camX?: number;
  private follow(x: number, dt = 0, cine = false) {
    const cam = this.cameras.main;
    let target = Math.max(0, Math.min(this.worldWidth - this.scale.width, x - this.scale.width * CAM_LEAD));
    const snap = this.session.snapshots[this.session.snapshots.length - 1];
    if (!cine && snap?.lockX0 >= 0) {
      const lo = snap.lockX0 - 16, hi = snap.lockX1 + UI_RIGHT(this.scale.width) - this.scale.width;
      target = hi < lo ? lo : Math.max(lo, Math.min(hi, x - this.scale.width * CAM_LEAD));
    }
    if (cine) target = x - this.scale.width / 2;
    target = Math.max(0, Math.min(Math.max(0, this.worldWidth - this.scale.width), target));
    this.camX = this.camX === undefined ? target : this.camX + (target - this.camX) * (1 - Math.exp(-dt / CAM_TAU));
    cam.setScroll(Math.round(this.camX), 0);
    this.session.view(cam.scrollX, this.scale.width);
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
    const t = this.add.text(x, y, text, { ...textStyle(text === 'ПОКА!' || text === 'ВСЁ.' ? 21 : 16, color), strokeThickness: 4 }).setOrigin(0.5).setDepth(1550).setAngle(-8).setScale(0.4);
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

  private bossWord(x: number, y: number, text: string, size = 16, color = '#ffd34f') {
    const t = this.add.text(x,y,text,textStyle(size,color)).setOrigin(0.5).setDepth(y+200);
    this.tweens.add({targets:t,y:y-15,alpha:0,delay:700,duration:500,onComplete:()=>t.destroy()});
  }
  private onEvents(evs: SimEvent[]) {
    for (const e of evs) {
      if (e.t === 'bossFx') {
        const floor = {depth: 0};
        if (e.attack === 'vstayu') {
          this.fx('boss-ring',e.x,e.y,{...floor,scale:3}); this.cameras.main.shake(200,0.008); this.bossWord(e.x,e.y-100,'ВСТАЮ!');
        } else if (e.attack === 'pyro') this.fx('boss-pyro',e.x,e.y-63,{depth:e.y,scale:1.5,frames:12});
        else if (e.attack === 'salute') this.fx('boss-firework',e.x,e.y-30,{depth:e.y,scale:1.5,frames:5}).setTint(e.tint ?? 0xffffff);
        else if (e.attack === 'banStrike') {
          this.fx('boss-ban',e.x,e.y-(110-64)*1.5,{depth:e.y,scale:1.5});
          this.fx('boss-slam',e.x,e.y,{...floor,scale:1.5}); this.bossWord(e.x,e.y-85,'ЗАБЛОКИРОВАНО',8,'#ff3030'); this.cameras.main.shake(120,0.006);
        } else if (e.attack === 'zones') this.fx('boss-slam',e.x,e.y,{...floor,scale:1.5});
        else if (e.h) {
          this.attackBands.push({x:e.x,y:e.y,h:e.h,until:this.time.now+e.ms,grid:e.attack==='grid'});
          if(e.attack==='chorus') this.bossWord(e.x+160,e.y-80,'Я РУССКИЙ!');
        }
      }
      if (e.t === 'phase' || e.t === 'bossDown') {
        const boss = this.session.snapshots.at(-1)?.enemies.get(e.id);
        if (boss) this.bossWord(boss.x,boss.y-105,e.t==='phase' ? (boss.boss==='shaman'?'ВСТАЮ ЕЩЁ РАЗ!':'ДОСТУП ЗАПРЕЩЁН') : (boss.boss==='shaman'?'ОТМЕНЁН!':'РАЗБЛОКИРОВАНО!'));
        if (boss) {
          const players = [...(this.session.snapshots.at(-1)?.players.entries() ?? [])];
          const nearest = players.sort((a, b) => Math.hypot(a[1].x-boss.x, a[1].y-boss.y)-Math.hypot(b[1].x-boss.x, b[1].y-boss.y))[0];
          this.impact.play(2, nearest ? this.views.get('p:' + nearest[0])?.sprite : undefined, this.views.get('e:' + e.id)?.sprite, boss.x, boss.y);
        }
      }
      if (e.t === 'vine') this.vines.push({ ev: e, since: this.time.now });
      if (e.t === 'tele' && 'fromX' in e) {
        const v = this.views.get('p:' + e.id);
        if (v?.sprite && new URLSearchParams(location.search).get('fx') !== '0') {
          const sp = v.sprite;
          const silhouette = this.add.image(e.fromX, e.fromY, sp.texture.key, sp.frame.name).setOrigin(sp.originX, sp.originY).setScale(sp.scaleX, sp.scaleY).setTintMode(Phaser.TintModes.FILL).setTint(0xffffff).setDepth(e.fromY + 0.1);
          this.time.delayedCall(17, () => silhouette.destroy());
        }
        this.fx('ramil-poof', e.fromX, e.fromY - 35);
        const ms = this.session.snapshots.at(-1)?.players.get(e.id)?.move === 'slap' ? 0 : RAMIL.TELE_MS;
        this.time.delayedCall(ms, () => { this.fx('ramil-poof', e.toX, e.toY - 35); this.fx('ramil-dust', e.toX, e.toY, { depth: e.toY + 0.1 }); });
      }
      if (e.t === 'victory') void showFinale(() => this.replay());
      if (e.t === 'tele' && e.shape !== undefined) this.telegraphs.push({ ev: e, until: this.time.now + e.ms + (e.delayMs ?? 0) });
      if (e.t === 'phase') { this.phaseUntil = this.time.now + 1000; this.telegraphs = this.telegraphs.filter(t => t.ev.id !== e.id); }
      if (e.t === 'bossDown') this.telegraphs = this.telegraphs.filter(t => t.ev.id !== e.id);
      if (e.t === 'restart' || e.t === 'stage') { this.telegraphs = []; this.vines = []; this.attackBands = []; this.bossShow?.destroy(); this.bossShow = undefined; }

      if (e.t === 'lock') { this.lockNoticeUntil = this.time.now + 1200; this.forwardFrom = undefined; }
      if (e.t === 'clear') {
        const last = this.session.snapshots[this.session.snapshots.length - 1];
        this.forwardFrom = last?.players.get(this.session.me)?.x;
      }
    }
    for (const e of evs) {
      if (e.t === 'exit') {
        this.cameras.main.fadeOut(350);
      } else if (e.t === 'stage') {
        if (this.locationKey === 'old:0') this.cameras.main.fadeIn(350);
      } else if (e.t === 'hit') {
        const by = this.charOf(e.by);
        const delay = (e.kill || e.impact) && this.views.has('e:' + e.target)
          ? this.impact.play(e.kill ? 2 : e.impact!, this.views.get('p:' + e.by)?.sprite, this.views.get('e:' + e.target)?.sprite, e.x, e.y,
            CHARACTERS.find(c => c.id === by)?.color) : 0;
        const showText = () => {
          const t = this.add.text(e.x, e.y - 70, '-' + e.dmg, textStyle(e.tick ? 6 : 8, '#ffd84a')).setOrigin(0.5).setDepth(1500);
          this.tweens.add({ targets: t, y: t.y - 16, alpha: 0, duration: 500, onComplete: () => t.destroy() });
          // Искры по герою: розовые у Нади, салатовые у Kris
          if (by === NADYA_ID) e.word === 'ШЛЁП!' ? this.fx('nadya-slap', e.x, e.y - 50, { frames: 10 }) : this.fx('nadya-hit', e.x, e.y - 45);
          if (by === RAMIL_ID) {
            if (!e.tick) {
              this.fx('ramil-hit', e.x, e.y - 45);
              this.cameras.main.shake(e.impact === 2 ? 150 : 60, 0.003);
            }
            if (e.word === 'ОП!') this.fx('ramil-rise', e.x, e.y - 45);
            if (e.word === 'ПОКА!') {
              this.fx('ramil-crit', e.x, e.y - 45);
              const target = this.session.snapshots.at(-1)?.enemies.get(e.target);
              const dir = this.session.snapshots.at(-1)?.players.get(e.by!)?.facing ?? 1;
              this.time.delayedCall(300, () => { const at = this.session.snapshots.at(-1)?.enemies.get(e.target); this.fx('ramil-ring', at?.x ?? (target?.x ?? e.x) + dir * RAMIL.KICK_FLY, at?.y ?? e.y); });
            }
          }
          if (by === KRIS_ID) this.fx('kris-hit', e.x, e.y - 45);
          if (e.word === 'БУМ!') this.fx('kris-ring', e.x, e.y, { depth: e.y - 0.3 });
          if (e.word) this.word(e.x, e.y - 95, e.word, by === RAMIL_ID ? e.word === 'ИДИ СЮДА!' ? '#a0eb6e' : e.word === 'ПЫХ!' ? '#ff8c3c' : e.word === 'ПОКА!' || e.word === 'ВСЁ.' ? '#ff5a50' : '#e8743b' : by === KRIS_ID ? '#c8ff6a' : by === NADYA_ID ? '#ff8fc4' : '#9d74d4');
        };
        if (delay) this.time.delayedCall(delay, showText); else showText();
        if (by !== RAMIL_ID && e.target.startsWith('e') && e.dmg >= 18) this.cameras.main.shake(90, 0.004); // сильный удар встряхивает кадр
        beep(e.target.startsWith('e') ? 520 : 180, 0.05);
      } else if (e.t === 'heal') {
        const v = this.views.get('p:' + e.id);
        if (v) {
          const t = this.add.text(v.body.x, v.body.y - HEAD - 10, '+' + e.amount, textStyle(8, '#7bd36b')).setOrigin(0.5).setDepth(1500);
          this.tweens.add({ targets: t, y: t.y - 18, alpha: 0, duration: 600, onComplete: () => t.destroy() });
        }
      } else if (e.t === 'taunt') {
        const v = this.views.get('p:' + e.id) ?? this.views.get('e:' + e.id);
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
        if (a.stage !== b.stage || a.level !== b.level) return { a: b, b, f: 1 };
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
      if (!isPlayer) {
        const kind = snap.boss || snap.kind || 'omon';
        const look = ENEMY_LOOK[kind];
        v.body.setSize(look[1], look[2]).setFillStyle(look[0]);
        v.warning = this.add.text(0, 0, '!', textStyle(16, '#ffe45c')).setOrigin(0.5, 1).setVisible(false);
        if (snap.kind === 'omon_shield') v.shield = this.add.rectangle(0, 0, 5, look[2] - 8, 0xbac9da).setOrigin(0.5, 1);
        const clips = ENEMY_ANIMS[kind];
        if (clips) {
          const clip = clips.idle ? 'idle' : Object.keys(clips)[0];
          v.body.setVisible(false);
          v.sprite = this.add.image(0, 0, `enemy/${kind}/${clip}`, 0).setOrigin(0.5, FEET_Y / CELL).setScale(SCALE * (ENEMY_SCALE[kind] ?? 1));
        }
      }
      if (!isPlayer) v.shadow = this.add.ellipse(0, 0, 38 * SCALE, 9 * SCALE, 0x000000, 0.3);
      if (isPlayer && isSpriteHero(snap.char ?? '')) {
        v.body.setVisible(false);
        v.shadow = this.add.ellipse(0, 0, 38 * SCALE, 9 * SCALE, 0x000000, 0.3);
        v.sprite = this.add.image(0, 0, `${HERO_FORM[snap.char!]}/idle-east`, 0).setOrigin(0.5, FEET_Y / CELL).setScale(SCALE);
      }
      if (isPlayer) {
        const me = key === 'p:' + this.session.me;
        v.ring = this.add.ellipse(0, 0, 38 * SCALE, 9 * SCALE).setStrokeStyle(2, ch?.color ?? 0xffffff).setAlpha(me ? 0.8 : 0.35);
        // Имя и здоровье своей героини в панели HUD, над головой только метка игрока
        v.label = this.add.text(0, 0, me ? '1P' : (ch?.name ?? '2P'), textStyle(8, '#' + (ch?.color ?? 0xffffff).toString(16).padStart(6, '0'))).setOrigin(0.5, 1);
        if (me) v.hp.setVisible(false);
      }
      this.views.set(key, v);
    }
    return v;
  }

  private replay() {
    this.session.leave();
    // Сохраняем параметры уровня; завершённую онлайн-комнату не открываем снова.
    history.replaceState(null, '', location.pathname + location.search);
    location.reload();
  }

  private drawBossFx(s: Snapshot) {
    this.floorFx ??= this.add.graphics().setDepth(0);
    this.shotFx ??= this.add.graphics().setDepth(1400);
    const g = this.floorFx; g.clear(); this.shotFx.clear();
    this.telegraphs = this.telegraphs.filter(t => {
      const owner = s.enemies.get(t.ev.id);
      const arrived = this.time.now > t.until - t.ev.ms + 100;
      return t.until > this.time.now && owner?.hp !== 0 && !(arrived && (!owner || owner.frozen || owner.phase === 'none' || owner.phase === 'recover'));
    });
    for (const t of this.telegraphs) {
      if (this.time.now < t.until - t.ev.ms) continue;
      const e = t.ev, alpha = 0.2 + 0.6 * (1 - (t.until - this.time.now) / e.ms);
      g.lineStyle(2, 0xff3030, alpha); g.fillStyle(0xff2020, alpha * 0.4);
      if (e.shape === 'line' || e.shape === 'grid') {
        g.fillRect(s.lockX0,e.y-e.h!,s.lockX1-s.lockX0,e.h!*2);
        if(e.shape==='grid') {
          for(let x=s.lockX0;x<s.lockX1;x+=8) g.lineBetween(x,e.y-e.h!,x,e.y+e.h!);
          for(let y=e.y-e.h!;y<e.y+e.h!;y+=8) g.lineBetween(s.lockX0,y,s.lockX1,y);
        }
      } else {
        const ratio=e.shape==='ring'?0.7:0.8;
        g.strokeEllipse(e.x,e.y,e.r!*2,e.r!*ratio);
        if(e.shape!=='ring') g.fillEllipse(e.x,e.y,e.r!*2*alpha,e.r!*ratio*alpha);
        if(e.shape==='ban') { g.lineBetween(e.x-5,e.y-5,e.x+5,e.y+5); g.lineBetween(e.x-5,e.y+5,e.x+5,e.y-5); }
      }
    }
    this.attackBands = this.attackBands.filter(b=>b.until>this.time.now);
    for(const b of this.attackBands) {
      g.fillStyle(b.grid?0xff2020:0xffd34f,0.65);
      if(b.grid) g.fillRect(s.lockX0,b.y-b.h,s.lockX1-s.lockX0,b.h*2);
      else for(let x=s.lockX0;x<s.lockX1;x+=4) g.fillRect(x,b.y+Math.sin((x-this.time.now/4)/15)*b.h*0.6,4,6);
    }
    for (const z of s.zones) { g.fillStyle(0xff2020, 0.55); g.fillEllipse(z.x, z.y, z.r * 2, z.r * 0.8); }
    for (const shot of s.shots) {
      this.shotFx.fillStyle(0xc82032); this.shotFx.lineStyle(1, 0xffffff);
      this.shotFx.fillCircle(shot.x, shot.y - 15, 5); this.shotFx.strokeCircle(shot.x, shot.y - 15, 5);
    }
    this.bossHp ??= this.add.rectangle(0, 36, 220, 5, 0xc82032).setOrigin(0, 0.5).setScrollFactor(0).setDepth(2200);
    this.bossName ??= this.add.text(0, 20, '', textStyle(9)).setOrigin(0.5).setScrollFactor(0).setDepth(2200);
    const boss = [...s.enemies.values()].find(e => e.boss && e.hp > 0);
    this.bossHp.setVisible(!!boss); this.bossName.setVisible(!!boss);
    if (boss) {
      this.bossHp.setX(this.scale.width / 2 - 110).setSize(220 * boss.hp / boss.maxHp!, 5).setFillStyle(boss.bossPhase === 2 ? 0x7d152c : 0xc82032);
      this.bossName.setX(this.scale.width / 2).setText(BOSS[boss.boss as BossId].name).setAlpha(this.time.now < this.phaseUntil && Math.floor(this.time.now / 100) % 2 ? 0.25 : 1);
    }
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
    this.ramilOverlay(v, 'ramil-burn-back', (sb.burnMs ?? 0) > 0, x, y - 35, y - 0.05);
    this.ramilOverlay(v, 'ramil-burn', (sb.burnMs ?? 0) > 0, x, y - 30, y + 0.1);
    this.ramilOverlay(v, 'ramil-mark', !!sb.markedBy, x, y - 100, y + 0.2);
    const key = sb.charm ? 'nadya-charm' : sb.stun ? 'stun' : sb.slow ? 'slow' : '';
    if (!key) { v.status?.destroy(); v.status = undefined; return; }
    if (v.status?.anims.currentAnim?.key !== 'fx-' + key) {
      v.status?.destroy();
      v.status = this.add.sprite(x, y, 'fx-' + key).setScale(key === 'slow' ? 1 : SCALE).play('fx-' + key);
    }
    v.status.setPosition(x, key === 'slow' ? y - 30 : y - 88).setDepth(y + 0.8);
  }

  private ramilOverlay(v: View, key: string, on: boolean, x: number, y: number, depth: number, ox = 0.5, oy = 0.5) {
    v.ramilFx ??= new Map();
    let image = v.ramilFx.get(key);
    if (!on) { image?.setVisible(false); return image; }
    if (!image) { image = this.add.image(x, y, 'fx-' + key).setScale(SCALE); v.ramilFx.set(key, image); }
    const def = VFX[key];
    image.setVisible(true).setPosition(x, y).setOrigin(ox, oy).setDepth(depth).setFrame(Math.floor(this.time.now * def.fps / 1000) % def.n);
    return image;
  }

  // Стебель «Иди сюда!» (mr.R 02.11: лоза-аркан, плавно, без дыма). Образец: tools/ramil_vine2.py draw_vine().
  // Каждый кадр: квадратичная дуга от ладони к груди цели; полёт ease-out, рывок ease-in-out (дуга выпрямляется), втягивание обратно.
  private drawVines(s: Snapshot) {
    const g = this.vineG ??= this.add.graphics();
    g.clear(); this.vineParts.forEach(p => p.setVisible(false));
    const full = RAMIL.VINE_FLIGHT + RAMIL.VINE_PULL;
    this.vines = this.vines.filter(v => this.time.now - v.since < full + RAMIL.VINE_RETRACT);
    const easeOut = (t: number) => 1 - (1 - t) ** 3, easeIO = (t: number) => t * t * (3 - 2 * t);
    let used = 0;
    const part = (key: string, x: number, y: number, depth: number, frame?: number) => {
      let im = this.vineParts[used];
      if (!im) { im = this.add.image(0, 0, key).setScale(SCALE); this.vineParts.push(im); }
      used++;
      im.setTexture(key, frame).setPosition(Math.round(x), Math.round(y)).setDepth(depth).setRotation(0).setVisible(true);
      return im;
    };
    for (const v of this.vines) for (const id of v.ev.targets) {
      const e = s.enemies.get(id); if (!e) continue;
      const t = this.time.now - v.since;
      let grow = 1, arc = 30 * SCALE;
      if (t < RAMIL.VINE_FLIGHT) grow = easeOut(t / RAMIL.VINE_FLIGHT);
      else if (t < full) arc *= 1 - easeIO((t - RAMIL.VINE_FLIGHT) / RAMIL.VINE_PULL);
      else { arc = 0; grow = 1 - easeIO((t - full) / RAMIL.VINE_RETRACT); }
      const x0 = v.ev.x, y0 = v.ev.y, x1 = e.x, y1 = e.y - 40;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2 - arc;
      const at = (u: number) => { const w = 1 - u; return [w * w * x0 + 2 * w * u * cx + u * u * x1, w * w * y0 + 2 * w * u * cy + u * u * y1]; };
      const len = Math.hypot(x1 - x0, y1 - y0) * grow, n = Math.max(8, Math.ceil(len / 3));
      const depth = Math.max(e.y, v.ev.y + 52) + 0.1;
      g.setDepth(depth);
      // контур, тело, блик; к кончику тоньше
      for (const [r, col] of [[4, 0x102212], [3, 0x3a8a32], [1.2, 0xa8e270]] as const) {
        g.fillStyle(col, 1);
        for (let i = 0; i <= n; i++) {
          const [x, y] = at(grow * i / n), k = 1 - 0.35 * i / n;
          g.fillCircle(Math.round(x), Math.round(y - (r < 2 ? SCALE : 0)), r * SCALE * k);
        }
      }
      // листья раскрываются вдоль пройденной части, по очереди сверху/снизу
      const step = 22 * SCALE, leaves = Math.floor(len / step);
      for (let j = 1; j <= leaves; j++) {
        const [x, y] = at(grow * (j * step) / Math.max(len, 1));
        const up = j % 2 === 1;
        part(up ? 'fx-ramil-leaf-up' : 'fx-ramil-leaf-down', x, y + (up ? -8 : 8) * SCALE, depth + 0.01);
      }
      if (t < RAMIL.VINE_FLIGHT) { const [x, y] = at(grow); part('fx-ramil-leaf-up', x, y, depth + 0.02).setRotation(Math.PI / 2); }
      if (t >= RAMIL.VINE_FLIGHT && t < full) part('fx-ramil-coil', e.x, e.y - 40, e.y + 0.2, Math.floor(this.time.now / 100) % 4);
    }
  }

  // Кадр героини из снимка: анимация по имени и времени с её начала, east/west отдельными полосами
  private drawHero(v: View, sb: EntitySnap, x: number, y: number, f: number, away: boolean, lead = 0) {
    const form = sb.form ?? HERO_FORM[sb.char ?? ''] ?? 'prime';
    const dir = dirOf(sb.facing);
    const action = sb.move ?? 'idle';
    let move = moveAnim(form, action);
    if (!HERO_ANIMS[form][move]) move = 'idle';
    let warmT: number | undefined;
    if (form === 'ramil') {
      if (move !== 'idle' || sb.idleInput || sb.anim === 'taunt' || away) { v.warmSince = undefined; v.warmAt = undefined; }
      else {
        v.warmAt ??= this.time.now + RAMIL.IDLE_MIN + Math.random() * (RAMIL.IDLE_MAX - RAMIL.IDLE_MIN);
        if (this.time.now >= v.warmAt) v.warmSince ??= this.time.now;
        if (v.warmSince !== undefined) {
          warmT = this.time.now - v.warmSince;
          if (warmT < HERO_ANIMS.ramil['idle-warm'].east * 1000 / HERO_ANIMS.ramil['idle-warm'].fps) move = 'idle-warm';
          else { v.warmSince = undefined; v.warmAt = undefined; warmT = undefined; }
        }
      }
    }
    const def = HERO_ANIMS[form][move];
    const n = def[dir];
    const t = warmT ?? Math.max(0, (sb.moveT ?? 0) - (1 - f) * TICK_MS + lead);
    const raw = Math.floor((t * def.fps * moveSpeed(form, action)) / 1000);
    const frame = def.loop ? raw % n : Math.min(n - 1, raw);
    const sprite = v.sprite!;
    const lift = form === 'kris' && action === 'hop' ? Math.sin(Math.PI * Math.min(1, t / HOP_MS)) * HOP_HEIGHT : 0;
    sprite.setTexture(`${form}/${move}-${dir}`, frame).setPosition(x, y - lift).setDepth(y);
    // Неуязвимость после удара мигает; во время превращения не мигает, там своя анимация
    const blink = sb.invuln && form !== 'ultimate' && !/^(transform|ult|b3)/.test(move) && move !== 'hop' && move !== 'getup' && Math.floor(this.time.now / 70) % 2 === 0;
    sprite.setVisible(!(sb.hiddenMs && sb.hiddenMs > 0));
    sprite.setAlpha(away ? 0.35 : blink ? 0.45 : 1);
    if (form === 'ramil') {
      const tip = RAMIL_TIPS[move]?.[frame];
      const heavy = ['smoke', 'b1', 'b3'].includes(move) || (sb.heavySmokeMs ?? 0) > 0;
      const tx = x + ((dir === 'west' ? 127 - (tip?.[0] ?? 64) : tip?.[0] ?? 64) - 64) * SCALE;
      const ty = y - lift + ((tip?.[1] ?? FEET_Y) - FEET_Y) * SCALE;
      const visible = !!tip && sprite.visible;
      this.ramilOverlay(v, 'ramil-smoke', visible && !heavy, tx, ty, y + 0.2, 0.62, 1)?.setRotation(-sb.facing * 0.15);
      this.ramilOverlay(v, 'ramil-smoke-heavy', visible && heavy, tx, ty, y + 0.2, 0.62, 1)?.setRotation(-sb.facing * 0.15);
      const fire = this.ramilOverlay(v, 'ramil-fire', visible && (sb.fireMs ?? 0) > 0, tx, ty, y + 0.1, 0, 0.5);
      fire?.setFlipX(dir === 'west').setOrigin(dir === 'west' ? 1 : 0, 0.5);
    }
    v.shadow!.setPosition(x, y).setDepth(y - 0.1).setAlpha(away ? 0.1 : 0.3);
  }

  private drawCine(s: Snapshot) {
    const cam = this.cameras.main;
    if (s.cineId !== this.cineKey) {
      this.cineShade?.destroy(); this.cinePanel?.destroy(); this.cineBubble?.destroy();
      this.cineShade = undefined; this.cinePanel = undefined; this.cineBubble = undefined;
      this.cineKey = s.cineId; this.cineStart = this.time.now;
      const intro = ENEMY_INTRO[s.cineKind];
      if (s.cineId && intro) {
        this.cineShade = this.add.rectangle(0, 0, this.scale.width, VIEW_H, 0x000000, 0.55).setOrigin(0).setScrollFactor(0).setDepth(3000);
        const ui = this.scene.get('ui');
        const name = ui.add.text(0, 0, intro.name, { ...textStyle(16, '#ffffff'), backgroundColor: '#c82032', padding: { x: 6, y: 5 } });
        const tag = ui.add.text(6, 30, intro.tag, textStyle(8, '#ffe45c'));
        const shadow = ui.add.rectangle(5, 5, Math.max(name.width, tag.width + 6), 46, 0x000000).setOrigin(0);
        this.cinePanel = ui.add.container(-500, VIEW_H + 100, [shadow, name, tag]).setScrollFactor(0).setDepth(3200);
        ui.tweens.add({ targets: this.cinePanel, x: 12, y: VIEW_H - 107, duration: 180, ease: 'Back.easeOut' });
        this.cineBubble = this.add.text(0, 0, '', { ...textStyle(8, '#120c19'), stroke: '#000000', strokeThickness: 1, backgroundColor: '#ffffff', padding: { x: 5, y: 5 }, wordWrap: { width: 208 } }).setOrigin(0.5, 1).setDepth(3200);
      }
    }
    const targetZoom = s.cineId ? 1.12 : 1;
    const zoom = cam.zoom + (targetZoom - cam.zoom) * (1 - Math.exp(-this.game.loop.delta / 180));
    cam.setZoom(Math.abs(zoom - targetZoom) < 0.001 ? targetZoom : zoom);
    if (!s.cineId) return;
    this.cineShade?.setSize(this.scale.width, VIEW_H);
    const v = this.views.get('e:' + s.cineId), e = s.enemies.get(s.cineId);
    v?.sprite?.setDepth(3100); if (v && !v.sprite) v.body.setDepth(3100);
    if (e && this.cineBubble) {
      const line = ENEMY_INTRO[s.cineKind].line;
      this.cineBubble.setText(line.slice(0, Math.ceil(line.length * Math.min(1, (this.time.now - this.cineStart) / 600))));
      this.cineBubble.setPosition(e.x, Math.max(64, e.y - 102));
    }
  }

  private drawGuides(s: Snapshot) {
    const stage = LEVELS[s.level].stages[s.stage], cam = this.cameras.main;
    this.guide ??= this.add.graphics().setDepth(2000);
    this.guide.clear();
    const ready = s.encDone >= s.encTotal && s.lockX0 < 0 && !s.won && (!stage.tunnel || s.halt >= HALT_MS);
    const pulse = 0.55 + 0.45 * Math.sin(this.time.now / 220) ** 2;
    this.exitLabel ??= this.add.text(0, 0, '↓\nВЫХОД', { ...textStyle(12, '#ffe45c'), align: 'center' }).setOrigin(0.5, 1).setDepth(2001);
    this.exitLabel.setVisible(ready && !!stage.exit).setAlpha(pulse);
    if (ready && stage.exit) {
      const e = stage.exit, y = Math.min(e.y1, stage.laneBottom);
      this.exitLabel.setPosition((e.x0 + e.x1) / 2, y - 22);
      this.guide.lineStyle(2, 0xffe45c, pulse).strokeRect(e.x0, y - 20, e.x1 - e.x0, 20);
    }
    const goal = ready ? stage.exit?.x0 : s.lockX0 < 0 ? ENCOUNTERS[stage.id]?.[s.encDone]?.trigger : undefined;
    this.prompt ??= this.add.text(0, 120, '', { ...textStyle(10, '#ffe45c'), align: 'center' }).setOrigin(0.5).setScrollFactor(0).setDepth(2100);
    this.prompt.setPosition(this.scale.width - 52, 120).setText(goal !== undefined && goal > cam.scrollX + this.scale.width ? `→\n${ready ? 'ВЫХОД' : 'ВПЕРЁД'}` : '').setAlpha(pulse).setVisible(!s.cineId);
    if (s.lockX0 >= 0 && !s.cineId) for (const e of s.enemies.values()) {
      if (e.hp <= 0 || e.x >= cam.scrollX && e.x <= cam.scrollX + this.scale.width) continue;
      const left = e.x < cam.scrollX, x = cam.scrollX + (left ? 5 : this.scale.width - 5), d = left ? 1 : -1;
      this.guide.fillStyle(0xff3b30).fillTriangle(x, e.y - 6, x, e.y + 6, x - d * 6, e.y);
    }
    if (stage.tunnel && s.halt >= HALT_MS && !this.stopped) {
      this.stopped = true; this.stoppedAt = this.time.now; cam.shake(120, 0.003);
      const t = this.add.text(this.scale.width / 2, VIEW_H / 2, 'СТАНЦИЯ!', textStyle(16, '#ffe45c')).setOrigin(0.5).setScrollFactor(0).setDepth(2500);
      this.time.delayedCall(1000, () => t.destroy());
    }
  }

  update(_time: number, delta: number) {
    const smp = this.sample();
    if (!smp) return;
    let { a, b, f } = smp;
    const latestStage = this.session.snapshots[this.session.snapshots.length - 1];
    if (latestStage.stage !== b.stage || latestStage.level !== b.level) { a = b = latestStage; f = 1; }
    const locationKey = b.level + ':' + b.stage;
    if (locationKey !== this.locationKey) {
      const first = !this.locationKey;
      this.bossShow?.destroy(); this.bossShow = undefined;
      this.stageView?.destroy();
      this.tweens.killAll(); this.time.removeAllEvents();
      this.children.removeAll(true); this.views.clear(); this.prompt = undefined; this.forwardFrom = undefined;
      this.floorFx = this.shotFx = this.guide = undefined; this.bossHp = undefined; this.bossName = undefined;
      this.cinePanel?.destroy();
      this.cineKey = ''; this.cineShade = undefined; this.cinePanel = undefined; this.cineBubble = undefined; this.exitLabel = undefined; this.stopped = false;
      this.locationKey = locationKey;
      const stage = LEVELS[b.level].stages[b.stage];
      this.worldWidth = stage.width;
      if (b.level === 'old') { buildLevel(this); showCard(this); debugLane(this, stage); }
      else this.stageView = new StageView(this, stage, b.stage === 0 && (!this.session.hasMe() || this.session.needsIntro() || this.session.introOpen));
      this.camX = undefined; this.layout();
      const me = b.players.get(this.session.me);
      if (me) this.follow(me.x);
      if (!first) this.cameras.main.fadeIn(350);
    }
    const pace = latestStage.cineId || latestStage.pauseMs ? 0 : latestStage.slowmoMs ? 0.3 : 1;
    if (b.level === 'route' && b.stage === 4) {
      this.bossShow ??= new BossShow(this, b);
      this.bossShow.update(latestStage, delta * pace);
    } else { this.bossShow?.destroy(); this.bossShow = undefined; }
    this.stageView?.update(delta * pace, latestStage.halt, b.level === 'route' && b.stage === 0 && (!this.session.hasMe() || this.session.needsIntro() || this.session.introOpen));
    const seen = new Set<string>();
    const draw = (key: string, isPlayer: boolean, sa: EntitySnap | undefined, sb: EntitySnap, live = false) => {
      seen.add(key);
      const x = sa && !live ? sa.x + (sb.x - sa.x) * f : sb.x;
      const y = sa && !live ? sa.y + (sb.y - sa.y) * f : sb.y;
      const v = this.viewFor(key, isPlayer, sb);
      v.ring?.setPosition(x, y).setDepth(y - 0.05);
      const down = sb.anim === 'down' && !v.sprite;
      // Подброшенный враг летит по дуге; тень остаётся на земле
      const lift = sa && !live ? (sa.height ?? 0) + ((sb.height ?? 0) - (sa.height ?? 0)) * f : (sb.height ?? 0);
      if (!isPlayer && v.shadow) v.shadow.setPosition(x, y).setDepth(y - 0.1).setScale(1 - lift / 200);
      v.body.setPosition(x, y - lift).setDepth(y).setAngle(down ? 90 * sb.facing : 0);
      const away = sb.connected === false || sb.away;
      v.body.setAlpha(away ? 0.35 : sb.phase === 'recover' ? 0.7 : 1);
      if (!isPlayer) {
        if (!v.sprite && v.enemyClip !== sb.phase) { v.enemyClip = sb.phase; v.enemySince = this.time.now; }
        const windup = sb.phase === 'windup';
        v.body.setY(y - lift - (windup ? 4 : 0)).setAngle(down ? 90 * sb.facing : windup ? -sb.facing * 8 : 0);
        v.warning?.setVisible(windup).setPosition(x, y - lift - 90).setDepth(y + 1);
        v.shield?.setVisible(!v.sprite).setPosition(x + sb.facing * 18, y - lift - 4).setDepth(y + 0.1);
      }
      if (v.sprite && !isPlayer) {
        const kind = sb.boss || sb.kind || 'omon';
        const clips = ENEMY_ANIMS[kind]!;
        const casting = !!sb.boss && !!sb.atk && BOSS_ATTACK[sb.atk]?.kind !== 'melee' && (sb.phase === 'windup' || sb.phase === 'active' || sb.phase === 'recover');
        let clip = sb.anim === 'enter' || sb.anim === 'run' ? 'walk' : sb.anim === 'down' ? 'fall' : sb.anim === 'hurt' ? 'hurt' : casting ? (sb.phase !== 'windup' && clips.release ? 'release' : 'cast') : sb.anim;
        if (casting && sb.phase === 'active' && !v.castActive) { v.enemySince = this.time.now; v.castActive = true; }
        if (sb.phase === 'windup' || !casting) v.castActive = false;
        if (clip === 'dash' && !clips.dash) clip = 'strike';
        if (!clips[clip]) clip = 'idle';
        const def = clips[clip];
        if (def) {
          if (v.enemyClip !== clip) { v.enemyClip = clip; v.enemySince = this.time.now; }
          if (v.enemySince !== undefined) v.enemySince += delta * (1 - pace * (sb.anim === 'run' ? ENTER_ANIM_RATE : 1));
          const raw = Math.floor((this.time.now - (v.enemySince ?? this.time.now)) * def.fps / 1000);
          const frame = def.loop && clip !== 'windup' && clip !== 'cast' && clip !== 'release' ? raw % def.frames : Math.min(def.frames - 1, raw);
          v.sprite.setTexture(`enemy/${kind}/${clip}`, frame).setFlipX(sb.facing < 0).setPosition(x, y - lift).setDepth(y).setVisible(!(sb.boss === 'shaman' && (sb.enterMs ?? 0) > 200)).setAlpha(sb.anim === 'enter' ? Math.min(1, (this.time.now - (v.enemySince ?? this.time.now)) / 500) : sb.phase === 'recover' ? 0.7 : 1);
        }
      }
      if (v.sprite && isPlayer) {
        const lead = live && pace > 0 ? Math.min(TICK_MS, (performance.now() - this.session.snapshots[this.session.snapshots.length - 1].t) * pace) : 0;
        this.drawHero(v, sb, x, y, live ? 1 : f, !!away, lead);
      }
      // Замороженный враг синий с ледяной окантовкой
      v.body.setFillStyle(sb.frozen ? ICE : sb.anim === 'hurt' ? 0xffffff : (isPlayer ? (CHARACTERS.find(c => c.id === sb.char)?.color ?? 0xffffff) : sb.phase === 'active' && this.time.now - (v.enemySince ?? this.time.now) < 65 ? 0xffffff : sb.dummy ? 0xb08d57 : ENEMY_LOOK[sb.boss || sb.kind || 'omon'][0]));
      if (sb.frozen) v.body.setStrokeStyle(2, 0xe8f8ff); else v.body.setStrokeStyle();
      if (isPlayer) this.drawStorm(v, sb, x, y);
      else this.drawStatus(v, sb, x, y - lift);
      const hitting = !v.sprite && (sb.anim === 'attack' || sb.anim === 'heavy');
      v.fist.setVisible(hitting).setPosition(x + sb.facing * (sb.anim === 'heavy' ? 16 : 12), y - 18).setSize(sb.anim === 'heavy' ? 14 : 10, 5).setDepth(y + 0.5);
      const maxHp = sb.maxHp ?? (isPlayer ? PLAYER_HP : 100);
      const head = v.sprite ? HEAD : isPlayer ? 86 : 80;
      v.hp.setPosition(x - 20, y - head - lift).setDepth(y + 0.6).setSize(40 * Math.max(0, sb.hp) / maxHp, 3);
      v.label?.setPosition(x, y - head - 3 - lift).setDepth(y + 0.7);
      if (!isPlayer) { const hidden = sb.boss === 'shaman' && (sb.enterMs ?? 0) > 200; v.shadow?.setVisible(!hidden); v.hp.setVisible(!hidden); }
      v.bubble?.setPosition(x, y - HEAD - 18);
    };
    // Свою героиню рисуем по самому свежему снимку: отставание 60 мс остаётся только у остальных
    const latest = this.session.snapshots[this.session.snapshots.length - 1];
    for (const [id, sb] of b.players) {
      const mine = id === this.session.me ? latest?.players.get(id) : undefined;
      if (mine) { draw('p:' + id, true, undefined, mine, true); }
      else draw('p:' + id, true, a.players.get(id), sb);
    }
    const focus = latest.cineId ? latest.enemies.get(latest.cineId) : latest.players.get(this.session.me);
    if (focus) this.follow(focus.x, delta / 1000, !!latest.cineId);
    this.drawGuides(latest);
    for (const t of this.telegraphs) t.until += delta * (1 - pace);
    for (const b of this.attackBands) b.until += delta * (1 - pace);
    this.drawBossFx(latest);
    if (LEVELS[latest.level].stages[latest.stage].tunnel && this.stopped && this.time.now - this.stoppedAt < 1000) { this.exitLabel?.setVisible(false); this.prompt?.setVisible(false); }
    if (latest.won) void showFinale(() => this.replay());
    for (const [id, sb] of b.enemies) draw('e:' + id, false, a.enemies.get(id), sb);
    this.drawVines(latest);
    this.drawCine(latest);
    for (const [key, v] of this.views) {
      if (seen.has(key)) continue;
      v.ramilFx?.forEach(f => f.destroy());
      v.storm?.zone.destroy(); v.storm?.flakes.forEach(f => f.destroy()); v.status?.destroy();
      v.ring?.destroy(); v.warning?.destroy(); v.shield?.destroy(); v.sprite?.destroy(); v.shadow?.destroy(); v.body.destroy(); v.fist.destroy(); v.hp.destroy(); v.label?.destroy(); v.bubble?.destroy();
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
