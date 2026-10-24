// Сценарии боя Анастасии прямо на shared/sim, без сервера: `npm run test:sim`.
import { HERO_ID, ULT_MS, TICK_MS, addPlayer, createWorld, emptyInput, step, moveDurMs, type Input, type World } from '@bc/shared';

let failed = 0;
function check(name: string, ok: boolean, info = '') {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${info ? `  (${info})` : ''}`);
  if (!ok) failed++;
}

function setup(withBuddy = false) {
  const w = createWorld(7);
  const p = addPlayer(w, 'h', HERO_ID);
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
  for (let t = 0; t < ms; t += TICK_MS) {
    const inp = { ...emptyInput(), ...input(t) };
    const ev = step(w, { h: inp });
    hits.push(...ev.filter(e => e.t === 'hit').map(e => (e as any).dmg));
    const m = w.players.h.move;
    if (log[log.length - 1] !== m) log.push(m);
  }
  return { log, hits };
}
const press = (at: number[], key: 'attack' | 'heavy' | 'ult' | 'taunt') => (t: number) => (at.includes(t) ? { [key]: true } : {});

// 1. Серия A: jab, cross, teep, затем сначала
{
  const { w } = setup(); dummy(w, 'e1', 24);
  const { log, hits } = run(w, 3000, press([0, 100, 250, 600, 800, 1000, 1200, 1400, 1600], 'attack'));
  check('серия A: jab > cross > teep', log.slice(0, 4).join() === 'jab,cross,teep,jab', log.join('>'));
  check('каждый удар серии попал', hits.length >= 3 && hits[0] === 6 && hits[1] === 8 && hits[2] === 12, hits.join());
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
  const { log } = run(w, 1500, press([0, 50, 450], 'attack'));
  check('очередь ударов', log.slice(0, 3).join() === 'jab,cross,teep', log.join('>'));
}
// 4. Удар по кадру: урон не раньше кадра hit
{
  const { w } = setup(); dummy(w, 'e1', 24);
  const { hits } = run(w, 150, press([0], 'attack')); // jab: кадр 4 при 18 fps = 222 мс
  check('урон не раньше кадра удара', hits.length === 0, `за 150 мс попаданий ${hits.length}`);
  const r2 = run(w, 300);
  check('урон приходит в кадре удара', r2.hits.length === 1);
}
// 5. Hurricane бьёт три раза, враг сбит B-ударом
{
  const { w, p } = setup(); dummy(w, 'e1', 24);
  p.form = 'ultimate'; p.formMs = ULT_MS; p.combo = 2; p.comboMs = 700;
  const { hits } = run(w, 2000, press([0], 'heavy'));
  check('hurricane: 3 попадания', hits.length === 3 && hits.every(h => h === 12), hits.join());
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
  check('после превращения Ultimate', p.form === 'ultimate' && p.formMs > 7000, `${p.form} ${p.formMs}`);
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
  check('удар врага: hurt', log.includes('hurt') && p.hp === 93, `${log.join('>')} hp ${p.hp}`);
  check('после удара неуязвима', p.invulnMs > 0);
  w.enemies.e1.cdMs = 0; w.enemies.e1.anim = 'idle'; w.enemies.e1.animMs = 0;
  p.hp = 5; p.invulnMs = 0;
  const r = run(w, 800);
  check('hp 0: fall', p.hp === 0 && r.log.includes('fall'), r.log.join('>'));
  delete w.enemies.e1; w.enemies.e9 = { id: 'e9', x: 900, y: 200, hp: 100, maxHp: 100, facing: -1, anim: 'idle', animMs: 0, cdMs: 1e9 };
  const r2 = run(w, 6000);
  check('друг жив: подъём getup', p.hp > 0 && r2.log.includes('getup'), `hp ${p.hp} ${r2.log.join('>')}`);
}
check('длительности из данных', moveDurMs('prime', 'jab', 1) > 400);

console.log(failed ? `\n${failed} проверок не прошло` : '\nВсе проверки прошли');
process.exit(failed ? 1 : 0);
