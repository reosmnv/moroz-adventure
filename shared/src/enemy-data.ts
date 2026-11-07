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
  grunt: { hp: 120, speed: 60, dmg: 12, windupMs: 200, activeMs: 100, recoverMs: 125, reach: 40, depth: 14, cdMs: 275 },
  tank:  { hp: 250, speed: 42, dmg: 22, windupMs: 325, activeMs: 120, recoverMs: 200, reach: 46, depth: 16, cdMs: 450, armor: true },
  fast:  { hp: 85, speed: 95, dmg: 10, windupMs: 225, activeMs: 340, recoverMs: 150, reach: 0, depth: 14, cdMs: 325, dash: { dist: 130, speed: 380 } },
};
export interface KindInfo { role: EnemyRole; hpMult?: number; guard?: boolean; name: string }
export const KIND: Record<EnemyKind, KindInfo> = {
  omon:        { role: 'grunt', name: 'ОМОН' },
  omon_shield: { role: 'tank', hpMult: 1.2, guard: true, name: 'ОМОН со щитом' },
  vatnik:      { role: 'grunt', hpMult: 1.1, name: 'Ватник' },
  zek:         { role: 'fast', name: 'Зэк' },
  clerk:       { role: 'tank', name: 'Чиновник' },
  info_m:      { role: 'fast', hpMult: 0.9, name: 'Инфоцыган' },
  info_f:      { role: 'grunt', hpMult: 0.9, name: 'Инфоцыганка' },
};
export const MAX_ALIVE = 10;
export const MAX_PEAK_ALIVE = 12;
export const TOKENS_PER_TARGET = 2;
export const TOKENS_TOTAL = 6;
export const TOKEN_GAP_MS = 180;        // после освобождения следующий по той же цели не раньше
export const WAIT_RING: [number, number] = [70, 100]; // ожидающие держатся на таком расстоянии по x
export const GUARD_FRONT_MULT = 0.3;    // щит спереди: доля урона от обычных ударов
