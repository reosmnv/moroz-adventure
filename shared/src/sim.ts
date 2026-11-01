// Общая симуляция боя: одна и та же для сервера (онлайн) и браузера (офлайн).
// Чистые данные и функции, без Phaser и Colyseus.
import { LEVELS, stageOf, laneTop, laneBottom, levelW, walkBounds, clampToLane } from './levels.ts';
import { KIND, ROLE, MAX_ALIVE, TOKENS_PER_TARGET, TOKENS_TOTAL, TOKEN_GAP_MS, WAIT_RING, GUARD_FRONT_MULT, type EnemyKind } from './enemy-data.ts';
import { BOSS, BOSS_ATTACK, type BossId } from './boss-data.ts';
import { ENCOUNTERS, type Spawn } from './encounters.ts';
import type { Form } from './anims-data.ts';
import {
  HOP_MS, HOP_DIST, ATTACK_BAND, MAGNET_GAP, MAGNET_DIST, RUSH_DIST, LAUNCH_H, JUGGLE_REFRESH_MS, JUGGLE_MULT, JUGGLE_STEP, JUGGLE_MULT_MAX, JUGGLE_MAX_MS, SLAM_MULT, BOUNCE_MS, BOUNCE_H, HIT_CHAIN_MS, PIN_MS, PIN_KB_MIN, PIN_SIZE, PIN_DMG, PIN_KB, KILL_EXTEND_MS, AIR_CHARGE_MULT,
  AIR_MS, AIM_MS, BALL_FLIGHT_MS, BALL_LINES, BALL_PER_HIT, BALL_NEAR_NASTYA, BALL_RADIUS, BALL_THROW, BEAM_DMG, BEAM_LEN, CHAIN, CHARM_LINE, CHARM_MS, COMBO_MS, COMBO_MS_BY,
  CONTROL_ULT, DASH_DELAY_MS, DASH_DIST, FLASH_CD_MS, FLASH_SPEED, HEAVY, HERO_FORM, HERO_ID, HURT_INVULN_MS, FREEZE_MS, HITSTOP_HEAVY_MS, HITSTOP_MS,
  IMMUNE_INVULN_MS, KISS_BAND, KISS_HALF_W, KISS_SPEED, KNOCK_MULT, KRIS_ID, KRIS_LENS, NADYA_ID, NEXT_MOVE, RANGE_MULT, RUN_MULT, STORM_DMG, STORM_MS, STORM_RADIUS, STORM_TICK_MS, SPEED_MULT, STRIKES, ULT_MS,
  hitTimesMs, isLoop, isSpriteHero, moveDurMs, moveTotalMs, type Strike,
} from './hero-data.ts';

export const TICK_MS = 17; // ~60 Гц: нажатие ждёт тик не дольше 17 мс
export const VIEW_W = 480;
export const VIEW_H = 270;
export const LANE_TOP = 168; // линия стены на фоне уровня 1
export const LANE_BOTTOM = 255;
export const LEVEL_W = 1920; // длина уровня: 4 экрана по 480

// Тестовые инструменты (манекен вместо волн, кнопка «+3 врага»). false перед релизом
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
  { id: HERO_ID, name: 'Анастасия', color: 0x9d74d4, taunts: ['В эфире тишина. Сейчас будет громко', 'Дубль второй не понадобится'] },
  { id: NADYA_ID, name: 'Надежда', color: 0xc2185b, taunts: ['Ты точно ко мне?', 'Не строй планов', 'Шансов не было', 'Очередь занимай', 'А котик у тебя есть?'] },
  { id: KRIS_ID, name: 'Kris', color: 0x9be33b, taunts: ['Свет плохой, давай ещё дубль', 'Стоп, снято', 'Улыбочку'] },
  { id: 'd', name: 'Гоша', color: 0xf2a541, taunts: ['Не позорься', 'Я даже не вспотел'] },
];

