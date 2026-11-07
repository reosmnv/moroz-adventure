import { CHARACTERS, HERO_ID, KRIS_ID, NADYA_ID, LEVELS, TEST_TOOLS, STORY_SCENES, STORY_CONTENT } from '@bc/shared';
import { LocalSession, OnlineSession, clearReconnect, returnToMenu, savedReconnect, type GameSession } from './session.ts';
import { GAME_TITLE, STORY, syncStoryView } from './story.ts';
import type { startGame } from './scene.ts';
import { audioState, unlockAudio } from './audio.ts';
import { settings, updateSettings } from './settings.ts';
import { DEBUG } from './debug.ts';

const $ = (id: string) => document.getElementById(id)!;
const visible = (id: string, on: boolean) => $(id).classList.toggle('hidden', !on);
const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? `${location.protocol}//${location.hostname}:2567`;
const params = new URLSearchParams(location.search);
const roomCode = location.hash.slice(1).toUpperCase() || undefined;
let debugTouch = '-';
if (DEBUG) document.addEventListener('touchstart', e => { const t = e.touches[0]; const el = document.elementFromPoint(t.clientX, t.clientY); debugTouch = `${t.clientX | 0},${t.clientY | 0} ${el?.tagName ?? '?'}${el?.id ? '#' + el.id : ''}${el && typeof el.className === 'string' && el.className ? '.' + el.className.split(' ')[0] : ''}`; }, { capture: true, passive: true });
const MENU_SCREENS = ['menuHome', 'newScreen', 'joinScreen', 'testScreen'];
const portrait = (id: string) => id === HERO_ID ? 'ui/portrait-prime.png' : id === NADYA_ID ? 'ui/nadya/portrait.png' : id === KRIS_ID ? 'ui/kris/portrait.png' : 'ui/ramil/portrait.png';
let session: GameSession | null = null;
let game: ReturnType<typeof startGame> | null = null;
let busy = false;
let testOnline = localStorage.getItem('bc-online') !== '0';
let selectedStage = Number(params.get('stage'));
let pausePanel = '';
let picking = false;
let changingHero = false;
let pendingHero = '';
let pickerSignature = '';
let settingsFromPause = false;

const showErr = (msg: string) => { visible('err', true); $('err').textContent += msg + '\n'; };
window.addEventListener('error', e => showErr(String(e.message)));
window.addEventListener('unhandledrejection', e => showErr(String(e.reason?.message ?? e.reason)));
document.addEventListener('touchstart', e => { if ((e.target as HTMLElement).tagName === 'CANVAS') e.preventDefault(); }, { passive: false });
document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', e => e.preventDefault());
document.title = GAME_TITLE;
// Логотип в меню: MOROZ ледяными прыгающими буквами, BIRTHDAY на розовой ленте, ADVENTURES золотом
$('gameTitle').setAttribute('aria-label', GAME_TITLE);
$('gameTitle').innerHTML = `<span class="logo-moroz">${[...'MOROZ'].map((c, i) => `<i style="--i:${i}">${c}</i>`).join('')}</span>`
  + '<span class="logo-ribbon">BIRTHDAY</span><span class="logo-adv">ADVENTURES</span>';
