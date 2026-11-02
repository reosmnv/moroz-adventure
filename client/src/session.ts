// Две реализации одной сессии: офлайн (sim в браузере) и онлайн (Colyseus).
// Сцена знает только снимки и события, режим ей не важен.
import { Client, type Room } from '@colyseus/sdk';
import {
  encountersOf, TEST_TOOLS, TICK_MS, nextStage, addPlayer, chargeUlt, createWorld, emptyInput, spawnEnemies, step, takenChars,
  type Anim, type Form, type Input, type SimEvent, type World,
} from '@bc/shared';

export interface EntitySnap {
  ultStopMs?: number; carryBy?: string; thrown?: boolean; carried?: boolean; ultLevel?: number; ultWindow?: number; carryAngle?: number; carryHeight?: number; carryDepth?: number;
  x: number; y: number; hp: number; facing: number; anim: Anim; char?: string; ult?: number; connected?: boolean; away?: boolean; maxHp?: number; dummy?: boolean; air?: number; height?: number; frozen?: boolean; storm?: number;
  fDashMs?: number; idleInput?: boolean; hiddenMs?: number; heavySmokeMs?: number; fireMs?: number; burnMs?: number; markedBy?: string;
  form?: Form; move?: string; moveT?: number; formMs?: number; combo?: number; hitCount?: number; bCombo?: number; charge2?: number; invuln?: boolean;
  enterMs?: number; kind?: string; phase?: string; boss?: string; bossPhase?: number; atk?: string;
  slow?: boolean; stun?: boolean; charm?: boolean;
}
export interface Snapshot { pauseMs: number; slowmoMs: number; halt: number; cineId: string; cineKind: string; cineMs: number; shots: { x: number; y: number; dir: number }[]; zones: { x: number; y: number; r: number; ms: number }[]; lockX0: number; lockX1: number; encDone: number; encTotal: number; won: boolean; level: 'route' | 'old'; stage: number; trans: number; t: number; players: Map<string, EntitySnap>; enemies: Map<string, EntitySnap>; wave: number; tick: number }
export type Button = 'skip' | 'attack' | 'heavy' | 'taunt' | 'ult' | 'ult2';

export interface GameSession {
  introOpen: boolean;
  readonly kind: 'local' | 'online';
  needsIntro(): boolean;
  finishIntro(): void;
  me: string;
  roomId: string;
  status: string;
  snapshots: Snapshot[];
  onEvents: (evs: SimEvent[]) => void;
  move(mx: number, my: number, run: boolean): void;
  press(b: Button): void;
  holdSmoke(on: boolean): void;
  view(x: number, width: number): void;
  spawn(): void;
  next(): void;
  charge(): void;
  pick(char: string): void;
  setPaused(on: boolean): void;
  isPaused(): boolean;
  pausedByMe(): boolean;
  taken(): string[];
  hasMe(): boolean;
  ping(): number;
  leave(): void;
}

const BUFFER = 40;
function pushSnap(list: Snapshot[], s: Snapshot) {
  list.push(s);
  if (list.length > BUFFER) list.shift();
}

export class LocalSession implements GameSession {
  introOpen = false;
  readonly kind = 'local' as const;
  me = 'me';
  roomId = '';
  status = 'офлайн';
  snapshots: Snapshot[] = [];
  onEvents: (evs: SimEvent[]) => void = () => {};
  private world: World;
  private input: Input = emptyInput();
  private timer = 0;
  private intro = false;
  needsIntro() { return this.intro; }
  finishIntro() { this.intro = false; this.input = emptyInput(); }
  private paused = false;

  constructor(level: 'route' | 'old' = 'route', stage = 0) {
    this.intro = level === 'route' && stage === 0;
    this.world = createWorld(Date.now() & 0xffff, TEST_TOOLS, level, stage);
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
  }

