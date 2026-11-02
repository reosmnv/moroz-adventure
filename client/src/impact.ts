import * as Phaser from 'phaser';

const IMPACT = {
  stopMs1: 60, stopMs2: 100, frameMs: 40, cooldownMs: 400, priorityMs: 150,
  linesMs1: 200, linesMs2: 300, rays1: 12, rays2: 22, bodyY: 45,
  inner1: 15, inner2: 50, minLength: 30, lengthRange: 40, width: 3,
  jitter: 1, depth: 4000, outline: 0x17121f,
};
type Image = Phaser.GameObjects.Image;
interface Stop { image: Image; texture: string; frame: string | number; until: number; target: boolean }
interface Flash { since: number; level: 1 | 2; shade: Phaser.GameObjects.Rectangle; copies: { source: Image; copy: Image }[] }

// Кадры сцена задаёт вручную: восстанавливаем их после её update, не трогая симуляцию.
export class Impact {
  private enabled = new URLSearchParams(location.search).get('fx') !== '0';
  private stops = new Map<Image, Stop>();
  private flash?: Flash;
  private lastFlash = -Infinity;
  private lastLevel = 0;
  private lines: { g: Phaser.GameObjects.Graphics; since: number; level: 1 | 2; x: number; y: number; color: number }[] = [];

  constructor(private scene: Phaser.Scene) {
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.update, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.update, this);
      this.stops.clear();
      this.clearFlash();
      for (const l of this.lines) l.g.destroy();
      this.lines = [];
    });
  }

  play(level: 1 | 2, attacker: Image | undefined, target: Image | undefined, x: number, y: number, color = IMPACT.outline): number {
    if (!this.enabled) return 0;
    const now = this.scene.time.now;
    for (const image of new Set([attacker, target])) {
      if (!image?.active) continue;
      const prev = this.stops.get(image);
      this.stops.set(image, { image, texture: prev?.texture ?? image.texture.key, frame: prev?.frame ?? image.frame.name,
        until: Math.max(prev?.until ?? 0, now + (level === 2 ? IMPACT.stopMs2 : IMPACT.stopMs1)), target: image === target });
    }
    if (now - this.lastFlash >= IMPACT.cooldownMs) {
      this.clearFlash();
      this.lastFlash = now;
      this.lastLevel = level;
      const shade = this.scene.add.rectangle(0, 0, this.scene.scale.width, this.scene.scale.height, 0)
        .setOrigin(0).setScrollFactor(0).setDepth(IMPACT.depth);
      const copies = [...new Set([attacker, target])].filter((s): s is Image => !!s?.active).map(source => ({
        source, copy: this.scene.add.image(source.x, source.y, source.texture.key, source.frame.name)
          .setOrigin(source.originX, source.originY).setScale(source.scaleX, source.scaleY)
          .setFlip(source.flipX, source.flipY).setTintMode(Phaser.TintModes.FILL).setDepth(IMPACT.depth + 1),
      }));
      this.flash = { since: now, level, shade, copies };
    } else if (level === 2 && this.lastLevel === 1 && now - this.lastFlash < IMPACT.priorityMs && this.flash) {
      // Приоритет продлевает текущий кадр, не создавая дополнительной вспышки.
      this.flash.level = 2;
      this.lastLevel = 2;
    }
    this.lines.push({ g: this.scene.add.graphics().setDepth(IMPACT.depth + 2), since: now, level, x, y: y - IMPACT.bodyY, color });
    return this.flash ? Math.max(0, this.flash.since + IMPACT.frameMs * (this.flash.level === 2 ? 3 : 2) - now) : 0;
  }

  private lastConcentration = -Infinity;
  concentrate(x: number, y: number) {
    if (!this.enabled || this.scene.time.now - this.lastConcentration < IMPACT.cooldownMs) return;
    this.lastConcentration = this.scene.time.now;
    this.lines.push({ g: this.scene.add.graphics().setDepth(IMPACT.depth + 2), since: this.scene.time.now, level: 2, x, y, color: IMPACT.outline });
  }

  private clearFlash() {
    this.flash?.shade.destroy();
    for (const c of this.flash?.copies ?? []) c.copy.destroy();
    this.flash = undefined;
  }

  private update() {
    const now = this.scene.time.now;
    for (const [image, s] of this.stops) {
      if (!image.active || now >= s.until) { this.stops.delete(image); continue; }
      image.setTexture(s.texture, s.frame);
      if (s.target) image.x += Math.floor(now / 16) % 2 ? IMPACT.jitter : -IMPACT.jitter;
    }
    const f = this.flash;
    if (f) {
      const phase = Math.floor((now - f.since) / IMPACT.frameMs);
      if (phase >= (f.level === 2 ? 3 : 2)) this.clearFlash();
      else {
        const white = phase === 1;
        f.shade.setSize(this.scene.scale.width, this.scene.scale.height).setFillStyle(white ? 0xffffff : 0);
        for (const { source, copy } of f.copies) {
          copy.setVisible(source.active);
          if (source.active) copy.setPosition(source.x, source.y).setTint(white ? 0 : 0xffffff);
        }
      }
    }
    this.lines = this.lines.filter(l => {
      const t = (now - l.since) / (l.level === 2 ? IMPACT.linesMs2 : IMPACT.linesMs1);
      if (t >= 1) { l.g.destroy(); return false; }
      const g = l.g.clear().setAlpha(1 - t);
      const count = l.level === 2 ? IMPACT.rays2 : IMPACT.rays1;
      for (let i = 0; i < count; i++) {
        const a = i * Math.PI * 2 / count + 0.13;
        const dx = Math.cos(a), dy = Math.sin(a);
        const inner = l.level === 2 ? IMPACT.inner2 : IMPACT.inner1 + t * IMPACT.minLength;
        const cam = this.scene.cameras.main;
        const edgeX = (dx > 0 ? cam.scrollX + this.scene.scale.width - l.x : l.x - cam.scrollX) / Math.max(0.001, Math.abs(dx));
        const edgeY = (dy > 0 ? this.scene.scale.height - l.y : l.y) / Math.max(0.001, Math.abs(dy));
        const outer = l.level === 2 ? Math.max(inner, Math.min(edgeX, edgeY)) : inner + IMPACT.minLength + (i * 17 % IMPACT.lengthRange) + t * IMPACT.minLength;
        const w = IMPACT.width;
        const points = [{ x: l.x + dx * inner, y: l.y + dy * inner },
          { x: l.x + dx * outer - dy * w, y: l.y + dy * outer + dx * w },
          { x: l.x + dx * outer + dy * w, y: l.y + dy * outer - dx * w }];
        const vectors = points.map(p => new Phaser.Math.Vector2(p.x, p.y));
        g.fillStyle(0xffffff).fillPoints(vectors, true).lineStyle(1, l.color).strokePoints(vectors, true);
      }
      return true;
    });
  }
}
