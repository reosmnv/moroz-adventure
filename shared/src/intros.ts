import { STORY_CONTENT as T } from './story-content.ts';
export interface Intro { name: string; tag: string; line: string }
export const ENEMY_INTRO: Record<string, Intro> = {
  vatnik: { name: T['ins.vatnik.name'], tag: T['ins.vatnik.tag'], line: T['ins.vatnik.line'] },
  omon: { name: T['ins.omon.name'], tag: T['ins.omon.tag'], line: T['ins.omon.line'] },
  omon_shield: { name: T['ins.shield.name'], tag: T['ins.shield.tag'], line: T['ins.shield.line'] },
  zek: { name: T['ins.zek.name'], tag: T['ins.zek.tag'], line: T['ins.zek.line'] },
  clerk: { name: T['ins.clerk.name'], tag: T['ins.clerk.tag'], line: T['ins.clerk.line'] },
  info_m: { name: T['ins.infm.name'], tag: T['ins.infm.tag'], line: T['ins.infm.line'] },
  info_f: { name: T['ins.inff.name'], tag: T['ins.inff.tag'], line: T['ins.inff.line'] },
  shaman: { name: T['ins.shaman.name'], tag: T['ins.shaman.tag'], line: T['ins.shaman.line'] },
  pizdulina: { name: T['ins.pizd.name'], tag: T['ins.pizd.tag'], line: T['ins.pizd.line'] },
  katya: { name: T['ins.katya.name'], tag: T['ins.katya.tag'], line: T['ins.katya.line'] },
};
