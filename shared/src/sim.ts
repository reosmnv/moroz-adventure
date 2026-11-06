import { LINES, LINE_HEROES, CALL_NAMES } from './lines.ts';
// Общая симуляция боя: одна и та же для сервера (онлайн) и браузера (офлайн).
// Чистые данные и функции, без Phaser и Colyseus.
import { LEVELS, stageOf, stageProp, laneTop, laneBottom, levelW, walkBounds, clampToLane } from './levels.ts';
import { KIND, ROLE, MAX_ALIVE, MAX_PEAK_ALIVE, TOKENS_PER_TARGET, TOKENS_TOTAL, TOKEN_GAP_MS, WAIT_RING, GUARD_FRONT_MULT, type EnemyKind } from './enemy-data.ts';
import { BOSS, BOSS_ATTACK, type BossId } from './boss-data.ts';
import { ENCOUNTERS, type Spawn } from './encounters.ts';
import { HERO_ANIMS, type Form } from './anims-data.ts';
import {
  ramilSpin, RAMIL_ID, RAMIL, RAMIL_SMOKE_LINES, RAMIL_FINISH_WORDS, HOP_MS, HOP_DIST, ATTACK_BAND, MAGNET_GAP, MAGNET_DIST, RUSH_DIST, LAUNCH_H, JUGGLE_REFRESH_MS, JUGGLE_MULT, JUGGLE_STEP, JUGGLE_MULT_MAX, JUGGLE_MAX_MS, SLAM_MULT, BOUNCE_MS, BOUNCE_H, HIT_CHAIN_MS, PIN_MS, PIN_KB_MIN, PIN_SIZE, PIN_DMG, PIN_KB, KILL_EXTEND_MS, AIR_CHARGE_MULT,
  AIR_MS, AIM_MS, BALL_FLIGHT_MS, BALL_LINES, BALL_PER_HIT, BALL_NEAR_NASTYA, BALL_RADIUS, BALL_THROW, BEAM_DMG, BEAM_LEN, CHAIN, CHARM_LINE, CHARM_MS, COMBO_MS, COMBO_MS_BY,
  CONTROL_ULT, DASH_DELAY_MS, DASH_DIST, FLASH_CD_MS, FLASH_SPEED, HEAVY, HERO_FORM, HERO_ID, HURT_INVULN_MS, FREEZE_MS, HITSTOP_HEAVY_MS, HITSTOP_MS,
  IMMUNE_INVULN_MS, KISS_BAND, KISS_HALF_W, KISS_SPEED, KNOCK_MULT, KRIS_ID, KRIS_LENS, NADYA_ID, NADYA_B_COOLDOWN_MS, NEXT_MOVE, RANGE_MULT, RUN_MULT, SAMURAI_TIME_MULT, STORM_DMG, STORM_MS, STORM_RADIUS, STORM_TICK_MS, SPEED_MULT, STRIKES, ULT_MS,
  flurryTiming, hitTimesMs, isLoop, isSpriteHero, moveDurMs, moveTotalMs, type Strike,
} from './hero-data.ts';

export const TICK_MS = 17; // ~60 Гц: нажатие ждёт тик не дольше 17 мс
export const VIEW_W = 480;
export const VIEW_H = 270;
export const LANE_TOP = 168; // линия стены на фоне уровня 1
export const LANE_BOTTOM = 255;
export const LEVEL_W = 1920; // длина уровня: 4 экрана по 480

// Доступность тест-режима в меню. Режим игры хранится в world.testTools
export const TEST_TOOLS = true;

const PLAYER_SPEED = 90; // единиц в секунду
const ENEMY_DMG = 7;
export const PLAYER_HP = 150;
const REVIVE_MS = 5000;
const TAUNT_CD_MS = 3000;
const LANE_TOLERANCE = 24;

export const ENTER_OFF = 340;
export const ENTER_SPEED = 150;
const ENTER_MARGIN = 40;
export const HALT_MS = 2500;
export const CINE_MS = 2800;

export type Anim = 'enter' | 'idle' | 'walk' | 'run' | 'attack' | 'heavy' | 'hurt' | 'down' | 'taunt' | 'ult' | 'windup' | 'strike' | 'dash' | 'recover';

export interface Character {
  id: string;
  name: string;
  color: number;
  taunts: string[];
}

// Реплики временные, до решения mr.R. Четвёртый слот пока заглушка-прямоугольник
export const CHARACTERS: Character[] = [
  { id: HERO_ID, name: 'Анастасия', color: 0x9d74d4, taunts: ['В эфире тишина. Сейчас будет громко', 'Дубль второй не понадобится', 'Сделаем погромче', 'Это был саундчек'] },
  { id: NADYA_ID, name: 'Надежда', color: 0xc2185b, taunts: ['Ты точно ко мне?', 'Не строй планов', 'Шансов не было', 'Очередь занимай', 'А котик у тебя есть?'] },
  { id: KRIS_ID, name: 'Kris', color: 0x9be33b, taunts: ['Свет плохой, давай ещё дубль', 'Стоп, снято', 'Улыбочку', 'Это в бэкстейдж', 'Не моргай, пишу'] },
  { id: RAMIL_ID, name: 'Рамиль', color: 0xe8743b, taunts: ['Ща-ща, докурю', 'Не суетись', 'Я даже не встал толком', 'Перекур, мужики', 'Без нервов'] },
];

export interface Player {
  god?: boolean;
  idleInput?: boolean;
  viewX?: number; viewW?: number;
  ultLevel?: number; ultWindow?: number;
  fDashMs?: number; hiddenMs?: number; heavySmokeMs?: number; fireMs?: number;
  ramil?: { marks: string[]; dash?: { fromX: number; fromY: number; x: number; y: number }; markMs: number; originX: number; originY: number; smokeMs: number; smokeLine: number;
    fireHit: string[]; tele?: { ms: number; x: number; y: number; target?: string; back: boolean };
    grab?: string; holdMs?: number; spinHits?: string[];
    ult?: { ms: number; count: number; target: string; level: number; buffered: boolean; window: number; finish?: number; stunned: string[]; emptyMs?: number; dashMs?: number; dashFromX?: number; dashFromY?: number; dashX?: number; dashY?: number } };

  id: string;
  char: string;
  x: number;
  y: number;
  hp: number;
  facing: 1 | -1;
  anim: Anim;
  animMs: number;
  cdMs: number;
  bCooldownMs: number;
  bChainActive?: boolean;
  fireFacing?: 1 | -1;
  shooting?: boolean;
  fireNeedsRelease?: boolean;
  tauntCdMs: number;
  ult: number; // 0..100
  downMs: number;
  connected: boolean;
  away: boolean; // свернул браузер: мир его не трогает
  // Боевой набор Анастасии (у остальных стоят значения по умолчанию)
  form: Form;
  move: string; // имя анимации спрайта: jab, walk, fall...
  moveT: number; // мс с начала анимации
  combo: number; // сколько ударов серии A уже нанесено (0..2)
  comboMs: number;
  queued: 'attack' | 'heavy' | null;
  formMs: number; // сколько осталось быть Ultimate
  invulnMs: number;
  hitstopMs: number; // героиня замирает на мгновение после попадания
  stormMs: number; // сколько ещё идёт снежная буря
  stormTickMs: number;
  bCombo: number; // Анастасия и Надя: сколько ударов серии B уже нанесено (0..2)
  bComboMs: number;
  charge2: number; // Kris: шкала шара 0..100, копится от попаданий вспышкой
  dashFrom: number; // Надя: откуда начался рывок самурая
  charmSaid: boolean; // Надя: реплика ревности уже прозвучала за эту ульту
  hitCount: number;
  hitCountMs: number;
  ultimateExtraMs: number; // уже добавленное куражом время
  approach?: { x: number; y: number; tx: number; ty: number; ms: number; rush: boolean; target: string };
  hop?: { from: number; to: number };
  wantBall: boolean; // Kris: шар нажат, пока была занята; полетит, как только сможет
}

export interface Enemy {
  held?: { by: string }; carryAngle?: number; carryHeight?: number;
  thrown?: { by: string; ms: number; fromX: number; fromY: number; x: number; y: number };
  ultStopMs?: number; ultStopBy?: string; ultStunBy?: string;

  burnMs?: number; burnTickMs?: number; burnBy?: string; markedBy?: string;

  entered?: boolean; entering?: boolean; enterMs?: number; bornTick?: number;
  boss?: BossId; bossPhase?: 1 | 2; atk?: string;
  atkIndex?: number; cooldowns?: Record<string, number>; invulnMs?: number;
  deathMs?: number; shotCount?: number; shotMs?: number; wideToken?: boolean;
  bands?: { y: number; h: number }[];
  zonePoints?: { x: number; y: number }[];
  kind: EnemyKind;
  phase: 'enter' | 'none' | 'windup' | 'active' | 'recover';
  phaseMs: number;
  token?: string;
  atkX?: number;
  atkY?: number;
  atkDir?: 1 | -1;
  dashLeft?: number;
  struck?: boolean;
  target?: string;
  targetMs?: number;
  waitMs?: number;
  id: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  facing: 1 | -1;
  anim: Anim;
  animMs: number;
  cdMs: number;
  frozenBy?: string;
  frozenMs?: number; // заморожен: стоит и не бьёт, получает урон без отбрасывания
  air?: number; // мс до приземления
  height?: number; // высота над землёй из sim
  airTotal?: number;
  airSpan?: number;
  airPeak?: number;
  airStartH?: number;
  airHits?: number;
  bouncing?: boolean;
  pin?: { ms: number; speed: number; dir: number; by: string; hit: string[]; noCollateral?: boolean };
  dummy?: boolean; // манекен: стоит, не бьёт, не умирает
  slowMs?: number; slow?: number; // замедлен: сколько ещё и какую долю скорости теряет
  stunMs?: number; // оглушён: стоит и не бьёт
  charmMs?: number; charmBy?: string; // ревность: бьёт других врагов, а не героев
  homeX?: number;
  homeY?: number;
}

export interface BossShot { x: number; y: number; dir: number; speed: number; dmg: number }
export interface BossZone { x: number; y: number; r: number; ms: number; tickMs: number; dmg: number }
export interface Actor {
  id: string; look: string; x: number; y: number; tx: number; ty: number;
  facing: 1 | -1; anim: string; speed: number; keep?: boolean;
}

export interface World {
  actors: Record<string, Actor>;
  storyCamX?: number; storyStrict?: boolean;
  storyPizDown?: boolean;
  storyPushes?: number[]; storyReady?: string[]; storyLineAt?: number; storyManualAt?: number;
  storyLast?: { id: string; line: string; at: number }[]; storyKiss?: boolean;

  pauseMs?: number; slowmoMs?: number;
  halt: number; introduced: string[]; cine?: { id: string; kind: string; ms: number };
  shots: BossShot[]; zones: BossZone[];
  timeMs: number;
  tokenReleased: Record<string, number>;
  won: boolean;
  enc: { stage: number; index: number; wave: number; queue: Spawn[]; lock: [number, number] | null; cleared: number; bossIndex?: number; bossStarted?: boolean; bossWait?: number; spawnMs?: number };
  level: 'route' | 'old';
  stage: number;
  trans?: { ms: number; to: number };
  exitEvent?: boolean;
  tick: number;
  seed: number;
  wave: number;
  nextEnemyId: number;
  players: Record<string, Player>;
  enemies: Record<string, Enemy>;
  testTools: boolean;
  events?: SimEvent[]; // события команд до ближайшего тика
  pending: Pending[]; // отложенные удары: долетевшая вспышка, взрыв шара, урон после рывка, луч, летящий поцелуй
}

// Удар, который случится позже: ids (по списку врагов), aoe (круг), beam (полоса луча),
// kiss (сердце летит от x к краю уровня по dir, ids = кого уже задело)
export interface Pending { ms: number; kind: 'hits' | 'aoe' | 'beam' | 'kiss'; owner: string; strike: Strike; ids?: string[]; x?: number; y?: number; r?: number; dir?: 1 | -1; flash?: boolean }

export interface Input {
  viewX?: number; viewW?: number;
  skip?: boolean;
  mx: number; // -1..1
  my: number; // -1..1
  attack: boolean;
  heavy: boolean;
  taunt: boolean;
  ult: boolean;
  ult2: boolean; // вторая кнопка: снежная буря Анастасии, шар Kris
  run: boolean; // стик на максимуме или Shift
  fireHeld?: boolean; // удерживаемая стрельба Kris; новый зажим нужен после прерывания
}

export const emptyInput = (): Input => ({ mx: 0, my: 0, attack: false, heavy: false, taunt: false, ult: false, ult2: false, run: false, fireHeld: false });

export type SimEvent =
  | { t: 'switch'; id: string; char: string }
  | { t: 'rdash'; id: string; fromX: number; fromY: number; toX: number; toY: number }
  | { t: 'rstage'; id: string; level: number; x: number; y: number }
  | { t: 'rspinHit'; id: string; target: string; x: number; y: number }
  | { t: 'rland'; x: number; y: number }
  | { t: 'rfinish'; id: string; x: number; y: number; line: string }
  | { t: 'flurry'; id: string; level: number; k: number; x: number; y: number }
  | { t: 'tele'; id: string; fromX: number; fromY: number; toX: number; toY: number; shape?: never; ms?: never }
  | { t: 'cine'; id: string; kind: string }
  | { t: 'boss' | 'phase' | 'bossDown'; id: string }
  | { t: 'bossFx'; id: string; attack: string; x: number; y: number; h?: number; ms: number; tint?: number }
  | { t: 'tele'; id: string; shape: 'ring' | 'line' | 'column' | 'zone' | 'ban' | 'grid'; attack?: string; delayMs?: number; x: number; y: number; r?: number; h?: number; dir?: number; ms: number }

  | { t: 'lock'; x0: number; x1: number }
  | { t: 'clear' }
  | { t: 'victory' }
  | { t: 'block'; id: string }
  | { t: 'exit'; to: number }
  | { t: 'stage'; stage: number }
  | { t: 'hit'; target: string; dmg: number; x: number; y: number; word?: string; by?: string; impact?: 1 | 2; kill?: true; tick?: true; flurry?: { level: number; k: number } }
  | { t: 'shot'; id: string; x: number; y: number; tx: number; ty: number } // вспышка Kris летит
  | { t: 'ball'; id: string; x: number; y: number; tx: number; ty: number } // шар Kris летит
  | { t: 'boom'; id: string; x: number; y: number; kind: 'ball' }
  | { t: 'kiss'; id: string; x: number; y: number; tx: number } // воздушный поцелуй Нади летит до края уровня
  | { t: 'charm'; target: string; x: number; y: number } // поцелуй задел врага
  | { t: 'aim'; id: string; x: number; y: number; dir: number }
  | { t: 'beam'; id: string; x: number; y: number; dir: number; len: number }
  | { t: 'dash'; id: string; x0: number; x1: number; y: number }
  | { t: 'taunt'; id: string; line: string }
  | { t: 'ult'; id: string }
  | { t: 'storm'; id: string }
  | { t: 'heal'; id: string; amount: number }
  | { t: 'down'; id: string }
  | { t: 'wave'; n: number }
  | { t: 'restart' };

