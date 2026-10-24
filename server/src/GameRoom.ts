import { Room, type Client } from 'colyseus';
import { schema, t, type SchemaType } from '@colyseus/schema';
import {
  CHARACTERS, TEST_TOOLS, TICK_MS, addPlayer, createWorld, emptyInput, removePlayer, spawnEnemies, step, takenChars,
  type Input, type World,
} from '@bc/shared';

export const PlayerState = schema({
  char: t.string(),
  x: t.number(),
  y: t.number(),
  hp: t.number(),
  facing: t.number(),
  anim: t.string(),
  ult: t.number(),
  form: t.string(),
  move: t.string(),
  moveT: t.number(),
  formMs: t.number(),
  combo: t.number(),
  invuln: t.boolean(),
  connected: t.boolean(),
  away: t.boolean(),
}, 'PlayerState');
export type PlayerState = SchemaType<typeof PlayerState>;

export const EnemyState = schema({
  x: t.number(),
  y: t.number(),
  hp: t.number(),
  maxHp: t.number(),
  dummy: t.boolean(),
  facing: t.number(),
  anim: t.string(),
}, 'EnemyState');
export type EnemyState = SchemaType<typeof EnemyState>;

export const GameState = schema({
  tick: t.number(),
  wave: t.number(),
  paused: t.boolean(),
  pausedBy: t.string(),
  players: t.map(PlayerState),
  enemies: t.map(EnemyState),
}, 'GameState');
export type GameState = SchemaType<typeof GameState>;

const RECONNECT_SECONDS = 60;
const round = (v: number) => Math.round(v * 10) / 10;

export class GameRoom extends Room<{ state: GameState }> {
  maxClients = 2;
  state = new GameState();
  world: World = createWorld(Date.now() & 0xffff, TEST_TOOLS);
  playerInputs: Record<string, Input> = {};

  onCreate() {
    // Короткий код комнаты для ссылки вместо стандартного длинного id
    this.roomId = Math.random().toString(36).slice(2, 7).toUpperCase();

    this.onMessage('pick', (client: Client, char: string) => {
      if (this.world.players[client.sessionId]) return;
      if (!CHARACTERS.some(c => c.id === char) || takenChars(this.world).includes(char)) {
        client.send('pickError', 'Персонаж занят');
        return;
      }
      addPlayer(this.world, client.sessionId, char);
      this.playerInputs[client.sessionId] = emptyInput();
    });

    this.onMessage('move', (client: Client, m: { mx: number; my: number; run?: boolean }) => {
      const inp = this.playerInputs[client.sessionId];
      if (inp && typeof m?.mx === 'number' && typeof m?.my === 'number') { inp.mx = m.mx; inp.my = m.my; inp.run = !!m.run; }
    });

    // Кнопки копятся до ближайшего тика, чтобы короткое нажатие не терялось
    this.onMessage('btn', (client: Client, b: string) => {
      const inp = this.playerInputs[client.sessionId];
      if (inp && (b === 'attack' || b === 'heavy' || b === 'taunt' || b === 'ult')) inp[b] = true;
    });

    // Тестовая кнопка «+3 врага»; в релизе TEST_TOOLS = false
    this.onMessage('spawn', (client: Client) => {
      if (TEST_TOOLS && this.world.players[client.sessionId]) spawnEnemies(this.world, 3);
    });

    // Пауза общая на комнату: поставить и снять может любой из двоих
    this.onMessage('pause', (client: Client, on: boolean) => {
      this.state.paused = !!on;
      this.state.pausedBy = on ? client.sessionId : '';
    });

    // Свернул Safari: персонаж замирает, при всех свёрнутых мир стоит
    this.onMessage('away', (client: Client, on: boolean) => {
      const p = this.world.players[client.sessionId];
      if (p) { p.away = !!on; this.playerInputs[client.sessionId] = emptyInput(); }
    });

    this.setPatchRate(TICK_MS); // состояние уходит клиентам каждый тик, а не раз в 50 мс
    this.setSimulationInterval(() => this.tick(), TICK_MS);
  }

  tick() {
    if (this.state.paused) return;
    const events = step(this.world, this.playerInputs);
    for (const inp of Object.values(this.playerInputs)) { inp.attack = inp.heavy = inp.taunt = inp.ult = false; }
    this.sync();
    if (events.length) this.broadcast('ev', events);
  }

  // Копия мира в Schema: Colyseus сам отправит только изменившиеся поля
  sync() {
    const s = this.state, w = this.world;
    s.tick = w.tick;
    s.wave = w.wave;
    for (const id of [...s.players.keys()]) if (!w.players[id]) s.players.delete(id);
    for (const p of Object.values(w.players)) {
      let ps = s.players.get(p.id);
      if (!ps) { ps = new PlayerState(); s.players.set(p.id, ps); }
      ps.char = p.char; ps.x = round(p.x); ps.y = round(p.y); ps.hp = p.hp; ps.facing = p.facing;
      ps.anim = p.anim; ps.ult = Math.floor(p.ult);
      ps.form = p.form; ps.move = p.move; ps.moveT = Math.round(p.moveT); ps.formMs = Math.round(p.formMs); ps.combo = p.combo; ps.invuln = p.invulnMs > 0;
      ps.connected = p.connected; ps.away = p.away;
    }
    for (const id of [...s.enemies.keys()]) if (!w.enemies[id]) s.enemies.delete(id);
    for (const e of Object.values(w.enemies)) {
      let es = s.enemies.get(e.id);
      if (!es) { es = new EnemyState(); s.enemies.set(e.id, es); }
      es.x = round(e.x); es.y = round(e.y); es.hp = e.hp; es.maxHp = e.maxHp; es.dummy = !!e.dummy; es.facing = e.facing; es.anim = e.anim;
    }
  }

  onJoin(client: Client) {
    console.log(`[${this.roomId}] join ${client.sessionId}`);
  }

  // Обрыв без согласия (iOS убил сокет, пока игрок в мессенджере): держим место
  onDrop(client: Client) {
    const p = this.world.players[client.sessionId];
    if (p) { p.connected = false; this.playerInputs[client.sessionId] = emptyInput(); }
    console.log(`[${this.roomId}] drop ${client.sessionId}`);
    this.allowReconnection(client, RECONNECT_SECONDS);
  }

  onReconnect(client: Client) {
    const p = this.world.players[client.sessionId];
    if (p) { p.connected = true; p.away = false; }
    console.log(`[${this.roomId}] reconnect ${client.sessionId}`);
  }

  onLeave(client: Client) {
    removePlayer(this.world, client.sessionId);
    delete this.playerInputs[client.sessionId];
    console.log(`[${this.roomId}] leave ${client.sessionId}`);
  }
}
