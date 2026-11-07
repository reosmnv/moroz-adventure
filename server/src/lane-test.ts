import { STORY_SCENES,
  LEVELS, HERO_ID, NADYA_ID, TICK_MS, addPlayer, createWorld, emptyInput,
  spawnEnemies, nextStage, step, stageOf, encountersOf, laneTop, laneBottom, levelW, walkBounds, clampToLane, HALT_MS,
  type World,
} from '@bc/shared';
import { FLOOR } from './floor-data.ts';

let failed = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? '  (' + detail + ')' : ''}`);
  if (!ok) failed++;
}
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
function floorTop(id: string, x: number): number {
  const f = FLOOR[id];
  if (!f || !f.top.length) return -Infinity;
  const lo = clamp(Math.floor((x - 6) / f.step), 0, f.top.length - 1);
  const hi = clamp(Math.ceil((x + 6) / f.step), 0, f.top.length - 1);
  let top = -Infinity;
  for (let i = lo; i <= hi; i++) top = Math.max(top, f.top[i]);
  return top;
}
function onLane(w: World, x: number, y: number) {
  return y >= laneTop(w, clamp(x, 0, levelW(w))) - 1e-6 && y <= laneBottom(w) + 1e-6;
}
let masks = 0;
for (let stage = 0; stage < LEVELS.route.stages.length; stage++) {
  const w = createWorld(41, true, 'route', stage), data = stageOf(w), id = data.id;
  const [minX, maxX] = walkBounds(w);
  let staticOk = true, depthOk = true;
  for (let x = minX; x <= maxX; x = Math.min(x + 2, maxX)) {
    staticOk &&= laneTop(w, x) >= floorTop(id, x);
    depthOk &&= laneBottom(w) - laneTop(w, x) >= 105;
    if (x === maxX) break;
  }
  if (FLOOR[id]?.top.length) { masks++; check(`${id}: пол по маске, шаг 2`, staticOk); }
  else console.log(`SKIP ${id}: маска FLOOR отсутствует`);
  check(`${id}: глубина полосы >= 105`, depthOk);
  const p = addPlayer(w, 'a', HERO_ID);
  w.enc.index = w.enc.cleared = encountersOf(w).length;
  w.enc.lock = null; w.enc.queue = [];
  check(`${id}: spawn на полу`, onLane(w, p.x, p.y) && p.y >= floorTop(id, p.x));
  spawnEnemies(w, 5);
  check(`${id}: spawn врагов внутри мира и полосы`, Object.values(w.enemies).every(e => e.x >= minX && e.x <= maxX && onLane(w, e.x, e.y)));
  w.enemies = {};
  for (const [name, my, run] of [['верх', -1, false], ['низ', 1, false], ['бег', 0, true]] as const) {
    Object.assign(p, clampToLane(w, data.spawn[0], name === 'бег' ? (laneTop(w, data.spawn[0]) + laneBottom(w)) / 2 : data.spawn[1]));
    let ok = true;
    let ticks = 0;
    const input = { ...emptyInput(), mx: 1, my, run };
    const limit = Math.ceil(levelW(w) / 90 * 1000 / TICK_MS) + 200;
    while (p.x < maxX && ticks++ < limit) {
      step(w, { a: input });
      w.trans = undefined; // Проверяем всю ширину, в том числе за выходом.
      w.enc.lock = null; w.enc.queue = [];
      ok &&= onLane(w, p.x, p.y) && p.y >= floorTop(id, p.x) && p.x >= minX && p.x <= maxX;
    }
    check(`${id}: проход ${name}`, ok && p.x >= maxX, `${ticks} тиков`);
  }

  const crowd = createWorld(99, true, 'route', stage);
  addPlayer(crowd, 'a', HERO_ID); addPlayer(crowd, 'b', NADYA_ID);
  spawnEnemies(crowd, 5);
  let crowdOk = true, minDepth = Infinity;
  for (let tick = 0; tick < Math.ceil(20000 / TICK_MS); tick++) {
    const inputs = Object.fromEntries(Object.values(crowd.players).map((hero, i) => {
      hero.hp = 150;
      const foes = Object.values(crowd.enemies).filter(e => e.hp > 0);
      const target = foes.sort((a, b) => Math.hypot(a.x - hero.x, a.y - hero.y) - Math.hypot(b.x - hero.x, b.y - hero.y))[0];
      return [hero.id, { ...emptyInput(), mx: target ? Math.sign(target.x - hero.x) : 0, my: target ? Math.sign(target.y - hero.y) : 0, attack: tick % 25 === i, heavy: tick % 41 === i }];
    }));
    step(crowd, inputs); crowd.trans = undefined;
    if (tick % 10 === 0) {
      const enemies = Object.values(crowd.enemies).filter(e => !e.air);
      crowdOk &&= enemies.every(e => onLane(crowd, e.x, e.y));
      for (let i = 0; i < enemies.length; i++) for (let j = i + 1; j < enemies.length; j++) minDepth = Math.min(minDepth, Math.abs(enemies[i].y - enemies[j].y));
    }
  }
  check(`${id}: толпа 20 с`, crowdOk, `min Δy=${Number.isFinite(minDepth) ? minDepth.toFixed(3) : 'нет пар'}`);

  if (data.exit) {
    const trans = createWorld(7, true, 'route', stage);
    trans.storyCompleted = STORY_SCENES.map(scene => scene.id);
    const first = addPlayer(trans, 'a', HERO_ID), second = addPlayer(trans, 'b', NADYA_ID);
    trans.enc.index = trans.enc.cleared = encountersOf(trans).length;
    first.hp = 73; first.form = 'ultimate'; first.formMs = 10000;
    if (data.tunnel) trans.halt = HALT_MS;
    Object.assign(first, clampToLane(trans, (data.exit.x0 + data.exit.x1) / 2, data.exit.y1));
    const enter = step(trans, {});
    const hp = first.hp, form = first.form;
    trans.pending.push({ ms: 1, kind: 'aoe', owner: first.id, strike: { range: 100, dmg: 100, kb: 0, stun: 0 }, x: first.x, y: first.y, r: 200 });
    const enemyPositions = Object.values(trans.enemies).map(e => [e.id, e.x, e.y] as const);
    let frozen = true, elapsed = 0, changed = false;
    const x = first.x;
    while (trans.trans && elapsed < 1000) {
      const events = step(trans, { a: { ...emptyInput(), mx: 1, attack: true } });
      elapsed += TICK_MS;
      if (trans.trans) frozen &&= first.x === x && enemyPositions.every(([id, x, y]) => trans.enemies[id].x === x && trans.enemies[id].y === y);
      changed ||= events.some(e => e.t === 'stage' && e.stage === stage + 1);
    }
    const [sx, sy] = stageOf(trans).spawn;
    check(`${id}: переход за ~900 мс`, enter.some(e => e.t === 'exit') && changed && frozen && elapsed >= 900 && elapsed < 900 + TICK_MS && trans.stage === stage + 1, `${elapsed} мс`);
    check(`${id}: spawn обоих, hp/форма и очистка`, first.x === sx && first.y === sy && onLane(trans, second.x, second.y) && first.hp === hp && first.form === form && trans.pending.length === 0 && Object.values(trans.enemies).every(e => e.dummy && onLane(trans, e.x, e.y)),
      `first=${first.x},${first.y} second=${second.x},${second.y} hp=${first.hp}/${hp} form=${first.form}/${form} pending=${trans.pending.length} enemies=${Object.values(trans.enemies).length}`);
  }
}
console.log(`Масок проверено: ${masks}/${LEVELS.route.stages.length}`);
const old = createWorld(1, true, 'old');
check('old: прежняя полоса и ширина', levelW(old) === 1920 && [-100, 0, 800, 1920, 2500].every(x => laneTop(old, x) === 168));
const last = createWorld(1, true, 'route', LEVELS.route.stages.length - 1);
addPlayer(last, 'a', HERO_ID); nextStage(last);
let wrapped = false;
for (let i = 0; i < 54; i++) wrapped ||= step(last, {}).some(e => e.t === 'stage' && e.stage === 0);
check('тестовая кнопка: последняя → первая', wrapped && last.stage === 0);
// Неплоская полоса проверяется независимо от временных значений маршрута.
const oldStage = LEVELS.old.stages[0];
try {
  LEVELS.old.stages[0] = { ...oldStage, width: 480, walkX: [45, 350], lane: [[0, 100], [240, 150], [480, 120]] };
  const slope = createWorld(1, true, 'old');
  check('laneTop: интерполяция и края', laneTop(slope, -10) === 100 && laneTop(slope, 120) === 125 && laneTop(slope, 360) === 135 && laneTop(slope, 500) === 120);
  const hero = addPlayer(slope, 'a', HERO_ID);
  slope.enemies = {};
  spawnEnemies(slope, 5);
  const spawnedValid = Object.values(slope.enemies).every(e => Number.isFinite(e.x) && Number.isFinite(e.y));
  let ok = true;
  for (let i = 0; i < 400; i++) {
    step(slope, { a: { ...emptyInput(), mx: 1, my: -1, run: true } });
    ok &&= onLane(slope, hero.x, hero.y) && Object.values(slope.enemies).every(e => onLane(slope, e.x, e.y));
  }
  check('неплоская полоса: герой и враги после движения', ok && hero.x === 350 && spawnedValid, `ok=${ok} x=${hero.x} spawned=${spawnedValid}`);
  check('walkX: ограничение спавна', clampToLane(slope, 0, 150).x === 45 && clampToLane(slope, 480, 150).x === 350);
} finally { LEVELS.old.stages[0] = oldStage; }
check('неверный stage → 0', createWorld(1, true, 'route', -1).stage === 0 && createWorld(1, true, 'route', 999).stage === 0);
console.log(failed ? `\n${failed} проверок не прошло` : '\nВсе проверки прошли');
process.exit(failed ? 1 : 0);