// Детерминированный генератор, состояние хранится в мире
function rand(w: World): number {
  w.seed = (w.seed + 0x6d2b79f5) | 0;
  let t = w.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// Середина между живыми игроками: от неё спавнятся враги и считается край экрана
function focusX(w: World): number {
  const ps = Object.values(w.players).filter(p => p.connected);
  return ps.length ? ps.reduce((s, p) => s + p.x, 0) / ps.length : VIEW_W / 2;
}

export function createWorld(seed = 1, testTools = false, level: 'route' | 'old' = 'route', stage = 0): World {
  stage = Number.isInteger(stage) && stage >= 0 && stage < LEVELS[level].stages.length ? stage : 0;
  return { actors: {}, halt: -1, introduced: [], shots: [], zones: [], timeMs: 0, tokenReleased: {}, won: false, enc: { stage, index: 0, wave: 0, queue: [], lock: null, cleared: 0 }, level, stage, tick: 0, seed, wave: 0, nextEnemyId: 1, players: {}, enemies: {}, testTools, pending: [] };
}

export function takenChars(w: World): string[] {
  return Object.values(w.players).map(p => p.char);
}

export function addPlayer(w: World, id: string, char: string): Player {
  // Новичок появляется рядом с живым игроком, а не в начале уровня
  const buddy = Object.values(w.players).find(p => p.connected && p.hp > 0);
  const i = Object.keys(w.players).length;
  const pos = clampToLane(w, buddy ? buddy.x - 30 * i : stageOf(w).spawn[0], buddy ? buddy.y + 20 * i : stageOf(w).spawn[1]);
  const p = freshPlayer(id, char, pos.x, pos.y);
  w.players[id] = p;
  return p;
}

function freshPlayer(id: string, char: string, x: number, y: number): Player {
  return {
    id, char, x, y,
    hp: PLAYER_HP, facing: 1, anim: 'idle', animMs: 0, cdMs: 0, bCooldownMs: 0, tauntCdMs: 0, ult: 0, downMs: 0,
    connected: true, away: false,
    form: HERO_FORM[char] ?? 'prime', move: 'idle', moveT: 0, combo: 0, comboMs: 0, queued: null, formMs: 0, invulnMs: 0, hitstopMs: 0, stormMs: 0, stormTickMs: 0,
    hitCount: 0, hitCountMs: 0, ultimateExtraMs: 0, bCombo: 0, bComboMs: 0, charge2: 0, dashFrom: 0, charmSaid: false, wantBall: false,
  };
}

export function switchHero(w: World, id: string, char: string): boolean {
  const p = w.players[id];
  if (!p || p.char === char || !CHARACTERS.some(c => c.id === char)
    || Object.values(w.players).some(o => o.id !== id && o.char === char)
    || w.trans || w.cine || w.pauseMs || w.won) return false;

  for (const e of Object.values(w.enemies)) {
    if (e.held?.by === id || e.thrown?.by === id) {
      e.held = e.thrown = undefined;
      e.carryAngle = e.carryHeight = e.height = e.air = e.airTotal = e.airHits = 0;
      e.airSpan = e.airPeak = e.airStartH = undefined; e.bouncing = false;
      e.pin = undefined; e.stunMs = 0;
      cancelAttack(w, e); e.anim = 'idle'; e.animMs = 0;
    }
    if (e.markedBy === id) e.markedBy = undefined;
    if (e.burnBy === id) { e.burnBy = undefined; e.burnMs = e.burnTickMs = 0; }
    if (e.charmBy === id) { e.charmBy = undefined; e.charmMs = 0; }
    if (e.pin?.by === id) e.pin = undefined;
    if (e.frozenBy === id) { e.frozenBy = undefined; e.frozenMs = 0; }
    if (e.ultStopBy === id) { e.ultStopBy = undefined; e.ultStopMs = 0; }
    if (e.ultStunBy === id) {
      e.ultStunBy = undefined;
      if (e.stunMs) { e.stunMs = 0; e.animMs = 0; if (e.anim === 'hurt') e.anim = 'idle'; }
    }
    if (e.token === id) { cancelAttack(w, e); if (['windup', 'strike', 'dash', 'recover'].includes(e.anim)) { e.anim = 'idle'; e.animMs = 0; } }
    if (e.target === id) { e.target = undefined; e.targetMs = 0; }
  }
  w.pending = w.pending.filter(d => d.owner !== id);
  w.players[id] = { ...freshPlayer(id, char, p.x, p.y),
    facing: p.facing, connected: p.connected, away: p.away, hp: p.hp, ult: p.ult, god: p.god,
    viewX: p.viewX, viewW: p.viewW };
  (w.events ??= []).push({ t: 'switch', id, char });
  return true;
}

export function testHeal(w: World): void {
  if (!w.testTools) return;
  for (const p of Object.values(w.players)) {
    const amount = PLAYER_HP - p.hp;
    if (p.hp <= 0) {
      heroReset(p); p.anim = 'idle'; p.animMs = p.cdMs = p.hitstopMs = 0;
      p.approach = p.hop = undefined;
    }
    p.hp = PLAYER_HP; p.downMs = 0;
    if (amount > 0) (w.events ??= []).push({ t: 'heal', id: p.id, amount });
  }
}

// Тест: призвать недостающих героев. Стоят без ввода и бессмертны (id с префиксом npc-)
export function testSummon(w: World): void {
  if (!w.testTools) return;
  for (const c of CHARACTERS) if (!takenChars(w).includes(c.id)) {
    const p = addPlayer(w, `npc-${c.id}`, c.id); p.god = true;
  }
}

export function testGod(w: World, id: string, on: boolean): void {
  if (w.testTools && w.players[id] && typeof on === 'boolean') w.players[id].god = on;
}

export function testKillAll(w: World): void {
  if (!w.testTools) return;
  for (const e of Object.values(w.enemies)) {
    if (e.hp <= 0) continue;
    if (e.boss) { e.hp = 1; continue; }
    const dmg = e.hp; e.hp = 0; e.dummy = false;
    cancelAttack(w, e); e.held = e.thrown = e.pin = undefined;
    e.ultStopMs = e.stunMs = e.air = e.height = e.carryAngle = e.carryHeight = 0;
    e.anim = 'down'; e.animMs = AIR_MS;
    (w.events ??= []).push({ t: 'hit', target: e.id, dmg, x: e.x, y: e.y, kill: true, impact: 2 });
  }
}

export function removePlayer(w: World, id: string) {
  delete w.players[id];
}

function ensureDummy(w: World) {
  if (w.level === 'route') return;
  if (Object.values(w.enemies).some(e => e.dummy)) return;
  const id = 'e' + w.nextEnemyId++;
  const x = Math.min(stageOf(w).spawn[0] + 250, levelW(w) - 40);
  const y = (laneTop(w, x) + laneBottom(w)) / 2;
  w.enemies[id] = { kind: 'omon', phase: 'none', phaseMs: 0, id, x, y, hp: 200, maxHp: 200, facing: -1, anim: 'idle', animMs: 0, cdMs: 0, dummy: true, homeX: x, homeY: y };
}

export function chargeUlt(w: World, id: string) {
  if (!w.testTools) return;
  const p = w.players[id];
  if (p) { p.ult = 100; p.charge2 = 100; } // тестовая кнопка: и ульта, и шар Kris
}

export function spawnEnemies(w: World, count: number) {
  if (!w.testTools) return;
  spawnGrunts(w, count);
}

function spawnGrunts(w: World, count: number) {
  if (w.won) return;
  const cx = focusX(w);
  for (let i = 0; i < count; i++) {
    const id = 'e' + w.nextEnemyId++;
    const hp = ROLE.grunt.hp;
    const x = w.enc.lock ? w.enc.lock[1] + ENTER_OFF : cx + 280 + i * 25;
    w.enemies[id] = {
      kind: 'omon', phase: 'none', phaseMs: 0, id,
      x,
      y: laneTop(w, x) + rand(w) * (laneBottom(w) - laneTop(w, x)),
      hp, maxHp: hp, facing: -1, anim: 'walk', animMs: 0, cdMs: 800 + rand(w) * 800,
    };
  }
}

function spawnWave(w: World, ev: SimEvent[]) {
  w.wave++;
  spawnGrunts(w, 2 + w.wave);
  ev.push({ t: 'wave', n: w.wave });
}

type HitOpts = {
  noCollateral?: boolean; flurry?: { level: number; k: number }; tick?: true; kb?: number; stun?: number; down?: boolean; launch?: boolean; slam?: boolean; pin?: boolean; fixedDmg?: boolean; everyone?: boolean; silent?: boolean;
  slowMs?: number; slow?: number; stunMs?: number; single?: boolean; impact?: 1 | 2; word?: string; noCharge?: boolean; flash?: boolean;
};

// Одно попадание по врагу: урон, отлёт, контроль, шкалы героя, событие
function applyHit(w: World, p: Player, e: Enemy, dmg: number, dir: number, ev: SimEvent[], opts: HitOpts, allAround = false) {
  if (!combatReady(w, e) || e.hp <= 0 || (e.invulnMs ?? 0) > 0) return;
  if (w.enc.lock) e.entered = true;
  const heavy = opts.down || opts.launch || opts.slam || opts.pin || opts.stunMs || e.frozenMs;
  const blocked = KIND[e.kind].guard && e.phase !== 'windup' && e.phase !== 'recover'
    && (p.x - e.x) * e.facing > 0 && !e.held && !heavy && !allAround && !opts.noCharge && !opts.flash;
  if (blocked) { dmg *= GUARD_FRONT_MULT; ev.push({ t: 'block', id: e.id }); }
  const armored = !!e.boss || ROLE[KIND[e.kind].role].armor && !heavy;
  if (e.boss ? opts.down && e.phase === 'windup' : (!blocked && !armored) || heavy) cancelAttack(w, e);
  const airborne = (e.air ?? 0) > 0;
  if (p.char === HERO_ID) {
    if (opts.slam) dmg *= SLAM_MULT;
    else if (airborne && !opts.fixedDmg) dmg *= Math.min(JUGGLE_MULT_MAX, JUGGLE_MULT + (e.airHits ?? 0) * JUGGLE_STEP);
    if (airborne) e.airHits = (e.airHits ?? 0) + 1;
    if (!opts.silent) { p.hitCount++; p.hitCountMs = HIT_CHAIN_MS; }
  }
  e.hp -= dmg;
  if (e.hp <= 0 && !e.dummy && p.char === HERO_ID && p.form === 'ultimate') {
    const extra = Math.min(KILL_EXTEND_MS, ULT_MS - p.ultimateExtraMs);
    p.formMs += extra; p.ultimateExtraMs += extra;
  }
  if (!e.held && !e.thrown && !e.frozenMs && !blocked && !armored) {
    e.anim = opts.down || opts.slam || airborne ? 'down' : 'hurt';
    e.animMs = opts.down || opts.slam ? AIR_MS : (opts.stun ?? 250);
    if (opts.slam) setAir(e, BOUNCE_MS, BOUNCE_H, true);
    else if (opts.launch || airborne) {
      if (!airborne) { e.airTotal = 0; e.airHits = 0; }
      setAir(e, airborne ? JUGGLE_REFRESH_MS : AIR_MS, LAUNCH_H, false);
    }
    const kb = airborne || opts.launch ? 0 : (opts.kb ?? (allAround ? 30 : 8));
    if ((opts.pin || opts.down) && kb !== 0) {
      e.pin = { ms: PIN_MS, speed: kb / PIN_MS, dir, by: p.id, hit: [], noCollateral: opts.noCollateral };
    } else e.x = clampEnemyX(w, e.x + dir * kb, e);
  }
  if (e.boss && !e.frozenMs) { e.x = clampEnemyX(w, e.x + dir * (opts.kb ?? 8) * 0.25, e); e.anim = 'hurt'; e.animMs = 120; }
  if (e.held) { e.anim = 'down'; e.animMs = AIR_MS; e.pin = undefined; e.air = 0; }
  if (opts.slowMs) { e.slowMs = opts.slowMs; e.slow = opts.slow ?? 0.5; }
  if (opts.stunMs && !e.boss) { e.stunMs = opts.stunMs; e.ultStunBy = undefined; e.anim = 'hurt'; e.animMs = Math.max(e.animMs, opts.stunMs); }
  if (opts.silent) return;
  if (p.char !== RAMIL_ID && !opts.noCharge && p.form !== 'ultimate') { // в Ultimate шкала не копится
    const control = p.form === 'nadya' && (opts.slowMs || opts.stunMs) ? CONTROL_ULT : 0;
    p.ult = Math.min(100, p.ult + dmg * (p.char === HERO_ID && airborne ? AIR_CHARGE_MULT : 1) + control);
  }
  if (opts.flash) p.charge2 = Math.min(100, p.charge2 + BALL_PER_HIT);
  ev.push({ t: 'hit', target: e.id, dmg, x: e.x, y: e.y, word: opts.word, by: p.id, flurry: opts.flurry, ...(opts.tick ? { tick: true as const } : {}), impact: e.hp <= 0 ? 2 : opts.impact, ...(e.hp <= 0 ? { kill: true as const } : {}) });
}

const combatReady = (w: World, e: Enemy) => !e.thrown && (!w.enc.lock || !e.enterMs && (e.entered || e.x >= w.enc.lock[0] && e.x <= w.enc.lock[1] + ENTER_MARGIN));
// В полосе входа враг уже уязвим, но доходит до границы без скачка.
const clampEnemyX = (w: World, x: number, e: Enemy) => w.enc.lock
  ? e.entered ? clamp(x, w.enc.lock[0] + 12, e.entering ? Math.max(e.x, w.enc.lock[1] - 12) : w.enc.lock[1] - 12) : x
  : clamp(x, Math.max(-40, focusX(w) - 300), Math.min(levelW(w) + 40, focusX(w) + 300));

function setAir(e: Enemy, ms: number, peak: number, bounce: boolean) {
  e.air = ms; e.airSpan = ms; e.airPeak = peak; e.airStartH = bounce ? 0 : (e.height ?? 0); e.bouncing = bounce;
  e.height = e.airStartH; e.pin = undefined;
}

function hitEnemies(w: World, p: Player, range: number, dmg: number, ev: SimEvent[], allAround = false, opts: HitOpts = {}): number {
  let list = Object.values(w.enemies).filter(e => {
    const dx = e.x - p.x;
    const krisSweep = p.form === 'kris' && ['a1-back', 'a2'].includes(p.move);
    const inFront = krisSweep ? dx * p.facing >= 0 : allAround || Math.sign(dx) === p.facing || Math.abs(dx) < 6;
    const inLane = (p.char === HERO_ID || krisSweep) ? Math.abs(e.y - p.y) <= ATTACK_BAND : Math.abs(e.y - p.y) < (allAround ? 60 : LANE_TOLERANCE);
    return combatReady(w, e) && e.hp > 0 && (opts.everyone || (inFront && (krisSweep ? Math.abs(dx) <= range : Math.abs(dx) < range) && inLane));
  });
  if (opts.single && list.length > 1) list = [list.reduce((a, b) => (Math.abs(a.x - p.x) < Math.abs(b.x - p.x) ? a : b))];
  for (const e of list) applyHit(w, p, e, dmg, Math.sign(e.x - p.x || p.facing), ev, opts, allAround);
  return list.length;
}

const strikeOpts = (p: Player, s: Strike): HitOpts => ({ ...s, pin: !(p.form === 'kris' && s.stunMs) && s.kb >= PIN_KB_MIN, kb: s.kb * (p.form === 'kris' && s.stunMs ? 1 : KNOCK_MULT[p.form]), stun: s.stun });


const isHero = (p: Player) => isSpriteHero(p.char);

function startMove(p: Player, move: string) {
  p.approach = undefined;
  p.hop = undefined;
  p.move = move;
  p.moveT = -1; // -1: первый тик попадёт в кадр 0
}

// Смещение за замах; врыв заканчивается в кадре попадания.
function approach(w: World, p: Player) {
  const s = STRIKES[p.form][p.move];
  if (p.char !== HERO_ID || !s) return;
  const front = Object.values(w.enemies).filter(e => combatReady(w, e) && e.hp > 0 && (e.x - p.x) * p.facing > 0 && Math.abs(e.y - p.y) <= ATTACK_BAND);
  const e = front.sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
  if (!e) return;
  const dist = Math.abs(e.x - p.x), range = s.range * RANGE_MULT;
  if (!s.rush && (dist <= range || dist > range + MAGNET_DIST)) return;
  const ms = Math.max(1, hitTimesMs(p.form, p.move, p.facing)[0] ?? 1);
  p.approach = { x: p.x, y: p.y, tx: clamp(p.x + p.facing * (s.rush ? RUSH_DIST : dist - range + MAGNET_GAP), ...walkBounds(w)), ty: e.y, ms, rush: !!s.rush, target: e.id };
  if (s.rush) p.invulnMs = Math.max(p.invulnMs, ms + TICK_MS);
}

// Идёт ли ещё анимация без цикла (удар, превращение, падение)
function moveBusy(p: Player): boolean {
  return !isLoop(p.form, p.move) && p.moveT < moveTotalMs(p.form, p.move, p.facing);
}

function heroDown(p: Player) {
  p.form = HERO_FORM[p.char] ?? 'prime'; p.formMs = 0; p.combo = 0; p.bCombo = 0; p.queued = null;
  p.shooting = false; p.fireNeedsRelease = true; p.bChainActive = false;
  startMove(p, 'fall');
}

function heroReset(p: Player) {
  p.ultLevel = p.ultWindow = 0; p.fDashMs = 0;
  p.bCooldownMs = 0; p.bChainActive = false; p.shooting = false; p.fireFacing = undefined; p.fireNeedsRelease = false;
  p.ramil = undefined; p.hiddenMs = p.heavySmokeMs = p.fireMs = 0;
  p.form = HERO_FORM[p.char] ?? 'prime'; p.formMs = 0; p.combo = 0; p.comboMs = 0; p.bCombo = 0; p.bComboMs = 0; p.queued = null; p.invulnMs = 0; p.stormMs = 0; p.wantBall = false; p.hitCount = 0; p.hitCountMs = 0;
  startMove(p, 'idle');
}

// Особые действия в кадре удара: вспышка и шар Kris, сердце Нади
function special(w: World, p: Player, s: Strike, ev: SimEvent[]) {
  if (s.kind === 'flash') {
    // Летит до первого врага на дорожке перед Kris, урон, когда долетела
    const sx = p.x + p.facing * 20, sy = p.y - 70;
    const front = Object.values(w.enemies).filter(e => combatReady(w, e) && Math.sign(e.x - p.x) === p.facing && Math.abs(e.x - p.x) < s.range && Math.abs(e.y - p.y) < LANE_TOLERANCE);
    const t = front.length ? front.reduce((a, b) => (Math.abs(a.x - p.x) < Math.abs(b.x - p.x) ? a : b)) : undefined;
    const tx = t ? t.x : sx + p.facing * s.range;
    ev.push({ t: 'shot', id: p.id, x: sx, y: sy, tx, ty: t ? t.y - 60 : sy });
    if (t) w.pending.push({ ms: (Math.abs(tx - sx) / FLASH_SPEED) * 1000, kind: 'hits', owner: p.id, strike: s, ids: [t.id], flash: true });
  } else if (s.kind === 'ball') {
    // Шар летит в скопление врагов: сначала рядом с Анастасией, иначе в самое плотное в пределах броска
    const { x: tx, y: ty } = ballTarget(w, p);
    ev.push({ t: 'ball', id: p.id, x: p.x + p.facing * 16, y: p.y - 80, tx, ty });
    ev.push({ t: 'taunt', id: p.id, line: BALL_LINES[Math.floor(rand(w) * BALL_LINES.length)] });
    w.pending.push({ ms: BALL_FLIGHT_MS, kind: 'aoe', owner: p.id, strike: s, x: tx, y: ty, r: BALL_RADIUS });
  } else if (s.kind === 'kiss') {
    // Воздушный поцелуй: сердце летит от Нади до края уровня, ревнуют все, кого задело по пути
    const x = p.x + p.facing * 30;
    p.charmSaid = false;
    ev.push({ t: 'kiss', id: p.id, x, y: p.y, tx: p.facing > 0 ? levelW(w) : 0 });
    w.pending.push({ ms: 0, kind: 'kiss', owner: p.id, strike: s, x, y: p.y, dir: p.facing, ids: [] });
  }
}

// Куда упадёт шар Kris. Кандидаты: позиции врагов; вес = сколько врагов в круге взрыва вокруг
const inBlast = (e: Enemy, x: number, y: number) => Math.abs(e.x - x) <= BALL_RADIUS && Math.abs(e.y - y) <= BALL_RADIUS * 0.6;
function ballTarget(w: World, p: Player): { x: number; y: number } {
  const foes = Object.values(w.enemies).filter(e => combatReady(w, e) && e.hp > 0);
  const best = (cands: Enemy[], from: { x: number; y: number }) => {
    let pick: { x: number; y: number; n: number; d: number } | undefined;
    for (const c of cands) {
      const near = foes.filter(e => inBlast(e, c.x, c.y));
      // Центр скопления: среднее задетых, чтобы круг накрыл всех
      const x = near.reduce((t, e) => t + e.x, 0) / near.length, y = near.reduce((t, e) => t + e.y, 0) / near.length;
      const n = foes.filter(e => inBlast(e, x, y)).length;
      const d = Math.abs(x - from.x) + Math.abs(y - from.y);
      if (!pick || n > pick.n || (n === pick.n && d < pick.d)) pick = { x, y, n, d };
    }
    return pick;
  };
  // Анастасия в игре: шар летит к ней на любом расстоянии (mr.R 30.10): в скопление рядом с ней, без врагов перед ней
  const nastya = Object.values(w.players).find(o => o.char === HERO_ID && o.hp > 0 && o.connected);
  if (nastya) {
    const t = best(foes.filter(e => Math.hypot(e.x - nastya.x, e.y - nastya.y) <= BALL_NEAR_NASTYA), nastya);
    return t ? clampToLane(w, t.x, t.y) : clampToLane(w, nastya.x + nastya.facing * 40, nastya.y);
  }
  // Без Анастасии: самое плотное скопление в пределах броска, иначе перед собой
  const t = best(foes.filter(e => Math.abs(e.x - p.x) <= BALL_THROW), p);
  return t ? clampToLane(w, t.x, t.y) : clampToLane(w, p.x + p.facing * 80, p.y);
}

// Начало и конец звеньев цепочек: рывок Нади, прицел Kris
function enterMove(w: World, p: Player, move: string, ev: SimEvent[]) {
  if (move === 'b3-dash') p.dashFrom = p.x;
  if (move === 'ult-hold') {
    ev.push({ t: 'aim', id: p.id, x: p.x + p.facing * KRIS_LENS.x, y: p.y + KRIS_LENS.y, dir: p.facing });
    w.pending.push({ ms: AIM_MS, kind: 'beam', owner: p.id, strike: { range: BEAM_LEN, dmg: BEAM_DMG, kb: 20, stun: 500 }, dir: p.facing });
  }
}

function leaveMove(w: World, p: Player, move: string, ev: SimEvent[]) {
  if (move === 'b3-dash') {
    const x0 = Math.min(p.dashFrom, p.x) - 20, x1 = Math.max(p.dashFrom, p.x) + 20;
    const ids = Object.values(w.enemies).filter(e => e.x >= x0 && e.x <= x1 && Math.abs(e.y - p.y) < LANE_TOLERANCE * 1.5).map(e => e.id);
    ev.push({ t: 'dash', id: p.id, x0: p.dashFrom, x1: p.x, y: p.y });
    if (ids.length) w.pending.push({ ms: DASH_DELAY_MS * SAMURAI_TIME_MULT, kind: 'hits', owner: p.id, strike: STRIKES.nadya['b3-end'], ids });
  }
}

// Летящий поцелуй: сдвигается каждый тик, задетые обычные враги ревнуют. false, когда долетел до края
function stepKiss(w: World, d: Pending, dtMs: number, ev: SimEvent[]): boolean {
  const dir = d.dir ?? 1;
  const x0 = d.x!, x1 = clamp(x0 + dir * KISS_SPEED * dtMs / 1000, 0, levelW(w));
  d.x = x1;
  const lo = Math.min(x0, x1) - KISS_HALF_W, hi = Math.max(x0, x1) + KISS_HALF_W;
  const hit = d.ids!;
  for (const e of Object.values(w.enemies)) {
    if (!combatReady(w, e) || hit.includes(e.id) || e.x < lo || e.x > hi || Math.abs(e.y - d.y!) > KISS_BAND) continue;
    hit.push(e.id);
    if (e.boss) {
      const line = BOSS[e.boss].kissLine;
      if (line) ev.push({ t: 'taunt', id: e.id, line });
      if (!w.storyKiss) { w.storyKiss = true; ev.push({ t: 'taunt', id: d.owner, line: LINES.kiss }); }
      continue;
    }
    e.charmMs = CHARM_MS; e.charmBy = d.owner;
    ev.push({ t: 'charm', target: e.id, x: e.x, y: e.y });
  }
  return x1 > 0 && x1 < levelW(w);
}

// Отложенные удары: считаются каждый тик, срабатывают, когда время вышло
function stepPending(w: World, dtMs: number, ev: SimEvent[]) {
  stepRamilEffects(w, dtMs, ev);
  const keep: Pending[] = [];
  for (const d of w.pending) {
    if (d.kind === 'kiss') { if (stepKiss(w, d, dtMs, ev)) keep.push(d); continue; }
    d.ms -= dtMs;
    if (d.ms > 0) { keep.push(d); continue; }
    const p = w.players[d.owner];
    if (!p) continue;
    const opts = strikeOpts(p, d.strike);
    if (d.kind === 'hits') {
      for (const id of d.ids ?? []) {
        const e = w.enemies[id];
        if (e) applyHit(w, p, e, d.strike.dmg, Math.sign(e.x - p.x || p.facing), ev, { ...opts, flash: d.flash });
      }
    } else if (d.kind === 'aoe') {
      ev.push({ t: 'boom', id: p.id, x: d.x!, y: d.y!, kind: 'ball' });
      for (const e of Object.values(w.enemies)) {
        if (Math.abs(e.x - d.x!) > d.r! || Math.abs(e.y - d.y!) > d.r! * 0.6) continue;
        applyHit(w, p, e, d.strike.dmg, Math.sign(e.x - d.x!) || 1, ev, opts, true);
      }
    } else if (d.kind === 'beam') {
      // Луч от объектива до края экрана, высотой с Kris; бьёт всех на полосе один раз
      const dir = d.dir ?? p.facing;
      const lx = p.x + dir * KRIS_LENS.x;
      ev.push({ t: 'beam', id: p.id, x: lx, y: p.y + KRIS_LENS.y, dir, len: d.strike.range });
      for (const e of Object.values(w.enemies)) {
        const dx = (e.x - lx) * dir;
        if (dx < -10 || dx > d.strike.range || Math.abs(e.y - p.y) > 30) continue;
        applyHit(w, p, e, d.strike.dmg, dir, ev, { ...opts, noCharge: true });
      }
    }
  }
  w.pending = keep;
}

// Видимая область: та же оценка камеры, что у отскока Kris.
function ramilTargets(w: World, p: Player) {
  const width = p.viewW ?? VIEW_W;
  const left = p.viewX ?? clamp(p.x - width * 0.33, 0, Math.max(0, levelW(w) - width));
  return Object.values(w.enemies).filter(e => e.hp > 0 && combatReady(w, e) && e.x >= left && e.x <= left + width);
}
function ramilUltTarget(w: World, p: Player): Enemy | undefined {
  const all = ramilTargets(w, p).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
  if (!all.length) return;
  const nearest = Math.hypot(all[0].x - p.x, all[0].y - p.y);
  const nearby = all.filter(e => Math.hypot(e.x - p.x, e.y - p.y) <= nearest + RAMIL.ULT_RANGE);
  return nearby.sort((a, b) => {
    const group = (e: Enemy) => all.filter(o => Math.abs(o.x - e.x) <= RAMIL.ULT_RANGE && Math.abs(o.y - e.y) <= ATTACK_BAND).length;
    return group(b) - group(a) || Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y);
  })[0];
}
function startRamilUltDash(w: World, p: Player, u: NonNullable<NonNullable<Player['ramil']>['ult']>, target: Enemy, ev: SimEvent[]): boolean {
  p.facing = target.x < p.x ? -1 : 1;
  const x = clamp(p.x + p.facing * Math.min(RAMIL.ULT_REACH, Math.max(0, Math.abs(target.x - p.x) - RAMIL.A1_GAP)), ...walkBounds(w));
  const to = clampToLane(w, x, target.y);
  if (Math.abs(to.x - p.x) < 1 && Math.abs(to.y - p.y) < 1) return false;
  u.dashFromX = p.x; u.dashFromY = p.y; u.dashX = to.x; u.dashY = to.y; u.dashMs = 0;
  p.fDashMs = RAMIL.ULT_DASH_MS; startMove(p, 'dash');
  ev.push({ t: 'rdash', id: p.id, fromX: p.x, fromY: p.y, toX: to.x, toY: to.y });
  return true;
}
function ramilTele(w: World, p: Player, x: number, y: number, ev: SimEvent[]) {
  const to = clampToLane(w, clamp(x, ...walkBounds(w)), y);
  ev.push({ t: 'tele', id: p.id, fromX: p.x, fromY: p.y, toX: to.x, toY: to.y });
  p.x = to.x; p.y = to.y; p.heavySmokeMs = RAMIL.HEAVY_SMOKE_MS;
}
function ramilStrike(w: World, p: Player, ev: SimEvent[]) {
  const r = p.ramil!, s = STRIKES.ramil[p.move];
  const front = Object.values(w.enemies).filter(e => combatReady(w, e) && e.hp > 0 && (e.x - p.x) * p.facing >= 0 && Math.abs(e.y - p.y) <= ATTACK_BAND)
    .sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x));
  if (p.move === 'b3') { p.fireMs = RAMIL.FIRE_MS; r.fireHit = []; }
  else if (p.move === 'b1' || p.move === 'b4') {
    const back = p.move === 'b4';
    const visible = ramilTargets(w, p);
    const forward = visible.filter(e => (e.x - p.x) * p.facing >= 0);
    const target = back ? r.marks.map(id => w.enemies[id]).filter(e => e && e.hp > 0).sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0] : forward.sort((a, b) => Math.abs(b.x - p.x) - Math.abs(a.x - p.x))[0];
    if (!back && !target) return;
    if (!back) { r.originX = p.x; r.originY = p.y; }
    let x = r.originX, y = r.originY;
    if (target && target.hp > 0) {
      const allies = Object.values(w.players).filter(a => a.id !== p.id && a.connected && a.hp > 0);
      const side = back ? Math.sign((allies.length ? allies.reduce((sum, a) => sum + a.x, 0) / allies.length : r.originX) - target.x) || -p.facing : -target.facing;
      x = target.x + side * (back ? RAMIL.RETURN_GAP : RAMIL.TELE_GAP); y = target.y;
    }
    const to = clampToLane(w, clamp(x, ...walkBounds(w)), y);
    ev.push({ t: 'tele', id: p.id, fromX: p.x, fromY: p.y, toX: to.x, toY: to.y });
    r.tele = { ms: RAMIL.TELE_MS, ...to, target: target?.hp > 0 ? target.id : undefined, back };
    p.hiddenMs = RAMIL.TELE_MS; p.invulnMs = RAMIL.TELE_MS + TICK_MS;
  } else {
    const list = front.filter(e => Math.abs(e.x - p.x) <= s.range);
    for (const id of r.marks) if (w.enemies[id]) w.enemies[id].markedBy = undefined;
    r.marks = list.slice(0, RAMIL.KICK_MAX).map(e => e.id); r.markMs = RAMIL.MARK_MS;
    for (const id of r.marks) { const e = w.enemies[id]; applyHit(w, p, e, s.dmg, p.facing, ev, { ...s, pin: true }); e.markedBy = p.id; if (e.pin) e.pin.hit = [...r.marks]; }
  }
}
function stepRamilEffects(w: World, dt: number, ev: SimEvent[]) {
  for (const e of Object.values(w.enemies)) {
    if ((e.burnMs ?? 0) > 0) {
      e.burnMs = Math.max(0, e.burnMs! - dt); e.burnTickMs = (e.burnTickMs ?? RAMIL.BURN_TICK) - dt;
      if (e.burnTickMs <= 0) {
        e.burnTickMs += RAMIL.BURN_TICK;
        const p = w.players[e.burnBy ?? ''];
        if (p) applyHit(w, p, e, RAMIL.BURN_DMG, p.facing, ev, { tick: true, noCharge: true, kb: 0, stun: 0 });
      }
    }
  }
}
function ramilFront(w: World, p: Player, range: number) {
  return Object.values(w.enemies).filter(e => e.hp > 0 && combatReady(w, e) && (e.x-p.x)*p.facing >= 0 && Math.abs(e.x-p.x) <= range && Math.abs(e.y-p.y) <= ATTACK_BAND).sort((a,b) => Math.abs(a.x-p.x)-Math.abs(b.x-p.x));
}
function clearCarry(e: Enemy) { e.carryAngle = e.carryHeight = 0; e.anim = 'down'; e.animMs = AIR_MS; }
function releaseGrab(w: World, p: Player) {
  const r = p.ramil; if (!r?.grab) return;
  const e = w.enemies[r.grab]; if (e) { e.held = undefined; clearCarry(e); }
  r.grab = undefined; p.combo = 0; p.queued = null;
}
function startRamilDash(w: World, p: Player, e: Enemy, max: number, ev: SimEvent[]) {
  p.fDashMs = 0;
  if (Math.abs(e.x-p.x) <= RAMIL.A1_REACH || Math.abs(e.x-p.x) > max) return;
  const to = clampToLane(w, clamp(e.x-p.facing*RAMIL.A1_GAP, ...walkBounds(w)), e.y);
  p.ramil!.dash = { fromX: p.x, fromY: p.y, ...to }; p.fDashMs = RAMIL.A1_DASH_MS;
  ev.push({ t: 'rdash', id: p.id, fromX: p.x, fromY: p.y, toX: to.x, toY: to.y });
}
function ramilThrowTarget(w: World, p: Player, held: Enemy) {
  const others = ramilTargets(w,p).filter(e => e !== held);
  let best = { x: p.x+p.facing*RAMIL.THROW_EMPTY, y: p.y }, count = 0, distance = Infinity;
  for (const e of others) {
    const group = others.filter(o => Math.hypot(o.x-e.x,o.y-e.y) <= RAMIL.THROW_CLUSTER_R);
    const x = group.reduce((n,o)=>n+o.x,0)/group.length, y = group.reduce((n,o)=>n+o.y,0)/group.length;
    const d = Math.hypot(x-p.x,y-p.y);
    if (group.length > count || group.length === count && d < distance) { best = {x,y}; count = group.length; distance = d; }
  }
  return clampToLane(w, clamp(best.x,...walkBounds(w)), best.y);
}
function stepRamilThrow(w: World, p: Player, e: Enemy, dt: number, ev: SimEvent[]) {
  const t = e.thrown!; t.ms += dt;
  const fallAt = RAMIL.METEOR_UP_MS + RAMIL.METEOR_HANG_MS;
  if (t.ms < RAMIL.METEOR_UP_MS) {
    e.x = t.fromX; e.y = t.fromY;
    e.carryHeight = RAMIL.METEOR_HEIGHT * t.ms / RAMIL.METEOR_UP_MS;
    e.carryAngle = t.ms / RAMIL.METEOR_UP_MS * Math.PI * 4;
  } else {
    e.x = t.x; e.y = t.y;
    e.carryHeight = RAMIL.METEOR_HEIGHT * (1 - clamp((t.ms - fallAt) / RAMIL.METEOR_FALL_MS, 0, 1));
    e.carryAngle = Math.PI;
  }
  if (t.ms < fallAt + RAMIL.METEOR_FALL_MS) return;
  e.thrown = undefined; clearCarry(e); e.x = t.x; e.y = t.y;
  for (const o of Object.values(w.enemies)) if (o !== e && Math.hypot(o.x-e.x,o.y-e.y) <= RAMIL.METEOR_AOE) {
    const dx = o.x-e.x, dy = o.y-e.y, d = Math.hypot(dx,dy);
    const nx = d ? dx/d : p.facing, ny = d ? dy/d : 0;
    if (!combatReady(w,o) || o.hp <= 0 || (o.invulnMs ?? 0) > 0) continue;
    applyHit(w,p,o,RAMIL.METEOR_DMG,nx < 0 ? -1 : 1,ev,{noCollateral:true,down:true,kb:RAMIL.METEOR_KB*Math.abs(nx)});
    if (!o.thrown && !o.held && !o.boss) o.y = clamp(o.y + ny*RAMIL.METEOR_KB, laneTop(w,o.x), laneBottom(w));
  }
  applyHit(w,p,e,RAMIL.METEOR_HELD_DMG,p.facing,ev,{down:true,kb:0,impact:2,word:'СТРАЙК!'});
  ev.push({t:'rland',x:e.x,y:e.y});
}
function moveRamilCarry(w: World, p: Player, inp: Input, dt: number, mult: number) {
  const mx = Number.isFinite(inp.mx) ? clamp(inp.mx, -1, 1) : 0;
  const my = Number.isFinite(inp.my) ? clamp(inp.my, -1, 1) : 0;
  p.x = clamp(p.x + mx * PLAYER_SPEED * mult * dt / 1000, ...walkBounds(w));
  p.y = clamp(p.y + my * PLAYER_SPEED * 0.7 * mult * dt / 1000, laneTop(w,p.x), laneBottom(w));
  if (mx) p.facing = mx > 0 ? 1 : -1;
}
function stepRamilUlt(w: World, p: Player, inp: Input, dt: number, ev: SimEvent[]) {
  const r = p.ramil!, u = r.ult!;
  p.invulnMs = RAMIL.ULT_STUN + dt;
  if (inp.attack || inp.ult) u.buffered = true;
  if (u.dashMs !== undefined) {
    u.dashMs = Math.min(RAMIL.ULT_DASH_MS, u.dashMs + dt);
    const k = 1 - (1 - u.dashMs / RAMIL.ULT_DASH_MS) ** 3;
    p.x = u.dashFromX! + (u.dashX! - u.dashFromX!) * k;
    p.y = u.dashFromY! + (u.dashY! - u.dashFromY!) * k;
    p.moveT += dt;
    if (u.dashMs >= RAMIL.ULT_DASH_MS) { u.dashMs = undefined; p.fDashMs = 0; startMove(p, 'u' + (u.level + 1)); p.moveT = u.ms; }
    return;
  }
  let target: Enemy | undefined = w.enemies[u.target];
  if (u.finish === undefined) {
    if (!target || target.hp <= 0 || !combatReady(w, target)) {
      target = ramilUltTarget(w, p);
      if (target) u.target = target.id;
    }
    if (!target) {
      u.emptyMs = (u.emptyMs ?? 0) + dt;
      if (u.emptyMs < RAMIL.ULT_EMPTY_MS) return;
      u.finish = 0; p.ultWindow = 0; p.fDashMs = 0;
      return;
    }
    u.emptyMs = 0;
    p.facing = target.x < p.x ? -1 : 1;
    if (Math.abs(target.x - p.x) > RAMIL.A1_GAP + 8 || Math.abs(target.y - p.y) > ATTACK_BAND) {
      if (startRamilUltDash(w, p, u, target, ev)) return;
    }
  }
  const front = ramilFront(w,p,RAMIL.ULT_RANGE);
  for (const e of front) if (!u.stunned.includes(e.id)) u.stunned.push(e.id);
  for (const id of u.stunned) { const e = w.enemies[id]; if (e && e.hp > 0 && u.finish === undefined) { cancelAttack(w,e); e.stunMs = RAMIL.ULT_STUN+dt; e.ultStunBy = p.id; } }
  if (u.finish !== undefined) {
    u.finish += dt;
    const out = u.level < 2 ? 'flurry-out' : 'flurry2-out';
    if (u.finish >= RAMIL.ULT_FINISH_STOP) { p.move = HERO_ANIMS.ramil[out] ? out : 'idle'; p.moveT = u.finish-RAMIL.ULT_FINISH_STOP; }
    if (u.finish >= RAMIL.ULT_FINISH_STOP + moveDurMs('ramil',out,p.facing)) { r.ult = undefined; p.ultLevel = p.ultWindow = 0; p.combo = 0; startMove(p,'idle'); }
    return;
  }
  const timing = flurryTiming('u'+(u.level+1),p.facing);
  if (u.window > 0) {
    if (u.buffered && u.level < 5) {
      u.level++; u.count = 0; u.ms = 0; u.window = 0; u.buffered = false; p.ultLevel = u.level+1; p.ultWindow = 0; startMove(p,'u'+(u.level+1)); ev.push({t:'rstage',id:p.id,level:u.level,x:p.x,y:p.y}); return;
    }
    u.window = Math.max(0,u.window-dt); p.ultWindow = u.window;
    if (u.window > 0) return;
  } else {
    u.ms += dt; p.moveT = Math.min(u.ms,timing.stops.at(-1)!);
    while (u.count < timing.count && u.ms >= timing.stops[u.count]) {
      const k = u.count++;
      ev.push({t:'flurry',id:p.id,level:u.level,k,x:p.x,y:p.y});
      const stop = k === timing.count-1 ? RAMIL.ULT_LAST_STOP : RAMIL.ULT_HITSTOP[u.level];
      for (const e of front) {
        applyHit(w,p,e,RAMIL.ULT_DMG[u.level],p.facing,ev,{kb:0,stunMs:RAMIL.ULT_STUN+dt,flurry:{level:u.level,k}});
        e.ultStopMs = stop ? stop + dt : 0; e.ultStopBy = e.ultStunBy = p.id;
      }
      if (target?.hp > 0) { target.x = clampEnemyX(w,target.x+p.facing*RAMIL.ULT_NUDGE,target); p.x = clamp(p.x+p.facing*RAMIL.ULT_NUDGE,...walkBounds(w)); }
    }
    if (u.ms < timing.activeMs) return;
    if (u.buffered && u.level < 5) { u.level++; u.count = 0; u.ms = 0; u.buffered = false; p.ultLevel = u.level + 1; startMove(p, 'u' + (u.level + 1)); ev.push({t:'rstage',id:p.id,level:u.level,x:p.x,y:p.y}); return; }
    if (u.level < 5) { u.window = RAMIL.ULT_WINDOW; p.ultWindow = u.window; return; }
  }
  for (const id of u.stunned) { const e = w.enemies[id]; if (e) { e.stunMs = RAMIL.ULT_STUN; e.ultStunBy = p.id; } }
  for (const e of ramilFront(w,p,RAMIL.ULT_RANGE)) {
    applyHit(w,p,e,RAMIL.ULT_FINISH[u.level],p.facing,ev,{noCollateral:true,down:true,kb:e.id===u.target?RAMIL.ULT_MAIN_KB:RAMIL.ULT_OTHER_KB,impact:2});
    e.ultStopMs = RAMIL.ULT_FINISH_STOP + dt; e.ultStopBy = e.ultStunBy = p.id;
  }
  u.finish = 0; p.ultWindow = 0; p.move = 'flurry2'; p.moveT = hitTimesMs('ramil','flurry2',p.facing).at(-1) ?? 0; w.slowmoMs = RAMIL.ULT_SLOWMO;
  ev.push({t:'rfinish',id:p.id,x:p.x+p.facing*RAMIL.A1_GAP,y:p.y,line:RAMIL_FINISH_WORDS[u.level]});
}

