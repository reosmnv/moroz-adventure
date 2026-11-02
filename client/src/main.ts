import { CHARACTERS, HERO_ID, KRIS_ID, NADYA_ID, LEVELS, TEST_TOOLS } from '@bc/shared';
import { LocalSession, OnlineSession, clearReconnect, returnToMenu, savedReconnect, type GameSession } from './session.ts';
import { GAME_TITLE, showIntro } from './story.ts';
import { startGame } from './scene.ts';
import { audioState, unlockAudio } from './audio.ts';
import { settings, updateSettings } from './settings.ts';

const $ = (id: string) => document.getElementById(id)!;
const visible = (id: string, on: boolean) => $(id).classList.toggle('hidden', !on);
const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? `${location.protocol}//${location.hostname}:2567`;
const params = new URLSearchParams(location.search);
const roomCode = location.hash.slice(1).toUpperCase() || undefined;
const DEBUG = params.has('debug');
const MENU_SCREENS = ['menuHome', 'newScreen', 'joinScreen', 'testScreen'];
const portrait = (id: string) => id === HERO_ID ? 'ui/portrait-prime.png' : id === NADYA_ID ? 'ui/nadya/portrait.png' : id === KRIS_ID ? 'ui/kris/portrait.png' : 'ui/ramil/portrait.png';
let session: GameSession | null = null;
let game: ReturnType<typeof startGame> | null = null;
let introSeen = false;
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
$('gameTitle').textContent = GAME_TITLE;
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
renderTest();
if (TEST_TOOLS && params.has('stage') && Number.isInteger(selectedStage) && selectedStage >= 0 && selectedStage < LEVELS.route.stages.length) menuScreen('testScreen');

function maybeIntro() {
  if (!introSeen && session?.hasMe() && session.needsIntro()) {
    const current = session; introSeen = true; current.introOpen = true;
    void showIntro(() => { current.introOpen = false; current.finishIntro(); });
  }
}
async function begin(online: boolean, code?: string, stage = 0, testMode = false, resume = false) {
  if (busy) return;
  busy = true; $('menuNote').textContent = online ? 'Подключаюсь…' : 'Загружаю…';
  unlockAudio();
  try {
    if (!resume) clearReconnect();
    introSeen = false;
    session = online ? await OnlineSession.open(SERVER_URL, code, 'route', stage, testMode, resume) : new LocalSession('route', stage, testMode);
    session.onPickError = message => { pendingHero = ''; $('pickNote').textContent = message; };
    if (session.roomId) history.replaceState(null, '', location.pathname + '#' + session.roomId);
    else history.replaceState(null, '', location.pathname);
    visible('share', online);
    await Promise.race([document.fonts.load('12px "Press Start 2P"').catch(() => {}), new Promise(r => setTimeout(r, 2000))]);
    game = startGame('game', session);
    visible('menu', false); visible('topbar', true);
  } catch (e: unknown) {
    $('menuNote').textContent = 'Не удалось: ' + (e instanceof Error ? e.message : String(e));
    refreshContinue();
  } finally { busy = false; }
}

function closeTest() { visible('testPanel', false); $('testBtn').setAttribute('aria-expanded', 'false'); }
$('testBtn').onclick = () => {
  const open = $('testPanel').classList.contains('hidden'); visible('testPanel', open); $('testBtn').setAttribute('aria-expanded', String(open));
};
$('nextBtn').onclick = () => session?.next();
$('spawnBtn').onclick = () => session?.spawn();
$('chargeBtn').onclick = () => session?.charge();
$('healBtn').onclick = () => session?.heal();
$('killBtn').onclick = () => session?.killAll();
$('godBtn').onclick = () => session?.god(!session.snapshots.at(-1)?.players.get(session.me)?.god);
$('pauseBtn').onclick = () => { closeTest(); session?.setPaused(true); };
$('resumeBtn').onclick = () => { unlockAudio(); session?.setPaused(false); };
$('exitBtn').onclick = () => { pausePanel = 'exit'; visible('exitBox', true); };
$('exitNo').onclick = () => { pausePanel = ''; visible('exitBox', false); };
$('exitYes').onclick = $('lostMenu').onclick = () => { if (session) returnToMenu(session); };
$('reconnectBtn').onclick = async () => {
  if (!session) return;
  const b = $('reconnectBtn') as HTMLButtonElement; b.disabled = true;
  $('lostNote').textContent = 'Переподключаюсь…';
  try { await session.reconnect(); } finally { b.disabled = false; $('lostNote').textContent = session.connectionLost ? 'Не удалось вернуться в комнату' : ''; }
};

function showPicker(change = false) {
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
  if ((!changingHero && current) || (pendingHero && current === pendingHero)) { hidePicker(); maybeIntro(); return; }
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
$('share').onclick = () => {
  pausePanel = 'share';
  $('shareCode').textContent = session?.roomId ?? '';
  ($('shareLink') as HTMLInputElement).value = location.href;
  visible('nativeShareBtn', !!navigator.share); $('copyBtn').textContent = 'Скопировать'; visible('shareBox', true);
};
$('nativeShareBtn').onclick = async () => { try { await navigator.share({ title: GAME_TITLE, url: location.href }); } catch { /* отмена */ } };
$('copyBtn').onclick = async () => {
  const input = $('shareLink') as HTMLInputElement;
  let ok = false;
  try { if (navigator.clipboard) { await navigator.clipboard.writeText(input.value); ok = true; } } catch { /* без HTTPS */ }
  if (!ok) { input.focus(); input.setSelectionRange(0, input.value.length); ok = document.execCommand('copy'); input.blur(); }
  $('copyBtn').textContent = ok ? 'Скопировано' : 'Выдели и скопируй вручную';
};
$('closeShareBtn').onclick = () => { visible('shareBox', false); pausePanel = ''; };

setInterval(() => {
  if (!session || !game) { if (!busy) refreshContinue(); return; }
  visible('testBtn', session.testMode);
  $('testBtn').setAttribute('aria-expanded', String(!$('testPanel').classList.contains('hidden')));
  if (!session.testMode) closeTest();
  $('godBtn').textContent = 'Бессмертие: ' + (session.snapshots.at(-1)?.players.get(session.me)?.god ? 'вкл' : 'выкл');
  visible('pauseBox', session.isPaused() && !pausePanel && !picking);
  $('pauseNote').textContent = session.kind === 'online' && !session.pausedByMe() ? 'Паузу поставил друг' : '';
  visible('lostBox', session.connectionLost);
  if (session.snapshots.length && !session.hasMe() && !picking) showPicker();
  renderPicker(); maybeIntro();
  if (DEBUG) {
    const last = session.snapshots.at(-1);
    $('debug').textContent = `${session.kind} #${session.roomId} · ${session.status}\nfps ${Math.round(game.loop.actualFps)} · ping ${session.ping()} мс\ntick ${last?.tick ?? '-'} · звук ${audioState()}`;
  }
}, 100);
