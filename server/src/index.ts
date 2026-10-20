import { defineServer, defineRoom } from 'colyseus';
import { GameRoom } from './GameRoom.ts';

const PORT = Number(process.env.PORT ?? 2567);
// Для разработки слушаем Tailscale-IP; за Caddy в проде будет 127.0.0.1
const HOST = process.env.HOST ?? '100.118.72.60';

export const server = defineServer({
  rooms: {
    game: defineRoom(GameRoom),
  },
});

const latency = Number(process.env.LATENCY ?? 0);
if (latency) server.simulateLatency(latency);

await server.listen(PORT, HOST);
console.log(`colyseus on ${HOST}:${PORT}${latency ? `, simulated latency ${latency} ms` : ''}`);
