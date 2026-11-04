import { CHARACTERS, HERO_ID, NADYA_ID, KRIS_ID } from '@bc/shared';
import { STORY_CONTENT, storyScene, type StoryStep } from '@bc/shared';
import type { GameSession } from './session.ts';
export const GAME_TITLE = 'Moroz Birthday Adventures';
// Тексты завязки и поздравления редактируются отдельно от экранов.
export const STORY = {
  "menu": {
    "solo": "Играть соло",
    "online": "Создать комнату"
  },
  "intro": {
    "title": STORY_CONTENT['intro.title'],
    "body": STORY_CONTENT['intro.body'],
    "foot": STORY_CONTENT['intro.foot'],
    "button": STORY_CONTENT['intro.button'],
    "go": [
      "08:40. Подъезд 3.",
      "Настя: резидентство аннулировано. Злая.",
      "Надя: накрашена. Готова бить.",
      "Kris: камера заряжена. Снимает всё.",
      "Рамиль: докуривает. Говорит, сейчас.",
      "План: дойти до МФЦ. Вернуть Насте права."
    ],
    "goButton": "ПОГНАЛИ"
  },
  "pushes": [STORY_CONTENT['push.1'], STORY_CONTENT['push.2'], STORY_CONTENT['push.3'], STORY_CONTENT['push.4'], STORY_CONTENT['push.5'], STORY_CONTENT['push.6']],
  "tips": {
    "move": "ИДИ",
    "keys": "СТРЕЛКИ",
    "hit": "БЕЙ. ЖМИ ПОДРЯД",
    "ult": "УЛЬТА ГОТОВА",
    "smoke": "ДЕРЖИ: ЗАРЯД"
  },
  "service": {
    "forward": "ВПЕРЁД →",
    "fight": "БОЙ {n}/{total}",
    "restart": "Команда упала. Повтор боя {n}/{total}. Пройденное сохранено",
    "me": "ТЫ",
    "pause": "Пауза у всех. Инициатор: {герой}",
    "exitOnline": "Выйти из комнаты? Друзья продолжат без тебя",
    "exitLocal": "Выйти в меню? Прохождение не сохранится",
    "exit": "Выйти",
    "stay": "Остаться",
    "joinMissing": "Комната не найдена. Проверь код",
    "joinFull": "В комнате уже 4 игрока",
    "joinNetwork": "Нет связи с сервером",
    "joinOther": "Не удалось подключиться. Попробуй ещё раз",
    "room": "Комната {КОД}. Отправь ссылку друзьям",
    "copy": "Копировать ссылку",
    "copied": "Ссылка скопирована",
    "copyFailed": "Не вышло. Выдели ссылку и скопируй",
    "next": "Дальше",
    "invite": "Позвать друзей",
    "halt": "ТОРМОЗИМ…",
    "station": "МАЯКОВСКАЯ\nВЫХОДИ →"
  },
  "finale": {
    "restored": STORY_CONTENT['fin.stamp'],
    "status": STORY_CONTENT['fin.status'],
    "title": STORY_CONTENT['fin.title'],
    "body": STORY_CONTENT['fin.body'],
    "sign": STORY_CONTENT['fin.sign'],
    "button": STORY_CONTENT['fin.btn']
  }
};
const TYPE_MS = 30;
const wait = (ms: number) => new Promise<void>(r => window.setTimeout(r, ms));
export let krisFrame = '';
export function saveKrisFrame(image: HTMLImageElement | Phaser.Display.Color) { if (image instanceof HTMLImageElement) krisFrame = image.src; }
export const portrait = (id: string) => id === HERO_ID ? 'ui/portrait-prime.png' : id === NADYA_ID ? 'ui/nadya/portrait.png' : id === KRIS_ID ? 'ui/kris/portrait.png' : 'ui/ramil/portrait.png';
const storyPortrait: Record<string, string> = { 'Милонов': 'ui/story/milonov-pl.png', 'Катя': 'ui/story/katya-pl.png', 'Шаман': 'ui/story/shaman.png', 'Пиздулина': 'ui/story/pizdulina.png' };
let introShowing = false, finaleShowing = false;
function overlay() {
  const root = document.createElement('div');
  root.className = 'overlay story-overlay';
  const card = document.createElement('div');
  card.className = 'story-card';
  root.append(card); document.body.append(root);
  return { root, card };
}
function text(parent: HTMLElement, tag: string, value: string) {
  const el = document.createElement(tag); el.textContent = value; parent.append(el); return el;
}
function button(parent: HTMLElement, label: string) {
  return new Promise<void>(resolve => {
    const b = document.createElement('button'); b.textContent = label;
    b.style.position = 'relative';
    parent.append(b); b.onclick = () => resolve();
  });
}
async function type(parent: HTMLElement, value: string, tap: HTMLElement) {
  const el = text(parent, 'p', ''); let fast = false;
  const scroll = () => { el.scrollIntoView({ block: 'nearest' }); };
  const speedUp = () => { fast = true; }; tap.addEventListener('pointerdown', speedUp);
  for (let i = 1; i <= value.length; i++) { el.textContent = value.slice(0, i); scroll(); if (!fast) await wait(TYPE_MS); }
  tap.removeEventListener('pointerdown', speedUp);
}
export async function showIntro(done: () => void) {
  if (introShowing) return; introShowing = true;
  const { root, card } = overlay();
  root.style.background = '#100d18';
  card.classList.add('notification');
  text(card, 'h2', STORY.intro.title); text(card, 'p', STORY.intro.body);
  text(card, 'small', STORY.intro.foot);
  await button(card, STORY.intro.button);
  card.replaceChildren(); card.classList.remove('notification');
  for (const line of STORY.intro.go) await type(card, line, root);
  await button(card, STORY.intro.goButton); done(); root.remove(); introShowing = false;
}
export async function showFinale(replay: () => void = () => location.replace(location.pathname)) {
  if (finaleShowing) return; finaleShowing = true;
  await wait(1500);
  const { root, card } = overlay(); root.style.opacity = '0'; root.style.transition = 'opacity 600ms';
  requestAnimationFrame(() => { root.style.opacity = '1'; }); await wait(600);
  card.classList.add('final-page');
  const stamp = text(card, 'div', STORY.finale.restored); stamp.className = 'story-stamp';
  card.animate([{ translate: '-3px' }, { translate: '3px' }, { translate: '0' }], { duration: 220 });
  text(card, 'p', STORY.finale.status);
  text(card, 'h1', STORY.finale.title);
  for (let i = 0; i < 70; i++) {
    const piece = document.createElement('i');
    piece.style.cssText = `position:absolute;pointer-events:none;left:${(i * 37) % 100}%;top:-12px;width:7px;height:12px;background:${['var(--lav)', 'var(--pink)', 'var(--gold)'][i % 3]}`;
    root.prepend(piece);
    piece.animate([{ transform: 'translateY(-20px) rotate(0)' }, { transform: `translateY(110vh) rotate(${360 + i * 13}deg)` }], { duration: 2500 + i * 31, delay: i * 30, iterations: Infinity });
  }
  text(card, 'p', STORY.finale.body);
  text(card, 'p', STORY.finale.sign);
  await button(card, STORY.finale.button); replay();
}

