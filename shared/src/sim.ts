// Общая симуляция боя: одна и та же для сервера (онлайн) и браузера (офлайн).
// Чистые данные и функции, без Phaser и Colyseus.
import type { Form } from './anims-data.ts';
import {
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
const ENEMY_SPEED = 45;
const ENEMY_DMG = 7;
export const PLAYER_HP = 150;
const REVIVE_MS = 5000;
const TAUNT_CD_MS = 3000;
const LANE_TOLERANCE = 24;

export type Anim = 'idle' | 'walk' | 'attack' | 'heavy' | 'hurt' | 'down' | 'taunt' | 'ult';

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
  bCombo: number; // Надя: сколько ударов серии B уже нанесено (0..2)
  bComboMs: number;
  charge2: number; // Kris: шкала шара 0..100, копится от попаданий вспышкой
  dashFrom: number; // Надя: откуда начался рывок самурая
  charmSaid: boolean; // Надя: реплика ревности уже прозвучала за эту ульту
  wantBall: boolean; // Kris: шар нажат, пока была занята; полетит, как только сможет
}

export interface Enemy {
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
  air?: number; // мс до приземления после подброса апперкотом (для отрисовки)
  dummy?: boolean; // манекен: стоит, не бьёт, не умирает
  slowMs?: number; slow?: number; // замедлен: сколько ещё и какую долю скорости теряет
  stunMs?: number; // оглушён: стоит и не бьёт
  charmMs?: number; charmBy?: string; // ревность: бьёт других врагов, а не героев
  homeX?: number;
  homeY?: number;
}