function stepRamil(w: World, p: Player, inp: Input, dt: number, ev: SimEvent[]) {
  if (inp.viewX !== undefined && inp.viewW !== undefined) { p.viewX = inp.viewX; p.viewW = inp.viewW; }
  p.idleInput = !!(inp.mx || inp.my || inp.attack || inp.heavy || inp.ult || inp.ult2 || inp.taunt);
  const r = p.ramil ??= { marks: [], markMs: 0, originX: p.x, originY: p.y, smokeMs: 0, smokeLine: 0, fireHit: [] };
  p.invulnMs = Math.max(0, p.invulnMs - dt); p.hiddenMs = Math.max(0, (p.hiddenMs ?? 0) - dt);
  p.bCooldownMs = Math.max(0, p.bCooldownMs - dt);
  p.heavySmokeMs = Math.max(0, (p.heavySmokeMs ?? 0) - dt);
  r.markMs -= dt;
  r.marks = r.marks.filter(id => { const e = w.enemies[id]; if (e && e.hp > 0 && r.markMs > 0) return true; if (e) e.markedBy = undefined; return false; });
  if (r.tele) {
    r.tele.ms -= dt;
    if (r.tele.ms > 0) return;
    const t = r.tele; r.tele = undefined; p.x = t.x; p.y = t.y; p.heavySmokeMs = RAMIL.HEAVY_SMOKE_MS;
    const e = w.enemies[t.target ?? ''];
    if (e && e.hp > 0) {
      p.facing = e.x >= p.x ? 1 : -1;
      if (!t.back) applyHit(w, p, e, RAMIL.TELE_DMG, p.facing, ev, { kb: 0, stunMs: TICK_MS, word: 'ВЖУХ' });
    }
    if (t.back) {
      for (const id of r.marks) { const e = w.enemies[id]; if (!e) continue;
        if (e.hp > 0 && Math.hypot(e.x - p.x, e.y - p.y) <= RAMIL.RETURN_RANGE) applyHit(w, p, e, RAMIL.RETURN_DMG, p.facing, ev, { kb: 0, stunMs: TICK_MS, word: 'Я ТУТ' });
        e.markedBy = undefined;
      }
      r.marks = [];
    }
  }
  if (r.ult) { stepRamilUlt(w, p, inp, dt, ev); return; }
  if (r.dash) {
    const old = p.moveT; p.moveT += dt;
    const u = clamp(p.moveT / RAMIL.A1_DASH_MS, 0, 1), k = 1 - (1 - u) ** 3;
    p.x = r.dash.fromX + (r.dash.x - r.dash.fromX) * k; p.y = r.dash.fromY + (r.dash.y - r.dash.fromY) * k;
    if (u === 1) { r.dash = undefined; startMove(p, 'a1'); }
    if (inp.attack && old > 0) p.queued = 'attack';
    return;
  }
  if (r.grab) {
    const e = w.enemies[r.grab];
    if (!e || e.hp <= 0 || !e.held || ['hurt', 'fall'].includes(p.move)) releaseGrab(w, p);
    else if (p.move === 'a2-hold' || p.move === 'a2-walk') {
      r.holdMs = (r.holdMs ?? 0) - dt;
      moveRamilCarry(w,p,inp,dt,RAMIL.HOLD_SPEED_MULT);
      const move = inp.mx || inp.my ? 'a2-walk' : 'a2-hold';
      if (p.move !== move) startMove(p,move); else p.moveT += dt;
      e.x = p.x + p.facing * RAMIL.GRIP_X; e.y = p.y;
      e.carryAngle = 0; e.carryHeight = 0;
      if (inp.attack || p.queued === 'attack') { p.queued = null; p.invulnMs = dt + RAMIL.SPIN_MS; startMove(p,'a3-spin'); r.spinHits = []; }
      else if (r.holdMs <= 0) { releaseGrab(w,p); startMove(p,'idle'); }
      return;
    } else if (['a3-spin', 'a3-throw'].includes(p.move)) {
      p.invulnMs = dt + RAMIL.ULT_STUN;
      if (p.move === 'a3-spin') {
        p.invulnMs = dt + RAMIL.ULT_STUN;
        moveRamilCarry(w,p,inp,dt,RAMIL.SPIN_SPEED_MULT);
      }
      const prev = p.moveT; p.moveT += dt;
      if (p.move === 'a3-spin') {
        const spin = ramilSpin(Math.min(p.moveT,RAMIL.SPIN_MS));
        const angle = spin.angle;
        e.x = p.x + Math.cos(angle) * RAMIL.SPIN_R * p.facing; e.y = p.y + Math.sin(angle) * RAMIL.SPIN_R * 0.3;
        e.carryHeight = 0; e.carryAngle = 0;
        // Проверяем пройденную дугу, чтобы быстрый оборот не перескочил цель.
        let offset = 0;
        for (let turn = 0; turn < RAMIL.SPIN_TURNS; turn++) {
          const ms = RAMIL.SPIN_TURN_MS[turn], lo = Math.max(prev,offset), hi = Math.min(p.moveT,offset+ms);
          if (hi > lo) {
            const a = (lo-offset)/ms*Math.PI*2, b = (hi-offset)/ms*Math.PI*2;
            for (const other of Object.values(w.enemies)) {
              const key = turn+':'+other.id;
              if (other === e || other.held || !combatReady(w,other) || other.hp <= 0 || (other.invulnMs ?? 0) > 0 || Math.abs(other.x-p.x)>RAMIL.SPIN_HIT_R || Math.abs(other.y-p.y)>ATTACK_BAND || r.spinHits!.includes(key)) continue;
              const projected = Math.acos(clamp((other.x-p.x)*p.facing/RAMIL.SPIN_HIT_R,-1,1));
              const theta = [projected,Math.PI*2-projected].find(t => t >= a-RAMIL.SPIN_HIT_ANGLE && t <= b+RAMIL.SPIN_HIT_ANGLE);
              if (theta === undefined) continue;
              r.spinHits!.push(key);
              const dir = -Math.sin(theta)*p.facing < 0 ? -1 : 1;
              applyHit(w,p,other,RAMIL.SPIN_DMG,dir,ev,{noCollateral:true,kb:RAMIL.SPIN_KB,down:true,word:['БУМ!','БАХ!','ХРЯСЬ!'][(r.spinHits!.length-1)%3]});
              other.y = clamp(other.y + Math.cos(theta)*RAMIL.SPIN_LANE_KB,laneTop(w,other.x),laneBottom(w));
              other.ultStopMs = RAMIL.SPIN_STOP_MS + dt; other.ultStopBy = p.id;
              ev.push({t:'rspinHit',id:p.id,target:other.id,x:other.x,y:other.y});
            }
          }
          if (prev < offset+ms && p.moveT >= offset+ms) applyHit(w,p,e,RAMIL.SPIN_HELD_DMG,p.facing,ev,{kb:0,fixedDmg:true});
          offset += ms;
        }
        if (p.moveT >= RAMIL.SPIN_MS) startMove(p,'a3-throw');
      } else if (hitTimesMs('ramil',p.move,p.facing).some(t => prev < t && p.moveT >= t)) {
        const to = ramilThrowTarget(w,p,e);
        e.thrown = {by:p.id,ms:-dt,fromX:e.x,fromY:e.y,...to}; e.held = undefined; r.grab = undefined; p.combo = 0;
        p.invulnMs = 0;
        ev.push({t:'taunt',id:p.id,line:'ЛОВИ!'});
      }
      return;
    }
  }
  const prev = p.moveT; p.moveT += dt;
  const s = STRIKES.ramil[p.move];
  if (s && hitTimesMs('ramil', p.move, p.facing).some(t => prev < t && p.moveT >= t)) {
    if (p.move === 'a1') for (const e of ramilFront(w, p, RAMIL.A1_RANGE)) applyHit(w, p, e, RAMIL.A1_DMG, p.facing, ev, s);
    else if (p.move === 'a2') {
      const e = ramilFront(w, p, RAMIL.A2_RANGE)[0]; p.combo = 0;
      if (e) {
        applyHit(w, p, e, RAMIL.A2_DMG, p.facing, ev, { kb: 0, stunMs: TICK_MS, word: 'ОПА!' });
        if (!e.boss && !e.held && !e.thrown && e.hp > 0) {
          cancelAttack(w, e); e.pin = undefined; e.air = 0; e.held = { by: p.id }; e.anim = 'down'; e.animMs = AIR_MS;
          r.grab = e.id; r.holdMs = RAMIL.GRAB_HOLD_MS; p.combo = 2; startMove(p, 'a2-hold'); return;
        }
      }
    } else ramilStrike(w, p, ev);
  }
  if ((p.fireMs ?? 0) > 0) {
    p.fireMs = Math.max(0, p.fireMs! - dt);
    for (const e of Object.values(w.enemies)) {
      const dx = (e.x - p.x) * p.facing;
      if (!combatReady(w, e) || dx < 0 || dx > RAMIL.FIRE_LEN || Math.abs(e.y - p.y) > RAMIL.FIRE_BAND * dx / RAMIL.FIRE_LEN || r.fireHit.includes(e.id)) continue;
      const first = r.fireHit.length === 0; r.fireHit.push(e.id);
      applyHit(w, p, e, RAMIL.FIRE_DMG, p.facing, ev, { kb: 0, stunMs: TICK_MS, word: first ? 'ПЫХ!' : undefined });
      e.burnMs = RAMIL.BURN_MS; e.burnTickMs = RAMIL.BURN_TICK; e.burnBy = p.id;
    }
  }
  if (r.tele) return;
  const busy = moveBusy(p);
  if (busy) { if (s) { if (inp.heavy) p.queued = 'heavy'; else if (inp.attack) p.queued = 'attack'; } return; }
  if (p.move === HEAVY.ramil.at(-1) && p.bChainActive) {
    p.bCooldownMs = RAMIL.B_COOLDOWN_MS; p.bChainActive = false;
  }
  p.comboMs -= dt; if (p.comboMs <= 0) p.combo = 0;
  p.bComboMs -= dt;
  if (p.bComboMs <= 0) {
    if (p.bChainActive && p.bCombo !== 0) p.bCooldownMs = RAMIL.B_COOLDOWN_MS;
    p.bCombo = 0; p.bChainActive = false;
  }
  const targets = ramilTargets(w, p);
  if (inp.ult && p.ult >= 100 && targets.length) {
    p.ult = 0; p.queued = null;
    const front = targets.filter(e => (e.x - p.x) * p.facing >= 0 && Math.abs(e.x - p.x) <= RAMIL.ULT_REACH);
    const target = (front.length ? front : targets).sort((a, b) => Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];
    releaseGrab(w, p);
    r.ult = { ms: 0, count: 0, target: target.id, level: 0, buffered: false, window: 0, stunned: [] };
    p.invulnMs = dt + RAMIL.ULT_STUN; p.ultLevel = 1; p.ultWindow = 0;
    p.facing = target.x < p.x ? -1 : 1;
    startMove(p, 'u1'); startRamilUltDash(w, p, r.ult, target, ev);
    ev.push({ t: 'ult', id: p.id }); ev.push({t:'rstage',id:p.id,level:0,x:p.x,y:p.y}); return;
  }
  const want = p.queued ?? (inp.heavy ? 'heavy' : inp.attack ? 'attack' : null);
  if (want) {
    p.queued = null; if (inp.mx) p.facing = inp.mx > 0 ? 1 : -1;
    if (want === 'heavy') {
      if (p.bCooldownMs > 0) return;
      if (p.bCombo === 0 && !targets.some(e => (e.x - p.x) * p.facing >= 0)) return;
      const step = p.bCombo;
      startMove(p, HEAVY.ramil[step]); p.bCombo = (step + 1) % HEAVY.ramil.length; p.bComboMs = RAMIL.B_COMBO_MS; p.bChainActive = true;
    } else {
      if (p.combo === 2) p.combo = 0;
      startMove(p, CHAIN.ramil[p.combo]); p.combo = (p.combo + 1) % CHAIN.ramil.length; p.comboMs = COMBO_MS_BY.ramil!;
      p.fDashMs = 0; r.dash = undefined;
      if (p.move === 'a1') { const target = ramilFront(w, p, RAMIL.A1_DASH_MAX)[0]; if (target) { startRamilDash(w, p, target, RAMIL.A1_DASH_MAX, ev); if (r.dash) startMove(p, 'dash'); } }
      if (p.move === 'a2') p.x = clamp(p.x + p.facing * RAMIL.A2_STEP, ...walkBounds(w));
    }
    r.smokeMs = 0; p.anim = want === 'heavy' ? 'heavy' : 'attack'; return;
  }
  if (inp.ult2) {
    if (p.move !== 'smoke') startMove(p, 'smoke');
    p.ult = Math.min(100, p.ult + RAMIL.SMOKE_RATE * dt / 1000);
    r.smokeMs += dt;
    if (r.smokeMs >= RAMIL.SMOKE_LINE_MS) { r.smokeMs -= RAMIL.SMOKE_LINE_MS; ev.push({ t: 'taunt', id: p.id, line: RAMIL_SMOKE_LINES[r.smokeLine++ % RAMIL_SMOKE_LINES.length] }); }
    p.anim = 'idle'; return;
  }
  r.smokeMs = 0;
  if (inp.taunt && p.tauntCdMs <= 0) {
    startMove(p, 'taunt'); p.tauntCdMs = TAUNT_CD_MS;
    const lines = CHARACTERS.find(c => c.id === RAMIL_ID)!.taunts;
    ev.push({ t: 'taunt', id: p.id, line: lines[Math.floor(rand(w) * lines.length)] }); return;
  }
  p.x = clamp(p.x + inp.mx * PLAYER_SPEED * dt / 1000 * (inp.run ? RUN_MULT : 1), ...walkBounds(w));
  p.y = clamp(p.y + inp.my * PLAYER_SPEED * 0.7 * dt / 1000, laneTop(w, p.x), laneBottom(w));
  if (inp.mx) p.facing = inp.mx > 0 ? 1 : -1;
  const move = inp.mx || inp.my ? inp.run ? 'dash' : 'walk' : 'idle';
  if (p.move !== move) startMove(p, move);
  p.anim = move === 'idle' ? 'idle' : 'walk';
}

