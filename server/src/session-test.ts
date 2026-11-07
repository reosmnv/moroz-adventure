// Локальная сессия без браузера: тики запускаем вручную.
import { TEST_TOOLS } from '@bc/shared';
import { LocalSession, OnlineSession, clearReconnect, savedReconnect, returnToMenu } from '../../client/src/session.ts';
import { GameRoom } from './GameRoom.ts';

let failed = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? 'OK' : 'FAIL'} ${name}`);
  if (!ok) failed++;
}
let tick = () => {};
Object.defineProperty(globalThis, 'window', { value: {
  setInterval(callback: () => void) { tick = callback; return 0; },
} });
Object.defineProperty(globalThis, 'document', { value: { hidden: false } });

for (const testMode of [false, true]) {
  const session = new LocalSession('old', 0, testMode);
  const allowed = TEST_TOOLS && testMode;
  try {
    tick();
    check(`C1 offline old, testMode=${testMode}`, session.snapshots.at(-1)?.level === (allowed ? 'old' : 'route') && session.testMode === allowed);
    session.pick('anastasia'); tick();
    check(`C1 offline пролог только в route, testMode=${testMode}`, session.snapshots.at(-1)?.storyScene === (allowed ? '' : 'prologue'));
    if (!allowed) {
      for (let n = 0; n < 500 && session.snapshots.at(-1)?.storyScene; n++) {
        const snap = session.snapshots.at(-1)!;
        session.advanceStory(`${snap.storyScene}:${snap.storyIndex}`); tick();
      }
      check('C1 offline пролог завершился', session.snapshots.at(-1)?.storyScene === '');
    }
    const x = session.snapshots.at(-1)!.players.get(session.me)!.x;
    session.move(1, 0, false); tick();
    check(`C1 offline управление после выбора/пролога, testMode=${testMode}`, session.snapshots.at(-1)!.players.get(session.me)!.x > x);
  } finally { session.leave(); }
}
// Релизная комната даже при ручных options не включает инструменты.
check('TZ28 TEST_TOOLS выключен', TEST_TOOLS === false);
const handlers = new Map<string, (client: any, data?: any) => void>();
let reconnectSeconds = 0;
const room = {
  roomId: '', state: { pausedBy: '' }, playerInputs: {},
  updateStoryHost() {},
  allowReconnection(_client: unknown, seconds: number) { reconnectSeconds = seconds; },
  sync() {}, onMessage(name: string, handler: (client: any, data?: any) => void) { handlers.set(name, handler); },
  setPatchRate() {}, setSimulationInterval() {},
} as unknown as GameRoom;
Object.setPrototypeOf(room, GameRoom.prototype);
GameRoom.prototype.onCreate.call(room, { testMode: true, stage: 6, level: 'old' });
check('TZ28 ручной запрос testMode/stage/level игнорируется', !room.world.testTools && room.world.stage === 0 && room.world.level === 'route');
room.world.players = {}; // тестируем команды с существующим игроком
const { addPlayer } = await import('@bc/shared');
addPlayer(room.world, 'test', 'anastasia');
const before = JSON.stringify(room.world);
for (const name of ['next', 'spawn', 'summon', 'charge', 'heal', 'god', 'kill', 'killall', 'testScene', 'storyStrict']) {
  handlers.get(name)?.({ sessionId: 'test' }, name === 'testScene' ? { id: 'sender', strict: false } : true);
}
check('TZ28 релизная комната игнорирует все тестовые команды', JSON.stringify(room.world) === before);
room.onDrop({ sessionId: 'test' } as Parameters<GameRoom['onDrop']>[0]);
check('TZ28 сервер держит место 180 секунд', reconnectSeconds === 180 && !room.world.players.test.connected);

const stored = new Map<string, string>();
let denyStorage = false;
Object.defineProperty(globalThis, 'localStorage', { value: {
  getItem(key: string) { if (denyStorage) throw Error('denied'); return stored.get(key) ?? null; },
  setItem(key: string, value: string) { stored.set(key, value); },
  removeItem(key: string) { if (denyStorage) throw Error('denied'); stored.delete(key); },
} });
const save = (at: number) => stored.set('bc-reconnect', JSON.stringify({ roomId: 'ROOM', token: 'token', at }));
save(Date.now() - 120000);
check('TZ28 токен из localStorage доступен через две минуты', savedReconnect()?.token === 'token');
save(Date.now() - 180001);
check('TZ28 просроченный токен очищен', savedReconnect() === null && !stored.has('bc-reconnect'));
stored.set('bc-reconnect', '{broken');
check('TZ28 повреждённый токен не ломает меню', savedReconnect() === null && !stored.has('bc-reconnect'));
save(Date.now() + 10000);
check('TZ28 некорректная дата токена очищена', savedReconnect() === null);
save(Date.now()); clearReconnect();
check('TZ28 сброс для новой игры очищает localStorage', !stored.has('bc-reconnect'));
save(Date.now());
let left = false, replaced = '';
Object.defineProperty(globalThis, 'location', { value: { pathname: '/game/', replace(path: string) { replaced = path; } } });
returnToMenu({ leave() { left = true; } } as LocalSession);
check('TZ28 главное меню очищает токен и закрывает сессию', left && replaced === '/game/' && !stored.has('bc-reconnect'));
save(Date.now());
const online = Object.assign(Object.create(OnlineSession.prototype), {
  roomId: 'ROOM', room: { connection: { isOpen: true }, reconnectionToken: 'persisted', leave() { left = true; } }, resetControls() {}, visibility() {},
});
online.saveToken();
check('TZ28 OnlineSession сохраняет токен в localStorage', savedReconnect()?.token === 'persisted');
Object.assign(globalThis.document, { removeEventListener() {} });
online.leave();
check('TZ28 OnlineSession.leave очищает localStorage', !stored.has('bc-reconnect'));
denyStorage = true;
check('TZ28 запрет localStorage не ломает меню', savedReconnect() === null);
if (failed) process.exitCode = 1;