let activeStoryKey = '';
let activeStoryRoot: HTMLElement | undefined;
let revealStory: (() => void) | undefined;

// Один DOM-интерфейс для телефона, реплик, карточек и композиций.
export function syncStoryView(session: GameSession) {
  const snap = session.snapshots.at(-1);
  const key = snap?.storyScene ? `${snap.storyScene}:${snap.storyIndex}` : '';
  const viewKey = key ? `${key}:${snap?.storyHost}` : '';
  if (viewKey === activeStoryKey) return;
  activeStoryRoot?.remove(); activeStoryRoot = undefined; revealStory = undefined; activeStoryKey = viewKey;
  if (!key || !snap) return;
  const step = storyScene(snap.storyScene)?.steps[snap.storyIndex];
  if (!step || step.kind === 'state') return;
  session.resetControls();
  const { root, card } = overlay(); activeStoryRoot = root;
  root.style.background = 'rgba(9, 10, 22, .91)';
  const phoneId = step.kind === 'phone' ? step.ids[0] : '';
  const terminal = phoneId.startsWith('hck.');
  card.classList.toggle('notification', step.kind === 'phone' && !terminal);
  card.classList.toggle('story-terminal', terminal);
  const speaker = step.kind === 'line' ? CHARACTERS.find(c => c.id === step.speaker) : undefined;
  if (step.kind === 'line') {
    const row = document.createElement('div'); row.className = 'dialogue-row'; card.append(row);
    const picture = speaker ? portrait(speaker.id) : storyPortrait[step.speaker];
    if (picture) { const img = document.createElement('img'); img.src = picture; img.alt = speaker?.name ?? step.speaker; row.append(img); }
    text(row, 'strong', speaker?.name ?? step.speaker);
  }
  if (step.kind === 'phone') {
    const heading = phoneId.startsWith('cty.') ? 'ПРЯМОЙ ЭФИР · LIVE'
      : phoneId.startsWith('hck.') ? 'БАЗА · ТЕРМИНАЛ'
      : phoneId.startsWith('res.') ? 'БАЗА · АККАУНТ МИЛОНОВА'
      : phoneId.startsWith('prf.') ? 'РЕЕСТР ОБРАЩЕНИЙ'
      : phoneId.startsWith('kat.') ? 'ТЕЛЕФОН КАТИ'
      : 'ГОСУСЛУГИ · УВЕДОМЛЕНИЕ';
    text(card, 'small', heading);
  }
  if (step.kind === 'composition') {
    if (krisFrame) { const frame = document.createElement('img'); frame.src = krisFrame; frame.alt = 'Кадр Kris'; frame.className = 'story-frame'; card.append(frame); }
    else for (const file of step.images) { const img = document.createElement('img'); img.src = file; img.alt = ''; img.className = 'story-portrait'; card.append(img); }
  }
  const lines = step.kind === 'phone' ? step.ids.map(id => STORY_CONTENT[id]) : [STORY_CONTENT[step.id]];
  const value = lines.join('\n\n');
  const body = text(card, step.kind === 'card' ? 'h2' : 'p', '');
  body.style.whiteSpace = 'pre-wrap';
  const hint = text(card, 'small', snap.storyHost === session.me ? 'Нажми, чтобы продолжить' : 'Продолжает ведущий');
  let count = 0; let touched = false;
  const timer = window.setInterval(() => {
    if (activeStoryKey !== viewKey) { clearInterval(timer); return; }
    count = Math.min(value.length, count + 2); body.textContent = value.slice(0, count);
    if (count === value.length) clearInterval(timer);
  }, TYPE_MS);
  revealStory = () => { count = value.length; body.textContent = value; clearInterval(timer); };
  root.addEventListener('pointerdown', () => {
    if (!touched) { touched = true; revealStory?.(); return; }
    if (snap.storyHost === session.me) { hint.textContent = 'Продолжаем…'; session.advanceStory(key); }
  });
}