// Враг ударил игрока. false, если удар пропал (неуязвимость)
function damagePlayer(p: Player, dmg: number): boolean {
  if (p.god || p.invulnMs > 0) return false;
  p.hp = Math.max(0, p.hp - dmg);
  if (isHero(p) && p.hp > 0) {
    // Ultimate: иммунитет к контролю, урон проходит, но героиню не сбивает с действия
    if (p.form === 'ultimate') { p.invulnMs = IMMUNE_INVULN_MS; return true; }
    p.combo = 0; p.queued = null;
    if (p.char === KRIS_ID) { p.shooting = false; p.fireNeedsRelease = true; p.fireFacing = undefined; }
    if (p.move === 'hurricane' && moveBusy(p)) p.invulnMs = 300; // вихрь не прерывается
    else { startMove(p, 'hurt'); p.invulnMs = HURT_INVULN_MS; }
  }
  return true;
}

function stepHero(w: World, p: Player, inp: Input, dtMs: number, ev: SimEvent[]) {
  if (p.char === RAMIL_ID) { stepRamil(w, p, inp, dtMs, ev); return; }
  const dt = dtMs / 1000;
  p.invulnMs = Math.max(0, p.invulnMs - dtMs);
  p.bCooldownMs = Math.max(0, p.bCooldownMs - dtMs);
  if (!inp.fireHeld) p.fireNeedsRelease = false;
  const holdingFire = p.char === KRIS_ID && !!inp.fireHeld && !p.fireNeedsRelease;
  p.shooting = holdingFire;
  if (!holdingFire) p.fireFacing = undefined;
  // Снежная буря: запуск не ждёт окончания удара и хитстопа, только не из падения, подъёма и превращения
  const stunned = ['hurt', 'fall', 'getup'].includes(p.move) || p.move.startsWith('transform');
  if (p.char === HERO_ID && inp.ult2 && p.ult >= 100 && p.stormMs <= 0 && !stunned) {
    p.ult = 0; p.stormMs = STORM_MS; p.stormTickMs = 0;
    ev.push({ t: 'storm', id: p.id });
  }
  if (p.stormMs > 0) {
    if (p.stormTickMs <= 0) {
      p.stormTickMs += STORM_TICK_MS;
      for (const e of Object.values(w.enemies)) {
        if (!combatReady(w, e) || Math.hypot(e.x - p.x, e.y - p.y) > STORM_RADIUS) continue;
        e.frozenMs = FREEZE_MS / (e.boss ? 2 : 1); e.frozenBy = p.id;
        applyHit(w, p, e, STORM_DMG, p.facing, ev, { noCharge: true });
      }
    }
    p.stormTickMs -= dtMs;
    p.stormMs = Math.max(0, p.stormMs - dtMs);
  }
  if (inp.ult2 && p.char === KRIS_ID && p.charge2 >= 100) p.wantBall = true;
  // Хитстоп: на тик-два всё замирает, нажатие запоминается
  if (p.hitstopMs > 0) {
    p.hitstopMs = Math.max(0, p.hitstopMs - dtMs);
    if (inp.heavy) p.queued = 'heavy'; else if (inp.attack) p.queued = 'attack';
    return;
  }
  const prevT = p.moveT;
  p.moveT += dtMs;

  if (p.move === 'hop' && p.hop) {
    const k = clamp(p.moveT / HOP_MS, 0, 1);
    p.x = p.hop.from + (p.hop.to - p.hop.from) * k;
    if (k < 1) p.invulnMs = Math.max(p.invulnMs, dtMs * 2);
  }

  const ap = p.approach;
  if (ap) {
    const k = clamp(Math.max(0, p.moveT) / ap.ms, 0, 1);
    let tx = ap.tx;
    const target = w.enemies[ap.target];
    if (!ap.rush && target) tx = p.facing > 0 ? Math.min(tx, target.x - MAGNET_GAP) : Math.max(tx, target.x + MAGNET_GAP);
    p.x = ap.x + (tx - ap.x) * k; p.y = clamp(ap.y + (ap.ty - ap.y) * k, laneTop(w, p.x), laneBottom(w));
    if (ap.rush && k < 1) p.invulnMs = Math.max(p.invulnMs, dtMs * 2);
    if (k === 1) p.approach = undefined;
  }

  // Попадания в кадрах удара (особые приёмы делают своё: вспышка, шар, сердце)
  const strike: Strike | undefined = STRIKES[p.form][p.move];
  if (strike) {
    for (const tm of hitTimesMs(p.form, p.move, p.facing)) {
      if (!(prevT < tm && p.moveT >= tm)) continue;
      if (strike.kind) { special(w, p, strike, ev); continue; }
      const opts = strikeOpts(p, strike);
      if (p.char === HERO_ID && p.move === 'hurricane' && tm === hitTimesMs(p.form, p.move, p.facing).at(-1)) { opts.slam = true; opts.down = true; }
      const eventStart = ev.length;
      let n = 0;
      if (strike.rush && ap?.rush) {
        for (const e of Object.values(w.enemies)) {
          const along = (e.x - ap.x) * p.facing;
          const end = (p.x - ap.x) * p.facing;
          const lineY = ap.y + (p.y - ap.y) * clamp(along / Math.max(1, end), 0, 1);
          if (e.hp <= 0 || along < 0 || along > end + strike.range * RANGE_MULT || Math.abs(e.y - lineY) > ATTACK_BAND) continue;
          applyHit(w, p, e, strike.dmg, p.facing, ev, opts); n++;
        }
      } else n = hitEnemies(w, p, strike.range * (p.form === 'kris' && strike.stunMs ? 1 : RANGE_MULT), strike.dmg, ev, !!strike.around, opts);
      if (n > 0) {
        p.hitstopMs = strike.down ? HITSTOP_HEAVY_MS : HITSTOP_MS;
        // Ultimate: сколько нанесла, столько и вылечила
        if (p.form === 'ultimate') {
          const damage = ev.slice(eventStart).reduce((sum, e) => sum + (e.t === 'hit' ? e.dmg : 0), 0);
          const heal = Math.min(PLAYER_HP - p.hp, damage);
          if (heal > 0) { p.hp += heal; ev.push({ t: 'heal', id: p.id, amount: heal }); }
        }
      }
    }
  }

  // Рывок самурая: Надя пролетает DASH_DIST за время анимации рывка
  if (p.move === 'b3-dash') {
    const k = Math.min(1, Math.max(0, p.moveT) / Math.max(1, moveDurMs(p.form, p.move, p.facing)));
    p.x = clamp(p.dashFrom + p.facing * DASH_DIST * k, ...walkBounds(w));
  }

  // Смена формы по окончании превращений
  let busy = moveBusy(p);
  if (!busy && p.move === 'transform-up') { p.form = 'ultimate'; p.formMs = ULT_MS; p.ultimateExtraMs = 0; startMove(p, 'idle'); }
  else if (!busy && p.move === 'transform-down') { p.form = 'prime'; p.formMs = 0; startMove(p, 'idle'); }
  else if (p.form === 'ultimate' && p.move !== 'transform-down') {
    p.formMs -= dtMs;
    if (p.formMs <= 0 && !busy) { startMove(p, 'transform-down'); p.invulnMs = moveDurMs('ultimate', 'transform-down', p.facing); }
  }
  if (p.move.startsWith('transform')) busy = true;
  // Звенья цепочек сами переходят в следующее: самурай Нади, ульта Kris
  const next = NEXT_MOVE[p.form]?.[p.move];
  if (!busy && next) { leaveMove(w, p, p.move, ev); startMove(p, next); enterMove(w, p, next, ev); busy = true; }
  if (isLoop(p.form, p.move)) {
    const dur = moveDurMs(p.form, p.move, p.facing);
    if (p.moveT >= dur) p.moveT -= dur;
    busy = false;
  }
  if (!busy && p.char === NADYA_ID && p.move === 'b3-end' && p.bChainActive) {
    p.bCooldownMs = NADYA_B_COOLDOWN_MS; p.bChainActive = false;
  }

  // Очередь: нажатие во время удара запоминается и срабатывает в окне отмены
  const isStrike = !!strike && !strike.kind || p.move === 'b';
  const isHeavy = HEAVY[p.form].includes(p.move);
  if (busy && isStrike) {
    if (inp.heavy) p.queued = 'heavy'; else if (inp.attack) p.queued = 'attack';
  }
  let canAct = !busy;
  if (busy && isStrike && p.move !== 'hurricane') {
    const dur = moveDurMs(p.form, p.move, p.facing);
    const hits = hitTimesMs(p.form, p.move, p.facing);
    const last = hits.length ? hits[hits.length - 1] : 0;
    canAct = p.moveT >= (isHeavy && p.form !== 'kris' ? dur : last + (dur - last) * 0.5);
  }

  if (!busy) {
    p.comboMs -= dtMs; if (p.comboMs <= 0) p.combo = 0;
    p.bComboMs -= dtMs;
    if (p.bComboMs <= 0) {
      if (p.bChainActive && p.bCombo !== 0 && p.char === NADYA_ID) p.bCooldownMs = NADYA_B_COOLDOWN_MS;
      p.bCombo = 0; p.bChainActive = false;
    }
  }
  const comboWindow = COMBO_MS_BY[p.form] ?? COMBO_MS;

  const mx = clamp(inp.mx, -1, 1), my = clamp(inp.my, -1, 1);
  if (canAct) {
    const want = p.queued ?? (inp.heavy && !holdingFire ? 'heavy' : inp.attack ? 'attack' : null);
    const turn = () => { if (mx !== 0 && !holdingFire) p.facing = mx > 0 ? 1 : -1; };
    const ultReady = inp.ult && p.ult >= 100 && p.form !== 'ultimate';
    if (ultReady && p.char === HERO_ID) {
      p.ult = 0; p.queued = null; p.combo = 0; p.bCombo = 0;
      hitEnemies(w, p, 0, 0, ev, true, { everyone: true, silent: true, kb: 90, stun: 700, down: true }); // в момент нажатия всех врагов отбрасывает
      startMove(p, 'transform-up');
      p.invulnMs = moveDurMs('prime', 'transform-up', p.facing);
      ev.push({ t: 'ult', id: p.id });
    } else if (ultReady && p.char === NADYA_ID) {
      p.ult = 0; p.queued = null; p.combo = 0; p.bCombo = 0; turn();
      startMove(p, 'ult');
      p.invulnMs = moveTotalMs(p.form, 'ult', p.facing);
      ev.push({ t: 'ult', id: p.id });
    } else if (ultReady && p.char === KRIS_ID) {
      p.ult = 0; p.queued = null; p.combo = 0; turn();
      startMove(p, 'ult-setup');
      p.invulnMs = ['ult-setup', 'ult-hold', 'ult-out'].reduce((t, m) => t + moveTotalMs(p.form, m, p.facing), 0);
      ev.push({ t: 'ult', id: p.id });
    } else if (p.wantBall && p.charge2 >= 100) {
      p.charge2 = 0; p.wantBall = false; p.queued = null; turn();
      startMove(p, 'ball');
    } else if (want === 'heavy' && p.char === NADYA_ID) {
      // Своя серия B: пощёчина, по яйцам, самурай
      p.queued = null; turn();
      if (p.bCooldownMs > 0) return;
      const step = p.bCombo % 3;
      startMove(p, HEAVY.nadya[step]);
      p.bCombo = step === 2 ? 0 : step + 1;
      p.bComboMs = comboWindow; p.bChainActive = true;
      p.combo = 0; p.comboMs = 0;
      if (step === 2) p.invulnMs = ['b3-draw', 'b3-dash', 'b3-end'].reduce((t, m) => t + moveTotalMs(p.form, m, p.facing), 0);
    } else if (want === 'heavy' && p.char === KRIS_ID) {
      p.queued = null;
      if (p.cdMs === 0) { turn(); startMove(p, 'b'); p.cdMs = FLASH_CD_MS; }
    } else if (want === 'heavy' && p.char === HERO_ID) {
      p.queued = null; turn();
      const step = p.bCombo % 3;
      startMove(p, HEAVY[p.form][step]); approach(w, p);
      p.bCombo = step === 2 ? 0 : step + 1; p.bComboMs = comboWindow;
    } else if (want === 'heavy') {
      p.queued = null; turn();
      startMove(p, HEAVY[p.form][Math.min(p.combo, 2)]);
      p.combo = 0; p.comboMs = 0;
    } else if (want === 'attack') {
      p.queued = null;
      const hopping = p.form === 'kris' && p.combo === 2;
      if (!hopping) turn();
      const len = CHAIN[p.form].length;
      const step = p.combo % len;
      startMove(p, CHAIN[p.form][step]); approach(w, p);
      if (hopping) {
        // Камера пока только на клиенте: граница по стандартной ширине обзора.
        const left = Math.max(walkBounds(w)[0], Math.min(levelW(w) - VIEW_W, p.x - VIEW_W * 0.33));
        p.hop = { from: p.x, to: clamp(p.x - p.facing * HOP_DIST, left, walkBounds(w)[1]) };
        p.invulnMs = HOP_MS + TICK_MS;
      }
      p.combo = step === len - 1 ? 0 : step + 1;
      p.comboMs = comboWindow;
    } else if (!busy && inp.taunt && p.tauntCdMs === 0) {
      const ch = CHARACTERS.find(c => c.id === p.char);
      const lines = ch?.taunts ?? ['...'];
      p.animMs = 600; p.tauntCdMs = TAUNT_CD_MS;
      ev.push({ t: 'taunt', id: p.id, line: lines[Math.floor(rand(w) * lines.length)] });
    } else if (!busy) {
      if (holdingFire && p.cdMs === 0) {
        if (p.fireFacing === undefined) p.fireFacing = p.facing;
        p.facing = p.fireFacing;
        special(w, p, STRIKES.kris.b, ev);
        p.cdMs = FLASH_CD_MS;
      }
      const moving = mx !== 0 || my !== 0;
      const run = moving && inp.run;
      const speed = PLAYER_SPEED * SPEED_MULT[p.form] * (run ? RUN_MULT : 1);
      p.x = clamp(p.x + mx * speed * dt, ...walkBounds(w));
      p.y = clamp(p.y + my * speed * 0.7 * dt, laneTop(w, p.x), laneBottom(w));
      if (mx !== 0 && !holdingFire) p.facing = mx > 0 ? 1 : -1;
      const want2 = run ? 'dash' : moving ? 'walk' : 'idle';
      if (p.move !== want2) startMove(p, want2);
    }
  }

  // Грубая фаза для общих правил (HUD, поворот упавшего у прямоугольников)
  if (CHAIN[p.form].includes(p.move)) p.anim = 'attack';
  else if (STRIKES[p.form][p.move] || HEAVY[p.form].includes(p.move) || p.move.startsWith('b3')) p.anim = 'heavy';
  else if (p.move === 'hurt') p.anim = 'hurt';
  else if (p.move.startsWith('transform') || p.move.startsWith('ult')) p.anim = 'ult';
  else if (p.move === 'walk' || p.move === 'dash') p.anim = 'walk';
  else p.anim = p.animMs > 0 ? 'taunt' : 'idle';
}

