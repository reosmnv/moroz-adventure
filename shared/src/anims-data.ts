// Сгенерировано tools/gen_anims_ts.py из assets/sprites/anims.json, руками не править.

export type Form = 'prime' | 'ultimate';
export interface AnimDef { east: number; west: number; fps: number; loop: boolean; hit?: { east: number; west: number }; hits?: number[] }

export const HERO_ANIMS: Record<Form, Record<string, AnimDef>> = {
  prime: {
    'cross': { east: 8, west: 7, fps: 18, loop: false, hit: { east: 3, west: 2 } },
    'dash': { east: 8, west: 8, fps: 14, loop: true },
    'fall': { east: 7, west: 7, fps: 12, loop: false },
    'getup': { east: 5, west: 5, fps: 10, loop: false },
    'highkick': { east: 11, west: 11, fps: 18, loop: false, hit: { east: 7, west: 7 } },
    'hurt': { east: 6, west: 6, fps: 14, loop: false },
    'idle': { east: 8, west: 8, fps: 8, loop: true },
    'jab': { east: 9, west: 9, fps: 18, loop: false, hit: { east: 4, west: 4 } },
    'superman': { east: 11, west: 8, fps: 18, loop: false, hit: { east: 6, west: 3 } },
    'teep': { east: 9, west: 9, fps: 18, loop: false, hit: { east: 4, west: 4 } },
    'transform-up': { east: 13, west: 13, fps: 12, loop: false },
    'uppercut': { east: 7, west: 7, fps: 18, loop: false, hit: { east: 4, west: 4 } },
    'walk': { east: 6, west: 6, fps: 10, loop: true },
  },
  ultimate: {
    'dash': { east: 8, west: 8, fps: 14, loop: true },
    'elbow': { east: 9, west: 9, fps: 18, loop: false, hit: { east: 4, west: 4 } },
    'fall': { east: 7, west: 7, fps: 12, loop: false },
    'flying-knee': { east: 10, west: 11, fps: 18, loop: false, hit: { east: 5, west: 6 } },
    'getup': { east: 5, west: 5, fps: 10, loop: false },
    'hurricane': { east: 17, west: 17, fps: 16, loop: false, hit: { east: 4, west: 4 }, hits: [4, 8, 12] },
    'hurt': { east: 6, west: 6, fps: 14, loop: false },
    'idle': { east: 8, west: 8, fps: 8, loop: true },
    'knee': { east: 9, west: 9, fps: 18, loop: false, hit: { east: 4, west: 4 } },
    'roundhouse': { east: 7, west: 7, fps: 18, loop: false, hit: { east: 3, west: 3 } },
    'spin-elbow': { east: 11, west: 11, fps: 18, loop: false, hit: { east: 6, west: 6 } },
    'transform-down': { east: 13, west: 13, fps: 12, loop: false },
    'walk': { east: 6, west: 6, fps: 10, loop: true },
  },
};
