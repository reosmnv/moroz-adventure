import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { CHARACTERS, LEVELS, STORY_CONTENT, STORY_SCENES, advanceStory, createStoryProgress, startStory, startStoryForWorld, storyStepKey, wantedStatus, createWorld, addPlayer, tickStory, testStoryScene, testStoryStrict, step, emptyInput, encountersOf, stageOf } from '@bc/shared';
import { ROUTE } from '../../shared/src/route-data.ts';

let failed = 0;
function check(name: string, ok: boolean) { console.log(`${ok ? 'OK' : 'FAIL'} ${name}`); if (!ok) failed++; }
const content = STORY_CONTENT as Record<string, string>;
const publicDir = 'client/public/';
const vokzal = ROUTE.findIndex(stage => stage.id === 'vokzal');

// Снятые реплики защищённых персонажей храним до отдельной переделки.
const unusedTextExceptions = new Set([
  'ins.katya.name', 'ins.katya.tag', 'ins.katya.line', 'kat.6', 'kat.w2', 'kat.l3', 'kat.l4', 'kat.l5',
  'ins.pizd.name', 'ins.pizd.tag', 'ins.pizd.line', 'pz.5', 'pz.r', 'pz.w1',
]);
// Сцены уже вычислены: шаблонные ID и массивы здесь развёрнуты самим JS.
const usedTexts = new Set(STORY_SCENES.flatMap(scene => scene.steps.flatMap(step =>
  step.kind === 'act' || step.kind === 'state' ? [] : step.kind === 'phone' ? step.ids : [step.id])) as string[]);
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function scanTextUses(dir: string) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = `${dir}/${entry.name}`;
    if (entry.isDirectory()) { scanTextUses(file); continue; }
    if (!file.endsWith('.ts') || entry.name === 'story-content.ts') continue;
    const source = readFileSync(file, 'utf8');
    // Пропускаем комментарии и содержимое шаблонов; обычные ID читаем целиком.
    const tokens = source.matchAll(/\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g);
    for (const [token] of tokens) if (token[0] === '"' || token[0] === "'") usedTexts.add(token.slice(1, -1));
    // Прямые обращения вида T[`push.${n}`]: разворачиваем семейство по словарю.
    for (const match of source.matchAll(/\b(?:STORY_CONTENT|T)\s*\[\s*`([^`]+)`\s*\]/g)) {
      const pattern = match[1].split(/\$\{[^}]+\}/).map(escapeRegex).join('[^.]+');
      for (const id of Object.keys(content)) if (new RegExp(`^${pattern}$`).test(id)) usedTexts.add(id);
    }
  }
}
scanTextUses('shared/src'); scanTextUses('client/src');
for (const id of Object.keys(content)) check(`текст ${id}: используется или защищён`, usedTexts.has(id) || unusedTextExceptions.has(id));
check('исключения текстов существуют в словаре', [...unusedTextExceptions].every(id => id in content));

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
      const length = step.kind === 'phone' ? Math.max(...value.split('\n').map(line => line.length)) : value.length;
      if (length > limit) { console.log('too long', scene.id, id, length, limit); valid = false; }
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
  const actors = new Set([...known, ...kept, 'vat1', 'vat2', 'omon1', 'zek1', 'zek2', 'official', 'info_f', 'info_m', 'pizdulina', 'katya', 'milonov']);
  for (const step of scene.steps) {
    if (step.kind === 'act' && step.do === 'spawn') {
      actors.add(step.actor); if (step.keep) kept.add(step.actor);
    }
    const ref = step.kind === 'act' && step.actor !== 'camera' ? step.actor
      : step.kind === 'line' ? step.at ?? step.speaker : step.kind === 'phone' ? step.at : undefined;
    if (ref && !actors.has(ref)) { console.log('missing actor', scene.id, ref); refsValid = false; }
    if (step.kind === 'act' && step.do === 'exit') { actors.delete(step.actor); kept.delete(step.actor); }
  }
}
check('все at и act ссылаются на героев или живых актёров', refsValid);
check('ID, лимиты сцен и ссылки на ассеты', valid);
check('не более шести реплик подряд', longest <= 6);
const prologue = STORY_SCENES.find(s => s.id === 'prologue')!;
const phoneIndex = prologue.steps.findIndex(s => s.kind === 'phone');
const reaction = prologue.steps[phoneIndex + 1];
check('реакция Насти отдельной репликой после телефона', reaction.kind === 'line' && reaction.id === 'intro.button' && reaction.speaker === 'anastasia'
  && !prologue.steps.some(s => s.kind === 'phone' && s.ids.includes('intro.button')));

const milonov = STORY_SCENES.find(s => s.id === 'milonov')!;
const milLines = milonov.steps.filter(s => s.kind === 'line');
const confession = milLines.findIndex(s => s.id === 'mil.3');
check('B1 Милонов (сокращено 07.11): mil.3 → mil.p3 → mil.p5', milLines.slice(confession, confession + 3).map(s => s.id).join() === 'mil.3,mil.p3,mil.p5'
  && milLines.find(s => s.id === 'mil.p3')?.speaker === 'ramil');
check('B1 признание и вопрос (сокращено 07.11)', content['mil.p3'].length > 0 && content['mil.p5'].length > 0);
const city = STORY_SCENES.find(s => s.id === 'city')!;
const cityOpening = city.steps.find(s => s.kind !== 'act' && s.kind !== 'state');
check('B3 первая реплика Сити объясняет, зачем Сити (тексты mr.R 07.11)', cityOpening?.kind === 'line' && cityOpening.id === 'cty.route'
  && cityOpening.speaker === 'nadezhda' && /МФЦ в Сити/.test(content[cityOpening.id]));
const leverage = STORY_SCENES.find(s => s.id === 'leverage')!;
check('B4 без кадра записи (mr.R 07.11): lev.1 → lev.4 → lev.5', leverage.steps.filter(s => s.kind === 'line').map(s => s.id).join() === 'lev.1,lev.4,lev.5'
  && !leverage.steps.some(s => s.kind === 'composition'));
{
  const w = createWorld(23, true, 'route', 5), st = createStoryProgress(); addPlayer(w, 'a', 'nadezhda');
  testStoryScene(st, w, 'city', true); tickStory(st, w, 20000);
  check('B3 объяснение МФЦ показано до первого боя Сити', st.scene === 'city' && city.steps[st.index] === cityOpening
    && w.enc.cleared === 0 && Object.values(w.enemies).every(e => e.storyWaiting));
}
{
  const w = createWorld(23, false, 'route', 0);
  const street = encountersOf(w);
  check('B5 первый бой street: только ватники, две волны 6/4 (mr.R 07.11)', street[0].waves.flat().every(e => e.kind === 'vatnik')
    && street[0].waves.map(wave => wave.length).join() === '6,4');
  const st = createStoryProgress(); st.completed.push('prologue', 'street_vat');
  const p = addPlayer(w, 'a', 'anastasia'); p.x = 1400;
  w.enc.index = w.enc.cleared = 1;
  check('B5 arch запускается после первой встречи без оставшихся врагов', Object.keys(w.enemies).length === 0 && startStoryForWorld(st, w) && st.scene === 'arch');
  const omon = Object.values(w.enemies).find(e => e.id.endsWith('--omon1'));
  check('B5 omon1 создан из встречи 1 и ждёт завершения arch', !!omon && omon.kind === 'omon' && !!omon.storyWaiting && w.storyEncounter?.index === 1);
}
{
  const w = createWorld(23, false, 'route', 6), st = createStoryProgress();
  const a = addPlayer(w, 'a', 'anastasia'), b = addPlayer(w, 'b', 'ramil');
  a.x = 2200; a.viewX = 1920; a.viewW = 560;
  b.x = 2180; b.viewX = 1090; b.viewW = 2200;
  w.enc.index = w.enc.cleared = 2;
  st.completed = STORY_SCENES.slice(0, STORY_SCENES.indexOf(milonov)).map(s => s.id);
  for (const id of ['milonov', 'leverage']) {
    check(`B2 обычный запуск ${id}`, startStoryForWorld(st, w) && st.scene === id);
    for (let n = 0; st.scene && n < 200; n++) { tickStory(st, w, 20000); advanceStory(st, storyStepKey(st), w); }
    check(`B2 Милонов остаётся после ${id}`, !st.scene && !!w.actors.milonov);
  }
  check('B2 обычный запуск sender', startStoryForWorld(st, w) && st.scene === 'sender');
  const sender = STORY_SCENES.find(s => s.id === 'sender')!;
  const exitIndex = sender.steps.findIndex(s => s.kind === 'act' && s.actor === 'milonov' && s.do === 'exit');
  for (let n = 0; st.scene && st.index < exitIndex - 1 && n < 200; n++) { tickStory(st, w, 20000); advanceStory(st, storyStepKey(st), w); }
  const before = w.actors.milonov?.x ?? 0;
  tickStory(st, w, 1100);
  const actor = w.actors.milonov;
  check('B2 уход показан: разворот, движение, актёр ещё существует', exitIndex > 0 && st.scene === 'sender'
    && !!actor && actor.facing === 1 && actor.anim === 'walk' && actor.x > before && actor.x < actor.tx);
  check('B2 цель ухода за краем обоих экранов', !!actor && actor.tx > Math.max(a.viewX + a.viewW, b.viewX + b.viewW) + 100);
  check('B2 уход нельзя пропустить командой', !advanceStory(st, storyStepKey(st), w));
  tickStory(st, w, 1099);
  check('B2 актёр не удаляется раньше конца ухода', !!w.actors.milonov && st.scene === 'sender');
  tickStory(st, w, 1);
  check('B2 после sender Милонов ушёл и удалён', !st.scene && st.completed.includes('sender') && !w.actors.milonov);
}
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
for (const scene of STORY_SCENES) {
  const w = createWorld(22, true); addPlayer(w, 'me', 'anastasia');
  const progress = createStoryProgress(); testStoryScene(progress, w, scene.id, true);
  const heroes = Object.values(w.players), me = w.players.me;
  check(`R1 один клиент, ${scene.id}: все герои idle в кадре`, heroes.length === 4 && heroes.every(p => p.connected && !p.away && p.anim === 'idle' && p.move === 'idle' && p.x >= me.viewX! && p.x <= me.viewX! + me.viewW!) && new Set(heroes.map(p => `${p.x}:${p.y}`)).size === 4);
}
const gateWorld = createWorld(42, true, 'route');
addPlayer(gateWorld, 'a', 'anastasia'); addPlayer(gateWorld, 'b', 'ramil');
const gate = createStoryProgress(); gate.completed.push('prologue');
gateWorld.players.a.x = 338; gateWorld.players.b.x = 283;
check('один отставший герой задерживает сцену', !startStoryForWorld(gate, gateWorld));
gateWorld.players.b.x = 284;
check('вся группа у порога запускает сцену', startStoryForWorld(gate, gateWorld));
gate.scene = ''; gateWorld.players.b.x = 10; gateWorld.players.b.hp = 0;
check('павший герой не задерживает сцену', startStoryForWorld(gate, gateWorld));
gate.scene = ''; gateWorld.players.b.hp = 150;
testStoryStrict(gateWorld, false);
check('тестовый выключатель снимает проверку x', startStoryForWorld(gate, gateWorld));

for (const absent of ['disconnected', 'away', 'active'] as const) {
  const w = createWorld(23, false, 'route'), story = createStoryProgress(); story.completed.push('prologue');
  const a = addPlayer(w, 'a', 'anastasia'), b = addPlayer(w, 'b', 'ramil');
  a.x = 480; b.x = 10; b.connected = absent !== 'disconnected'; b.away = absent === 'away';
  check(`A1.2 отстающий ${absent}`, startStoryForWorld(story, w) === (absent !== 'active'));
}
for (const strict of [false, true]) {
  const w = createWorld(23, false, 'route'), story = createStoryProgress(); story.completed.push('prologue');
  const p = addPlayer(w, 'a', 'anastasia'); p.x = 480; p.away = true; w.storyStrict = strict;
  check(`A1.2 без активных живых нет старта, strict=${strict}`, !startStoryForWorld(story, w));
  p.away = false; p.hp = 0;
  check(`A1.2 все пали: нет старта, strict=${strict}`, !startStoryForWorld(story, w));
}

const protectedWorld = createWorld(42, false);
check('тестовые сцены запрещены вне testMode', !testStoryScene(createStoryProgress(), protectedWorld, 'arch', false));
check('портреты всех сюжетных героев', ['portrait-prime.png', 'nadya/portrait.png', 'kris/portrait.png', 'ramil/portrait.png'].every(file => existsSync(publicDir + 'ui/' + file)));
check('ассеты боя Кати', ['idle', 'walk', 'hurt', 'fall', 'strike', 'cast', 'release'].every(clip => existsSync(publicDir + `sprites/enemies/katya-pl/${clip}-east.png`)));
check('лимиты пушей и слов боя', Object.entries(content).every(([id, value]) => id.startsWith('push.') ? value.length <= 70 : /^(\w+\.w\d|\w+\.down|word\..+)$/.test(id) ? value.length <= 26 : true));  // слова боссов: до 26 знаков по текстам mr.R 07.11
check('B6 оба перекрёстных слова в словаре, максимум 12 знаков', ['word.crossBan', 'word.crossStage'].every(id => !!content[id] && content[id].length <= 12));
check('лимиты карточек маршрута', LEVELS.route.stages.every(s => s.cards.every(([small, big]) => small.length <= 28 && big.length <= (s.id === 'vokzal' ? 15 : 14))));
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
const world = { level: 'route', stage: 0, won: false, enc: { cleared: 0 }, enemies: {}, players: { a: { x: 4000, hp: 150, connected: true, away: false } } };
check('следующая сцена запускается по маршруту', startStoryForWorld(story, world) && story.scene === 'street_vat');
const status = wantedStatus({ ...world, stage: 2, enc: { cleared: 1 } }, story);
check('150 тысяч и три звезды в вестибюле', status.stars === 3 && status.reward === 150000);
const later = wantedStatus({ ...world, stage: 3, enc: { cleared: 1 } }, story);
check('500 тысяч и три звезды в вагоне', later.stars === 3 && later.reward === 500000);
check('четыре после Пиздулины', wantedStatus({ ...world, stage: 4, storyPizDown: true }, story).stars === 4);
check('B7 четыре при входе в Сити', wantedStatus({ ...world, stage: 5, enc: { cleared: 0 } }, story).stars === 4);
check('B7 пять после первой встречи в Сити', wantedStatus({ ...world, stage: 5, enc: { cleared: 1 } }, story).stars === 5);
check('B7 пять сохраняются в главном МФЦ до снятия розыска', wantedStatus({ ...world, stage: 6, enc: { cleared: 0 } }, story).stars === 5);
{
  const w = createWorld(23, false, 'route', 5), st = createStoryProgress(); addPlayer(w, 'a', 'anastasia');
  step(w, {});
  check('B7 до первого боя Сити четыре звезды, пуша пяти ещё нет', wantedStatus(w, st).stars === 4 && !w.storyPushes?.[5]);
  w.enc.index = w.enc.cleared = 1; step(w, {});
  check('B7 пятая звезда и push.6 появляются в одном событии', wantedStatus(w, st).stars === 5 && !!w.storyPushes?.[5]);
}
story.flags.wanted = 'off';
check('розыск снят после Милонова', wantedStatus({ ...world, stage: 6 }, story).stars === 0);

// Местный МФЦ должен предшествовать Сити, а Милонов ждать конца второй арены.
const route = createStoryProgress();
const routeWorld = { level: 'route', stage: 4, won: false, enc: { cleared: 0 }, enemies: {} as Record<string, { boss?: string; hp: number }>, players: { a: { x: 4000, hp: 150, connected: true, away: false } } };
const finishScene = () => finish(route);
check('сцена Маяковской начинается при входе', startStoryForWorld(route, routeWorld) && route.scene === 'mayak');
finishScene();
check('местный МФЦ не запускается до выхода с Маяковской', !startStoryForWorld(route, routeWorld));
routeWorld.enc.cleared = 1;
check('после обоих боссов нет местного МФЦ', !startStoryForWorld(route, routeWorld));
finishScene(); routeWorld.stage = 5; routeWorld.enc.cleared = 0;
check('Сити следует после Маяковской', startStoryForWorld(route, routeWorld) && route.scene === 'city');
finishScene(); routeWorld.stage = 6;
check('Милонов не встречается у входа в главный МФЦ', !startStoryForWorld(route, routeWorld));
routeWorld.enc.cleared = 2;
check('Милонов появляется у последней арены', startStoryForWorld(route, routeWorld) && route.scene === 'milonov');
finishScene();
check('доступ к базе следует за признанием', startStoryForWorld(route, routeWorld) && route.scene === 'leverage');
finishScene();
check('отправитель раскрывается после доступа к базе', startStoryForWorld(route, routeWorld) && route.scene === 'sender');
finishScene(); routeWorld.stage = vokzal; routeWorld.enc.cleared = 0;
routeWorld.enemies.k = { boss: 'katya', hp: 1 };
check('Катя появляется на вокзале после раскрытия отправителя', startStoryForWorld(route, routeWorld) && route.scene === 'katya');
finishScene(); routeWorld.enemies = {}; routeWorld.enc.cleared = 1; routeWorld.won = true;
check('отзыв доноса и поздравление следуют за боем', startStoryForWorld(route, routeWorld) && route.scene === 'withdrawal');
finishScene();
check('финал открыт после отзыва доноса', route.flags.finaleReady === 'on');

{
  const sender = STORY_SCENES.find(s => s.id === 'sender')!;
  check('TZ26 sender показывает геометку и билет', sender.steps.some(s => s.kind === 'phone' && s.ids.includes('hck.5')) && /Киевский/i.test(content['hck.5']));
  check('TZ26 sender направляет на Киевский', sender.steps.some(s => s.kind === 'line' && s.id === 'hck.7'));
  check('TZ26 финальный кадр с вокзала', content['fin.4'].length > 0);
  for (const id of ['katya', 'withdrawal']) {
    const w = createWorld(26, true), st = createStoryProgress(); addPlayer(w, 'a', 'anastasia');
    testStoryScene(st, w, id, true); tickStory(st, w, 20000);
    const arena = encountersOf(w)[0].arena;
    check(`TZ26 ${id}: сцена на вокзале`, w.stage === vokzal && st.scene === id);
    check(`TZ26 ${id}: герои и Катя в арене`, Object.values(w.players).every(p => p.x >= arena[0] && p.x <= arena[1])
      && (id === 'katya' ? Object.values(w.enemies).some(e => e.boss === 'katya' && e.x >= arena[0] && e.x <= arena[1])
        : !!w.actors.katya && w.actors.katya.x >= arena[0] && w.actors.katya.x <= arena[1]));
  }
}

// Как в сессиях: пока идёт сцена, боевой step и проверка выхода не выполняются.
{
  const mfc = ROUTE.findIndex(stage => stage.id === 'mfc');
  const w = createWorld(26, false, 'route', mfc), st = createStoryProgress();
  const p = addPlayer(w, 'a', 'anastasia'), exit = stageOf(w).exit!;
  p.x = exit.x0 + 10; p.y = exit.y1;
  w.enc.index = w.enc.cleared = encountersOf(w).length - 1;
  step(w, {});
  check('TZ26 выход МФЦ закрыт до всех боёв', !w.trans && !w.won);
  w.enemies = {}; w.enc.lock = null; w.enc.queue = [];
  w.enc.index = w.enc.cleared = encountersOf(w).length;
  p.x = exit.x0 + 10; p.y = exit.y1;
  st.completed = STORY_SCENES.slice(0, STORY_SCENES.findIndex(s => s.id === 'milonov')).map(s => s.id);
  for (const id of ['milonov', 'leverage', 'sender']) {
    startStoryForWorld(st, w);
    check(`TZ26 у выхода запускается ${id}`, st.scene === id);
    for (let n = 0; st.scene && n < 200; n++) {
      tickStory(st, w, 20000); advanceStory(st, storyStepKey(st), w);
    }
    check(`TZ26 выход не обрывает ${id}`, st.completed.includes(id) && w.stage === mfc && !w.trans && !w.won);
  }
  step(w, {});
  check('TZ26 после sender выход ведёт на вокзал', w.trans?.to === vokzal);
  for (let n = 0; n < 60; n++) step(w, {});
  check('TZ26 группа перешла на вокзал без преждевременной победы', w.stage === vokzal && !w.won);
}

// Кампания вместе с постановкой: четыре героя идут обычным вводом, враги снимаются тестом.
const campaignWorld = createWorld(8, false, 'route'), campaign = createStoryProgress();
for (const hero of CHARACTERS) { const p = addPlayer(campaignWorld, hero.id, hero.id); p.god = true; }
startStory(campaign, 'start');
const tracked = new Set(['street_vat', 'arch', 'vestibule', 'wagon', 'mayak', 'city', 'shaman', 'pizdulina', 'katya']);
const seenReal = new Set<string>();
const spread = (es: { x: number; y: number }[]) => es.every((a, i) => es.slice(i + 1).every(b => Math.abs(a.x - b.x) >= 18 - 1e-6 || Math.abs(a.y - b.y) >= 22 - 1e-6));
let realScene = '', realBefore: { id: string; x: number; y: number }[] = [];
for (let ticks = 0; ticks < 50000 && campaign.flags.finaleReady !== 'on'; ticks++) {
  startStoryForWorld(campaign, campaignWorld);
  if (campaign.scene) {
    if (tracked.has(campaign.scene) && realScene !== campaign.scene) {
      realScene = campaign.scene; seenReal.add(realScene);
      realBefore = Object.values(campaignWorld.enemies).filter(e => e.hp > 0 && e.storyWaiting).map(e => ({ id: e.id, x: e.x, y: e.y }));
      check(`R4 реальный подход ${realScene}`, realBefore.length > 0 && spread(realBefore));
    }
    tickStory(campaign, campaignWorld, 20000);
    advanceStory(campaign, storyStepKey(campaign), campaignWorld);
    if (!campaign.scene && realScene) {
      check(`R4 конец диалога ${realScene}`, realBefore.every(e => campaignWorld.enemies[e.id]?.x === e.x && campaignWorld.enemies[e.id]?.y === e.y) && spread(realBefore));
      for (let n = 0; n < 30; n++) step(campaignWorld, {} , 20);
      const after = realBefore.map(e => campaignWorld.enemies[e.id]).filter(Boolean);
      check(`R4 600мс боя ${realScene}`, after.length === realBefore.length && spread(after) && after.every((e, i) => Math.abs(e.x - realBefore[i].x) <= 22 && e.x <= realBefore[i].x));
      realScene = '';
    }
    continue;
  }
  for (const e of Object.values(campaignWorld.enemies)) if (!e.storyWaiting && (e.entered || e.boss)) e.hp = 0;
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
check('R4 пройдены все сцены обычным маршрутом', seenReal.size === tracked.size);
check('кампания от пролога до победы с четырьмя героями', campaignWorld.won && campaign.flags.finaleReady === 'on' && STORY_SCENES.every(s => campaign.completed.includes(s.id)));

// Тот же порядок вызовов, что у LocalSession, с одним игроком и ходьбой.
{
  const w = createWorld(22, false, 'route'), st = createStoryProgress();
  addPlayer(w, 'solo', 'anastasia'); st.completed.push('prologue');
  for (let n = 0; n < 500 && !st.scene; n++) {
    startStoryForWorld(st, w);
    if (!st.scene) { step(w, { solo: { ...emptyInput(), mx: 1 } }); startStoryForWorld(st, w); }
  }
  const before = Object.values(w.enemies).filter(e => e.storyWaiting).map(e => ({ id: e.id, x: e.x, y: e.y }));
  check('R4 соло пешком: строй до диалога', st.scene === 'street_vat' && before.length === 6 && spread(before));
  while (st.scene) { tickStory(st, w, 20000); advanceStory(st, storyStepKey(st), w); }
  check('R4 соло: строй после диалога', before.every(e => w.enemies[e.id]?.x === e.x && w.enemies[e.id]?.y === e.y) && spread(before));
  for (let n = 0; n < 30; n++) step(w, {}, 20);
  const after = before.map(e => w.enemies[e.id]).filter(Boolean);
  check('R4 соло: строй через 600 мс', after.length === 6 && spread(after) && after.every((e, i) => e.x <= before[i].x && before[i].x - e.x <= 22));
}

// R2: сюжет снимает даже незавершённую атаку, сохраняя координаты.
for (const anim of ['run', 'attack'] as const) {
  const w = createWorld(42, true), progress = createStoryProgress();
  const p = addPlayer(w, 'me', 'ramil'); p.x = 480; p.y = 205;
  p.anim = anim; p.move = 'fist'; p.combo = 2; p.fDashMs = 100; p.approach = { x: 0, y: 0, tx: 500, ty: 205, ms: 100, rush: true, target: '' };
  progress.completed.push('prologue');
  check(`R2 старт из ${anim}`, startStoryForWorld(progress, w));
  check(`R2 idle без перемещения ${anim}`, String(p.anim) === 'idle' && p.move === 'idle' && p.combo === 0 && !p.fDashMs && !p.approach && p.x === 480 && p.y === 205);
}
for (const id of ['street_vat', 'arch', 'vestibule', 'wagon', 'mayak', 'city', 'shaman', 'pizdulina', 'katya']) {
  const w = createWorld(42, true), progress = createStoryProgress(); addPlayer(w, 'me', 'anastasia');
  testStoryScene(progress, w, id, true);
  const before = Object.values(w.enemies).filter(e => e.hp > 0).map(e => ({ id: e.id, x: e.x, y: e.y, hp: e.hp }));
  check(`R4 настоящие враги ${id}`, before.length > 0 && before.every(e => w.enemies[e.id].storyWaiting));
  check(`R4 строй ${id}`, before.every((a, i) => before.slice(i + 1).every(b => Math.abs(a.x - b.x) >= 18 || Math.abs(a.y - b.y) >= 22)));
  tickStory(progress, w, 20000);
  check(`R4 ожидание ${id}`, before.every(e => w.enemies[e.id].x === e.x && w.enemies[e.id].y === e.y && w.enemies[e.id].hp === e.hp && w.enemies[e.id].anim === 'idle'));
  for (let n = 0; progress.scene && n < 200; n++) { tickStory(progress, w, 20000); advanceStory(progress, storyStepKey(progress), w); }
  check(`R4 те же сущности в начале боя ${id}`, before.every(e => w.enemies[e.id].x === e.x && w.enemies[e.id].y === e.y && !w.enemies[e.id].storyWaiting));
  const ids = before.map(e => e.id); step(w, {});
  check(`R4 встреча не пересоздаёт участников ${id}`, ids.every(id => !!w.enemies[id]));
}

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
