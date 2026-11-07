import { LINES } from '@bc/shared';
import * as Phaser from 'phaser';
import { shake, settings } from './settings.ts';
import { returnToMenu } from './session.ts';
import { Impact } from './impact.ts';
import { BossShow } from './boss-show.ts';
import { ramilSpin, flurryTiming, flurryPose, RAMIL_ID, RAMIL, ENCOUNTERS, HALT_MS, BOSS, BOSS_ATTACK, STORY_CONTENT, type BossId, ENEMY_ANIMS, KATYA_ANIMS, HOP_MS, HOP_HEIGHT, AIM_MS, moveAnim, BALL_FLIGHT_MS, BEAM_MS, FLASH_SPEED, KISS_SPEED, HERO_FORM, KRIS_ID, NADYA_ID, HERO_ID, PLAYER_HP, STORM_RADIUS, CHARACTERS, isSpriteHero, moveSpeed, HERO_ANIMS, LEVELS, TICK_MS, VIEW_H, VIEW_W, dirOf, type Form, type SimEvent } from '@bc/shared';
import { RAMIL_TIPS, RAMIL_FISTS, RAMIL_GRIP } from './ramil-tips.ts';
import { VFX, VFX_IMAGES } from './vfx-data.ts';
import type { EntitySnap, GameSession, Snapshot } from './session.ts';
import { STORY, portrait, drawStoryBubble, saveKrisFrame, showFinale } from './story.ts';
import { GameAudio } from './game-audio.ts';
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
const ENEMY_SCALE: Record<string, number> = { omon_shield: 1.08, clerk: 1.08, shaman: 1.15, pizdulina: 1.15, katya: 1.35 };
const HEAD = 62 * SCALE; // высота над ступнями для полоски жизни и имени
const FLAKES = 90; // снежинок в буре
const ENEMY_LOOK: Record<string, [number, number, number]> = {
  shaman: [0xd8d8d8, 44, 96], pizdulina: [0x8b1e3f, 44, 96], katya: [0x304039, 55, 92],
  omon: [0x3b4a66, 30, 78], omon_shield: [0x2c3850, 38, 84], vatnik: [0x6b6b3a, 32, 74],
  zek: [0x2b2b2b, 24, 72], clerk: [0x777777, 40, 76], info_m: [0x6a3fc4, 26, 76], info_f: [0xd9b98c, 26, 74],
};
const ICE = 0x66b8ff; // цвет замороженного врага

interface Storm { zone: Phaser.GameObjects.Ellipse; flakes: Phaser.GameObjects.Rectangle[]; seed: number[] }
interface View { char?: string; tornado?: Phaser.GameObjects.Image; tornadoAt?: number; debrisAt?: number; tornadoWord?: Phaser.GameObjects.Text; meteor?: Phaser.GameObjects.Graphics; spinFxAt?: number; spinDustAt?: number; stopUntil?: number; stoppedFrame?: number; stoppedX?: number; stoppedY?: number; flashUntil?: number; ghosts?: Phaser.GameObjects.Image[]; history?: { texture: string; frame: number; at: number }[]; trigram?: Phaser.GameObjects.Image; trigramAt?: number; trigramEnd?: number; ramilFx?: Map<string, Phaser.GameObjects.Image>; warmAt?: number; warmSince?: number; ring?: Phaser.GameObjects.Ellipse; castActive?: boolean; enemyClip?: string; enemySince?: number; shield?: Phaser.GameObjects.Rectangle; warning?: Phaser.GameObjects.Text; status?: Phaser.GameObjects.Sprite; storm?: Storm; sprite?: Phaser.GameObjects.Image; shadow?: Phaser.GameObjects.Ellipse; body: Phaser.GameObjects.Rectangle; fist: Phaser.GameObjects.Rectangle; label?: Phaser.GameObjects.Text; hp: Phaser.GameObjects.Rectangle; bubble?: Phaser.GameObjects.Text }

export class GameScene extends Phaser.Scene {
  session!: GameSession;
  private bossShow?: BossShow;
  private impact!: Impact;
  private audio!: GameAudio;
  private attackBands: { id: string; x: number; y: number; h: number; until: number; grid: boolean }[] = [];
  private stageView?: StageView;
  private locationKey = '';
  private oldLevelReady = false;
  private oldLevelLoading = false;
  private worldWidth = 1920;
  private prompt?: Phaser.GameObjects.Text;
  private floorFx?: Phaser.GameObjects.Graphics;
  private shotFx?: Phaser.GameObjects.Graphics;
  private bossHp?: Phaser.GameObjects.Rectangle;
  private bossName?: Phaser.GameObjects.Text;
  private phaseUntil = 0;
  private guide?: Phaser.GameObjects.Graphics;
  private exitLabel?: Phaser.GameObjects.Text;
  private stopped = false;
  private stoppedAt = 0;
  private telegraphs: { ev: Extract<SimEvent, { t: 'tele'; shape: string }>; until: number }[] = [];
  private damagePending = new Map<string, { dmg: number; x: number; y: number }>();

  private actorViews = new Map<string, { sprite: Phaser.GameObjects.Image; clip: string; since: number; impact: boolean }>();
  private views = new Map<string, View>();
  constructor() { super('game'); }

