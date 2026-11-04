import type { BossId } from './boss-data.ts';
import type { EnemyKind } from './enemy-data.ts';
export interface Spawn { kind: EnemyKind; door?: number }
export interface Encounter { trigger: number; arena: [number, number]; waves: Spawn[][]; bosses?: BossId[] }
const BASE_ENCOUNTERS: Record<string, Encounter[]> = {
  street: [
    { trigger: 300, arena: [240, 720], waves: [[{ kind: 'vatnik' }, { kind: 'vatnik' }, { kind: 'vatnik' }], [{ kind: 'vatnik' }, { kind: 'vatnik' }, { kind: 'vatnik' }, { kind: 'vatnik', door: 630 }], [{ kind: 'vatnik' }, { kind: 'vatnik' }, { kind: 'omon' }, { kind: 'omon' }]] },
    { trigger: 1240, arena: [1180, 1660], waves: [[{ kind: 'vatnik', door: 1302 }, { kind: 'vatnik', door: 1302 }, { kind: 'vatnik' }, { kind: 'vatnik' }], [{ kind: 'omon' }, { kind: 'omon' }, { kind: 'vatnik' }, { kind: 'vatnik' }], [{ kind: 'vatnik' }, { kind: 'vatnik' }, { kind: 'vatnik' }, { kind: 'omon' }, { kind: 'omon' }]] },
    { trigger: 2150, arena: [2090, 2570], waves: [[{ kind: 'omon' }, { kind: 'omon' }, { kind: 'omon' }], [{ kind: 'omon' }, { kind: 'omon' }, { kind: 'vatnik' }, { kind: 'vatnik' }], [{ kind: 'omon' }, { kind: 'omon' }, { kind: 'omon' }, { kind: 'vatnik' }]] },
  ],
  yard: [
    { trigger: 360, arena: [300, 780], waves: [[{ kind: 'omon' }, { kind: 'omon' }, { kind: 'vatnik' }, { kind: 'vatnik' }], [{ kind: 'vatnik' }, { kind: 'vatnik' }, { kind: 'omon' }, { kind: 'omon' }], [{ kind: 'vatnik' }, { kind: 'vatnik' }, { kind: 'vatnik' }, { kind: 'omon' }, { kind: 'omon' }]] },
  ],
  vestibule: [
    { trigger: 450, arena: [390, 870], waves: [[{ kind: 'omon_shield' }, { kind: 'omon' }, { kind: 'omon' }], [{ kind: 'omon' }, { kind: 'omon' }, { kind: 'omon' }, { kind: 'omon_shield' }], [{ kind: 'omon_shield' }, { kind: 'omon_shield' }, { kind: 'omon' }, { kind: 'omon' }]] },
  ],
  wagon: [
    { trigger: 500, arena: [440, 920], waves: [[{ kind: 'vatnik' }, { kind: 'vatnik' }, { kind: 'zek' }, { kind: 'zek' }], [{ kind: 'zek' }, { kind: 'zek' }, { kind: 'zek' }, { kind: 'vatnik' }], [{ kind: 'vatnik' }, { kind: 'vatnik' }, { kind: 'vatnik' }, { kind: 'zek' }, { kind: 'omon' }]] },
  ],
  mayak: [
    // Один бой у сцены: волны идут на фоне концерта, потом Шаман спрыгивает со сцены (mr.R 01.11)
    { trigger: 660, arena: [700, 1180], waves: [[{ kind: 'clerk' }, { kind: 'vatnik' }, { kind: 'vatnik' }, { kind: 'vatnik' }], [{ kind: 'clerk' }, { kind: 'zek' }, { kind: 'zek' }, { kind: 'vatnik' }], [{ kind: 'clerk' }, { kind: 'clerk' }, { kind: 'vatnik' }, { kind: 'vatnik' }, { kind: 'zek' }]], bosses: ['shaman', 'pizdulina'] },
  ],
  city: [
    { trigger: 560, arena: [500, 980], waves: [[{ kind: 'info_m' }, { kind: 'info_m' }, { kind: 'info_f' }, { kind: 'info_f' }], [{ kind: 'info_m' }, { kind: 'info_f' }, { kind: 'omon' }, { kind: 'omon' }], [{ kind: 'info_m' }, { kind: 'info_m' }, { kind: 'info_f' }, { kind: 'info_f' }, { kind: 'omon' }]] },
    { trigger: 1400, arena: [1340, 1820], waves: [[{ kind: 'omon' }, { kind: 'omon' }, { kind: 'info_m' }, { kind: 'info_m' }], [{ kind: 'omon_shield' }, { kind: 'omon' }, { kind: 'omon' }, { kind: 'info_f' }], [{ kind: 'omon_shield' }, { kind: 'omon_shield' }, { kind: 'omon' }, { kind: 'omon' }, { kind: 'info_m' }]] },
  ],
  mfc: [
    { trigger: 440, arena: [380, 860], waves: [[{ kind: 'info_f' }, { kind: 'info_f' }, { kind: 'clerk' }, { kind: 'clerk' }], [{ kind: 'info_m' }, { kind: 'info_m' }, { kind: 'vatnik' }, { kind: 'vatnik' }, { kind: 'clerk' }], [{ kind: 'info_f' }, { kind: 'info_f' }, { kind: 'info_m' }, { kind: 'info_m' }, { kind: 'clerk' }]] },
    { trigger: 1600, arena: [1540, 2020], waves: [[{ kind: 'clerk' }, { kind: 'clerk' }, { kind: 'zek' }, { kind: 'zek' }], [{ kind: 'info_m' }, { kind: 'info_f' }, { kind: 'clerk' }, { kind: 'vatnik' }, { kind: 'vatnik' }], [{ kind: 'clerk' }, { kind: 'clerk' }, { kind: 'clerk' }, { kind: 'zek' }, { kind: 'zek' }]] },
    { trigger: 2550, arena: [2490, 2970], waves: [[{ kind: 'omon' }, { kind: 'omon' }, { kind: 'omon_shield' }, { kind: 'omon_shield' }]], bosses: ['katya'] },
  ],
};

// Состав каждой волны остаётся сюжетным; пополнение растягивает бой без пустой арены.
const heavy = (spawn: Spawn) => spawn.kind === 'clerk' || spawn.kind === 'omon_shield';
export const ENCOUNTERS: Record<string, Encounter[]> = Object.fromEntries(
  Object.entries(BASE_ENCOUNTERS).map(([stage, encounters]) => [stage, encounters.map((encounter, index) => {
    const sizes = stage === 'mfc' && index === 2 ? [4]
      : stage === 'street' && index === 0 ? [6, 4, 4]
      : ['mayak', 'city', 'mfc'].includes(stage) ? [10, 8, 6]
      : stage === 'wagon' ? [8, 7, 6] : [8, 6, 5];
    return { ...encounter, waves: encounter.waves.map((wave, n) => {
      let heavyCount = 0;
      const base = wave.map(spawn => stage === 'mfc' && heavy(spawn) && heavyCount++ >= 2 ? { kind: 'omon' as const } : { ...spawn });
      const light = base.filter(spawn => !heavy(spawn));
      const fillers = light.length ? light : base;
      return Array.from({ length: sizes[n] ?? 5 }, (_, i) => ({ ...(i < base.length ? base[i] : fillers[(i - base.length) % fillers.length]) }));
    }) };
  })]),
);