export interface World {
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

export function createWorld(seed = 1, testTools = false): World {
  return { tick: 0, seed, wave: 0, nextEnemyId: 1, players: {}, enemies: {}, testTools, pending: [] };
}

export function takenChars(w: World): string[] {
  return Object.values(w.players).map(p => p.char);
}

export function addPlayer(w: World, id: string, char: string): Player {
  // Новичок появляется рядом с живым игроком, а не в начале уровня
  const buddy = Object.values(w.players).find(p => p.connected && p.hp > 0);
  const p: Player = {
    id, char,
    x: buddy ? clamp(buddy.x - 30, 20, LEVEL_W - 20) : 80,
    y: buddy ? clamp(buddy.y + 20, LANE_TOP, LANE_BOTTOM) : 200,
    hp: PLAYER_HP, facing: 1, anim: 'idle', animMs: 0, cdMs: 0, tauntCdMs: 0, ult: 0, downMs: 0,
    connected: true, away: false,
    form: HERO_FORM[char] ?? 'prime', move: 'idle', moveT: 0, combo: 0, comboMs: 0, queued: null, formMs: 0, invulnMs: 0, hitstopMs: 0, stormMs: 0, stormTickMs: 0,
    bCombo: 0, bComboMs: 0, charge2: 0, dashFrom: 0, charmSaid: false, wantBall: false,
  };
  w.players[id] = p;
  return p;
}

export function removePlayer(w: World, id: string) {
  delete w.players[id];
}

function ensureDummy(w: World) {
  if (Object.values(w.enemies).some(e => e.dummy)) return;
  const id = 'e' + w.nextEnemyId++;
  w.enemies[id] = { id, x: 330, y: 205, hp: 200, maxHp: 200, facing: -1, anim: 'idle', animMs: 0, cdMs: 0, dummy: true, homeX: 330, homeY: 205 };
}

export function chargeUlt(w: World, id: string) {
  const p = w.players[id];
  if (p) { p.ult = 100; p.charge2 = 100; } // тестовая кнопка: и ульта, и шар Kris
}

export function spawnEnemies(w: World, count: number) {
  const cx = focusX(w);
  for (let i = 0; i < count; i++) {
    const id = 'e' + w.nextEnemyId++;
    const fromRight = rand(w) < 0.7;
    const hp = 40;
    w.enemies[id] = {
      id,
      x: fromRight ? Math.min(cx + 280, LEVEL_W + 20) + i * 25 : Math.max(cx - 280, -20) - i * 25,
      y: LANE_TOP + rand(w) * (LANE_BOTTOM - LANE_TOP),
      hp, maxHp: hp, facing: fromRight ? -1 : 1, anim: 'walk', animMs: 0, cdMs: 800 + rand(w) * 800,
    };
  }
}

function spawnWave(w: World, ev: SimEvent[]) {
  w.wave++;
  spawnEnemies(w, 2 + w.wave);
  ev.push({ t: 'wave', n: w.wave });
}

type HitOpts = {
  kb?: number; stun?: number; down?: boolean; launch?: boolean; everyone?: boolean; silent?: boolean;
  slowMs?: number; slow?: number; stunMs?: number; single?: boolean; word?: string; noCharge?: boolean; flash?: boolean;
};

// Одно попадание по врагу: урон, отлёт, контроль, шкалы героя, событие
function applyHit(w: World, p: Player, e: Enemy, dmg: number, dir: number, ev: SimEvent[], opts: HitOpts, allAround = false) {
  e.hp -= dmg;
  if (!e.frozenMs) { // замороженного не сдвинуть, он только получает урон
    e.anim = opts.down ? 'down' : 'hurt';
    e.animMs = opts.down ? 900 : (opts.stun ?? 250);
    if (opts.launch) e.air = AIR_MS;
    e.x = clamp(e.x + dir * (opts.kb ?? (allAround ? 30 : 8)), Math.max(-40, focusX(w) - 300), Math.min(LEVEL_W + 40, focusX(w) + 300));
  }
  if (opts.slowMs) { e.slowMs = opts.slowMs; e.slow = opts.slow ?? 0.5; }
  if (opts.stunMs) { e.stunMs = opts.stunMs; e.anim = 'hurt'; e.animMs = Math.max(e.animMs, opts.stunMs); }
  if (opts.silent) return;
  if (!opts.noCharge && p.form !== 'ultimate') { // в Ultimate шкала не копится
    const control = p.form === 'nadya' && (opts.slowMs || opts.stunMs) ? CONTROL_ULT : 0;
    p.ult = Math.min(100, p.ult + dmg + control);
  }
  if (opts.flash) p.charge2 = Math.min(100, p.charge2 + BALL_PER_HIT);
  ev.push({ t: 'hit', target: e.id, dmg, x: e.x, y: e.y, word: opts.word, by: p.id });
}

function hitEnemies(w: World, p: Player, range: number, dmg: number, ev: SimEvent[], allAround = false, opts: HitOpts = {}): number {
  let list = Object.values(w.enemies).filter(e => {
    const dx = e.x - p.x;
    const inFront = allAround || Math.sign(dx) === p.facing || Math.abs(dx) < 6;
    return opts.everyone || (inFront && Math.abs(dx) < range && Math.abs(e.y - p.y) < (allAround ? 60 : LANE_TOLERANCE));
  });
  if (opts.single && list.length > 1) list = [list.reduce((a, b) => (Math.abs(a.x - p.x) < Math.abs(b.x - p.x) ? a : b))];
  for (const e of list) applyHit(w, p, e, dmg, Math.sign(e.x - p.x || p.facing), ev, opts, allAround);
  return list.length;
}

const strikeOpts = (p: Player, s: Strike): HitOpts => ({ ...s, kb: s.kb * KNOCK_MULT[p.form], stun: s.stun });


const isHero = (p: Player) => isSpriteHero(p.char);

function startMove(p: Player, move: string) {
  p.move = move;
  p.moveT = -1; // -1: первый тик попадёт в кадр 0
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
  p.form = HERO_FORM[p.char] ?? 'prime'; p.formMs = 0; p.combo = 0; p.comboMs = 0; p.bCombo = 0; p.bComboMs = 0; p.queued = null; p.invulnMs = 0; p.stormMs = 0; p.wantBall = false;
  startMove(p, 'idle');
}

// Особые действия в кадре удара: вспышка и шар Kris, сердце Нади
function special(w: World, p: Player, s: Strike, ev: SimEvent[]) {
  if (s.kind === 'flash') {
    // Летит до первого врага на дорожке перед Kris, урон, когда долетела
    const sx = p.x + p.facing * 20, sy = p.y - 70;
    const front = Object.values(w.enemies).filter(e => Math.sign(e.x - p.x) === p.facing && Math.abs(e.x - p.x) < s.range && Math.abs(e.y - p.y) < LANE_TOLERANCE);
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
    ev.push({ t: 'kiss', id: p.id, x, y: p.y, tx: p.facing > 0 ? LEVEL_W : 0 });
    w.pending.push({ ms: 0, kind: 'kiss', owner: p.id, strike: s, x, y: p.y, dir: p.facing, ids: [] });
  }
}

// Куда упадёт шар Kris. Кандидаты: позиции врагов; вес = сколько врагов в круге взрыва вокруг
const inBlast = (e: Enemy, x: number, y: number) => Math.abs(e.x - x) <= BALL_RADIUS && Math.abs(e.y - y) <= BALL_RADIUS * 0.6;
function ballTarget(w: World, p: Player): { x: number; y: number } {
  const foes = Object.values(w.enemies).filter(e => e.hp > 0);
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
    return t ? { x: t.x, y: clamp(t.y, LANE_TOP, LANE_BOTTOM) } : { x: nastya.x + nastya.facing * 40, y: nastya.y };
  }
  // Без Анастасии: самое плотное скопление в пределах броска, иначе перед собой
  const t = best(foes.filter(e => Math.abs(e.x - p.x) <= BALL_THROW), p);
  return t ? { x: t.x, y: clamp(t.y, LANE_TOP, LANE_BOTTOM) } : { x: p.x + p.facing * 80, y: p.y };
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
  const x0 = d.x!, x1 = clamp(x0 + dir * KISS_SPEED * dtMs / 1000, 0, LEVEL_W);
  d.x = x1;
  const lo = Math.min(x0, x1) - KISS_HALF_W, hi = Math.max(x0, x1) + KISS_HALF_W;
  const hit = d.ids!;
  for (const e of Object.values(w.enemies)) {
    if (hit.includes(e.id) || e.x < lo || e.x > hi || Math.abs(e.y - d.y!) > KISS_BAND) continue;
    hit.push(e.id);
    e.charmMs = CHARM_MS; e.charmBy = d.owner;
    ev.push({ t: 'charm', target: e.id, x: e.x, y: e.y });
  }
  return x1 > 0 && x1 < LEVEL_W;
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
        if (Math.hypot(e.x - p.x, e.y - p.y) > STORM_RADIUS) continue;
        e.hp -= STORM_DMG;
        e.frozenMs = FREEZE_MS;
        ev.push({ t: 'hit', target: e.id, dmg: STORM_DMG, x: e.x, y: e.y });
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

