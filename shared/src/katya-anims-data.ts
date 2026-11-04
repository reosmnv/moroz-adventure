// Генерирует tools/katya_build.py. Руками не править.
import type { EnemyClip } from './enemy-anims-data.ts';
export const KATYA_ANIMS: Record<string, EnemyClip> = {
  "idle": {
    "frames": 8,
    "fps": 8,
    "loop": true
  },
  "walk": {
    "frames": 6,
    "fps": 10,
    "loop": true
  },
  "hurt": {
    "frames": 6,
    "fps": 14,
    "loop": false
  },
  "fall": {
    "frames": 7,
    "fps": 12,
    "loop": false
  },
  "windup": {
    "frames": 7,
    "fps": 11,
    "loop": false
  },
  "strike": {
    "frames": 3,
    "fps": 18,
    "loop": false
  },
  "recover": {
    "frames": 5,
    "fps": 12,
    "loop": false
  },
  "cast": {
    "frames": 7,
    "fps": 9,
    "loop": false
  },
  "release": {
    "frames": 9,
    "fps": 12,
    "loop": false
  }
};
