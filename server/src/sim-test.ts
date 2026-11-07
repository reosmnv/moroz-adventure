import { STORY_SCENES, bossWarningEvents, stopStoryHeroes, LINES, CALL_NAMES, createStoryProgress, wantedStatus, startStoryForWorld } from '@bc/shared';
// Сценарии боя Анастасии прямо на shared/sim, без сервера: `npm run test:sim`.
import { CHARACTERS, HERO_FORM, PLAYER_HP, switchHero, testHeal, testGod, testKillAll, chargeUlt, nextStage, RAMIL, flurryTiming, flurryPose, BOSS, BOSS_ATTACK, type BossId, ENTER_SPEED, ENTER_OFF, HALT_MS, ROLE, ENCOUNTERS, LEVELS, stageOf, stageProp, encountersOf, HERO_ID, KRIS_ID, NADYA_ID, ULT_MS, TICK_MS, addPlayer, createWorld, emptyInput, spawnEnemies, step, moveDurMs, hitTimesMs, CHAIN, HEAVY, STRIKES, FREEZE_MS, STORM_MS, RANGE_MULT, JUGGLE_MAX_MS, KILL_EXTEND_MS, type Input, type World } from '@bc/shared';

let failed = 0;
function check(name: string, ok: boolean, info = '') {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${info ? `  (${info})` : ''}`);
  if (!ok) failed++;
}

for (const anim of ['run', 'attack'] as const) {
  const w = createWorld(22, false, 'route');
  const p = addPlayer(w, 'story', 'anastasia'); p.x = 480; p.y = 200;
  p.anim = anim; p.combo = 2; p.queued = 'attack'; p.fDashMs = 100;
  const story = createStoryProgress(); story.completed.push('prologue');
  check(`R2 сюжет сбрасывает ${anim}`, startStoryForWorld(story, w) && String(p.anim) === 'idle' && p.move === 'idle' && !p.combo && !p.queued && !p.fDashMs && p.x === 480 && p.y === 200);
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
  check('удар врага: hurt', log.includes('hurt') && p.hp === 144, `${log.join('>')} hp ${p.hp}`);
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
  const { w } = setup(); dummy(w, 'e1', 24);
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
  const { w } = setup(); dummy(w, 'one', 30); dummy(w, 'two', 40); dummy(w, 'side', 35); dummy(w, 'back', -30);
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
  check('Надя: урон A 6, 7, 9', hits.slice(0, 3).join() === '6,7,9', hits.join());
}
{
  const { w, p } = setup(false, NADYA_ID); dummy(w, 'e1', 30);
  run(w, 400, press([0], 'heavy'));
  const e = w.enemies.e1;
  check('Надя: пощёчина замедляет на 50%', (e.slowMs ?? 0) > 1000 && e.slow === 0.5, `slow ${e.slowMs} ${e.slow}`);
  check('Надя: контроль копит ульту быстрее (7 урона + 5)', p.ult === 12, `ult ${p.ult}`);
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
  check('Надя: враг на пути получил 18 после рывка', r.hits.includes(18) && (w.enemies.e1.slowMs ?? 0) > 0, r.hits.join());
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
  check('Kris: шар у Анастасии, взрыв 25 и реплика', r.hits.includes(25) && r.events.includes('boom') && r.events.some(e => e.startsWith('taunt:')), r.events.join());
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
  check('Kris: прицел, затем луч 70 по дальнему врагу', r.events.indexOf('aim') < r.events.indexOf('beam') && r.hits.includes(70), r.events.join());
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
  const w = createWorld(19, true, 'route');
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
  check(dodge ? 'R3: уход по y спасает' : 'R3: урон после windupMs', dodge ? !hitAt && p.hp === 150 : hitAt - start >= ROLE.grunt.windupMs && p.hp === 144, String(hitAt - start));
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
  check('R7: рестарт сохраняет пройденные встречи', w.enc.index === 1 && w.enc.cleared === 1 && w.enc.wave === 0 && w.enc.queue.length === 8 && !Object.keys(w.enemies).length && !w.pending.length && p.hp === 150 && p.x === 1240 && ev.some(e => e.t === 'restart'));
  step(w, {});
  check('R7: первая волна снова начинает входить', Object.keys(w.enemies).length === 1 && w.enc.queue.length === 7);
}
{
  const w = createWorld(11, true), p = addPlayer(w, 'h', HERO_ID);
  w.storyCompleted = STORY_SCENES.map(scene => scene.id);
  let ticks = 0, locks = 0, clears = 0, ordered = true, lastStage = 0;
  const bosses: string[] = [];
  const done: number[] = [];
  while (!w.won && ticks++ < 50000) {
    for (const e of Object.values(w.enemies)) if (e.entered) e.hp = 0;
    p.hp = 150; p.invulnMs = 1000;
    const exit = stageOf(w).exit;
    let inp = { ...emptyInput(), mx: 1, run: true };
    if (w.enc.cleared === encountersOf(w).length && exit) {
      inp.mx = p.x < exit.x0 + 3 ? 1 : p.x > exit.x1 - 3 ? -1 : 0;
      inp.my = p.y > exit.y1 ? -1 : 0;
    }
    const ev = step(w, { h: inp });
    for (const event of ev) if (event.t === 'boss') {
      const boss = w.enemies[event.id];
      bosses.push(boss.boss!);
      if (boss.boss === 'katya') check('TZ26: Катя только после обеих волн вокзала', stageOf(w).id === 'vokzal' && w.enc.wave === 1 && !w.enc.queue.length);
      check(`TZ10: ${boss.boss} появляется внутри арены`, !!w.enc.lock && boss.x >= w.enc.lock[0] && boss.x <= w.enc.lock[1]);
    }
    locks += ev.filter(e => e.t === 'lock').length; clears += ev.filter(e => e.t === 'clear').length;
    if (w.stage !== lastStage) {
      ordered &&= done[lastStage] === ENCOUNTERS[LEVELS.route.stages[lastStage].id].length;
      lastStage = w.stage;
    }
    ordered &&= w.enc.cleared >= (done[w.stage] ?? 0);
    done[w.stage] = w.enc.cleared;
  }
  check('R2: бот проходит весь маршрут по порядку', w.won && ordered && locks === 12 && clears === 12 && done.join() === '3,1,1,1,1,2,2,1', `ticks=${ticks} locks=${locks} clears=${clears} done=${done}`);
  check('V3: маршрут включает Катю', bosses.join() === 'shaman,pizdulina,katya');
  const n = w.nextEnemyId; spawnEnemies(w, 3); step(w, {});
  check('R2: после победы нет новых врагов', w.nextEnemyId === n && !w.enc.lock);
}
for (const dodge of [false, true]) {
  const { w, p, e } = arenaSetup('zek'); e.x = 130;
  step(w, {}); if (dodge) p.y += ROLE.fast.depth + 5;
  run(w, 1000);
  check(dodge ? 'R3: fast не задевает другую y' : 'R3: fast задевает свою линию', p.hp === (dodge ? 150 : 145), String(p.hp));
}
{
  const { w, e } = arenaSetup(); const buddy = addPlayer(w, 'b', NADYA_ID);
  spawnEnemies(w, 1);
  check('R1: HP при двух игроках фиксированы', Object.values(w.enemies).find(o => o !== e)!.maxHp === 48);
  buddy.connected = false; spawnEnemies(w, 1);
  check('R1: отключённый не увеличивает HP', Object.values(w.enemies).at(-1)!.maxHp === 48);
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
  check('R2: solo первая волна входит по одному', Object.values(w.enemies).length === 1 && w.enc.queue.length === 9);
  addPlayer(w, 'b', NADYA_ID); step(w, {});
  check('R2: duo не меняет первую волну', Object.values(w.enemies).length === 1 && w.enc.queue.length === 9);
  check('R1: HP первого врага фиксированы', Object.values(w.enemies).at(-1)!.maxHp === 100);
}


// Арены оставляют место под кнопки.
for (const stage of LEVELS.route.stages) {
  for (const [i, encounter] of (ENCOUNTERS[stage.id] ?? []).entries()) {
    check(`TZ10: ${stage.id} E${i + 1} левее кнопок`, encounter.arena[1] <= stage.width - 0.4 * 760);
  }
}

// Проходим все волны встречи, убирая рядовых врагов между шагами.
function finishMayakWaves(w: ReturnType<typeof createWorld>) {
  step(w, {});
  for (let i = 0; i < 2000 && !w.enc.bossStarted; i++) {
    for (const enemy of Object.values(w.enemies)) enemy.hp = 0;
    step(w, {}, 50);
  }
}
{
  const w = createWorld(71, true, 'route', 4), p = addPlayer(w, 'h', HERO_ID);
  p.x = 800; p.y = 220;
  step(w, {});
  check('TZ10: одна встреча, концертные волны без босса', encountersOf(w).length === 1 && !!w.enc.lock && !w.enc.bossStarted && !Object.values(w.enemies).some(e => e.boss));
  w.enemies = {}; step(w, {}); p.hp = 0;
  const ev = step(w, {});
  check('TZ10: смерть во время волн начинает встречу заново', ev.some(e => e.t === 'restart') && w.enc.wave === 0 && w.enc.queue.length === encountersOf(w)[0].waves[0].length && w.enc.index === 0 && w.enc.cleared === 0);
  finishMayakWaves(w); p.hp = 0; step(w, {}); step(w, {});
  check('TZ10: чекпойнт Шамана без повторения волн', w.enc.bossStarted === true && Object.values(w.enemies).length === 1 && Object.values(w.enemies)[0].boss === 'shaman' && w.enc.queue.length === 0);
}

// TZ-06: настоящая встреча, затем изолированные опасности боссов.
function bossSetup(boss: BossId = 'shaman') {
  const w = createWorld(71, true, 'route', 4), p = addPlayer(w, 'h', HERO_ID);

  p.x = 800; p.y = 220;
  finishMayakWaves(w);
  const e = Object.values(w.enemies).find(e => e.boss)!;
  if (boss !== 'shaman') { e.boss = boss; e.hp = e.maxHp = BOSS[boss].hp; }
  e.x = 880; e.y = 220; e.cdMs = 0; e.enterMs = 0; e.entered = true; e.phase = 'none'; e.anim = 'idle';
  return { w, p, e };
}
function forceBossAttack(e: ReturnType<typeof bossSetup>['e'], atk: string) {
  e.atk = atk; e.phase = 'windup'; e.phaseMs = BOSS_ATTACK[atk].windupMs;
  e.atkX = e.x; e.atkY = e.y; e.atkDir = -1; e.token = 'h';
}
{
  const { w, p, e } = bossSetup();
  check('TZ06 R9.1: после волны Шаман, выход заперт', e.boss === 'shaman' && w.enc.cleared === 0 && !!w.enc.lock && !w.trans);
  e.hp = 0; const death = step(w, {});
  check('TZ08 R4: смерть, задержка fall и bossDown', e.anim === 'hurt' && death.some(v => v.t === 'bossDown') && !!w.enemies[e.id]);
  run(w, 1400); check('TZ06 R1: пауза между боссами', !Object.values(w.enemies).some(e => e.boss === 'pizdulina'));
  run(w, 900);
  const next = Object.values(w.enemies).find(e => e.boss === 'pizdulina')!;
  check('TZ06 R9.1: второй босс после паузы', !!next && w.enc.cleared === 0);
  p.hp = 0; const restart = step(w, {}); step(w, {});
  check('TZ06 R9.7: чекпойнт Пиздулины без волн и Шамана', restart.some(v => v.t === 'restart') && Object.values(w.enemies).length === 3 && Object.values(w.enemies).filter(e=>e.kind==='omon' && !e.boss).length===2 && Object.values(w.enemies)[0].boss === 'pizdulina');
  for(const e of Object.values(w.enemies)) e.hp = 0; step(w, {}); run(w, 2300);
  check('TZ06 R9.1: clear только после второго босса', w.enc.cleared === 1 && !w.enc.lock);
  w.storyCompleted = STORY_SCENES.map(scene => scene.id);
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
  run(w, 1420); check('TZ06 R9.2: неуязвимость заканчивается', !e.invulnMs);
}
for (const outside of [false, true]) {
  const { w, p, e } = bossSetup(); e.x = stageProp(w, 'stage_b')!.x; forceBossAttack(e, 'vstayu'); p.x = e.x - (outside ? 180 : 80);
  run(w, 850); check('TZ06 R9.3: до конца замаха урона нет', p.hp === 150);
  run(w, 100);
  check(`TZ06 R9.3: ring ${outside ? 'вне' : 'внутри'}`, p.hp === (outside ? 150 : 138));
}
for (const dodge of [false, true]) {
  const { w, p, e } = bossSetup(); forceBossAttack(e, 'chorus'); e.bands = [{y:e.y,h:16},{y:e.y-56,h:16}]; p.y = e.y - (dodge ? 25 : 0);
  run(w, 1100); check(`TZ06 R9.4: line y=${dodge}`, p.hp === (dodge ? 150 : 136));
}
for (const dodge of [false, true]) {
  const { w, p, e } = bossSetup('pizdulina'); forceBossAttack(e, 'shots');
  run(w, 720); const shot = w.shots[0]; const x = shot.x;
  if (dodge) p.y -= 30;
  run(w, 100); check('TZ06 R9.5: снаряд движется по x', shot.x < x && shot.y === 220);
  // Оставляем один снаряд, чтобы проверить его удаление отдельно от очереди.
  e.shotCount = 4; w.shots = [shot]; run(w, 500);
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
  check('TZ06 R2: пропуск атаки на cooldown', e.atk === 'vstayu' && e.atkIndex === 2);
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
  e.hp = 0; step(w, {}); p.invulnMs = 10000; run(w, 2300);
  check('TZ06 R1: второй босс приходит, даже если остались призванные', Object.values(w.enemies).some(e => e.boss === 'pizdulina') && Object.values(w.enemies).some(e => !e.boss && e.hp > 0));
}

{
  const w = createWorld(36, false), p = addPlayer(w, 'h', HERO_ID);
  p.x = 700; w.enc.lock = [240, 720];
  dummy(w, 'first', 0); dummy(w, 'second', 0);
  w.enemies.first.kind = 'vatnik'; w.enemies.second.kind = 'omon';
  const x = p.x, clock = w.timeMs;
  step(w, { h: { ...emptyInput(), mx: -1 } });
  check('C1: появление двух новых видов не останавливает движение и часы', p.x < x && w.timeMs > clock);
}
{
  const w = createWorld(37, false), p = addPlayer(w, 'h', HERO_ID);

  p.x = 300; step(w, {});
  w.enemies = {}; w.enc.queue = [];
  for (let i = 0; i < 4; i++) dummy(w, `left${i}`, i * 10);
  step(w, {});
  check('TZ07: следующая волна ставится в очередь при четырёх живых', w.enc.wave === 1 && Object.values(w.enemies).filter(e => e.hp > 0).length === 4 && w.enc.queue.length > 0,
    `wave=${w.enc.wave} alive=${Object.values(w.enemies).filter(e => e.hp > 0).length} queue=${w.enc.queue.length}`);
}

// TZ-07: входы, границы, общая пауза и остановка поезда.
{
  const hp: number[] = [];
  for (const n of [1, 4]) {
    const w = createWorld(31, false);
    for (let i = 0; i < n; i++) addPlayer(w, `p${i}`, [HERO_ID, NADYA_ID, KRIS_ID, 'ramil'][i]);
    w.players.p0.x = 300; step(w, {});
    const enemies = Object.values(w.enemies);
    hp.push(enemies[0].maxHp);
    check(`TZ07: ${n} игрока, вход справа x1+ENTER_OFF`, enemies.length === 1 && enemies.every(e => e.x === 720 + ENTER_OFF));
    check(`TZ07: ${n} игрока, ни одного слева`, enemies.every(e => e.x >= 240));
    check(`TZ07: мир содержит ${n} игроков`, Object.keys(w.players).length === n);
  }
  check('TZ07: HP не зависят от числа игроков', hp[0] === hp[1] && hp[0] === 53, hp.join('/'));
}
{
  const w = createWorld(32, false), p = addPlayer(w, 'h', HERO_ID);
  p.x = 300; step(w, {});
  const e = Object.values(w.enemies)[0], hp = e.hp;
  p.x = 700; p.y = e.y;
  w.pending.push({ ms: 0, kind: 'hits', owner: p.id, strike: { dmg: 100, range: 1000, kb: 0, stun: 0 }, ids: [e.id] });
  step(w, {});
  check('TZ07: враг вне арены не получает урон и разрешение', e.hp === hp && !e.token);
  e.x = 710; e.y = p.y;
  w.pending.push({ ms: 0, kind: 'hits', owner: p.id, strike: { dmg: 1, range: 1000, kb: 500, stun: 0 }, ids: [e.id] });
  step(w, {});
  check('TZ07: вошедшего нельзя выбить из арены', e.entered === true && e.x <= 708 && e.x >= 252);
  e.pin = { ms: 1000, speed: 10, dir: -1, by: p.id, hit: [] };
  run(w, 200);
  check('TZ07: кегля остаётся внутри арены', e.x >= 252 && e.x <= 708);
}
{
  const w = createWorld(33, false), p = addPlayer(w, 'h', HERO_ID);
  p.x = 300; step(w, {}); run(w, 300);
  const [e, second] = Object.values(w.enemies); e.x = 710;
  step(w, {});
  const x = p.x, clock = w.timeMs, tick = w.tick;
  step(w, { h: { ...emptyInput(), mx: -1 } }, 100);
  check('TZ21: новый враг не замораживает движение и часы', p.x < x && w.timeMs > clock && w.tick > tick);
  second.x = 700;
  const secondX = p.x, secondClock = w.timeMs;
  step(w, { h: { ...emptyInput(), mx: -1 } });
  check('C1: второй враг тоже не останавливает движение и часы', p.x < secondX && w.timeMs > secondClock);
}
{
  const w = createWorld(34, false), p = addPlayer(w, 'h', HERO_ID);
  p.x = 300; step(w, {}); w.enemies = {}; w.enc.wave = 1;
  w.enc.queue = [{ kind: 'vatnik', door: 630 }, { kind: 'omon', door: 20 }];
  step(w, {});
  const door = Object.values(w.enemies)[0];
  check('TZ07: дверь внутри арены', door.x === 630 && door.anim === 'enter' && door.enterMs === 500);
  run(w, 320);
  const right = Object.values(w.enemies)[1];
  check('TZ07: fallback появляется справа после интервала', !!right && right.x <= 720 + ENTER_OFF && right.x > 720);
  check('TZ07: во время входа враг не атакует', !door.token && door.anim === 'enter');
  run(w, 220);
  check('C1: после входа враг готов к бою', door.entered === true && door.anim !== 'enter');
}
{
  const w = createWorld(35, false, 'route', 3), p = addPlayer(w, 'h', HERO_ID);
  w.enc.index = w.enc.cleared = encountersOf(w).length;
  w.storyCompleted = STORY_SCENES.map(scene => scene.id);
  const exit = stageOf(w).exit!; p.x = exit.x0 + 2; p.y = exit.y1;
  step(w, {});
  check('TZ07: торможение начинается с нуля', w.halt === 0 && !w.trans);
  run(w, HALT_MS - 40);
  check('TZ07: до 2500 выход закрыт', w.halt < HALT_MS && !w.trans);
  run(w, 60);
  check('TZ07: после остановки выход доступен', w.halt === HALT_MS && !!w.trans);
}



// TZ-08: реальный выбор атаки фиксирует геометрию и телеграфы.
for (const atk of ['mic','vstayu','pyro','chorus','salute','slap','banStrike','shots','grid','zones']) {
  for (const dodge of [false,true]) {
    const {w,p,e} = bossSetup(['slap','banStrike','shots','grid','zones'].includes(atk)?'pizdulina':'shaman');
    e.bossPhase = atk==='shots'?1:2; e.atkIndex = BOSS[e.boss!].attacks[e.bossPhase-1].indexOf(atk);
    e.x = p.x + (BOSS_ATTACK[atk].kind==='melee' ? BOSS_ATTACK[atk].reach!-6 : 85); e.y=p.y;
    const ev=step(w,{}), a=BOSS_ATTACK[atk];
    check(`TZ08 R6: ${atk} выбран`,e.atk===atk && e.phase==='windup');
    check(`TZ08 R6: ${atk} tele до active`,a.kind==='melee'||a.kind==='shots'||ev.some(v=>v.t==='tele'));
    // Изолируем основной источник урона: остальные случайные точки вдали.
    if(e.zonePoints) e.zonePoints.forEach((z,i)=>{if(i) {z.x=1400;z.y=260;}});
    if(!dodge && atk==='vstayu') p.x=e.x-80;
    if(dodge) {
      if(atk==='grid') {
        const top=stageOf(w).lane[0][1], bottom=stageOf(w).laneBottom;
        p.y=[top+(bottom-top)/6,top+(bottom-top)/2,top+(bottom-top)*5/6].find(y=>e.bands!.every(b=>Math.abs(y-b.y)>b.h))!;
      } else if(atk==='chorus') p.y=(e.bands![0].y+e.bands![1].y)/2;
      else {p.x=w.enc.lock![1]-20; p.y=260;}
    }
    run(w,a.windupMs-TICK_MS*2);
    check(`TZ08 R6: ${atk} до windup без урона (${dodge})`,p.hp===150);
    run(w,TICK_MS*3+(atk==='shots'?650:atk==='zones'?550:0));
    check(`TZ08 R6: ${atk} ${dodge?'снаружи безопасно':'попадает'}`,dodge?p.hp===150:p.hp<150,`hp=${p.hp}`);
  }
}
{
  const w=createWorld(81,false,'route',4),p=addPlayer(w,'h',HERO_ID);
  p.x=800;p.y=205;
  finishMayakWaves(w); const e=Object.values(w.enemies).find(e=>e.boss)!;
  check('TZ08 R1/R6: после волн enter у сцены',e.x===stageProp(w, 'stage_b')!.x&&e.y===205&&e.phase==='enter'&&e.enterMs===900);
  w.pending.push({ms:0,kind:'hits',owner:p.id,strike:{range:1000,dmg:100,kb:0,stun:0},ids:[e.id]});
  const hp=e.hp; run(w,850);
  check('TZ08 R6: enter неуязвим и не атакует',e.hp===hp&&p.hp===150&&e.phase==='enter'&&!e.token);
  run(w,100); check('TZ08 R6: enter заканчивается',!e.enterMs&&!!e.entered);
}
{
  const {w,p,e}=bossSetup();e.hp=e.maxHp/2;
  step(w,{});const time=w.timeMs,x=p.x;run(w,350,()=>({mx:1}));
  check('TZ08 R4: фазовая пауза замораживает мир',w.timeMs===time&&p.x===x);
}
{
  const {w,e}=bossSetup(); e.hp=0;step(w,{});
  const time=w.timeMs;e.cdMs=1000;
  run(w,300);
  check('TZ08 R6: slow-mo масштабирует часы sim',Math.abs(w.timeMs-time-90)<TICK_MS);
  run(w,650);check('TZ08 R6: slow-mo завершено, начинается fall',!w.slowmoMs&&e.anim==='down');
}
// Длительные и отложенные атаки используют часы симуляции.
{
  const {w,p,e}=bossSetup(); forceBossAttack(e,'pyro'); e.zonePoints=[{x:p.x,y:p.y}];
  run(w,920);check('TZ08 R6: pyro первый тик 7',p.hp===143);
  run(w,400);check('TZ08 R6: pyro второй тик через 400',p.hp===136);
  run(w,400);check('TZ08 R6: pyro третий тик через 400',p.hp===129);
}
{
  const {w,p,e}=bossSetup();forceBossAttack(e,'salute');
  e.zonePoints=Array.from({length:9},(_,i)=>({x:i===8?p.x:1400,y:i===8?p.y:250}));
  run(w,1640);check('TZ08 R6: девятая точка салюта ещё безопасна',p.hp===150);
  run(w,40);check('TZ08 R6: девятая точка салюта в свою очередь',p.hp===141);
}
{
  const {w,p,e}=bossSetup('pizdulina');forceBossAttack(e,'shots');p.y=180;
  run(w,1020);check('TZ08 R3: shots выпускает 4 печати',e.shotCount===4);
}
// TZ-09: каждая уличная волна входит за 3 с при героине у правого края.
for (const [index, encounter] of ENCOUNTERS.street.entries()) {
  for (const [wave, spawns] of encounter.waves.entries()) {
    const w = createWorld(91, false), p = addPlayer(w, 'h', HERO_ID);

    w.enc.index = w.enc.cleared = index;
    p.x = encounter.trigger; step(w, {});
    w.enemies = {}; w.enc.wave = encounter.waves.length - 1; w.enc.queue = [...spawns];
    const x1 = encounter.arena[1]; p.x = x1 - 20; p.invulnMs = 10000;
    step(w, {});
    run(w, 5000);
    const ids = Object.keys(w.enemies);
    check(`TZ09 R5: улица ${index + 1}, волна ${wave + 1}, вход за 5 с`,
      ids.length === spawns.length && ids.every(id => w.enemies[id]?.entered && w.enemies[id].x <= x1 + 40));
    let tested = 0, vulnerable = true;
    for (const e of Object.values(w.enemies)) {
      if (e.hp <= 0 || e.x > x1 + 40 || Math.abs(e.x - p.x) >= STRIKES.prime.jab.range * RANGE_MULT) continue;
      const copy = structuredClone(w), hero = copy.players.h, target = copy.enemies[e.id];
      hero.y = target.y; hero.facing = target.x >= hero.x ? 1 : -1;
      hero.move = 'jab'; hero.moveT = 0;
      const hp = target.hp;
      step(copy, {}, hitTimesMs('prime', 'jab', hero.facing)[0] + 1);
      vulnerable &&= target.hp < hp; tested++;
    }
    check(`TZ09 R5: улица ${index + 1}, волна ${wave + 1}, видимые в радиусе получают джеб`, vulnerable && tested > 0, `целей=${tested}`);
  }
}
for (const kind of ['vatnik', 'clerk', 'zek', 'omon', 'pizdulina'] as const) {
  const w = createWorld(94, false), p = addPlayer(w, 'h', HERO_ID);
  p.x = 300; step(w, {});
  const e = Object.values(w.enemies)[0];
  if (kind === 'pizdulina') { e.boss = kind; w.enc.bossStarted = true; }
  else { e.kind = kind; if (kind === 'omon') w.enc.bossStarted = true; }
  const x = e.x; step(w, {});
  check(`TZ09 R2: ${kind} бежит со скоростью 150`, Math.abs(x - e.x - ENTER_SPEED * TICK_MS / 1000) < 0.001 && e.anim === 'run');
}
// Уязвимость на пороге входа без скачка к внутренней границе.
for (const offset of [40.1, 40, 20]) {
  const w = createWorld(92, false), p = addPlayer(w, 'h', HERO_ID);
  p.x = 300; step(w, {});
  const e = Object.values(w.enemies)[0]; w.enemies = { [e.id]: e };
  p.x = 700; p.y = e.y; p.invulnMs = 10000;
  e.x = 720 + offset; e.cdMs = 10000;
  const hp = e.hp, x = e.x;
  // Джеб применяется до движения врага; здесь проверяем сам порог уязвимости.
  p.move = 'jab'; p.moveT = 0;
  const dt = hitTimesMs('prime', 'jab', 1)[0] + 1;
  step(w, {}, dt);
  check(`TZ09 R3: порог x1+${offset}`, offset <= 40 ? e.entered === true && e.hp < hp : e.hp === hp);
  check(`TZ09 R3: плавный вход x1+${offset}`, e.x >= x - ENTER_SPEED * dt / 1000 - 0.001 && e.x > 708);
  run(w, 600);
  check(`TZ09 R3: дошёл до внутренней границы x1+${offset}`, !!e.entered && !e.entering && e.x <= 708);
}
// Fast не выходит из арены ни в замахе, ни в активной части рывка.
for (const dir of [-1, 1] as const) {
  const w = createWorld(93, false), p = addPlayer(w, 'h', HERO_ID);
  p.x = 300; step(w, {});
  const e = Object.values(w.enemies)[0];
  Object.assign(e, { kind: 'zek', entered: true, x: dir > 0 ? 700 : 260, y: 220,
    phase: 'windup', phaseMs: ROLE.fast.windupMs, token: p.id, atkDir: dir, atkY: 220 });
  // Остальные ещё входят; героиня стоит справа, как в отзыве.
  p.x = 700; p.y = 220; p.invulnMs = 10000;
  let bounded = true, active = false;
  for (let t = 0; t < 1000; t += TICK_MS) {
    step(w, {}); active ||= e.phase === 'active';
    bounded &&= e.x >= 252 && e.x <= 708;
  }
  check(`TZ09 R4: fast windup/active dir=${dir} в границах арены`, bounded && active);
}
// TZ-11: метки сильного удара, добивания и обычного вражеского попадания.
for (const hp of [1000, 1]) {
  const { w } = setup(); dummy(w, 'e1', 24, hp);
  const hits = [];
  for (let t = 0; t < 700; t += TICK_MS) {
    hits.push(...step(w, { h: { ...emptyInput(), heavy: t === 0 } }).filter(e => e.t === 'hit'));
  }
  const hit = hits.find(e => e.t === 'hit' && e.target === 'e1');
  check('TZ11 uppercut ' + (hp === 1 ? 'kill' : 'impact'), hit?.t === 'hit' && (hp === 1 ? hit.kill === true && hit.impact === 2 : hit.impact === 1 && !hit.kill));
}
{
  const { w, p } = setup(); dummy(w, 'e1', 24);
  const e = w.enemies.e1;
  e.phase = 'windup'; e.phaseMs = 1; e.atkDir = -1; e.token = p.id; e.atkX = p.x; e.atkY = p.y;
  const hit = step(w, {}).find(e => e.t === 'hit' && e.target === p.id);
  check('TZ11 враг без impact', hit?.t === 'hit' && hit.impact === undefined && hit.kill === undefined);
}
function ramilDummy(w: World, id: string, dx: number) { dummy(w, id, dx); w.enemies[id].slowMs = 1e8; w.enemies[id].slow = 1; }

{
  const { w, p } = setup(false, 'ramil'); ramilDummy(w, 'e1', 40); ramilDummy(w, 'e2', 50); ramilDummy(w, 'e3', 60);
  const origin = p.x;
  run(w, 650, press([0], 'heavy'));
  check('Рамиль: b1 без меток', !p.ramil?.marks.length && Object.values(w.enemies).every(e => !e.markedBy));
  check('Рамиль: b1 дальнему', w.enemies.e3.hp === 995 && p.x === w.enemies.e3.x + RAMIL.TELE_GAP);
  run(w, 750, press([0], 'heavy'));
  check('Рамиль: b2 метит двоих', p.ramil?.marks.length === 2 && !w.enemies.e1.markedBy);
  check('Рамиль: b2 урон и падение', w.enemies.e2.hp === 980 && w.enemies.e3.hp === 975 && w.enemies.e2.anim === 'down', `${w.enemies.e2.hp}/${w.enemies.e3.hp}/${w.enemies.e2.anim}`);
  run(w, 400);
  run(w, 1250, press([0], 'heavy'));
  check('Рамиль: b3 огонь', p.move === 'idle' && p.bCombo === 3);
  const marks = p.ramil!.marks.map(id => w.enemies[id]);
  const nearest = marks.sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
  const hp = marks.map(e => e.hp);
  run(w, 650, press([0], 'heavy'));
  check('Рамиль: b4 к ближайшему, снимает метки', Math.abs(p.x - nearest.x) === 40 && !p.ramil?.marks.length && marks.every(e => !e.markedBy));
  check('Рамиль: b4 урон всем меткам рядом', marks.every((e, i) => e.hp === hp[i] - 6));
  run(w, RAMIL.B_COOLDOWN_MS + TICK_MS);
  p.bCombo = 3; p.bComboMs = 1200; run(w, 650, press([0], 'heavy'));
  check('Рамиль: b4 без меток к началу b1', p.x === origin);
}
{
  const { w, p } = setup(false, 'ramil'); ramilDummy(w, 'e1', 80); p.bCombo = 2; p.bComboMs = 1200;
  const result = run(w, 4500, press([0], 'heavy'));
  check('Рамиль: огонь один раз и 6 тиков', result.hits.length === 7 && result.hits.every(d => d === 3), result.hits.join());
}
{
  const { w, p } = setup(false, 'ramil'); ramilDummy(w, 'offscreen', 800); p.ult = 100;
  run(w, 100, press([0], 'ult'));
  check('Рамиль: пустая ульта не тратит заряд', p.ult === 100);
  w.enemies.offscreen.x = p.x + 800;
  check('Рамиль: пустой b1 не начинается', !run(w, 100, press([0], 'heavy')).log.includes('b1'));
}
{
  const { w, p } = setup(false, 'ramil');
  run(w, 1000, () => ({ ult2: true, mx: 1 }));
  check('Рамиль: перекур 20/с', Math.abs(p.ult - 20) < 0.5, `${p.ult}`);
  check('Рамиль: при перекуре стоит', p.x === 200 && p.move === 'smoke');
  const u = p.ult;
  run(w, 500);
  check('Рамиль: отпускание прекращает перекур', p.ult === u && p.move === 'idle');
  ramilDummy(w, 'e1', 24);
  const e = w.enemies.e1; e.phase = 'windup'; e.phaseMs = 1; e.atkDir = -1; e.token = p.id; e.atkX = p.x; e.atkY = p.y;
  step(w, { h: { ...emptyInput(), ult2: true } });
  check('Рамиль: удар прерывает перекур', p.hp < 150 && p.move === 'hurt');
  const after = p.ult; run(w, 200, () => ({ ult2: true }));
  check('Рамиль: hurt не копит заряд', p.ult === after);
  run(w, 1000);
  const done = run(w, 5100, () => ({ ult2: true }));
  check('Рамиль: полный заряд + реплика', p.ult === 100 && done.events.includes('taunt:' + LINES.ready[3]));
  check('Рамиль: реплики перекура', done.events.some(e => e.includes('подождите, докурю')));
}


{
  const { w, p } = setup(false, 'ramil'); ramilDummy(w, 'e1', 50);
  w.enc.lock = [0, 1000]; w.enemies.e1.entered = true; w.introduced.push('omon');
  p.bCombo = 1; p.bComboMs = 1200;
  const start = w.enemies.e1.x;
  run(w, 750, press([0], 'heavy'));
  check('Рамиль: b2 полный полёт 300 в арене', w.enemies.e1.x === start + 300, `${start}->${w.enemies.e1.x}`);
}
{
  const { w, p } = setup(false, 'ramil'); ramilDummy(w, 'e1', 100);
  run(w, 500, press([0], 'heavy'));
  delete w.enemies.e1; ramilDummy(w, 'far', 800);
  p.bCombo = 3; p.bComboMs = 1200;
  run(w, 500, press([0], 'heavy'));
  check('Рамиль: b4 при смерти метки возвращает к b1', p.x === 200 && !p.ramil?.marks.length);
}
{
  const { w, p } = setup(false, 'ramil'); ramilDummy(w, 'e1', 100);
  const b = addPlayer(w, 'ally', NADYA_ID); b.x = 450; b.y = 200;
  run(w, 500, press([0], 'heavy'));
  run(w, 1150, press([0], 'heavy'));
  p.bCombo = 3; p.bComboMs = 1200;
  run(w, 500, press([0], 'heavy'));
  check('Рамиль: b4 со стороны союзника', p.x === w.enemies.e1.x + 40);
}

// TZ15: новая серия и шестиступенчатая ульта.
for (const dx of [40, 56, 57, 120, 200, 201, 220]) {
  const {w} = setup(false,'ramil'); ramilDummy(w,'e',dx);
  const r = run(w,700,press([0],'attack'));
  check(`TZ15 a1 ${dx}: рывок`, r.events.includes('rdash') === (dx > RAMIL.A1_REACH && dx <= RAMIL.A1_DASH_MAX), r.events.join());
  check(`TZ15 a1 ${dx}: попадание`, w.enemies.e.hp === (dx > RAMIL.A1_DASH_MAX ? 1000 : 992));
}
function grabSetup() {
  const {w,p} = setup(false,'ramil'); ramilDummy(w,'held',40);
  p.combo = 1; p.comboMs = 1000; run(w,450,press([0],'attack'));
  return {w,p,e:w.enemies.held};
}
{
  const {w,p,e} = grabSetup();
  check('TZ15 захват и удержание', e.held?.by === p.id && p.move === 'a2-hold' && e.hp === 996);
  const x = e.x, hp = e.hp;
  const ally = addPlayer(w,'ally',NADYA_ID); ally.x = e.x-30; ally.y = e.y;
  step(w,{ally:{...emptyInput(),attack:true}}); run(w,300);
  check('TZ15 союзник бьёт без отброса', e.hp < hp && e.x === x);
  run(w,2600); check('TZ16 таймаут отпускает', !e.held && p.combo === 0);
}
{
  const {w,p,e} = grabSetup();
  ramilDummy(w,'attacker',-24); const a = w.enemies.attacker;
  a.phase='windup'; a.phaseMs=1; a.atkDir=1; a.token=p.id; a.atkX=p.x; a.atkY=p.y;
  step(w,{}); check('TZ15 урон отпускает захват', p.hp < 150 && !e.held && p.combo === 0);
}
for (const boss of [false,true]) {
  const {w,p} = setup(false,'ramil');
  if (boss) { ramilDummy(w,'e',40); w.enemies.e.boss='shaman'; }
  p.combo=1; p.comboMs=1000; run(w,600,press([0],'attack'));
  check('TZ15 a2 сброс '+boss, p.combo === 0 && !p.ramil?.grab && (!boss || w.enemies.e.hp === 996));
  run(w,500,press([0],'attack')); check('TZ15 a3 без захвата недоступна '+boss, !p.move.startsWith('a3'));
}
{
  const {w,p,e} = grabSetup();
  for (let i=0;i<3;i++) ramilDummy(w,'group'+i,150+i*10);
  ramilDummy(w,'single',-100);
  const events: import('@bc/shared').SimEvent[] = [];
  let landing: {x:number;y:number}|undefined;
  for (let t=0;t<4000;t+=TICK_MS) {
    const ev = step(w,{h:{...emptyInput(),attack:t===0}}); events.push(...ev);
    const hit = ev.find(v=>v.t==='rland'); if(hit?.t==='rland') landing=hit;
  }
  check('TZ15 бросок в группу', !!landing && landing.x > p.x+120);
  check('TZ15 приземление 3 целей', [0,1,2].every(i=>w.enemies['group'+i].hp === 984));
  check('TZ17 захваченный 6 оборотов и приземление', e.hp === 958 && !e.held && !e.thrown, String(e.hp));
  check('TZ15 бросок сбрасывает серию', p.combo === 0 && events.some(v=>v.t==='rland'));
}
{
  const {w,e} = grabSetup(); ramilDummy(w,'near',-50);
  const hp = w.enemies.near.hp; const r = run(w,RAMIL.SPIN_MS + 3*TICK_MS,press([0],'attack'));
  check('TZ17 ураган шесть оборотов', r.hits.filter(d=>d===3).length === 6 && e.hp === 978, r.hits.join() + ':' + e.hp);
  check('TZ16 ураган бьёт другого', w.enemies.near.hp === hp-6, String(w.enemies.near.hp));
}
for (const full of [false,true]) {
  const {w,p} = setup(false,'ramil'); ramilDummy(w,'e',40); p.ult=100;
  let hits=0, finals=0, max=0;
  for(let t=0;t<16000;t+=TICK_MS) {
    const active=p.ramil?.ult;
    const ev = step(w,{h:{...emptyInput(),ult:t===0,attack:full && !!active && !active.buffered}});
    hits+=ev.filter(v=>v.t==='flurry').length; finals+=ev.filter(v=>v.t==='rfinish').length;
    max=Math.max(max,p.ultLevel??0);
  }
  check('TZ15 ульта число ударов '+full,hits===(full?126:2) && finals===1,`${hits}/${finals}`);
  check('TZ15 ульта ступени '+full,max===(full?6:1) && !p.ramil?.ult && p.ult===0);
}
{
  const {w,p} = setup(false,'ramil'); ramilDummy(w,'off',800); p.ult=100; run(w,500,press([0],'ult'));
  check('TZ15 без целей заряд сохранён',p.ult===100 && !p.ramil?.ult);
}
for(let level=0;level<6;level++) {
  const {w,p}=setup(false,'ramil'); ramilDummy(w,'e',40); p.ult=100;
  step(w,{h:{...emptyInput(),ult:true}});
  const u=p.ramil!.ult!; u.level=level; u.dashMs=undefined; u.ms=0; p.move='u'+(level+1); p.moveT=0; p.ultLevel=level+1;
  const timing=flurryTiming(p.move,1); const at:number[]=[]; let elapsed=0;
  while(elapsed<timing.activeMs+2*TICK_MS) {
    elapsed+=TICK_MS;
    for(const ev of step(w,{})) if(ev.t==='flurry') at.push(elapsed);
    if(u.window || u.finish!==undefined) break;
  }
  check('TZ15 тайминг со стопами '+level,at.length===timing.count && at.every((t,k)=>t>=timing.stops[k] && t-timing.stops[k]<=TICK_MS),at.join());
  check('TZ15 длительность ступени '+level,Math.abs(elapsed-timing.activeMs)<=TICK_MS);
  check('TZ15 поза попадания '+level,timing.stops.every((t,k)=>flurryPose('u'+(level+1),t+0.001,1).frame===timing.marks[k%timing.marks.length]));
  if(level===0) {
    check('TZ15 окно 800',u.window===800);
    run(w,700); check('TZ15 окно ещё открыто',!!p.ramil?.ult && (p.ultWindow??0)>0);
    run(w,150); check('TZ15 окно закончилось финалом',p.ramil?.ult?.finish!==undefined);
  }
}

{
  const {w,p}=setup(false,'ramil'); ramilDummy(w,'boss',40); w.enemies.boss.boss='shaman'; p.ult=100;
  run(w,1100,press([0],'ult'));
  check('TZ15 ульта оглушает босса в окне', (w.enemies.boss.stunMs??0)>0 && (p.ultWindow??0)>0);
  step(w,{h:{...emptyInput(),ult:true}});
  check('TZ15 U в окне продолжает',p.ultLevel===2 && p.ramil?.ult?.level===1);
}
{
  const {w,p}=setup(false,'ramil'); ramilDummy(w,'behind',-100); p.ult=100;
  run(w,250,press([0],'ult'));
  check('TZ15 ульта разворот и рывок к видимой цели сзади',p.facing===-1 && p.ult===0 && p.x<200);
}

{
  const {w,p}=setup(false,'ramil'); ramilDummy(w,'e',40); p.combo=1; p.comboMs=1000;
  step(w,{h:{...emptyInput(),attack:true}});
  for(let t=0;t<1000 && p.move!=='a2-hold';t+=TICK_MS) step(w,{});
  let elapsed=0;
  while(w.enemies.e.held && elapsed<3000) { step(w,{}); elapsed+=TICK_MS; }
  check('TZ15 удержание ровно 2500 ± тик',elapsed>=RAMIL.GRAB_HOLD_MS && elapsed-RAMIL.GRAB_HOLD_MS<=TICK_MS,String(elapsed));
}
{
  const {w,p}=grabSetup(); ramilDummy(w,'near',40);
  let hits=0; step(w,{h:{...emptyInput(),attack:true}});
  for(let t=0;t<2500 && p.move!=='a3-throw';t+=TICK_MS) {
    const e=w.enemies.near; e.x=p.x+40; e.y=p.y; e.pin=undefined;
    hits+=step(w,{}).filter(v=>v.t==='hit' && v.target==='near' && v.dmg===6).length;
  }
  check('TZ17 по 6 урона за каждый из 6 оборотов',hits===6,String(hits));
  check('TZ17 каждый оборот задевает врага ровно раз', [0,1,2,3,4,5].every(turn => p.ramil!.spinHits!.filter(key => key === turn+':near').length === 1));
}

// TZ16: движение, точные фазы метеора, независимость от хозяина и защита полёта.
for (const sign of [-1,1]) {
  const {w,p,e} = grabSetup(); const x=p.x, y=p.y;
  step(w,{h:{...emptyInput(),mx:sign,my:1,run:true}});
  check('TZ16 ход с захватом '+sign, Math.abs(p.x-x-sign*90*0.6*TICK_MS/1000)<1e-6 && Math.abs(p.y-y-90*0.7*0.6*TICK_MS/1000)<1e-6 && p.move==='a2-walk' && p.facing===sign && !!e.held);
  step(w,{}); check('TZ16 остановка с захватом '+sign,p.move==='a2-hold');
  step(w,{h:{...emptyInput(),attack:true}});
  const sx=p.x; step(w,{h:{...emptyInput(),mx:sign}});
  check('TZ16 ход урагана '+sign, Math.abs(p.x-sx-sign*90*0.5*TICK_MS/1000)<1e-6 && p.move==='a3-spin' && p.invulnMs>0);
  let elapsed=TICK_MS;
  while(p.move==='a3-spin' && elapsed<1200) { step(w,{}); elapsed+=TICK_MS; }
  check('TZ17 бросок сразу без ввода '+sign,p.move==='a3-throw' && p.moveT===-1);
  check('TZ17 ураган ровно 1000 ± тик '+sign,elapsed>=1000 && elapsed-1000<TICK_MS,String(elapsed));
}
{
  const {w,e} = grabSetup();
  for(let i=0;i<3;i++) ramilDummy(w,'cluster'+i,180+i*10);
  const tx = (w.enemies.cluster0.x+w.enemies.cluster1.x+w.enemies.cluster2.x)/3;
  step(w,{h:{...emptyInput(),attack:true}});
  for(let t=0;t<2000 && !e.thrown;t+=TICK_MS) step(w,{});
  check('TZ16 метеор выбирает центр группы',!!e.thrown && Math.abs(e.thrown.x-tx)<1e-6);
  let elapsed=0, protectedFlight=true, landed=false, aoeDown=false;
  const ally=addPlayer(w,'ally',NADYA_ID);
  const hp=e.hp;
  while(e.thrown && elapsed<1200) {
    ally.x=e.x-25; ally.y=e.y;
    const events=step(w,{ally:{...emptyInput(),attack:true}}); elapsed+=TICK_MS;
    if(e.thrown && e.hp!==hp) protectedFlight=false;
    if(events.some(v=>v.t==='rland')) { landed=true; aoeDown=[0,1,2].every(i=>w.enemies['cluster'+i].anim==='down' && events.some(v=>v.t==='hit' && v.target==='cluster'+i && v.dmg===16)); }
  }
  check('TZ17 метеор 200+270+110 ± тик',landed && elapsed>=580 && elapsed-580<TICK_MS,String(elapsed));
  check('TZ16 полёт недоступен союзным ударам',protectedFlight);
  check('TZ16 все цели в радиусе лежат',aoeDown);
  check('TZ16 брошенный получает 20',e.hp===hp-20);
}
{
  const {w}=grabSetup(); ramilDummy(w,'near',-28);
  step(w,{h:{...emptyInput(),attack:true}});
  let tangent=false;
  for(let t=0;t<950;t+=TICK_MS) {
    const ev=step(w,{});
    if(ev.some(v=>v.t==='rspinHit')) {
      tangent=w.enemies.near.pin?.dir===-1; break;
    }
  }
  check('TZ16 касательная первой полуволны влево',tangent);
  check('TZ16 задетый стоп 40 мс',(w.enemies.near.ultStopMs??0)>=40);
}
{
  const {w,p,e}=grabSetup(); step(w,{h:{...emptyInput(),attack:true}});
  for(let t=0;t<2000 && !e.thrown;t+=TICK_MS) step(w,{});
  const hp=p.hp; p.invulnMs=0;
  ramilDummy(w,'attacker',-24); const a=w.enemies.attacker;
  a.phase='windup'; a.phaseMs=1; a.atkDir=1; a.token=p.id; a.atkX=p.x; a.atkY=p.y;
  step(w,{});
  check('TZ16 Рамиля можно бить после подкида',p.hp<hp && !!e.thrown && p.combo===0);
  addPlayer(w,'buddy',NADYA_ID); p.hp=0; const r=run(w,1100);
  check('TZ16 метеор долетает после поражения Рамиля',!e.thrown && r.events.includes('rland'));
}

// TZ-18A: смена всех героев во время атаки, очистка связей и тестовый режим.
for (const from of CHARACTERS) for (const to of CHARACTERS) {
  if (from.id === to.id) continue;
  const { w, p } = setup(false, from.id); ramilDummy(w, 'e', 100);
  step(w, { h: { ...emptyInput(), attack: true } });
  check(`TZ18 ${from.id} → ${to.id}: посреди атаки`, p.move !== 'idle');
  p.hp = 63; p.ult = 47; p.facing = -1; p.connected = false; p.away = true; p.god = true;
  p.cdMs = p.tauntCdMs = p.hitstopMs = p.stormMs = p.stormTickMs = p.formMs = p.invulnMs = 500;
  p.combo = p.bCombo = 2; p.comboMs = p.bComboMs = 500; p.queued = 'heavy';
  p.charge2 = 100; p.wantBall = true; p.hitCount = 8; p.hitCountMs = 300; p.ultimateExtraMs = 200;
  p.fDashMs = p.hiddenMs = p.heavySmokeMs = p.fireMs = p.ultLevel = p.ultWindow = 500;
  p.approach = { x: p.x, y: p.y, tx: p.x + 80, ty: p.y, ms: 500, rush: true, target: 'e' };
  p.hop = { from: p.x, to: p.x + 80 }; p.dashFrom = p.x; p.charmSaid = true;
  check(`TZ18 ${from.id} → ${to.id}: успех`, switchHero(w, p.id, to.id));
  const q = w.players.h;
  check(`TZ18 ${from.id} → ${to.id}: сохранение`, q.id === p.id && q.char === to.id && q.x === p.x && q.y === p.y && q.facing === -1
    && q.hp / PLAYER_HP === p.hp / PLAYER_HP && q.ult === 47 && !q.connected && q.away && q.god === true);
  check(`TZ18 ${from.id} → ${to.id}: сброс боя`, q.anim === 'idle' && q.move === 'idle' && q.form === HERO_FORM[to.id]
    && [q.animMs,q.moveT,q.cdMs,q.tauntCdMs,q.downMs,q.formMs,q.invulnMs,q.hitstopMs,q.stormMs,q.stormTickMs,q.combo,q.comboMs,q.bCombo,q.bComboMs,q.charge2,q.dashFrom,q.hitCount,q.hitCountMs,q.ultimateExtraMs].every(n => n === 0)
    && !q.queued && !q.ramil && !q.approach && !q.hop && !q.wantBall && !q.charmSaid
    && !q.fDashMs && !q.hiddenMs && !q.heavySmokeMs && !q.fireMs && !q.ultLevel && !q.ultWindow);
  const ev = step(w, {});
  check(`TZ18 ${from.id} → ${to.id}: событие один раз`, ev.some(e => e.t === 'switch' && e.id === p.id && e.char === to.id) && !step(w, {}).some(e => e.t === 'switch'));
}
{
  const { w, p, e } = grabSetup(); const hp = e.hp;
  check('TZ18 смена во время захвата', !!e.held && switchHero(w, p.id, KRIS_ID));
  check('TZ18 враг освобождён стоя без урона', !e.held && !e.thrown && !e.pin && !e.height && !e.carryAngle && !e.carryHeight && e.anim === 'idle' && e.animMs === 0 && e.hp === hp);
}
{
  const { w, p, e } = grabSetup(); step(w, { h: { ...emptyInput(), attack: true } });
  for (let i = 0; i < 100 && !e.thrown; i++) step(w, {});
  const hp = e.hp;
  check('TZ18 метеор уже летит', !!e.thrown);
  switchHero(w, p.id, NADYA_ID);
  check('TZ18 метеор отпущен стоя без урона', !e.thrown && !e.held && e.anim === 'idle' && !e.carryHeight && e.hp === hp);
}
{
  const { w, p } = setup(false, KRIS_ID); ramilDummy(w, 'e', 40); p.charge2 = 100;
  for (let i = 0; i < 100 && !w.pending.some(d => d.kind === 'aoe'); i++) step(w, { h: { ...emptyInput(), ult2: i === 0 } });
  const hp = w.enemies.e.hp;
  check('TZ18 шар Kris в полёте', w.pending.some(d => d.owner === p.id && d.kind === 'aoe'));
  switchHero(w, p.id, NADYA_ID);
  check('TZ18 шар отменён после смены', !w.pending.some(d => d.owner === p.id));
  const r = run(w, 1500);
  check('TZ18 шар не бьёт от нового героя', w.enemies.e.hp === hp && !r.events.includes('boom'));
}
{
  const { w, p } = setup(false, 'ramil'); ramilDummy(w, 'own', 40); ramilDummy(w, 'other', 300);
  const e = w.enemies.own, other = w.enemies.other;
  Object.assign(e, { markedBy: p.id, burnBy: p.id, burnMs: 900, burnTickMs: 100, charmBy: p.id, charmMs: 800,
    pin: { by: p.id, ms: 200, dir: 1, speed: 1, hit: [] }, token: p.id, target: p.id, targetMs: 800, phase: 'windup',
    ultStopBy: p.id, ultStopMs: 600, ultStunBy: p.id, stunMs: 600, frozenBy: p.id, frozenMs: 800 });
  Object.assign(other, { burnBy: 'buddy', burnMs: 900, ultStopBy: 'buddy', ultStopMs: 600 });
  w.pending.push({ owner: p.id, kind: 'hits', ms: 500, ids: ['own'], strike: { range: 20, dmg: 50, kb: 0, stun: 0 } },
    { owner: 'buddy', kind: 'hits', ms: 500, ids: ['own'], strike: { range: 20, dmg: 50, kb: 0, stun: 0 } });
  switchHero(w, p.id, HERO_ID);
  check('TZ18 внешние связи сняты', !e.markedBy && !e.burnBy && !e.burnMs && !e.burnTickMs && !e.charmBy && !e.charmMs && !e.pin && !e.token && !e.target && !e.targetMs && e.phase === 'none' && !e.ultStopMs && !e.stunMs && !e.frozenMs);
  check('TZ18 эффекты союзника сохранены', other.burnBy === 'buddy' && other.burnMs === 900 && other.ultStopMs === 600 && w.pending.length === 1 && w.pending[0].owner === 'buddy');
}
for (const char of ['ramil', HERO_ID]) {
  const { w, p } = setup(false, char); ramilDummy(w, 'e', 40); p.ult = 100;
  step(w, { h: { ...emptyInput(), ...(char === 'ramil' ? { ult: true } : { ult2: true }) } });
  for (let i = 0; i < 40 && !(w.enemies.e.ultStopMs || w.enemies.e.frozenMs); i++) step(w, {});
  const e = w.enemies.e;
  check(`TZ18 ${char}: остановка ультой`, !!(e.ultStopMs || e.frozenMs));
  switchHero(w, p.id, NADYA_ID);
  check(`TZ18 ${char}: остановка ультой снята`, !e.ultStopMs && !e.stunMs && !e.frozenMs);
}
{
  const { w, p } = setup(); addPlayer(w, 'buddy', NADYA_ID);
  for (const char of [HERO_ID, NADYA_ID, 'unknown']) {
    const before = JSON.stringify(w);
    check(`TZ18 отказ ${char} без изменений`, !switchHero(w, p.id, char) && JSON.stringify(w) === before);
  }
  check('TZ18 нет игрока', !switchHero(w, 'missing', KRIS_ID));
  w.trans = { ms: 900, to: 1 }; check('TZ18 переход запрещает смену', !switchHero(w, p.id, KRIS_ID)); w.trans = undefined;
  w.pauseMs = 400; check('TZ18 смена фазы запрещает смену', !switchHero(w, p.id, KRIS_ID)); w.pauseMs = 0;
  w.won = true; check('TZ18 финал запрещает смену', !switchHero(w, p.id, KRIS_ID));
}
{
  const { w, p } = setup(); dummy(w, 'e', 24); p.hp = 20; p.ult = 21;
  const before = JSON.stringify(w);
  testHeal(w); testGod(w, p.id, true); testKillAll(w); chargeUlt(w, p.id); spawnEnemies(w, 3); nextStage(w);
  check('TZ18 все тестовые функции без режима не меняют мир', JSON.stringify(w) === before);
}
{
  const { w, p } = setup(); w.testTools = true; const b = addPlayer(w, 'buddy', NADYA_ID);
  p.hp = 20; p.ult = 37; b.hp = 0; b.move = 'fall'; b.anim = 'down'; b.downMs = 5000; b.connected = false; b.away = true;
  testGod(w, b.id, true); testHeal(w);
  check('TZ18 лечение всех, включая лежащего отключённого', p.hp === PLAYER_HP && p.ult === 37 && b.hp === PLAYER_HP && b.move === 'idle' && (b.anim as string) === 'idle' && b.downMs === 0 && !b.connected && b.away && b.god === true);
}
{
  const { w, p, e } = arenaSetup(); testGod(w, p.id, true);
  const hp = p.hp; const r = run(w, 2000);
  check('TZ18 бессмертие блокирует удары', p.god === true && p.hp === hp && r.hits.length === 0);
  testGod(w, p.id, false); p.invulnMs = 0; e.cdMs = 0; run(w, 1500);
  check('TZ18 выключение бессмертия возвращает урон', p.god === false && p.hp < hp);
}
{
  const w = createWorld(18, true); const p = addPlayer(w, 'h', HERO_ID); p.x = 300;
  step(w, {}); const index = w.enc.index; const cleared = w.enc.cleared;
  for (let i = 0; i < 100 && w.enc.cleared === cleared; i++) { testKillAll(w); step(w, {}); }
  check('TZ18 killAll засчитывает встречу обычным путём', w.enc.cleared === cleared + 1 && w.enc.index === index + 1 && !w.enc.lock);
}
{
  const { w, p, e } = arenaSetup(); e.boss = 'shaman'; e.hp = 400; e.invulnMs = 1000;
  ramilDummy(w, 'held', 40); const held = w.enemies.held; held.held = { by: p.id }; held.dummy = true;
  testKillAll(w);
  check('TZ18 killAll оставляет боссу 1 HP и убивает захваченного манекена', e.hp === 1 && held.hp === 0 && !held.held && !held.dummy);
  const ev = step(w, {});
  check('TZ18 killAll даёт событие смерти и удаление', !w.enemies.held && ev.some(v => v.t === 'hit' && v.target === held.id && v.kill === true));
}

// TZ19: сюжетные события проходят тем же путём в локальной и серверной sim.
for (const [i, ch] of CHARACTERS.entries()) {
  const { w, p } = setup(false, ch.id); dummy(w, 'e1', 800);
  p.ult = 100;
  const ev = step(w, {});
  check(`TZ19 ${ch.name}: ульта готова`, ev.some(e => e.t === 'taunt' && e.id === p.id && e.line === LINES.ready[i]));
  check(`TZ19 ${ch.name}: готовность один раз`, !step(w, {}).some(e => e.t === 'taunt' && e.line === LINES.ready[i]));
}
{
  const { w, p } = setup(false, KRIS_ID); dummy(w, 'e1', 800); p.charge2 = 100;
  check('TZ19 шар Kris не считается ультой', !step(w, {}).some(e => e.t === 'taunt'));
}
for (const boss of ['shaman', 'pizdulina'] as const) {
  const { w } = setup(); dummy(w, 'e1', 100);
  w.enemies.e1.boss = boss; w.introduced.push(boss);
  w.enemies.e1.hp = 0;
  const down = step(w, {});
  check(`TZ19 ${boss}: bossDown раньше последних слов`, down.some(e => e.t === 'bossDown') && !down.some(e => e.t === 'taunt' && e.line === LINES.last[boss]));
  const result = run(w, 1800);
  check(`TZ19 ${boss}: последние слова`, result.events.includes('taunt:' + LINES.last[boss]));
}
for (const [i, ch] of CHARACTERS.entries()) {
  if (ch.id === HERO_ID) continue;
  let found = false;
  for (let seed = 1; seed < 30 && !found; seed++) {
    const { w } = setup(); w.seed = seed; dummy(w, 'e1', 800);
    const fallen = addPlayer(w, 'friend', ch.id); fallen.hp = 1; fallen.invulnMs = 0;
    w.shots.push({ x: fallen.x, y: fallen.y, dir: 1, speed: 0, dmg: 10 });
    const ev = step(w, {});
    found = ev.some(e => e.t === 'taunt' && e.id === 'h' && e.line === `${CALL_NAMES[i]}, вставай!`);
  }
  check(`TZ19 друг упал: ${ch.name}`, found);
}
{
  const make = () => {
    const { w } = setup(); dummy(w, 'e1', 800);
    const b = addPlayer(w, 'friend', NADYA_ID); b.hp = 1; b.invulnMs = 0;
    w.shots.push({ x: b.x, y: b.y, dir: 1, speed: 0, dmg: 10 });
    return w;
  };
  const a = make(), b = make();
  let same = true;
  for (let i = 0; i < 200; i++) if (JSON.stringify(step(a, {})) !== JSON.stringify(step(b, {}))) same = false;
  check('TZ19 одинаковый seed: одинаковые события и мир', same && JSON.stringify(a) === JSON.stringify(b));
}

{
  const { w, p } = setup(); dummy(w, 'e1', 800); p.hp = 1; p.invulnMs = 0;
  w.shots.push({ x: p.x, y: p.y, dir: 1, speed: 0, dmg: 10 });
  check('TZ19 ты упал: говорит упавший до рестарта', step(w, {}).some(e => e.t === 'taunt' && e.id === p.id && e.line === LINES.down[0]));
}
{
  const w = createWorld(7, false); const p = addPlayer(w, 'h', HERO_ID);
  w.enc.cleared = w.enc.index = 1;
  step(w, {}); const first = w.storyPushes![0];
  step(w, {});
  check('TZ19 push.1 один раз', first > 0 && w.storyPushes![0] === first);
  w.enc.cleared = w.enc.index = 2; step(w, {});
  check('V3 push.2 после арки', w.storyPushes![1] > 0);
  w.enc.cleared = w.enc.index = ENCOUNTERS.street.length;
  w.trans = { to: 1, ms: 1 }; step(w, {});
  w.trans = { to: 2, ms: 1 }; step(w, {});
  w.enc.cleared = w.enc.index = 1; step(w, {});
  check('V3 push.3 после вестибюля', w.storyPushes![2] > 0);
  w.trans = { to: 3, ms: 1 }; step(w, {});
  w.enc.cleared = w.enc.index = ENCOUNTERS.wagon.length; step(w, {});
  check('V3 push.4 после вагона', w.storyPushes![3] > 0);
  w.trans = { to: 5, ms: 1 }; step(w, {});
  w.enc.cleared = w.enc.index = 1; step(w, {});
  check('V3 push.6 после первого боя Сити', w.storyPushes![5] > 0);
  const story = createStoryProgress();
  check('V3 Сити: пять звёзд, полмиллиона', wantedStatus(w, story).stars === 5 && wantedStatus(w, story).reward === 500000);
  story.flags.wanted = 'off';
  check('V3 после Милонова розыск снят', wantedStatus(w, story).stars === 0);
  const marks = JSON.stringify(w.storyPushes); p.hp = 0; step(w, {});
  check('TZ19 рестарт сохраняет пуши', JSON.stringify(w.storyPushes) === marks);
}

// TZ-23 A1: падение, смена карты, выбор цели и контроль.
{
  const { w, p } = setup(true); dummy(w, 'idle', 800);
  p.hp = 0; p.anim = 'down'; p.move = 'fall'; p.moveT = 750; p.downMs = 2400;
  check('A1.9 павший сменил героя', switchHero(w, p.id, KRIS_ID));
  const q = w.players.h;
  check('A1.9 сохранены падение и срок подъёма', q.hp === 0 && q.downMs === 2400 && q.anim === 'down' && q.move === 'fall' && q.moveT === 750);
  run(w, 2300); check('A1.9 раннего подъёма нет', q.hp === 0);
  run(w, 150); check('A1.9 подъём после исходного срока', q.hp === PLAYER_HP / 2);
}
{
  const { w, p } = setup(true);
  p.hp = 0; p.anim = 'down'; p.move = 'fall'; p.moveT = 840; p.downMs = 3100;
  stopStoryHeroes(w);
  check('A1.11 диалог сохраняет падение', p.anim === 'down' && p.move === 'fall' && p.moveT === 840 && p.downMs === 3100);
  run(w, TICK_MS);
  check('A1.11 после диалога павший остаётся лежать', p.hp === 0 && p.move === 'fall');
}
{
  const { w } = setup(false, KRIS_ID);
  dummy(w, 'dead', 45, 0); dummy(w, 'live', 100); w.enemies.live.dummy = true;
  w.enemies.dead.boss = 'shaman'; w.enemies.dead.deathMs = 1400;
  const ev = step(w, { h: { ...emptyInput(), heavy: true } });
  // Вспышка срабатывает в кадре попадания, мёртвый босс ещё на экране.
  const shots = [...ev];
  for (let i = 0; i < 70 && !shots.some(e => e.t === 'shot'); i++) shots.push(...step(w, {}));
  check('A1.7 вспышка выбирает живого за мёртвым боссом', shots.some(e => e.t === 'shot' && e.tx === w.enemies.live.x) && w.pending.some(d => d.flash && d.ids?.[0] === 'live'));
}
{
  const w = createWorld(23, true, 'route'), p = addPlayer(w, 'h', 'ramil');
  p.x = 900; p.y = 205; p.ult = 63; p.charge2 = 42; p.bCooldownMs = 1900;
  p.ramil = { marks: ['old'], markMs: 1000, originX: 920, originY: 210, smokeMs: 900, smokeLine: 1, fireHit: ['old'],
    grab: 'old', tele: { ms: 100, x: 1600, y: 200, back: true }, dash: { fromX: 800, fromY: 200, x: 1700, y: 205 },
    ult: { ms: 10, count: 4, target: 'old', level: 2, buffered: false, window: 0, stunned: ['old'] } };
  p.ultLevel = 2; p.ultWindow = 300; p.fDashMs = 200; p.hiddenMs = 200; p.fireMs = 100;
  nextStage(w); step(w, {}, 901);
  check('A1.8 переход очищает действия Рамиля', !p.ramil && !p.ultLevel && !p.ultWindow && !p.fDashMs && !p.hiddenMs && !p.fireMs);
  check('A1.8 переход сохраняет заряды и кулдаун', p.ult === 63 && p.charge2 === 42 && p.bCooldownMs === 1900);
  const x = p.x, y = p.y; step(w, {});
  check('A1.8 старые координаты не срабатывают на следующем тике', p.x === x && p.y === y);
}
for (const defense of ['none', 'invuln', 'ultimate', 'god'] as const) {
  const { w, p, e } = bossSetup(); forceBossAttack(e, 'vstayu'); e.phaseMs = 1;
  p.x = e.x + 40; const x = p.x;
  if (defense === 'invuln') p.invulnMs = 500;
  if (defense === 'ultimate') { p.form = 'ultimate'; p.formMs = 1000; }
  if (defense === 'god') p.god = true;
  step(w, {});
  check(`A1.10 кольцо: ${defense}`, p.x === x + (defense === 'none' ? 90 : 0) && p.hp === (defense === 'none' || defense === 'ultimate' ? 138 : 150));
}
// Восстановление предупреждений использует зафиксированные фигуры и остаток времени.
for (const atk of ['vstayu', 'chorus', 'crossStage', 'pyro', 'salute']) {
  const { w, e } = bossSetup(); forceBossAttack(e, atk); e.phaseMs = 321;
  e.bands = [{ y: 190, h: 16 }, { y: 240, h: 16 }]; e.zonePoints = [{ x: 810, y: 200 }, { x: 880, y: 230 }];
  const before = JSON.stringify(w), events = bossWarningEvents(w);
  const expected = atk === 'vstayu' ? 1 : 2;
  check(`A1.5 восстановление ${atk} без изменения мира`, JSON.stringify(w) === before && events.length === expected && events.every(e => e.t === 'tele' && e.ms === 321));
  if (atk === 'salute') check('A1.5 салют сохраняет задержку второй точки', events[1].t === 'tele' && events[1].shape !== undefined && events[1].delayMs === 120);
}
{
  const { w, e } = bossSetup(); forceBossAttack(e, 'chorus'); e.phase = 'active'; e.phaseMs = 123;
  e.bands = [{ y: 200, h: 16 }];
  const ev = bossWarningEvents(w);
  check('A1.5 действующая полоса восстанавливается с остатком', ev.length === 1 && ev[0].t === 'bossFx' && ev[0].ms === 123 && ev[0].h === 16);
  e.hp = 0; check('A1.5 мёртвый босс не восстанавливает предупреждения', bossWarningEvents(w).length === 0);
}

console.log(failed ? `\n${failed} проверок не прошло` : '\nВсе проверки прошли');
process.exit(failed ? 1 : 0);
