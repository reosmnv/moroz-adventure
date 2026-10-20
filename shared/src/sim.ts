// Общая симуляция боя: одна и та же для сервера (онлайн) и браузера (офлайн).
// Чистые данные и функции, без Phaser и Colyseus.

export const TICK_MS = 50;
export const VIEW_W = 480;
export const VIEW_H = 270;
export const LANE_TOP = 150;
export const LANE_BOTTOM = 255;

const PLAYER_SPEED = 90; // единиц в секунду
const ENEMY_SPEED = 45;
const PLAYER_HP = 100;
const REVIVE_MS = 5000;
const TAUNT_CD_MS = 3000;
const LANE_TOLERANCE = 14;

export type Anim = 'idle' | 'walk' | 'attack' | 'heavy' | 'hurt' | 'down' | 'taunt' | 'ult';

export interface Character {
  id: string;
  name: string;
  color: number;
  taunts: string[];
}

// Заглушки до появления настоящих персонажей
export const CHARACTERS: Character[] = [
  { id: 'a', name: 'Аня', color: 0xe0457b, taunts: ['И это всё?', 'Моя бабушка бьёт сильнее'] },
  { id: 'b', name: 'Боря', color: 0x3f8efc, taunts: ['Скучно', 'Ты точно враг?'] },
  { id: 'c', name: 'Вика', color: 0x2fbf71, taunts: ['Пф', 'Ещё разок?'] },
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
}

export interface World {
  tick: number;
  seed: number;
  wave: number;
  nextEnemyId: number;
  players: Record<string, Player>;
  enemies: Record<string, Enemy>;
}

export interface Input {
  mx: number; // -1..1
  my: number; // -1..1
  attack: boolean;
  heavy: boolean;
  taunt: boolean;
  ult: boolean;
}

export const emptyInput = (): Input => ({ mx: 0, my: 0, attack: false, heavy: false, taunt: false, ult: false });

export type SimEvent =
  | { t: 'hit'; target: string; dmg: number; x: number; y: number }
  | { t: 'taunt'; id: string; line: string }
  | { t: 'ult'; id: string }
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

export function createWorld(seed = 1): World {
  return { tick: 0, seed, wave: 0, nextEnemyId: 1, players: {}, enemies: {} };
}

export function takenChars(w: World): string[] {
  return Object.values(w.players).map(p => p.char);
}

export function addPlayer(w: World, id: string, char: string): Player {
  // Новичок появляется рядом с живым игроком, а не в начале уровня
  const buddy = Object.values(w.players).find(p => p.connected && p.hp > 0);
  const p: Player = {
    id, char,
    x: buddy ? clamp(buddy.x - 30, 20, VIEW_W - 20) : 80,
    y: buddy ? clamp(buddy.y + 20, LANE_TOP, LANE_BOTTOM) : 200,
    hp: PLAYER_HP, facing: 1, anim: 'idle', animMs: 0, cdMs: 0, tauntCdMs: 0, ult: 0, downMs: 0,
    connected: true, away: false,
  };
  w.players[id] = p;
  return p;
}

export function removePlayer(w: World, id: string) {
  delete w.players[id];
}

function spawnWave(w: World, ev: SimEvent[]) {
  w.wave++;
  const count = 2 + w.wave;
  for (let i = 0; i < count; i++) {
    const id = 'e' + w.nextEnemyId++;
    const fromRight = rand(w) < 0.7;
    const hp = 40;
    w.enemies[id] = {
      id,
      x: fromRight ? VIEW_W + 20 + i * 25 : -20 - i * 25,
      y: LANE_TOP + rand(w) * (LANE_BOTTOM - LANE_TOP),
      hp, maxHp: hp, facing: fromRight ? -1 : 1, anim: 'walk', animMs: 0, cdMs: 800 + rand(w) * 800,
    };
  }
  ev.push({ t: 'wave', n: w.wave });
}

function hitEnemies(w: World, p: Player, range: number, dmg: number, ev: SimEvent[], allAround = false) {
  for (const e of Object.values(w.enemies)) {
    const dx = e.x - p.x;
    const inFront = allAround || Math.sign(dx) === p.facing || Math.abs(dx) < 6;
    if (inFront && Math.abs(dx) < range && Math.abs(e.y - p.y) < (allAround ? 60 : LANE_TOLERANCE)) {
      e.hp -= dmg;
      e.anim = 'hurt';
      e.animMs = 250;
      e.x += Math.sign(dx || p.facing) * (allAround ? 30 : 8);
      p.ult = Math.min(100, p.ult + dmg);
      ev.push({ t: 'hit', target: e.id, dmg, x: e.x, y: e.y });
    }
  }
}

