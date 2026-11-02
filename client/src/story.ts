import { CHARACTERS, HERO_ID, NADYA_ID, KRIS_ID } from '@bc/shared';
export const GAME_TITLE = 'Moroz Birthday Adventures';
// Тексты завязки и поздравления редактируются отдельно от экранов.
export const STORY = {
  mfcLast: ['ОХРАНА ОКНА', 'ПОСЛЕДНИЙ БОЙ'],
  "menu": {
    "sub": "1–4 игрока. У каждого свой телефон",
    "solo": "Играть соло",
    "online": "Создать комнату"
  },
  "roles": {
    "anastasia": "Ближний бой. Превращение",
    "nadezhda": "Контроль. Пощёчины",
    "kris": "Издалека. Вспышка, луч",
    "ramil": "Захваты. Телепорт. Перекур"
  },
  "intro": {
    "title": "Уведомление № 0001-НС",
    "body": "Уважаемая Анастасия Мороз! По решению комиссии вы признаны несуществующей. Основание: систематическое превышение допустимой громкости. Учётная запись удалена. Обжалование: лично, главный МФЦ, окно 1.",
    "foot": "Сообщение отправлено автоматически. Отвечать не нужно. Вас нет.",
    "button": "В смысле нет?!",
    "go": [
      "08:40. Подъезд 3.",
      "Настя: удалена. Злая.",
      "Надя: накрашена. Готова бить.",
      "Kris: камера заряжена. Снимает всё.",
      "Рамиль: докуривает. Говорит, сейчас.",
      "План: дойти до главного МФЦ. Вернуть Настю в реестр."
    ],
    "goButton": "ПОГНАЛИ"
  },
  "pushes": [
    "Реестр: замечено перемещение несуществующего лица. Меры приняты.",
    "Поступило 14 жалоб на шум во дворе. Все на вас.",
    "Ваш проездной аннулирован. Вы тоже.",
    "Статус обновлён: существование под вопросом.",
    "Ваше обращение принято. Номер в очереди: 4 812."
  ],
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
    "pause": "Пауза у всех. Поставила {герой}",
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
    "halt": "ПОЕЗД ТОРМОЗИТ…",
    "station": "МАЯКОВСКАЯ. ВЫХОДИ →"
  },
  "finale": {
    "window": "ОКНО 1 · ТАЛОН А-001",
    "dialogue": [
      "Цель обращения?",
      "Существовать.",
      "Основания?",
      "Видео. Всё утро. В 4K.",
      "Свидетель. Видела лично. Била рядом.",
      "Я тоже. Я тут с восьми утра, если что.",
      "…Двух свидетелей достаточно. Трёх даже много."
    ],
    "restored": "ЗАПИСЬ ВОССТАНОВЛЕНА",
    "status": "Анастасия Мороз. Статус: существует. Громкость: без ограничений.",
    "title": "С днём рождения, Настя!",
    "body": "Теперь официально: ты есть. Мы проверили лично.",
    "sign": "Надя, Kris, Рамиль",
    "button": "В главное меню"
  }
};
const TYPE_MS = 30;
const wait = (ms: number) => new Promise<void>(r => window.setTimeout(r, ms));
export let krisFrame = '';
export function saveKrisFrame(image: HTMLImageElement | Phaser.Display.Color) { if (image instanceof HTMLImageElement) krisFrame = image.src; }
export const portrait = (id: string) => id === HERO_ID ? 'ui/portrait-prime.png' : id === NADYA_ID ? 'ui/nadya/portrait.png' : id === KRIS_ID ? 'ui/kris/portrait.png' : 'ui/ramil/portrait.png';
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
  text(card, 'h3', STORY.finale.window); await wait(500);
  const scroll = document.createElement('div'); scroll.className = 'final-scroll'; card.append(scroll);
  const speakers = ['', 'anastasia', '', 'kris', 'nadezhda', 'ramil', ''];
  for (const [i, line] of STORY.finale.dialogue.entries()) {
    const row = document.createElement('div'); row.className = 'dialogue-row'; scroll.append(row);
    const speaker = speakers[i];
    if (speaker) { const img = document.createElement('img'); img.src = portrait(speaker); row.append(img); }
    text(row, 'small', speaker ? CHARACTERS.find(c => c.id === speaker)!.name : 'ОКНО 1');
    await type(row, line, root);
    if (i === 3 && krisFrame) {
      const frame = document.createElement('figure'); text(frame, 'figcaption', 'REC ● 4K');
      const img = document.createElement('img'); img.src = krisFrame; frame.append(img); scroll.append(frame);
    }
  }
  await wait(1000);
  card.style.transition = 'opacity 300ms'; card.style.opacity = '0'; await wait(300);
  card.replaceChildren(); card.classList.add('final-page'); card.style.opacity = '1';
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