  preload() {
    this.load.image('story-milonov', 'ui/story/milonov-full.png');
    for (const hero of CHARACTERS) this.load.image('story-portrait/' + hero.id, portrait(hero.id));
    for (const [kind, clips] of Object.entries(ENEMY_ANIMS)) for (const clip of Object.keys(clips!)) {
      this.load.spritesheet(`enemy/${kind}/${clip}`, `sprites/enemies/${kind}/${clip}-east.png`, { frameWidth: CELL, frameHeight: CELL });
    }
    for (const clip of Object.keys(KATYA_ANIMS)) this.load.spritesheet(`enemy/katya/${clip}`, `sprites/enemies/katya-pl/${clip}-east.png`, { frameWidth: CELL, frameHeight: CELL });
    if (this.session.snapshots.at(-1)?.level === 'old') preloadLevel(this);
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
    this.oldLevelReady = this.textures.exists('card');
    this.impact = new Impact(this);
    this.audio = new GameAudio(this.session);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.audio.destroy());
    for (const [k, v] of Object.entries(VFX)) {
      this.anims.create({ key: 'fx-' + k, frames: this.anims.generateFrameNumbers('fx-' + k, { start: 0, end: k === 'boss-firework' ? 4 : v.n - 1 }), frameRate: v.fps, repeat: v.loop ? -1 : 0 });
    }
    this.layout();
    this.scale.on('resize', () => this.layout());
    this.session.onEvents = evs => this.onEvents(evs);
    const applySettings = () => { if (!settings.shake) this.cameras.main.shakeEffect.reset(); };
    window.addEventListener('bc-settings-change', applySettings);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.removeEventListener('bc-settings-change', applySettings));
  }

  // Камера ездит по уровню за своей героиней; интерфейс в отдельной сцене ui.ts
  private layout() {
    this.cameras.main.setBounds(0, 0, this.worldWidth, VIEW_H);
  }

  private camX?: number;
  private follow(x: number, dt = 0, centered = false) {
    const cam = this.cameras.main;
    let target = Math.max(0, Math.min(this.worldWidth - this.scale.width, x - this.scale.width * CAM_LEAD));
    const snap = this.session.snapshots[this.session.snapshots.length - 1];
    if (!centered && snap?.lockX0 >= 0) {
      const lo = snap.lockX0 - 16, hi = snap.lockX1 + UI_RIGHT(this.scale.width) - this.scale.width;
      target = hi < lo ? lo : Math.max(lo, Math.min(hi, x - this.scale.width * CAM_LEAD));
    }
    if (centered) target = x - this.scale.width / 2;
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
    const t = this.add.text(x, y, text, { ...textStyle(/^(2|4|8|16|32|64) УДАР/.test(text) ? 16 + [2,4,8,16,32,64].indexOf(parseInt(text)) * 2 : text === 'ПОКА!' || text === 'ВСЁ.' || text === '16 УДАРОВ!' ? 21 : 16, color), strokeThickness: 4 }).setOrigin(0.5).setDepth(1550).setAngle(-8).setScale(0.4);
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
    shake(this.cameras.main, BEAM_MS, 0.006);
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
    this.audio.events(evs);
    for (const e of evs) {
      if (e.t === 'bossFx') {
        const floor = {depth: 0};
        if (e.attack === 'vstayu') {
          this.fx('boss-ring',e.x,e.y,{...floor,scale:3}); shake(this.cameras.main, 200,0.008); this.bossWord(e.x,e.y-100,'ВСТАЮ!');
        } else if (e.attack === 'pyro') this.fx('boss-pyro',e.x,e.y-63,{depth:e.y,scale:1.5,frames:12});
        else if (e.attack === 'salute') this.fx('boss-firework',e.x,e.y-30,{depth:e.y,scale:1.5,frames:5}).setTint(e.tint ?? 0xffffff);
        else if (e.attack === 'banStrike') {
          this.fx('boss-ban',e.x,e.y-(110-64)*1.5,{depth:e.y,scale:1.5});
          this.fx('boss-slam',e.x,e.y,{...floor,scale:1.5}); this.bossWord(e.x,e.y-85,'БЛОК!',8,'#ff3030'); shake(this.cameras.main, 120,0.006);
        } else if (e.attack === 'zones') this.fx('boss-slam',e.x,e.y,{...floor,scale:1.5});
        else if (e.attack.startsWith('katGround')) { this.fx('katya-ground',e.x,e.y,{...floor,scale:2}); this.bossWord(e.x,e.y-90,STORY_CONTENT['kat.w1']); shake(this.cameras.main, 180,0.008); }
        else if (e.attack === 'crossStage' || e.attack === 'crossBan') {
          this.fx('boss-ring',e.x,e.y,{...floor,scale:2});
          this.fx(e.attack === 'crossBan' ? 'boss-ban' : 'boss-pyro',e.x,e.y-45,{depth:e.y,scale:1.2});
          this.bossWord(e.x,e.y-90,e.attack === 'crossBan' ? STORY_CONTENT['word.crossBan'] : STORY_CONTENT['word.crossStage']);
          shake(this.cameras.main,180,0.007);
        }
        else if (e.h) {
          this.attackBands = this.attackBands.filter(b => b.id !== e.id || b.y !== e.y || b.h !== e.h);
          this.attackBands.push({id:e.id,x:e.x,y:e.y,h:e.h,until:this.time.now+e.ms,grid:e.attack==='grid'});
          if(e.attack==='chorus') this.bossWord(e.x+160,e.y-80,'Я РУССКИЙ!');
        }
      }
      if (e.t === 'phase' || e.t === 'bossDown') {
        const boss = this.session.snapshots.at(-1)?.enemies.get(e.id);
        if (boss) this.bossWord(boss.x,boss.y-105,e.t==='phase' ? (boss.boss==='shaman'?STORY_CONTENT['sh.w3']:boss.boss==='katya'?STORY_CONTENT['kat.w3']:STORY_CONTENT['pz.w2']) : (boss.boss==='shaman'?STORY_CONTENT['sh.down']:boss.boss==='katya'?STORY_CONTENT['kat.down']:STORY_CONTENT['pz.down']));
        if (boss) {
          const players = [...(this.session.snapshots.at(-1)?.players.entries() ?? [])];
          const nearest = players.sort((a, b) => Math.hypot(a[1].x-boss.x, a[1].y-boss.y)-Math.hypot(b[1].x-boss.x, b[1].y-boss.y))[0];
          this.impact.play(2, nearest ? this.views.get('p:' + nearest[0])?.sprite : undefined, this.views.get('e:' + e.id)?.sprite, boss.x, boss.y);
        }
      }
      if (e.t === 'rdash') {
        this.fx('ramil-dust', e.fromX, e.fromY, { depth: e.fromY + 0.1 });
        for (let i = 1; i <= 4; i++) this.time.delayedCall(i * 25, () => {
          const k = i / 5, x = e.fromX + (e.toX - e.fromX) * k, y = e.fromY + (e.toY - e.fromY) * k;
          const smoke = this.add.sprite(x, y - 15, 'fx-ramil-poof').setScale(0.4).setDepth(y + 0.1).play('fx-ramil-poof');
          this.tweens.add({ targets: smoke, alpha: 0, duration: 250, onComplete: () => smoke.destroy() });
        });
      }
      if (e.t === 'rstage') { this.word(e.x, e.y - 100, ['2 УДАРА!', '4 УДАРА!', '8 УДАРОВ!', '16 УДАРОВ!', '32 УДАРА!', '64 УДАРА!'][e.level], ['#ffffff','#ffedcf','#ffcc8c','#ff993c','#ff6630','#ff3030'][e.level]);
      }
      if (e.t === 'flurry') {
        shake(this.cameras.main, e.level < 2 ? 65 : e.level < 4 ? 80 : 120, e.level < 2 ? 0.005 : 0.002 + e.level * 0.0005);
        const v = this.views.get('p:' + e.id), sprite = v?.sprite;
        const snap = this.session.snapshots.at(-1)?.players.get(e.id);
        if (sprite && snap) {
          const clip = e.level < 2 ? 'flurry' : 'flurry2';
          const timing = flurryTiming('u' + (e.level + 1), snap.facing);
          const hitFrame = flurryPose('u' + (e.level + 1), timing.stops[e.k] + 0.001, snap.facing).frame;
          const point = RAMIL_FISTS[clip]?.[hitFrame] ?? [90, 76];
          const x = e.x + ((snap.facing < 0 ? 127 - point[0] : point[0]) - 64) * SCALE, y = e.y + (point[1] - FEET_Y) * SCALE;
          for (let i = 0; i < 3; i++) {
            const spark = this.add.rectangle(x, y, 2, 2, i ? 0xff8c3c : 0xffefaa).setDepth(e.y + 1);
            this.tweens.add({ targets: spark, x: x + snap.facing * (10 + i * 5), y: y - 12 + i * 10, alpha: 0, duration: 180, onComplete: () => spark.destroy() });
          }
          this.fx('ramil-hit', x, y);
          if (e.level >= 4) this.impact.concentrate(x, y);
        }
      }
      if (e.t === 'rspinHit') {
        this.fx('ramil-hit', e.x, e.y - 35);
        for (const key of ['p:' + e.id, 'e:' + e.target]) {
          const v = this.views.get(key); if (v) { v.stopUntil = this.time.now + RAMIL.SPIN_STOP_MS; v.stoppedX = v.sprite?.x; v.stoppedY = v.sprite?.y; }
        }
      }
      if (e.t === 'rland' || e.t === 'rfinish') {
        this.fx('ramil-crit', e.x, e.y - 30); this.fx('ramil-ring', e.x, e.y);
        if (e.t === 'rfinish') this.word(e.x, e.y - 95, e.line, '#ff5a50');
        if (e.t === 'rland') {
          for (let i = 0; i < 3; i++) this.fx('ramil-dust', e.x + Math.cos(i * Math.PI * 2 / 3) * 30, e.y + Math.sin(i * Math.PI * 2 / 3) * 10);
          const cracks = this.add.graphics().setDepth(e.y - 0.05).lineStyle(1, 0x292024, 0.9);
          for (let i = 0; i < 8; i++) {
            const a = i * Math.PI / 4;
            cracks.beginPath().moveTo(e.x, e.y).lineTo(e.x + Math.cos(a) * 22, e.y + Math.sin(a) * 8)
              .lineTo(e.x + Math.cos(a + 0.12) * 42, e.y + Math.sin(a + 0.12) * 15).strokePath();
          }
          this.tweens.add({targets: cracks, alpha: 0, duration: 600, onComplete: () => cracks.destroy()});
        }
        shake(this.cameras.main, 200, 0.009);
      }
      if (e.t === 'tele' && 'fromX' in e) {
        const v = this.views.get('p:' + e.id);
        if (v?.sprite && new URLSearchParams(location.search).get('fx') !== '0') {
          const sp = v.sprite;
          const silhouette = this.add.image(e.fromX, e.fromY, sp.texture.key, sp.frame.name).setOrigin(sp.originX, sp.originY).setScale(sp.scaleX, sp.scaleY).setTintMode(Phaser.TintModes.FILL).setTint(0xffffff).setDepth(e.fromY + 0.1);
          this.time.delayedCall(17, () => silhouette.destroy());
        }
        this.fx('ramil-poof', e.fromX, e.fromY - 35);
        const ms = RAMIL.TELE_MS;
        this.time.delayedCall(ms, () => { this.fx('ramil-poof', e.toX, e.toY - 35); this.fx('ramil-dust', e.toX, e.toY, { depth: e.toY + 0.1 }); });
      }
      if (e.t === 'bossDown' && this.session.snapshots.at(-1)?.enemies.get(e.id)?.boss === 'katya') {
        try { this.game.renderer.snapshot(saveKrisFrame); } catch { /* снимок необязателен */ }
      }
      if (e.t === 'victory' && this.session.snapshots.at(-1)?.level === 'old') void showFinale(() => this.replay());
      if (e.t === 'tele' && e.shape !== undefined) {
        this.telegraphs = this.telegraphs.filter(t => t.ev.id !== e.id || t.ev.shape !== e.shape || t.ev.x !== e.x || t.ev.y !== e.y);
        this.telegraphs.push({ ev: e, until: this.time.now + e.ms + (e.delayMs ?? 0) });
      }
      if (e.t === 'phase') { this.phaseUntil = this.time.now + 1000; this.telegraphs = this.telegraphs.filter(t => t.ev.id !== e.id); }
      if (e.t === 'bossDown') this.telegraphs = this.telegraphs.filter(t => t.ev.id !== e.id);
      if (e.t === 'restart' || e.t === 'stage') { this.telegraphs = []; this.attackBands = []; this.bossShow?.destroy(); this.bossShow = undefined; }

    }
    for (const e of evs) {
      if (e.t === 'exit') {
        this.cameras.main.fadeOut(350);
      } else if (e.t === 'block') {
        const en = this.session.snapshots.at(-1)?.enemies.get(e.id);
        if (en) this.fx('block-clang', en.x + en.facing * 6, en.y - 50, { depth: en.y + 0.2, flip: en.facing < 0 });
      } else if (e.t === 'down') {
        const p = this.session.snapshots.at(-1)?.players.get(e.id);
        if (p) this.fx('hero-down', p.x, p.y - 15, { depth: p.y + 0.2 });
      } else if ((e.t === 'clear' || e.t === 'victory') && this.session.snapshots.at(-1)?.level !== 'old') {
        const cam = this.cameras.main, bursts = e.t === 'victory' ? 3 : 1;
        for (let i = 0; i < bursts; i++) this.time.delayedCall(i * 250, () =>
          this.fx('party-confetti', cam.worldView.centerX + (i - (bursts - 1) / 2) * 140, cam.worldView.y + 150, { depth: 1500, scale: 2 }));
      } else if (e.t === 'stage') {
        if (this.locationKey === 'old:0') this.cameras.main.fadeIn(350);
      } else if (e.t === 'hit') {
        const by = this.charOf(e.by);
        if (e.flurry) {
          const v = this.views.get('e:' + e.target);
          if (v) v.flashUntil = this.time.now + 40;
        }
        const delay = (e.kill || e.impact) && this.views.has('e:' + e.target)
          ? this.impact.play(e.kill ? 2 : e.impact!, this.views.get('p:' + e.by)?.sprite, this.views.get('e:' + e.target)?.sprite, e.x, e.y,
            CHARACTERS.find(c => c.id === by)?.color) : 0;
        const showText = () => {
          if (e.flurry) {
            const key = e.target, pending = this.damagePending.get(key);
            if (pending) { pending.dmg += e.dmg; pending.x = e.x; pending.y = e.y; }
            else {
              const item = { dmg: e.dmg, x: e.x, y: e.y }; this.damagePending.set(key, item);
              this.time.delayedCall(60, () => { this.damagePending.delete(key); this.damageText(item.x, item.y, item.dmg, false); });
            }
          } else this.damageText(e.x, e.y, e.dmg, !!e.tick);
          // Искры по герою: розовые у Нади, салатовые у Kris
          if (by === NADYA_ID) e.word === 'ШЛЁП!' ? this.fx('nadya-slap', e.x, e.y - 50, { frames: 10 }) : this.fx('nadya-hit', e.x, e.y - 45);
          if (by === RAMIL_ID) {
            if (!e.tick && !e.flurry) {
              this.fx('ramil-hit', e.x, e.y - 45);
              if (!e.flurry) shake(this.cameras.main, e.impact === 2 ? 150 : 60, 0.003);
            }
            if (e.word === 'ПОКА!') {
              this.fx('ramil-crit', e.x, e.y - 45);
              const target = this.session.snapshots.at(-1)?.enemies.get(e.target);
              const dir = this.session.snapshots.at(-1)?.players.get(e.by!)?.facing ?? 1;
              this.time.delayedCall(300, () => { const at = this.session.snapshots.at(-1)?.enemies.get(e.target); this.fx('ramil-ring', at?.x ?? (target?.x ?? e.x) + dir * RAMIL.KICK_FLY, at?.y ?? e.y); });
            }
          }
          if (by === KRIS_ID) this.fx('kris-hit', e.x, e.y - 45);
          if (by === HERO_ID && !e.tick) this.fx('nastya-hit', e.x, e.y - 45);
          // Враг побеждён: дым со звёздочками поверх тела
          if (e.kill && e.target.startsWith('e')) this.fx('enemy-poof', e.x, e.y - 35, { depth: e.y + 0.2, scale: 1.2 });
          if (e.word === 'БУМ!') this.fx('kris-ring', e.x, e.y, { depth: e.y - 0.3 });
          if (e.word) this.word(e.x, e.y - 95, e.word, by === RAMIL_ID ? e.word === 'ОПА!' ? '#ffd36b' : e.word === 'СТРАЙК!' ? '#ff5a50' : e.word === 'ПЫХ!' ? '#ff8c3c' : e.word === 'ПОКА!' || e.word === 'ВСЁ.' ? '#ff5a50' : '#e8743b' : by === KRIS_ID ? '#c8ff6a' : by === NADYA_ID ? '#ff8fc4' : '#9d74d4');
        };
        if (delay) this.time.delayedCall(delay, showText); else showText();
        if (by !== RAMIL_ID && e.target.startsWith('e') && e.dmg >= 18) shake(this.cameras.main, 90, 0.004); // сильный удар встряхивает кадр
      } else if (e.t === 'heal') {
        const v = this.views.get('p:' + e.id);
        if (v) {
          this.fx('heal-plus', v.body.x, v.body.y - 12, { depth: v.body.y + 0.2 });
          const t = this.add.text(v.body.x, v.body.y - HEAD - 10, '+' + e.amount, textStyle(8, '#7bd36b')).setOrigin(0.5).setDepth(1500);
          this.tweens.add({ targets: t, y: t.y - 18, alpha: 0, duration: 600, onComplete: () => t.destroy() });
        }
      } else if (e.t === 'taunt') {
        const showBubble = () => {
        const v = this.views.get('p:' + e.id) ?? this.views.get('e:' + e.id);
        if (v && e.line === LINES.kiss) { this.word(v.body.x, v.body.y - HEAD - 24, e.line, '#ff8fc4'); return; }
        if (v) {
          v.bubble?.destroy();
          v.bubble = this.add.text(v.body.x, v.body.y - HEAD - 18, e.line, { fontFamily: FONT, fontSize: '8px', color: '#120c19', backgroundColor: '#d7d1c7', padding: { x: 4, y: 3 }, wordWrap: { width: 150 }, align: 'center' }).setOrigin(0.5).setDepth(1600);
          const b = v.bubble;
          this.time.delayedCall(2000, () => { b.destroy(); if (v.bubble === b) v.bubble = undefined; });
        }
        };
        if (e.line === 'ЛОВИ!') this.time.delayedCall(INTERP_MS, showBubble); else showBubble();
      } else if (e.t === 'ult') {
        const v = this.views.get('p:' + e.id);
        if (v && v.char === HERO_ID) this.fx('nastya-ult', v.body.x, v.body.y - 50, { scale: SCALE, depth: v.body.y + 0.5 }).setAlpha(0.9);
        else if (v) {
          const c = this.add.circle(v.body.x, v.body.y - 45, 20, 0x9b59ff, 0.5).setDepth(1400);
          this.tweens.add({ targets: c, scale: 7, alpha: 0, duration: 450, onComplete: () => c.destroy() });
        }
      } else if (e.t === 'storm') {
        const v = this.views.get('p:' + e.id);
        if (v) {
          // Кольцо холода расходится до края зоны
          this.fx('nastya-storm', v.body.x, v.body.y, { depth: v.body.y - 0.3, scale: 2.2 }).setAlpha(0.8);
        }
      } else if (e.t === 'shot') {
        // Вспышка: блик у камеры, светящийся снаряд летит до цели, вспышка на месте
        const dir = Math.sign(e.tx - e.x) || 1;
        this.fx('kris-muzzle', e.x, e.y, { flip: dir < 0 });
        const bolt = this.add.sprite(e.x, e.y, 'fx-kris-bolt').setScale(SCALE).setFlipX(dir < 0).setDepth(1450).play('fx-kris-bolt');
        const ms = (Math.abs(e.tx - e.x) / FLASH_SPEED) * 1000;
        this.tweens.add({ targets: bolt, x: e.tx, y: e.ty, duration: ms, onComplete: () => { bolt.destroy(); this.fx('kris-flash', e.tx, e.ty, { frames: 6 }); } });
      } else if (e.t === 'ball') {
        // Шар летит дугой и крутится; взрыв придёт событием boom
        const ball = this.add.image(e.x, e.y, 'fx-ball').setScale(SCALE).setDepth(1450);
        const peak = Math.min(e.y, e.ty - 40) - 40;
        this.tweens.add({ targets: ball, x: e.tx, duration: BALL_FLIGHT_MS, angle: 720 * Math.sign(e.tx - e.x || 1) });
        this.tweens.add({ targets: ball, y: peak, duration: BALL_FLIGHT_MS / 2, ease: 'Quad.easeOut', yoyo: false, onComplete: () => {
          this.tweens.add({ targets: ball, y: e.ty - 10, duration: BALL_FLIGHT_MS / 2, ease: 'Quad.easeIn', onComplete: () => ball.destroy() });
        } });
      } else if (e.t === 'boom') {
        this.fx('kris-boom', e.x, e.y - 30); shake(this.cameras.main, 150, 0.006);
      } else if (e.t === 'kiss') {
        this.kiss(e.x, e.y, e.tx);
      } else if (e.t === 'charm') {
        // Задело поцелуем: вспышка сердечек над врагом
        this.fx('nadya-twinkle', e.x, e.y - 70, { depth: 1500 });
      } else if (e.t === 'aim') {
        this.aim(e.x, e.y, e.dir);
      } else if (e.t === 'beam') {
        this.beam(e.x, e.y, e.dir);
      } else if (e.t === 'dash') {
        // Розовый след рывка самурая
        const x = Math.min(e.x0, e.x1), w = Math.abs(e.x1 - e.x0);
        const trail = this.add.rectangle(x, e.y - 45, w, 26, 0xff8fc4, 0.55).setOrigin(0, 0.5).setDepth(e.y + 0.4);
        const edge = this.add.rectangle(x, e.y - 45, w, 3, 0xffffff, 0.95).setOrigin(0, 0.5).setDepth(e.y + 0.5);
        this.tweens.add({ targets: [trail, edge], alpha: 0, scaleY: 0.2, duration: 380, onComplete: () => { trail.destroy(); edge.destroy(); } });
      } else if (e.t === 'restart') {
        const snap = this.session.snapshots.at(-1);
        const banner = document.getElementById('restartBanner')!;
        banner.textContent = STORY.service.restart.replace('{n}', String(Math.min((snap?.encDone ?? 0) + 1, snap?.encTotal ?? 1))).replace('{total}', String(snap?.encTotal ?? 1));
        banner.classList.remove('hidden');
        this.time.delayedCall(1500, () => banner.classList.add('hidden'));
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
    if (v && isPlayer && v.char !== snap.char) {
      this.destroyView(key, v);
      v = undefined;
    }
    if (!v) {
      const ch = CHARACTERS.find(c => c.id === snap.char);
      const color = isPlayer ? (ch?.color ?? 0xffffff) : snap.dummy ? 0xb08d57 : 0x8a8f98;
      v = {
        char: snap.char,
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
        const clips = (kind === 'katya' ? KATYA_ANIMS : ENEMY_ANIMS[kind]);
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
        v.label = this.add.text(0, 0, me && this.session.roomId ? STORY.service.me : '', textStyle(8, '#' + (ch?.color ?? 0xffffff).toString(16).padStart(6, '0'))).setOrigin(0.5, 1);
        if (me) v.hp.setVisible(false);
      }
      this.views.set(key, v);
    }
    return v;
  }

  private destroyView(key: string, v: View) {
    v.ghosts?.forEach(g => g.destroy()); v.trigram?.destroy();
    v.meteor?.destroy(); v.tornado?.destroy(); v.tornadoWord?.destroy();
    v.ramilFx?.forEach(f => f.destroy());
    v.storm?.zone.destroy(); v.storm?.flakes.forEach(f => f.destroy()); v.status?.destroy();
    v.ring?.destroy(); v.warning?.destroy(); v.shield?.destroy(); v.sprite?.destroy(); v.shadow?.destroy(); v.body.destroy(); v.fist.destroy(); v.hp.destroy(); v.label?.destroy(); v.bubble?.destroy();
    this.views.delete(key);
  }

  private replay() { returnToMenu(this.session); }

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
      } else if (e.shape === 'column') {
        g.fillRect(e.x-e.h!, 140, e.h!*2, VIEW_H-140);
        for(let y=140;y<VIEW_H;y+=8) g.lineBetween(e.x-e.h!,y,e.x+e.h!,y);
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

  private damageText(x: number, y: number, dmg: number, tick: boolean) {
    const t = this.add.text(x, y - 70, '-' + dmg, textStyle(tick ? 6 : 8, '#ffd84a')).setOrigin(0.5).setDepth(1500);
    this.tweens.add({ targets: t, y: t.y - 16, alpha: 0, duration: 500, onComplete: () => t.destroy() });
  }

  // Кадр героини из снимка: анимация по имени и времени с её начала, east/west отдельными полосами
  private drawHero(id: string, v: View, sb: EntitySnap, x: number, y: number, f: number, away: boolean, lead = 0) {
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
    const pose = form === 'ramil' && /^u[1-6]$/.test(action) ? flurryPose(action, Math.max(0, (sb.moveT ?? 0) - (1 - f) * TICK_MS + lead), sb.facing, sb.fDashMs) : undefined;
    if (pose) move = pose.clip;
    if (action === 'a3-spin') move = 'a3-spin';
    const def = HERO_ANIMS[form][move];
    const n = def[dir];
    const t = warmT ?? Math.max(0, (sb.moveT ?? 0) - (1 - f) * TICK_MS + lead);
    const raw = Math.floor((t * def.fps * moveSpeed(form, action)) / 1000);
    let frame = action === 'a3-spin' ? Math.min(n - 1, Math.floor(ramilSpin(t).phase * n)) : pose ? Math.min(n - 1, pose.frame) : def.loop ? raw % n : Math.min(n - 1, raw);
    if ((v.stopUntil ?? 0) > this.time.now && action === 'a3-spin') frame = v.stoppedFrame ?? frame;
    else v.stoppedFrame = frame;
    this.audio.frame(id, sb, true, move, frame, n);
    const sprite = v.sprite!;
    const lift = form === 'kris' && action === 'hop' ? Math.sin(Math.PI * Math.min(1, t / HOP_MS)) * HOP_HEIGHT : 0;
    sprite.setTexture(`${form}/${move}-${dir}`, frame).setPosition(x, y - lift).setDepth(y);
    if (action === 'a3-spin' && (v.stopUntil ?? 0) > this.time.now) sprite.setPosition(v.stoppedX ?? x,v.stoppedY ?? y);
    // Неуязвимость после удара мигает; во время превращения не мигает, там своя анимация
    const blink = sb.invuln && form !== 'ultimate' && !sb.ultLevel && !action.startsWith('a3-') && !/^(transform|ult|b3)/.test(move) && move !== 'hop' && move !== 'getup' && Math.floor(this.time.now / 70) % 2 === 0;
    sprite.setVisible(!(sb.hiddenMs && sb.hiddenMs > 0));
    sprite.setAlpha(away ? 0.35 : blink ? 0.45 : 1);
    const spin = ramilSpin(t);
    const tornado = form === 'ramil' && action === 'a3-spin' && spin.turn > 0;
    if (tornado) {
      if (!v.tornado) {
        v.tornadoAt = this.time.now;
        v.tornado = this.add.image(x, y, 'fx-ramil-tornado').setOrigin(0.5, 1);
        v.tornadoWord = this.add.text(x, y - HEAD * 1.3, 'ВЖЖЖЖ!', textStyle(12, '#d8c4a0')).setOrigin(0.5);
        this.fx('ramil-dust', x, y, { scale: 0.6 });
      }
      const age = this.time.now - v.tornadoAt!;
      const scale = HEAD * 1.3 / 92 * (0.4 + 0.6 * Math.min(1, age / 100)) * (1 + Math.sin(age / 35) * 0.04);
      v.tornado.setPosition(x + Math.sin(age / 27) * 2, y).setDepth(y + 0.1).setScale(scale)
        .setFrame(Math.floor(age * (20 + (spin.turn - 1) * 2.5) / 1000) % 12);
      sprite.setAlpha(0.3);
      v.tornadoWord?.setPosition(x + Math.sin(age) , y - HEAD * 1.3).setDepth(y + 0.4).setAlpha(Math.max(0, 1 - age / 500));
      shake(this.cameras.main, 60, spin.turn === 5 ? 0.0012 : 0.0004);
      if (this.time.now - (v.spinDustAt ?? 0) >= 80) {
        v.spinDustAt = this.time.now;
        this.fx('ramil-dust', x, y, { scale: 0.6, depth: y - 0.05 });
      }
      if (this.time.now - (v.debrisAt ?? 0) >= 50) {
        v.debrisAt = this.time.now;
        for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) {
          const angle = spin.angle + i * Math.PI * 2 / 3;
          const distance = 40 + Math.random() * 50, kind = Math.floor(Math.random() * 3);
          const bit = this.add.graphics().setPosition(x + Math.cos(angle) * 20, y - 25).setDepth(y + 0.3);
          bit.fillStyle([0x444444, 0xd8c4a0, 0xffdd55][kind]);
          if (kind === 2) { bit.fillRect(-1.5, -0.5, 3, 1); bit.fillRect(-0.5, -1.5, 1, 3); }
          else bit.fillRect(-1, -1, kind === 0 ? 2 : 3, kind === 0 ? 2 : 3);
          const bx = bit.x, by = bit.y;
          this.tweens.addCounter({from: 0, to: 1, duration: 350,
            onUpdate: tween => { const u = tween.getValue() ?? 0; bit.setPosition(bx - Math.sin(angle) * distance * u, by + Math.cos(angle) * distance * u * 0.4 + 25 * u * u).setAlpha(1 - u); },
            onComplete: () => bit.destroy()});
        }
      }
    } else if (v.tornado) {
      this.fx('ramil-poof', x, y, { scale: 0.8, depth: y + 0.1 });
      v.tornado.destroy(); v.tornado = undefined;
      v.tornadoWord?.destroy(); v.tornadoWord = undefined;
    }
    if (form === 'ramil') {
      const level = pose ? Number(action[1]) - 1 : -1;
      v.ghosts ??= []; v.history ??= [];
      const dashGhosts = pose?.clip === 'dash';
      const ghostCount = dashGhosts ? 2 : pose?.active ? Math.max(0, level - 1) : 0;
      if (ghostCount > 0) {
        if (!v.history.length || this.time.now - v.history[0].at >= 20) v.history.unshift({ texture: sprite.texture.key, frame, at: this.time.now });
        v.history.length = Math.min(v.history.length, 5);
      } else v.history = [];
      for (let i = 0; i < 4; i++) {
        if (!v.ghosts[i]) v.ghosts[i] = this.add.image(0, 0, sprite.texture.key).setOrigin(0.5, FEET_Y / CELL).setScale(SCALE).setTint(0xff8c3c);
        const old = v.history[i + 1];
        v.ghosts[i].setVisible(!!old && i < ghostCount && sprite.visible);
        if (old) v.ghosts[i].setTexture(old.texture, old.frame).setPosition(x + sb.facing * (4 + i * 2), y).setDepth(y - 0.01).setAlpha(0.5 - i * 0.1);
      }
      const ringOn = (sb.ultLevel ?? 0) > 0 && sprite.visible;
      if (ringOn) {
        if (!v.trigram) {
          v.trigram = this.add.image(x, y, 'fx-ramil-trigram'); v.trigramAt = this.time.now;
          const flash = this.add.ellipse(x, y, 80, 25, 0xffffff, 0.8).setDepth(0);
          this.tweens.add({ targets: flash, alpha: 0, scale: 1.5, duration: 150, onComplete: () => flash.destroy() });
        }
        v.trigramEnd = undefined;
        const def = VFX['ramil-trigram'];
        v.trigram.setPosition(x, y).setDepth(0).setScale(SCALE * Math.min(1, 0.3 + (this.time.now - v.trigramAt!) / 150 * 0.7)).setAlpha(level === 5 ? 0.8 + Math.sin(this.time.now / 45) * 0.2 : 0.4 + (level + 1) * 0.1).setTint(level === 5 ? 0xff3030 : 0xffffff).setFrame(Math.floor(this.time.now * def.fps * (1 + (level + 1) * 0.35) / 1000) % def.n);
      } else if (v.trigram) {
        v.trigramEnd ??= this.time.now;
        v.trigram.setAlpha(Math.max(0, 0.8 * (1 - (this.time.now - v.trigramEnd) / 250)));
        if (this.time.now - v.trigramEnd >= 250) { v.trigram.destroy(); v.trigram = undefined; }
      }
      const tip = RAMIL_TIPS[move]?.[frame];
      const heavy = move !== 'a3-spin' && (['smoke', 'b1', 'b4'].includes(move) || (sb.heavySmokeMs ?? 0) > 0);
      const tx = x + ((dir === 'west' ? 127 - (tip?.[0] ?? 64) : tip?.[0] ?? 64) - 64) * SCALE;
      const ty = y - lift + ((tip?.[1] ?? FEET_Y) - FEET_Y) * SCALE;
      const visible = (!!tip || move === 'a3-spin') && sprite.visible;
      this.ramilOverlay(v, 'ramil-smoke', visible && !heavy, tx, ty, y + 0.2, 0.62, 1)?.setRotation(-sb.facing * 0.15);
      this.ramilOverlay(v, 'ramil-smoke-heavy', visible && heavy, tx, ty, y + 0.2, 0.62, 1)?.setRotation(-sb.facing * 0.15);
      const fire = this.ramilOverlay(v, 'ramil-fire', visible && (sb.fireMs ?? 0) > 0, tx, ty, y + 0.1, 0, 0.5);
      fire?.setFlipX(dir === 'west').setOrigin(dir === 'west' ? 1 : 0, 0.5);
    }
    v.shadow!.setPosition(x, y).setDepth(y - 0.1).setAlpha(away ? 0.1 : 0.3);
  }

  private drawActors(s: Snapshot) {
    for (const [id, view] of this.actorViews) {
      if (s.actors.has(id) && view.sprite.scene) continue;
      view.sprite.destroy(); this.actorViews.delete(id);
    }
    for (const actor of s.actors.values()) {
      if (CHARACTERS.some(c => c.id === actor.id)) continue;
      const clips = actor.look === 'katya' ? KATYA_ANIMS : ENEMY_ANIMS[actor.look];
      const clip = clips?.[actor.anim] ? actor.anim : 'idle';
      const texture = actor.look === 'milonov' ? 'story-milonov' : `enemy/${actor.look}/${clip}`;
      if (!this.textures.exists(texture)) continue;
      let view = this.actorViews.get(actor.id);
      if (!view) {
        view = { sprite: this.add.image(actor.x, actor.y, texture), clip: '', since: this.time.now, impact: false };
        this.actorViews.set(actor.id, view);
      }
      if (view.clip !== clip) { view.clip = clip; view.since = this.time.now; view.impact = false; }
      const def = clips?.[clip];
      const raw = def ? Math.floor((this.time.now - view.since) * def.fps / 1000) : 0;
      if (actor.look === 'katya' && clip === 'cast' && raw >= 4 && !view.impact) {
        view.impact = true; shake(this.cameras.main, 220, 0.009);
      }
      const frame = def ? def.loop ? raw % def.frames : Math.min(def.frames - 1, raw) : 0;
      view.sprite.setTexture(texture, frame).setPosition(actor.x, actor.y).setDepth(actor.y)
        .setFlipX(actor.facing < 0).setOrigin(0.5, actor.look === 'milonov' ? 60 / 64 : FEET_Y / CELL)
        .setScale(actor.look === 'milonov' ? SCALE * 1.08 : SCALE * (ENEMY_SCALE[actor.look] ?? 1));
    }
  }

  private drawGuides(s: Snapshot) {
    const stage = LEVELS[s.level].stages[s.stage], cam = this.cameras.main;
    this.guide ??= this.add.graphics().setDepth(2000);
    this.guide.clear();
    if (s.storyScene) { this.exitLabel?.setVisible(false); this.prompt?.setVisible(false); return; }
    const waiting = s.pendingStoryX !== undefined && s.lockX0 < 0;
    const ready = s.encDone >= s.encTotal && s.lockX0 < 0 && !s.won && (!stage.tunnel || s.halt >= HALT_MS);
    const pulse = 0.55 + 0.45 * Math.sin(this.time.now / 220) ** 2;
    this.exitLabel ??= this.add.text(0, 0, '↓\nВЫХОД', { ...textStyle(12, '#ffe45c'), align: 'center' }).setOrigin(0.5, 1).setDepth(2001);
    this.exitLabel.setVisible(ready && !!stage.exit).setAlpha(pulse);
    if (ready && stage.exit) {
      const e = stage.exit, y = Math.min(e.y1, stage.laneBottom);
      this.exitLabel.setPosition((e.x0 + e.x1) / 2, y - 22);
      this.guide.lineStyle(2, 0xffe45c, pulse).strokeRect(e.x0, y - 20, e.x1 - e.x0, 20);
    }
    const braking = !!stage.tunnel && s.halt >= 0 && s.halt < HALT_MS;
    const goal = waiting ? s.pendingStoryX : ready ? stage.exit?.x0 : s.lockX0 < 0 ? ENCOUNTERS[stage.id]?.[s.encDone]?.trigger : undefined;
    this.prompt ??= this.add.text(0, 120, '', { ...textStyle(10, '#ffe45c'), align: 'center' }).setOrigin(0.5).setScrollFactor(0).setDepth(2100);
    this.prompt.setPosition(braking ? this.scale.width / 2 : this.scale.width - 52, 120).setText(braking ? STORY.service.halt : waiting || goal !== undefined && goal > cam.scrollX + this.scale.width ? `→\n${ready && !waiting ? 'ВЫХОД' : 'ВПЕРЁД'}` : '').setAlpha(pulse).setVisible(true);
    if (s.lockX0 >= 0) for (const e of s.enemies.values()) {
      if (e.hp <= 0 || e.x >= cam.scrollX && e.x <= cam.scrollX + this.scale.width) continue;
      const left = e.x < cam.scrollX, x = cam.scrollX + (left ? 5 : this.scale.width - 5), d = left ? 1 : -1;
      this.guide.fillStyle(0xff3b30).fillTriangle(x, e.y - 6, x, e.y + 6, x - d * 6, e.y);
    }
    if (stage.tunnel && s.halt >= HALT_MS && !this.stopped) {
      this.stopped = true; this.stoppedAt = this.time.now; shake(cam, 120, 0.003);
      const t = this.add.text(this.scale.width / 2, VIEW_H / 2, STORY.service.station, textStyle(10, '#ffe45c')).setOrigin(0.5).setScrollFactor(0).setDepth(2500);
      this.time.delayedCall(1000, () => t.destroy());
    }
  }

  update(_time: number, delta: number) {
    const smp = this.sample();
    if (!smp) return;
    let { a, b, f } = smp;
    const latestStage = this.session.snapshots[this.session.snapshots.length - 1];
    if (latestStage.storyScene || latestStage.stage !== b.stage || latestStage.level !== b.level) { a = b = latestStage; f = 1; }
    // При входе по коду уровень может стать известен уже после preload.
    if (b.level === 'old' && !this.oldLevelReady) {
      if (!this.oldLevelLoading) {
        this.oldLevelLoading = true;
        preloadLevel(this);
        this.load.once(Phaser.Loader.Events.COMPLETE, () => {
          this.oldLevelReady = true; this.oldLevelLoading = false;
        });
        this.load.start();
      }
      return;
    }
    const locationKey = b.level + ':' + b.stage;
    if (locationKey !== this.locationKey) {
      const first = !this.locationKey;
      const sameStage = this.locationKey.split(':').slice(0, 2).join(':') === `${b.level}:${b.stage}`;
      this.bossShow?.destroy(); this.bossShow = undefined;
      this.stageView?.destroy();
      this.tweens.killAll(); this.time.removeAllEvents();
      this.children.removeAll(true); this.views.clear(); this.prompt = undefined;
      this.floorFx = this.shotFx = this.guide = undefined; this.bossHp = undefined; this.bossName = undefined;
      this.exitLabel = undefined; this.stopped = false;
      this.locationKey = locationKey;
      const baseStage = LEVELS[b.level].stages[b.stage];
      const stage = baseStage;
      this.worldWidth = stage.width;
      if (b.level === 'old') { buildLevel(this); showCard(this); debugLane(this, stage); }
      else this.stageView = new StageView(this, stage);
      if (!sameStage) this.camX = undefined;
      this.layout();
      const me = b.players.get(this.session.me);
      if (me && !sameStage) this.follow(me.x);
      if (!first && !sameStage) this.cameras.main.fadeIn(350);
    }
    this.audio.update(latestStage, this.cameras.main.scrollX, this.scale.width, delta);
    const pace = this.session.isPaused() || latestStage.storyScene || latestStage.pauseMs ? 0 : latestStage.slowmoMs ? 0.3 : 1;
    if (b.level === 'route' && b.stage === 4) {
      this.bossShow ??= new BossShow(this, b);
      this.bossShow.update(latestStage, delta * pace);
    } else { this.bossShow?.destroy(); this.bossShow = undefined; }
    this.stageView?.update(delta * pace, latestStage.halt);
    const seen = new Set<string>();
    const draw = (key: string, isPlayer: boolean, sa: EntitySnap | undefined, sb: EntitySnap, live = false) => {
      seen.add(key);
      if (isPlayer && sa?.char !== sb.char) sa = sb;
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
        const clips = (kind === 'katya' ? KATYA_ANIMS : ENEMY_ANIMS[kind])!;
        const casting = !!sb.boss && !!sb.atk && BOSS_ATTACK[sb.atk]?.kind !== 'melee' && (sb.phase === 'windup' || sb.phase === 'active' || sb.phase === 'recover');
        let clip = sb.carried ? 'idle' : sb.anim === 'enter' || sb.anim === 'run' ? 'walk' : sb.anim === 'down' ? 'fall' : sb.anim === 'hurt' ? 'hurt' : casting ? (sb.phase !== 'windup' && clips.release ? 'release' : 'cast') : sb.anim;
        if (casting && sb.phase === 'active' && !v.castActive) { v.enemySince = this.time.now; v.castActive = true; }
        if (sb.phase === 'windup' || !casting) v.castActive = false;
        if (clip === 'dash' && !clips.dash) clip = 'strike';
        if (!clips[clip]) clip = 'idle';
        const def = clips[clip];
        if (def) {
          if (v.enemyClip !== clip) { v.enemyClip = clip; v.enemySince = this.time.now; }
          if (v.enemySince !== undefined) v.enemySince += delta * ((sb.ultStopMs ?? 0) > 0 ? 1 : 1 - pace * (sb.anim === 'run' ? ENTER_ANIM_RATE : 1));
          const raw = Math.max(0, Math.floor((this.time.now - (v.enemySince ?? this.time.now)) * def.fps / 1000));
          const frame = sb.carried ? 0 : def.loop && clip !== 'windup' && clip !== 'cast' && clip !== 'release' ? raw % def.frames : Math.min(def.frames - 1, raw);
          this.audio.frame(key.slice(2), sb, false, clip, frame, def.frames);
          v.sprite.setTexture(`enemy/${kind}/${clip}`, frame).setFlipX(sb.facing < 0).setPosition(x, y - lift).setDepth(y).setVisible(!(sb.boss === 'shaman' && (sb.enterMs ?? 0) > 200)).setAlpha(sb.anim === 'enter' ? Math.min(1, (this.time.now - (v.enemySince ?? this.time.now)) / 500) : sb.phase === 'recover' ? 0.7 : 1);
        }
      }
      if (v.sprite && !isPlayer) {
        const sp = v.sprite;
        const baseScale = SCALE * (ENEMY_SCALE[sb.boss || sb.kind || 'omon'] ?? 1);
        const owner = sb.carryBy ? b.players.get(sb.carryBy) : undefined;
        const phase = owner?.move;
        const spinning = phase === 'a3-spin' && !sb.thrown;
        const spin = ramilSpin(owner?.moveT ?? 0), theta = spin.angle;
        if (sb.carried && (owner || sb.thrown)) {
          const facing = owner && owner.facing < 0 ? -1 : 1;
          const wobble = Math.sin(this.time.now / (phase === 'a2-walk' ? 85 : 160));
          const handSprite = owner ? this.views.get('p:' + sb.carryBy)?.sprite : undefined;
          const handFrame = Number(handSprite?.frame.name ?? 0);
          const grip = RAMIL_GRIP[phase ?? '']?.[handFrame] ?? [84, 57];
          const handX = (facing < 0 ? 127 - grip[0] : grip[0]) - 64;
          const handY = (grip[1] - FEET_Y) * SCALE;
          const neck = 46 * baseScale;
          const previousTilt = spin.turn ? RAMIL.SPIN_TILT[spin.turn - 1] : 0;
          const tilt = (previousTilt + (RAMIL.SPIN_TILT[spin.turn] - previousTilt) * spin.phase) * Math.PI / 180;
          const sx = spinning ? owner!.x + Math.cos(theta) * RAMIL.SPIN_R * facing : owner?.x ?? x;
          const sy = spinning ? owner!.y + Math.sin(theta) * RAMIL.SPIN_R * 0.3 : owner?.y ?? y;
          const heldScale = sb.thrown ? baseScale : Math.min(baseScale, Math.max(0.1, (-handY - 10) / 46));
          sp.setTexture(`enemy/${sb.boss || sb.kind || 'omon'}/hurt`, 0)
            .setOrigin(0.5, (FEET_Y - 46) / CELL).setScale(heldScale).setFlipX(facing < 0)
            .setRotation(sb.thrown ? sb.carryAngle ?? 0 : spinning ? (spin.turn > 0 ? -facing * 80 * Math.PI / 180 : -Math.cos(theta) * facing * tilt) : -facing * (7 + wobble * 3) * Math.PI / 180)
            .setPosition(sb.thrown ? x : spinning ? sx : sx + handX * SCALE,
              sb.thrown ? y - (sb.carryHeight ?? 0) - neck : sy + handY)
            .setDepth(sb.thrown ? y + 2 : owner!.y + (spinning && Math.sin(theta) < 0 ? -0.2 : 0.2))
            .setAlpha(spinning && Math.sin(theta) < 0 ? (spin.turn > 0 ? 0 : 0.5) : 1);
          if (!sb.thrown) v.shadow?.setPosition(sp.x,sy).setScale(1);
          if (spinning && spin.turn === 0 && this.time.now - (v.spinFxAt ?? 0) >= 45) {
            v.spinFxAt = this.time.now;
            const ox = owner!.x, oy = owner!.y;
            for (let i = 0; i < 3; i++) {
              const arc = this.add.graphics().setDepth(oy + 0.3).lineStyle(1 + spin.turn, 0xffffff, 0.15 + spin.turn * 0.12);
              arc.beginPath();
              for (let j = 0; j <= 12; j++) {
                const a = theta - j * 0.09 - i * 2;
                const ax = ox + Math.cos(a) * (38 + i * 5), ay = oy + handY + Math.sin(a) * (12 + i * 2);
                if (!j) arc.moveTo(ax,ay); else arc.lineTo(ax,ay);
              }
              arc.strokePath();
              this.tweens.add({targets: arc, alpha: 0, duration: 120, onComplete: () => arc.destroy()});
            }
            shake(this.cameras.main, 55,0.0004*(spin.turn+1));
          }
          if (spinning && spin.turn === 0 && this.time.now - (v.spinDustAt ?? 0) >= RAMIL.SPIN_DUST_MS) {
            v.spinDustAt = this.time.now;
            this.fx('ramil-dust', owner!.x, owner!.y, { scale: 0.6, depth: owner!.y - 0.05 })?.setRotation(theta);
          }
        } else sp.setOrigin(0.5, FEET_Y / CELL).setRotation(0).setScale(baseScale);
        if (sb.thrown) {
          v.meteor ??= this.add.graphics(); v.meteor.clear().setDepth((sb.meteorY ?? y) - 0.05);
          const mt = sb.meteorMs ?? 0, tx = sb.meteorX ?? x, ty = sb.meteorY ?? y;
          const grow = Math.max(0, Math.min(1, (mt - RAMIL.METEOR_UP_MS) / RAMIL.METEOR_HANG_MS));
          v.meteor.fillStyle(0x100e18,0.6).fillEllipse(tx,ty,90*grow,30*grow)
            .lineStyle(2,0xff3333,Math.floor(mt/85)%2 ? 0.9 : 0.3).strokeEllipse(tx,ty,90*grow,30*grow);
          v.shadow?.setVisible(false);
          if (mt >= RAMIL.METEOR_UP_MS + RAMIL.METEOR_HANG_MS) {
            v.meteor.lineStyle(1,0xffffff,0.7);
            for (let i = -2; i <= 2; i++) v.meteor.lineBetween(x+i*8,sp.y-70,x+i*8,sp.y-15);
          }
        } else { v.meteor?.clear(); v.shadow?.setVisible(true); }
        if ((v.stopUntil ?? 0) > this.time.now) sp.setPosition(v.stoppedX ?? sp.x,v.stoppedY ?? sp.y);
        if ((v.flashUntil ?? 0) > this.time.now) { sp.setTintMode(Phaser.TintModes.FILL).setTint(0xffffff); sp.x += Math.floor(this.time.now / 10) % 2 ? 2 : -2; }
        else sp.clearTint();
      }
      if (v.sprite && isPlayer) {
        const lead = live && pace > 0 ? Math.min(TICK_MS, (performance.now() - this.session.snapshots[this.session.snapshots.length - 1].t) * pace) : 0;
        this.drawHero(key.slice(2), v, sb, x, y, live ? 1 : f, !!away, lead);
      }
      // Замороженный враг синий с ледяной окантовкой
      v.body.setFillStyle(sb.frozen ? ICE : sb.anim === 'hurt' ? 0xffffff : (isPlayer ? (CHARACTERS.find(c => c.id === sb.char)?.color ?? 0xffffff) : sb.phase === 'active' && this.time.now - (v.enemySince ?? this.time.now) < 65 ? 0xffffff : sb.dummy ? 0xb08d57 : ENEMY_LOOK[sb.boss || sb.kind || 'omon'][0]));
      if (sb.frozen) v.body.setStrokeStyle(2, 0xe8f8ff); else v.body.setStrokeStyle();
      if (isPlayer) this.drawStorm(v, sb, x, y);
      else this.drawStatus(v, sb, x, y - lift);
      const hitting = !v.sprite && (sb.anim === 'attack' || sb.anim === 'heavy');
      v.fist.setVisible(hitting).setPosition(x + sb.facing * (sb.anim === 'heavy' ? 16 : 12), y - 18).setSize(sb.anim === 'heavy' ? 14 : 10, 5).setDepth(y + 0.5);
      const maxHp = sb.maxHp ?? (isPlayer ? PLAYER_HP : 100);
      const head = v.sprite ? (isPlayer ? HEAD : HEAD * (ENEMY_SCALE[sb.boss || sb.kind || 'omon'] ?? 1)) : isPlayer ? 86 : 80;
      v.hp.setPosition(x - 20, y - head - lift).setDepth(y + 0.6).setSize(40 * Math.max(0, sb.hp) / maxHp, 3);
      v.label?.setPosition(x, y - head - 3 - lift).setDepth(y + 0.7);
      if (!isPlayer) { const hidden = sb.boss === 'shaman' && (sb.enterMs ?? 0) > 200; v.shadow?.setVisible(!hidden); v.hp.setVisible(!hidden); }
      if (this.session.snapshots.at(-1)?.storyScene) v.hp.setVisible(false);
      else if (isPlayer) v.hp.setVisible(key !== 'p:' + this.session.me);
      v.bubble?.setPosition(x, y - HEAD - 18);
    };
    // Свою героиню рисуем по самому свежему снимку: отставание 60 мс остаётся только у остальных
    const latest = this.session.snapshots[this.session.snapshots.length - 1];
    for (const [id, sb] of b.players) {
      const mine = id === this.session.me ? latest?.players.get(id) : undefined;
      if (mine) { draw('p:' + id, true, undefined, mine, true); }
      else draw('p:' + id, true, a.players.get(id), sb);
    }
    const focus = latest.players.get(this.session.me);
    if (latest.storyCamX !== undefined && Math.abs(latest.storyCamX - this.cameras.main.midPoint.x) > this.scale.width / 2) this.camX = undefined;
    if (latest.storyCamX !== undefined) this.follow(latest.storyCamX, delta / 1000, true);
    else if (focus) this.follow(focus.x, delta / 1000);
    this.drawGuides(latest);
    for (const t of this.telegraphs) t.until += delta * (1 - pace);
    for (const b of this.attackBands) b.until += delta * (1 - pace);
    this.drawBossFx(latest);
    if (LEVELS[latest.level].stages[latest.stage].tunnel && this.stopped && this.time.now - this.stoppedAt < 1000) { this.exitLabel?.setVisible(false); this.prompt?.setVisible(false); }
    if (latest.finaleReady || latest.level === 'old' && latest.won) void showFinale(() => this.replay());
    for (const [id, sb] of b.enemies) {
      if (latest.storyScene && sb.boss && [...latest.actors.values()].some(actor => actor.look === sb.boss)) continue;
      draw('e:' + id, false, a.enemies.get(id), sb);
    }
    this.drawActors(latest);
    drawStoryBubble(this, this.scene.get('ui'), latest);
    for (const [key, v] of this.views) {
      if (seen.has(key)) continue;
      this.destroyView(key, v);
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
  // Поворот, появление/исчезновение панелей Safari: подгоняем ширину и заново
  // измеряем DOM-границы canvas, по которым Phaser переводит касания в координаты игры.
  const refit = () => {
    game.scale.setGameSize(viewWidth(), VIEW_H);
    game.scale.updateBounds();
  };
  let refitTimer = 0;
  const scheduleRefit = () => {
    window.clearTimeout(refitTimer);
    refitTimer = window.setTimeout(refit, 100);
  };
  window.addEventListener('resize', scheduleRefit);
  window.visualViewport?.addEventListener('resize', scheduleRefit);
  scheduleRefit();
  game.events.once('destroy', () => {
    window.clearTimeout(refitTimer);
    window.removeEventListener('resize', scheduleRefit);
    window.visualViewport?.removeEventListener('resize', scheduleRefit);
  });
  return game;
}
