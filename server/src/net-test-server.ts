// Только фикстура: боевой index.ts этот класс не импортирует.
import { defineServer, defineRoom } from 'colyseus';
import { GameRoom } from './GameRoom.ts';

class NetTestRoom extends GameRoom {
  protected override testToolsEnabled(): boolean { return true; }
}

// Адрес фиксирован: тестовый режим не слушает внешнюю сеть и боевой :2567.
const server = defineServer({ rooms: { game: defineRoom(NetTestRoom) } });
await server.listen(2568, '127.0.0.1');
console.log('net-test fixture on 127.0.0.1:2568');
