import { existsSync } from 'node:fs';
import { CHARACTERS, ENEMY_INTRO, LEVELS, STORY_CONTENT, STORY_SCENES, advanceStory, createStoryProgress, startStory, startStoryForWorld, storyStepKey, wantedStatus, createWorld, addPlayer, tickStory, testStoryScene, testStoryStrict, step, emptyInput, encountersOf, stageOf } from '@bc/shared';

let failed = 0;
function check(name: string, ok: boolean) { console.log(`${ok ? 'OK' : 'FAIL'} ${name}`); if (!ok) failed++; }
const content = STORY_CONTENT as Record<string, string>;
const publicDir = 'client/public/';

let valid = true, longest = 0;
for (const scene of STORY_SCENES) {
  let lines = 0;
  for (const step of scene.steps) {
    if (step.kind === 'state' || step.kind === 'act') { lines = 0; continue; }
    const ids = step.kind === 'phone' ? step.ids : [step.id];
    for (const id of ids) {
      const value = content[id];
      if (!value) { console.log('missing ID', scene.id, id); valid = false; continue; }
      const limit = step.kind === 'line' ? 70 : step.kind === 'phone' && id !== 'intro.body' && !id.startsWith('push.') ? 40 : 250;
      if (value.length > limit) { console.log('too long', scene.id, id, value.length, limit); valid = false; }
    }
    if (step.kind === 'composition') for (const file of step.images) if (!existsSync(publicDir + file)) { console.log('missing asset', file); valid = false; }
    lines = step.kind === 'line' ? lines + 1 : 0;
    longest = Math.max(longest, lines);
  }
}
// Ссылки проверяются в порядке шагов, с переносом keep между сценами.
const known = new Set(CHARACTERS.map(c => c.id));
const kept = new Set<string>();
let refsValid = true;
for (const scene of STORY_SCENES) {
  const actors = new Set([...known, ...kept]);
  for (const step of scene.steps) {
    if (step.kind === 'act' && step.do === 'spawn') {
      actors.add(step.actor); if (step.keep) kept.add(step.actor);
    }
    const ref = step.kind === 'act' && step.actor !== 'camera' ? step.actor
      : step.kind === 'line' ? step.at ?? step.speaker : step.kind === 'phone' ? step.at : undefined;
    if (ref && !actors.has(ref)) { console.log('missing actor', scene.id, ref); refsValid = false; }
    if (step.kind === 'act' && step.do === 'exit') actors.delete(step.actor);
  }
  if (scene.id === 'sender') kept.clear();
}
check('все at и act ссылаются на героев или живых актёров', refsValid);
check('ID, лимиты сцен и ссылки на ассеты', valid);
check('не более шести реплик подряд', longest <= 6);
const prologue = STORY_SCENES.find(s => s.id === 'prologue')!;
const phoneIndex = prologue.steps.findIndex(s => s.kind === 'phone');
const reaction = prologue.steps[phoneIndex + 1];
check('реакция Насти отдельной репликой после телефона', reaction.kind === 'line' && reaction.id === 'intro.button' && reaction.speaker === 'anastasia'
  && !prologue.steps.some(s => s.kind === 'phone' && s.ids.includes('intro.button')));
for (const scene of STORY_SCENES) {
  const w = createWorld(42, true, 'route');
  for (const hero of CHARACTERS) addPlayer(w, hero.id, hero.id);
  const progress = createStoryProgress();
  check(`тестовый запуск ${scene.id}`, testStoryScene(progress, w, scene.id, true));
  const before = Object.values(w.players).map(p => `${p.x}:${p.y}`).join();
  for (let n = 0; progress.scene && n < 200; n++) {
    tickStory(progress, w, 20000); advanceStory(progress, storyStepKey(progress), w);
    check(`позиции героев сохранены ${scene.id}:${n}`, before === Object.values(w.players).map(p => `${p.x}:${p.y}`).join());
  }
  check(`сцена ${scene.id} завершилась`, !progress.scene);
}
const gateWorld = createWorld(42, true, 'route');
addPlayer(gateWorld, 'a', 'anastasia'); addPlayer(gateWorld, 'b', 'ramil');
const gate = createStoryProgress(); gate.completed.push('prologue');
gateWorld.players.a.x = 240; gateWorld.players.b.x = 219;
check('один отставший герой задерживает сцену', !startStoryForWorld(gate, gateWorld));
gateWorld.players.b.x = 220;
check('вся группа у порога запускает сцену', startStoryForWorld(gate, gateWorld));
gate.scene = ''; gateWorld.players.b.x = 10; gateWorld.players.b.hp = 0;
check('павший герой не задерживает сцену', startStoryForWorld(gate, gateWorld));
gate.scene = ''; gateWorld.players.b.hp = 150;
testStoryStrict(gateWorld, false);
check('тестовый выключатель снимает проверку x', startStoryForWorld(gate, gateWorld));
const protectedWorld = createWorld(42, false);
check('тестовые сцены запрещены вне testMode', !testStoryScene(createStoryProgress(), protectedWorld, 'arch', false));
check('портреты всех сюжетных героев', ['portrait-prime.png', 'nadya/portrait.png', 'kris/portrait.png', 'ramil/portrait.png'].every(file => existsSync(publicDir + 'ui/' + file)));
check('ассеты боя Кати', ['idle', 'walk', 'hurt', 'fall', 'strike', 'cast', 'release'].every(clip => existsSync(publicDir + `sprites/enemies/katya-pl/${clip}-east.png`)));
check('лимиты вставок врагов', Object.values(ENEMY_INTRO).every(e => e.name.length <= 16 && e.tag.length <= 40 && e.line.length <= 60));
check('лимиты пушей и слов боя', Object.entries(content).every(([id, value]) => id.startsWith('push.') ? value.length <= 70 : /^(sh\.w\d|sh\.down|pz\.w\d|pz\.down|kat\.w\d|kat\.down)$/.test(id) ? value.length <= 12 : true));
check('лимиты карточек маршрута', LEVELS.route.stages.every(s => s.cards.every(([small, big]) => small.length <= 28 && big.length <= 14)));
check('все текстовые вывески удалены', LEVELS.route.stages.every(s => s.signs.length === 0));
check('старый сюжет отсутствует в игровых текстах', !/несуществующ|Вас нет|НАСТЯ ЕСТЬ|Тебя нет|Удалена мной|Как существовать|ОКНО 1|А-000|А-001|ожидайте вызова/i.test(Object.values(content).join('\n') + JSON.stringify(LEVELS.route.stages)));