export interface Player {
  id: string;
  char: string;
  x: number;
  y: number;
  hp: number;
  facing: 1 | -1;
  anim: Anim;
  animMs: number;
  cdMs: number;
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
  frozenMs?: number; // заморожен: стоит и не бьёт, получает урон без отбрасывания
  air?: number; // мс до приземления
  height?: number; // высота над землёй из sim
  airTotal?: number;
  airSpan?: number;
  airPeak?: number;
  airStartH?: number;
  airHits?: number;
  bouncing?: boolean;
  pin?: { ms: number; speed: number; dir: number; by: string; hit: string[] };
  dummy?: boolean; // манекен: стоит, не бьёт, не умирает
  slowMs?: number; slow?: number; // замедлен: сколько ещё и какую долю скорости теряет
  stunMs?: number; // оглушён: стоит и не бьёт
  charmMs?: number; charmBy?: string; // ревность: бьёт других врагов, а не героев
  homeX?: number;
  homeY?: number;
}

export interface BossShot { x: number; y: number; dir: number; speed: number; dmg: number }
export interface BossZone { x: number; y: number; r: number; ms: number; tickMs: number; dmg: number }
export interface World {
  pauseMs?: number; slowmoMs?: number;
  halt: number; introduced: string[]; cine?: { id: string; kind: string; ms: number };
  shots: BossShot[]; zones: BossZone[];
  timeMs: number;
  tokenReleased: Record<string, number>;
  won: boolean;
  enc: { stage: number; index: number; wave: number; queue: Spawn[]; lock: [number, number] | null; cleared: number; bossIndex?: number; bossStarted?: boolean; bossWait?: number };
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
  pending: Pending[]; // отложенные удары: долетевшая вспышка, взрыв шара, урон после рывка, луч, летящий поцелуй
}

// Удар, который случится позже: ids (по списку врагов), aoe (круг), beam (полоса луча),
// kiss (сердце летит от x к краю уровня по dir, ids = кого уже задело)
export interface Pending { ms: number; kind: 'hits' | 'aoe' | 'beam' | 'kiss'; owner: string; strike: Strike; ids?: string[]; x?: number; y?: number; r?: number; dir?: 1 | -1; flash?: boolean }

export interface Input {
  skip?: boolean;
  mx: number; // -1..1
  my: number; // -1..1
  attack: boolean;
  heavy: boolean;
  taunt: boolean;
  ult: boolean;
  ult2: boolean; // вторая кнопка: снежная буря Анастасии, шар Kris
  run: boolean; // стик на максимуме или Shift
}

export const emptyInput = (): Input => ({ mx: 0, my: 0, attack: false, heavy: false, taunt: false, ult: false, ult2: false, run: false });

export type SimEvent =
  | { t: 'cine'; id: string; kind: string }
  | { t: 'boss' | 'phase' | 'bossDown'; id: string }
  | { t: 'bossFx'; id: string; attack: string; x: number; y: number; h?: number; ms: number; tint?: number }
  | { t: 'tele'; id: string; shape: 'ring' | 'line' | 'zone' | 'ban' | 'grid'; attack?: string; delayMs?: number; x: number; y: number; r?: number; h?: number; dir?: number; ms: number }

  | { t: 'lock'; x0: number; x1: number }
  | { t: 'clear' }
  | { t: 'victory' }
  | { t: 'block'; id: string }
  | { t: 'exit'; to: number }
  | { t: 'stage'; stage: number }
  | { t: 'hit'; target: string; dmg: number; x: number; y: number; word?: string; by?: string }
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
  return { halt: -1, introduced: [], shots: [], zones: [], timeMs: 0, tokenReleased: {}, won: false, enc: { stage, index: 0, wave: 0, queue: [], lock: null, cleared: 0 }, level, stage, tick: 0, seed, wave: 0, nextEnemyId: 1, players: {}, enemies: {}, testTools, pending: [] };
}

export function takenChars(w: World): string[] {
  return Object.values(w.players).map(p => p.char);
}

