import * as Phaser from 'phaser';
import { VIEW_H } from '@bc/shared';
import { FONT } from './ui.ts';

// Уровень 1 «Дом на Беговой»: путь от 3-го подъезда через арку с магазинами к метро.
// Фон из 4 экранов 320x180 (PixelLab), растянутых x1.5 до 480x270, как и героиня.
const BG_SCALE = 1.5;
const SEG_W = 320 * BG_SCALE;
const SEGMENTS = 4;

// Предметы на тротуаре: x, y ступней в координатах мира, сортируются по глубине вместе с героями
interface Prop { key: string; x: number; y: number; scale?: number; flip?: boolean }
const PROPS: Prop[] = [
  { key: 'scooter', x: 700, y: 182 },
  { key: 'planter', x: 1060, y: 178 },
  { key: 'cart', x: 1290, y: 176, flip: true },
  { key: 'urn', x: 1580, y: 174 },
  { key: 'metro_sign', x: 1880, y: 176, scale: 1 },
  { key: 'lamp', x: 400, y: 170, scale: 1 },
  { key: 'lamp', x: 1000, y: 170, scale: 1 },
  { key: 'lamp', x: 1540, y: 170, scale: 1 },
];

// Надписи шрифтом поверх фона (ИИ коверкает буквы): координаты мира
interface Sign { text: string; x: number; y: number; size: number; color: string; bg?: string }
const SIGNS: Sign[] = [
  { text: 'ПОДЪЕЗД 3', x: 240, y: 96, size: 8, color: '#ffffff', bg: '#1f4e8c' },
  { text: 'ПРОДУКТЫ', x: 542, y: 103, size: 8, color: '#2f5f3a' },
  { text: 'ЦВЕТЫ', x: 820, y: 103, size: 8, color: '#b0405a' },
  { text: 'МАГАЗИНЫ', x: 1199, y: 107, size: 8, color: '#3b4a6b' },
  { text: 'БЕГОВАЯ', x: 1683, y: 76, size: 8, color: '#ffffff', bg: '#c8102e' },
];

export function preloadLevel(scene: Phaser.Scene) {
  for (let i = 0; i < SEGMENTS; i++) scene.load.image(`seg${i}`, `level1/seg-${i}.png`);
  for (const k of new Set(PROPS.map(p => p.key))) scene.load.image(k, `level1/${k}.png`);
  scene.load.image('card', 'level1/card.png');
}

export function buildLevel(scene: Phaser.Scene) {
  for (let i = 0; i < SEGMENTS; i++) {
    scene.add.image(i * SEG_W, 0, `seg${i}`).setOrigin(0, 0).setScale(BG_SCALE).setDepth(-1000);
  }
  for (const s of SIGNS) {
    scene.add.text(s.x, s.y, s.text, { fontFamily: FONT, fontSize: `${s.size}px`, color: s.color, backgroundColor: s.bg, padding: s.bg ? { x: 2, y: 2 } : undefined })
      .setOrigin(0.5).setDepth(-900);
  }
  for (const p of PROPS) {
    scene.add.image(p.x, p.y, p.key).setOrigin(0.5, 1).setScale(p.scale ?? BG_SCALE).setFlipX(!!p.flip).setDepth(p.y);
  }
}

// Карточка уровня на старте: картинка дома и название, через 3 с уходит
export function showCard(scene: Phaser.Scene) {
  const w = scene.scale.width;
  const box = scene.add.container(0, 0).setScrollFactor(0).setDepth(5000);
  box.add(scene.add.rectangle(w / 2, VIEW_H / 2, w, VIEW_H, 0x120c19, 0.85));
  box.add(scene.add.image(w / 2, VIEW_H / 2 - 12, 'card').setScale(1));
  box.add(scene.add.text(w / 2, VIEW_H - 34, 'УРОВЕНЬ 1', { fontFamily: FONT, fontSize: '8px', color: '#f2a541' }).setOrigin(0.5));
  box.add(scene.add.text(w / 2, VIEW_H - 20, 'ДОМ НА БЕГОВОЙ', { fontFamily: FONT, fontSize: '12px', color: '#ffffff' }).setOrigin(0.5));
  scene.tweens.add({ targets: box, alpha: 0, delay: 2600, duration: 600, onComplete: () => box.destroy() });
}
