export type BossId = 'shaman' | 'pizdulina';
export interface BossAttack {
  id: string; windupMs: number; activeMs: number; recoverMs: number;
  kind: 'melee' | 'ring' | 'line' | 'shots' | 'zones' | 'summon' | 'pyro' | 'salute' | 'banStrike' | 'grid';
  dmg: number; reach?: number; depth?: number; radius?: number; halfH?: number;
  count?: number; speed?: number; zoneR?: number; zoneMs?: number;
  summon?: { kind: string; n: number }[]; cdMs: number;
}
export interface BossInfo { name: string; hp: number; speed: number; phase2At: number; attacks: [string[], string[]]; kissLine?: string }
export const BOSS: Record<BossId, BossInfo> = {
  shaman: { name: 'ШАМАН', hp: 1400, speed: 40, phase2At: 0.5, attacks: [['mic', 'vstayu', 'pyro'], ['mic', 'vstayu', 'pyro', 'chorus', 'salute', 'fans']], kissLine: 'Я люблю только Катеньку' },
  pizdulina: { name: 'ПИЗДУЛИНА ЕКАТЕРИНА', hp: 1200, speed: 46, phase2At: 0.5, attacks: [['slap', 'banStrike', 'shots'], ['slap', 'banStrike', 'grid', 'zones', 'omon']] },
};
export const BOSS_ATTACK: Record<string, BossAttack> = {
  mic: { id: 'mic', kind: 'melee', windupMs: 700, activeMs: 120, recoverMs: 500, dmg: 12, reach: 52, depth: 16, cdMs: 900 },
  vstayu: { id: 'vstayu', kind: 'ring', windupMs: 900, activeMs: 200, recoverMs: 700, dmg: 12, radius: 170, cdMs: 2500 },
  chorus: { id: 'chorus', kind: 'line', windupMs: 1000, activeMs: 450, recoverMs: 600, dmg: 14, halfH: 16, cdMs: 4000 },
  pyro: { id: 'pyro', kind: 'pyro', windupMs: 900, activeMs: 1200, recoverMs: 600, dmg: 7, count: 5, zoneR: 26, cdMs: 3500 },
  salute: { id: 'salute', kind: 'salute', windupMs: 700, activeMs: 1080, recoverMs: 600, dmg: 9, count: 9, zoneR: 30, cdMs: 4000 },
  banStrike: { id: 'banStrike', kind: 'banStrike', windupMs: 900, activeMs: 150, recoverMs: 600, dmg: 13, zoneR: 40, cdMs: 3000 },
  grid: { id: 'grid', kind: 'grid', windupMs: 1100, activeMs: 500, recoverMs: 600, dmg: 15, cdMs: 4000 },
  fans: { id: 'fans', kind: 'summon', windupMs: 800, activeMs: 100, recoverMs: 500, dmg: 0, summon: [{ kind: 'vatnik', n: 2 }], cdMs: 12000 },
  slap: { id: 'slap', kind: 'melee', windupMs: 700, activeMs: 100, recoverMs: 450, dmg: 11, reach: 46, depth: 14, cdMs: 800 },
  shots: { id: 'shots', kind: 'shots', windupMs: 700, activeMs: 400, recoverMs: 500, dmg: 9, count: 4, speed: 170, cdMs: 2200 },
  zones: { id: 'zones', kind: 'zones', windupMs: 900, activeMs: 2000, recoverMs: 500, dmg: 6, count: 4, zoneR: 34, zoneMs: 2000, cdMs: 5000 },
  omon: { id: 'omon', kind: 'summon', windupMs: 800, activeMs: 100, recoverMs: 500, dmg: 0, summon: [{ kind: 'omon', n: 2 }], cdMs: 14000 },
};