export function addPlayer(w: World, id: string, char: string): Player {
  // Новичок появляется рядом с живым игроком, а не в начале уровня
  const buddy = Object.values(w.players).find(p => p.connected && p.hp > 0);
  const i = Object.keys(w.players).length;
  const p: Player = {
    id, char,
    ...clampToLane(w, buddy ? buddy.x - 30 * i : stageOf(w).spawn[0], buddy ? buddy.y + 20 * i : stageOf(w).spawn[1]),
    hp: PLAYER_HP, facing: 1, anim: 'idle', animMs: 0, cdMs: 0, tauntCdMs: 0, ult: 0, downMs: 0,
    connected: true, away: false,
    form: HERO_FORM[char] ?? 'prime', move: 'idle', moveT: 0, combo: 0, comboMs: 0, queued: null, formMs: 0, invulnMs: 0, hitstopMs: 0, stormMs: 0, stormTickMs: 0,
    hitCount: 0, hitCountMs: 0, ultimateExtraMs: 0, bCombo: 0, bComboMs: 0, charge2: 0, dashFrom: 0, charmSaid: false, wantBall: false,
  };
  w.players[id] = p;
  return p;
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
  const p = w.players[id];
  if (p) { p.ult = 100; p.charge2 = 100; } // тестовая кнопка: и ульта, и шар Kris
}

export function spawnEnemies(w: World, count: number) {
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
  spawnEnemies(w, 2 + w.wave);
  ev.push({ t: 'wave', n: w.wave });
}

type HitOpts = {
  kb?: number; stun?: number; down?: boolean; launch?: boolean; slam?: boolean; pin?: boolean; fixedDmg?: boolean; everyone?: boolean; silent?: boolean;
  slowMs?: number; slow?: number; stunMs?: number; single?: boolean; word?: string; noCharge?: boolean; flash?: boolean;
};

// Одно попадание по врагу: урон, отлёт, контроль, шкалы героя, событие
function applyHit(w: World, p: Player, e: Enemy, dmg: number, dir: number, ev: SimEvent[], opts: HitOpts, allAround = false) {
  if (!combatReady(w, e) || e.hp <= 0 || (e.invulnMs ?? 0) > 0) return;
  if (w.enc.lock) e.entered = true;
  const heavy = opts.down || opts.launch || opts.slam || opts.pin || opts.stunMs || e.frozenMs;
  const blocked = KIND[e.kind].guard && e.phase !== 'windup' && e.phase !== 'recover'
    && (p.x - e.x) * e.facing > 0 && !heavy && !allAround && !opts.noCharge && !opts.flash;
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
  if (!e.frozenMs && !blocked && !armored) {
    e.anim = opts.down || opts.slam || airborne ? 'down' : 'hurt';
    e.animMs = opts.down || opts.slam ? AIR_MS : (opts.stun ?? 250);
    if (opts.slam) setAir(e, BOUNCE_MS, BOUNCE_H, true);
    else if (opts.launch || airborne) {
      if (!airborne) { e.airTotal = 0; e.airHits = 0; }
      setAir(e, airborne ? JUGGLE_REFRESH_MS : AIR_MS, LAUNCH_H, false);
    }
    const kb = airborne || opts.launch ? 0 : (opts.kb ?? (allAround ? 30 : 8));
    if ((opts.pin || opts.down) && kb !== 0) {
      e.pin = { ms: PIN_MS, speed: kb / PIN_MS, dir, by: p.id, hit: [] };
    } else e.x = clampEnemyX(w, e.x + dir * kb, e);
  }
  if (e.boss && !e.frozenMs) { e.x = clampEnemyX(w, e.x + dir * (opts.kb ?? 8) * 0.25, e); e.anim = 'hurt'; e.animMs = 120; }
  if (opts.slowMs) { e.slowMs = opts.slowMs; e.slow = opts.slow ?? 0.5; }
  if (opts.stunMs && !e.boss) { e.stunMs = opts.stunMs; e.anim = 'hurt'; e.animMs = Math.max(e.animMs, opts.stunMs); }
  if (opts.silent) return;
  if (!opts.noCharge && p.form !== 'ultimate') { // в Ultimate шкала не копится
    const control = p.form === 'nadya' && (opts.slowMs || opts.stunMs) ? CONTROL_ULT : 0;
    p.ult = Math.min(100, p.ult + dmg * (p.char === HERO_ID && airborne ? AIR_CHARGE_MULT : 1) + control);
  }
  if (opts.flash) p.charge2 = Math.min(100, p.charge2 + BALL_PER_HIT);
  ev.push({ t: 'hit', target: e.id, dmg, x: e.x, y: e.y, word: opts.word, by: p.id });
}

