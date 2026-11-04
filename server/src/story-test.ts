import { existsSync } from 'node:fs';
import { CHARACTERS, ENEMY_INTRO, LEVELS, STORY_CONTENT, STORY_SCENES, advanceStory, createStoryProgress, startStory, startStoryForWorld, storyStepKey, wantedStatus, createWorld, addPlayer, tickStory } from '@bc/shared';

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
      const limit = step.kind === 'line' ? 70 : step.kind === 'phone' && id !== 'intro.body' && id !== 'intro.foot' && !id.startsWith('push.') ? 40 : 250;
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
for (const id of ['shaman', 'pizdulina', 'milonov', 'sender', 'withdrawal']) {
  const w = createWorld(42, false, 'route', id === 'shaman' || id === 'pizdulina' ? 4 : 6);
  for (const hero of CHARACTERS) addPlayer(w, hero.id, hero.id);
  const progress = { scene: id, index: 0, completed: [], flags: {} };
  tickStory(progress, w, 0);
  const heroes = Object.values(w.players).sort((a, b) => a.x - b.x);
  check(`строй ${id}: шаг 30, взгляд к собеседнику`, heroes.every((p, i) => p.facing === 1 && (!i || p.x - heroes[i - 1].x === 30)));
  if (id === 'shaman' || id === 'pizdulina') check(`строй ${id} остаётся в арене`, heroes.every(p => p.x >= 700 && p.x <= 1180));
}
check('портреты всех сюжетных героев', ['portrait-prime.png', 'nadya/portrait.png', 'kris/portrait.png', 'ramil/portrait.png'].every(file => existsSync(publicDir + 'ui/' + file)));
check('ассеты боя Кати', ['idle', 'walk', 'hurt', 'fall', 'strike', 'cast', 'release'].every(clip => existsSync(publicDir + `sprites/enemies/katya-pl/${clip}-east.png`)));
check('лимиты вставок врагов', Object.values(ENEMY_INTRO).every(e => e.name.length <= 16 && e.tag.length <= 40 && e.line.length <= 60));
check('лимиты пушей и слов боя', Object.entries(content).every(([id, value]) => id.startsWith('push.') ? value.length <= 70 : /^(sh\.w\d|sh\.down|pz\.w\d|pz\.down|kat\.w\d|kat\.down)$/.test(id) ? value.length <= 12 : true));
check('лимиты карточек маршрута', LEVELS.route.stages.every(s => s.cards.every(([small, big]) => small.length <= 28 && big.length <= 14)));
check('лимиты вывесок, кроме заданного граффити', LEVELS.route.stages.every(s => s.signs.every(sign => sign.text === 'Спереди ОМОН не пробить' || sign.text.split('\n').every(line => line.length <= 14))));
check('старый сюжет отсутствует в игровых текстах', !/несуществующ|Вас нет|НАСТЯ ЕСТЬ|Тебя нет|Удалена мной|Как существовать|ОКНО 1|А-000|А-001|ожидайте вызова/i.test(Object.values(content).join('\n') + JSON.stringify(LEVELS.route.stages)));

const story = createStoryProgress();
check('пролог запускается', startStory(story, 'start'));
tickStory(story, createWorld(1, false, 'route'), 0);
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
const world = { level: 'route', stage: 0, won: false, enc: { cleared: 0 }, enemies: {} };
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
const routeWorld = { level: 'route', stage: 4, won: false, enc: { cleared: 0 }, enemies: {} as Record<string, { boss?: string; hp: number }> };
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
check('нулевые act выполняются в одном тике, движение частичное', actorsStory.index === 2 && actorsWorld.actors.vat1.x === 140 && actorsWorld.storyCamX === 150);
check('storyNext не может пропустить act', !advanceStory(actorsStory, storyStepKey(actorsStory), actorsWorld));
tickStory(actorsStory, actorsWorld, 599);
check('act ждёт полное время', actorsStory.index === 2 && actorsWorld.actors.vat1.x < 200);
tickStory(actorsStory, actorsWorld, 1);
check('act проходит сам точно по таймеру', actorsStory.index === 3 && actorsWorld.actors.vat1.x === 200);
check('часы боя во время постановки стоят', actorsWorld.timeMs === 0 && actorsWorld.tick === 0);
const actorsKey = storyStepKey(actorsStory);
advanceStory(actorsStory, actorsKey, actorsWorld);
check('повтор команды реплики не пропускает act', !advanceStory(actorsStory, actorsKey, actorsWorld));
tickStory(actorsStory, actorsWorld, 250);
check('отсутствующий герой пропущен, выбранный идёт', actorsStory.index === 5 && actorsWorld.players.a.x !== 250 && !actorsWorld.actors.kris);
tickStory(actorsStory, actorsWorld, 250);
check('герой дошёл, актёры и камера удалены после сцены', !actorsStory.scene && actorsWorld.players.a.x === 250 && Object.keys(actorsWorld.actors).length === 0 && actorsWorld.storyCamX === undefined);
STORY_SCENES.pop();

console.log(failed ? `${failed} проверок не прошло` : 'Все проверки прошли');
process.exitCode = failed ? 1 : 0;
