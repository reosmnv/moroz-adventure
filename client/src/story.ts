import { play, playMusic } from './audio.ts';
import { CHARACTERS, HERO_ID, NADYA_ID, KRIS_ID } from '@bc/shared';
import { STORY_CONTENT, storyScene } from '@bc/shared';
import type { Snapshot, GameSession } from './session.ts';
export const GAME_TITLE = 'Moroz Birthday Adventures';
// Тексты завязки и поздравления редактируются отдельно от экранов.
export const STORY = {
  "menu": {
    "solo": "Играть соло",
    "online": "Создать комнату"
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
let finaleShowing = false;
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
export async function showFinale(replay: () => void = () => location.replace(location.pathname)) {
  if (finaleShowing) return; finaleShowing = true;
  playMusic('music_finale');
  await wait(1500);
  const { root, card } = overlay(); root.style.opacity = '0'; root.style.transition = 'opacity 600ms';
  requestAnimationFrame(() => { root.style.opacity = '1'; }); await wait(600);
  card.classList.add('final-page'); play('story_stamp'); play('story_confetti');
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
let comicPanel: { card: HTMLElement; at: string; wide: boolean; layout?: { width: number; height: number; left: number; top: number } } | undefined;
let dialogue: { name: string; speaker: string; at: string; value: string; count: number; hint: string } | undefined;

// Один DOM-интерфейс для телефона, реплик, карточек и композиций.
export function syncStoryView(session: GameSession) {
  const snap = session.snapshots.at(-1);
  const key = snap?.storyScene && session.hasMe() ? `${snap.storyScene}:${snap.storyIndex}` : '';
  const viewKey = key ? `${key}:${snap?.storyHost}` : '';
  if (viewKey === activeStoryKey) return;
  if (activeStoryRoot?.dataset.soundCard === 'true') play('story_card_out');
  if (activeStoryRoot?.classList.contains('story-caption')) {
    const old = activeStoryRoot; old.style.opacity = '0'; window.setTimeout(() => old.remove(), 250);
  } else activeStoryRoot?.remove(); activeStoryRoot = undefined; revealStory = undefined; dialogue = undefined; comicPanel = undefined; activeStoryKey = viewKey;
  if (!key || !snap) return;
  const step = storyScene(snap.storyScene)?.steps[snap.storyIndex];
  if (!step || step.kind === 'state' || step.kind === 'act') return;
  session.resetControls();
  const { root, card } = overlay(); activeStoryRoot = root;
  play(({ line: 'story_line', caption: 'story_caption', phone: 'story_phone', card: 'story_card_in', composition: 'story_composition' } as const)[step.kind]);
  if (step.kind === 'card') root.dataset.soundCard = 'true';
  if (step.kind === 'phone' && step.ids.some(id => id.startsWith('push.') || id === 'intro.body')) play('story_push');
  if (step.kind === 'phone' && step.ids.includes('kat.withdraw')) play('story_stamp');
  if (step.kind === 'caption') {
    root.classList.add('story-caption'); card.remove();
    root.style.cssText = 'background:transparent;pointer-events:none;opacity:0;transition:opacity 250ms;display:flex;flex-direction:row;align-items:flex-end;justify-content:center;padding:0 8% 6vh;box-sizing:border-box';
    const caption = text(root, 'p', STORY_CONTENT[step.id]);
    caption.style.cssText = 'font-family:"Press Start 2P",monospace;font-size:clamp(10px,2vw,16px);color:#f5f5f5;text-shadow:2px 2px 3px #000;text-align:center;line-height:1.7';
    requestAnimationFrame(() => { root.style.opacity = '1'; });
    return;
  }
  if (step.kind === 'line') {
    root.classList.add('story-dialogue-input'); root.style.background = 'transparent'; card.remove();
    const speaker = CHARACTERS.find(c => c.id === step.speaker);
    const host = CHARACTERS.find(c => c.id === snap.players.get(snap.storyHost)?.char)?.name ?? '';
    const model = dialogue = { name: speaker?.name ?? step.speaker, speaker: step.speaker,
      at: step.at ?? step.speaker, value: STORY_CONTENT[step.id], count: 0,
      hint: snap.storyHost === session.me ? '▶' : `ждём ${host}` };
    const timer = window.setInterval(() => {
      if (activeStoryKey !== viewKey) { clearInterval(timer); return; }
      play('story_type');
      model.count = Math.min(model.value.length, model.count + 2);
      if (model.count === model.value.length) clearInterval(timer);
    }, TYPE_MS);
    let revealed = false;
    // click приходит после touchend: Safari успевает освободить Phaser Pointer
    // до того, как офлайн-сцена синхронно заменит этот DOM-overlay.
    root.addEventListener('click', event => {
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
    comicPanel = { card, at: step.at ?? 'anastasia', wide: phoneId === 'intro.body' };
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
    if (krisFrame && step.id !== 'lev.rec') { const frame = document.createElement('img'); frame.src = krisFrame; frame.alt = 'Кадр Kris'; frame.className = 'story-frame'; card.append(frame); }
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
    play('story_type');
    count = Math.min(value.length, count + 2); body.textContent = value.slice(0, count);
    if (count === value.length) clearInterval(timer);
  }, TYPE_MS);
  revealStory = () => { count = value.length; body.textContent = value; clearInterval(timer); };
  // Не удаляем overlay на pointerdown: иначе Safari может потерять touchend,
  // а Phaser оставит один из ограниченных touch Pointer активным.
  root.addEventListener('click', () => {
    if (!touched) { touched = true; revealStory?.(); return; }
    if (snap.storyHost === session.me) { hint.textContent = 'Продолжаем…'; session.advanceStory(key); }
  });
}

interface ComicBubble {
  box: Phaser.GameObjects.Container; frame: Phaser.GameObjects.Graphics;
  name: Phaser.GameObjects.Text; body: Phaser.GameObjects.Text; hint: Phaser.GameObjects.Text;
  picture: Phaser.GameObjects.Image;
  line?: NonNullable<typeof dialogue>; width?: number; height: number; count: number;
}
const comicBubbles = new WeakMap<Phaser.Scene, ComicBubble>();
const canvasLayouts = new WeakMap<Phaser.Scene, { rect?: DOMRect }>();
const COMIC_FONT = '"Press Start 2P", monospace';
const COMIC_WIDTH = 170;
const COMIC_HEAD: Record<string, number> = { katya: 125, pizdulina: 107, shaman: 107 };

function canvasBounds(scene: Phaser.Scene) {
  let layout = canvasLayouts.get(scene);
  if (!layout) {
    const cache: { rect?: DOMRect } = {};
    layout = cache; canvasLayouts.set(scene, cache);
    const invalidate = () => { cache.rect = undefined; };
    const viewport = window.visualViewport;
    window.addEventListener('resize', invalidate);
    window.addEventListener('orientationchange', invalidate);
    viewport?.addEventListener('resize', invalidate);
    scene.scale.on('resize', invalidate);
    const observer = new ResizeObserver(invalidate);
    observer.observe(scene.game.canvas);
    const cleanup = () => {
      scene.events.off('shutdown', cleanup); scene.events.off('destroy', cleanup);
      window.removeEventListener('resize', invalidate);
      window.removeEventListener('orientationchange', invalidate);
      viewport?.removeEventListener('resize', invalidate);
      scene.scale.off('resize', invalidate);
      observer.disconnect(); canvasLayouts.delete(scene);
    };
    scene.events.once('shutdown', cleanup); scene.events.once('destroy', cleanup);
  }
  return layout.rect ??= scene.game.canvas.getBoundingClientRect();
}

// UI-сцена не зависит от камеры боя; координаты головы переводятся в экранные.
export function drawStoryBubble(game: Phaser.Scene, ui: Phaser.Scene, snap: Snapshot) {
  if (comicPanel) {
    const { card, at, wide } = comicPanel;
    const target = snap.actors.get(at) ?? snap.enemies.get(at) ?? [...snap.enemies].find(([id, e]) => id.endsWith('--' + at) && e.hp > 0)?.[1] ?? [...snap.enemies.values()].find(e => e.boss === at) ?? [...snap.players.values()].find(p => p.char === at);
    const rect = canvasBounds(game);
    const cam = game.cameras.main, ratio = rect.width / game.scale.width;
    const anchor = target ? rect.left + (cam.width / 2 + (target.x - cam.midPoint.x) * cam.zoom) * ratio : rect.left + rect.width / 2;
    const width = Math.min(wide ? 340 : 230, rect.width * 0.51), height = rect.height * 0.4;
    const right = anchor + 24, left = anchor - width - 24;
    const x = right + width < rect.right - 8 ? right : left >= rect.left + 8 ? left : rect.left + (rect.width - width) / 2;
    const cardLeft = Math.max(8, Math.min(innerWidth - width - 8, x));
    const cardTop = Math.max(8, rect.top + rect.height * 0.19);
    const previous = comicPanel.layout;
    if (!previous || previous.width !== width) card.style.width = `${width}px`;
    if (!previous || previous.height !== height) card.style.height = `${height}px`;
    if (!previous || previous.left !== cardLeft) card.style.left = `${cardLeft}px`;
    if (!previous || previous.top !== cardTop) card.style.top = `${cardTop}px`;
    if (!previous || previous.width !== width || previous.height !== height || previous.left !== cardLeft || previous.top !== cardTop) {
      comicPanel.layout = { width, height, left: cardLeft, top: cardTop };
    }
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
    bubble = { box, frame, name, body, hint, picture, height: 0, count: -1 }; comicBubbles.set(ui, bubble);
  }
  const model = dialogue;
  bubble.box.setVisible(true);
  if (bubble.line !== model || bubble.width !== ui.scale.width) {
    bubble.name.setText(model.name); bubble.body.setText(model.value);
    bubble.height = 43 + bubble.body.height;
    bubble.line = model; bubble.width = ui.scale.width; bubble.count = -1;
  }
  const height = bubble.height;
  if (bubble.count !== model.count) {
    bubble.body.setText(model.value.slice(0, model.count)); bubble.count = model.count;
  }
  const player = [...snap.players.values()].find(p => p.char === model.at);
  const actor = snap.actors.get(model.at);
  const target = actor ?? player ?? snap.enemies.get(model.at) ?? [...snap.enemies].find(([id, e]) => id.endsWith('--' + model.at) && e.hp > 0)?.[1] ?? [...snap.enemies.values()].find(e => e.boss === model.at);
  const cam = game.cameras.main, width = ui.scale.width;
  const targetX = target ? cam.width / 2 + (target.x - cam.midPoint.x) * cam.zoom : 0;
  const targetY = target ? cam.height / 2 + (target.y - (COMIC_HEAD[actor?.look ?? ''] ?? 90) - cam.midPoint.y) * cam.zoom : 0;
  const onScreen = !!target && targetX >= 0 && targetX <= width;
  let x = Math.max(6, Math.min(width - COMIC_WIDTH - 6, onScreen ? targetX - COMIC_WIDTH / 2 : 8));
  const y = Math.max(50, Math.min(220 - height, onScreen ? targetY - height - 12 : 50));
  // Если над головой тесно, рамка уходит вбок, хвост остаётся у говорящего.
  const side = onScreen && y + height + 8 > targetY;
  if (side) x = Math.max(6, Math.min(width - COMIC_WIDTH - 6,
    targetX + 24 + COMIC_WIDTH <= width - 6 ? targetX + 24 : targetX - COMIC_WIDTH - 24));
  const color = CHARACTERS.some(c => c.id === model.speaker) ? 0x111111 : 0xb82030;
  const frame = bubble.frame; frame.clear(); frame.fillStyle(0xffffff); frame.lineStyle(2, color);
  frame.fillRoundedRect(0, 0, COMIC_WIDTH, height, 6); frame.strokeRoundedRect(0, 0, COMIC_WIDTH, height, 6);
  if (side) {
    const edge = targetX < x ? 0 : COMIC_WIDTH;
    const baseY = Math.max(12, Math.min(height - 12, targetY - y));
    frame.fillTriangle(edge, baseY - 7, edge, baseY + 7, targetX - x, targetY - y);
    frame.lineBetween(edge, baseY - 7, targetX - x, targetY - y);
    frame.lineBetween(targetX - x, targetY - y, edge, baseY + 7);
  } else if (onScreen) {
    const tip = Math.max(12, Math.min(COMIC_WIDTH - 12, targetX - x));
    const headY = Math.max(height + 4, targetY - y);
    frame.fillTriangle(tip - 7, height - 1, tip + 7, height - 1, targetX - x, headY);
    frame.lineBetween(tip - 7, height, targetX - x, headY); frame.lineBetween(targetX - x, headY, tip + 7, height);
  }
  bubble.hint.setText(model.hint).setOrigin(1, 1).setPosition(COMIC_WIDTH - 6, height - 3)
    .setAlpha(model.hint === '▶' ? 0.35 + 0.65 * Math.sin(ui.time.now / 280) ** 2 : 1);
  bubble.picture.setVisible(!onScreen && CHARACTERS.some(c => c.id === model.speaker));
  if (bubble.picture.visible) bubble.picture.setTexture('story-portrait/' + model.speaker).setDisplaySize(30, 30).setPosition(COMIC_WIDTH - 30, -3);
  bubble.box.setPosition(x, y);
}
