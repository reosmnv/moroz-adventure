// Две реализации одной сессии: офлайн (sim в браузере) и онлайн (Colyseus).
// Сцена знает только снимки и события, режим ей не важен.
import { Client, type Room } from '@colyseus/sdk';
import {
  TICK_MS, addPlayer, createWorld, emptyInput, step, takenChars,
  type Anim, type Input, type SimEvent, type World,
} from '@bc/shared';

export interface EntitySnap { x: number; y: number; hp: number; facing: number; anim: Anim; char?: string; ult?: number; connected?: boolean; away?: boolean; maxHp?: number }
export interface Snapshot { t: number; players: Map<string, EntitySnap>; enemies: Map<string, EntitySnap>; wave: number; tick: number }
export type Button = 'attack' | 'heavy' | 'taunt' | 'ult';

export interface GameSession {
  readonly kind: 'local' | 'online';
  me: string;
  roomId: string;
  status: string;
  snapshots: Snapshot[];
  onEvents: (evs: SimEvent[]) => void;
  move(mx: number, my: number): void;
  press(b: Button): void;
  pick(char: string): void;
  setPaused(on: boolean): void;
  isPaused(): boolean;
  pausedByMe(): boolean;
  taken(): string[];
  hasMe(): boolean;
  ping(): number;
  leave(): void;
}

const BUFFER = 20;
function pushSnap(list: Snapshot[], s: Snapshot) {
  list.push(s);
  if (list.length > BUFFER) list.shift();
}

export class LocalSession implements GameSession {
  readonly kind = 'local' as const;
  me = 'me';
  roomId = '';
  status = 'офлайн';
  snapshots: Snapshot[] = [];
  onEvents: (evs: SimEvent[]) => void = () => {};
  private world: World = createWorld(Date.now() & 0xffff);
  private input: Input = emptyInput();
  private timer = 0;
  private paused = false;

  constructor() {
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
  }

  private tick() {
    if (document.hidden || this.paused) return; // офлайн-пауза в фоне и по кнопке
    const evs = step(this.world, { [this.me]: this.input });
    this.input.attack = this.input.heavy = this.input.taunt = this.input.ult = false;
    const players = new Map<string, EntitySnap>();
    for (const p of Object.values(this.world.players)) players.set(p.id, { ...p });
    const enemies = new Map<string, EntitySnap>();
    for (const e of Object.values(this.world.enemies)) enemies.set(e.id, { ...e });
    pushSnap(this.snapshots, { t: performance.now(), players, enemies, wave: this.world.wave, tick: this.world.tick });
    if (evs.length) this.onEvents(evs);
  }

  move(mx: number, my: number) { this.input.mx = mx; this.input.my = my; }
  press(b: Button) { this.input[b] = true; }
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

  private safeSend(type: string, payload: unknown) {
    if (this.room?.connection?.isOpen) this.room.send(type, payload);
  }

  private constructor(url: string) {
    this.client = new Client(url);
  }

  // Вход: по сохранённому токену (вернулись после фона/перезагрузки), иначе по коду или новая комната
  static async open(url: string, roomCode?: string): Promise<OnlineSession> {
    const s = new OnlineSession(url);
    const saved = JSON.parse(sessionStorage.getItem(TOKEN_KEY) ?? 'null');
    let room: Room | null = null;
    if (saved && (!roomCode || saved.roomId === roomCode)) {
      try { room = await s.client.reconnect(saved.token); } catch { sessionStorage.removeItem(TOKEN_KEY); }
    }
    if (!room) room = roomCode ? await s.client.joinById(roomCode) : await s.client.create('game');
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
      const players = new Map<string, EntitySnap>();
      state.players.forEach((p: any, id: string) => players.set(id, { x: p.x, y: p.y, hp: p.hp, facing: p.facing, anim: p.anim, char: p.char, ult: p.ult, connected: p.connected, away: p.away }));
      const enemies = new Map<string, EntitySnap>();
      state.enemies.forEach((e: any, id: string) => enemies.set(id, { x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHp, facing: e.facing, anim: e.anim }));
      pushSnap(this.snapshots, { t: performance.now(), players, enemies, wave: state.wave, tick: state.tick });
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
  move(mx: number, my: number) {
    const key = mx.toFixed(1) + ',' + my.toFixed(1);
    if (key === this.lastMove) return;
    this.lastMove = key;
    this.room.send('move', { mx, my });
  }
  press(b: Button) { this.room.send('btn', b); }
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
