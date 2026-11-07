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
  shaman: { name: 'ШАМАН', hp: 3500, speed: 40, phase2At: 0.5, attacks: [['mic', 'vstayu', 'pyro', 'chorus'], ['mic', 'vstayu', 'pyro', 'chorus', 'salute', 'crossStage', 'fans']], kissLine: 'Я люблю только Катеньку' },
  pizdulina: { name: 'ПИЗДУЛИНА', hp: 3000, speed: 46, phase2At: 0.5, attacks: [['slap', 'banStrike', 'shots', 'zones'], ['slap', 'banStrike', 'grid', 'crossBan', 'zones', 'shots', 'omon']] },
  katya: { name: 'КАТЯ', hp: 4000, speed: 58, phase2At: 0.5, attacks: [['katHeavy', 'katGround'], ['katHeavy2', 'katGround2', 'katRush']] },
};
export const BOSS_ATTACK: Record<string, BossAttack> = {
  mic: { id: 'mic', kind: 'melee', windupMs: 350, activeMs: 120, recoverMs: 200, dmg: 24, reach: 52, depth: 16, cdMs: 450 },
  vstayu: { id: 'vstayu', kind: 'ring', windupMs: 450, activeMs: 200, recoverMs: 280, dmg: 24, radius: 170, cdMs: 1250 },
  chorus: { id: 'chorus', kind: 'line', windupMs: 500, activeMs: 450, recoverMs: 240, dmg: 28, halfH: 16, cdMs: 2000 },
  pyro: { id: 'pyro', kind: 'pyro', windupMs: 450, activeMs: 1200, recoverMs: 240, dmg: 14, count: 5, zoneR: 26, cdMs: 1750 },
  salute: { id: 'salute', kind: 'salute', windupMs: 350, activeMs: 1080, recoverMs: 240, dmg: 18, count: 9, zoneR: 30, cdMs: 2000 },
  banStrike: { id: 'banStrike', kind: 'banStrike', windupMs: 450, activeMs: 150, recoverMs: 240, dmg: 26, zoneR: 40, cdMs: 1500 },
  grid: { id: 'grid', kind: 'grid', windupMs: 550, activeMs: 500, recoverMs: 240, dmg: 30, cdMs: 2000 },
  crossStage: { id: 'crossStage', kind: 'cross', windupMs: 525, activeMs: 300, recoverMs: 240, dmg: 28, depth: 15, reach: 42, cdMs: 2250 },
  crossBan: { id: 'crossBan', kind: 'cross', windupMs: 475, activeMs: 300, recoverMs: 240, dmg: 28, depth: 15, reach: 42, cdMs: 2100 },
  fans: { id: 'fans', kind: 'summon', windupMs: 400, activeMs: 100, recoverMs: 200, dmg: 0, summon: [{ kind: 'vatnik', n: 2 }], cdMs: 6000 },
  slap: { id: 'slap', kind: 'melee', windupMs: 350, activeMs: 100, recoverMs: 180, dmg: 22, reach: 46, depth: 14, cdMs: 400 },
  shots: { id: 'shots', kind: 'shots', windupMs: 350, activeMs: 400, recoverMs: 200, dmg: 18, count: 4, speed: 170, cdMs: 1100 },
  zones: { id: 'zones', kind: 'zones', windupMs: 450, activeMs: 2000, recoverMs: 200, dmg: 12, count: 4, zoneR: 34, zoneMs: 2000, cdMs: 2500 },
  omon: { id: 'omon', kind: 'summon', windupMs: 400, activeMs: 100, recoverMs: 200, dmg: 0, summon: [{ kind: 'omon', n: 2 }], cdMs: 7000 },
  katHeavy: { id: 'katHeavy', kind: 'melee', windupMs: 410, activeMs: 180, recoverMs: 275, dmg: 34, reach: 64, depth: 18, cdMs: 650 },
  katHeavy2: { id: 'katHeavy2', kind: 'melee', windupMs: 280, activeMs: 180, recoverMs: 175, dmg: 36, reach: 68, depth: 18, cdMs: 400 },
  katGround: { id: 'katGround', kind: 'ring', windupMs: 550, activeMs: 240, recoverMs: 300, dmg: 28, radius: 115, cdMs: 1650 },
  katGround2: { id: 'katGround2', kind: 'ring', windupMs: 380, activeMs: 240, recoverMs: 200, dmg: 30, radius: 135, cdMs: 1100 },
  katRush: { id: 'katRush', kind: 'melee', windupMs: 300, activeMs: 160, recoverMs: 150, dmg: 26, reach: 90, depth: 16, cdMs: 550 },
};
