// Две реализации одной сессии: офлайн (sim в браузере) и онлайн (Colyseus).
// Сцена знает только снимки и события, режим ей не важен.
import { Client, type Room } from '@colyseus/sdk';
import {
  encountersOf, switchHero, testHeal, testGod, testSummon, testKillAll, TEST_TOOLS, TICK_MS, nextStage, addPlayer, chargeUlt, createWorld, emptyInput, spawnEnemies, step, takenChars,
  type Actor, type Anim, type Form, type Input, type SimEvent, type World,
  tickStory, advanceStory, createStoryProgress, startStory, startStoryForWorld, wantedStatus,
} from '@bc/shared';

export interface EntitySnap {
  meteorX?: number; meteorY?: number; meteorMs?: number; ultStopMs?: number; carryBy?: string; thrown?: boolean; carried?: boolean; ultLevel?: number; ultWindow?: number; carryAngle?: number; carryHeight?: number;
  god?: boolean; x: number; y: number; hp: number; facing: number; anim: Anim; char?: string; ult?: number; connected?: boolean; away?: boolean; maxHp?: number; dummy?: boolean; air?: number; height?: number; frozen?: boolean; storm?: number;
  fDashMs?: number; idleInput?: boolean; hiddenMs?: number; heavySmokeMs?: number; fireMs?: number; burnMs?: number; markedBy?: string;
  form?: Form; move?: string; moveT?: number; formMs?: number; combo?: number; hitCount?: number; bCombo?: number; charge2?: number; invuln?: boolean;
  bCooldownMs?: number; bChainActive?: boolean; fireFacing?: number; shooting?: boolean;
  enterMs?: number; kind?: string; phase?: string; boss?: string; bossPhase?: number; atk?: string;
  slow?: boolean; stun?: boolean; charm?: boolean;
}
export interface Snapshot { actors: Map<string, Actor>; storyCamX?: number; recording: boolean; finaleReady: boolean; wantedStars: number; wantedReward: number; storyScene: string; storyIndex: number; storyHost: string; storyTime: number; storyPushes: number[]; pausedBy: string; pauseMs: number; slowmoMs: number; halt: number; cineId: string; cineKind: string; cineMs: number; shots: { x: number; y: number; dir: number }[]; zones: { x: number; y: number; r: number; ms: number }[]; lockX0: number; lockX1: number; encDone: number; encTotal: number; won: boolean; level: 'route' | 'old'; stage: number; trans: number; t: number; players: Map<string, EntitySnap>; enemies: Map<string, EntitySnap>; wave: number; tick: number }
export type Button = 'skip' | 'attack' | 'heavy' | 'taunt' | 'ult' | 'ult2';

export interface GameSession {
  introOpen: boolean;
  readonly testMode: boolean;
  connectionLost: boolean;
  reconnect(): Promise<void>;
  onPickError: (msg: string) => void;
  heal(): void;
  god(on: boolean): void;
  killAll(): void;
  switchHero(char: string): void;
  readonly kind: 'local' | 'online';
  needsIntro(): boolean;
  finishIntro(): void;
  advanceStory(key: string): void;
  me: string;
  roomId: string;
  status: string;
  snapshots: Snapshot[];
  onEvents: (evs: SimEvent[]) => void;
  move(mx: number, my: number, run: boolean): void;
  press(b: Button): void;
  holdSmoke(on: boolean): void;
  holdFire(on: boolean): void;
  resetControls(): void;
  view(x: number, width: number): void;
  spawn(): void;
  summon(): void;
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
  connectionLost = false;
  async reconnect() {}
  onPickError: (msg: string) => void = () => {};
  get testMode() { return this.world.testTools; }
  me = 'me';
  roomId = '';
  status = 'офлайн';
  snapshots: Snapshot[] = [];
  onEvents: (evs: SimEvent[]) => void = () => {};
  private world: World;
  private story = createStoryProgress();
  private input: Input = emptyInput();
  private timer = 0;
  private intro = false;
  needsIntro() { return this.intro; }
  finishIntro() { this.intro = false; this.resetControls(); }
  private paused = false;

