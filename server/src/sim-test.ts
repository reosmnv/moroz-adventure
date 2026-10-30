// Сценарии боя Анастасии прямо на shared/sim, без сервера: `npm run test:sim`.
import { HERO_ID, KRIS_ID, NADYA_ID, ULT_MS, TICK_MS, addPlayer, createWorld, emptyInput, spawnEnemies, step, moveDurMs, type Input, type World } from '@bc/shared';

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

// 1. Серия A: jab, cross, teep, затем сначала
{
  const { w } = setup(); dummy(w, 'e1', 24);
  const { log, hits } = run(w, 3000, press([0, 100, 250, 600, 800, 1000, 1200, 1400, 1600], 'attack'));
  check('серия A: jab > cross > teep', log.slice(0, 4).join() === 'jab,cross,teep,jab', log.join('>'));
  check('каждый удар серии попал', hits.length >= 3 && hits[0] === 5 && hits[1] === 7 && hits[2] === 10, hits.join());
}
// 2. B после одного A = highkick, после двух = uppercut, без серии = superman
{
  for (const [presses, want] of [[['heavy'], 'superman'], [['attack', 'heavy'], 'highkick'], [['attack', 'attack', 'heavy'], 'uppercut']] as const) {
    const { w } = setup(); dummy(w, 'e1', 24);
    const seq = [...presses];
    let i = 0, nextAt = 0;
    const { log } = run(w, 3000, t => {
      if (i < seq.length && t >= nextAt) { const k = seq[i++]; nextAt = t + 500; return { [k]: true }; }
      return {};
    });
    check(`B после ${presses.length - 1} A: ${want}`, log.includes(want), log.join('>'));
  }
}
// 3. Очередь: нажатие во время удара не теряется
{
  const { w } = setup(); dummy(w, 'e1', 24);
  const { log } = run(w, 2000, press([0, 50, 600], 'attack'));
  check('очередь ударов', log.slice(0, 3).join() === 'jab,cross,teep', log.join('>'));
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
  p.form = 'ultimate'; p.formMs = ULT_MS; p.combo = 2; p.comboMs = 700;
  const { hits } = run(w, 2000, press([0], 'heavy'));
  check('hurricane: 3 попадания', hits.length === 3 && hits.every(h => h === 30), hits.join());
  const { w: w2 } = setup(); dummy(w2, 'e1', 24);
  run(w2, 600, press([0], 'heavy'));
  check('superman сбивает врага с ног', w2.enemies.e1.anim === 'down');
}
// 6. Ульта: превращение, неуязвимость, 8 секунд, обратно
{
  const { w, p } = setup(); dummy(w, 'e1', 24);
  p.ult = 100;
  const { log } = run(w, 400, press([0], 'ult'));
  check('ульта запускает превращение', log.includes('transform-up') && p.invulnMs > 0 && p.ult === 0, log.join('>'));
  run(w, 1000);
  check('после превращения Ultimate', p.form === 'ultimate' && p.formMs > ULT_MS - 1500, `${p.form} ${p.formMs}`);
  check('в Ultimate серия другая', run(w, 600, press([0], 'attack')).log.includes('elbow'));
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
  w.enemies.e1.anim = 'idle'; w.enemies.e1.animMs = 0; p.combo = 0; run(w, 600);
  run(w, 600, press([0], 'heavy'));
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
    p.form = form; p.formMs = ULT_MS; p.combo = 1; p.comboMs = 700;
    run(w, 1500, press([0], 'heavy')); // highkick / flying-knee
    return w.enemies.e1.x - (p.x + 24);
  };
  const a = dist('prime'), b = dist('ultimate');
  check('отбрасывание: Prime x2, Ultimate x4', a > 40 && b > a * 1.5, `${Math.round(a)} и ${Math.round(b)}`);
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
  p.combo = 2; p.comboMs = 700;
  run(w, 400, press([0], 'heavy'));
  check('апперкот подбрасывает врага', (w.enemies.e1.air ?? 0) > 0 && (w.enemies.e1.anim as string) === 'down', `air ${w.enemies.e1.air}`);
  const { w: w2 } = setup(); dummy(w2, 'e1', 24);
  run(w2, 400, press([0], 'heavy'));
  check('суперман не подбрасывает', !w2.enemies.e1.air);
}
{
  const { w, p } = setup(); dummy(w, 'e1', 24);
  p.form = 'ultimate'; p.formMs = ULT_MS; p.hp = 100;
  run(w, 600, press([0], 'attack')); // elbow: 15 урона
  check('Ultimate лечит на нанесённый урон', p.hp === 115, `hp ${p.hp}`);
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
