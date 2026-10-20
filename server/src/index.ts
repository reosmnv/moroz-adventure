import { defineServer, defineRoom, createRouter, createEndpoint, matchMaker } from 'colyseus';
import { GameRoom } from './GameRoom.ts';

const PORT = Number(process.env.PORT ?? 2567);
// Для разработки слушаем Tailscale-IP; в проде за Caddy: HOST=127.0.0.1
const HOST = process.env.HOST ?? '100.118.72.60';
// Origin'ы, которым разрешён матчмейкинг (SPEC N-11), через запятую. Не задано: разрешены все (только dev)
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean);

if (ALLOWED_ORIGINS.length) {
  matchMaker.controller.getCorsHeaders = (headers: Headers) => {
    const origin = headers.get('origin') ?? '';
    // Чужой origin получает заголовок с нашим первым origin: браузер такой ответ отклонит
    return { 'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0], Vary: 'Origin' };
  };
}

const startedAt = Date.now();
const health = createEndpoint('/health', { method: 'GET' }, async () => {
  const rooms = await matchMaker.query({ name: 'game' });
  return new Response(JSON.stringify({
    ok: true,
    uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    rooms: rooms.length,
    players: rooms.reduce((n, r) => n + r.clients, 0),
  }), { status: 200, headers: { 'content-type': 'application/json' } });
});

export const server = defineServer({
  rooms: {
    game: defineRoom(GameRoom),
  },
  routes: createRouter({ health }),
});

const latency = Number(process.env.LATENCY ?? 0);
if (latency) server.simulateLatency(latency);

await server.listen(PORT, HOST);
console.log(`colyseus on ${HOST}:${PORT}${latency ? `, simulated latency ${latency} ms` : ''}${ALLOWED_ORIGINS.length ? `, CORS: ${ALLOWED_ORIGINS.join(' ')}` : ', CORS: любой origin'}`);
