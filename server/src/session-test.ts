// Локальная сессия без браузера: тики запускаем вручную.
import { LocalSession } from '../../client/src/session.ts';

let failed = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? 'OK' : 'FAIL'} ${name}`);
  if (!ok) failed++;
}
let tick = () => {};
Object.defineProperty(globalThis, 'window', { value: {
  setInterval(callback: () => void) { tick = callback; return 0; },
} });
Object.defineProperty(globalThis, 'document', { value: { hidden: false } });

for (const testMode of [false, true]) {
  const session = new LocalSession('old', 0, testMode);
  try {
    tick();
    check(`C1 offline old, testMode=${testMode}`, session.snapshots.at(-1)?.level === (testMode ? 'old' : 'route') && session.testMode === testMode);
    session.pick('anastasia'); tick();
    check(`C1 offline пролог только в route, testMode=${testMode}`, session.snapshots.at(-1)?.storyScene === (testMode ? '' : 'prologue'));
    if (!testMode) {
      for (let n = 0; n < 500 && session.snapshots.at(-1)?.storyScene; n++) {
        const snap = session.snapshots.at(-1)!;
        session.advanceStory(`${snap.storyScene}:${snap.storyIndex}`); tick();
      }
      check('C1 offline пролог завершился', session.snapshots.at(-1)?.storyScene === '');
    }
    const x = session.snapshots.at(-1)!.players.get(session.me)!.x;
    session.move(1, 0, false); tick();
    check(`C1 offline управление после выбора/пролога, testMode=${testMode}`, session.snapshots.at(-1)!.players.get(session.me)!.x > x);
  } finally { session.leave(); }
}
if (failed) process.exitCode = 1;
