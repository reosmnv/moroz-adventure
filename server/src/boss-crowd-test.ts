import { BOSS, BOSS_ATTACK, ENCOUNTERS, HERO_ID, MAX_ALIVE, MAX_PEAK_ALIVE, PLAYER_HP, TICK_MS, addPlayer, createWorld, emptyInput, step, type BossId, type Enemy, type SimEvent, type World } from '@bc/shared';

let failed = 0;
function check(name: string, ok: boolean, info = '') {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${info ? `  (${info})` : ''}`);
  if (!ok) failed++;
}

function bossFight(boss: BossId, attack: string) {
  const w = createWorld(13, false, 'old');
  w.introduced.push(boss);
  const p = addPlayer(w, 'h', HERO_ID);
  p.x = 400; p.y = 200;
  w.enc.lock = [160, 640];
  const info = BOSS[boss], list = info.attacks[0];
  const e: Enemy = {
    id: 'boss', kind: 'vatnik', boss, bossPhase: 1, hp: info.hp, maxHp: info.hp,
    x: 315, y: 200, facing: 1, phase: 'none', phaseMs: 0, anim: 'idle', animMs: 0, cdMs: 0,
    token: p.id, target: p.id, entered: true, atkIndex: Math.max(0, list.indexOf(attack)),
  };
  w.enemies[e.id] = e;
  return { w, p, e };
}

function run(w: World, ms: number, before?: (elapsed: number) => void) {
  const events: SimEvent[] = [];
  for (let elapsed = 0; elapsed < ms; elapsed += TICK_MS) {
    before?.(elapsed);
    events.push(...step(w, { h: emptyInput() }));
  }
  return events;
}

// Геометрия опасности фиксируется до удара: игрок видит угрозу и может выйти.
{
  const { w, p } = bossFight('shaman', 'chorus');
  const start = run(w, TICK_MS);
  const telegraphs = start.filter(e => e.t === 'tele' && e.shape === 'line');
  check('chorus: две заранее видимые линии', telegraphs.length === 2);
  const hp = p.hp;
  run(w, BOSS_ATTACK.chorus.windupMs + 100, () => { p.y = 225; });
  check('chorus: из линии можно увернуться', p.hp === hp, `${hp} -> ${p.hp}`);
}

// Кольцо наказывает за стояние рядом, но не преследует после телеграфа.
{
  const { w, p } = bossFight('shaman', 'vstayu');
  const start = run(w, TICK_MS);
  check('vstayu: телеграф кольца', start.some(e => e.t === 'tele' && e.shape === 'ring'));
  const hp = p.hp;
  run(w, BOSS_ATTACK.vstayu.windupMs + 100, () => { p.x = 620; });
  check('vstayu: выход из кольца спасает', p.hp === hp, `${hp} -> ${p.hp}`);
}

// Новый крест фиксирует две оси. Без движения он попадает, выход по диагонали спасает.
{
  const { w, p, e } = bossFight('shaman', 'crossStage');
  e.bossPhase = 2;
  e.atkIndex = BOSS.shaman.attacks[1].indexOf('crossStage');
  const start = run(w, TICK_MS);
  check('cross: видны обе оси', start.some(e => e.t === 'tele' && e.shape === 'line') && start.some(e => e.t === 'tele' && e.shape === 'column'));
  const hp = p.hp;
  run(w, BOSS_ATTACK.crossStage.windupMs + 100, () => { p.x = 470; p.y = 245; });
  check('cross: диагональное уклонение спасает', p.hp === hp, `${hp} -> ${p.hp}`);
}

// Вторая фаза Кати использует тот же набор движений, но быстрее и с новой связкой.
{
  const { w, e } = bossFight('katya', 'katGround');
  const first = run(w, TICK_MS);
  check('Катя: удар по земле заранее показывает кольцо', first.some(event => event.t === 'tele' && event.shape === 'ring'));
  e.hp = Math.floor(e.maxHp * 0.45);
  const phase = run(w, TICK_MS);
  check('Катя: вторая фаза наступает при половине здоровья', e.bossPhase === 2 && phase.some(event => event.t === 'phase'));
  check('Катя: вторая фаза ускоряет тяжёлый удар и удар по земле', BOSS_ATTACK.katHeavy2.windupMs < BOSS_ATTACK.katHeavy.windupMs && BOSS_ATTACK.katGround2.windupMs < BOSS_ATTACK.katGround.windupMs);
  check('Катя: вторая фаза добавляет рывок', BOSS.katya.attacks[1].includes('katRush'));
}

// Вход толпы растянут: в первый кадр не возникает нечитабельная стопка.
{
  const w = createWorld(7, false, 'route', 0);
  const p = addPlayer(w, 'h', HERO_ID);
  p.x = 310; p.y = 210;
  step(w, { h: emptyInput() });
  const first = Object.values(w.enemies).filter(e => e.hp > 0).length;
  run(w, 250);
  const beforeSecond = Object.values(w.enemies).filter(e => e.hp > 0).length;
  run(w, 60);
  const afterSecond = Object.values(w.enemies).filter(e => e.hp > 0).length;
  check('волна: один противник за интервал входа', first === 1 && beforeSecond === 1 && afterSecond === 2, `${first}/${beforeSecond}/${afterSecond}`);
}

check('базовое здоровье игрока не изменено', PLAYER_HP === 150);
check('плотность: 10 обычно и 12 на пике', MAX_ALIVE === 10 && MAX_PEAK_ALIVE === 12 && ENCOUNTERS.mayak[0].waves[0].length === 10);
check('МФЦ: не больше двух тяжёлых в волне', ENCOUNTERS.mfc.every(enc => enc.waves.every(wave => wave.filter(e => e.kind === 'clerk' || e.kind === 'omon_shield').length <= 2)));
if (failed) process.exit(1);
console.log('boss/crowd checks passed');