// Кегля движется 300 мс; проверяем весь отрезок, чтобы не проскочить цель.
function stepPin(w: World, e: Enemy, dtMs: number, ev: SimEvent[]) {
  const pin = e.pin;
  if (!pin || e.frozenMs) return;
  const x0 = e.x;
  e.x = clampEnemyX(w, e.x + pin.dir * pin.speed * Math.min(pin.ms, dtMs), e);
  pin.ms -= dtMs;
  const p = w.players[pin.by];
  if (p && !pin.noCollateral) for (const o of Object.values(w.enemies)) {
    if (o === e || o.hp <= 0 || pin.hit.includes(o.id) || Math.abs(o.y - e.y) >= PIN_SIZE || o.x <= Math.min(x0, e.x) - PIN_SIZE || o.x >= Math.max(x0, e.x) + PIN_SIZE) continue;
    pin.hit.push(o.id);
    applyHit(w, p, o, PIN_DMG, pin.dir, ev, { kb: PIN_KB, stun: PIN_MS, stunMs: PIN_MS, fixedDmg: true });
  }
  if (pin.ms <= 0) e.pin = undefined;
}

const livePlayers = (w: World) => Object.values(w.players).filter(p => p.hp > 0 && p.connected && !p.away);
export const encountersOf = (w: World) => w.level === 'route' ? ENCOUNTERS[stageOf(w).id] ?? [] : [];