  private tick() {
    if (document.hidden || this.paused) return; // офлайн-пауза в фоне и по кнопке
    const evs = this.intro ? [] : step(this.world, { [this.me]: this.input });
    this.input.attack = this.input.heavy = this.input.taunt = this.input.ult = this.input.skip = false;
    if (this.world.players[this.me]?.char !== 'ramil') this.input.ult2 = false;
    const players = new Map<string, EntitySnap>();
    for (const p of Object.values(this.world.players)) players.set(p.id, { ...p, storm: p.stormMs, invuln: p.invulnMs > 0 });
    const enemies = new Map<string, EntitySnap>();
    for (const e of Object.values(this.world.enemies)) enemies.set(e.id, { ...e, carryBy: e.held?.by ?? e.thrown?.by ?? '', thrown: !!e.thrown, carried: !!(e.held || e.thrown), kind: e.boss ?? e.kind, frozen: (e.frozenMs ?? 0) > 0, slow: (e.slowMs ?? 0) > 0, stun: (e.stunMs ?? 0) > 0, charm: (e.charmMs ?? 0) > 0 });
    pushSnap(this.snapshots, { pauseMs: this.world.pauseMs ?? 0, slowmoMs: this.world.slowmoMs ?? 0, halt: this.world.halt, cineId: this.world.cine?.id ?? '', cineKind: this.world.cine?.kind ?? '', cineMs: this.world.cine?.ms ?? 0, shots: this.world.shots.map(s => ({ ...s })), zones: this.world.zones.map(z => ({ ...z })), t: performance.now(), players, enemies, lockX0: this.world.enc.lock?.[0] ?? -1, lockX1: this.world.enc.lock?.[1] ?? -1, encDone: this.world.enc.cleared, encTotal: encountersOf(this.world).length, won: this.world.won, level: this.world.level, stage: this.world.stage, trans: this.world.trans?.ms ?? 0, wave: this.world.wave, tick: this.world.tick });
    if (evs.length) this.onEvents(evs);
  }

  move(mx: number, my: number, run: boolean) { this.input.mx = mx; this.input.my = my; this.input.run = run; }
  press(b: Button) { this.input[b] = true; }
  view(x: number, width: number) { this.input.viewX = x; this.input.viewW = width; }
  holdSmoke(on: boolean) { this.input.ult2 = on; }
  next() { if (TEST_TOOLS) nextStage(this.world); }
  spawn() { if (TEST_TOOLS) spawnEnemies(this.world, 3); }
  charge() { if (TEST_TOOLS) chargeUlt(this.world, this.me); }
  pick(char: string) { addPlayer(this.world, this.me, char); }
  setPaused(on: boolean) { this.paused = on; }
  isPaused() { return this.paused; }
  pausedByMe() { return true; }
  taken() { return takenChars(this.world); }
  hasMe() { return !!this.world.players[this.me]; }
  ping() { return 0; }
  leave() { clearInterval(this.timer); }
}

const TOKEN_KEY = 'bc-reconnect';

export class OnlineSession implements GameSession {
  introOpen = false;
  readonly kind = 'online' as const;
  me = '';
  roomId = '';
  status = 'подключение…';
  snapshots: Snapshot[] = [];
  onEvents: (evs: SimEvent[]) => void = () => {};
  onPickError: (msg: string) => void = () => {};
  private room!: Room;
  private client: Client;
  private lastPing = 0;
  private pingTimer = 0;
  private reconnecting = false;
  private paused = false;
  private pausedBy = '';
  private intro = false;
  needsIntro() { return this.intro; }
  finishIntro() { this.safeSend('introDone', true); }

  private safeSend(type: string, payload: unknown) {
    if (this.room?.connection?.isOpen) this.room.send(type, payload);
  }

  private constructor(url: string) {
    this.client = new Client(url);
  }

  // Вход: по сохранённому токену (вернулись после фона/перезагрузки), иначе по коду или новая комната
  static async open(url: string, roomCode?: string, level: 'route' | 'old' = 'route', stage = 0): Promise<OnlineSession> {
    const s = new OnlineSession(url);
    const saved = JSON.parse(sessionStorage.getItem(TOKEN_KEY) ?? 'null');
    let room: Room | null = null;
    if (saved && (!roomCode || saved.roomId === roomCode)) {
      try { room = await s.client.reconnect(saved.token); } catch { sessionStorage.removeItem(TOKEN_KEY); }
    }
    if (!room) room = roomCode ? await s.client.joinById(roomCode) : await s.client.create('game', { level, stage });
    s.bind(room);
    s.pingTimer = window.setInterval(() => s.room.ping(ms => { s.lastPing = ms; }), 2000);
    // Свернул Safari: сообщаем серверу, персонаж замирает; вернулся: переподключаемся при нужде
    document.addEventListener('visibilitychange', async () => {
      if (document.hidden) { s.safeSend('away', true); return; }
      await s.ensureConnected();
      s.safeSend('away', false);
    });
    return s;
  }

