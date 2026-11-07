// Отдельный тестовый сервер с фикстурой. Игровые сцены не меняются.
import { Client } from '@colyseus/sdk';
import { STORY_SCENES, addPlayer, createWorld, createStoryProgress, startStory, tickStory } from '@bc/shared';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
if (process.argv.includes('--serve') || process.argv.includes('--fixture')) {
  const port = Number(process.env.PORT ?? 2569);
  if (port !== 2569) throw new Error('Фикстура запускается только на 127.0.0.1:2569');
  process.env.HOST = '127.0.0.1'; process.env.PORT = String(port);
  STORY_SCENES.unshift({ id: 'actors_net', trigger: 'start', steps: [
    { kind: 'act', actor: 'vat1', do: 'spawn', look: 'vatnik', x: 100, y: 200 },
    { kind: 'act', actor: 'camera', do: 'focus', x: 300 },
    { kind: 'act', actor: 'vat1', do: 'walk', x: 500, ms: 5000 },
    { kind: 'line', id: 'vat.2', speaker: 'Ватник', at: 'vat1' },
  ] });
  if (process.argv.includes('--fixture')) {
    const w = createWorld(23, false, 'route'), story = createStoryProgress();
    addPlayer(w, 'a', 'anastasia');
    startStory(story, 'start', w); tickStory(story, w, 350);
    const heroes = Object.values(w.players).filter(p => p.hp > 0);
    const expected = (Math.min(...heroes.map(p => p.x)) + Math.max(...heroes.map(p => p.x))) / 2;
    addPlayer(w, 'b', 'nadezhda'); tickStory(story, w, 250);
    const camera = w.storyCamX, x = w.actors.vat1?.x;
    tickStory(story, w, 250);
    const ok = story.scene === 'actors_net' && story.index === 2 && camera === expected
      && w.storyCamX === camera && w.actors.vat1?.x > x && w.actors.vat1?.tx === 500;
    console.log(`${ok ? 'OK' : 'FAIL'} S1 фикстура без сети: камера ${camera}, ожидается ${expected}, актёр движется`);
    process.exitCode = ok ? 0 : 1;
    STORY_SCENES.shift();
  } else await import('./index.ts');
} else {
  const url = process.env.SERVER_URL ?? 'http://127.0.0.1:2569';
  let failures = 0;
  const check = (name: string, ok: boolean) => { console.log(`${ok ? 'OK' : 'FAIL'} ${name}`); if (!ok) failures++; };
  const a = await new Client(url).create('game', { level: 'route' });
  a.reconnection.enabled = false; a.onMessage('ev', () => {});
  a.send('pick', 'anastasia'); await sleep(350);
  const b = await new Client(url).joinById(a.roomId);
  b.reconnection.enabled = false; b.onMessage('ev', () => {});
  b.send('pick', 'nadezhda'); await sleep(250);
  const state = () => a.state as any;
  check('S1 act и актёр переданы через Schema', state().storyScene === 'actors_net' && state().storyIndex === 2 && state().actors.get('vat1')?.tx === 500 && state().actors.get('vat1')?.x > 100);
  const x = state().actors.get('vat1')?.x;
  a.send('storyNext', 'actors_net:2'); a.send('storyNext', 'actors_net:2'); await sleep(150);
  check('S1 ведущий не перескакивает act командой', state().storyIndex === 2);
  const token = a.reconnectionToken;
  const camera = { x: state().storyCamX, present: state().hasStoryCam };
  a.connection.close(4999, 'act reconnect test'); await sleep(450);
  check('S1 ведущий передан посреди act', (b.state as any).storyHost === b.sessionId && (b.state as any).storyIndex === 2);
  const a2 = await new Client(url).reconnect(token);
  a2.reconnection.enabled = false; a2.onMessage('ev', () => {}); await sleep(250);
  const restored = a2.state as any;
  check('S1 reconnect получает движущегося актёра и камеру', restored.storyScene === 'actors_net' && restored.storyIndex === 2 && restored.actors.get('vat1')?.x > x && restored.actors.get('vat1')?.x < 500 && camera.present && restored.hasStoryCam === camera.present && restored.storyCamX === camera.x);
  check('S1 бой во время act остановлен', restored.tick === 0 && restored.storyTime === 0);
  // Ждём конца act с запасом: холодный старт сервера иногда отстаёт на сотни мс
  for (let t = 0; t < 6200 && !((b.state as any).storyIndex === 3 && (b.state as any).actors.get('vat1')?.x === 500); t += 100) await sleep(100);
  check('S1 act сам перешёл к реплике', (b.state as any).storyIndex === 3 && (b.state as any).actors.get('vat1')?.x === 500);
  b.send('storyNext', 'actors_net:3'); await sleep(200);
  check('S1 после конца сцены актёры и камера очищены', (b.state as any).actors.size === 0 && !(b.state as any).hasStoryCam);
  await a2.leave(true); await b.leave(true);
  process.exitCode = failures ? 1 : 0;
}
