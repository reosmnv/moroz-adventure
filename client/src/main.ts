import { CHARACTERS, HERO_ID, TEST_TOOLS } from '@bc/shared';
import { LocalSession, OnlineSession, type GameSession } from './session.ts';
import { startGame } from './scene.ts';
import { audioState, unlockAudio } from './audio.ts';

const $ = (id: string) => document.getElementById(id)!;

// Ошибки на экран: на iPhone консоли нет
const showErr = (msg: string) => { const e = $('err'); e.classList.remove('hidden'); e.textContent += msg + '\n'; };
window.addEventListener('error', e => showErr(String(e.message)));
window.addEventListener('unhandledrejection', e => showErr(String((e as PromiseRejectionEvent).reason?.message ?? (e as PromiseRejectionEvent).reason)));

// Зум двойным тапом и щипком отключаем (как в cat-piano)
document.addEventListener('touchstart', e => { if ((e.target as HTMLElement).tagName === 'CANVAS') e.preventDefault(); }, { passive: false });
document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', e => e.preventDefault());

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? `${location.protocol}//${location.hostname}:2567`;
const roomCode = location.hash.slice(1).toUpperCase() || undefined;

const onlineBox = $('online') as HTMLInputElement;
onlineBox.checked = localStorage.getItem('bc-online') !== '0' || !!roomCode;
const startBtn = $('start') as HTMLButtonElement;
const joinBtn = $('joinBtn') as HTMLButtonElement;
const codeInput = $('codeInput') as HTMLInputElement;
const refreshMenu = () => {
  startBtn.textContent = roomCode && onlineBox.checked ? `Войти в комнату ${roomCode}` : 'Новая игра';
  $('joinRow').classList.toggle('hidden', !onlineBox.checked || !!roomCode);
  $('menuNote').textContent = onlineBox.checked ? `Сервер: ${SERVER_URL}` : 'Офлайн: игра идёт прямо в браузере';
};
onlineBox.onchange = () => { localStorage.setItem('bc-online', onlineBox.checked ? '1' : '0'); refreshMenu(); };
refreshMenu();

let session: GameSession | null = null;
let game: any = null;

startBtn.onclick = () => begin(roomCode);
joinBtn.onclick = () => {
  const code = codeInput.value.trim().toUpperCase();
  if (!/^[A-Z0-9]{5}$/.test(code)) { $('menuNote').textContent = 'Код из 5 символов'; return; }
  begin(code);
};

async function begin(code?: string) {
  unlockAudio();
  startBtn.disabled = joinBtn.disabled = true;
  try {
    if (onlineBox.checked) {
      $('menuNote').textContent = 'Подключаюсь…';
      const s = await OnlineSession.open(SERVER_URL, code);
      s.onPickError = m => { $('pickNote').textContent = m; };
      session = s;
      history.replaceState(null, '', '#' + s.roomId);
      $('share').classList.remove('hidden');
    } else {
      session = new LocalSession();
    }
  } catch (e: any) {
    $('menuNote').textContent = 'Не удалось: ' + (e?.message ?? e);
    startBtn.disabled = joinBtn.disabled = false;
    return;
  }
  $('menu').classList.add('hidden');
  $('topbar').classList.remove('hidden');
  $('spawnBtn').classList.toggle('hidden', !TEST_TOOLS);
  // Пиксельный шрифт нужен canvas до первого кадра, иначе Phaser нарисует текст системным
  await Promise.race([document.fonts.load('8px "Press Start 2P"').catch(() => {}), new Promise(r => setTimeout(r, 2000))]);
  game = startGame('game', session);
  // Уже в мире (вернулись по токену) — выбор персонажа не нужен
  setTimeout(() => { if (!session!.hasMe()) showPicker(); }, 300);
}

// Тестовая кнопка: три настоящих врага
$('spawnBtn').onclick = () => session?.spawn();

