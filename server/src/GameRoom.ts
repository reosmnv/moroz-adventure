import { Room, type Client } from 'colyseus';
import { schema, t, type SchemaType } from '@colyseus/schema';
import {
  encountersOf, CHARACTERS, LEVELS, nextStage, TEST_TOOLS, TICK_MS, addPlayer, chargeUlt, createWorld, emptyInput, removePlayer, spawnEnemies, step, takenChars, switchHero, testHeal, testGod, testKillAll,
  type Input, type World,
  advanceStory, createStoryProgress, startStory, startStoryForWorld, wantedStatus,
} from '@bc/shared';

export const PlayerState = schema({
  ultLevel: t.number(), ultWindow: t.number(),
  fDashMs: t.number(), idleInput: t.boolean(), hiddenMs: t.number(), heavySmokeMs: t.number(), fireMs: t.number(),
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
  storm: t.number(),
  combo: t.number(),
  bCombo: t.number(),
  hitCount: t.number(),
  charge2: t.number(),
  bCooldownMs: t.number(), bChainActive: t.boolean(), fireFacing: t.number(), shooting: t.boolean(),
  invuln: t.boolean(),
  connected: t.boolean(),
  away: t.boolean(),
  god: t.boolean(),
}, 'PlayerState');
export type PlayerState = SchemaType<typeof PlayerState>;

export const EnemyState = schema({
  meteorX: t.number(), meteorY: t.number(), meteorMs: t.number(), ultStopMs: t.number(), carryBy: t.string(), thrown: t.boolean(), carried: t.boolean(), carryAngle: t.number(), carryHeight: t.number(),
  burnMs: t.number(), markedBy: t.string(),
  enterMs: t.number(), boss: t.string(), bossPhase: t.number(), atk: t.string(),
  kind: t.string(),
  phase: t.string(),
  x: t.number(),
  y: t.number(),
  hp: t.number(),
  maxHp: t.number(),
  dummy: t.boolean(),
  frozen: t.boolean(),
  slow: t.boolean(),
  stun: t.boolean(),
  charm: t.boolean(),
  air: t.number(),
  height: t.number(),
  facing: t.number(),
  anim: t.string(),
}, 'EnemyState');
export type EnemyState = SchemaType<typeof EnemyState>;

export const ShotState = schema({ x: t.number(), y: t.number(), dir: t.number() }, 'ShotState');
export const ZoneState = schema({ x: t.number(), y: t.number(), r: t.number(), ms: t.number() }, 'ZoneState');
export const GameState = schema({
  recording: t.boolean(), finaleReady: t.boolean(), wantedStars: t.number(), wantedReward: t.number(),
  storyScene: t.string(), storyIndex: t.number(), storyHost: t.string(),
  storyTime: t.number(), storyPushes: t.string(),
  pauseMs: t.number(), slowmoMs: t.number(),
  halt: t.number(), cineId: t.string(), cineKind: t.string(), cineMs: t.number(),
  intro: t.boolean(), introHost: t.string(),
  shots: t.array(ShotState), zones: t.array(ZoneState),
  lockX0: t.number(), lockX1: t.number(),
  encDone: t.number(), encTotal: t.number(), won: t.boolean(),
  level: t.string(),
  stage: t.number(),
  trans: t.number(),
  tick: t.number(),
  wave: t.number(),
  testMode: t.boolean(),
  paused: t.boolean(),
  pausedBy: t.string(),
  players: t.map(PlayerState),
  enemies: t.map(EnemyState),
}, 'GameState');
export type GameState = SchemaType<typeof GameState>;

const RECONNECT_SECONDS = 60;
const round = (v: number) => Math.round(v * 10) / 10;

export class GameRoom extends Room<{ state: GameState }> {
  maxClients = 4;
  state = new GameState();
  world: World = createWorld(Date.now() & 0xffff, false);
  playerInputs: Record<string, Input> = {};
  private story = createStoryProgress();
  private storyHost = '';
  private introReaders = new Set<string>();
  private introReady = new Set<string>();