const combatReady = (w: World, e: Enemy) => !w.enc.lock || !e.enterMs && (e.entered || e.x >= w.enc.lock[0] && e.x <= w.enc.lock[1] + ENTER_MARGIN);
// В полосе входа враг уже уязвим, но доходит до границы без скачка.
const clampEnemyX = (w: World, x: number, e: Enemy) => w.enc.lock
  ? e.entered ? clamp(x, w.enc.lock[0] + 12, e.entering ? Math.max(e.x, w.enc.lock[1] - 12) : w.enc.lock[1] - 12) : x
  : clamp(x, Math.max(-40, focusX(w) - 300), Math.min(levelW(w) + 40, focusX(w) + 300));

function introduce(w: World, ev: SimEvent[]): boolean {
  const e = Object.values(w.enemies).find(e => e.hp > 0 && combatReady(w, e) && !w.introduced.includes(e.boss ?? e.kind));
  if (!w.enc.lock || !e) return false;
  const kind = e.boss ?? e.kind;
  w.introduced.push(kind); w.cine = { id: e.id, kind, ms: CINE_MS };
  ev.push({ t: 'cine', id: e.id, kind });
  return true;
}
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
  startMove(p, 'fall');
}

function heroReset(p: Player) {
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
    if (ids.length) w.pending.push({ ms: DASH_DELAY_MS, kind: 'hits', owner: p.id, strike: STRIKES.nadya['b3-end'], ids });
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
      continue;
    }
    e.charmMs = CHARM_MS; e.charmBy = d.owner;
    ev.push({ t: 'charm', target: e.id, x: e.x, y: e.y });
  }
  return x1 > 0 && x1 < levelW(w);
}