  constructor(level: 'route' | 'old' = 'route', stage = 0, testMode = false) {
    testMode = TEST_TOOLS && testMode;
    stage = testMode ? stage : 0;
    this.intro = false;
    this.world = createWorld(Date.now() & 0xffff, testMode, level, stage);
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
  }

  private tick() {
    if (document.hidden) return; // офлайн-пауза в фоне и по кнопке
    if (this.world.players[this.me] && startStoryForWorld(this.story, this.world)) this.resetControls();
    const wasStory = !!this.story.scene;
    if (wasStory) {
      const key = `${this.story.scene}:${this.story.index}`;
      tickStory(this.story, this.world, TICK_MS);
      if (key !== `${this.story.scene}:${this.story.index}`) this.resetControls();
    }
    const evs = wasStory || this.intro || this.paused || !!this.story.scene ? [] : step(this.world, { [this.me]: this.input });
    if (this.world.players[this.me] && startStoryForWorld(this.story, this.world)) this.resetControls();
    this.input.attack = this.input.heavy = this.input.taunt = this.input.ult = this.input.skip = false;
    if (this.world.players[this.me]?.char !== 'ramil') this.input.ult2 = false;
    const players = new Map<string, EntitySnap>();
    for (const p of Object.values(this.world.players)) players.set(p.id, { ...p, storm: p.stormMs, invuln: p.invulnMs > 0 });
    const enemies = new Map<string, EntitySnap>();
    for (const e of Object.values(this.world.enemies)) enemies.set(e.id, { ...e, meteorX: e.thrown?.x, meteorY: e.thrown?.y, meteorMs: e.thrown?.ms, carryBy: e.held?.by ?? e.thrown?.by ?? '', thrown: !!e.thrown, carried: !!(e.held || e.thrown), kind: e.boss ?? e.kind, frozen: (e.frozenMs ?? 0) > 0, slow: (e.slowMs ?? 0) > 0, stun: (e.stunMs ?? 0) > 0, charm: (e.charmMs ?? 0) > 0 });
    pushSnap(this.snapshots, { actors: new Map(Object.entries(this.world.actors).map(([id, a]) => [id, { ...a }])), storyCamX: this.world.storyCamX, recording: this.story.flags.recording === 'on', finaleReady: this.story.flags.finaleReady === 'on', wantedStars: wantedStatus(this.world, this.story).stars, wantedReward: wantedStatus(this.world, this.story).reward, storyScene: this.story.scene, storyIndex: this.story.index, storyHost: this.me, storyTime: this.world.timeMs, storyPushes: [...(this.world.storyPushes ?? [])], pausedBy: this.paused ? this.me : '', pauseMs: this.world.pauseMs ?? 0, slowmoMs: this.world.slowmoMs ?? 0, halt: this.world.halt, cineId: this.world.cine?.id ?? '', cineKind: this.world.cine?.kind ?? '', cineMs: this.world.cine?.ms ?? 0, shots: this.world.shots.map(s => ({ ...s })), zones: this.world.zones.map(z => ({ ...z })), t: performance.now(), players, enemies, lockX0: this.world.enc.lock?.[0] ?? -1, lockX1: this.world.enc.lock?.[1] ?? -1, encDone: this.world.enc.cleared, encTotal: encountersOf(this.world).length, won: this.world.won, level: this.world.level, stage: this.world.stage, trans: this.world.trans?.ms ?? 0, wave: this.world.wave, tick: this.world.tick });
    if (evs.length) this.onEvents(evs);
  }