  onCreate(options: { level?: unknown; stage?: unknown; testMode?: unknown } = {}) {
    const level = options.level === 'old' ? 'old' : 'route';
    const testMode = TEST_TOOLS && options.testMode === true;
    const stage = testMode && typeof options.stage === 'number' && Number.isInteger(options.stage) && options.stage >= 0 && options.stage < LEVELS[level].stages.length ? options.stage : 0;
    this.world = createWorld(Date.now() & 0xffff, testMode, level, stage);
    this.state.intro = false;
    this.sync();
    this.onMessage('next', (client: Client) => {
      if (this.world.testTools && this.world.players[client.sessionId]) nextStage(this.world);
    });
    // Короткий код комнаты для ссылки вместо стандартного длинного id
    this.roomId = Math.random().toString(36).slice(2, 7).toUpperCase();

    this.onMessage('pick', (client: Client, char: string) => {
      if (this.world.players[client.sessionId]) return;
      if (!CHARACTERS.some(c => c.id === char) || takenChars(this.world).includes(char)) {
        client.send('pickError', 'Персонаж занят');
        return;
      }
      const p = addPlayer(this.world, client.sessionId, char);
      if (!this.storyHost || !this.world.players[this.storyHost]) this.storyHost = client.sessionId;
      if (level === 'route' && stage === 0 && startStory(this.story, 'start')) this.clearInputs();
      if (this.state.intro && !this.introReady.has(client.sessionId)) { this.introReaders.add(client.sessionId); p.away = true; }
      this.playerInputs[client.sessionId] = emptyInput();
    });

    this.onMessage('switch', (client: Client, char: string) => {
      if (this.state.intro || this.story.scene || !switchHero(this.world, client.sessionId, char)) {
        client.send('pickError', 'Персонаж занят');
        return;
      }
      this.playerInputs[client.sessionId] = emptyInput();
      this.sync();
      this.flushEvents();
    });

    this.onMessage('move', (client: Client, m: { mx: number; my: number; run?: boolean }) => {
      const inp = this.playerInputs[client.sessionId];
      if (inp && !this.state.paused && !this.state.intro && !this.story.scene && !this.world.players[client.sessionId]?.away &&
          Number.isFinite(m?.mx) && Number.isFinite(m?.my)) {
        inp.mx = Math.max(-1, Math.min(1, m.mx)); inp.my = Math.max(-1, Math.min(1, m.my)); inp.run = m.run === true;
      }
    });

    // Кнопки копятся до ближайшего тика, чтобы короткое нажатие не терялось
    this.onMessage('btn', (client: Client, b: string) => {
      const inp = this.playerInputs[client.sessionId];
      if (inp && !this.state.paused && !this.state.intro && !this.story.scene && !this.world.players[client.sessionId]?.away &&
          (b === 'skip' || b === 'attack' || b === 'heavy' || b === 'taunt' || b === 'ult' || b === 'ult2')) inp[b] = true;
    });

    this.onMessage('view', (client: Client, v: { x?: number; width?: number }) => {
      const inp = this.playerInputs[client.sessionId];
      if (inp && Number.isFinite(v?.x) && Number.isFinite(v?.width)) { inp.viewX = Math.max(0, Math.min(10000, v.x!)); inp.viewW = Math.max(480, Math.min(810, v.width!)); }
    });
    this.onMessage('smoke', (client: Client, on: unknown) => {
      if (this.world.players[client.sessionId]?.char === 'ramil' && this.playerInputs[client.sessionId] && !this.state.paused && !this.state.intro && !this.story.scene) this.playerInputs[client.sessionId].ult2 = on === true;
    });
    this.onMessage('fire', (client: Client, on: unknown) => {
      const p = this.world.players[client.sessionId], inp = this.playerInputs[client.sessionId];
      if (p?.char === 'kris' && inp && typeof on === 'boolean') inp.fireHeld = on && !this.state.paused && !this.state.intro && !this.story.scene && !p.away && p.connected;
    });
    this.onMessage('clear', (client: Client) => {
      if (this.playerInputs[client.sessionId]) this.playerInputs[client.sessionId] = emptyInput();
    });
    this.onMessage('storyNext', (client: Client, key: string) => {
      if (client.sessionId !== this.storyHost || !this.world.players[client.sessionId]?.connected) return;
      if (advanceStory(this.story, key)) { this.clearInputs(); this.sync(); }
    });

    // Тестовые команды доступны только в режиме комнаты
    this.onMessage('spawn', (client: Client) => {
      if (this.world.testTools && this.world.players[client.sessionId]) spawnEnemies(this.world, 3);
    });

    this.onMessage('charge', (client: Client) => {
      if (this.world.testTools) chargeUlt(this.world, client.sessionId);
    });

    this.onMessage('heal', (client: Client) => {
      if (this.world.testTools && this.world.players[client.sessionId]) testHeal(this.world);
    });
    this.onMessage('god', (client: Client, on: unknown) => {
      if (this.world.testTools && typeof on === 'boolean') testGod(this.world, client.sessionId, on);
    });
    this.onMessage('killall', (client: Client) => {
      if (this.world.testTools && this.world.players[client.sessionId]) testKillAll(this.world);
    });

    this.onMessage('introDone', (client: Client) => {
      this.introReaders.delete(client.sessionId); this.introReady.add(client.sessionId);
      const p = this.world.players[client.sessionId];
      if (p) { p.away = false; this.playerInputs[client.sessionId] = emptyInput(); }
      if (client.sessionId === this.state.introHost) this.state.intro = false;
    });

    // Пауза общая на комнату: поставить и снять может любой из двоих
    this.onMessage('pause', (client: Client, on: boolean) => {
      if (typeof on !== 'boolean' || !this.world.players[client.sessionId]) return;
      for (const id of Object.keys(this.playerInputs)) this.playerInputs[id] = emptyInput();
      this.state.paused = on;
      this.state.pausedBy = on ? client.sessionId : '';
    });

    // Свернул Safari: персонаж замирает, при всех свёрнутых мир стоит
    this.onMessage('away', (client: Client, on: boolean) => {
      if (typeof on !== 'boolean') return;
      const p = this.world.players[client.sessionId];
      if (p) { p.away = on || this.introReaders.has(client.sessionId); this.playerInputs[client.sessionId] = emptyInput(); }
    });

    this.setPatchRate(TICK_MS); // состояние уходит клиентам каждый тик, а не раз в 50 мс
    this.setSimulationInterval(() => this.tick(), TICK_MS);
  }