// Отложенные удары: считаются каждый тик, срабатывают, когда время вышло
function stepPending(w: World, dtMs: number, ev: SimEvent[]) {
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

// Враг ударил игрока. false, если удар пропал (неуязвимость)
function damagePlayer(p: Player, dmg: number): boolean {
  if (p.invulnMs > 0) return false;
  p.hp = Math.max(0, p.hp - dmg);
  if (isHero(p) && p.hp > 0) {
    // Ultimate: иммунитет к контролю, урон проходит, но героиню не сбивает с действия
    if (p.form === 'ultimate') { p.invulnMs = IMMUNE_INVULN_MS; return true; }
    p.combo = 0; p.queued = null;
    if (p.move === 'hurricane' && moveBusy(p)) p.invulnMs = 300; // вихрь не прерывается
    else { startMove(p, 'hurt'); p.invulnMs = HURT_INVULN_MS; }
  }
  return true;
}

function stepHero(w: World, p: Player, inp: Input, dtMs: number, ev: SimEvent[]) {
  const dt = dtMs / 1000;
  p.invulnMs = Math.max(0, p.invulnMs - dtMs);
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
        e.frozenMs = FREEZE_MS / (e.boss ? 2 : 1);
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
    p.bComboMs -= dtMs; if (p.bComboMs <= 0) p.bCombo = 0;
  }
  const comboWindow = COMBO_MS_BY[p.form] ?? COMBO_MS;

  const mx = clamp(inp.mx, -1, 1), my = clamp(inp.my, -1, 1);
  if (canAct) {
    const want = p.queued ?? (inp.heavy ? 'heavy' : inp.attack ? 'attack' : null);
    const turn = () => { if (mx !== 0) p.facing = mx > 0 ? 1 : -1; };
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
      const step = p.bCombo % 3;
      startMove(p, HEAVY.nadya[step]);
      p.bCombo = step === 2 ? 0 : step + 1;
      p.bComboMs = comboWindow;
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
      const moving = mx !== 0 || my !== 0;
      const run = moving && inp.run;
      const speed = PLAYER_SPEED * SPEED_MULT[p.form] * (run ? RUN_MULT : 1);
      p.x = clamp(p.x + mx * speed * dt, ...walkBounds(w));
      p.y = clamp(p.y + my * speed * 0.7 * dt, laneTop(w, p.x), laneBottom(w));
      if (mx !== 0) p.facing = mx > 0 ? 1 : -1;
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
  if (p) for (const o of Object.values(w.enemies)) {
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
    enc.lock = [...next.arena]; enc.bossIndex = 0; enc.bossStarted = false; enc.wave = 0; enc.queue = [...(next.waves[0] ?? [])];
    ev.push({ t: 'lock', x0: enc.lock[0], x1: enc.lock[1] });
  }
  if (!enc.lock || !next) return;
  const alive = () => Object.values(w.enemies).filter(e => e.hp > 0).length;
  if (!enc.queue.length && alive() <= 2 && enc.wave + 1 < next.waves.length) {
    enc.queue = [...next.waves[++enc.wave]];
  }
  const cap = MAX_ALIVE;
  while (enc.queue.length && alive() < cap) {
    const spawn = enc.queue.shift()!, info = KIND[spawn.kind], stats = ROLE[info.role];
    const door = spawn.door !== undefined && spawn.door >= enc.lock[0] && spawn.door <= enc.lock[1] ? spawn.door : undefined;
    const id = 'e' + w.nextEnemyId++, x = door ?? enc.lock[1] + ENTER_OFF;
    const hp = Math.round(stats.hp * (info.hpMult ?? 1));
    w.enemies[id] = { id, bornTick: w.tick, kind: spawn.kind, phase: 'none', phaseMs: 0, x,
      y: door !== undefined ? laneTop(w, x) + 2 : laneTop(w, x) + rand(w) * (laneBottom(w) - laneTop(w, x)),
      enterMs: door !== undefined ? 500 : undefined,
      hp, maxHp: hp, facing: -1, anim: door !== undefined ? 'enter' : 'run', animMs: 0, cdMs: 0 };
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
          x: boss === 'shaman' ? 1240 : enc.lock[1] + ENTER_OFF, y: boss === 'shaman' ? 205 : laneBottom(w) - 20, facing: -1,
          enterMs: boss === 'shaman' ? 900 : undefined,
          phase: 'none', phaseMs: 0, anim: 'run', animMs: 0, cdMs: 0 };
        if (boss === 'shaman') { w.enemies[id].phase = 'enter'; w.enemies[id].anim = 'enter'; }
        else for (let n = 0; n < 2; n++) {
          const oid = 'e' + w.nextEnemyId++, hp = ROLE[KIND.omon.role].hp;
          w.enemies[oid] = { id: oid, kind: 'omon', hp, maxHp: hp, x: enc.lock[1] + ENTER_OFF + 30 + n * 22,
            y: laneBottom(w) - 30 + n * 12, facing: -1, phase: 'none', phaseMs: 0, anim: 'run', animMs: 0, cdMs: 0 };
        }
        enc.bossStarted = true; ev.push({ t: 'boss', id }); return;
      }
    }
    if (alive() > 0) return;
    enc.lock = null; enc.cleared++; enc.index++; ev.push({ t: 'clear' });
    if (w.stage === LEVELS[w.level].stages.length - 1 && enc.cleared === data.length) {
      w.won = true; ev.push({ t: 'victory' });
    }
  }
}

// Сначала освобождаем все разрешения, затем выдаём по времени ожидания.
function prepareTokens(w: World, dtMs: number) {
  const targets = livePlayers(w), enemies = Object.values(w.enemies);
  for (const e of enemies) {
    const disabled = !combatReady(w, e) || e.hp <= 0 || (e.invulnMs ?? 0) > 0 || e.dummy || e.frozenMs || e.stunMs || e.air || e.pin || e.charmMs || !e.boss && (e.anim === 'hurt' || e.anim === 'down') && e.animMs > 0;
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
  const tele = (shape: Extract<SimEvent, { t: 'tele' }>['shape'], x: number, y: number, r?: number, h?: number, delayMs = 0) =>
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
    if (wide && Object.values(w.enemies).some(o => o !== e && o.token)) { e.anim = 'idle'; return; }
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
}

export function step(w: World, inputs: Record<string, Input>, dtMs = TICK_MS): SimEvent[] {
  const ev: SimEvent[] = [];
  let dt = dtMs / 1000;
  const players = Object.values(w.players);
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
  if (introduce(w, ev)) return ev;
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
    if (e.stunMs) e.stunMs = Math.max(0, e.stunMs - dtMs);
    if (e.charmMs) e.charmMs = Math.max(0, e.charmMs - dtMs);
    if (e.frozenMs) {
      e.frozenMs = Math.max(0, e.frozenMs - dtMs);
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

  introduce(w, ev);
  return ev;
}
