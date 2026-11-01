// Сценарии боя Анастасии прямо на shared/sim, без сервера: `npm run test:sim`.
import { BOSS, BOSS_ATTACK, type BossId, ENEMY_INTRO, ENTER_OFF, HALT_MS, ROLE, ENCOUNTERS, LEVELS, stageOf, encountersOf, HERO_ID, KRIS_ID, NADYA_ID, ULT_MS, TICK_MS, addPlayer, createWorld, emptyInput, spawnEnemies, step, moveDurMs, hitTimesMs, CHAIN, HEAVY, STRIKES, FREEZE_MS, STORM_MS, RANGE_MULT, JUGGLE_MAX_MS, KILL_EXTEND_MS, type Input, type World } from '@bc/shared';

let failed = 0;
function check(name: string, ok: boolean, info = '') {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${info ? `  (${info})` : ''}`);
  if (!ok) failed++;
}

function setup(withBuddy = false, char = HERO_ID) {
  const w = createWorld(7, false, 'old');
  const p = addPlayer(w, 'h', char);
  p.x = 200; p.y = 200;
  if (withBuddy) { const b = addPlayer(w, 'b', 'b'); b.x = 300; b.y = 200; }
  return { w, p };
}
function dummy(w: World, id: string, dx: number, hp = 1000) {
  const p = w.players.h;
  w.enemies[id] = { kind: 'omon', phase: 'none', phaseMs: 0, id, x: p.x + dx, y: p.y, hp, maxHp: hp, facing: -1, anim: 'idle', animMs: 0, cdMs: 1e9 };
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
  w.enemies.e1 = { kind: 'omon', phase: 'none', phaseMs: 0, id: 'e1', x: p.x + 24, y: p.y, hp: 100, maxHp: 100, facing: -1, anim: 'idle', animMs: 0, cdMs: 0 };
  const { log } = run(w, 900);
  check('удар врага: hurt', log.includes('hurt') && p.hp === 143, `${log.join('>')} hp ${p.hp}`);
  check('после удара неуязвима', p.invulnMs > 0);
  w.enemies.e1.cdMs = 0; w.enemies.e1.anim = 'idle'; w.enemies.e1.animMs = 0; w.enemies.e1.phase = 'none'; w.enemies.e1.token = undefined;
  p.hp = 5; p.invulnMs = 0;
  const r = run(w, 800);
  check('hp 0: fall', p.hp === 0 && r.log.includes('fall'), r.log.join('>'));
  delete w.enemies.e1; w.enemies.e9 = { kind: 'omon', phase: 'none', phaseMs: 0, id: 'e9', x: 900, y: 200, hp: 100, maxHp: 100, facing: -1, anim: 'idle', animMs: 0, cdMs: 1e9 };
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
  w.enemies.e1.anim = 'idle'; w.enemies.e1.animMs = 0; w.enemies.e1.phase = 'none'; w.enemies.e1.token = undefined; p.combo = 0; p.bCombo = 2; p.bComboMs = 700; run(w, 100);
  w.enemies.e1.x = p.x + 30;
  run(w, 400, press([0], 'heavy'));
  check('B сбивает с ног', (w.enemies.e1.anim as string) === 'down');
}
{
  const { w, p } = setup();
  w.enemies.e1 = { kind: 'omon', phase: 'none', phaseMs: 0, id: 'e1', x: p.x + 34, y: p.y, hp: 100, maxHp: 100, facing: -1, anim: 'idle', animMs: 0, cdMs: 0 };
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
  const w = createWorld(3, true, 'old');
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
  w.enemies.a = { kind: 'omon', phase: 'none', phaseMs: 0, id: 'a', x: 20, y: 160, hp: 100, maxHp: 100, facing: 1, anim: 'idle', animMs: 0, cdMs: 1e9 };
  w.enemies.b = { kind: 'omon', phase: 'none', phaseMs: 0, id: 'b', x: 460, y: 250, hp: 100, maxHp: 100, facing: -1, anim: 'idle', animMs: 0, cdMs: 1e9 };
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
  w.enemies.a = { kind: 'omon', phase: 'none', phaseMs: 0, id: 'a', x: 200 + 100, y: 200, hp: 50, maxHp: 50, facing: -1, anim: 'walk', animMs: 0, cdMs: 0 };
  w.enemies.b = { kind: 'omon', phase: 'none', phaseMs: 0, id: 'b', x: 200 + 420, y: 200, hp: 50, maxHp: 50, facing: -1, anim: 'walk', animMs: 0, cdMs: 0 };
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
  check('Kris: серия A a1-back > a2 > hop', log.slice(0, 3).join() === 'a1-back,a2,hop', log.join('>'));
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
  check('Kris: шар в врагов рядом с Анастасией', b && Math.abs(b.tx - Math.max(20, p.x - 220)) < 15, b ? `${b.tx - p.x}` : 'нет броска');
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
// ТЗ-03: сектор штатива, точный отброс и безопасный отскок.
for (const combo of [0, 1]) {
  const { w, p } = setup(false, KRIS_ID); p.combo = combo; p.comboMs = 1000;
  for (const [id, dx, dy] of [['near', 40, 0], ['edge', 78, 40], ['back', -20, 0], ['far', 79, 0], ['outside', 40, 41]] as const) {
    dummy(w, id, dx); w.enemies[id].y += dy;
    w.enemies[id].slowMs = 10000; w.enemies[id].slow = 1;
  }
  run(w, TICK_MS, press([0], 'attack'));
  run(w, hitTimesMs('kris', CHAIN.kris[combo], 1)[0] + TICK_MS);
  check(`Kris A${combo + 1}: все в секторе оглушены`, ['near', 'edge'].every(id => (w.enemies[id].stunMs ?? 0) > 740));
  check(`Kris A${combo + 1}: вне сектора не задеты`, ['back', 'far', 'outside'].every(id => w.enemies[id].hp === 1000));
  check(`Kris A${combo + 1}: урон и отброс`, w.enemies.near.hp === 1000 - (combo ? 5 : 4) && Math.abs(w.enemies.near.x - (240 + (combo ? 30 : 0))) < 0.01);
}
for (const [x, facing] of [[200, 1], [15, 1], [1905, -1]] as const) {
  const { w, p } = setup(false, KRIS_ID); p.x = x; p.facing = facing; p.combo = 2; p.comboMs = 1000;
  dummy(w, 'attacker', facing * 34); w.enemies.attacker.cdMs = 0;
  const hp = p.hp;
  run(w, TICK_MS, press([0], 'attack'));
  run(w, 170, () => ({ mx: -facing, heavy: true, ult: true }));
  check(`Kris hop x=${x}: неуязвимость и взгляд`, p.hp === hp && p.invulnMs > 0 && p.move === 'hop' && p.facing === facing);
  run(w, 187);
  const expected = Math.max(20, Math.min(1900, x - facing * 120));
  check(`Kris hop x=${x}: приземление и край`, Math.abs(p.x - expected) < 0.01 && p.x >= 20 && p.x <= 1900, `${p.x}`);
}
{
  const { w, p } = setup(false, KRIS_ID); p.x = 800; p.combo = 2; p.comboMs = 1000;
  run(w, 400, press([0], 'attack'));
  check('Kris hop: не за левую границу стандартной камеры', p.x >= 800 - 480 * 0.33 && Math.abs(p.x - 680) < 0.01);
}
check('длительности из данных (x1.4)', moveDurMs('prime', 'jab', 1) > 300 && moveDurMs('prime', 'jab', 1) < 400);

// ТЗ-05: реальные тики общей симуляции, без сервера.
function arenaSetup(kind: 'omon' | 'clerk' | 'omon_shield' | 'zek' = 'omon') {
  const w = createWorld(19, true, 'route'); w.introduced = Object.keys(ENEMY_INTRO);
  const p = addPlayer(w, 'h', HERO_ID); p.x = 200; p.y = 200;
  spawnEnemies(w, 1);
  const e = Object.values(w.enemies)[0];
  Object.assign(e, { kind, x: 234, y: 200, hp: 1000, maxHp: 1000, cdMs: 0 });
  return { w, p, e };
}
{
  const w = createWorld(7, true); const p = addPlayer(w, 'h', HERO_ID);
  p.x = 300;
  const ev = step(w, {});
  check('R2: trigger и lock, без манекена', w.enc.lock?.join() === '240,720' && ev.some(e => e.t === 'lock') && !Object.values(w.enemies).some(e => e.dummy));
  p.x = 1000; step(w, {});
  check('R2: правый край арены', p.x === 700);
  p.x = 0; step(w, {});
  check('R2: левый край арены', p.x === 260);
  w.enc.lock = null; p.x = 2640; p.y = 160; step(w, {});
  check('R2: exit закрыт до зачистки', !w.trans && w.stage === 0);
}
for (const dodge of [false, true]) {
  const { w, p, e } = arenaSetup();
  step(w, {});
  check('R3: grunt начинает с замаха', e.phase === 'windup' && p.hp === 150);
  const start = w.timeMs; let hitAt = 0;
  if (dodge) p.y += ROLE.grunt.depth + 5;
  for (let i = 0; i < 40; i++) {
    const ev = step(w, {});
    if (ev.some(e => e.t === 'hit' && e.target === p.id) && !hitAt) hitAt = w.timeMs;
  }
  check(dodge ? 'R3: уход по y спасает' : 'R3: урон после windupMs', dodge ? !hitAt && p.hp === 150 : hitAt - start >= ROLE.grunt.windupMs && p.hp === 143, String(hitAt - start));
}
for (const count of [1, 2]) {
  const { w, p } = arenaSetup(); w.enemies = {}; spawnEnemies(w, 4);
  if (count === 2) { const b = addPlayer(w, 'b', NADYA_ID); b.x = 100; b.y = 240; }
  Object.values(w.enemies).forEach((e, i) => { e.x = 140 + i * 40; e.y = 190 + i * 10; e.cdMs = 0; });
  let valid = true, attacks = 0;
  for (let i = 0; i < 600; i++) {
    p.hp = 150; if (w.players.b) w.players.b.hp = 150;
    step(w, {});
    const attacking = Object.values(w.enemies).filter(e => e.phase === 'windup' || e.phase === 'active');
    attacks += attacking.length;
    valid &&= attacking.length <= 4 && Object.values(w.players).every(p => attacking.filter(e => e.token === p.id).length <= 2);
  }
  check(`R5: лимиты разрешений, игроков ${count}, 10 с`, valid && attacks > 0);
}
for (const status of ['stunMs', 'frozenMs'] as const) {
  const { w, e } = arenaSetup(); step(w, {}); e[status] = 1000; step(w, {});
  check(`R4: ${status} прерывает замах`, e.phase === 'none' && !e.token);
  spawnEnemies(w, 1); const other = Object.values(w.enemies).find(o => o !== e)!;
  Object.assign(other, { cdMs: 0, x: 166, y: 200 });
  for (let i = 0; i < 17; i++) step(w, {});
  check(`R5: после ${status} разрешение получает следующий`, other.token === 'h');
}
for (const heavy of [false, true]) {
  const { w, p, e } = arenaSetup('clerk');
  // Джеб — существующий клип; B — штатный uppercut.
  if (!heavy) { p.move = 'jab'; p.moveT = 0; }
  else { p.move = HEAVY.prime[0]; p.moveT = 0; }
  e.phase = 'windup'; e.phaseMs = 750; e.token = p.id;
  run(w, 300);
  check(heavy ? 'R4: tank прерывается B' : 'R4: tank не прерывается джебом',
    e.hp < 1000 && (heavy ? String(e.phase) === 'none' && !e.token && !!e.air : e.phase === 'windup' && e.anim === 'windup'),
    `hp=${e.hp} phase=${e.phase}`);
}
for (const front of [true, false]) {
  const { w, p, e } = arenaSetup('omon_shield');
  e.facing = front ? -1 : 1; e.cdMs = 1e9;
  p.move = 'jab'; p.moveT = 0;
  const dmg = STRIKES.prime.jab.dmg;
  const ev = step(w, {}, hitTimesMs('prime', 'jab', 1)[0] + 1);
  check(front ? 'R6: щит спереди 30%' : 'R6: щит сзади 100%',
    Math.abs(1000 - e.hp - dmg * (front ? 0.3 : 1)) < 0.001 && (front ? ev.some(e => e.t === 'block') : !ev.some(e => e.t === 'block')), String(1000 - e.hp));
}
{
  const w = createWorld(9, true), p = addPlayer(w, 'h', HERO_ID);
  p.x = 1240; w.enc.index = 1; w.enc.cleared = 1; step(w, {});
  w.enc.wave = 1; w.enc.queue = []; p.hp = 0;
  w.pending.push({ ms: 2000, kind: 'beam', owner: 'h', strike: STRIKES.prime.jab });
  const ev = step(w, {});
  check('R7: рестарт сохраняет пройденные встречи', w.enc.index === 1 && w.enc.cleared === 1 && w.enc.wave === 0 && w.enc.queue.length === 4 && !Object.keys(w.enemies).length && !w.pending.length && p.hp === 150 && p.x === 1240 && ev.some(e => e.t === 'restart'));
  step(w, {});
  check('R7: первая волна появляется снова', Object.keys(w.enemies).length === 4);
}
{
  const w = createWorld(11, true), p = addPlayer(w, 'h', HERO_ID);
  let ticks = 0, locks = 0, clears = 0, ordered = true, lastStage = 0;
  const bosses: string[] = [];
  const done: number[] = [];
  let intros = 0;
  while (!w.won && ticks++ < 50000) {
    for (const e of Object.values(w.enemies)) if (e.entered && !w.cine) e.hp = 0;
    p.hp = 150; p.invulnMs = 1000;
    const exit = stageOf(w).exit;
    let inp = { ...emptyInput(), mx: 1, run: true, skip: true };
    if (w.enc.cleared === encountersOf(w).length && exit) {
      inp.mx = p.x < exit.x0 + 3 ? 1 : p.x > exit.x1 - 3 ? -1 : 0;
      inp.my = p.y > exit.y1 ? -1 : 0;
    }
    const ev = step(w, { h: inp });
    for (const event of ev) if (event.t === 'boss') bosses.push(w.enemies[event.id].boss!);
    intros += ev.filter(e => e.t === 'cine').length;
    locks += ev.filter(e => e.t === 'lock').length; clears += ev.filter(e => e.t === 'clear').length;
    if (w.stage !== lastStage) {
      ordered &&= done[lastStage] === ENCOUNTERS[LEVELS.route.stages[lastStage].id].length;
      lastStage = w.stage;
    }
    ordered &&= w.enc.cleared >= (done[w.stage] ?? 0);
    done[w.stage] = w.enc.cleared;
  }
  check('R2: бот проходит весь маршрут по порядку', w.won && ordered && locks === 13 && clears === 13 && done.join() === '3,1,1,1,2,2,3', `ticks=${ticks} locks=${locks} clears=${clears} done=${done}`);
  check('TZ07: бот показал все девять вставок и пропускал их', intros === 9, String(intros));
  check('TZ06 R9.8: маршрут включает обоих боссов', bosses.join() === 'shaman,pizdulina');
  const n = w.nextEnemyId; spawnEnemies(w, 3); step(w, {});
  check('R2: после победы нет новых врагов', w.nextEnemyId === n && !w.enc.lock);
}
for (const dodge of [false, true]) {
  const { w, p, e } = arenaSetup('zek'); e.x = 130;
  step(w, {}); if (dodge) p.y += ROLE.fast.depth + 5;
  run(w, 1000);
  check(dodge ? 'R3: fast не задевает другую y' : 'R3: fast задевает свою линию', p.hp === (dodge ? 150 : 144), String(p.hp));
}
{
  const { w, e } = arenaSetup(); const buddy = addPlayer(w, 'b', NADYA_ID);
  spawnEnemies(w, 1);
  check('R1: HP при двух игроках фиксированы', Object.values(w.enemies).find(o => o !== e)!.maxHp === 60);
  buddy.connected = false; spawnEnemies(w, 1);
  check('R1: отключённый не увеличивает HP', Object.values(w.enemies).at(-1)!.maxHp === 60);
}

{
  const { w, p, e } = arenaSetup();
  step(w, {});
  p.connected = false;
  const b = addPlayer(w, 'b', NADYA_ID);
  step(w, {});
  check('R5: отключение цели освобождает разрешение', !e.token && e.phase === 'none');
  b.x = 300; step(w, {});
  const late = addPlayer(w, 'late', KRIS_ID); late.x = -100; step(w, {});
  check('R2: отставший новичок подтянут в арену', late.x === 260);
}
{
  const { w, e } = arenaSetup();
  spawnEnemies(w, 2);
  const others = Object.values(w.enemies).filter(o => o !== e);
  others.forEach(o => { o.cdMs = 0; o.x = 280; o.y = 240; });
  others[0].waitMs = 50; others[1].waitMs = 500;
  e.cdMs = 10000;
  step(w, {});
  check('R5: два ожидающих получают разрешение на одну цель', others[1].token === 'h' && others[0].token === 'h');
}
{
  const w = createWorld(9, true, 'route', 6), p = addPlayer(w, 'h', HERO_ID);
  w.enc.index = 1; w.enc.cleared = 1; p.x = 2060; step(w, {});
  check('R2: solo первая волна из четырёх', Object.values(w.enemies).length === 4);
  const b = addPlayer(w, 'b', NADYA_ID); step(w, {});
  check('R2: duo не меняет первую волну', Object.values(w.enemies).length === 4);
  check('R1: HP зэка фиксированы', Object.values(w.enemies).at(-1)!.maxHp === 42);
}


// TZ-06: настоящая встреча, затем изолированные опасности боссов.
function bossSetup(boss: BossId = 'shaman') {
  const w = createWorld(71, true, 'route', 4), p = addPlayer(w, 'h', HERO_ID);
  w.introduced = Object.keys(ENEMY_INTRO);
  w.enc.index = 1; w.enc.cleared = 1; p.x = 1100; p.y = 220;
  step(w, {}); w.enc.queue = [];
  for (const e of Object.values(w.enemies)) e.hp = 0;
  step(w, {});
  const e = Object.values(w.enemies).find(e => e.boss)!;
  if (boss !== 'shaman') { e.boss = boss; e.hp = e.maxHp = BOSS[boss].hp; }
  e.x = 1180; e.y = 220; e.cdMs = 0;
  return { w, p, e };
}
function forceBossAttack(e: ReturnType<typeof bossSetup>['e'], atk: string) {
  e.atk = atk; e.phase = 'windup'; e.phaseMs = BOSS_ATTACK[atk].windupMs;
  e.atkY = e.y; e.atkDir = -1; e.token = 'h';
}
{
  const { w, p, e } = bossSetup();
  check('TZ06 R9.1: после волны Шаман, выход заперт', e.boss === 'shaman' && w.enc.cleared === 1 && !!w.enc.lock && !w.trans);
  e.hp = 0; const death = step(w, {});
  check('TZ06 R2: смерть, fall и bossDown', e.anim === 'down' && death.some(v => v.t === 'bossDown') && !!w.enemies[e.id]);
  run(w, 1400); check('TZ06 R1: пауза между боссами', !Object.values(w.enemies).some(e => e.boss === 'pizdulina'));
  run(w, 150);
  const next = Object.values(w.enemies).find(e => e.boss === 'pizdulina')!;
  check('TZ06 R9.1: второй босс после паузы', !!next && w.enc.cleared === 1);
  p.hp = 0; const restart = step(w, {}); step(w, {});
  check('TZ06 R9.7: чекпойнт Пиздулины без волн и Шамана', restart.some(v => v.t === 'restart') && Object.values(w.enemies).length === 1 && Object.values(w.enemies)[0].boss === 'pizdulina');
  Object.values(w.enemies)[0].hp = 0; step(w, {}); run(w, 1600);
  check('TZ06 R9.1: clear только после второго босса', w.enc.cleared === 2 && !w.enc.lock);
  const exit = stageOf(w).exit!; p.x = exit.x0 + 2; p.y = exit.y1; const ev = step(w, {});
  check('TZ06 R9.1: выход доступен после боссов', ev.some(e => e.t === 'exit'));
}
{
  const { w, p, e } = bossSetup(); forceBossAttack(e, 'mic'); e.hp = e.maxHp / 2;
  const ev = step(w, {});
  check('TZ06 R9.2: вторая фаза, отмена и неуязвимость', e.bossPhase === 2 && ev.some(v => v.t === 'phase') && e.phase === 'none' && e.invulnMs! >= 980);
  p.x = e.x - 20; p.y = e.y;
  w.pending.push({ ms: 0, kind: 'hits', owner: p.id, strike: STRIKES.prime.jab, ids: [e.id] });
  const hp = e.hp; step(w, {});
  check('TZ06 R9.2: урон заблокирован', e.hp === hp);
  run(w, 1020); check('TZ06 R9.2: неуязвимость заканчивается', !e.invulnMs);
}
for (const outside of [false, true]) {
  const { w, p, e } = bossSetup(); forceBossAttack(e, 'vstayu'); p.x = e.x - (outside ? 130 : 80);
  run(w, 850); check('TZ06 R9.3: до конца замаха урона нет', p.hp === 150);
  run(w, 100);
  check(`TZ06 R9.3: ring ${outside ? 'вне' : 'внутри'}`, p.hp === (outside ? 150 : 140));
}
for (const dodge of [false, true]) {
  const { w, p, e } = bossSetup(); forceBossAttack(e, 'chorus'); p.y = e.y - (dodge ? 25 : 0);
  run(w, 1100); check(`TZ06 R9.4: line y=${dodge}`, p.hp === (dodge ? 150 : 136));
}
for (const dodge of [false, true]) {
  const { w, p, e } = bossSetup('pizdulina'); forceBossAttack(e, 'ban');
  run(w, 720); const shot = w.shots[0]; const x = shot.x;
  if (dodge) p.y -= 30;
  run(w, 100); check('TZ06 R9.5: снаряд движется по x', shot.x < x && shot.y === 220);
  // Оставляем один снаряд, чтобы проверить его удаление отдельно от очереди.
  e.shotCount = 3; w.shots = [shot]; run(w, 500);
  check(`TZ06 R9.5: shots y=${dodge}`, dodge ? p.hp === 150 && w.shots.includes(shot) : p.hp === 141 && !w.shots.includes(shot));
}
{
  const { w, p, e } = bossSetup(); p.char = NADYA_ID; p.form = 'nadya';
  w.pending.push({ ms: 0, kind: 'kiss', owner: p.id, strike: STRIKES.nadya.a1, x: e.x - 3, y: e.y, dir: 1, ids: [] });
  const hp = e.hp, ev = step(w, {});
  check('TZ06 R9.6: поцелуй Шамана без урона и ревности, с репликой', e.hp === hp && !e.charmMs && ev.filter(v => v.t === 'taunt' && v.id === e.id && v.line === BOSS.shaman.kissLine).length === 1);
  const more = step(w, {}); check('TZ06 R9.6: реплика одна на поцелуй', !more.some(v => v.t === 'taunt'));
}
{
  const { w, p, e } = bossSetup('pizdulina');
  forceBossAttack(e, 'zones'); e.zonePoints = [{ x: p.x, y: p.y }];
  run(w, 850); check('TZ06 R2: зоны до active безопасны', p.hp === 150 && !w.zones.length);
  run(w, 600); check('TZ06 R2: зона повреждает на 500 мс', p.hp === 144 && w.zones.length === 1);
  p.y -= 40; run(w, 2100); check('TZ06 R2: зоны исчезают', !w.zones.length && p.hp === 144);
}
{
  const { w, e } = bossSetup(); forceBossAttack(e, 'fans'); run(w, 850);
  check('TZ06 R2: призыв ограничен MAX_ALIVE', Object.values(w.enemies).filter(e => e.hp > 0).length === 3);
}


{
  const { w, p, e } = bossSetup(); e.atkIndex = 1; e.x = p.x + 85; w.tokenReleased = {};
  const ev = step(w, {});
  check('TZ06 R2: цикл выбирает ring и заранее шлёт tele', e.atk === 'vstayu' && e.phase === 'windup' && ev.some(v => v.t === 'tele' && v.shape === 'ring' && v.ms === 900), JSON.stringify({ atk: e.atk, phase: e.phase, p: [p.x, p.y], e: [e.x, e.y], token: e.token, ev }));
  const b = addPlayer(w, 'b', NADYA_ID); b.x = 1200; b.y = 240;
  spawnEnemies(w, 1); const minion = Object.values(w.enemies).find(o => o !== e)!;
  minion.target = b.id; minion.targetMs = 1500; minion.waitMs = 1000;
  step(w, {});
  check('TZ06 R2: ring занимает оба разрешения', e.wideToken === true && !minion.token);
}
{
  const { w, p, e } = bossSetup(); e.x = p.x + 46;
  e.cooldowns = { mic: w.timeMs + 10000 }; e.atkIndex = 0;
  // Во время подхода индекс не перескакивает каждый тик.
  run(w, 1200);
  check('TZ06 R2: пропуск атаки на cooldown', e.atk === 'vstayu' && e.atkIndex === 0);
}
{
  const { w, p, e } = bossSetup(); forceBossAttack(e, 'mic');
  w.pending.push({ ms: 0, kind: 'hits', owner: p.id, strike: { range: 100, dmg: 10, kb: 80, launch: true, stunMs: 1000, stun: 100 }, ids: [e.id] });
  const x = e.x; step(w, {});
  check('TZ06 R2: броня, launch и stun игнорируются, отброс 25%', !e.air && !e.pin && !e.stunMs && e.phase === 'windup' && e.x === x + 40 && e.anim === 'hurt', JSON.stringify({ x, ex: e.x, phase: e.phase, anim: e.anim, air: e.air, stun: e.stunMs }));
  w.pending.push({ ms: 0, kind: 'hits', owner: p.id, strike: { range: 100, dmg: 10, kb: 0, down: true, stun: 100 }, ids: [e.id] });
  step(w, {}); check('TZ06 R2: down отменяет замах без падения', e.phase === 'none' && !e.air && e.anim !== 'down');
}
{
  const { w, p, e } = bossSetup(); e.x = p.x + 40;
  p.stormMs = STORM_MS; p.stormTickMs = 0; step(w, {});
  check('TZ06 R2: freeze вдвое короче', e.frozenMs === FREEZE_MS / 2 - TICK_MS);
}


{
  const { w, p, e } = bossSetup(); forceBossAttack(e, 'fans'); run(w, 850);
  e.hp = 0; step(w, {}); p.invulnMs = 10000; run(w, 1600);
  check('TZ06 R1: второй босс приходит, даже если остались призванные', Object.values(w.enemies).some(e => e.boss === 'pizdulina') && Object.values(w.enemies).some(e => !e.boss && e.hp > 0));
}

{
  const w = createWorld(36, false), p = addPlayer(w, 'h', HERO_ID);
  p.x = 700; w.enc.lock = [240, 720];
  dummy(w, 'first', 0); dummy(w, 'second', 0);
  w.enemies.first.kind = 'vatnik'; w.enemies.second.kind = 'omon';
  step(w, {}); check('TZ07: первая из двух вставок', w.cine?.kind === 'vatnik');
  step(w, { h: { ...emptyInput(), skip: true } }, 300);
  const x = p.x; const ev = step(w, { h: { ...emptyInput(), mx: 1 } });
  check('TZ07: второй новый вид сразу после первого, без шага боя', String(w.cine?.kind) === 'omon' && p.x === x && ev.some(e => e.t === 'cine'));
}
{
  const w = createWorld(37, false), p = addPlayer(w, 'h', HERO_ID);
  p.x = 300; step(w, {});
  const enemies = Object.values(w.enemies); enemies[0].hp = 0;
  step(w, {});
  check('TZ07: следующая волна при двух живых и максимум шесть', w.enc.wave === 1 && Object.values(w.enemies).filter(e => e.hp > 0).length === 6);
}

// TZ-07: входы, границы, общая пауза и остановка поезда.
{
  const hp: number[] = [];
  for (const n of [1, 4]) {
    const w = createWorld(31, false);
    for (let i = 0; i < n; i++) addPlayer(w, `p${i}`, [HERO_ID, NADYA_ID, KRIS_ID, 'd'][i]);
    w.players.p0.x = 300; step(w, {});
    const enemies = Object.values(w.enemies);
    hp.push(enemies[0].maxHp);
    check(`TZ07: ${n} игрока, вход справа x1+260`, enemies.length === 3 && enemies.every(e => e.x === 720 + ENTER_OFF));
    check(`TZ07: ${n} игрока, ни одного слева`, enemies.every(e => e.x >= 240));
    check(`TZ07: мир содержит ${n} игроков`, Object.keys(w.players).length === n);
  }
  check('TZ07: HP не зависят от числа игроков', hp[0] === hp[1] && hp[0] === 66);
}
{
  const w = createWorld(32, false), p = addPlayer(w, 'h', HERO_ID);
  p.x = 300; step(w, {});
  const e = Object.values(w.enemies)[0], hp = e.hp;
  p.x = 700; p.y = e.y;
  w.pending.push({ ms: 0, kind: 'hits', owner: p.id, strike: { dmg: 100, range: 1000, kb: 0, stun: 0 }, ids: [e.id] });
  step(w, {});
  check('TZ07: враг вне арены не получает урон и разрешение', e.hp === hp && !e.token);
  e.x = 710; e.y = p.y; w.introduced = Object.keys(ENEMY_INTRO);
  w.pending.push({ ms: 0, kind: 'hits', owner: p.id, strike: { dmg: 1, range: 1000, kb: 500, stun: 0 }, ids: [e.id] });
  step(w, {});
  check('TZ07: вошедшего нельзя выбить из арены', e.entered === true && e.x <= 708 && e.x >= 252);
  e.pin = { ms: 1000, speed: 10, dir: -1, by: p.id, hit: [] };
  run(w, 200);
  check('TZ07: кегля остаётся внутри арены', e.x >= 252 && e.x <= 708);
}
{
  const w = createWorld(33, false), p = addPlayer(w, 'h', HERO_ID);
  p.x = 300; step(w, {});
  const [e, second] = Object.values(w.enemies); e.x = 710;
  const ev = step(w, {});
  check('TZ07: первый vatnik вызывает cine', w.cine?.kind === 'vatnik' && ev.some(e => e.t === 'cine'));
  const x = p.x, ex = e.x, clock = w.timeMs, cd = p.cdMs, tick = w.tick;
  step(w, { h: { ...emptyInput(), mx: 1 } }, 100);
  check('TZ07: cine замораживает мир и боевые таймеры', p.x === x && e.x === ex && w.timeMs === clock && p.cdMs === cd && w.tick === tick);
  step(w, { h: { ...emptyInput(), skip: true } });
  check('TZ07: skip сокращает остаток до 300 мс', !!w.cine && w.cine.ms <= 300);
  for (let i = 0; i < 20; i++) step(w, {});
  second.x = 700;
  check('TZ07: второй vatnik без вставки', !step(w, {}).some(e => e.t === 'cine') && !w.cine);
  p.hp = 0; step(w, {}); step(w, {});
  Object.values(w.enemies)[0].x = 710;
  check('TZ07: чекпойнт сохраняет introduced', !step(w, {}).some(e => e.t === 'cine') && w.introduced.includes('vatnik'));
}
{
  const w = createWorld(34, false), p = addPlayer(w, 'h', HERO_ID);
  p.x = 300; step(w, {}); w.enemies = {}; w.enc.wave = 1;
  w.enc.queue = [{ kind: 'vatnik', door: 630 }, { kind: 'omon', door: 20 }];
  step(w, {});
  const [door, right] = Object.values(w.enemies);
  check('TZ07: дверь внутри арены и fallback справа', door.x === 630 && door.anim === 'enter' && door.enterMs === 500 && right.x === 980);
  run(w, 400);
  check('TZ07: во время enter вставки нет', !w.cine && !door.token);
  run(w, 120);
  check('TZ07: после enter вставка', w.cine?.kind === 'vatnik');
}
{
  const w = createWorld(35, false, 'route', 3), p = addPlayer(w, 'h', HERO_ID);
  w.enc.index = w.enc.cleared = encountersOf(w).length;
  const exit = stageOf(w).exit!; p.x = exit.x0 + 2; p.y = exit.y1;
  step(w, {});
  check('TZ07: торможение начинается с нуля', w.halt === 0 && !w.trans);
  run(w, HALT_MS - 40);
  check('TZ07: до 2500 выход закрыт', w.halt < HALT_MS && !w.trans);
  run(w, 60);
  check('TZ07: после остановки выход доступен', w.halt === HALT_MS && !!w.trans);
}

console.log(failed ? `\n${failed} проверок не прошло` : '\nВсе проверки прошли');
process.exit(failed ? 1 : 0);
