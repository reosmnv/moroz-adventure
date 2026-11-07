// Сетевые сценарии без браузера: два бота на @colyseus/sdk против живого сервера.
// Запуск: node --import tsx server/src/net-test-server.ts, затем этот файл.
import { STORY_SCENES, STORY_CONTENT } from '@bc/shared';
import { Client, type Room } from '@colyseus/sdk';

const URL = process.env.SERVER_URL ?? 'http://127.0.0.1:2568';
if (URL !== 'http://127.0.0.1:2568') throw new Error('net-test требует отдельную фикстуру на http://127.0.0.1:2568');
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
let failed = 0;
function check(name: string, ok: boolean, info = '') {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${info ? `  (${info})` : ''}`);
  if (!ok) failed++;
}
const players = (r: Room) => (r.state as any).players as Map<string, any>;

async function testStoryFlow() {
  const a = await new Client(URL).create('game', { level: 'route' });
  a.reconnection.enabled = false; a.onMessage('ev', () => {});
  a.send('pick', 'anastasia'); await sleep(350);
  const first = a.state as any;
  check('TZ21 титры стартуют без команды', first.storyScene === 'prologue' && first.storyIndex === 0);
  a.send('pause', true); await sleep(200);
  await sleep(2600);
  check('A1.6 пауза останавливает титр', first.paused && first.storyIndex === 0);
  a.send('pause', false); a.send('away', true); await sleep(200);
  await sleep(2600);
  check('A1.6 без активных сюжет не тикает', first.storyIndex === 0 && first.storyHost === '');
  a.send('away', false); await sleep(150);
  check('A1.1 вернувшийся берёт свободное ведение', first.storyHost === a.sessionId);
  a.send('storyNext', 'prologue:0'); await sleep(100);
  check('TZ21 тап не пропускает титр', first.storyIndex === 0);
  await sleep(Math.max(2200, 55 * STORY_CONTENT['title.1'].length));
  const indices = STORY_SCENES.find(s => s.id === 'prologue')!.steps.flatMap((step, i) => step.kind === 'card' || step.kind === 'phone' || step.kind === 'line' ? [i] : []);
  check('V3 пролог виден ведущему', first.storyScene === 'prologue' && first.storyIndex === indices[0] && first.storyHost === a.sessionId);
  const b = await new Client(URL).joinById(a.roomId);
  b.reconnection.enabled = false; b.onMessage('ev', () => {});
  b.send('pick', 'nadezhda'); await sleep(300);
  b.send('storyNext', `prologue:${indices[0]}`); await sleep(150);
  check('V3 гость не продолжает за ведущего', (a.state as any).storyIndex === indices[0]);
  a.send('pause', true); await sleep(150);
  a.send('storyNext', `prologue:${indices[0]}`); await sleep(150);
  check('A1.6 ведущий не продвигает реплику на паузе', first.storyIndex === indices[0]);
  a.send('pause', false); a.send('away', true); await sleep(200);
  check('A1.1 away передаёт ведение активному гостю', first.storyHost === b.sessionId);
  a.send('storyNext', `prologue:${indices[0]}`); await sleep(150);
  check('A1.1 away-ведущий не продвигает реплику', first.storyIndex === indices[0]);
  b.send('storyNext', `prologue:${indices[0]}`); b.send('storyNext', `prologue:${indices[0]}`); await sleep(250);
  check('A1.1 второй продвигает реплику после away ведущего', first.storyIndex === indices[1]);
  a.send('away', false); await sleep(150);
  check('A1.1 возврат не отбирает ведение у активного', first.storyHost === b.sessionId);
  b.send('away', true); await sleep(150); b.send('away', false); await sleep(150);
  check('A1.1 неактивный ведущий уступает вернувшемуся', first.storyHost === a.sessionId);
  check('V3 повторный пакет не перескакивает шаг', (b.state as any).storyIndex === indices[1]);
  const token = a.reconnectionToken;
  a.connection.close(4999, 'story host drop'); await sleep(550);
  check('V3 ведущий перешёл следующему игроку', (b.state as any).storyHost === b.sessionId && (b.state as any).storyIndex === indices[1]);
  b.send('storyNext', `prologue:${indices[1]}`); await sleep(800);
  const a2 = await new Client(URL).reconnect(token);
  a2.reconnection.enabled = false; a2.onMessage('ev', () => {}); await sleep(300);
  check('V3 вернувшийся получает текущий шаг', (a2.state as any).storyScene === 'prologue' && (a2.state as any).storyIndex === indices[2]);
  await b.leave(true); await sleep(250);
  check('V3 право вернулось оставшемуся игроку', (a2.state as any).storyHost === a2.sessionId);
  a2.send('storyNext', `prologue:${indices[2]}`); await sleep(200);
  check('V3 продолжение после смены ведущего', (a2.state as any).storyIndex === indices[3]);
  for (let n = 0; n < 100 && (a2.state as any).storyScene; n++) {
    const state = a2.state as any;
    a2.send('storyNext', `${state.storyScene}:${state.storyIndex}`); await sleep(100);
  }
  check('C1 пролог заканчивается и возвращает управление', !(a2.state as any).storyScene && !players(a2).get(a2.sessionId)?.away);
  a2.send('pause', true); a2.send('switch', 'kris'); await sleep(200);
  check('TZ18 switch доступен в обычной комнате после пролога', players(a2).get(a2.sessionId)?.char === 'kris');
  await a2.leave(true);
}

// Держим замах общей паузой, чтобы время подключения не делало тест случайным.
async function testWarningReconnect() {
  const a = await new Client(URL).create('game', { level: 'route', stage: 4, testMode: true });
  a.reconnection.enabled = false;
  let warning = false;
  a.onMessage('ev', (events: any[]) => {
    if (!warning && events.some(e => e.t === 'tele' && e.shape && e.attack === 'vstayu')) {
      warning = true; a.send('pause', true);
    }
  });
  a.send('pick', 'anastasia'); await sleep(150);
  const b = await new Client(URL).joinById(a.roomId);
  b.reconnection.enabled = false; b.onMessage('ev', () => {});
  b.send('pick', 'nadezhda'); await sleep(150);
  a.send('testScene', { id: 'shaman', strict: false }); await sleep(200);
  a.send('god', true); b.send('god', true);
  for (let n = 0; n < 300 && !warning; n++) {
    const state = a.state as any;
    if (state.storyScene) a.send('storyNext', `${state.storyScene}:${state.storyIndex}`);
    await sleep(100);
  }
  check('A1.5 дождались замаха Шамана', warning);
  let b2: Room | undefined, c: Room | undefined;
  try {
    if (!warning) return;
    await sleep(150);
    const token = b.reconnectionToken;
    b.connection.close(4999, 'warning reconnect'); await sleep(250);
    b2 = await new Client(URL).reconnect(token); b2.reconnection.enabled = false;
    let restored: any[] = [];
    b2.onMessage('ev', (events: any[]) => { restored.push(...events); });
    await sleep(200);
    check('A1.5 reconnect получил tele с остатком времени', restored.some(e => e.t === 'tele' && e.attack === 'vstayu' && e.shape === 'ring' && e.ms > 0 && e.ms <= 900));
    c = await new Client(URL).joinById(a.roomId); c.reconnection.enabled = false;
    restored = [];
    c.onMessage('ev', (events: any[]) => { restored.push(...events); }); await sleep(200);
    check('A1.5 новый вход получил действующий tele', restored.some(e => e.t === 'tele' && e.attack === 'vstayu' && e.shape === 'ring' && e.ms > 0));
    restored = []; c.send('warnings', true); await sleep(150);
    check('A1.5 готовая сцена может повторно запросить tele', restored.some(e => e.t === 'tele' && e.attack === 'vstayu' && e.shape === 'ring' && e.ms > 0));
  } finally {
    if (c) await c.leave(true);
    if (b2) await b2.leave(true); else if (b.connection.isOpen) await b.leave(true);
    await a.leave(true);
  }
}

async function testNormalMode() {
  const r = await new Client(URL).create('game', { level: 'old', stage: 1 });
  r.reconnection.enabled = false; r.onMessage('ev', () => {});
  r.send('pause', true); r.send('pick', 'anastasia');
  await sleep(400);
  const s = () => r.state as any;
  check('TZ18 обычная комната: режим false по умолчанию, stage 0', s().testMode === false && s().stage === 0);
  check('C1 level old без testMode даёт route', s().level === 'route');
  const before = { enemies: s().enemies.size, ult: players(r).get(r.sessionId)?.ult, hp: players(r).get(r.sessionId)?.hp };
  for (const command of ['spawn', 'next', 'charge', 'heal', 'killall']) r.send(command);
  r.send('god', true); r.send('testScene', { id: 'arch', strict: false }); r.send('storyStrict', false); await sleep(400);
  check('TZ18 обычная комната отклоняет все тестовые команды', s().enemies.size === before.enemies && s().stage === 0 && !s().trans
    && players(r).get(r.sessionId)?.ult === before.ult && players(r).get(r.sessionId)?.hp === before.hp && players(r).get(r.sessionId)?.god === false);
  const guest = await new Client(URL).joinById(r.roomId, { testMode: true, stage: 1 });
  guest.reconnection.enabled = false; guest.onMessage('ev', () => {}); await sleep(200);
  check('TZ18 вход по коду не меняет обычный режим', (guest.state as any).testMode === false && (guest.state as any).stage === 0);
  await guest.leave(true); await r.leave(true);
  for (const testMode of ['true', 1]) {
    const invalid = await new Client(URL).create('game', { level: 'old', stage: 1, testMode });
    invalid.reconnection.enabled = false; invalid.onMessage('ev', () => {}); await sleep(200);
    check(`TZ18 testMode=${JSON.stringify(testMode)} не включает тест и old`, (invalid.state as any).testMode === false && (invalid.state as any).stage === 0 && (invalid.state as any).level === 'route');
    await invalid.leave(true);
  }
}

async function testStageAndTools() {
  const r = await new Client(URL).create('game', { testMode: true, stage: 2 });
  r.reconnection.enabled = false; r.onMessage('ev', () => {});
  r.send('pause', true); r.send('pick', 'anastasia'); await sleep(400);
  const s = () => r.state as any;
  check('TZ18 тестовая комната принимает stage', s().testMode === true && s().stage === 2);
  r.send('god', true); r.send('charge'); r.send('spawn'); await sleep(300);
  check('TZ18 тестовые god/charge/spawn', players(r).get(r.sessionId)?.god === true && players(r).get(r.sessionId)?.ult === 100 && s().enemies.size >= 3);
  r.send('god', 'false'); await sleep(200);
  check('TZ18 god принимает только boolean', players(r).get(r.sessionId)?.god === true);
  r.send('god', false); r.send('heal'); r.send('killall'); await sleep(300);
  check('TZ18 тестовые god(false)/heal/killall', players(r).get(r.sessionId)?.god === false && players(r).get(r.sessionId)?.hp === 150
    && [...s().enemies.values()].every((e: any) => e.hp === 0));
  r.send('next'); await sleep(200);
  check('TZ18 тестовый next', s().trans > 0);
  r.send('testScene', { id: 'arch', strict: true }); await sleep(300);
  check('TZ21 сервер запускает выбранную сцену и призывает героев', s().stage === 0 && s().storyScene === 'arch' && players(r).size === 4
    && [...players(r).values()].every((p: any) => p.x >= 1214 && p.x <= 1268 && p.god));
  const before = new Map([...players(r).entries()].map(([id, p]: [string, any]) => [id, p.x]));
  r.send('storyNext', `arch:${s().storyIndex}`); await sleep(250);
  check('TZ21 сцена онлайн сохраняет координаты', [...players(r).entries()].every(([id, p]: [string, any]) => p.x === before.get(id)));
  for (const scene of STORY_SCENES) {
    r.send('testScene', { id: scene.id, strict: true }); await sleep(180);
    const heroes = [...players(r).values()] as any[];
    const center = (Math.min(...heroes.map(p => p.x)) + Math.max(...heroes.map(p => p.x))) / 2;
    const viewX = Math.max(0, center - 300), viewW = 600;
    r.send('view', { x: viewX, width: viewW }); await sleep(80);
    check(`R1 ${scene.id}: четыре подключённых героя в кадре idle`, heroes.length === 4 && heroes.every(p => p.connected && !p.away && p.anim === 'idle' && p.move === 'idle' && p.x >= viewX && p.x <= viewX + viewW)
      && new Set(heroes.map(p => `${p.x}:${p.y}`)).size === 4);
  }
  r.send('testScene', { id: 'sender', strict: false }); await sleep(250);
  check('TZ21 повторный запуск другой сцены онлайн', s().stage === 6 && s().storyScene === 'sender' && s().actors.has('milonov'));
  await r.leave(true);
}

async function main() {
  await testStoryFlow();
  await testWarningReconnect();
  await testNormalMode();
  await testStageAndTools();
  // 1. Хост создаёт комнату и выбирает персонажа
  const a = await new Client(URL).create('game', { level: 'old', testMode: true });
  a.reconnection.enabled = false;
  a.onMessage('ev', () => {});
  check('комната создана, короткий код', /^[A-Z0-9]{5}$/.test(a.roomId), a.roomId);
  a.send('pick', 'anastasia');
  await sleep(400);
  check('хост в мире', players(a).has(a.sessionId));
  check('C1 level old доступен с testMode true', (a.state as any).level === 'old' && (a.state as any).testMode === true);
  const tick0 = (a.state as any).tick;
  await sleep(500);
  check('сервер тикает', (a.state as any).tick > tick0, `tick ${(a.state as any).tick}`);
  check('манекен на месте', (a.state as any).enemies.size > 0, `врагов ${(a.state as any).enemies.size}`);

  check('поля встреч в Schema', typeof (a.state as any).lockX0 === 'number' && typeof (a.state as any).encTotal === 'number');
  check('вид и фаза врагов в Schema', [...(a.state as any).enemies.values()].every((e: any) => typeof e.kind === 'string' && typeof e.phase === 'string'));

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
  b.onMessage('ev', () => {});
  await sleep(200);
  check('TZ18 второй клиент видит тестовый режим комнаты', (b.state as any).testMode === true);
  let pickError = '';
  b.onMessage('pickError', (m: string) => { pickError = m; });
  b.send('pick', 'anastasia');
  await sleep(300);
  check('нельзя взять занятого персонажа', pickError !== '' && !players(b).has(b.sessionId), pickError);
  b.send('pick', 'nadezhda');
  await sleep(400);
  const pa = players(a).get(a.sessionId), pb = players(a).get(b.sessionId);
  check('второй появился у хоста', !!pb);
  check('второй рядом с первым', !!pb && Math.abs(pb.x - pa.x) < 60, pb ? `dx ${Math.round(pb.x - pa.x)}` : '');

  // TZ18: смена при общей паузе, ошибки выбора и очистка накопленного ввода.
  let switchError = '', switchesA = 0, switchesB = 0;
  a.onMessage('pickError', (m: string) => { switchError = m; });
  a.onMessage('ev', (evs: any[]) => { switchesA += evs.filter(e => e.t === 'switch' && e.id === a.sessionId).length; });
  b.onMessage('ev', (evs: any[]) => { switchesB += evs.filter(e => e.t === 'switch' && e.id === a.sessionId).length; });
  a.send('pause', true); a.send('move', { mx: 1, my: 0 }); a.send('btn', 'attack'); a.send('switch', 'kris');
  await sleep(400);
  check('TZ18 switch меняет того же игрока у обоих', players(a).get(a.sessionId)?.char === 'kris' && players(b).get(a.sessionId)?.char === 'kris' && switchesA === 1 && switchesB === 1);
  a.send('pick', 'ramil'); await sleep(200);
  check('TZ18 повторный pick запрещён', players(a).get(a.sessionId)?.char === 'kris');
  a.send('switch', 'nadezhda'); await sleep(300);
  check('TZ18 switch занятого героя отклонён', switchError === 'Персонаж занят' && players(a).get(a.sessionId)?.char === 'kris' && switchesA === 1 && switchesB === 1);
  const switchedX = players(a).get(a.sessionId)?.x;
  a.send('pause', false); await sleep(250);
  check('TZ18 switch очищает движение и очередь кнопок', players(a).get(a.sessionId)?.x === switchedX && players(a).get(a.sessionId)?.move === 'idle');
  a.send('switch', 'anastasia'); await sleep(300);
  check('TZ18 обратная смена работает', players(a).get(a.sessionId)?.char === 'anastasia');

  // 4. Удар по врагу: урон считает сервер, событие приходит обоим
  let hits = 0;
  b.onMessage('ev', (evs: any[]) => { hits += evs.filter(e => e.t === 'hit').length; });
  // Тест-режим: вместо волн стоит манекен, идём к нему
  a.send('move', { mx: 1, my: 0 }); b.send('move', { mx: 1, my: 0 });
  await sleep(2600);
  a.send('move', { mx: 0, my: 0 }); b.send('move', { mx: 0, my: 0 });
  await sleep(200);
  for (let i = 0; i < 150 && hits === 0; i++) { a.send('btn', 'attack'); b.send('btn', 'attack'); await sleep(100); }
  check('события боя доходят', hits > 0, `hit-событий у B: ${hits}`);

  // 4a. Кнопка «+3 врага»
  const before = (a.state as any).enemies.size;
  a.send('spawn', true);
  await sleep(300);
  check('кнопка +3 врага работает', (a.state as any).enemies.size === before + 3, `${before} → ${(a.state as any).enemies.size}`);

  // 5. Третий и четвёртый входят, пятый — нет.
  const extra: Room[] = [];
  for (const char of ['kris', 'ramil']) {
    const r = await new Client(URL).joinById(a.roomId);
    r.reconnection.enabled = false; r.onMessage('ev', () => {});
    r.send('pick', char); await sleep(400);
    check(`${char}: вход`, players(a).has(r.sessionId));
    const x = players(a).get(r.sessionId)?.x;
    r.send('move', { mx: 1, my: 0 }); await sleep(500);
    r.send('move', { mx: 0, my: 0 }); await sleep(150);
    check(`${char}: движение`, players(a).get(r.sessionId)?.x > x + 20);
    if (char === 'ramil') {
      const initial = players(a).get(r.sessionId)?.ult ?? 0;
      r.send('smoke', true); await sleep(1000);
      const charged = players(a).get(r.sessionId)?.ult ?? 0;
      check('Рамиль: сетевое удержание перекура', charged >= initial + 17 && charged <= initial + 23, `${initial}->${charged}`);
      r.send('smoke', false); await sleep(250);
      const released = players(a).get(r.sessionId)?.ult ?? 0;
      await sleep(300);
      check('Рамиль: сетевое отпускание перекура', players(a).get(r.sessionId)?.ult === released);
    }
    extra.push(r);
  }
  let rejected = false;
  try { const fifth = await new Client(URL).joinById(a.roomId); await fifth.leave(true); } catch { rejected = true; }
  check('пятый игрок не входит', rejected);
  for (const r of extra) await r.leave(true);
  await sleep(300);

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
  b.send('pause', true); await sleep(200);
  const token = b.reconnectionToken;
  b.connection.close(4999, 'simulated drop');
  await sleep(600);
  check('TZ18 обрыв поставившего паузу снимает её', (a.state as any).paused === false && (a.state as any).pausedBy === '');
  check('после обрыва место держится', players(a).get(b.sessionId)?.connected === false);
  const b2 = await new Client(URL).reconnect(token);
  b2.onMessage('ev', () => {});
  await sleep(400);
  check('вернулся по токену тем же игроком', b2.sessionId === b.sessionId && players(a).get(b.sessionId)?.connected === true);

  // 7. B уходит насовсем: игра у A продолжается соло
  check('TZ18 режим сохраняется при reconnect', (b2.state as any).testMode === true);
  b2.send('pause', true); await sleep(200);
  await b2.leave(true);
  await sleep(400);
  check('TZ18 выход поставившего паузу снимает её', (a.state as any).paused === false && (a.state as any).pausedBy === '');
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