const story = createStoryProgress();
check('пролог запускается', startStory(story, 'start'));
const captionWorld = createWorld(1, false, 'route');
tickStory(story, captionWorld, 0);
check('титр нельзя пропустить тапом', !advanceStory(story, storyStepKey(story), captionWorld));
const duration = Math.max(2200, 55 * STORY_CONTENT['title.1'].length);
tickStory(story, captionWorld, duration - 1);
check('титр ждёт полное время', story.index === 0);
tickStory(story, captionWorld, 1);
check('второй титр идёт автоматически', story.index === 1);
tickStory(story, captionWorld, 20000);
const key = storyStepKey(story);
check('команда текущего шага проходит', advanceStory(story, key));
const after = storyStepKey(story);
check('повторный пакет не перескакивает реплику', after !== key && !advanceStory(story, key) && storyStepKey(story) === after);
const finishWorld = createWorld(1, false, 'route');
function finish(progress: ReturnType<typeof createStoryProgress>) {
  for (let n = 0; progress.scene && n < 200; n++) {
    tickStory(progress, finishWorld, 10000);
    advanceStory(progress, storyStepKey(progress), finishWorld);
  }
  check('сцена завершается без зацикливания', !progress.scene);
}
finish(story);
check('пройденная сцена не повторяется', !startStory(story, 'start'));
check('запись доступна без выбранной Kris', story.flags.recording === 'on');
const world = { level: 'route', stage: 0, won: false, enc: { cleared: 0 }, enemies: {}, players: { a: { x: 4000, hp: 150 } } };
check('следующая сцена запускается по маршруту', startStoryForWorld(story, world) && story.scene === 'street_vat');
const status = wantedStatus({ ...world, stage: 2, enc: { cleared: 1 } }, story);
check('150 тысяч и три звезды в вестибюле', status.stars === 3 && status.reward === 150000);
const later = wantedStatus({ ...world, stage: 3, enc: { cleared: 1 } }, story);
check('500 тысяч и три звезды в вагоне', later.stars === 3 && later.reward === 500000);
check('четыре после Пиздулины', wantedStatus({ ...world, stage: 4, storyPizDown: true }, story).stars === 4);
check('пять в Сити', wantedStatus({ ...world, stage: 5 }, story).stars === 5);
story.flags.wanted = 'off';
check('розыск снят после Милонова', wantedStatus({ ...world, stage: 6 }, story).stars === 0);

// Местный МФЦ должен предшествовать Сити, а Милонов ждать конца второй арены.
const route = createStoryProgress();
const routeWorld = { level: 'route', stage: 4, won: false, enc: { cleared: 0 }, enemies: {} as Record<string, { boss?: string; hp: number }>, players: { a: { x: 4000, hp: 150 } } };
const finishScene = () => finish(route);
check('сцена Маяковской начинается при входе', startStoryForWorld(route, routeWorld) && route.scene === 'mayak');
finishScene();
check('местный МФЦ не запускается до выхода с Маяковской', !startStoryForWorld(route, routeWorld));
routeWorld.enc.cleared = 1;
check('переадресация происходит до Сити', startStoryForWorld(route, routeWorld) && route.scene === 'local_mfc');
finishScene(); routeWorld.stage = 5; routeWorld.enc.cleared = 0;
check('Сити следует после местного МФЦ', startStoryForWorld(route, routeWorld) && route.scene === 'city');
finishScene(); routeWorld.stage = 6;
check('Милонов не встречается у входа в главный МФЦ', !startStoryForWorld(route, routeWorld));
routeWorld.enc.cleared = 2;
check('Милонов появляется у последней арены', startStoryForWorld(route, routeWorld) && route.scene === 'milonov');
finishScene();
check('доступ к базе следует за признанием', startStoryForWorld(route, routeWorld) && route.scene === 'leverage');
finishScene();
check('отправитель раскрывается после доступа к базе', startStoryForWorld(route, routeWorld) && route.scene === 'sender');
finishScene(); routeWorld.enemies.k = { boss: 'katya', hp: 1 };
check('Катя появляется после раскрытия отправителя', startStoryForWorld(route, routeWorld) && route.scene === 'katya');
finishScene(); routeWorld.enemies = {}; routeWorld.enc.cleared = 3; routeWorld.won = true;
check('отзыв доноса и поздравление следуют за боем', startStoryForWorld(route, routeWorld) && route.scene === 'withdrawal');
finishScene();
check('финал открыт после отзыва доноса', route.flags.finaleReady === 'on');