  move(mx: number, my: number, run: boolean) { this.input.mx = mx; this.input.my = my; this.input.run = run; }
  press(b: Button) { this.input[b] = true; }
  view(x: number, width: number) { this.input.viewX = x; this.input.viewW = width; }
  holdSmoke(on: boolean) { this.input.ult2 = on; }
  holdFire(on: boolean) { this.input.fireHeld = on && this.world.players[this.me]?.char === 'kris'; }
  resetControls() { this.input = emptyInput(); }
  next() { if (this.testMode) nextStage(this.world); }
  spawn() { if (this.testMode) spawnEnemies(this.world, 3); }
  summon() { if (this.testMode) testSummon(this.world); }
  charge() { if (this.testMode) chargeUlt(this.world, this.me); }
  heal() { if (this.testMode) testHeal(this.world); }
  god(on: boolean) { if (this.testMode) testGod(this.world, this.me, on); }
  killAll() { if (this.testMode) testKillAll(this.world); }
  switchHero(char: string) {
    this.resetControls();
    if (this.story.scene || !switchHero(this.world, this.me, char)) this.onPickError('Персонаж занят');
  }
  pick(char: string) { addPlayer(this.world, this.me, char); if (this.world.level === 'route' && this.world.stage === 0) { startStory(this.story, 'start'); this.resetControls(); } }
  advanceStory(key: string) { if (advanceStory(this.story, key, this.world)) this.resetControls(); }
  setPaused(on: boolean) { this.resetControls(); this.paused = on; }
  isPaused() { return this.paused; }
  pausedByMe() { return true; }
  taken() { return takenChars(this.world); }
  hasMe() { return !!this.world.players[this.me]; }
  ping() { return 0; }
  leave() { this.resetControls(); clearInterval(this.timer); }
}

const TOKEN_KEY = 'bc-reconnect';
const TOKEN_LIFETIME = 60_000;
export function clearReconnect() { sessionStorage.removeItem(TOKEN_KEY); }
export function savedReconnect(): { roomId: string; token: string } | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(TOKEN_KEY) ?? 'null');
    if (typeof saved?.roomId === 'string' && typeof saved?.token === 'string' &&
        typeof saved?.at === 'number' && Date.now() - saved.at < TOKEN_LIFETIME) return saved;
  } catch { /* повреждённый токен */ }
  clearReconnect();
  return null;
}
export function returnToMenu(session: GameSession) {
  session.leave(); clearReconnect();
  location.replace(location.pathname);
}

export class OnlineSession implements GameSession {
  introOpen = false;
  readonly kind = 'online' as const;
  testMode = false;
  connectionLost = false;
  private left = false;
  private visibility = async () => {
    if (document.hidden) { this.resetControls(); this.saveToken(); this.safeSend('away', true); return; }
    await this.reconnect();
    this.safeSend('away', false);
  };
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
  needsIntro() { return !this.testMode && this.intro; }
  finishIntro() { this.resetControls(); this.safeSend('introDone', true); }

  private safeSend(type: string, payload: unknown) {
    if (this.room?.connection?.isOpen) this.room.send(type, payload);
  }

  private constructor(url: string) {
    this.client = new Client(url);
  }

  // Продолжение по токену явно отделено от новой игры и входа по коду.
  static async open(url: string, roomCode?: string, level: 'route' | 'old' = 'route', stage = 0, testMode = false, resume = false): Promise<OnlineSession> {
    const s = new OnlineSession(url);
    testMode = TEST_TOOLS && testMode;
    const saved = resume ? savedReconnect() : null;
    if (resume && !saved) throw new Error('Срок возврата в комнату истёк');
    const room = saved ? await s.client.reconnect(saved.token).catch(error => { clearReconnect(); throw error; })
      : roomCode ? await s.client.joinById(roomCode)
      : await s.client.create('game', { level, stage: testMode ? stage : 0, testMode: TEST_TOOLS && testMode });
    s.bind(room);
    s.pingTimer = window.setInterval(() => {
      if (s.room?.connection?.isOpen) { s.saveToken(); s.room.ping(ms => { s.lastPing = ms; }); }
    }, 2000);
    document.addEventListener('visibilitychange', s.visibility);
    return s;
  }