  private bind(room: Room) {
    this.room = room;
    this.me = room.sessionId;
    this.roomId = room.roomId;
    this.status = 'онлайн';
    sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ roomId: room.roomId, token: room.reconnectionToken }));
    room.onStateChange((state: any) => {
      this.intro = state.intro;
      const players = new Map<string, EntitySnap>();
      state.players.forEach((p: any, id: string) => players.set(id, { ultLevel: p.ultLevel, ultWindow: p.ultWindow, x: p.x, y: p.y, hp: p.hp, facing: p.facing, anim: p.anim, char: p.char, ult: p.ult, fDashMs: p.fDashMs, idleInput: p.idleInput, hiddenMs: p.hiddenMs, heavySmokeMs: p.heavySmokeMs, fireMs: p.fireMs, form: p.form, move: p.move, moveT: p.moveT, formMs: p.formMs, combo: p.combo, bCombo: p.bCombo, hitCount: p.hitCount, charge2: p.charge2, storm: p.storm, invuln: p.invuln, connected: p.connected, away: p.away }));
      const enemies = new Map<string, EntitySnap>();
      state.enemies.forEach((e: any, id: string) => enemies.set(id, { ultStopMs: e.ultStopMs, carryBy: e.carryBy, thrown: e.thrown, carried: e.carried, carryAngle: e.carryAngle, carryHeight: e.carryHeight, carryDepth: e.carryDepth, burnMs: e.burnMs, markedBy: e.markedBy, enterMs: e.enterMs, boss: e.boss, bossPhase: e.bossPhase, atk: e.atk, kind: e.kind, phase: e.phase, x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHp, dummy: e.dummy, air: e.air, height: e.height, frozen: e.frozen, slow: e.slow, stun: e.stun, charm: e.charm, facing: e.facing, anim: e.anim }));
      pushSnap(this.snapshots, { pauseMs: state.pauseMs, slowmoMs: state.slowmoMs, halt: state.halt, cineId: state.cineId, cineKind: state.cineKind, cineMs: state.cineMs, shots: Array.from(state.shots, (s: any) => ({ x: s.x, y: s.y, dir: s.dir })), zones: Array.from(state.zones, (z: any) => ({ x: z.x, y: z.y, r: z.r, ms: z.ms })), t: performance.now(), players, enemies, lockX0: state.lockX0, lockX1: state.lockX1, encDone: state.encDone, encTotal: state.encTotal, won: state.won, level: state.level, stage: state.stage, trans: state.trans, wave: state.wave, tick: state.tick });
      this.paused = state.paused;
      this.pausedBy = state.pausedBy;
      sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ roomId: room.roomId, token: room.reconnectionToken }));
    });
    room.onMessage('ev', (evs: SimEvent[]) => this.onEvents(evs));
    room.onMessage('pickError', (m: string) => this.onPickError(m));
    room.onDrop(() => { this.status = 'связь потеряна, переподключаюсь…'; });
    room.onReconnect(() => { this.status = 'онлайн'; });
    room.onLeave((code: number) => {
      if (code === 4000) { this.status = 'вышел'; return; }
      this.status = 'отключён, жду возврата в игру…';
      if (!document.hidden) this.ensureConnected();
    });
  }

  // Ручное переподключение: iOS убивает сокет и страницу в фоне, авто-реконнект SDK это не покрывает
  private async ensureConnected() {
    if (this.reconnecting || this.room?.connection?.isOpen) return;
    const saved = JSON.parse(sessionStorage.getItem(TOKEN_KEY) ?? 'null');
    if (!saved) return;
    this.reconnecting = true;
    this.status = 'переподключаюсь…';
    try {
      this.bind(await this.client.reconnect(saved.token));
    } catch (e: any) {
      this.status = 'не удалось вернуться: ' + (e?.message ?? e);
    } finally {
      this.reconnecting = false;
    }
  }

  private lastMove = '';
  move(mx: number, my: number, run: boolean) {
    const key = mx.toFixed(1) + ',' + my.toFixed(1) + (run ? 'r' : '');
    if (key === this.lastMove) return;
    this.lastMove = key;
    this.room.send('move', { mx, my, run });
  }
  press(b: Button) { this.room.send('btn', b); }
  private lastView = '';
  view(x: number, width: number) {
    const key = Math.round(x) + ':' + width;
    if (key !== this.lastView) { this.lastView = key; this.safeSend('view', { x: Math.round(x), width }); }
  }
  holdSmoke(on: boolean) { this.safeSend('smoke', on); }
  next() { this.safeSend('next', true); }
  spawn() { this.safeSend('spawn', true); }
  charge() { this.safeSend('charge', true); }
  pick(char: string) { this.room.send('pick', char); }
  setPaused(on: boolean) { this.safeSend('pause', on); }
  isPaused() { return this.paused; }
  pausedByMe() { return this.pausedBy === this.me; }
  taken() {
    const last = this.snapshots[this.snapshots.length - 1];
    return last ? [...last.players.values()].map(p => p.char!).filter(Boolean) : [];
  }
  hasMe() {
    const last = this.snapshots[this.snapshots.length - 1];
    return !!last?.players.has(this.me);
  }
  ping() { return this.lastPing; }
  leave() {
    clearInterval(this.pingTimer);
    sessionStorage.removeItem(TOKEN_KEY);
    this.room.leave(true);
  }
}
