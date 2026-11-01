// Проверка формата листов без браузера; заглушки остаются в scratchpad.
import { readFileSync } from 'node:fs';
import { ENEMY_ANIMS } from '@bc/shared';
const CELL = 128;
let checked = 0;
function checkSheet(path: string, frames: number) {
  const png = readFileSync(path);
  if (png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || png.readUInt32BE(16) !== frames * CELL || png.readUInt32BE(20) !== CELL) throw new Error(`Неверный размер PNG: ${path}`);
  checked++;
}
for (const [kind, clips] of Object.entries(ENEMY_ANIMS)) for (const [clip, def] of Object.entries(clips!)) checkSheet(`client/public/sprites/enemies/${kind}/${clip}-east.png`, def.frames);
if (!checked) {
  for (const clip of ['idle', 'walk', 'windup', 'strike', 'hurt', 'fall', 'recover', 'cast']) checkSheet(`scratchpad/tz06-enemies/${clip}-east.png`, 4);
  console.log(`OK: ${checked} листов-заглушек; ENEMY_ANIMS пока пуст, реальные листы проверит Claude после генерации`);
} else console.log(`OK: ${checked} реальных листов ENEMY_ANIMS, кадры 128×128`);