  private saveToken() {
    if (!this.left && this.room?.connection?.isOpen) sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ roomId: this.roomId, token: this.room.reconnectionToken, at: Date.now() }));
  }

  private bind(room: Room) {
    this.room = room;
    this.me = room.sessionId;
    this.roomId = room.roomId;
    this.status = 'онлайн';
    this.connectionLost = false;
    this.lastMove = this.lastView = '';
    this.saveToken();
    room.onStateChange((state: any) => {
      if (this.room !== room || this.left) return;
      this.testMode = state.testMode === true;
      this.intro = state.intro;
      const players = new Map<string, EntitySnap>();
      state.players.forEach((p: any, id: string) => players.set(id, { god: p.god, ultLevel: p.ultLevel, ultWindow: p.ultWindow, x: p.x, y: p.y, hp: p.hp, facing: p.facing, anim: p.anim, char: p.char, ult: p.ult, fDashMs: p.fDashMs, idleInput: p.idleInput, hiddenMs: p.hiddenMs, heavySmokeMs: p.heavySmokeMs, fireMs: p.fireMs, form: p.form, move: p.move, moveT: p.moveT, formMs: p.formMs, combo: p.combo, bCombo: p.bCombo, hitCount: p.hitCount, charge2: p.charge2, bCooldownMs: p.bCooldownMs, bChainActive: p.bChainActive, fireFacing: p.fireFacing, shooting: p.shooting, storm: p.storm, invuln: p.invuln, connected: p.connected, away: p.away }));
      const enemies = new Map<string, EntitySnap>();
      state.enemies.forEach((e: any, id: string) => enemies.set(id, { meteorX: e.meteorX, meteorY: e.meteorY, meteorMs: e.meteorMs, ultStopMs: e.ultStopMs, carryBy: e.carryBy, thrown: e.thrown, carried: e.carried, carryAngle: e.carryAngle, carryHeight: e.carryHeight, burnMs: e.burnMs, markedBy: e.markedBy, enterMs: e.enterMs, boss: e.boss, bossPhase: e.bossPhase, atk: e.atk, kind: e.kind, phase: e.phase, x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHp, dummy: e.dummy, air: e.air, height: e.height, frozen: e.frozen, slow: e.slow, stun: e.stun, charm: e.charm, facing: e.facing, anim: e.anim }));
      pushSnap(this.snapshots, { actors: new Map(Array.from(state.actors, ([id, a]: [string, any]) => [id, { id: a.id, look: a.look, x: a.x, y: a.y, tx: a.tx, ty: a.ty, facing: a.facing, anim: a.anim, speed: a.speed, keep: a.keep }])), storyCamX: state.hasStoryCam ? state.storyCamX : undefined, recording: state.recording, finaleReady: state.finaleReady, wantedStars: state.wantedStars, wantedReward: state.wantedReward, storyScene: state.storyScene, storyIndex: state.storyIndex, storyHost: state.storyHost, storyTime: state.storyTime, storyPushes: JSON.parse(state.storyPushes || '[]'), pausedBy: state.pausedBy, pauseMs: state.pauseMs, slowmoMs: state.slowmoMs, halt: state.halt, cineId: state.cineId, cineKind: state.cineKind, cineMs: state.cineMs, shots: Array.from(state.shots, (s: any) => ({ x: s.x, y: s.y, dir: s.dir })), zones: Array.from(state.zones, (z: any) => ({ x: z.x, y: z.y, r: z.r, ms: z.ms })), t: performance.now(), players, enemies, lockX0: state.lockX0, lockX1: state.lockX1, encDone: state.encDone, encTotal: state.encTotal, won: state.won, level: state.level, stage: state.stage, trans: state.trans, wave: state.wave, tick: state.tick });
      if (this.testMode && this.intro && players.has(this.me)) this.finishIntro();
      this.paused = state.paused;
      this.pausedBy = state.pausedBy;
      this.saveToken();
    });
    room.onMessage('ev', (evs: SimEvent[]) => this.onEvents(evs));
    room.onMessage('pickError', (m: string) => this.onPickError(m));
    room.onDrop(() => { this.resetControls(); this.status = 'связь потеряна, переподключаюсь…'; });
    room.onReconnect(() => {
      if (this.left || this.room !== room) return;
      this.resetControls(); this.status = 'онлайн'; this.connectionLost = false;
      // SDK обновляет токен после вызова обработчика.
      queueMicrotask(() => this.saveToken());
    });
    room.onLeave((code: number) => {
      if (this.left || this.room !== room) return;
      if (code === 4000) { this.status = 'вышел'; return; }
      this.status = 'отключён, жду возврата в игру…';
      if (!document.hidden) this.reconnect();
    });
  }

  // Ручное переподключение: iOS убивает сокет и страницу в фоне, авто-реконнект SDK это не покрывает
  async reconnect() {
    this.resetControls();
    if (this.left || this.reconnecting || this.room?.reconnection.isReconnecting || this.room?.connection?.isOpen) return;
    const saved = savedReconnect();
    if (!saved) { this.connectionLost = true; return; }
    this.reconnecting = true;
    this.status = 'переподключаюсь…';
    this.connectionLost = false;
    try {
      const room = await this.client.reconnect(saved.token);
      if (this.left) { void room.leave(true); return; }
      this.snapshots = [];
      this.bind(room);
    } catch (e: any) {
      this.connectionLost = true;
      this.status = 'не удалось вернуться: ' + (e?.message ?? e);
    } finally {
      this.reconnecting = false;
    }
  }

  private lastMove = '';
  move(mx: number, my: number, run: boolean) {
    const key = mx.toFixed(1) + ',' + my.toFixed(1) + (run ? 'r' : '');
    if (key === this.lastMove) return;
    if (!this.room?.connection?.isOpen) return;
    this.lastMove = key;
    this.safeSend('move', { mx, my, run });
  }
  press(b: Button) { this.safeSend('btn', b); }
  advanceStory(key: string) { this.safeSend('storyNext', key); }
  private lastView = '';
  view(x: number, width: number) {
    const key = Math.round(x) + ':' + width;
    if (key !== this.lastView && this.room?.connection?.isOpen) { this.lastView = key; this.safeSend('view', { x: Math.round(x), width }); }
  }
  holdSmoke(on: boolean) { this.safeSend('smoke', on); }
  private fireHeld = false;
  holdFire(on: boolean) {
    const isKris = this.snapshots.at(-1)?.players.get(this.me)?.char === 'kris';
    const next = on && isKris && !this.paused && !this.introOpen && !this.intro && !document.hidden;
    if (next === this.fireHeld) return;
    this.fireHeld = next;
    this.safeSend('fire', next);
  }
  resetControls() {
    this.fireHeld = false;
    this.lastMove = this.lastView = '';
    this.safeSend('clear', true);
  }
  next() { if (this.testMode) this.safeSend('next', true); }
  spawn() { if (this.testMode) this.safeSend('spawn', true); }
  summon() { if (this.testMode) this.safeSend('summon', true); }
  charge() { if (this.testMode) this.safeSend('charge', true); }
  heal() { if (this.testMode) this.safeSend('heal', true); }
  god(on: boolean) { if (this.testMode) this.safeSend('god', on); }
  killAll() { if (this.testMode) this.safeSend('killall', true); }
  switchHero(char: string) { this.resetControls(); this.safeSend('switch', char); }
  pick(char: string) { this.safeSend('pick', char); }
  setPaused(on: boolean) { this.resetControls(); this.safeSend('pause', on); }
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
    this.resetControls();
    this.left = true;
    document.removeEventListener('visibilitychange', this.visibility);
    clearInterval(this.pingTimer);
    sessionStorage.removeItem(TOKEN_KEY);
    this.room.leave(true);
  }
}