  // Попадания в кадрах удара (особые приёмы делают своё: вспышка, шар, сердце)
  const strike: Strike | undefined = STRIKES[p.form][p.move];
  if (strike) {
    for (const tm of hitTimesMs(p.form, p.move, p.facing)) {
      if (!(prevT < tm && p.moveT >= tm)) continue;
      if (strike.kind) { special(w, p, strike, ev); continue; }
      const n = hitEnemies(w, p, strike.range * RANGE_MULT, strike.dmg, ev, !!strike.around, strikeOpts(p, strike));
      if (n > 0) {
        p.hitstopMs = strike.down ? HITSTOP_HEAVY_MS : HITSTOP_MS;
        // Ultimate: сколько нанесла, столько и вылечила
        if (p.form === 'ultimate') {
          const heal = Math.min(PLAYER_HP - p.hp, n * strike.dmg);
          if (heal > 0) { p.hp += heal; ev.push({ t: 'heal', id: p.id, amount: heal }); }
        }
      }
    }
  }

  // Рывок самурая: Надя пролетает DASH_DIST за время анимации рывка
  if (p.move === 'b3-dash') {
    const k = Math.min(1, Math.max(0, p.moveT) / Math.max(1, moveDurMs(p.form, p.move, p.facing)));
    p.x = clamp(p.dashFrom + p.facing * DASH_DIST * k, 10, LEVEL_W - 10);
  }

