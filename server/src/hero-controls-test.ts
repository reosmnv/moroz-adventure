import {
  KRIS_ID, NADYA_ID, RAMIL, RAMIL_ID, TICK_MS,
  addPlayer, createWorld, emptyInput, step, type Input, type World,
} from '@bc/shared';

let failed = 0;
function check(name: string, ok: boolean, info = '') {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${info ? ` (${info})` : ''}`);
  if (!ok) failed++;
}
function setup(char: string) {
  const w = createWorld(101, false, 'old');
  const p = addPlayer(w, 'h', char); p.x = 200; p.y = 200;
  return { w, p };
}
function dummy(w: World, id: string, x: number, y = 200, hp = 1000) {
  w.enemies[id] = { kind: 'omon', phase: 'none', phaseMs: 0, id, x, y, hp, maxHp: hp, facing: -1, anim: 'idle', animMs: 0, cdMs: 1e9 };
}
function tick(w: World, input: Partial<Input> = {}) {
  return step(w, { h: { ...emptyInput(), ...input } });
}
function run(w: World, ms: number, input: Partial<Input> = {}) {
  const events = [];
  for (let t = 0; t < ms; t += TICK_MS) events.push(...tick(w, input));
  return events;
}
function finishMove(w: World) {
  const p = w.players.h;
  for (let guard = 0; guard < 200 && !['idle', 'walk', 'dash'].includes(p.move); guard++) tick(w);
}

{
  const { w, p } = setup(RAMIL_ID); dummy(w, 'e1', 250);
  for (let i = 0; i < 4; i++) { tick(w, { heavy: true }); finishMove(w); }
  check('Рамиль: B получает кулдаун после B4', p.bCooldownMs > 3400, String(p.bCooldownMs));
  const before = p.move;
  tick(w, { heavy: true });
  check('Рамиль: B заблокирован кулдауном', p.move === before, p.move);
  tick(w, { attack: true });
  check('Рамиль: A доступно во время кулдауна B', p.move === 'a1' || p.move === 'dash', p.move);
  run(w, RAMIL.B_COOLDOWN_MS + TICK_MS);
  finishMove(w); p.x = 200; p.y = 200; p.facing = 1; dummy(w, 'e2', 250); tick(w, { heavy: true });
  check('Рамиль: B снова доступно', p.move === 'b1', `${p.move}, cd=${p.bCooldownMs}`);
}

{
  const { w, p } = setup(NADYA_ID); dummy(w, 'e1', 250);
  for (let i = 0; i < 3; i++) { tick(w, { heavy: true }); finishMove(w); }
  check('Надя: B получает кулдаун после самурая', p.bCooldownMs > 1900, String(p.bCooldownMs));
  const before = p.move; tick(w, { heavy: true });
  check('Надя: B заблокирован кулдауном', p.move === before, p.move);
  tick(w, { attack: true });
  check('Надя: A доступно во время кулдауна B', p.move === 'a1', p.move);
}

{
  const { w, p } = setup(KRIS_ID); dummy(w, 'e1', 420);
  const x0 = p.x;
  const events = run(w, 1000, { fireHeld: true, mx: 1 });
  const flashes = events.filter(e => e.t === 'shot').length;
  check('Kris: удержание стреляет', flashes >= 2, String(flashes));
  check('Kris: двигается во время стрельбы', p.x > x0 + 50, `${x0}->${p.x}`);
  check('Kris: направление огня сохраняется', p.shooting === true && p.fireFacing === 1);
  tick(w); check('Kris: отпускание прекращает стрельбу', !p.shooting && p.fireFacing === undefined);
}

{
  const { w, p } = setup(RAMIL_ID);
  dummy(w, 'first', 250, 200, 4); dummy(w, 'second', 500, 200, 1000);
  p.ult = 100; tick(w, { ult: true });
  run(w, 4000, { attack: true });
  check('Рамиль: ульта перевыбирает цель', w.enemies.second.hp < 1000, String(w.enemies.second.hp));
  check('Рамиль: ульта делает рывок к новой цели', p.x > 260, String(p.x));
}

if (failed) { console.error(`\n${failed} hero control checks failed`); process.exit(1); }
console.log('\nHero control checks passed');
