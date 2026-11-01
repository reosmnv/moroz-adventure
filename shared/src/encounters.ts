import type { BossId } from './boss-data.ts';
import type { EnemyKind } from './enemy-data.ts';
export interface Spawn { kind: EnemyKind; door?: number }
export interface Encounter { trigger: number; arena: [number, number]; waves: Spawn[][]; bosses?: BossId[] }
export const ENCOUNTERS: Record<string, Encounter[]> = {
  street: [
    { trigger: 300, arena: [240, 720], waves: [[{ kind: 'vatnik' }, { kind: 'vatnik' }, { kind: 'vatnik' }], [{ kind: 'vatnik' }, { kind: 'vatnik' }, { kind: 'vatnik' }, { kind: 'vatnik', door: 630 }], [{ kind: 'vatnik' }, { kind: 'vatnik' }, { kind: 'omon' }, { kind: 'omon' }]] },
    { trigger: 1240, arena: [1180, 1660], waves: [[{ kind: 'vatnik', door: 1302 }, { kind: 'vatnik', door: 1302 }, { kind: 'vatnik' }, { kind: 'vatnik' }], [{ kind: 'omon' }, { kind: 'omon' }, { kind: 'vatnik' }, { kind: 'vatnik' }], [{ kind: 'vatnik' }, { kind: 'vatnik' }, { kind: 'vatnik' }, { kind: 'omon' }, { kind: 'omon' }]] },
    { trigger: 2150, arena: [2090, 2570], waves: [[{ kind: 'omon' }, { kind: 'omon' }, { kind: 'omon' }], [{ kind: 'omon' }, { kind: 'omon' }, { kind: 'vatnik' }, { kind: 'vatnik' }], [{ kind: 'omon' }, { kind: 'omon' }, { kind: 'omon' }, { kind: 'vatnik' }]] },
  ],
  yard: [
    { trigger: 360, arena: [300, 780], waves: [[{ kind: 'zek' }, { kind: 'zek' }, { kind: 'vatnik' }, { kind: 'vatnik' }], [{ kind: 'zek' }, { kind: 'zek' }, { kind: 'omon' }, { kind: 'omon' }], [{ kind: 'vatnik' }, { kind: 'vatnik' }, { kind: 'vatnik' }, { kind: 'zek' }, { kind: 'zek' }]] },
  ],
  vestibule: [
    { trigger: 700, arena: [640, 1120], waves: [[{ kind: 'omon_shield' }, { kind: 'omon' }, { kind: 'omon' }], [{ kind: 'omon' }, { kind: 'omon' }, { kind: 'omon' }, { kind: 'omon_shield' }], [{ kind: 'omon_shield' }, { kind: 'omon_shield' }, { kind: 'omon' }, { kind: 'omon' }]] },
  ],
  wagon: [
    { trigger: 960, arena: [900, 1380], waves: [[{ kind: 'vatnik' }, { kind: 'vatnik' }, { kind: 'zek' }, { kind: 'zek' }], [{ kind: 'zek' }, { kind: 'zek' }, { kind: 'zek' }, { kind: 'vatnik' }], [{ kind: 'vatnik' }, { kind: 'vatnik' }, { kind: 'vatnik' }, { kind: 'zek' }, { kind: 'omon' }]] },
  ],
  mayak: [
    // Один бой у сцены: волны идут на фоне концерта, потом Шаман спрыгивает со сцены (mr.R 01.11)
    { trigger: 740, arena: [700, 1180], waves: [[{ kind: 'clerk' }, { kind: 'vatnik' }, { kind: 'vatnik' }, { kind: 'vatnik' }], [{ kind: 'clerk' }, { kind: 'zek' }, { kind: 'zek' }, { kind: 'vatnik' }], [{ kind: 'clerk' }, { kind: 'clerk' }, { kind: 'vatnik' }, { kind: 'vatnik' }, { kind: 'zek' }]], bosses: ['shaman', 'pizdulina'] },
  ],
  city: [
    { trigger: 560, arena: [500, 980], waves: [[{ kind: 'info_m' }, { kind: 'info_m' }, { kind: 'info_f' }, { kind: 'info_f' }], [{ kind: 'info_m' }, { kind: 'info_f' }, { kind: 'omon' }, { kind: 'omon' }], [{ kind: 'info_m' }, { kind: 'info_m' }, { kind: 'info_f' }, { kind: 'info_f' }, { kind: 'omon' }]] },
    { trigger: 1660, arena: [1600, 2080], waves: [[{ kind: 'omon' }, { kind: 'omon' }, { kind: 'info_m' }, { kind: 'info_m' }], [{ kind: 'omon_shield' }, { kind: 'omon' }, { kind: 'omon' }, { kind: 'info_f' }], [{ kind: 'omon_shield' }, { kind: 'omon_shield' }, { kind: 'omon' }, { kind: 'omon' }, { kind: 'info_m' }]] },
  ],
  mfc: [
    { trigger: 660, arena: [600, 1080], waves: [[{ kind: 'info_f' }, { kind: 'info_f' }, { kind: 'clerk' }, { kind: 'clerk' }], [{ kind: 'info_m' }, { kind: 'info_m' }, { kind: 'vatnik' }, { kind: 'vatnik' }, { kind: 'clerk' }], [{ kind: 'info_f' }, { kind: 'info_f' }, { kind: 'info_m' }, { kind: 'info_m' }, { kind: 'clerk' }]] },
    { trigger: 2060, arena: [2000, 2480], waves: [[{ kind: 'clerk' }, { kind: 'clerk' }, { kind: 'zek' }, { kind: 'zek' }], [{ kind: 'info_m' }, { kind: 'info_f' }, { kind: 'clerk' }, { kind: 'vatnik' }, { kind: 'vatnik' }], [{ kind: 'clerk' }, { kind: 'clerk' }, { kind: 'clerk' }, { kind: 'zek' }, { kind: 'zek' }]] },
    { trigger: 3590, arena: [3530, 4010], waves: [[{ kind: 'omon' }, { kind: 'omon' }, { kind: 'omon_shield' }], [{ kind: 'omon' }, { kind: 'omon' }, { kind: 'omon' }, { kind: 'omon_shield' }], [{ kind: 'omon_shield' }, { kind: 'omon_shield' }, { kind: 'omon' }, { kind: 'omon' }, { kind: 'omon' }, { kind: 'omon' }]] },
  ],
};
