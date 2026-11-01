import * as Phaser from 'phaser';
import { LEVELS, VIEW_H, type Stage } from '@bc/shared';
import { FONT } from './ui.ts';

const BG_SCALE = 1.5;
const CARD_MS = 1800;
const DEBUG = new URLSearchParams(location.search).get('debug') === '1';
const key = (file: string) => 'stage:' + file;

export function preloadStages(scene: Phaser.Scene) {
  const files = new Set(['route/tunnel.png', 'route/train.png']);
  for (const stage of LEVELS.route.stages) {
    for (const item of [...stage.layers, ...stage.props]) files.add(item.file);
  }
  for (const file of files) scene.load.image(key(file), file);
}

export function debugLane(scene: Phaser.Scene, stage: Stage): Phaser.GameObjects.GameObject[] {
  const objects: Phaser.GameObjects.GameObject[] = [];
  const own = <T extends Phaser.GameObjects.GameObject>(o: T): T => { objects.push(o); return o; };
  if (DEBUG) {
    const g = own(scene.add.graphics().setDepth(3000));
    g.lineStyle(1, 0xffff00).beginPath();
    stage.lane.forEach(([x, y], i) => { if (i === 0) g.moveTo(x, y); else g.lineTo(x, y); });
    g.strokePath();
    g.lineStyle(1, 0xff0000).lineBetween(0, stage.laneBottom, stage.width, stage.laneBottom);
    if (stage.exit) { const e = stage.exit; g.fillStyle(0x00ffff, 0.2).fillRect(e.x0, 0, e.x1 - e.x0, e.y1); }
    for (const [x, y] of stage.lane) own(scene.add.text(Math.min(x, stage.width - 26), y - 10, String(y), { fontFamily: FONT, fontSize: '8px', color: '#ffff00' }).setDepth(3001));
  }
  return objects;
}

// Объекты остаются вне контейнера: предметы сортируются вместе с героями по y.
export class StageView {
  private objects: Phaser.GameObjects.GameObject[] = [];
  private tunnel?: Phaser.GameObjects.TileSprite;
  private train?: Phaser.GameObjects.TileSprite;
  private glint?: Phaser.GameObjects.Rectangle;
  private glintAt = 0;
  private glintX = 0;
  private elapsed = 0;
  private card?: Phaser.GameObjects.Container;
  private cardIndex = -1;

  constructor(private scene: Phaser.Scene, private stage: Stage) {
    const own = <T extends Phaser.GameObjects.GameObject>(o: T): T => { this.objects.push(o); return o; };
    stage.layers.forEach((layer, i) => {
      const depth = -1000 + i;
      if (layer.fx === 'tunnel' && stage.tunnel) {
        const fx = stage.tunnel;
        this.tunnel = own(scene.add.tileSprite(0, fx.y0, stage.width, fx.y1 - fx.y0, key('route/tunnel.png')).setTileScale(BG_SCALE).setOrigin(0).setDepth(depth - 0.2));
        this.glint = own(scene.add.rectangle(0, fx.y0, 14, fx.y1 - fx.y0, 0xfff1ce).setOrigin(0).setDepth(depth - 0.1).setVisible(false));
        this.glintAt = Phaser.Math.Between(400, 1200);
      }
      if (layer.fx === 'train' && stage.train) {
        this.train = own(scene.add.tileSprite(stage.width, stage.train.y, stage.width, stage.train.h, key('route/train.png')).setTileScale(BG_SCALE).setOrigin(0).setDepth(depth - 0.1));
      }
      own(scene.add.image(0, 0, key(layer.file)).setOrigin(0).setScale(BG_SCALE).setDepth(depth));
    });
    for (const p of stage.props) own(scene.add.image(p.x, p.y, key(p.file)).setOrigin(0.5, 1).setScale(p.scale ?? BG_SCALE).setFlipX(!!p.flip).setDepth(p.depth ?? p.y));
    for (const s of stage.signs) own(scene.add.text(s.x, s.y, s.text, { fontFamily: FONT, fontSize: `${s.size}px`, color: s.color, backgroundColor: s.bg, padding: s.bg ? { x: 2, y: 2 } : undefined }).setOrigin(0.5).setDepth(-900));
    this.objects.push(...debugLane(scene, stage));
    this.update(0);
  }

  update(dt: number) {
    this.elapsed += dt;
    if (this.tunnel && this.stage.tunnel) {
      const fx = this.stage.tunnel;
      this.tunnel.tilePositionX += fx.speed * dt / 1000;
      if (this.elapsed >= this.glintAt) {
        this.glintX = this.stage.width;
        this.glint!.setAlpha(Phaser.Math.FloatBetween(0.25, 0.5)).setVisible(true);
        this.glintAt = this.elapsed + Phaser.Math.Between(400, 1200);
      }
      this.glintX -= fx.speed * dt / 1000;
      this.glint!.setX(this.glintX);
      if (this.glintX < -14) this.glint!.setVisible(false);
    }
    if (this.train && this.stage.train) {
      const fx = this.stage.train, w = this.stage.width;
      let t = this.elapsed % (fx.arriveMs + fx.standMs + fx.leaveMs + fx.emptyMs);
      let x = 0;
      if (t < fx.arriveMs) x = w * (1 - t / fx.arriveMs) ** 2;
      else if ((t -= fx.arriveMs) < fx.standMs) x = 0;
      else if ((t -= fx.standMs) < fx.leaveMs) x = -w * (t / fx.leaveMs) ** 2;
      else x = -w;
      this.train.setX(x).setVisible(x > -w);
    }
    const index = Math.floor(this.elapsed / CARD_MS);
    if (index !== this.cardIndex) {
      this.card?.destroy(); this.card = undefined; this.cardIndex = index;
      const text = this.stage.cards[index];
      if (text) {
        this.card = this.scene.add.container(0, 0).setScrollFactor(0).setDepth(5000);
        this.card.add(this.scene.add.rectangle(0, 0, 1, 68, 0x120c19, 0.88));
        this.card.add(this.scene.add.text(0, -17, text[0], { fontFamily: FONT, fontSize: '8px', color: '#f2a541' }).setOrigin(0.5));
        this.card.add(this.scene.add.text(0, 8, text[1], { fontFamily: FONT, fontSize: '12px', color: '#ffffff' }).setOrigin(0.5));
      }
    }
    if (this.card) {
      this.card.setPosition(this.scene.scale.width / 2, VIEW_H / 2);
      (this.card.list[0] as Phaser.GameObjects.Rectangle).setSize(this.scene.scale.width, 68);
    }
  }

  destroy() { this.card?.destroy(); this.objects.forEach(o => o.destroy()); }
}