$('newOnline').textContent = STORY.menu.online; $('newLocal').textContent = STORY.menu.solo;
$('share').textContent = STORY.service.invite;
$('exitYes').textContent = STORY.service.exit; $('exitNo').textContent = STORY.service.stay;
let createdOpen = false;
for (const c of CHARACTERS) {
  const img = document.createElement('img'); img.src = portrait(c.id); img.alt = c.name; $('portraits').append(img);
}
function menuScreen(id: string) {
  for (const screen of MENU_SCREENS) visible(screen, screen === id);
  $('menuNote').textContent = '';
}
function refreshContinue() {
  const saved = savedReconnect();
  visible('continueBtn', !!saved);
  $('continueBtn').textContent = saved ? `Продолжить · ${saved.roomId}` : '';
}
refreshContinue();
visible('linkJoin', !!roomCode);
$('linkJoin').textContent = `Войти в комнату ${roomCode ?? ''}`;
visible('openTest', TEST_TOOLS);
$('serverNote').textContent = `Сервер: ${SERVER_URL}`;
$('start').onclick = () => menuScreen('newScreen');
$('openJoin').onclick = () => { menuScreen('joinScreen'); $('codeInput').focus(); };
$('openTest').onclick = () => menuScreen('testScreen');
for (const b of document.querySelectorAll<HTMLButtonElement>('.menuBack')) b.onclick = () => menuScreen('menuHome');
$('linkJoin').onclick = () => void begin(true, roomCode);
$('continueBtn').onclick = () => void begin(true, undefined, 0, false, true);
$('newOnline').onclick = () => void begin(true);
$('newLocal').onclick = () => void begin(false);
$('joinScreen').onsubmit = e => {
  e.preventDefault();
  const code = ($('codeInput') as HTMLInputElement).value.trim().toUpperCase();
  if (!/^[A-Z0-9]{5}$/.test(code)) { $('menuNote').textContent = 'Код из 5 символов'; return; }
  void begin(true, code);
};
function renderTest() {
  $('testOnline').setAttribute('aria-pressed', String(testOnline));
  $('testLocal').setAttribute('aria-pressed', String(!testOnline));
  for (const [i, b] of [...$('locations').children].entries()) b.classList.toggle('selected', i === selectedStage);
}
for (const [i, stage] of LEVELS.route.stages.entries()) {
  const b = document.createElement('button');
  const label = stage.cards[0][1].toLocaleLowerCase('ru');
  b.textContent = label.charAt(0).toLocaleUpperCase('ru') + label.slice(1);
  // Имена собственные сохраняют регистр карточек маршрута.
  if (stage.id === 'city') b.textContent = 'Москва-Сити';
  if (stage.id === 'mfc') b.textContent = 'Главный МФЦ';
  if (stage.id === 'vestibule') b.textContent = '«Беговая»';
  if (stage.id === 'mayak') b.textContent = '«Маяковская»';
  b.className = 'secondary'; b.onclick = () => { selectedStage = i; renderTest(); void begin(testOnline, undefined, i, true); };
  $('locations').append(b);
}
$('testOnline').onclick = () => { testOnline = true; localStorage.setItem('bc-online', '1'); renderTest(); };
$('testLocal').onclick = () => { testOnline = false; localStorage.setItem('bc-online', '0'); renderTest(); };
$('testOld').textContent = STORY_CONTENT['menu.old'];
$('testOld').onclick = () => { if (TEST_TOOLS) void begin(testOnline, undefined, 0, true, false, 'old'); };
renderTest();
if (TEST_TOOLS && params.has('stage') && Number.isInteger(selectedStage) && selectedStage >= 0 && selectedStage < LEVELS.route.stages.length) menuScreen('testScreen');

async function begin(online: boolean, code?: string, stage = 0, testMode = false, resume = false, level: 'route' | 'old' = 'route') {
  if (busy) return;
  busy = true; $('menuNote').textContent = online ? 'Подключаюсь…' : 'Загружаю…';
  try {
    unlockAudio();
    if (!resume) clearReconnect();
    const { startGame } = await import('./scene.ts');
    session = online ? await OnlineSession.open(SERVER_URL, code, level, stage, testMode, resume) : new LocalSession(level, stage, testMode);
    ($('storyStrict') as HTMLInputElement).checked = true;
    session.onPickError = message => { pendingHero = ''; $('pickNote').textContent = message; };
    if (session.roomId) history.replaceState(null, '', location.pathname + '#' + session.roomId);
    else history.replaceState(null, '', location.pathname);
    visible('share', online);
    await Promise.race([document.fonts.load('12px "Press Start 2P"', 'АБВабвЁё09:').catch(() => {}), new Promise(r => setTimeout(r, 2000))]);
    game = startGame('game', session);
    visible('menu', false); visible('topbar', true);
    if (online && !code && !resume) { createdOpen = true; openShare(true); }
  } catch (e: unknown) {
    const failedSession = session, failedGame = game;
    session = null; game = null;
    // Одна ошибка очистки не должна помешать освободить второй ресурс.
    try { failedSession?.leave(); } catch (cleanupError) { console.error(cleanupError); }
    try { failedGame?.destroy(true); } catch (cleanupError) { console.error(cleanupError); }
    createdOpen = false; pausePanel = '';
    visible('shareBox', false); visible('topbar', false); visible('menu', true);
    const error = e as { code?: number; message?: string };
    const msg = error.message ?? String(e);
    $('menuNote').textContent = /full|maxclients|locked/i.test(msg) ? STORY.service.joinFull
      : error.code === 522 || /not found|disposed|does not exist/i.test(msg) ? STORY.service.joinMissing
      : /network|fetch|websocket|timeout|failed to connect/i.test(msg) ? STORY.service.joinNetwork : STORY.service.joinOther;
    refreshContinue();
  } finally { busy = false; }
}

