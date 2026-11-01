import type { BossId } from './boss-data.ts';
import type { EnemyKind } from './enemy-data.ts';
export interface Spawn { kind: EnemyKind; side: 'L' | 'R' }
export interface Encounter { trigger: number; arena: [number, number]; waves: Spawn[][]; bosses?: BossId[] }
export const ENCOUNTERS: Record<string, Encounter[]> = {
  street: [
    { trigger: 300, arena: [240, 720], waves: [[{ kind: 'vatnik', side: 'R' }, { kind: 'vatnik', side: 'R' }], [{ kind: 'vatnik', side: 'R' }, { kind: 'omon', side: 'L' }]] },
    { trigger: 1240, arena: [1180, 1660], waves: [[{ kind: 'vatnik', side: 'R' }, { kind: 'vatnik', side: 'R' }, { kind: 'vatnik', side: 'L' }], [{ kind: 'vatnik', side: 'R' }, { kind: 'vatnik', side: 'L' }, { kind: 'omon', side: 'R' }]] },
    { trigger: 2220, arena: [2160, 2640], waves: [[{ kind: 'omon', side: 'R' }, { kind: 'omon', side: 'R' }], [{ kind: 'omon', side: 'R' }, { kind: 'omon', side: 'L' }, { kind: 'vatnik', side: 'R' }]] }
  ],
  yard: [
    { trigger: 360, arena: [300, 780], waves: [[{ kind: 'zek', side: 'R' }, { kind: 'vatnik', side: 'R' }], [{ kind: 'zek', side: 'R' }, { kind: 'zek', side: 'L' }, { kind: 'omon', side: 'R' }]] }
  ],
  vestibule: [
    { trigger: 700, arena: [640, 1120], waves: [[{ kind: 'omon_shield', side: 'R' }, { kind: 'omon', side: 'R' }], [{ kind: 'omon', side: 'R' }, { kind: 'omon', side: 'L' }, { kind: 'omon_shield', side: 'R' }]] }
  ],
  wagon: [
    { trigger: 960, arena: [900, 1380], waves: [[{ kind: 'vatnik', side: 'R' }, { kind: 'vatnik', side: 'L' }, { kind: 'zek', side: 'R' }], [{ kind: 'zek', side: 'R' }, { kind: 'zek', side: 'L' }, { kind: 'vatnik', side: 'R' }]] }
  ],
  mayak: [
    { trigger: 260, arena: [200, 680], waves: [[{ kind: 'clerk', side: 'R' }, { kind: 'vatnik', side: 'R' }, { kind: 'vatnik', side: 'L' }], [{ kind: 'clerk', side: 'R' }, { kind: 'zek', side: 'R' }, { kind: 'zek', side: 'L' }, { kind: 'vatnik', side: 'R' }]] },
    { trigger: 1000, arena: [940, 1420], waves: [[{ kind: 'vatnik', side: 'R' }, { kind: 'vatnik', side: 'L' }]], bosses: ['shaman', 'pizdulina'] }
  ],
  city: [
    { trigger: 560, arena: [500, 980], waves: [[{ kind: 'info_m', side: 'R' }, { kind: 'info_m', side: 'R' }, { kind: 'info_f', side: 'R' }], [{ kind: 'info_f', side: 'R' }, { kind: 'info_f', side: 'L' }, { kind: 'omon', side: 'R' }]] },
    { trigger: 1660, arena: [1600, 2080], waves: [[{ kind: 'omon', side: 'R' }, { kind: 'omon', side: 'R' }, { kind: 'info_m', side: 'L' }, { kind: 'info_m', side: 'R' }], [{ kind: 'omon_shield', side: 'R' }, { kind: 'omon', side: 'R' }, { kind: 'omon', side: 'L' }]] }
  ],
  mfc: [
    { trigger: 660, arena: [600, 1080], waves: [[{ kind: 'info_f', side: 'R' }, { kind: 'info_f', side: 'R' }, { kind: 'clerk', side: 'R' }], [{ kind: 'info_m', side: 'R' }, { kind: 'info_m', side: 'L' }, { kind: 'vatnik', side: 'R' }, { kind: 'vatnik', side: 'R' }]] },
    { trigger: 2060, arena: [2000, 2480], waves: [[{ kind: 'clerk', side: 'R' }, { kind: 'clerk', side: 'R' }, { kind: 'zek', side: 'R' }, { kind: 'zek', side: 'L' }], [{ kind: 'info_m', side: 'R' }, { kind: 'info_f', side: 'R' }, { kind: 'clerk', side: 'L' }, { kind: 'vatnik', side: 'R' }]] },
    { trigger: 3660, arena: [3600, 4080], waves: [[{ kind: 'omon', side: 'R' }, { kind: 'omon', side: 'R' }, { kind: 'omon_shield', side: 'R' }], [{ kind: 'omon', side: 'R' }, { kind: 'omon', side: 'L' }, { kind: 'omon', side: 'R' }, { kind: 'omon_shield', side: 'R' }]] }
  ],
};