// Кампания вместе с постановкой: четыре героя идут обычным вводом, враги снимаются тестом.
const campaignWorld = createWorld(8, false, 'route'), campaign = createStoryProgress();
for (const hero of CHARACTERS) { const p = addPlayer(campaignWorld, hero.id, hero.id); p.god = true; }
startStory(campaign, 'start');
for (let ticks = 0; ticks < 50000 && campaign.flags.finaleReady !== 'on'; ticks++) {
  startStoryForWorld(campaign, campaignWorld);
  if (campaign.scene) {
    tickStory(campaign, campaignWorld, 20000);
    advanceStory(campaign, storyStepKey(campaign), campaignWorld);
    continue;
  }
  for (const e of Object.values(campaignWorld.enemies)) if (e.entered || e.boss) e.hp = 0;
  const exit = stageOf(campaignWorld).exit;
  const inputs = Object.fromEntries(Object.values(campaignWorld.players).map(p => {
    const input = { ...emptyInput(), mx: 1, run: true };
    if (campaignWorld.enc.cleared === encountersOf(campaignWorld).length && exit) {
      input.mx = p.x < exit.x0 + 3 ? 1 : p.x > exit.x1 - 3 ? -1 : 0;
      input.my = p.y > exit.y1 ? -1 : 0;
    }
    return [p.id, input];
  }));
  step(campaignWorld, inputs);
}
check('кампания от пролога до победы с четырьмя героями', campaignWorld.won && campaign.flags.finaleReady === 'on' && STORY_SCENES.every(s => campaign.completed.includes(s.id)));

// Изолированная сцена проверяет часы, движение, дубли и очистку без изменения сюжета.
STORY_SCENES.push({ id: 'actors_test', trigger: 'actors_test', steps: [
  { kind: 'act', actor: 'vat1', do: 'spawn', look: 'vatnik', x: 100, y: 200 },
  { kind: 'act', actor: 'camera', do: 'focus', x: 150 },
  { kind: 'act', actor: 'vat1', do: 'walk', x: 200, ms: 1000 },
  { kind: 'line', id: 'vat.2', speaker: 'Ватник', at: 'vat1' },
  { kind: 'act', actor: 'kris', do: 'walk', x: 300, ms: 5000 },
  { kind: 'act', actor: 'anastasia', do: 'walk', x: 250, ms: 500 },
] });
const actorsWorld = createWorld(1), actorsStory = createStoryProgress();
addPlayer(actorsWorld, 'a', 'anastasia');
startStory(actorsStory, 'actors_test');
tickStory(actorsStory, actorsWorld, 400);
check('нулевые act выполняются в одном тике, движение частичное', actorsStory.index === 1 && actorsWorld.actors.vat1.x === 100 && actorsWorld.storyCamX === actorsWorld.players.a.x);
check('storyNext не может пропустить act', !advanceStory(actorsStory, storyStepKey(actorsStory), actorsWorld));
tickStory(actorsStory, actorsWorld, 1099);
check('act ждёт полное время', actorsStory.index === 2 && actorsWorld.actors.vat1.x < 200);
tickStory(actorsStory, actorsWorld, 1);
check('act проходит сам точно по таймеру', actorsStory.index === 3 && actorsWorld.actors.vat1.x === 200);
check('часы боя во время постановки стоят', actorsWorld.timeMs === 0 && actorsWorld.tick === 0);
const actorsKey = storyStepKey(actorsStory);
advanceStory(actorsStory, actorsKey, actorsWorld);
check('повтор команды реплики не пропускает act', !advanceStory(actorsStory, actorsKey, actorsWorld));
tickStory(actorsStory, actorsWorld, 250);
check('перемещения героев пропускаются', !actorsStory.scene && actorsWorld.players.a.x !== 250 && !actorsWorld.actors.kris);
tickStory(actorsStory, actorsWorld, 250);
check('герой неподвижен, актёры и камера удалены после сцены', !actorsStory.scene && actorsWorld.players.a.x === 80 && Object.keys(actorsWorld.actors).length === 0 && actorsWorld.storyCamX === undefined);
STORY_SCENES.pop();

console.log(failed ? `${failed} проверок не прошло` : 'Все проверки прошли');
process.exitCode = failed ? 1 : 0;