  private flushEvents() {
    const events = this.world.events?.splice(0);
    if (events?.length) this.broadcast('ev', events);
  }

  private unpause(id: string) {
    if (this.state.pausedBy === id) { this.state.paused = false; this.state.pausedBy = ''; }
  }

  private clearInputs() { for (const id of Object.keys(this.playerInputs)) this.playerInputs[id] = emptyInput(); }

  tick() {
    if (Object.keys(this.world.players).length && startStoryForWorld(this.story, this.world)) this.clearInputs();
    if (this.state.paused || this.state.intro || this.story.scene) { this.sync(); this.flushEvents(); return; }
    const events = step(this.world, this.playerInputs);
    if (Object.keys(this.world.players).length && startStoryForWorld(this.story, this.world)) this.clearInputs();
    for (const [id, inp] of Object.entries(this.playerInputs)) { inp.attack = inp.heavy = inp.taunt = inp.ult = inp.skip = false; if (this.world.players[id]?.char !== 'ramil') inp.ult2 = false; }
    this.sync();
    if (events.length) this.broadcast('ev', events);
  }

  // Копия мира в Schema: Colyseus сам отправит только изменившиеся поля
  sync() {
    const s = this.state, w = this.world;
    const wanted = wantedStatus(w, this.story); s.recording = this.story.flags.recording === 'on'; s.finaleReady = this.story.flags.finaleReady === 'on'; s.wantedStars = wanted.stars; s.wantedReward = wanted.reward;
    s.storyScene = this.story.scene; s.storyIndex = this.story.index; s.storyHost = this.storyHost;
    s.shots.clear(); for (const shot of w.shots) s.shots.push(new ShotState({ x: shot.x, y: shot.y, dir: shot.dir }));
    s.zones.clear(); for (const zone of w.zones) s.zones.push(new ZoneState({ x: zone.x, y: zone.y, r: zone.r, ms: zone.ms }));
    s.storyTime = w.timeMs; s.storyPushes = JSON.stringify(w.storyPushes ?? []);
    s.pauseMs = w.pauseMs ?? 0; s.slowmoMs = w.slowmoMs ?? 0;
    s.halt = w.halt; s.cineId = w.cine?.id ?? ''; s.cineKind = w.cine?.kind ?? ''; s.cineMs = w.cine?.ms ?? 0;
    s.testMode = w.testTools;
    s.level = w.level; s.stage = w.stage; s.trans = w.trans?.ms ?? 0;
    s.tick = w.tick;
    s.wave = w.wave;
    s.lockX0 = w.enc.lock?.[0] ?? -1; s.lockX1 = w.enc.lock?.[1] ?? -1;
    s.encDone = w.enc.cleared; s.encTotal = encountersOf(w).length; s.won = w.won;
    for (const id of [...s.players.keys()]) if (!w.players[id]) s.players.delete(id);
    for (const p of Object.values(w.players)) {
      let ps = s.players.get(p.id);
      if (!ps) { ps = new PlayerState(); s.players.set(p.id, ps); }
      ps.ultLevel = p.ultLevel ?? 0; ps.ultWindow = p.ultWindow ?? 0;
      ps.fDashMs = p.fDashMs ?? 0; ps.idleInput = !!p.idleInput; ps.hiddenMs = p.hiddenMs ?? 0; ps.heavySmokeMs = p.heavySmokeMs ?? 0; ps.fireMs = p.fireMs ?? 0;
      ps.char = p.char; ps.x = round(p.x); ps.y = round(p.y); ps.hp = p.hp; ps.facing = p.facing;
      ps.anim = p.anim; ps.ult = Math.floor(p.ult);
      ps.form = p.form; ps.move = p.move; ps.moveT = Math.round(p.moveT); ps.formMs = Math.round(p.formMs); ps.combo = p.combo; ps.bCombo = p.bCombo; ps.bCooldownMs = Math.max(0, Math.round(p.bCooldownMs ?? 0)); ps.bChainActive = !!p.bChainActive; ps.fireFacing = p.fireFacing ?? p.facing; ps.shooting = !!p.shooting; ps.hitCount = p.hitCount; ps.charge2 = Math.floor(p.charge2); ps.storm = Math.round(p.stormMs); ps.invuln = p.invulnMs > 0;
      ps.connected = p.connected; ps.away = p.away; ps.god = !!p.god;
    }
    for (const id of [...s.enemies.keys()]) if (!w.enemies[id]) s.enemies.delete(id);
    for (const e of Object.values(w.enemies)) {
      let es = s.enemies.get(e.id);
      if (!es) { es = new EnemyState(); s.enemies.set(e.id, es); }
      es.meteorX = e.thrown?.x ?? 0; es.meteorY = e.thrown?.y ?? 0; es.meteorMs = e.thrown?.ms ?? 0;
      es.ultStopMs = e.ultStopMs ?? 0; es.carryBy = e.held?.by ?? e.thrown?.by ?? ''; es.thrown = !!e.thrown; es.carried = !!(e.held || e.thrown); es.carryAngle = e.carryAngle ?? 0; es.carryHeight = e.carryHeight ?? 0;
      es.burnMs = e.burnMs ?? 0; es.markedBy = e.markedBy ?? '';
      es.enterMs = e.enterMs ?? 0;
      es.boss = e.boss ?? ''; es.bossPhase = e.bossPhase ?? 0; es.atk = e.atk ?? '';
      es.kind = e.boss ?? e.kind; es.phase = e.phase;
      es.x = round(e.x); es.y = round(e.y); es.hp = e.hp; es.maxHp = e.maxHp; es.dummy = !!e.dummy; es.air = Math.round(e.air ?? 0); es.height = round(e.height ?? 0); es.frozen = (e.frozenMs ?? 0) > 0; es.slow = (e.slowMs ?? 0) > 0; es.stun = (e.stunMs ?? 0) > 0; es.charm = (e.charmMs ?? 0) > 0; es.facing = e.facing; es.anim = e.anim;
    }
  }