// Пауза: офлайн останавливает браузерную симуляцию, онлайн ставит на паузу всю комнату
$('pauseBtn').onclick = () => session?.setPaused(true);
$('resumeBtn').onclick = () => { unlockAudio(); session?.setPaused(false); };
setInterval(() => {
  if (!session) return;
  const paused = session.isPaused();
  $('pauseBox').classList.toggle('hidden', !paused || !$('shareBox').classList.contains('hidden'));
  $('pauseNote').textContent = session.kind === 'online' && !session.pausedByMe() ? 'Паузу поставил друг' : '';
}, 200);

// «Позвать друга». Без HTTPS (разработка через tailnet) Safari не даёт ни share, ни буфер обмена,
// поэтому всегда показываем код и ссылку, а системные кнопки включаем, только если они есть
let pausedForShare = false;
$('share').onclick = () => {
  const url = location.href;
  $('shareCode').textContent = session?.roomId ?? '';
  ($('shareLink') as HTMLInputElement).value = url;
  $('nativeShareBtn').classList.toggle('hidden', !navigator.share);
  $('copyBtn').textContent = 'Скопировать';
  // Пока хост зовёт друга, мир стоит
  if (session && !session.isPaused()) { session.setPaused(true); pausedForShare = true; }
  $('shareBox').classList.remove('hidden');
};
$('nativeShareBtn').onclick = async () => {
  try { await navigator.share({ title: 'Залетай в игру', url: location.href }); } catch { /* отмена */ }
};
$('copyBtn').onclick = async () => {
  const input = $('shareLink') as HTMLInputElement;
  let ok = false;
  try { if (navigator.clipboard) { await navigator.clipboard.writeText(input.value); ok = true; } } catch { /* нет доступа */ }
  if (!ok) {
    // Старый способ, работает и без HTTPS
    input.focus();
    input.setSelectionRange(0, input.value.length);
    ok = document.execCommand('copy');
    input.blur();
  }
  $('copyBtn').textContent = ok ? 'Скопировано' : 'Выдели и скопируй вручную';
};
$('closeShareBtn').onclick = () => {
  $('shareBox').classList.add('hidden');
  if (pausedForShare) { session?.setPaused(false); pausedForShare = false; }
};

function showPicker() {
  const box = $('chars');
  $('picker').classList.remove('hidden');
  const render = () => {
    if (session!.hasMe()) { $('picker').classList.add('hidden'); clearInterval(timer); return; }
    const taken = session!.taken();
    box.innerHTML = '';
    for (const c of CHARACTERS) {
      const b = document.createElement('button');
      b.textContent = c.name;
      b.style.background = '#' + c.color.toString(16).padStart(6, '0');
      if (c.id === HERO_ID) {
        // Портрет героини над именем, пиксели без сглаживания
        const img = document.createElement('img');
        img.src = 'ui/portrait-prime.png';
        img.style.cssText = 'display:block;width:128px;height:128px;margin:0 auto 8px;image-rendering:pixelated';
        b.prepend(img);
        b.style.background = 'var(--plum, #5a495d)';
      }
      b.disabled = taken.includes(c.id);
      b.onclick = () => { unlockAudio(); session!.pick(c.id); };
      box.appendChild(b);
    }
  };
  const timer = setInterval(render, 300);
  render();
}

// Отладочный оверлей: fps, ping, касания, состояние. Только с ?debug=1, иначе наезжает на HUD
const DEBUG = new URLSearchParams(location.search).has('debug');
setInterval(() => {
  if (!session || !DEBUG) return;
  const g = game;
  const pointers = g?.input?.pointers?.filter((p: any) => p.isDown).length ?? 0;
  const last = session.snapshots[session.snapshots.length - 1];
  $('debug').textContent = [
    `${session.kind} ${session.roomId ? '#' + session.roomId : ''} · ${session.status}`,
    `fps ${Math.round(g?.loop?.actualFps ?? 0)} · ping ${session.ping()} мс · касаний ${pointers}`,
    `tick ${last?.tick ?? '-'} · игроков ${last?.players.size ?? 0} · врагов ${last?.enemies.size ?? 0} · звук ${audioState()}`,
  ].join('\n');
}, 250);
