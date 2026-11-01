export type EnemyRole = 'grunt' | 'tank' | 'fast';
export type EnemyKind = 'omon' | 'omon_shield' | 'vatnik' | 'zek' | 'clerk' | 'info_m' | 'info_f';
export interface RoleStats {
  hp: number; speed: number; dmg: number;
  windupMs: number;   // замах: урона нет, враг стоит, направление и y зафиксированы
  activeMs: number;   // опасная часть
  recoverMs: number;  // открытое восстановление, урона нет
  reach: number;      // дальность по x от центра врага
  depth: number;      // допуск по y для попадания (меньше, чем у героев: от удара можно уйти по глубине)
  cdMs: number;       // пауза после восстановления до следующего запроса атаки
  armor?: boolean;    // не прерывается обычными попаданиями (см. R4)
  dash?: { dist: number; speed: number }; // быстрый: удар = рывок по x
}
export const ROLE: Record<EnemyRole, RoleStats> = {
  grunt: { hp: 40, speed: 45, dmg: 7,  windupMs: 450, activeMs: 100, recoverMs: 350, reach: 40, depth: 14, cdMs: 900 },
  tank:  { hp: 90, speed: 32, dmg: 14, windupMs: 750, activeMs: 120, recoverMs: 550, reach: 46, depth: 16, cdMs: 1300, armor: true },
  fast:  { hp: 28, speed: 75, dmg: 6,  windupMs: 550, activeMs: 340, recoverMs: 450, reach: 0,  depth: 14, cdMs: 1100, dash: { dist: 130, speed: 380 } },
};
export interface KindInfo { role: EnemyRole; hpMult?: number; guard?: boolean; name: string }
export const KIND: Record<EnemyKind, KindInfo> = {
  omon:        { role: 'grunt', name: 'ОМОН' },
  omon_shield: { role: 'tank', guard: true, name: 'ОМОН со щитом' },
  vatnik:      { role: 'grunt', hpMult: 1.1, name: 'Ватник' },
  zek:         { role: 'fast', name: 'Зэк' },
  clerk:       { role: 'tank', name: 'Чиновник' },
  info_m:      { role: 'fast', hpMult: 0.9, name: 'Инфоцыган' },
  info_f:      { role: 'grunt', hpMult: 0.9, name: 'Инфоцыганка' },
};
export const DUO_HP_MULT = 1.3;        // два и больше живых игрока на связи
export const MAX_ALIVE = { solo: 3, duo: 4 };
export const TOKENS_PER_TARGET = 1;     // одновременно замахивается/бьёт одну героиню не больше 1 врага
export const TOKENS_TOTAL = 2;          // и не больше 2 на всю команду
export const TOKEN_GAP_MS = 250;        // после освобождения следующий по той же цели не раньше
export const WAIT_RING: [number, number] = [70, 100]; // ожидающие держатся на таком расстоянии по x
export const GUARD_FRONT_MULT = 0.3;    // щит спереди: доля урона от обычных ударов