function closeTest() { visible('testPanel', false); $('testBtn').setAttribute('aria-expanded', 'false'); }
$('testBtn').onclick = () => {
  const open = $('testPanel').classList.contains('hidden'); visible('testPanel', open); $('testBtn').setAttribute('aria-expanded', String(open));
};
$('nextBtn').onclick = () => session?.next();
$('spawnBtn').onclick = () => session?.spawn();
if (TEST_TOOLS) {
  const names: Record<string, string> = { prologue: 'Вступление', street_vat: 'Ватники у подъезда', arch: 'ОМОН у арки', vestibule: 'Вестибюль', wagon: 'Вагон', mayak: 'Маяковская', shaman: 'Шаман', pizdulina: 'Пиздулина', city: 'Москва-Сити', milonov: 'Милонов', leverage: 'Доступ к базе', sender: 'Отправитель', katya: 'Катя', withdrawal: 'Отзыв доноса и финал' };
  const select = $('storySceneSelect') as HTMLSelectElement;
  for (const scene of STORY_SCENES) select.add(new Option(`${scene.id} · ${names[scene.id] ?? scene.id}`, scene.id));
  const strict = $('storyStrict') as HTMLInputElement;
  $('storySceneBtn').onclick = () => session?.runScene(select.value, strict.checked);
  strict.onchange = () => session?.strictScenes(strict.checked);
}
$('summonBtn').onclick = () => session?.summon();
$('chargeBtn').onclick = () => session?.charge();
$('healBtn').onclick = () => session?.heal();
$('killBtn').onclick = () => session?.killAll();
$('godBtn').onclick = () => session?.god(!session.snapshots.at(-1)?.players.get(session.me)?.god);
$('pauseBtn').onclick = () => { closeTest(); session?.setPaused(true); };
$('resumeBtn').onclick = () => { unlockAudio(); session?.setPaused(false); };
$('exitBtn').onclick = () => { document.querySelector('#exitBox p')!.textContent = session?.kind === 'online' ? STORY.service.exitOnline : STORY.service.exitLocal; pausePanel = 'exit'; visible('exitBox', true); };
$('exitNo').onclick = () => { pausePanel = ''; visible('exitBox', false); };
$('exitYes').onclick = $('lostMenu').onclick = () => { if (session) returnToMenu(session); };
$('reconnectBtn').onclick = async () => {
  if (!session) return;
  const b = $('reconnectBtn') as HTMLButtonElement; b.disabled = true;
  $('lostNote').textContent = 'Переподключаюсь…';
  try { await session.reconnect(); } finally { b.disabled = false; $('lostNote').textContent = session.connectionLost ? 'Не удалось вернуться в комнату' : ''; }
};

function showPicker(change = false) {
  session?.resetControls();
  changingHero = change; picking = true; pickerSignature = ''; pendingHero = '';
  $('pickNote').textContent = ''; visible('picker', true);
  if (change) pausePanel = 'picker';
  closeTest();
  renderPicker();
}
function hidePicker() { picking = false; visible('picker', false); pausePanel = ''; }
function renderPicker() {
  if (!session || !picking) return;
  const current = session.snapshots.at(-1)?.players.get(session.me)?.char;
  if ((!changingHero && current) || (pendingHero && current === pendingHero)) { hidePicker(); return; }
  const taken = session.taken();
  const signature = `${current}:${taken.join(',')}:${changingHero}`;
  if (signature === pickerSignature) return;
  pickerSignature = signature; $('chars').replaceChildren();
  for (const c of CHARACTERS) {
    const b = document.createElement('button'); const img = document.createElement('img');
    img.src = portrait(c.id); img.alt = ''; b.append(img, document.createTextNode(c.name));
    const note = document.createElement('span'); note.textContent = c.id === current ? 'сейчас' : taken.includes(c.id) ? 'занят' : '';
    b.append(note); b.disabled = c.id === current || taken.includes(c.id);
    b.classList.toggle('current', c.id === current);
    b.onclick = () => { if (pendingHero) return; unlockAudio(); pendingHero = c.id; $('pickNote').textContent = ''; if (changingHero) session!.switchHero(c.id); else session!.pick(c.id); };
    $('chars').append(b);
  }
}
$('switchBtn').onclick = () => showPicker(true);
$('pickBack').onclick = () => { if (changingHero) hidePicker(); else if (session) returnToMenu(session); };

