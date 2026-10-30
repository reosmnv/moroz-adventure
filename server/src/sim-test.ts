// Сценарии боя Анастасии прямо на shared/sim, без сервера: `npm run test:sim`.
import { HERO_ID, KRIS_ID, NADYA_ID, ULT_MS, TICK_MS, addPlayer, createWorld, emptyInput, spawnEnemies, step, moveDurMs, hitTimesMs, CHAIN, HEAVY, STRIKES, RANGE_MULT, JUGGLE_MAX_MS, KILL_EXTEND_MS, type Input, type World } from '@bc/shared';

let failed = 0;
function check(name: string, ok: boolean, info = '') {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${info ? `  (${info})` : ''}`);
  if (!ok) failed++;
}

function setup(withBuddy = false, char = HERO_ID) {
  const w = createWorld(7);
  const p = addPlayer(w, 'h', char);
  p.x = 200; p.y = 200;
  if (withBuddy) { const b = addPlayer(w, 'b', 'b'); b.x = 300; b.y = 200; }
  return { w, p };
}
function dummy(w: World, id: string, dx: number, hp = 1000) {
  const p = w.players.h;
  w.enemies[id] = { id, x: p.x + dx, y: p.y, hp, maxHp: hp, facing: -1, anim: 'idle', animMs: 0, cdMs: 1e9 };
}
// n тиков, input() вызывается на каждом тике (кнопки одноразовые, как в GameRoom)
function run(w: World, ms: number, input: (t: number) => Partial<Input> = () => ({})) {
  const log: string[] = [];
  const hits: number[] = [];
  const events: string[] = [];
  for (let t = 0; t < ms; t += TICK_MS) {
    const inp = { ...emptyInput(), ...input(t) };
    const ev = step(w, { h: inp });
    hits.push(...ev.filter(e => e.t === 'hit').map(e => (e as any).dmg));
    events.push(...ev.map(e => e.t === 'taunt' ? 'taunt:' + e.line : e.t));
    const m = w.players.h.move;
    if (log[log.length - 1] !== m) log.push(m);
  }
  return { log, hits, events };
}
const press = (at: number[], key: 'attack' | 'heavy' | 'ult' | 'ult2' | 'taunt') => (t: number) => (at.some(a => t >= a && t < a + TICK_MS) ? { [key]: true } : {});

// 1–2. Независимые цепочки, обе формы; A не меняет следующий B и наоборот.
for (const form of ['prime', 'ultimate'] as const) {
  for (const key of ['attack', 'heavy'] as const) {
    const { w, p } = setup(); dummy(w, 'e1', 800);
    p.form = form; p.formMs = ULT_MS;
    const moves: string[] = [];
    for (let i = 0; i < 3; i++) {
      const r = run(w, moveDurMs(form, (key === 'attack' ? CHAIN : HEAVY)[form][i], 1) + 100, press([0], key));
      moves.push(r.log[0]);
    }
    const expected = form === 'prime' ? (key === 'attack' ? ['superman', 'highkick', 'teep'] : ['uppercut', 'cross', 'slam']) : (key === 'attack' ? ['flying-knee', 'elbow', 'roundhouse'] : ['spin-elbow', 'knee', 'hurricane']);
    check(`${form}: ${key} x3`, moves.join() === expected.join(), moves.join('>'));
  }
  const { w, p } = setup(); dummy(w, 'e1', 800); p.form = form; p.formMs = ULT_MS;
  run(w, moveDurMs(form, CHAIN[form][0], 1) + 30, press([0], 'attack'));
  run(w, moveDurMs(form, HEAVY[form][0], 1) + 30, press([0], 'heavy'));
  check(`${form}: B не сбрасывает A`, p.combo === 1 && p.bCombo === 1);
  check(`${form}: A2 после B1`, run(w, 50, press([0], 'attack')).log[0] === CHAIN[form][1]);
}
// 3. Очередь: нажатие во время удара не теряется
{
  const { w } = setup(); dummy(w, 'e1', 24);
  const { log } = run(w, 2000, press([0, 50, 600], 'attack'));
  check('очередь ударов', log.slice(0, 3).join() === 'superman,highkick,teep', log.join('>'));
}
// 4. Удар по кадру: урон не раньше кадра hit
{
  const { w } = setup(); dummy(w, 'e1', 24);
  const { hits } = run(w, 120, press([0], 'attack')); // jab: кадр 4 при 18 fps x1.4 = 159 мс
  check('урон не раньше кадра удара', hits.length === 0, `за 150 мс попаданий ${hits.length}`);
  const r2 = run(w, 300);
  check('урон приходит в кадре удара', r2.hits.length === 1);
}
// 5. Hurricane бьёт три раза, враг сбит B-ударом
{
  const { w, p } = setup(); dummy(w, 'e1', 24);
  p.form = 'ultimate'; p.formMs = ULT_MS; p.bCombo = 2; p.bComboMs = 700;
  const { hits } = run(w, 2000, press([0], 'heavy'));
  check('hurricane: 3 попадания', hits.length === 3 && hits.join() === '30,30,45', hits.join());
  const { w: w2 } = setup(); dummy(w2, 'e1', 24);
  run(w2, 600, press([0], 'heavy'));
  check('uppercut сбивает врага с ног', w2.enemies.e1.anim === 'down');
}
// 6. Ульта: превращение, неуязвимость, 8 секунд, обратно
{
  const { w, p } = setup(); dummy(w, 'e1', 24);
  p.ult = 100;
  const { log } = run(w, 400, press([0], 'ult'));
  check('ульта запускает превращение', log.includes('transform-up') && p.invulnMs > 0 && p.ult === 0, log.join('>'));
  run(w, 1000);
  check('после превращения Ultimate', p.form === 'ultimate' && p.formMs > ULT_MS - 1500, `${p.form} ${p.formMs}`);
  check('в Ultimate серия другая', run(w, 600, press([0], 'attack')).log.includes('flying-knee'));
  run(w, ULT_MS - 1500);
  const r = run(w, 1500);
  check('Ultimate кончается обратным превращением', r.log.includes('transform-down'), r.log.join('>'));
  run(w, 1500);
  check('снова Prime', p.form === 'prime' && p.formMs === 0, p.form);
  p.ult = 100;
  check('шкала не копится в Ultimate', (() => { p.form = 'ultimate'; p.ult = 0; dummy(w, 'e2', 24); run(w, 600, press([0], 'attack')); return p.ult === 0; })());
}
// 7. Урон по героине: hurt, неуязвимость после удара, падение, подъём
{
  const { w, p } = setup(true);
  w.enemies.e1 = { id: 'e1', x: p.x + 24, y: p.y, hp: 100, maxHp: 100, facing: -1, anim: 'idle', animMs: 0, cdMs: 0 };
  const { log } = run(w, 400);
  check('удар врага: hurt', log.includes('hurt') && p.hp === 143, `${log.join('>')} hp ${p.hp}`);
  check('после удара неуязвима', p.invulnMs > 0);
  w.enemies.e1.cdMs = 0; w.enemies.e1.anim = 'idle'; w.enemies.e1.animMs = 0;
  p.hp = 5; p.invulnMs = 0;
  const r = run(w, 800);
  check('hp 0: fall', p.hp === 0 && r.log.includes('fall'), r.log.join('>'));
  delete w.enemies.e1; w.enemies.e9 = { id: 'e9', x: 900, y: 200, hp: 100, maxHp: 100, facing: -1, anim: 'idle', animMs: 0, cdMs: 1e9 };
  const r2 = run(w, 6000);
  check('друг жив: подъём getup', p.hp > 0 && r2.log.includes('getup'), `hp ${p.hp} ${r2.log.join('>')}`);
}
// 8. Бег, иммунитет Ultimate, нокдаун только от сильных ударов
{
  const { w, p } = setup(); dummy(w, 'e1', 600);
  const x0 = p.x;
  run(w, 1000, () => ({ mx: 1, run: false }));
  const walked = p.x - x0;
  const x1 = p.x;
  const r = run(w, 1000, () => ({ mx: 1, run: true }));
  check('бег быстрее ходьбы и играет dash', p.x - x1 > walked * 1.5 && r.log.includes('dash'), `${Math.round(walked)} vs ${Math.round(p.x - x1)}`);
}
{
  const { w, p } = setup(); dummy(w, 'e1', 24);
  for (const k of ['attack', 'attack', 'attack'] as const) { run(w, 200, press([0], k)); run(w, 500); p.comboMs = 700; }
  check('удары серии A не сбивают с ног', w.enemies.e1.anim !== 'down', w.enemies.e1.anim);
  w.enemies.e1.anim = 'idle'; w.enemies.e1.animMs = 0; p.combo = 0; p.bCombo = 2; p.bComboMs = 700; run(w, 100);
  w.enemies.e1.x = p.x + 30;
  run(w, 400, press([0], 'heavy'));
  check('B сбивает с ног', (w.enemies.e1.anim as string) === 'down');
}
{
  const { w, p } = setup();
  w.enemies.e1 = { id: 'e1', x: p.x + 34, y: p.y, hp: 100, maxHp: 100, facing: -1, anim: 'idle', animMs: 0, cdMs: 0 };
  p.form = 'ultimate'; p.formMs = ULT_MS;
  const r = run(w, 600);
  check('Ultimate: урон идёт, но без hurt', p.hp < 150 && !r.log.includes('hurt'), `hp ${p.hp} ${r.log.join('>')}`);
}
{
  const dist = (form: 'prime' | 'ultimate') => {
    const { w, p } = setup(); dummy(w, 'e1', 24);
    p.form = form; p.formMs = ULT_MS;
    p.move = form === 'prime' ? 'highkick' : 'roundhouse'; p.moveT = -1;
    run(w, hitTimesMs(form, p.move, 1)[0] + 350);
    return w.enemies.e1.x - (200 + 24);
  };
  const a = dist('prime'), b = dist('ultimate');
  check('отбрасывание учитывает множитель формы', a > 40 && b > 40, `${Math.round(a)} и ${Math.round(b)}`);
}
{
  const { w } = setup(); dummy(w, 'e1', 24);
  const frames: number[] = [];
  for (let t = 0; t < 600; t += TICK_MS) { step(w, { h: { ...emptyInput(), attack: t === 0 } }); frames.push(w.players.h.moveT); }
  check('хитстоп замораживает анимацию', frames.some((v, i) => i > 0 && v === frames[i - 1]));
}
// 9. Тестовый режим: манекен, кнопка «+3 врага», ульта отбрасывает всех
{
  const w = createWorld(3, true);
  const p = addPlayer(w, 'h', HERO_ID); p.x = 300; p.y = 205;
  step(w, { h: emptyInput() });
  const d = Object.values(w.enemies);
  check('в тесте один манекен, волн нет', d.length === 1 && !!d[0].dummy && w.wave === 0);
  d[0].hp = 1; run(w, 100, press([0], 'attack'));
  check('манекен не умирает', Object.values(w.enemies).some(e => e.dummy && e.hp > 0));
  spawnEnemies(w, 3);
  check('кнопка: +3 врага', Object.keys(w.enemies).length === 4);
}
{
  const { w, p } = setup();
  w.enemies.a = { id: 'a', x: 20, y: 160, hp: 100, maxHp: 100, facing: 1, anim: 'idle', animMs: 0, cdMs: 1e9 };
  w.enemies.b = { id: 'b', x: 460, y: 250, hp: 100, maxHp: 100, facing: -1, anim: 'idle', animMs: 0, cdMs: 1e9 };
  p.ult = 100;
  run(w, 50, press([0], 'ult'));
  check('ульта отбрасывает всех врагов', w.enemies.a.x < 20 && w.enemies.b.x > 460 && (w.enemies.a.anim as string) === 'down', `${Math.round(w.enemies.a.x)} ${Math.round(w.enemies.b.x)}`);
}
{
  const { w, p } = setup(); dummy(w, 'e1', 24);
  p.bCombo = 0; p.bComboMs = 700;
  run(w, 400, press([0], 'heavy'));
  check('апперкот подбрасывает врага', (w.enemies.e1.air ?? 0) > 0 && (w.enemies.e1.anim as string) === 'down', `air ${w.enemies.e1.air}`);
  const { w: w2 } = setup(); dummy(w2, 'e1', 24);
  run(w2, 400, press([0], 'attack'));
  check('суперман не подбрасывает', !w2.enemies.e1.air);
}
{
  const { w, p } = setup(); dummy(w, 'e1', 24);
  p.form = 'ultimate'; p.formMs = ULT_MS; p.hp = 100;
  run(w, 600, press([0], 'attack')); // elbow: 15 урона
  check('Ultimate лечит на нанесённый урон', p.hp === 135, `hp ${p.hp}`);
  const { w: w2, p: p2 } = setup(); dummy(w2, 'e1', 24);
  p2.hp = 100; run(w2, 600, press([0], 'attack'));
  check('Prime не лечит', p2.hp === 100);
  const { w: w3, p: p3 } = setup(); dummy(w3, 'e1', 24);
  p3.form = 'ultimate'; p3.formMs = ULT_MS; p3.hp = 145; run(w3, 600, press([0], 'attack'));
  check('лечение не выше максимума', p3.hp === 150, `hp ${p3.hp}`);
  const { w: w4 } = setup(); dummy(w4, 'e1', 66); // джеб 52 x1.3 = 67.6
  run(w4, 600, press([0], 'attack'));
  check('дальность ударов +30%', (w4.enemies.e1.hp as number) < 1000);
}
// 10. Снежная буря
{
  const { w, p } = setup();
  w.enemies.a = { id: 'a', x: 200 + 100, y: 200, hp: 50, maxHp: 50, facing: -1, anim: 'walk', animMs: 0, cdMs: 0 };
  w.enemies.b = { id: 'b', x: 200 + 420, y: 200, hp: 50, maxHp: 50, facing: -1, anim: 'walk', animMs: 0, cdMs: 0 };
  p.ult = 100;
  run(w, 100, press([0], 'ult2'));
  check('буря тратит заряд и замораживает врага в зоне', p.ult === 0 && (w.enemies.a.frozenMs ?? 0) > 0 && !w.enemies.b.frozenMs, `a=${w.enemies.a.frozenMs} b=${w.enemies.b.frozenMs}`);
  check('враг вне зоны не пострадал', w.enemies.b.hp === 50);
  const ax = w.enemies.a.x;
  run(w, 2800);
  check('замороженный не двигается и не бьёт', w.enemies.a.x === ax && p.hp === 150, `x ${ax}->${w.enemies.a.x} hp ${p.hp}`);
  run(w, 500);
  check('6 тиков по 1 урону за 3 секунды', w.enemies.a.hp === 44, `hp ${w.enemies.a.hp}`);
  check('буря кончилась, враг оттаял и пошёл', !w.enemies.a.frozenMs && p.stormMs === 0);
}
{
  const { w, p } = setup(); dummy(w, 'e1', 24);
  w.enemies.e1.frozenMs = 5000;
  const x0 = w.enemies.e1.x;
  run(w, 600, press([0], 'attack'));
  check('замороженный получает урон без отбрасывания', w.enemies.e1.hp < 1000 && w.enemies.e1.x === x0);
}
{
  const { w, p } = setup(); p.ult = 50;
  run(w, 100, press([0], 'ult2'));
  check('без полной шкалы буря не запускается', p.stormMs === 0 && p.ult === 50);
}

// ---------- ТЗ-02: механики ----------
// Удар задан явно, чтобы проверять физику независимо от окон ввода цепочек.
function strikeAt(w: World, move: string) {
  const p = w.players.h; p.move = move; p.moveT = -1; p.hitstopMs = 0; p.approach = undefined;
  return run(w, hitTimesMs(p.form, move, p.facing)[0] + TICK_MS * 2);
}
{
  const { w, p } = setup(); dummy(w, 'one', 30); dummy(w, 'two', 40); dummy(w, 'side', 35); dummy(w, 'back', -30);
  w.enemies.two.y += 40; w.enemies.side.y += 41;
  for (const e of Object.values(w.enemies)) e.stunMs = 10000;
  const r = strikeAt(w, 'cross');
  check('сектор: несколько врагов, глубина 40, не за спиной', r.hits.length === 2 && w.enemies.side.hp === 1000 && w.enemies.back.hp === 1000, r.hits.join());
}
for (const extra of [40, 120]) {
  const { w, p } = setup();
  const range = STRIKES.prime.cross.range * RANGE_MULT;
  dummy(w, 'e1', range + extra); w.enemies.e1.y += 20; w.enemies.e1.stunMs = 10000;
  p.bCombo = 1; p.bComboMs = 700;
  const r = run(w, 400, press([0], 'heavy'));
  check(`магнит: +${extra}`, extra === 40 ? p.x > 230 && p.x < w.enemies.e1.x && p.y === 220 && r.hits.length === 1 : p.x === 200 && p.y === 200 && r.hits.length === 0, `x=${p.x} y=${p.y}`);
}
{
  const { w, p } = setup(); dummy(w, 'one', 30); dummy(w, 'two', 80); dummy(w, 'back', -30);
  const r = run(w, 400, press([0], 'attack'));
  check('врыв: 110, урон всем на пути', p.x === 310 && w.enemies.one.hp < 1000 && w.enemies.two.hp < 1000 && w.enemies.back.hp === 1000, `x=${p.x} hits=${r.hits}`);
  const { w: empty, p: ep } = setup(); dummy(empty, 'back', -100);
  run(empty, 400, press([0], 'attack'));
  check('врыв без врагов впереди на месте', ep.x === 200);
}
{
  const { w, p } = setup(); dummy(w, 'e1', 30);
  strikeAt(w, 'uppercut');
  const first = strikeAt(w, 'cross'); const second = strikeAt(w, 'cross');
  const e = w.enemies.e1;
  check('подброс и два удара: ещё в воздухе, высота в sim', (e.air ?? 0) > 0 && (e.height ?? 0) > 0 && e.airHits === 2);
  check('урон в воздухе растёт, заряд x1.5', first.hits[0] === 7 * 1.25 && second.hits[0] === 7 * 1.35 && Math.abs(p.ult - (25 + (7 * 1.25 + 7 * 1.35) * 1.5)) < 0.001);
  const slam = strikeAt(w, 'slam');
  check('slam: x1.5 и короткий отскок', slam.hits[0] === 37.5 && e.bouncing === true && (e.air ?? 0) <= 250 && e.anim === 'down');
  run(w, 300); check('slam: отскок кончился, враг лежит', !e.air && e.height === 0 && e.anim === 'down');
}
{
  const { w } = setup(); dummy(w, 'e1', 30); strikeAt(w, 'uppercut');
  const e = w.enemies.e1;
  for (let i = 0; i < 30; i++) strikeAt(w, 'cross');
  check('воздух ограничен 3500 мс', !e.air && e.height === 0);
}
{
  const { w, p } = setup(); dummy(w, 'e1', 30); strikeAt(w, 'uppercut');
  w.enemies.e1.airTotal = JUGGLE_MAX_MS - TICK_MS; w.enemies.e1.cdMs = 0;
  run(w, TICK_MS); check('принудительное падение на лимите', !w.enemies.e1.air && w.enemies.e1.anim === 'down');
  check('счётчик в sim', p.hitCount === 1);
  run(w, 1600); check('счётчик сброшен через 1.5 с', p.hitCount === 0);
}
{
  const { w, p } = setup(); dummy(w, 'e1', 30);
  p.form = 'ultimate'; p.formMs = ULT_MS;
  strikeAt(w, 'spin-elbow');
  p.move = 'hurricane'; p.moveT = -1; p.hitstopMs = 0;
  const r = run(w, hitTimesMs('ultimate', 'hurricane', 1).at(-1)! + 250);
  check('hurricane: воздушные попадания и последнее вбивает', r.hits.length === 3 && r.hits[0] === 37.5 && r.hits[1] === 40.5 && r.hits[2] === 45 && w.enemies.e1.bouncing === true, r.hits.join());
}
{
  const { w, p } = setup();
  for (let i = 0; i < 5; i++) dummy(w, 'e' + i, 20 + i * 4);
  strikeAt(w, 'cross'); check('пять попаданий по толпе = 5 HITS', p.hitCount === 5);
}
{
  const { w, p } = setup(); dummy(w, 'e1', 34); strikeAt(w, 'uppercut');
  const e = w.enemies.e1, x = e.x, y = e.y, hp = p.hp;
  e.cdMs = 0; e.animMs = 0;
  run(w, 200);
  check('в воздухе враг не ходит и не бьёт', e.x === x && e.y === y && p.hp === hp);
}
{
  const { w, p } = setup(); dummy(w, 'e1', 34); w.enemies.e1.cdMs = 0;
  run(w, 100, press([0], 'attack'));
  check('врыв: неуязвимость в замахе', p.hp === 150 && p.invulnMs > 0);
}
{
  const { w } = setup(); dummy(w, 'e1', 30); strikeAt(w, 'uppercut');
  const hits: number[] = [];
  for (let i = 0; i < 8; i++) hits.push(...strikeAt(w, 'cross').hits);
  check('воздушный множитель ограничен 1.75', hits.at(-1) === 7 * 1.75 && hits.at(-2) === 7 * 1.75, hits.join());
}
for (const char of [HERO_ID, NADYA_ID, KRIS_ID]) {
  const { w, p } = setup(false, char); dummy(w, 'one', 70); dummy(w, 'two', 110);
  w.enemies.one.stunMs = 10000; w.enemies.two.stunMs = 10000;
  const move = char === HERO_ID ? 'teep' : 'a3';
  let hits: number[];
  if (char === KRIS_ID) {
    w.pending.push({ ms: 0, kind: 'hits', owner: p.id, strike: STRIKES.kris.ball, ids: ['one'] });
    hits = run(w, 350).hits;
  } else hits = [...strikeAt(w, move).hits, ...run(w, 350).hits];
  check(`${char}: кегля задевает второго один раз`, hits.filter(h => h === 5).length === 1 && w.enemies.two.hp === 995, hits.join());
}
{
  const { w, p } = setup(); dummy(w, 'e1', 30, 1); p.form = 'ultimate'; p.formMs = 4000;
  const { w: control, p: cp } = setup(); dummy(control, 'e1', 30); cp.form = 'ultimate'; cp.formMs = 4000;
  strikeAt(w, 'elbow'); strikeAt(control, 'elbow');
  check('кураж: убийство +500 мс', p.formMs - cp.formMs === KILL_EXTEND_MS, `${p.formMs} vs ${cp.formMs}`);
  p.ultimateExtraMs = ULT_MS; dummy(w, 'e2', 30, 1);
  const b = p.formMs; strikeAt(w, 'elbow');
  check('кураж: не больше исходной длительности сверху', p.formMs < b && p.ultimateExtraMs === ULT_MS);
}

// ---------- Надя ----------
{
  const { w } = setup(false, NADYA_ID); dummy(w, 'e1', 30);
  const { log, hits } = run(w, 3000, press([0, 300, 700], 'attack'));
  check('Надя: серия A a1 > a2 > a3', log.slice(0, 3).join() === 'a1,a2,a3', log.join('>'));
  check('Надя: урон A 4, 5, 6', hits.slice(0, 3).join() === '4,5,6', hits.join());
}
{
  const { w, p } = setup(false, NADYA_ID); dummy(w, 'e1', 30);
  run(w, 400, press([0], 'heavy'));
  const e = w.enemies.e1;
  check('Надя: пощёчина замедляет на 50%', (e.slowMs ?? 0) > 1000 && e.slow === 0.5, `slow ${e.slowMs} ${e.slow}`);
  check('Надя: контроль копит ульту быстрее (5 урона + 5)', p.ult === 10, `ult ${p.ult}`);
}
{
  const { w } = setup(false, NADYA_ID); dummy(w, 'e1', 30); dummy(w, 'e2', 45);
  run(w, 300, press([0], 'heavy')); run(w, 500, press([0], 'heavy'));
  check('Надя: по яйцам оглушает одного ближайшего', (w.enemies.e1.stunMs ?? 0) > 1000 && !w.enemies.e2.stunMs, `${w.enemies.e1.stunMs} ${w.enemies.e2.stunMs}`);
}
{
  const { w, p } = setup(false, NADYA_ID); dummy(w, 'e1', 100);
  p.bCombo = 2; p.bComboMs = 1000;
  const x0 = p.x;
  const r = run(w, 1700, press([0], 'heavy'));
  check('Надя: самурай = достаёт меч > рывок > финал', r.log.join('>').includes('b3-draw>b3-dash>b3-end'), r.log.join('>'));
  check('Надя: рывок на ~160', Math.abs(p.x - x0 - 160) < 5, `${p.x - x0}`);
  check('Надя: враг на пути получил 10 после рывка', r.hits.includes(10) && (w.enemies.e1.slowMs ?? 0) > 0, r.hits.join());
}
{
  const { w, p } = setup(false, NADYA_ID); dummy(w, 'e1', 50); dummy(w, 'e2', 80);
  w.enemies.e1.cdMs = 0; w.enemies.e2.cdMs = 0;
  p.ult = 100;
  const r = run(w, 3000, press([0], 'ult'));
  check('Надя: ульта = ревность у задетых', (w.enemies.e1.charmMs ?? 0) > 0 && (w.enemies.e2.charmMs ?? 0) > 0);
  check('Надя: ревнивые бьют друг друга, героиня цела', p.hp === 150 && r.hits.filter(h => h === 4).length >= 1, `hp ${p.hp} ${r.hits.join()}`);
  check('Надя: «Мальчики, не ссорьтесь» один раз', r.events.filter(e => e.includes('не ссорьтесь')).length === 1);
}
{
  // Поцелуй летит, а не взрывается: дальний враг ревнует позже ближнего, вне полосы и позади не задевает, урона нет
  const { w, p } = setup(false, NADYA_ID); dummy(w, 'near', 60); dummy(w, 'far', 700); dummy(w, 'side', 300); dummy(w, 'back', -60);
  w.enemies.side.y = p.y + 70;
  p.ult = 100;
  const r1 = run(w, 800, press([0], 'ult'));
  check('Надя: поцелуй задел ближнего, до дальнего ещё летит', (w.enemies.near.charmMs ?? 0) > 0 && !w.enemies.far.charmMs && w.pending.some(d => d.kind === 'kiss'), `${w.enemies.near.charmMs} ${w.enemies.far.charmMs}`);
  check('Надя: поцелуй без урона и без взрыва', !r1.hits.includes(10) && !r1.events.includes('boom') && r1.events.includes('kiss'), r1.events.join());
  run(w, 3500);
  check('Надя: поцелуй долетел до дальнего (скорость 200)', (w.enemies.far.charmMs ?? 0) > 0);
  check('Надя: вне полосы и за спиной не ревнуют', !w.enemies.side.charmMs && !w.enemies.back.charmMs);
  run(w, 8000);
  check('Надя: поцелуй исчез у края уровня', !w.pending.some(d => d.kind === 'kiss'));
}
// ---------- Kris ----------
{
  const { w } = setup(false, KRIS_ID); dummy(w, 'e1', 30);
  const { log } = run(w, 2500, press([0, 300, 600, 900], 'attack'));
  check('Kris: серия A из двух, a1 > a2 > a1', log.slice(0, 3).join() === 'a1,a2,a1' && !log.includes('a3'), log.join('>'));
}
{
  const { w } = setup(false, KRIS_ID); dummy(w, 'e1', 200);
  const r = run(w, 1200, t => (Math.floor(t / TICK_MS) % 3 === 0 ? { heavy: true } : {}));
  const shots = r.events.filter(e => e === 'shot').length;
  check('Kris: темп вспышки вдвое выше (4 за 1,2 с)', shots === 4, `${shots}`);
}
{
  const { w } = setup(false, KRIS_ID); dummy(w, 'e1', 200);
  const r0 = run(w, 250, press([0, 50, 100], 'heavy'));
  check('Kris: пауза между вспышками', r0.events.filter(e => e === 'shot').length === 1, r0.events.join());
  const { w: w2, p: p2 } = setup(false, KRIS_ID); dummy(w2, 'e1', 200);
  const r = run(w2, 1500, press([0], 'heavy'));
  check('Kris: вспышка долетает до врага (4 урона)', r.hits.join() === '4', r.hits.join());
  check('Kris: шкала шара +12.5', p2.charge2 === 12.5, `${p2.charge2}`);
}
{
  const { w, p } = setup(true, KRIS_ID);
  w.players.b.char = HERO_ID; w.players.b.x = 260; w.players.b.facing = 1;
  dummy(w, 'e1', 100);
  p.charge2 = 100;
  const r = run(w, 1500, press([0], 'ult2'));
  check('Kris: шар у Анастасии, взрыв 20 и реплика', r.hits.includes(20) && r.events.includes('boom') && r.events.some(e => e.startsWith('taunt:')), r.events.join());
  check('Kris: шкала шара потрачена', p.charge2 === 0);
}
const ballAt = (w: World) => {
  let at: any;
  for (let t = 0; t < 600 && !at; t += TICK_MS) at = step(w, { h: { ...emptyInput(), ult2: t === 0 } }).find(e => e.t === 'ball');
  return at;
};
{
  // Без Анастасии: в самое плотное скопление, а не просто перед собой
  const { w, p } = setup(false, KRIS_ID);
  dummy(w, 'e1', 60); dummy(w, 'c1', 220); dummy(w, 'c2', 240); dummy(w, 'c3', 250);
  p.charge2 = 100;
  const b = ballAt(w);
  check('Kris: шар летит в скопление из трёх', b && Math.abs(b.tx - (p.x + 237)) < 15, b ? `${b.tx - p.x}` : 'нет броска');
}
{
  // С Анастасией: враги у неё в приоритете, даже если скопление больше в другом месте
  const { w, p } = setup(true, KRIS_ID);
  w.players.b.char = HERO_ID; w.players.b.x = p.x - 150; w.players.b.facing = -1;
  dummy(w, 'n1', -220); dummy(w, 'c1', 200); dummy(w, 'c2', 220); dummy(w, 'c3', 230);
  p.charge2 = 100;
  const b = ballAt(w);
  check('Kris: шар в врагов рядом с Анастасией', b && Math.abs(b.tx - (p.x - 220)) < 15, b ? `${b.tx - p.x}` : 'нет броска');
}
{
  // Анастасия далеко, рядом с ней врагов нет: шар всё равно к ней, а не в скопление у Kris
  const { w, p } = setup(true, KRIS_ID);
  w.players.b.char = HERO_ID; w.players.b.x = p.x + 900; w.players.b.facing = 1;
  dummy(w, 'c1', 200); dummy(w, 'c2', 220);
  p.charge2 = 100;
  const b = ballAt(w);
  check('Kris: шар к далёкой Анастасии', b && Math.abs(b.tx - (p.x + 940)) < 5, b ? `${b.tx - p.x}` : 'нет броска');
}
{
  const { w, p } = setup(false, KRIS_ID); dummy(w, 'e1', 300);
  p.ult = 100;
  const r = run(w, 4000, press([0], 'ult'));
  check('Kris: ульта ставит камеру > стоит > убирает', r.log.join('>').includes('ult-setup>ult-hold>ult-out'), r.log.join('>'));
  check('Kris: прицел, затем луч 40 по дальнему врагу', r.events.indexOf('aim') < r.events.indexOf('beam') && r.hits.includes(40), r.events.join());
}
check('длительности из данных (x1.4)', moveDurMs('prime', 'jab', 1) > 300 && moveDurMs('prime', 'jab', 1) < 400);

console.log(failed ? `\n${failed} проверок не прошло` : '\nВсе проверки прошли');
process.exit(failed ? 1 : 0);
