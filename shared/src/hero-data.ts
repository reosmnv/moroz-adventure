// Боевые данные Анастасии: серии, удары, числа. Тайминги кадров берутся из anims-data.ts.
import { HERO_ANIMS, type AnimDef, type Form } from './anims-data.ts';

export const HERO_ID = 'anastasia';
export const RANGE_MULT = 1.3; // дальность всех ударов героини +30% (mr.R 24.10)
export const ULT_MS = 16000; // сколько длится Ultimate
export const COMBO_MS = 700; // окно, в которое следующий удар продолжает серию
export const HURT_INVULN_MS = 800;
export const IMMUNE_INVULN_MS = 300; // в Ultimate удары по героине не прерывают её, но подряд не копятся
export const KNOCK_MULT: Record<Form, number> = { prime: 2, ultimate: 4 }; // отбрасывание врагов по просьбе mr.R: зрелищность
export const HITSTOP_MS = 50; // заморозка героини при попадании (один тик)
export const HITSTOP_HEAVY_MS = 100; // при сбивании с ног
export const RUN_MULT = 1.7; // бег: стик на максимум (или Shift)

export interface Strike {
  range: number;
  dmg: number; // за одно попадание
  kb: number; // отбрасывание
  stun: number; // оглушение врага, мс
  down?: boolean; // сбивает с ног
  launch?: boolean; // подбрасывает врага (только визуально, механика как у down)
}
export const AIR_MS = 900; // сколько враг летит после подброса

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
    jab: { range: 52, dmg: 5, kb: 2, stun: 250 },
    cross: { range: 54, dmg: 7, kb: 3, stun: 250 },
    teep: { range: 66, dmg: 10, kb: 14, stun: 400 },
    superman: { range: 86, dmg: 15, kb: 28, stun: 500, down: true },
    highkick: { range: 70, dmg: 25, kb: 30, stun: 500, down: true },
    uppercut: { range: 58, dmg: 25, kb: 10, stun: 500, down: true, launch: true },
  },
  ultimate: {
    elbow: { range: 52, dmg: 15, kb: 2, stun: 250 },
    knee: { range: 54, dmg: 20, kb: 3, stun: 250 },
    roundhouse: { range: 72, dmg: 25, kb: 16, stun: 400 },
    'spin-elbow': { range: 66, dmg: 30, kb: 24, stun: 500, down: true },
    'flying-knee': { range: 86, dmg: 35, kb: 30, stun: 500, down: true },
    hurricane: { range: 75, dmg: 30, kb: 1, stun: 400 }, // на каждое из трёх попаданий
  },
};

// Подписи для кнопки B
export const MOVE_NAMES: Record<string, string> = {
  superman: 'Суперман', highkick: 'Хай-кик', uppercut: 'Апперкот',
  'spin-elbow': 'Локоть с разворота', 'flying-knee': 'Колено в прыжке', hurricane: 'Ураган',
};

export const SPEED_MULT: Record<Form, number> = { prime: 1, ultimate: 2.5 };

export const dirOf = (facing: number): 'east' | 'west' => (facing >= 0 ? 'east' : 'west');
export const animDef = (form: Form, move: string): AnimDef | undefined => HERO_ANIMS[form][move];
export const isLoop = (form: Form, move: string) => !!animDef(form, move)?.loop;

// Удары проигрываются быстрее исходных fps: меньше задержка от нажатия до попадания (mr.R 24.10)
export const ATTACK_SPEED = 1.4;
export const moveSpeed = (form: Form, move: string): number => (STRIKES[form][move] ? ATTACK_SPEED : 1);

export function moveDurMs(form: Form, move: string, facing: number): number {
  const a = animDef(form, move);
  return a ? (a[dirOf(facing)] * 1000) / (a.fps * moveSpeed(form, move)) : 0;
}

// Моменты попаданий от начала анимации, мс (начало кадра удара)
export function hitTimesMs(form: Form, move: string, facing: number): number[] {
  const a = animDef(form, move);
  if (!a) return [];
  const frames = a.hits ?? (a.hit ? [a.hit[dirOf(facing)]] : []);
  return frames.map(f => (f * 1000) / (a.fps * moveSpeed(form, move)));
}
