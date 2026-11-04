import { CHARACTERS, HERO_ID, NADYA_ID, KRIS_ID } from '@bc/shared';
import { STORY_CONTENT, storyScene, type StoryStep } from '@bc/shared';
import type { Snapshot, GameSession } from './session.ts';
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
let comicPanel: { card: HTMLElement; at: string; wide: boolean } | undefined;
let dialogue: { name: string; speaker: string; at: string; value: string; count: number; hint: string } | undefined;

// Один DOM-интерфейс для телефона, реплик, карточек и композиций.
export function syncStoryView(session: GameSession) {
  const snap = session.snapshots.at(-1);
  const key = snap?.storyScene ? `${snap.storyScene}:${snap.storyIndex}` : '';
  const viewKey = key ? `${key}:${snap?.storyHost}` : '';
  if (viewKey === activeStoryKey) return;
  activeStoryRoot?.remove(); activeStoryRoot = undefined; revealStory = undefined; dialogue = undefined; comicPanel = undefined; activeStoryKey = viewKey;
  if (!key || !snap) return;
  const step = storyScene(snap.storyScene)?.steps[snap.storyIndex];
  if (!step || step.kind === 'state' || step.kind === 'act') return;
  session.resetControls();
  const { root, card } = overlay(); activeStoryRoot = root;
  if (step.kind === 'line') {
    root.classList.add('story-dialogue-input'); root.style.background = 'transparent'; card.remove();
    const speaker = CHARACTERS.find(c => c.id === step.speaker);
    const host = CHARACTERS.find(c => c.id === snap.players.get(snap.storyHost)?.char)?.name ?? '';
    const model = dialogue = { name: speaker?.name ?? step.speaker, speaker: step.speaker,
      at: step.at ?? step.speaker, value: STORY_CONTENT[step.id], count: 0,
      hint: snap.storyHost === session.me ? 'Нажми, чтобы продолжить' : `Продолжает ${host}` };
    const timer = window.setInterval(() => {
      if (activeStoryKey !== viewKey) { clearInterval(timer); return; }
      model.count = Math.min(model.value.length, model.count + 2);
      if (model.count === model.value.length) clearInterval(timer);
    }, TYPE_MS);
    let revealed = false;
    root.addEventListener('pointerdown', event => {
      event.preventDefault(); event.stopPropagation();
      if (!revealed) { revealed = true; model.count = model.value.length; clearInterval(timer); return; }
      if (snap.storyHost === session.me) session.advanceStory(key);
    });
    return;
  }
  root.style.background = 'rgba(9, 10, 22, .91)';
  const phoneId = step.kind === 'phone' ? step.ids[0] : '';
  const terminal = phoneId.startsWith('hck.');
  card.classList.toggle('notification', step.kind === 'phone' && !terminal);
  card.classList.toggle('story-terminal', terminal);
  if (step.kind === 'phone') {
    root.style.background = 'transparent'; root.classList.add('story-comic-input');
    card.classList.add('comic-phone');
    comicPanel = { card, at: step.at ?? 'anastasia', wide: phoneId === 'intro.title' };
    const heading = phoneId.startsWith('cty.') ? 'ПРЯМОЙ ЭФИР · LIVE'
      : phoneId.startsWith('hck.') ? 'БАЗА · ТЕРМИНАЛ'
      : phoneId.startsWith('res.') ? 'БАЗА · АККАУНТ МИЛОНОВА'
      : phoneId.startsWith('prf.') ? 'РЕЕСТР ОБРАЩЕНИЙ'
      : phoneId.startsWith('kat.') ? 'ТЕЛЕФОН КАТИ'
      : 'ГОСУСЛУГИ · УВЕДОМЛЕНИЕ';
    text(card, 'small', heading);
  }
  if (step.kind === 'composition') {
    root.style.background = 'transparent'; card.classList.add('comic-polaroid');
    if (krisFrame) { const frame = document.createElement('img'); frame.src = krisFrame; frame.alt = 'Кадр Kris'; frame.className = 'story-frame'; card.append(frame); }
    else for (const file of step.images) { const img = document.createElement('img'); img.src = file; img.alt = ''; img.className = 'story-portrait'; card.append(img); }
  }
  const lines = step.kind === 'phone' ? step.ids.map(id => STORY_CONTENT[id]) : [STORY_CONTENT[step.id]];
  const value = lines.join(step.kind === 'phone' ? '\n' : '\n\n');
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

interface ComicBubble {
  box: Phaser.GameObjects.Container; frame: Phaser.GameObjects.Graphics;
  name: Phaser.GameObjects.Text; body: Phaser.GameObjects.Text; hint: Phaser.GameObjects.Text;
  picture: Phaser.GameObjects.Image;
}
const comicBubbles = new WeakMap<Phaser.Scene, ComicBubble>();
const COMIC_FONT = '"Press Start 2P", monospace';
const COMIC_WIDTH = 170;

// UI-сцена не зависит от камеры боя; координаты головы переводятся в экранные.
export function drawStoryBubble(game: Phaser.Scene, ui: Phaser.Scene, snap: Snapshot) {
  if (comicPanel) {
    const { card, at, wide } = comicPanel;
    const target = snap.actors.get(at) ?? [...snap.players.values()].find(p => p.char === at);
    const rect = game.game.canvas.getBoundingClientRect();
    const cam = game.cameras.main, ratio = rect.width / game.scale.width;
    const anchor = target ? rect.left + (cam.width / 2 + (target.x - cam.midPoint.x) * cam.zoom) * ratio : rect.left + rect.width / 2;
    const width = Math.min(wide ? 340 : 230, rect.width * 0.51), height = rect.height * 0.4;
    const right = anchor + 24, left = anchor - width - 24;
    const x = right + width < rect.right - 8 ? right : left >= rect.left + 8 ? left : rect.left + (rect.width - width) / 2;
    card.style.width = `${width}px`; card.style.height = `${height}px`;
    card.style.left = `${Math.max(8, Math.min(innerWidth - width - 8, x))}px`;
    card.style.top = `${Math.max(8, rect.top + rect.height * 0.19)}px`;
  }
  let bubble = comicBubbles.get(ui);
  if (!dialogue) { bubble?.box.setVisible(false); return; }
  if (!bubble?.box.scene) {
    const style = { fontFamily: COMIC_FONT, fontSize: '8px', color: '#121212', wordWrap: { width: COMIC_WIDTH - 16 }, lineSpacing: 3 };
    const frame = ui.add.graphics();
    const name = ui.add.text(8, 7, '', style);
    const body = ui.add.text(8, 23, '', style);
    const hint = ui.add.text(0, 0, '', { ...style, fontSize: '6px', color: '#ffffff', backgroundColor: '#121212', padding: { x: 3, y: 3 }, wordWrap: { width: COMIC_WIDTH - 6 } });
    const picture = ui.add.image(0, 0, 'story-portrait/anastasia').setDisplaySize(30, 30).setOrigin(0, 1);
    const box = ui.add.container(0, 0, [frame, name, body, hint, picture]).setDepth(5000).setScrollFactor(0);
    bubble = { box, frame, name, body, hint, picture }; comicBubbles.set(ui, bubble);
  }
  const model = dialogue;
  bubble.box.setVisible(true);
  bubble.name.setText(model.name); bubble.body.setText(model.value);
  const height = 31 + bubble.body.height;
  bubble.body.setText(model.value.slice(0, model.count));
  const player = [...snap.players.values()].find(p => p.char === model.at);
  const target = snap.actors.get(model.at) ?? player ?? snap.enemies.get(model.at);
  const cam = game.cameras.main, width = ui.scale.width;
  const targetX = target ? cam.width / 2 + (target.x - cam.midPoint.x) * cam.zoom : 0;
  const targetY = target ? cam.height / 2 + (target.y - 90 - cam.midPoint.y) * cam.zoom : 0;
  const onScreen = !!target && targetX >= 0 && targetX <= width;
  const x = Math.max(6, Math.min(width - COMIC_WIDTH - 6, onScreen ? targetX - COMIC_WIDTH / 2 : 8));
  const y = Math.max(6, Math.min(220 - height, onScreen ? targetY - height - 12 : 44));
  const color = CHARACTERS.some(c => c.id === model.speaker) ? 0x111111 : 0xb82030;
  const frame = bubble.frame; frame.clear(); frame.fillStyle(0xffffff); frame.lineStyle(2, color);
  frame.fillRoundedRect(0, 0, COMIC_WIDTH, height, 6); frame.strokeRoundedRect(0, 0, COMIC_WIDTH, height, 6);
  if (onScreen) {
    const tip = Math.max(12, Math.min(COMIC_WIDTH - 12, targetX - x));
    frame.fillTriangle(tip - 7, height - 1, tip + 7, height - 1, tip, height + 11);
    frame.lineBetween(tip - 7, height, tip, height + 11); frame.lineBetween(tip, height + 11, tip + 7, height);
  }
  bubble.hint.setText(model.hint).setPosition(0, height + 16);
  bubble.picture.setVisible(!onScreen && CHARACTERS.some(c => c.id === model.speaker));
  if (bubble.picture.visible) bubble.picture.setTexture('story-portrait/' + model.speaker).setDisplaySize(30, 30).setPosition(COMIC_WIDTH - 30, -3);
  bubble.box.setPosition(x, y);
}