function releaseToken(w: World, e: Enemy) {
  if (e.token) w.tokenReleased[e.token] = w.timeMs;
  e.token = undefined; e.wideToken = false;
}
function cancelAttack(w: World, e: Enemy) {
  releaseToken(w, e);
  e.phase = e.enterMs && e.boss === 'shaman' ? 'enter' : 'none'; e.phaseMs = 0;
  e.waitMs = 0;
}

function stepEncounters(w: World, ev: SimEvent[], dtMs: number) {
  if (w.won) return;
  const enc = w.enc, data = encountersOf(w), next = data[enc.index];
  if (!enc.lock && next && livePlayers(w).some(p => p.x >= next.trigger)) {
    enc.lock = [...next.arena]; enc.bossIndex = 0; enc.bossStarted = false; enc.wave = 0; enc.queue = [...(next.waves[0] ?? [])]; enc.spawnMs = 0;
    ev.push({ t: 'lock', x0: enc.lock[0], x1: enc.lock[1] });
  }
  if (!enc.lock || !next) return;
  const alive = () => Object.values(w.enemies).filter(e => e.hp > 0).length;
  if (!enc.queue.length && alive() <= 4 && enc.wave + 1 < next.waves.length) {
    enc.queue = [...next.waves[++enc.wave]];
  }
  enc.spawnMs = alive() === 0 ? 0 : Math.max(0, (enc.spawnMs ?? 0) - dtMs);
  const stage = stageOf(w).id;
  const cap = stage === 'mayak' || stage === 'mfc' ? MAX_PEAK_ALIVE : MAX_ALIVE;
  if (enc.queue.length && alive() < cap && !enc.spawnMs) {
    const spawn = enc.queue.shift()!, info = KIND[spawn.kind], stats = ROLE[info.role];
    const door = spawn.door !== undefined && spawn.door >= enc.lock[0] && spawn.door <= enc.lock[1] ? spawn.door : undefined;
    const id = 'e' + w.nextEnemyId++, x = door ?? enc.lock[1] + ENTER_OFF;
    const hp = Math.round(stats.hp * (info.hpMult ?? 1));
    w.enemies[id] = { id, bornTick: w.tick, kind: spawn.kind, phase: 'none', phaseMs: 0, x,
      y: door !== undefined ? laneTop(w, x) + 2 : laneTop(w, x) + rand(w) * (laneBottom(w) - laneTop(w, x)),
      enterMs: door !== undefined ? 500 : undefined,
      hp, maxHp: hp, facing: -1, anim: door !== undefined ? 'enter' : 'run', animMs: 0, cdMs: 0 };
    enc.spawnMs = 280;
  }
  if (!enc.queue.length && enc.wave >= next.waves.length - 1) {
    if (next.bosses) {
      if (enc.bossStarted || !(enc.bossIndex ?? 0) && alive() > 0) return;
      if (enc.bossWait) { enc.bossWait = Math.max(0, enc.bossWait - dtMs); if (enc.bossWait) return; }
      const boss = next.bosses[enc.bossIndex ?? 0];
      if (boss) {
        const id = 'e' + w.nextEnemyId++, info = BOSS[boss];
        const hp = info.hp;
        w.enemies[id] = { id, bornTick: w.tick, kind: 'vatnik', boss, bossPhase: 1, hp, maxHp: hp,
          x: boss === 'shaman' ? stageProp(w, 'stage_b')!.x : enc.lock[1] - 20, y: boss === 'shaman' ? 205 : laneBottom(w) - 20, facing: -1,
          enterMs: boss === 'shaman' ? 900 : undefined,
          phase: 'none', phaseMs: 0, anim: 'run', animMs: 0, cdMs: 0 };
        if (boss === 'shaman') { w.enemies[id].phase = 'enter'; w.enemies[id].anim = 'enter'; }
        else if (boss === 'pizdulina') for (let n = 0; n < 2; n++) {
          const oid = 'e' + w.nextEnemyId++, hp = ROLE[KIND.omon.role].hp;
          w.enemies[oid] = { id: oid, kind: 'omon', hp, maxHp: hp, x: enc.lock[1] + ENTER_OFF + 30 + n * 22,
            y: laneBottom(w) - 30 + n * 12, facing: -1, phase: 'none', phaseMs: 0, anim: 'run', animMs: 0, cdMs: 0 };
        }
        enc.bossStarted = true; ev.push({ t: 'boss', id }); return;
      }
    }
    if (alive() > 0) return;
    enc.lock = null; enc.cleared++; enc.index++; ev.push({ t: 'clear' });
    storyEvent(w, ev, 'won');
    if (w.stage === LEVELS[w.level].stages.length - 1 && enc.cleared === data.length) {
      w.won = true; ev.push({ t: 'victory' });
    }
  }
}

// Сначала освобождаем все разрешения, затем выдаём по времени ожидания.
function prepareTokens(w: World, dtMs: number) {
  const targets = livePlayers(w), enemies = Object.values(w.enemies);
  for (const e of enemies) {
    const disabled = !!e.held || !!e.thrown || !combatReady(w, e) || e.hp <= 0 || (e.invulnMs ?? 0) > 0 || e.dummy || e.frozenMs || e.stunMs || e.air || e.pin || e.charmMs || !e.boss && (e.anim === 'hurt' || e.anim === 'down') && e.animMs > 0;
    if (disabled || e.token && !targets.some(p => p.id === e.token)) cancelAttack(w, e);
    e.targetMs = Math.max(0, (e.targetMs ?? 0) - dtMs);
    if (!e.token && !e.targetMs && targets.length) {
      e.target = targets.reduce((a, b) => Math.hypot(a.x - e.x, a.y - e.y) < Math.hypot(b.x - e.x, b.y - e.y) ? a : b).id;
      e.targetMs = 1500;
    }
    if (!disabled && e.phase === 'none' && !e.token && e.cdMs <= 0) e.waitMs = (e.waitMs ?? 0) + dtMs;
  }
  const candidates = enemies.filter(e => combatReady(w, e) && e.waitMs && !e.token && e.phase === 'none' && e.cdMs <= 0);
  candidates.sort((a, b) => b.waitMs! - a.waitMs!);
  for (const e of candidates) {
    if (!targets.some(p => p.id === e.target)) continue;
    const holders = enemies.filter(o => o.token);
    if (holders.some(o => o.wideToken) || holders.length >= TOKENS_TOTAL || holders.filter(o => o.token === e.target).length >= TOKENS_PER_TARGET) continue;
    if (w.timeMs - (w.tokenReleased[e.target!] ?? -Infinity) < TOKEN_GAP_MS) continue;
    e.token = e.target;
  }
}

function enemyHit(w: World, p: Player, dmg: number, ev: SimEvent[], immunityMs?: number) {
  if (p.hp <= 0 || !p.connected || p.away || !damagePlayer(p, dmg)) return;
  if (immunityMs !== undefined) p.invulnMs = Math.min(p.invulnMs, immunityMs);
  releaseGrab(w, p);
  ev.push({ t: 'hit', target: p.id, dmg, x: p.x, y: p.y });
  if (!p.hp) {
    p.downMs = REVIVE_MS; p.anim = 'down';
    if (isHero(p)) heroDown(p);
    ev.push({ t: 'down', id: p.id });
    for (const e of Object.values(w.enemies)) if (e.token === p.id) cancelAttack(w, e);
  }
}

function stepEnemyAttack(w: World, e: Enemy, targets: Player[], speed: number, dtMs: number, ev: SimEvent[]) {
  const stats = ROLE[KIND[e.kind].role], dt = dtMs / 1000;
  if (e.phase !== 'none') {
    e.phaseMs -= dtMs;
    if (e.phase === 'windup' && e.phaseMs <= 0) {
      e.phase = 'active'; e.phaseMs = stats.activeMs; e.struck = false;
      e.dashLeft = stats.dash?.dist;
      if (!stats.dash) {
        for (const p of targets) {
          const dx = (p.x - e.x) * e.atkDir!;
          if (dx >= 0 && dx <= stats.reach && Math.abs(p.y - e.atkY!) <= stats.depth) enemyHit(w, p, stats.dmg, ev);
        }
      }
    } else if (e.phase === 'active' && e.phaseMs <= 0) {
      releaseToken(w, e); e.phase = 'recover'; e.phaseMs = stats.recoverMs; e.waitMs = 0;
    } else if (e.phase === 'recover' && e.phaseMs <= 0) {
      e.phase = 'none'; e.cdMs = stats.cdMs;
    }
    if (e.phase === 'active' && stats.dash) {
      const from = e.x, distance = Math.min(e.dashLeft ?? 0, stats.dash.speed * dt);
      const nextX = e.x + e.atkDir! * distance;
      e.x = w.enc.lock ? clampEnemyX(w, nextX, e) : clamp(nextX, 0, levelW(w)); e.y = e.atkY!;
      e.dashLeft = Math.max(0, (e.dashLeft ?? 0) - distance);
      if (!e.struck) {
        const hit = targets.filter(p => p.hp > 0 && p.x >= Math.min(from, e.x) - 16 && p.x <= Math.max(from, e.x) + 16 && Math.abs(p.y - e.atkY!) <= stats.depth)
          .sort((a, b) => Math.abs(a.x - from) - Math.abs(b.x - from))[0];
        if (hit) { e.struck = true; enemyHit(w, hit, stats.dmg, ev); }
      }
    }
    e.anim = e.phase === 'active' ? stats.dash ? 'dash' : 'strike' : e.phase === 'none' ? 'idle' : e.phase;
    return;
  }
  const t = targets.find(p => p.id === (e.token ?? e.target));
  if (!t) { e.anim = 'idle'; return; }
  const idx = Object.keys(w.enemies).indexOf(e.id);
  const side = e.token ? (e.x < t.x ? -1 : 1) : (idx % 2 ? -1 : 1);
  // У рывка нулевая дальность: стартует с кольца ожидания.
  const gap = e.token ? stats.dash ? WAIT_RING[0] : stats.reach - 6 : WAIT_RING[0] + (idx % 3) * (WAIT_RING[1] - WAIT_RING[0]) / 2;
  let gx = t.x + side * gap;
  if (w.enc.lock) {
    if (!e.token && gx > w.enc.lock[1] - 12) gx = t.x - gap;
    gx = clamp(gx, w.enc.lock[0] + 12, w.enc.lock[1] - 12);
  }
  const gy = e.token ? t.y : clamp(t.y + ((idx % 5) - 2) * 18, laneTop(w, gx), laneBottom(w));
  const dx = gx - e.x, dy = gy - e.y, len = Math.hypot(dx, dy);
  e.facing = t.x > e.x ? 1 : -1;
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
    const dist = Math.min(len, speed * (e.token ? 1 : 0.65) * dt);
    e.x += dx / len * dist; e.y += dy / len * dist; e.anim = 'walk';
  } else if (e.token) {
    e.phase = 'windup'; e.phaseMs = stats.windupMs;
    e.atkDir = e.facing; e.atkY = e.y; e.anim = 'windup';
  } else e.anim = 'idle';
  if (!e.token) for (const o of Object.values(w.enemies)) {
    if (o === e || o.token || o.hp <= 0 || o.phase !== 'none') continue;
    if (Math.abs(e.x - o.x) < 18 && Math.abs(e.y - o.y) < 10) {
      e.y = clamp(o.y + (idx % 2 ? 10 : -10), laneTop(w, e.x), laneBottom(w));
      if (Math.abs(e.y - o.y) < 10) e.x = o.x + side * 18;
    }
  }
}

