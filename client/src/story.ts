// Тексты завязки и поздравления редактируются отдельно от экранов.
export const STORY = {
  intro: {
    title: 'Уведомление',
    body: 'Уважаемая Анастасия Мороз! По данным единого реестра вы не существуете. Ваша учётная запись удалена. Обжаловать решение можно лично в главном МФЦ.',
    button: 'Как это не существую?!',
    go: ['Подъезд 3. Утро.', 'Надя уже накрасилась. Kris зарядила камеру.', 'Настю надо вернуть в реестр.'],
  },
  finale: {
    window: 'ОКНО 1 · ТАЛОН А-001',
    restored: 'Запись восстановлена. Анастасия Мороз существует.',
    title: 'С днём рождения, Настя!',
    body: ['Ты есть. И это лучшее, что случилось с этим реестром.', 'Твои Надя и Kris'],
    button: 'Ещё раз',
  },
};
const TYPE_MS = 30;
const wait = (ms: number) => new Promise<void>(r => window.setTimeout(r, ms));
let introShowing = false, finaleShowing = false;
function overlay() {
  const root = document.createElement('div');
  root.style.cssText = 'position:fixed;inset:0;z-index:10000;background:#100d18;color:#eee;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;overflow:auto';
  const card = document.createElement('div');
  card.style.cssText = 'position:relative;max-width:680px;width:100%;font:18px/1.6 sans-serif;text-align:center;white-space:pre-line';
  root.append(card); document.body.append(root);
  return { root, card };
}
function text(parent: HTMLElement, tag: string, value: string) {
  const el = document.createElement(tag); el.textContent = value; parent.append(el); return el;
}
function button(parent: HTMLElement, label: string) {
  return new Promise<void>(resolve => {
    const b = document.createElement('button'); b.textContent = label;
    b.style.cssText = 'font:inherit;padding:12px 24px;cursor:pointer;margin-top:16px;position:relative';
    parent.append(b); b.onclick = () => resolve();
  });
}
async function type(parent: HTMLElement, value: string, tap: HTMLElement) {
  const el = text(parent, 'p', ''); let fast = false;
  const speedUp = () => { fast = true; }; tap.addEventListener('pointerdown', speedUp);
  for (let i = 1; i <= value.length; i++) { el.textContent = value.slice(0, i); if (!fast) await wait(TYPE_MS); }
  tap.removeEventListener('pointerdown', speedUp);
}
export async function showIntro(done: () => void) {
  if (introShowing) return; introShowing = true;
  const { root, card } = overlay();
  card.style.cssText += ';background:white;color:#5e6470;border-top:12px solid #2867b2;padding:20px;box-sizing:border-box';
  text(card, 'h2', STORY.intro.title); text(card, 'p', STORY.intro.body);
  await button(card, STORY.intro.button);
  card.replaceChildren(); card.style.background = 'transparent'; card.style.color = '#eee'; card.style.borderTop = 'none';
  await type(card, STORY.intro.go.join('\n'), root);
  await button(card, 'ПОГНАЛИ'); done(); root.remove(); introShowing = false;
}
export async function showFinale(replay: () => void = () => location.reload()) {
  if (finaleShowing) return; finaleShowing = true;
  await wait(1500);
  const { root, card } = overlay(); root.style.opacity = '0'; root.style.transition = 'opacity 600ms';
  requestAnimationFrame(() => { root.style.opacity = '1'; }); await wait(600);
  text(card, 'h3', STORY.finale.window); await wait(500);
  await type(card, STORY.finale.restored, root);
  text(card, 'h1', STORY.finale.title);
  for (let i = 0; i < 70; i++) {
    const piece = document.createElement('i');
    piece.style.cssText = `position:absolute;pointer-events:none;left:${(i * 37) % 100}%;top:-12px;width:7px;height:12px;background:${['#9d74d4', '#c2185b', '#9be33b'][i % 3]}`;
    root.prepend(piece);
    piece.animate([{ transform: 'translateY(-20px) rotate(0)' }, { transform: `translateY(110vh) rotate(${360 + i * 13}deg)` }], { duration: 2500 + i * 31, delay: i * 30, iterations: Infinity });
  }
  for (const line of STORY.finale.body) await type(card, line, root);
  await button(card, STORY.finale.button); replay();
}