  // Смена формы по окончании превращений
  let busy = moveBusy(p);
  if (!busy && p.move === 'transform-up') { p.form = 'ultimate'; p.formMs = ULT_MS; startMove(p, 'idle'); }
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
      p.ult = 0; p.queued = null; p.combo = 0;
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
    } else if (want === 'heavy') {
      p.queued = null; turn();
      startMove(p, HEAVY[p.form][Math.min(p.combo, 2)]);
      p.combo = 0; p.comboMs = 0;
    } else if (want === 'attack') {
      p.queued = null; turn();
      const len = CHAIN[p.form].length; // у Kris серия из двух
      const step = p.combo % len;
      startMove(p, CHAIN[p.form][step]);
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
      p.x = clamp(p.x + mx * speed * dt, 10, LEVEL_W - 10);
      p.y = clamp(p.y + my * speed * 0.7 * dt, LANE_TOP, LANE_BOTTOM);
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

export function step(w: World, inputs: Record<string, Input>, dtMs = TICK_MS): SimEvent[] {
  const ev: SimEvent[] = [];
  const dt = dtMs / 1000;
  const players = Object.values(w.players);
  const active = players.filter(p => p.connected && !p.away);

  // Никого нет за экраном: мир стоит, пока хост шлёт ссылку в мессенджер
  if (active.length === 0) return ev;
  w.tick++;

  if (w.testTools) ensureDummy(w);
  else if (Object.keys(w.enemies).length === 0) spawnWave(w, ev);

  for (const p of active) {
    const inp = inputs[p.id] ?? emptyInput();
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
      p.x = clamp(p.x + mx * PLAYER_SPEED * dt, 10, LEVEL_W - 10);
      p.y = clamp(p.y + my * PLAYER_SPEED * 0.7 * dt, LANE_TOP, LANE_BOTTOM);
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

  // Враги: к ближайшему живому игроку на его дорожку, удар, пауза
  const targets = active.filter(p => p.hp > 0);
  for (const e of Object.values(w.enemies)) {
    e.animMs = Math.max(0, e.animMs - dtMs);
    e.cdMs = Math.max(0, e.cdMs - dtMs);
    if (e.air) e.air = Math.max(0, e.air - dtMs);
    if (e.slowMs) e.slowMs = Math.max(0, e.slowMs - dtMs);
    if (e.stunMs) e.stunMs = Math.max(0, e.stunMs - dtMs);
    if (e.charmMs) e.charmMs = Math.max(0, e.charmMs - dtMs);
    if (e.frozenMs) {
      e.frozenMs = Math.max(0, e.frozenMs - dtMs);
      if (e.hp <= 0) { if (e.dummy) e.hp = e.maxHp; else { delete w.enemies[e.id]; continue; } }
      e.anim = 'idle'; e.animMs = 0;
      continue; // замёрзший стоит и не бьёт
    }
    if (e.dummy) {
      if (e.hp <= 0) e.hp = e.maxHp;
      if ((e.anim === 'hurt' || e.anim === 'down') && e.animMs > 0) continue;
      e.anim = 'idle';
      e.hp = Math.min(e.maxHp, e.hp + 40 * dt);
      const hx = (e.homeX ?? e.x) - e.x, hy = (e.homeY ?? e.y) - e.y, hl = Math.hypot(hx, hy);
      if (hl > 3) { e.x += (hx / hl) * 60 * dt; e.y += (hy / hl) * 60 * dt; }
      continue;
    }
    if (e.hp <= 0) { delete w.enemies[e.id]; continue; }
    if ((e.anim === 'hurt' || e.anim === 'down') && e.animMs > 0) continue;
    if (e.stunMs) { e.anim = 'idle'; continue; } // оглушён: стоит
    const speed = ENEMY_SPEED * (e.slowMs ? 1 - (e.slow ?? 0) : 1);
    // Ревность: бьёт ближайшего другого врага; если некого, стоит и любуется Надей
    if (e.charmMs) {
      const rivals = Object.values(w.enemies).filter(o => o !== e && o.hp > 0);
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
        r.hp -= dmg;
        if (!r.frozenMs) { r.anim = 'hurt'; r.animMs = 250; }
        ev.push({ t: 'hit', target: r.id, dmg, x: r.x, y: r.y });
        const nadya = e.charmBy ? w.players[e.charmBy] : undefined;
        if (nadya && !nadya.charmSaid) { nadya.charmSaid = true; ev.push({ t: 'taunt', id: nadya.id, line: CHARM_LINE }); }
      } else if (e.animMs === 0) e.anim = 'idle';
      continue;
    }
    if (targets.length === 0) { e.anim = 'idle'; continue; }
    const t = targets.reduce((a, b) => (Math.abs(a.x - e.x) + Math.abs(a.y - e.y) < Math.abs(b.x - e.x) + Math.abs(b.y - e.y) ? a : b));
    const side = e.x < t.x ? -1 : 1;
    const gx = t.x + side * 34, gy = t.y;
    const dx = gx - e.x, dy = gy - e.y;
    e.facing = t.x > e.x ? 1 : -1;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 3) {
      const len = Math.hypot(dx, dy);
      e.x += (dx / len) * speed * dt;
      e.y += (dy / len) * speed * dt;
      if (e.animMs === 0) e.anim = 'walk';
    } else if (e.cdMs === 0) {
      e.anim = 'attack'; e.animMs = 300; e.cdMs = 1400;
      if (damagePlayer(t, ENEMY_DMG)) {
        ev.push({ t: 'hit', target: t.id, dmg: ENEMY_DMG, x: t.x, y: t.y });
        if (t.hp === 0) { t.downMs = REVIVE_MS; t.anim = 'down'; if (isHero(t)) heroDown(t); ev.push({ t: 'down', id: t.id }); }
      }
    } else if (e.animMs === 0) {
      e.anim = 'idle';
    }
  }

  // Все на связи лежат: перезапуск уровня
  if (active.every(p => p.hp <= 0)) {
    w.enemies = {};
    w.pending = [];
    w.wave = 0;
    for (const p of players) { p.hp = PLAYER_HP; p.anim = 'idle'; p.animMs = 0; p.ult = 0; p.charge2 = 0; p.x = 80; heroReset(p); }
    ev.push({ t: 'restart' });
  }

  return ev;
}
