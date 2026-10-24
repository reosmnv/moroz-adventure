// Боевые данные Анастасии: серии, удары, числа. Тайминги кадров берутся из anims-data.ts.
import { HERO_ANIMS, type AnimDef, type Form } from './anims-data.ts';

export const HERO_ID = 'anastasia';
export const ULT_MS = 8000; // сколько длится Ultimate
export const COMBO_MS = 700; // окно, в которое следующий удар продолжает серию
export const HURT_INVULN_MS = 800;

export interface Strike {
  range: number;
  dmg: number; // за одно попадание
  kb: number; // отбрасывание
  stun: number; // оглушение врага, мс
  down?: boolean; // сбивает с ног
}

// A: серия из трёх, B: завершающий, вариант зависит от числа ударов серии до него (0, 1, 2)
export const CHAIN: Record<Form, string[]> = {
  prime: ['jab', 'cross', 'teep'],
  ultimate: ['elbow', 'knee', 'roundhouse'],
};
export const HEAVY: Record<Form, string[]> = {
  prime: ['superman', 'highkick', 'uppercut'],
  ultimate: ['spin-elbow', 'flying-knee', 'hurricane'],
};

export const STRIKES: Record<Form, Record<string, Strike>> = {
  prime: {
    jab: { range: 34, dmg: 6, kb: 4, stun: 350 },
    cross: { range: 36, dmg: 8, kb: 6, stun: 350 },
    teep: { range: 44, dmg: 12, kb: 32, stun: 500 },
    superman: { range: 58, dmg: 18, kb: 28, stun: 500, down: true },
    highkick: { range: 46, dmg: 20, kb: 30, stun: 500, down: true },
    uppercut: { range: 38, dmg: 24, kb: 10, stun: 500, down: true },
  },
  ultimate: {
    elbow: { range: 34, dmg: 9, kb: 4, stun: 350 },
    knee: { range: 36, dmg: 11, kb: 6, stun: 350 },
    roundhouse: { range: 48, dmg: 18, kb: 36, stun: 500 },
    'spin-elbow': { range: 44, dmg: 24, kb: 24, stun: 500, down: true },
    'flying-knee': { range: 58, dmg: 28, kb: 30, stun: 500, down: true },
    hurricane: { range: 50, dmg: 12, kb: 6, stun: 400 }, // на каждое из трёх попаданий
  },
};

export const SPEED_MULT: Record<Form, number> = { prime: 1, ultimate: 1.25 };

export const dirOf = (facing: number): 'east' | 'west' => (facing >= 0 ? 'east' : 'west');
export const animDef = (form: Form, move: string): AnimDef | undefined => HERO_ANIMS[form][move];
export const isLoop = (form: Form, move: string) => !!animDef(form, move)?.loop;

export function moveDurMs(form: Form, move: string, facing: number): number {
  const a = animDef(form, move);
  return a ? (a[dirOf(facing)] * 1000) / a.fps : 0;
}

// Моменты попаданий от начала анимации, мс (начало кадра удара)
export function hitTimesMs(form: Form, move: string, facing: number): number[] {
  const a = animDef(form, move);
  if (!a) return [];
  const frames = a.hits ?? (a.hit ? [a.hit[dirOf(facing)]] : []);
  return frames.map(f => (f * 1000) / a.fps);
}
