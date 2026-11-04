export type BossId = 'shaman' | 'pizdulina' | 'katya';
export interface BossAttack {
  id: string; windupMs: number; activeMs: number; recoverMs: number;
  kind: 'melee' | 'ring' | 'line' | 'shots' | 'zones' | 'summon' | 'pyro' | 'salute' | 'banStrike' | 'grid' | 'cross';
  dmg: number; reach?: number; depth?: number; radius?: number; halfH?: number;
  count?: number; speed?: number; zoneR?: number; zoneMs?: number;
  summon?: { kind: string; n: number }[]; cdMs: number;
}
export interface BossInfo { name: string; hp: number; speed: number; phase2At: number; attacks: [string[], string[]]; kissLine?: string }
export const BOSS: Record<BossId, BossInfo> = {
  shaman: { name: 'ШАМАН', hp: 1400, speed: 40, phase2At: 0.5, attacks: [['mic', 'vstayu', 'pyro', 'chorus'], ['mic', 'vstayu', 'pyro', 'chorus', 'salute', 'crossStage', 'fans']], kissLine: 'Я люблю только Катеньку' },
  pizdulina: { name: 'ПИЗДУЛИНА', hp: 1200, speed: 46, phase2At: 0.5, attacks: [['slap', 'banStrike', 'shots', 'zones'], ['slap', 'banStrike', 'grid', 'crossBan', 'zones', 'shots', 'omon']] },
  katya: { name: 'КАТЯ', hp: 1600, speed: 58, phase2At: 0.5, attacks: [['katHeavy', 'katGround'], ['katHeavy2', 'katGround2', 'katRush']] },
};
export const BOSS_ATTACK: Record<string, BossAttack> = {
  mic: { id: 'mic', kind: 'melee', windupMs: 700, activeMs: 120, recoverMs: 400, dmg: 12, reach: 52, depth: 16, cdMs: 900 },
  vstayu: { id: 'vstayu', kind: 'ring', windupMs: 900, activeMs: 200, recoverMs: 560, dmg: 12, radius: 170, cdMs: 2500 },
  chorus: { id: 'chorus', kind: 'line', windupMs: 1000, activeMs: 450, recoverMs: 480, dmg: 14, halfH: 16, cdMs: 4000 },
  pyro: { id: 'pyro', kind: 'pyro', windupMs: 900, activeMs: 1200, recoverMs: 480, dmg: 7, count: 5, zoneR: 26, cdMs: 3500 },
  salute: { id: 'salute', kind: 'salute', windupMs: 700, activeMs: 1080, recoverMs: 480, dmg: 9, count: 9, zoneR: 30, cdMs: 4000 },
  banStrike: { id: 'banStrike', kind: 'banStrike', windupMs: 900, activeMs: 150, recoverMs: 480, dmg: 13, zoneR: 40, cdMs: 3000 },
  grid: { id: 'grid', kind: 'grid', windupMs: 1100, activeMs: 500, recoverMs: 480, dmg: 15, cdMs: 4000 },
  crossStage: { id: 'crossStage', kind: 'cross', windupMs: 1050, activeMs: 300, recoverMs: 480, dmg: 14, depth: 15, reach: 42, cdMs: 4500 },
  crossBan: { id: 'crossBan', kind: 'cross', windupMs: 950, activeMs: 300, recoverMs: 480, dmg: 14, depth: 15, reach: 42, cdMs: 4200 },
  fans: { id: 'fans', kind: 'summon', windupMs: 800, activeMs: 100, recoverMs: 400, dmg: 0, summon: [{ kind: 'vatnik', n: 2 }], cdMs: 12000 },
  slap: { id: 'slap', kind: 'melee', windupMs: 700, activeMs: 100, recoverMs: 360, dmg: 11, reach: 46, depth: 14, cdMs: 800 },
  shots: { id: 'shots', kind: 'shots', windupMs: 700, activeMs: 400, recoverMs: 400, dmg: 9, count: 4, speed: 170, cdMs: 2200 },
  zones: { id: 'zones', kind: 'zones', windupMs: 900, activeMs: 2000, recoverMs: 400, dmg: 6, count: 4, zoneR: 34, zoneMs: 2000, cdMs: 5000 },
  omon: { id: 'omon', kind: 'summon', windupMs: 800, activeMs: 100, recoverMs: 400, dmg: 0, summon: [{ kind: 'omon', n: 2 }], cdMs: 14000 },
  katHeavy: { id: 'katHeavy', kind: 'melee', windupMs: 820, activeMs: 180, recoverMs: 550, dmg: 17, reach: 64, depth: 18, cdMs: 1300 },
  katHeavy2: { id: 'katHeavy2', kind: 'melee', windupMs: 560, activeMs: 180, recoverMs: 350, dmg: 18, reach: 68, depth: 18, cdMs: 800 },
  katGround: { id: 'katGround', kind: 'ring', windupMs: 1100, activeMs: 240, recoverMs: 600, dmg: 14, radius: 115, cdMs: 3300 },
  katGround2: { id: 'katGround2', kind: 'ring', windupMs: 760, activeMs: 240, recoverMs: 400, dmg: 15, radius: 135, cdMs: 2200 },
  katRush: { id: 'katRush', kind: 'melee', windupMs: 600, activeMs: 160, recoverMs: 300, dmg: 13, reach: 90, depth: 16, cdMs: 1100 },
};
