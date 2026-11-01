export type BossId = 'shaman' | 'pizdulina';
export interface BossAttack {
  id: string; windupMs: number; activeMs: number; recoverMs: number;
  kind: 'melee' | 'ring' | 'line' | 'shots' | 'zones' | 'summon';
  dmg: number; reach?: number; depth?: number; radius?: number; halfH?: number;
  count?: number; speed?: number; zoneR?: number; zoneMs?: number;
  summon?: { kind: string; n: number }[]; cdMs: number;
}
export interface BossInfo { name: string; hp: number; speed: number; phase2At: number; attacks: [string[], string[]]; kissLine?: string }
export const BOSS: Record<BossId, BossInfo> = {
  shaman: { name: 'ШАМАН', hp: 600, speed: 40, phase2At: 0.5, attacks: [['mic', 'vstayu'], ['mic', 'vstayu', 'chorus', 'fans']], kissLine: 'Я люблю только Катеньку' },
  pizdulina: { name: 'ПИЗДУЛИНА ЕКАТЕРИНА', hp: 520, speed: 46, phase2At: 0.5, attacks: [['slap', 'ban'], ['slap', 'ban', 'zones', 'omon']] },
};
export const BOSS_ATTACK: Record<string, BossAttack> = {
  mic: { id: 'mic', kind: 'melee', windupMs: 650, activeMs: 120, recoverMs: 500, dmg: 12, reach: 52, depth: 16, cdMs: 900 },
  vstayu: { id: 'vstayu', kind: 'ring', windupMs: 900, activeMs: 200, recoverMs: 700, dmg: 10, radius: 120, cdMs: 2500 },
  chorus: { id: 'chorus', kind: 'line', windupMs: 1000, activeMs: 450, recoverMs: 600, dmg: 14, halfH: 18, cdMs: 4000 },
  fans: { id: 'fans', kind: 'summon', windupMs: 800, activeMs: 100, recoverMs: 500, dmg: 0, summon: [{ kind: 'vatnik', n: 2 }], cdMs: 12000 },
  slap: { id: 'slap', kind: 'melee', windupMs: 550, activeMs: 100, recoverMs: 450, dmg: 11, reach: 46, depth: 14, cdMs: 800 },
  ban: { id: 'ban', kind: 'shots', windupMs: 700, activeMs: 300, recoverMs: 500, dmg: 9, count: 3, speed: 170, cdMs: 2200 },
  zones: { id: 'zones', kind: 'zones', windupMs: 900, activeMs: 2000, recoverMs: 500, dmg: 6, count: 3, zoneR: 34, zoneMs: 2000, cdMs: 5000 },
  omon: { id: 'omon', kind: 'summon', windupMs: 800, activeMs: 100, recoverMs: 500, dmg: 0, summon: [{ kind: 'omon', n: 2 }], cdMs: 14000 },
};