  onJoin(client: Client) {
    if (!this.state.introHost) this.state.introHost = client.sessionId;
    if (!this.storyHost) this.storyHost = client.sessionId;
    console.log(`[${this.roomId}] join ${client.sessionId}`);
  }

  // Обрыв без согласия (iOS убил сокет, пока игрок в мессенджере): держим место
  onDrop(client: Client) {
    this.unpause(client.sessionId);
    const p = this.world.players[client.sessionId];
    if (p) { p.connected = false; this.playerInputs[client.sessionId] = emptyInput(); }
    if (this.storyHost === client.sessionId) this.storyHost = this.clients.find(c => c.sessionId !== client.sessionId && this.world.players[c.sessionId]?.connected)?.sessionId ?? '';
    console.log(`[${this.roomId}] drop ${client.sessionId}`);
    this.allowReconnection(client, RECONNECT_SECONDS);
  }

  onReconnect(client: Client) {
    const p = this.world.players[client.sessionId];
    if (p) { p.connected = true; p.away = this.introReaders.has(client.sessionId); this.playerInputs[client.sessionId] = emptyInput(); }
    if (!this.storyHost) this.storyHost = client.sessionId;
    console.log(`[${this.roomId}] reconnect ${client.sessionId}`);
  }

  onLeave(client: Client) {
    this.unpause(client.sessionId);
    if (this.state.introHost === client.sessionId) {
      this.state.introHost = this.clients.find(c => c.sessionId !== client.sessionId)?.sessionId ?? '';
      if (this.introReady.has(this.state.introHost)) this.state.intro = false;
    }
    this.introReaders.delete(client.sessionId); this.introReady.delete(client.sessionId);
    removePlayer(this.world, client.sessionId);
    if (this.storyHost === client.sessionId) this.storyHost = this.clients.find(c => c.sessionId !== client.sessionId && this.world.players[c.sessionId]?.connected)?.sessionId ?? '';
    delete this.playerInputs[client.sessionId];
    console.log(`[${this.roomId}] leave ${client.sessionId}`);
  }
}