// Опасности живут в мире, а не в клиентских эффектах.
function stepBossHazards(w: World, dtMs: number, ev: SimEvent[]) {
  const bounds = w.enc.lock ?? [0, levelW(w)];
  w.shots = w.shots.filter(s => {
    const from = s.x; s.x += s.dir * s.speed * dtMs / 1000;
    const p = livePlayers(w).find(p => p.x >= Math.min(from, s.x) - 10 && p.x <= Math.max(from, s.x) + 10 && Math.abs(p.y - s.y) <= 12);
    if (p) { enemyHit(w, p, s.dmg, ev); return false; }
    return s.x >= bounds[0] && s.x <= bounds[1];
  });
  w.zones = w.zones.filter(z => {
    z.ms -= dtMs; z.tickMs -= dtMs;
    while (z.tickMs <= 0) {
      for (const p of livePlayers(w)) if (Math.abs(p.x - z.x) <= z.r && Math.abs(p.y - z.y) <= z.r * 0.4) enemyHit(w, p, z.dmg, ev);
      z.tickMs += 500;
    }
    return z.ms > 0;
  });
}

// Геометрия фиксируется при замахе; клиент получает те же фигуры.
function planBossAttack(w: World, e: Enemy, targets: Player[], ev: SimEvent[]) {
  const a = BOSS_ATTACK[e.atk!], bounds = w.enc.lock ?? [0, levelW(w)];
  const tele = (shape: Extract<SimEvent, { t: 'tele'; shape: string }>['shape'], x: number, y: number, r?: number, h?: number, delayMs = 0) =>
    ev.push({ t: 'tele', id: e.id, attack: a.id, shape, x, y, r, h, ms: a.windupMs, delayMs });
  if (a.kind === 'ring') tele('ring', e.x, e.y, a.radius);
  if (a.kind === 'line' || a.kind === 'grid') {
    const top = laneTop(w, (bounds[0] + bounds[1]) / 2), bottom = laneBottom(w);
    if (a.kind === 'grid') {
      const h = (bottom - top) / 3, safe = Math.floor(rand(w) * 3);
      e.bands = [0, 1, 2].filter(i => i !== safe).map(i => ({ y: top + h * (i + 0.5), h: h / 2 }));
    } else {
      const y = targets.reduce((a, b) => Math.hypot(a.x-e.x,a.y-e.y) < Math.hypot(b.x-e.x,b.y-e.y) ? a : b).y;
      const second = y + (y < (top + bottom) / 2 ? 1 : -1) * 56;
      e.bands = [{ y, h: 16 }, { y: second, h: 16 }];
    }
    for (const b of e.bands) tele(a.kind === 'grid' ? 'grid' : 'line', bounds[0], b.y, undefined, b.h);
  }
  if (a.kind === 'cross') {
    const target = targets.reduce((near, p) => Math.hypot(p.x-e.x,p.y-e.y) < Math.hypot(near.x-e.x,near.y-e.y) ? p : near);
    e.atkX = target.x; e.atkY = target.y;
    tele('line', bounds[0], target.y, undefined, a.depth);
    tele('column', target.x, laneTop(w, target.x), undefined, a.reach);
  }
  if (['zones', 'pyro', 'salute', 'banStrike'].includes(a.kind)) {
    e.zonePoints = Array.from({ length: a.kind === 'banStrike' ? targets.length : a.count! }, (_, i) => {
      if (targets[i]) return { x: targets[i].x, y: targets[i].y };
      const x = bounds[0] + rand(w) * (bounds[1] - bounds[0]);
      return { x, y: laneTop(w, x) + rand(w) * (laneBottom(w) - laneTop(w, x)) };
    });
    e.zonePoints.forEach((p, i) => tele(a.kind === 'banStrike' ? 'ban' : 'zone', p.x, p.y, a.zoneR, undefined, a.kind === 'salute' ? i * 120 : 0));
  }
}
const inEllipse = (p: Player, x: number, y: number, r: number, ratio: number) => ((p.x-x)/r)**2 + ((p.y-y)/(r*ratio))**2 <= 1;
function resolveBossArea(w: World, e: Enemy, targets: Player[], ev: SimEvent[], point?: number) {
  const a = BOSS_ATTACK[e.atk!];
  const fx = (x: number, y: number, h?: number, tint?: number) => ev.push({ t: 'bossFx', id: e.id, attack: a.id, x, y, h, ms: a.activeMs, tint });
  if (a.kind === 'ring') {
    fx(e.atkX!, e.atkY!);
    for (const p of targets) if (inEllipse(p, e.atkX!, e.atkY!, a.radius!, 0.35)) {
      enemyHit(w, p, a.dmg, ev); p.x += (p.x < e.atkX! ? -1 : 1) * 90;
    }
  }
  if (a.kind === 'line' || a.kind === 'grid') for (const b of e.bands ?? []) {
    fx(w.enc.lock?.[0] ?? 0, b.y, b.h);
    for (const p of targets) if (Math.abs(p.y - b.y) <= b.h) enemyHit(w, p, a.dmg, ev);
  }
  if (a.kind === 'cross') {
    fx(e.atkX!, e.atkY!, a.depth);
    for (const p of targets) if (Math.abs(p.y - e.atkY!) <= a.depth! || Math.abs(p.x - e.atkX!) <= a.reach!) enemyHit(w, p, a.dmg, ev);
  }
  if (['zones', 'pyro', 'salute', 'banStrike'].includes(a.kind)) {
    const points = point === undefined ? e.zonePoints ?? [] : [e.zonePoints![point]];
    for (const p of points) {
      if (a.kind !== 'pyro' || !e.shotCount) fx(p.x, p.y, undefined, a.kind === 'salute' ? [0xffd34f,0xff4fd8,0x4fd8ff,0xffffff][Math.floor(rand(w)*4)] : undefined);
      if (a.kind !== 'zones') for (const target of targets) if (inEllipse(target, p.x, p.y, a.zoneR!, 0.4)) enemyHit(w, target, a.dmg, ev, a.kind === 'pyro' ? 400 : undefined);
    }
  }
}

function stepBoss(w: World, e: Enemy, targets: Player[], dtMs: number, ev: SimEvent[]) {
  const info = BOSS[e.boss!];
  if (e.phase === 'none') {
    const list = info.attacks[(e.bossPhase ?? 1) - 1];
    let selected: string | undefined, selectedIndex = 0;
    for (let n = 0; n < list.length; n++) {
      const i = ((e.atkIndex ?? 0) + n) % list.length;
      if ((e.cooldowns?.[list[i]] ?? 0) <= w.timeMs) { selected = list[i]; selectedIndex = i; break; }
    }
    const t = targets.find(p => p.id === (e.token ?? e.target));
    if (!t || !selected) { e.anim = 'idle'; if (!selected) releaseToken(w, e); return; }
    const a = BOSS_ATTACK[selected];
    const wide = !['melee', 'shots', 'summon'].includes(a.kind);
    const gap = a.kind === 'melee' ? a.reach! - 6 : 85;
    const gx = w.enc.lock ? clamp(t.x + (e.x < t.x ? -gap : gap), w.enc.lock[0] + 12, w.enc.lock[1] - 12) : t.x + (e.x < t.x ? -gap : gap);
    const dx = gx - e.x, dy = t.y - e.y;
    e.facing = t.x > e.x ? 1 : -1;
    if (!e.token || Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      const len = Math.hypot(dx, dy), dist = Math.min(len, info.speed * (e.slowMs ? 1 - (e.slow ?? 0) : 1) * dtMs / 1000);
      if (len) { e.x += dx / len * dist; e.y += dy / len * dist; }
      e.anim = 'walk'; return;
    }
    // Большой телеграф создаёт честное окно для уклонения: рядовые враги
    // прекращают свои замахи, но остаются на арене и снова давят после атаки.
    if (wide) for (const o of Object.values(w.enemies)) if (o !== e && o.token) cancelAttack(w, o);
    e.atkIndex = (selectedIndex + 1) % list.length;
    e.wideToken = wide; e.atk = selected; e.atkX = e.x; e.atkY = e.y; e.atkDir = e.facing;
    e.phase = 'windup'; e.phaseMs = a.windupMs; e.anim = 'windup';
    planBossAttack(w, e, targets, ev);
    return;
  }
  const a = BOSS_ATTACK[e.atk!];
  if (!a) { cancelAttack(w, e); return; }
  e.phaseMs -= dtMs;
  if (e.phase === 'windup' && e.phaseMs <= 0) {
    e.phase = 'active'; e.phaseMs = a.activeMs; e.shotCount = 0; e.shotMs = dtMs;
    (e.cooldowns ??= {})[a.id] = w.timeMs + a.cdMs;
    if (a.kind === 'melee') for (const p of targets) {
      const dx = (p.x - (e.atkX ?? e.x)) * e.atkDir!;
      if (dx >= 0 && dx <= a.reach! && Math.abs(p.y - e.atkY!) <= a.depth!) enemyHit(w, p, a.dmg, ev);
    }
    if (a.kind !== 'salute' && a.kind !== 'pyro') resolveBossArea(w, e, targets, ev);
    if (a.kind === 'zones') for (const p of e.zonePoints ?? []) w.zones.push({ ...p, r: a.zoneR!, ms: a.zoneMs!, tickMs: 500, dmg: a.dmg });
    if (a.kind === 'summon') for (const group of a.summon ?? []) for (let n = 0; n < group.n; n++) {
      if (Object.values(w.enemies).filter(o => o.hp > 0).length >= MAX_ALIVE) break;
      const kind = group.kind as EnemyKind, stats = ROLE[KIND[kind].role], bounds = w.enc.lock ?? [0, levelW(w)];
      const id = 'e' + w.nextEnemyId++, hp = Math.round(stats.hp * (KIND[kind].hpMult ?? 1));
      w.enemies[id] = { id, kind, hp, maxHp: hp, x: bounds[1] + ENTER_OFF, y: e.y, facing: -1, phase: 'none', phaseMs: 0, anim: 'run', animMs: 0, cdMs: 0 };
    }
  } else if (e.phase === 'active' && e.phaseMs <= 0) {
    releaseToken(w, e); e.phase = 'recover'; e.phaseMs = a.recoverMs;
  } else if (e.phase === 'recover' && e.phaseMs <= 0) { e.phase = 'none'; e.atk = undefined; }
  if (e.phase === 'active' && (a.kind === 'pyro' || a.kind === 'salute')) {
    const elapsed = a.activeMs - e.phaseMs, interval = a.kind === 'pyro' ? 400 : 120;
    while ((e.shotCount ?? 0) * interval <= elapsed && e.shotCount! < (a.kind === 'pyro' ? 3 : 9)) {
      resolveBossArea(w, e, targets, ev, a.kind === 'salute' ? e.shotCount : undefined);
      e.shotCount!++;
    }
  }
  if (e.phase === 'active' && a.kind === 'shots') {
    e.shotMs = (e.shotMs ?? 0) - dtMs;
    while (e.shotMs <= 0 && e.shotCount! < a.count! && targets.length) {
      const p = targets.reduce((a, b) => Math.hypot(a.x - e.x, a.y - e.y) < Math.hypot(b.x - e.x, b.y - e.y) ? a : b);
      w.shots.push({ x: e.x, y: p.y, dir: e.atkDir!, speed: a.speed!, dmg: a.dmg });
      e.shotCount!++; e.shotMs += 100;
    }
  }
  e.anim = e.phase === 'active' ? 'strike' : e.phase === 'none' ? 'idle' : e.phase;
}

// Запрос из тестовой кнопки; событие отдаётся ближайшим тиком.
export function nextStage(w: World) {
  if (!w.testTools || w.trans) return;
  w.trans = { ms: 900, to: (w.stage + 1) % LEVELS[w.level].stages.length };
  w.exitEvent = true;
}

function finishTransition(w: World, ev: SimEvent[]) {
  w.pauseMs = 0; w.slowmoMs = 0;
  w.stage = w.trans!.to; w.halt = -1; w.cine = undefined;
  w.enc = { stage: w.stage, index: 0, wave: 0, queue: [], lock: null, cleared: 0 };
  w.tokenReleased = {}; w.won = false;
  w.trans = undefined;
  w.enemies = {};
  w.pending = []; w.shots = []; w.zones = [];
  const [x, y] = stageOf(w).spawn;
  Object.values(w.players).forEach((p, i) => {
    Object.assign(p, clampToLane(w, x - i * 30, y + i * 20));
    p.approach = undefined; p.hop = undefined; p.queued = null; p.wantBall = false;
    p.stormMs = 0; p.hitstopMs = 0;
    p.anim = p.hp > 0 ? 'idle' : 'down'; p.animMs = 0;
    p.move = p.hp > 0 ? 'idle' : 'fall'; p.moveT = 0;
  });
  if (w.testTools) ensureDummy(w);
  ev.push({ t: 'stage', stage: w.stage });
  storyEvent(w, ev, 'stage');
}

