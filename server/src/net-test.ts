// Сетевые сценарии без браузера: два бота на @colyseus/sdk против живого сервера.
// Запуск: сервер уже работает, затем `npm run test:net` (SERVER_URL переопределяет адрес).
import { Client, type Room } from '@colyseus/sdk';

const URL = process.env.SERVER_URL ?? 'http://100.118.72.60:2567';
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
let failed = 0;
function check(name: string, ok: boolean, info = '') {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${info ? `  (${info})` : ''}`);
  if (!ok) failed++;
}
const players = (r: Room) => (r.state as any).players as Map<string, any>;

async function main() {
  // 1. Хост создаёт комнату и выбирает персонажа
  const a = await new Client(URL).create('game');
  a.reconnection.enabled = false;
  a.onMessage('ev', () => {});
  check('комната создана, короткий код', /^[A-Z0-9]{5}$/.test(a.roomId), a.roomId);
  a.send('pick', 'anastasia');
  await sleep(400);
  check('хост в мире', players(a).has(a.sessionId));
  const tick0 = (a.state as any).tick;
  await sleep(500);
  check('сервер тикает', (a.state as any).tick > tick0, `tick ${(a.state as any).tick}`);
  check('волна врагов появилась', (a.state as any).enemies.size > 0, `врагов ${(a.state as any).enemies.size}`);

  // 2. Движение считает сервер
  const x0 = players(a).get(a.sessionId).x;
  a.send('move', { mx: 1, my: 0 });
  await sleep(500);
  a.send('move', { mx: 0, my: 0 });
  await sleep(200);
  const x1 = players(a).get(a.sessionId).x;
  check('движение вправо', x1 > x0 + 20, `${x0} → ${x1}`);

  // 3. Второй входит по коду в середине партии
  const b = await new Client(URL).joinById(a.roomId);
  b.reconnection.enabled = false;
  let pickError = '';
  b.onMessage('pickError', (m: string) => { pickError = m; });
  b.send('pick', 'anastasia');
  await sleep(300);
  check('нельзя взять занятого персонажа', pickError !== '' && !players(b).has(b.sessionId), pickError);
  b.send('pick', 'b');
  await sleep(400);
  const pa = players(a).get(a.sessionId), pb = players(a).get(b.sessionId);
  check('второй появился у хоста', !!pb);
  check('второй рядом с первым', !!pb && Math.abs(pb.x - pa.x) < 60, pb ? `dx ${Math.round(pb.x - pa.x)}` : '');

  // 4. Удар по врагу: урон считает сервер, событие приходит обоим
  let hits = 0;
  b.onMessage('ev', (evs: any[]) => { hits += evs.filter(e => e.t === 'hit').length; });
  // Враги идут из-за края экрана, ждём до 15 с, пока дойдут
  for (let i = 0; i < 150 && hits === 0; i++) { a.send('btn', 'attack'); b.send('btn', 'attack'); await sleep(100); }
  check('события боя доходят', hits > 0, `hit-событий у B: ${hits}`);

  // 5. Третий не влезает
  let third = 'вошёл';
  try { const c = await new Client(URL).joinById(a.roomId); await c.leave(); } catch (e: any) { third = e.message ?? 'ошибка'; }
  check('третий игрок не входит', third !== 'вошёл', third);

  // 5a. Пауза кнопкой: мир стоит у обоих, снимает любой
  a.send('pause', true);
  await sleep(500);
  const tp = (b.state as any).tick;
  await sleep(500);
  check('пауза останавливает мир', (b.state as any).paused === true && (b.state as any).tick === tp);
  b.send('pause', false);
  await sleep(500);
  check('паузу снимает второй игрок', (a.state as any).paused === false && (a.state as any).tick > tp);

  // 5b. Оба свернули Safari: мир стоит; один вернулся: идёт
  a.send('away', true); b.send('away', true);
  await sleep(500);
  const ta = (a.state as any).tick;
  await sleep(500);
  check('оба свернули: мир стоит', (a.state as any).tick === ta && players(a).get(a.sessionId)?.away === true);
  a.send('away', false);
  await sleep(500);
  check('один вернулся: мир идёт', (a.state as any).tick > ta);
  b.send('away', false);

  // 6. B обрывается без согласия (как iOS в фоне), затем возвращается по токену
  const token = b.reconnectionToken;
  b.connection.close(4999, 'simulated drop');
  await sleep(600);
  check('после обрыва место держится', players(a).get(b.sessionId)?.connected === false);
  const b2 = await new Client(URL).reconnect(token);
  await sleep(400);
  check('вернулся по токену тем же игроком', b2.sessionId === b.sessionId && players(a).get(b.sessionId)?.connected === true);

  // 7. B уходит насовсем: игра у A продолжается соло
  await b2.leave(true);
  await sleep(400);
  const t1 = (a.state as any).tick;
  await sleep(300);
  check('после ухода второго A играет соло', !players(a).has(b.sessionId) && (a.state as any).tick > t1);

  // 8. A оборвался: мир на паузе, пока он не вернётся
  const tokenA = a.reconnectionToken;
  a.connection.close(4999, 'simulated drop');
  await sleep(300);
  const a2 = await new Client(URL).reconnect(tokenA);
  a2.onMessage('ev', () => {});
  await sleep(1000);
  const tPause = (a2.state as any).tick;
  check('хост вернулся', players(a2).get(a2.sessionId)?.connected === true);

  // 9. Задержка: замер ping
  const ping = await new Promise<number>(res => a2.ping(ms => res(ms)));
  console.log(`     ping ${ping} мс, tick ${tPause}`);
  await a2.leave(true);

  console.log(failed ? `\n${failed} проверок не прошло` : '\nВсе проверки прошли');
  process.exit(failed ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
