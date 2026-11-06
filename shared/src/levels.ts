import { ROUTE } from './route-data.ts';

export interface LaneZone { x0: number; x1: number; y1: number }
export interface StageLayer { file: string; fx?: 'tunnel' | 'train' }
export interface StageProp { file: string; x: number; y: number; scale?: number; flip?: boolean; depth?: number }
export interface TunnelFx { y0: number; y1: number; speed: number }
export interface TrainFx { y: number; h: number; arriveMs: number; standMs: number; leaveMs: number; emptyMs: number }
export interface Stage {
  id: string;
  cards: [string, string][];
  width: number;
  walkX?: [number, number];
  lane: [number, number][];
  laneBottom: number;
  spawn: [number, number];
  exit?: LaneZone;
  layers: StageLayer[];
  tunnel?: TunnelFx;
  train?: TrainFx;
  props: StageProp[];
  signs: never[];
}
export interface Level { id: 'route' | 'old'; stages: Stage[] }
export const LEVELS: Record<'route' | 'old', Level> = {
  route: { id: 'route', stages: ROUTE },
  old: { id: 'old', stages: [{ id: 'old', cards: [], width: 1920, lane: [[0, 168], [1920, 168]], laneBottom: 255, spawn: [80, 200], layers: [], props: [], signs: [] }] },
};

type Location = { level: 'route' | 'old'; stage: number };
export const stageOf = (w: Location): Stage => LEVELS[w.level].stages[w.stage];
export const stageProp = (w: Location, name: string): StageProp | undefined =>
  stageOf(w).props.find(p => p.file === `route/props/${name}.png`);
export const levelW = (w: Location): number => stageOf(w).width;
export const laneBottom = (w: Location): number => stageOf(w).laneBottom;
export function laneTop(w: Location, x: number): number {
  const pts = stageOf(w).lane;
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    if (x <= bx) return ay + (by - ay) * (x - ax) / (bx - ax);
  }
  return pts[pts.length - 1][1];
}
export const walkBounds = (w: Location): [number, number] => stageOf(w).walkX ?? [20, levelW(w) - 20];
export function clampToLane(w: Location, x: number, y: number): { x: number; y: number } {
  const [minX, maxX] = walkBounds(w);
  x = Math.max(minX, Math.min(maxX, x));
  return { x, y: Math.max(laneTop(w, x), Math.min(laneBottom(w), y)) };
}