export function step(w: World, inputs: Record<string, Input>, dtMs = TICK_MS): SimEvent[] {
  const ev: SimEvent[] = [];
  const dt = dtMs / 1000;
  const players = Object.values(w.players);
  const active = players.filter(p => p.connected && !p.away);

  // Никого нет за экраном: мир стоит, пока хост шлёт ссылку в мессенджер
  if (active.length === 0) return ev;
  w.tick++;

  if (Object.keys(w.enemies).length === 0) spawnWave(w, ev);

  for (const p of active) {
    const inp = inputs[p.id] ?? emptyInput();
    p.cdMs = Math.max(0, p.cdMs - dtMs);
    p.tauntCdMs = Math.max(0, p.tauntCdMs - dtMs);
    p.animMs = Math.max(0, p.animMs - dtMs);

    if (p.hp <= 0) {
      p.anim = 'down';
      p.downMs -= dtMs;
      const buddyAlive = active.some(o => o !== p && o.hp > 0);
      if (buddyAlive && p.downMs <= 0) { p.hp = PLAYER_HP / 2; p.anim = 'idle'; }
      continue;
    }

    const busy = p.animMs > 0 && (p.anim === 'attack' || p.anim === 'heavy' || p.anim === 'ult' || p.anim === 'hurt');
    if (!busy) {
      const mx = clamp(inp.mx, -1, 1), my = clamp(inp.my, -1, 1);
      p.x = clamp(p.x + mx * PLAYER_SPEED * dt, 10, VIEW_W - 10);
      p.y = clamp(p.y + my * PLAYER_SPEED * 0.7 * dt, LANE_TOP, LANE_BOTTOM);
      if (mx !== 0) p.facing = mx > 0 ? 1 : -1;
      if (p.animMs === 0) p.anim = mx !== 0 || my !== 0 ? 'walk' : 'idle';

      if (inp.ult && p.ult >= 100) {
        p.ult = 0; p.anim = 'ult'; p.animMs = 600;
        hitEnemies(w, p, 140, 35, ev, true);
        ev.push({ t: 'ult', id: p.id });
      } else if (inp.heavy && p.cdMs === 0) {
        p.anim = 'heavy'; p.animMs = 450; p.cdMs = 700;
        hitEnemies(w, p, 38, 18, ev);
      } else if (inp.attack && p.cdMs === 0) {
        p.anim = 'attack'; p.animMs = 200; p.cdMs = 250;
        hitEnemies(w, p, 30, 8, ev);
      } else if (inp.taunt && p.tauntCdMs === 0) {
        const ch = CHARACTERS.find(c => c.id === p.char);
        const lines = ch?.taunts ?? ['...'];
        p.anim = 'taunt'; p.animMs = 600; p.tauntCdMs = TAUNT_CD_MS;
        ev.push({ t: 'taunt', id: p.id, line: lines[Math.floor(rand(w) * lines.length)] });
      }
    }
  }

  // Враги: к ближайшему живому игроку на его дорожку, удар, пауза
  const targets = active.filter(p => p.hp > 0);
  for (const e of Object.values(w.enemies)) {
    e.animMs = Math.max(0, e.animMs - dtMs);
    e.cdMs = Math.max(0, e.cdMs - dtMs);
    if (e.hp <= 0) { delete w.enemies[e.id]; continue; }
    if (e.anim === 'hurt' && e.animMs > 0) continue;
    if (targets.length === 0) { e.anim = 'idle'; continue; }
    const t = targets.reduce((a, b) => (Math.abs(a.x - e.x) + Math.abs(a.y - e.y) < Math.abs(b.x - e.x) + Math.abs(b.y - e.y) ? a : b));
    const side = e.x < t.x ? -1 : 1;
    const gx = t.x + side * 24, gy = t.y;
    const dx = gx - e.x, dy = gy - e.y;
    e.facing = t.x > e.x ? 1 : -1;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 3) {
      const len = Math.hypot(dx, dy);
      e.x += (dx / len) * ENEMY_SPEED * dt;
      e.y += (dy / len) * ENEMY_SPEED * dt;
      if (e.animMs === 0) e.anim = 'walk';
    } else if (e.cdMs === 0) {
      e.anim = 'attack'; e.animMs = 300; e.cdMs = 1400;
      t.hp = Math.max(0, t.hp - 7);
      ev.push({ t: 'hit', target: t.id, dmg: 7, x: t.x, y: t.y });
      if (t.hp === 0) { t.downMs = REVIVE_MS; t.anim = 'down'; ev.push({ t: 'down', id: t.id }); }
    } else if (e.animMs === 0) {
      e.anim = 'idle';
    }
  }

  // Все на связи лежат: перезапуск уровня
  if (active.every(p => p.hp <= 0)) {
    w.enemies = {};
    w.wave = 0;
    for (const p of players) { p.hp = PLAYER_HP; p.anim = 'idle'; p.animMs = 0; p.ult = 0; p.x = 80; }
    ev.push({ t: 'restart' });
  }

  return ev;
}