function stepCore(w: World, inputs: Record<string, Input>, dtMs = TICK_MS): SimEvent[] {
  const ev: SimEvent[] = w.events?.splice(0) ?? [];
  let dt = dtMs / 1000;
  const players = Object.values(w.players);
  const storyFallen = new Set(players.filter(p => p.hp <= 0).map(p => p.id));
  const active = players.filter(p => p.connected && !p.away);

  // Никого нет за экраном: мир стоит, пока хост шлёт ссылку в мессенджер
  if (active.length === 0) return ev;
  if (w.pauseMs) { w.pauseMs = Math.max(0, w.pauseMs - dtMs); return ev; }
  if (w.slowmoMs) { const slowPart = Math.min(dtMs, w.slowmoMs); w.slowmoMs -= slowPart; dtMs -= slowPart * 0.7; dt = dtMs / 1000; }
  if (w.cine) {
    const skip = active.some(p => { const i = inputs[p.id]; return i && (i.skip || i.attack || i.heavy || i.ult || i.ult2); });
    w.cine.ms = Math.max(0, Math.min(w.cine.ms, skip ? 300 : Infinity) - dtMs);
    if (!w.cine.ms) w.cine = undefined;
    return ev;
  }
  for (const e of Object.values(w.enemies)) if (combatReady(w, e) && w.enc.lock && !e.entered) {
    e.entering = e.x > w.enc.lock[1] - 12;
    e.entered = true;
  }
  w.tick++; w.timeMs += dtMs;

  if (w.trans) {
    if (w.exitEvent) { ev.push({ t: 'exit', to: w.trans.to }); w.exitEvent = false; }
    w.trans.ms -= dtMs;
    if (w.trans.ms <= 0) finishTransition(w, ev);
    return ev;
  }

  if (w.level === 'route') stepEncounters(w, ev, dtMs);
  else if (w.testTools) ensureDummy(w);
  else if (Object.keys(w.enemies).length === 0) spawnWave(w, ev);

  for (const p of active) {
    const inp = inputs[p.id] ?? emptyInput();
    p.hitCountMs = Math.max(0, p.hitCountMs - dtMs);
    if (!p.hitCountMs) p.hitCount = 0;
    p.cdMs = Math.max(0, p.cdMs - dtMs);
    p.tauntCdMs = Math.max(0, p.tauntCdMs - dtMs);
    p.animMs = Math.max(0, p.animMs - dtMs);

    if (p.hp <= 0) {
      p.anim = 'down';
      p.downMs -= dtMs;
      if (isHero(p)) p.moveT += dtMs;
      const buddyAlive = active.some(o => o !== p && o.hp > 0);
      if (buddyAlive && p.downMs <= 0) {
        p.hp = PLAYER_HP / 2; p.anim = 'idle';
        if (isHero(p)) { startMove(p, 'getup'); p.invulnMs = 1200; }
      }
      continue;
    }

    if (isHero(p)) { stepHero(w, p, inp, dtMs, ev); continue; }

    const busy = p.animMs > 0 && (p.anim === 'attack' || p.anim === 'heavy' || p.anim === 'ult' || p.anim === 'hurt');
    if (!busy) {
      const mx = clamp(inp.mx, -1, 1), my = clamp(inp.my, -1, 1);
      p.x = clamp(p.x + mx * PLAYER_SPEED * dt, ...walkBounds(w));
      p.y = clamp(p.y + my * PLAYER_SPEED * 0.7 * dt, laneTop(w, p.x), laneBottom(w));
      if (mx !== 0) p.facing = mx > 0 ? 1 : -1;
      if (p.animMs === 0) p.anim = mx !== 0 || my !== 0 ? 'walk' : 'idle';

      if (inp.ult && p.ult >= 100) {
        p.ult = 0; p.anim = 'ult'; p.animMs = 600;
        hitEnemies(w, p, 140, 35, ev, true);
        ev.push({ t: 'ult', id: p.id });
      } else if (inp.heavy && p.cdMs === 0) {
        p.anim = 'heavy'; p.animMs = 450; p.cdMs = 700;
        hitEnemies(w, p, 52, 18, ev);
      } else if (inp.attack && p.cdMs === 0) {
        p.anim = 'attack'; p.animMs = 200; p.cdMs = 250;
        hitEnemies(w, p, 44, 8, ev);
      } else if (inp.taunt && p.tauntCdMs === 0) {
        const ch = CHARACTERS.find(c => c.id === p.char);
        const lines = ch?.taunts ?? ['...'];
        p.anim = 'taunt'; p.animMs = 600; p.tauntCdMs = TAUNT_CD_MS;
        ev.push({ t: 'taunt', id: p.id, line: lines[Math.floor(rand(w) * lines.length)] });
      }
    }
  }

  stepPending(w, dtMs, ev);

  stepBossHazards(w, dtMs, ev);
  prepareTokens(w, dtMs);
  // Враги: к ближайшему живому игроку на его дорожку, удар, пауза
  const targets = active.filter(p => p.hp > 0);
  for (const e of Object.values(w.enemies)) {
    if (e.held || e.thrown) {
      const owner = w.players[e.held?.by ?? e.thrown?.by ?? ''];
      if (!owner || !e.thrown && (owner.hp <= 0 || !owner.connected || owner.away || e.hp <= 0)) { if (owner) releaseGrab(w, owner); e.held = undefined; e.thrown = undefined; clearCarry(e); }
      else if (e.thrown) stepRamilThrow(w, owner, e, dtMs, ev);
      else { e.anim = 'down'; cancelAttack(w, e); }
      continue;
    }
    if ((e.ultStopMs ?? 0) > 0) {
      e.ultStopMs = Math.max(0, e.ultStopMs! - dtMs);
      if (!e.ultStopMs) e.ultStopBy = undefined;
      continue;
    }
    if (e.hp > 0 && w.enc.lock && (!e.entered || e.entering)) {
      if (e.bornTick === w.tick) continue;
      if (e.enterMs) { e.enterMs = Math.max(0, e.enterMs - dtMs); e.anim = 'enter'; if (!e.enterMs && e.phase === 'enter') e.phase = 'none'; }
      else {
        const speed = Math.max(ENTER_SPEED, e.boss ? BOSS[e.boss].speed : ROLE[KIND[e.kind].role].speed);
        e.x = Math.max(w.enc.lock[1] - 12, e.x - speed * dt);
        e.entering = e.x > w.enc.lock[1] - 12;
        e.anim = 'run';
      }
      if (combatReady(w, e)) e.entered = true;
      continue;
    }
    if (e.boss) {
      if (e.hp <= 0) {
        cancelAttack(w, e); e.anim = (e.deathMs ?? 1500) > 1230 ? 'hurt' : 'down';
        if (e.deathMs === undefined) {
          e.deathMs = 1500; w.slowmoMs = 900; w.shots = []; w.zones = []; ev.push({ t: 'bossDown', id: e.id });
          w.enc.bossIndex = (w.enc.bossIndex ?? 0) + 1; w.enc.bossStarted = false; w.enc.bossWait = 1500;
        }
        else e.deathMs -= dtMs;
        if (e.deathMs <= 0) delete w.enemies[e.id];
        continue;
      }
      if (e.bossPhase === 1 && e.hp <= BOSS[e.boss].phase2At * e.maxHp) {
        e.bossPhase = 2; w.pauseMs = 400; cancelAttack(w, e); e.atk = undefined; e.invulnMs = 1000;
        ev.push({ t: 'phase', id: e.id });
      }
      if ((e.invulnMs ?? 0) > 0) { e.invulnMs = Math.max(0, e.invulnMs! - dtMs); e.anim = 'idle'; continue; }
    }
    if (e.hp <= 0 || e.frozenMs || e.stunMs || e.air || e.pin || e.charmMs || e.anim === 'down' && e.animMs > 0) cancelAttack(w, e);
    e.animMs = Math.max(0, e.animMs - dtMs);
    e.cdMs = Math.max(0, e.cdMs - dtMs);
    if (e.air) {
      e.airTotal = (e.airTotal ?? 0) + dtMs;
      e.air = Math.max(0, e.air - dtMs);
      if (!e.bouncing && e.airTotal >= JUGGLE_MAX_MS) e.air = 0;
      const u = 1 - e.air / (e.airSpan ?? AIR_MS);
      e.height = e.air ? (e.airStartH ?? 0) * (1 - u) + 4 * (e.airPeak ?? LAUNCH_H) * u * (1 - u) : 0;
      if (!e.air) { e.airTotal = 0; e.airHits = 0; e.anim = 'down'; e.animMs = AIR_MS; }
    }
    stepPin(w, e, dtMs, ev);
    if (e.slowMs) e.slowMs = Math.max(0, e.slowMs - dtMs);
    if (e.stunMs) { e.stunMs = Math.max(0, e.stunMs - dtMs); if (!e.stunMs) e.ultStunBy = undefined; }
    if (e.charmMs) e.charmMs = Math.max(0, e.charmMs - dtMs);
    if (e.frozenMs) {
      e.frozenMs = Math.max(0, e.frozenMs - dtMs);
      if (!e.frozenMs) e.frozenBy = undefined;
      if (e.hp <= 0) { if (e.dummy) e.hp = e.maxHp; else { delete w.enemies[e.id]; continue; } }
      e.anim = 'idle'; e.animMs = 0;
      continue; // замёрзший стоит и не бьёт
    }
    if (e.air && e.hp > 0) { e.anim = 'down'; continue; }
    if (e.dummy) {
      if (e.hp <= 0) e.hp = e.maxHp;
      if (!e.boss && (e.anim === 'hurt' || e.anim === 'down') && e.animMs > 0) continue;
      e.anim = 'idle';
      e.hp = Math.min(e.maxHp, e.hp + 40 * dt);
      const hx = (e.homeX ?? e.x) - e.x, hy = (e.homeY ?? e.y) - e.y, hl = Math.hypot(hx, hy);
      if (hl > 3) { e.x += (hx / hl) * 60 * dt; e.y += (hy / hl) * 60 * dt; }
      continue;
    }
    if (e.hp <= 0) { delete w.enemies[e.id]; continue; }
    if (!e.boss && (e.anim === 'hurt' || e.anim === 'down') && e.animMs > 0) continue;
    if (e.pin) { e.anim = 'down'; continue; }
    if (e.stunMs) { e.anim = 'idle'; continue; } // оглушён: стоит
    const speed = ROLE[KIND[e.kind].role].speed * (e.slowMs ? 1 - (e.slow ?? 0) : 1);
    // Ревность: бьёт ближайшего другого врага; если некого, стоит и любуется Надей
    if (e.charmMs) {
      const rivals = Object.values(w.enemies).filter(o => combatReady(w, o) && o !== e && o.hp > 0);
      if (rivals.length === 0) { e.anim = 'idle'; continue; }
      const r = rivals.reduce((a, b) => (Math.abs(a.x - e.x) + Math.abs(a.y - e.y) < Math.abs(b.x - e.x) + Math.abs(b.y - e.y) ? a : b));
      const rx = r.x + (e.x < r.x ? -30 : 30) - e.x, ry = r.y - e.y;
      e.facing = r.x > e.x ? 1 : -1;
      if (Math.abs(rx) > 4 || Math.abs(ry) > 3) {
        const len = Math.hypot(rx, ry);
        e.x += (rx / len) * speed * dt; e.y += (ry / len) * speed * dt;
        if (e.animMs === 0) e.anim = 'walk';
      } else if (e.cdMs === 0) {
        e.anim = 'attack'; e.animMs = 300; e.cdMs = 1400;
        const dmg = Math.ceil(ENEMY_DMG * 0.5);
        if ((r.invulnMs ?? 0) > 0) continue;
        r.hp -= dmg;
        if (!r.frozenMs && !r.boss) { cancelAttack(w, r); r.anim = 'hurt'; r.animMs = 250; }
        ev.push({ t: 'hit', target: r.id, dmg, x: r.x, y: r.y });
        const nadya = e.charmBy ? w.players[e.charmBy] : undefined;
        if (nadya && !nadya.charmSaid) { nadya.charmSaid = true; ev.push({ t: 'taunt', id: nadya.id, line: CHARM_LINE }); }
      } else if (e.animMs === 0) e.anim = 'idle';
      continue;
    }
    if (e.boss) { stepBoss(w, e, targets, dtMs, ev); if (e.animMs > 0) e.anim = 'hurt'; }
    else stepEnemyAttack(w, e, targets, speed, dtMs, ev);
  }

  for (const p of active) if (p.hp <= 0 && !storyFallen.has(p.id)) {
    const friends = livePlayers(w).filter(o => o.id !== p.id);
    if (friends.length && rand(w) < 0.5) storyEvent(w, ev, 'friend', friends, p.char);
    else storyEvent(w, ev, 'down', [p]);
  }
  // Все на связи лежат: перезапуск уровня
  if (active.every(p => p.hp <= 0)) {
    w.enemies = {};
    w.pending = []; w.shots = []; w.zones = [];
    w.wave = 0; w.pauseMs = 0; w.slowmoMs = 0;
    w.tokenReleased = {};
    if (w.enc.lock) {
      if (w.enc.bossStarted || (w.enc.bossIndex ?? 0) > 0) { w.enc.bossStarted = false; w.enc.bossWait = undefined; w.enc.queue = []; }
      else {
        w.enc.wave = 0;
        w.enc.queue = [...(encountersOf(w)[w.enc.index].waves[0] ?? [])];
      }
    }
    for (const [i, p] of players.entries()) { p.hp = PLAYER_HP; p.anim = 'idle'; p.animMs = 0; p.ult = 0; p.charge2 = 0; Object.assign(p, clampToLane(w, (w.enc.lock ? w.enc.lock[0] + 60 + i * 30 : stageOf(w).spawn[0]), p.y)); heroReset(p); }
    ev.push({ t: 'restart' });
  }

  for (const p of players) {
    Object.assign(p, clampToLane(w, p.x, p.y));
    if (w.enc.lock) p.x = clamp(p.x, w.enc.lock[0] + 20, w.enc.lock[1] - 20);
  }
  for (const e of Object.values(w.enemies)) {
    e.x = clampEnemyX(w, e.x, e);
    e.y = clamp(e.y, laneTop(w, clamp(e.x, 0, levelW(w))), laneBottom(w));
  }
  if (stageOf(w).tunnel && w.enc.cleared === encountersOf(w).length && !w.enc.lock) {
    w.halt = w.halt < 0 ? 0 : Math.min(HALT_MS, w.halt + dtMs);
  }
  const exit = stageOf(w).exit;
  if ((!stageOf(w).tunnel || w.halt >= HALT_MS) && (w.level !== 'route' || w.enc.cleared === encountersOf(w).length) && exit && w.stage + 1 < LEVELS[w.level].stages.length && active.some(p => p.hp > 0 && p.x >= exit.x0 && p.x <= exit.x1 && p.y <= exit.y1)) {
    w.trans = { ms: 900, to: w.stage + 1 };
    ev.push({ t: 'exit', to: w.trans.to });
  }

  return ev;
}

// Сюжетные события используют то же время и seed, что бой.
function storyEvent(w: World, ev: SimEvent[], kind: 'won' | 'friend' | 'down' | 'stage', candidates = livePlayers(w), fallen = '') {
  if (w.timeMs < (w.storyLineAt ?? -10000) + 10000 || w.timeMs < (w.storyManualAt ?? -2000) + 2000) return;
  const suitable = candidates.filter(p => p.connected && !p.away && LINE_HEROES.includes(p.char));
  if (!suitable.length) return;
  const p = suitable[Math.floor(rand(w) * suitable.length)];
  const line = LINES[kind][LINE_HEROES.indexOf(p.char)].replace('{имя}', CALL_NAMES[LINE_HEROES.indexOf(fallen)] ?? fallen);
  ev.push({ t: 'taunt', id: p.id, line }); w.storyLineAt = w.timeMs;
}
export function step(w: World, inputs: Record<string, Input>, dtMs = TICK_MS): SimEvent[] {
  const stage = w.stage;
  for (const i of Object.values(inputs)) if (i.taunt) w.storyManualAt = w.timeMs;
  const ev = stepCore(w, inputs, dtMs);
  const alive = livePlayers(w);
  w.storyReady ??= [];
  for (const p of alive) if (p.ult >= 100 && !w.storyReady.includes(p.char)) {
    w.storyReady.push(p.char); ev.push({ t: 'taunt', id: p.id, line: LINES.ready[LINE_HEROES.indexOf(p.char)] });
  }
  w.storyLast ??= [];
  for (const e of ev) if (e.t === 'bossDown') {
    const boss = w.enemies[e.id]?.boss;
    if (boss && LINES.last[boss]) w.storyLast.push({ id: e.id, line: LINES.last[boss], at: w.timeMs + 600 });
    if (boss === 'pizdulina') { w.storyPizDown = true; w.storyPushes ??= [0,0,0,0,0,0]; if (!w.storyPushes[4]) w.storyPushes[4] = w.timeMs + 2000; }
  }
  for (const line of w.storyLast) if (w.timeMs >= line.at) ev.push({ t: 'taunt', id: line.id, line: line.line });
  w.storyLast = w.storyLast.filter(line => w.timeMs < line.at);
  w.storyPushes ??= [0,0,0,0,0,0];
  const mark = (i: number) => { if (!w.storyPushes![i]) w.storyPushes![i] = Math.max(1, w.timeMs); };
  if (w.stage === 0 && w.enc.cleared >= 1) mark(0);
  if (w.stage === 0 && w.enc.cleared >= 2) mark(1);
  if (w.stage === 2 && w.enc.cleared >= 1) mark(2);
  if (w.stage === 3 && w.enc.cleared >= 1) mark(3);
  if (w.stage === 5 && w.enc.cleared >= 1) mark(5);
  return ev;
}

// Постановка использует отдельный шаг: бой и его часы стоят.
export function stepActors(w: World, dtMs: number) {
  for (const a of Object.values(w.actors)) {
    const dx = a.tx - a.x, dy = a.ty - a.y, distance = Math.hypot(dx, dy);
    if (distance > 0) {
      const ratio = Math.min(1, a.speed * dtMs / 1000 / distance);
      a.x += dx * ratio; a.y += dy * ratio;
      if (ratio === 1) a.anim = 'idle';
    }
    const player = Object.values(w.players).find(p => p.char === a.id);
    if (player) { player.facing = a.facing; player.anim = a.anim as Anim; }
  }
}
