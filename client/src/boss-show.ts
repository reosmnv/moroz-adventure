import * as Phaser from 'phaser';
import { ENEMY_ANIMS } from '@bc/shared';
import type { Snapshot } from './session.ts';
import { textStyle } from './ui.ts';

const STAGE_X = 1240, STAGE_Y = 111;
// Концерт — только декорации; бой и момент выхода задаёт снимок.
export class BossShow {
  private objects: Phaser.GameObjects.GameObject[] = [];
  private singer: Phaser.GameObjects.Image;
  private fans: Phaser.GameObjects.Image[];
  private lights: Phaser.GameObjects.Triangle[];
  private elapsed = 0;
  private departure?: number;
  private noteAt = 0;
  constructor(private scene: Phaser.Scene) {
    this.singer = scene.add.image(STAGE_X, STAGE_Y, 'enemy/shaman/cast').setOrigin(0.5, 112/128).setScale(1.5*1.15).setDepth(149.1);
    this.fans = Array.from({length: 8}, (_, i) => scene.add.image(1150+i*27, 150+(i%3)*5, 'enemy/vatnik/idle').setOrigin(0.5,112/128).setScale(0.8).setTint(0x8888aa).setFlipX(i>3).setDepth(149.2));
    this.lights = [0xff4fd8,0x4fd8ff].map((c,i) => scene.add.triangle(1190+i*100, 40, 0,0,-60,130,60,130,c,0.18).setOrigin(0.5,0).setDepth(149.3).setBlendMode(Phaser.BlendModes.ADD));
    this.objects.push(this.singer,...this.fans,...this.lights);
  }
  update(s: Snapshot, dt: number) {
    this.elapsed += dt;
    const boss = [...s.enemies.values()].find(e=>e.boss==='shaman');
    const started = s.encDone >= 2 || !!boss || [...s.enemies.values()].some(e=>e.boss==='pizdulina') || s.lockX0 >= 900;
    if (started && this.departure === undefined) this.departure = this.elapsed - (boss?.enterMs ? 900-boss.enterMs : 1200);
    const clip = ENEMY_ANIMS.shaman!.cast;
    const raw = Math.floor(this.elapsed*clip.fps/1000) % Math.max(1,clip.frames*2-2);
    this.singer.setFrame(raw < clip.frames ? raw : clip.frames*2-2-raw);
    this.lights.forEach((l,i)=>l.setAngle(Math.sin(this.elapsed*Math.PI*2/3000+i*Math.PI)*20));
    if (this.departure === undefined) {
      this.fans.forEach((f,i)=> { const c=ENEMY_ANIMS.vatnik!.idle; f.setFrame(Math.floor(this.elapsed*c.fps/1000+i)%c.frames).setY(150+(i%3)*5-Math.abs(Math.sin(this.elapsed/180+i))*2); });
      if (this.elapsed>=this.noteAt) {
        this.noteAt=this.elapsed+2500;
        const note=this.scene.add.text(STAGE_X,STAGE_Y-100, Math.floor(this.elapsed/2500)%2?'♪':'ВСТАЮ!', textStyle(8,'#ffd34f')).setOrigin(0.5).setDepth(130);
        this.objects.push(note);
        this.scene.tweens.add({targets:note,y:note.y-22,alpha:0,duration:1800,onComplete:()=>note.destroy()});
      }
    } else {
      const t=this.elapsed-this.departure, u=Math.min(1,t/700);
      this.singer.setPosition(STAGE_X, STAGE_Y+(205-STAGE_Y)*u-240*u*(1-u)).setDepth(u ? 204 : 120).setVisible(t<700 && boss?.phase==='enter');
      this.fans.forEach((f,i)=>f.setPosition(1150+i*27+t*0.7,150+(i%3)*5-t*0.15).setVisible(t<1200));
      this.lights.forEach(l=>l.setVisible(s.encDone<2));
      if(t>=700 && t-dt<700) this.scene.cameras.main.shake(150,0.006);
    }
  }
  destroy() { this.objects.forEach(o=>o.destroy()); }
}