function openSettings(fromPause: boolean) {
  session?.resetControls();
  settingsFromPause = fromPause;
  if (fromPause) pausePanel = 'settings';
  visible('settingsBox', true); renderSettings();
}
function renderSettings() {
  $('settingsRows').replaceChildren();
  const rows: { label: string; value: string; toggle: () => void }[] = [
    { label: 'Звук', value: settings.sound ? 'вкл' : 'выкл', toggle: () => updateSettings({ sound: !settings.sound }) },
    { label: 'Вспышки ударов', value: ({ full: 'полные', soft: 'мягкие', off: 'выкл' })[settings.flashes], toggle: () => updateSettings({ flashes: settings.flashes === 'full' ? 'soft' : settings.flashes === 'soft' ? 'off' : 'full' }) },
    { label: 'Тряска экрана', value: settings.shake ? 'вкл' : 'выкл', toggle: () => updateSettings({ shake: !settings.shake }) },
  ];
  for (const row of rows) {
    const wrap = document.createElement('div'); wrap.className = 'setting';
    const label = document.createElement('span'); label.textContent = row.label;
    const b = document.createElement('button'); b.className = 'secondary'; b.textContent = row.value; b.setAttribute('aria-label', `${row.label}: ${row.value}`);
    b.classList.toggle('selected', row.value !== 'выкл');
    b.onclick = () => { row.toggle(); renderSettings(); };
    wrap.append(label, b); $('settingsRows').append(wrap);
  }
}
$('menuSettings').onclick = () => openSettings(false);
$('pauseSettings').onclick = () => openSettings(true);
$('settingsBack').onclick = () => { visible('settingsBox', false); if (settingsFromPause) pausePanel = ''; };
function openShare(created = false) {
  pausePanel = 'share';
  $('shareCode').textContent = created ? STORY.service.room.replace('{КОД}', session?.roomId ?? '') : session?.roomId ?? '';
  ($('shareLink') as HTMLInputElement).value = location.href;
  visible('nativeShareBtn', !!navigator.share); $('copyBtn').textContent = STORY.service.copy;
  $('closeShareBtn').textContent = created ? STORY.service.next : 'Назад'; visible('shareLabel', !created); visible('shareBox', true);
}
$('share').onclick = () => openShare();
$('nativeShareBtn').onclick = async () => { try { await navigator.share({ title: GAME_TITLE, url: location.href }); } catch { /* отмена */ } };
$('copyBtn').onclick = async () => {
  const input = $('shareLink') as HTMLInputElement;
  let ok = false;
  try { if (navigator.clipboard) { await navigator.clipboard.writeText(input.value); ok = true; } } catch { /* без HTTPS */ }
  if (!ok) { input.focus(); input.setSelectionRange(0, input.value.length); try { ok = document.execCommand('copy'); } catch { /* ручное копирование */ } }
  $('copyBtn').textContent = ok ? STORY.service.copied : STORY.service.copyFailed;
};
$('closeShareBtn').onclick = () => { visible('shareBox', false); pausePanel = ''; createdOpen = false; };

setInterval(() => {
  if (!session || !game) { if (!busy) refreshContinue(); return; }
  visible('testBtn', session.testMode);
  $('topbar').style.zIndex = session.testMode && session.snapshots.at(-1)?.storyScene ? '13' : '';
  $('testBtn').setAttribute('aria-expanded', String(!$('testPanel').classList.contains('hidden')));
  if (!session.testMode) closeTest();
  $('godBtn').textContent = 'Бессмертие: ' + (session.snapshots.at(-1)?.players.get(session.me)?.god ? 'вкл' : 'выкл');
  visible('pauseBox', session.isPaused() && !pausePanel && !picking);
  const snap = session.snapshots.at(-1);
  const char = snap?.players.get(snap.pausedBy)?.char;
  $('pauseNote').textContent = STORY.service.pause.replace('{герой}', CHARACTERS.find(c => c.id === char)?.name ?? '');
  visible('lostBox', session.connectionLost);
  if (session.snapshots.length && !session.hasMe() && !picking && !createdOpen) showPicker();
  renderPicker(); syncStoryView(session);
  if (DEBUG) {
    const last = session.snapshots.at(-1);
    const r = game.canvas.getBoundingClientRect(), vv = window.visualViewport, me = last?.players.get(session.me);
    $('debug').textContent = `${session.kind} #${session.roomId} · ${session.status}\nfps ${Math.round(game.loop.actualFps)} · ping ${session.ping()} мс\ntick ${last?.tick ?? '-'} · звук ${audioState()}`
      + `\nwin ${innerWidth}x${innerHeight} vv ${Math.round(vv?.width ?? 0)}x${Math.round(vv?.height ?? 0)}@${Math.round(vv?.offsetLeft ?? 0)},${Math.round(vv?.offsetTop ?? 0)} s${vv?.scale?.toFixed(2)}`
      + `\ncanvas ${Math.round(r.width)}x${Math.round(r.height)}@${Math.round(r.left)},${Math.round(r.top)} game ${game.scale.width}x${game.scale.height}`
      + `\ntouch ${debugTouch} · ptr ${game.input.activePointer.x | 0},${game.input.activePointer.y | 0} down ${game.input.activePointer.isDown}`
      + `\nme x${(me?.x ?? 0) | 0} ${me?.anim ?? '-'} away ${me?.away} paused ${session.isPaused()} story ${last?.storyScene || '-'}`;
  }
}, 100);
