// Отдельный тестовый сервер с фикстурой. Игровые сцены не меняются.
import { Client } from '@colyseus/sdk';
import { STORY_SCENES } from '@bc/shared';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
if (process.argv.includes('--serve')) {
  const port = Number(process.env.PORT ?? 2569);
  if (port !== 2569) throw new Error('Фикстура запускается только на 127.0.0.1:2569');
  process.env.HOST = '127.0.0.1'; process.env.PORT = String(port);
  STORY_SCENES.unshift({ id: 'actors_net', trigger: 'start', steps: [
    { kind: 'act', actor: 'vat1', do: 'spawn', look: 'vatnik', x: 100, y: 200 },
    { kind: 'act', actor: 'camera', do: 'focus', x: 300 },
    { kind: 'act', actor: 'vat1', do: 'walk', x: 500, ms: 5000 },
    { kind: 'line', id: 'vat.2', speaker: 'Ватник', at: 'vat1' },
  ] });
  await import('./index.ts');
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
  a.connection.close(4999, 'act reconnect test'); await sleep(450);
  check('S1 ведущий передан посреди act', (b.state as any).storyHost === b.sessionId && (b.state as any).storyIndex === 2);
  const a2 = await new Client(url).reconnect(token);
  a2.reconnection.enabled = false; a2.onMessage('ev', () => {}); await sleep(250);
  const restored = a2.state as any;
  check('S1 reconnect получает движущегося актёра и камеру', restored.storyScene === 'actors_net' && restored.storyIndex === 2 && restored.actors.get('vat1')?.x > x && restored.actors.get('vat1')?.x < 500 && restored.hasStoryCam && restored.storyCamX === 300);
  check('S1 бой во время act остановлен', restored.tick === 0 && restored.storyTime === 0);
  await sleep(4200);
  check('S1 act сам перешёл к реплике', (b.state as any).storyIndex === 3 && (b.state as any).actors.get('vat1')?.x === 500);
  b.send('storyNext', 'actors_net:3'); await sleep(200);
  check('S1 после конца сцены актёры и камера очищены', (b.state as any).actors.size === 0 && !(b.state as any).hasStoryCam);
  await a2.leave(true); await b.leave(true);
  process.exitCode = failures ? 1 : 0;
}
