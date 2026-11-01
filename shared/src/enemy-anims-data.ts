// Генерирует tools/gen_enemy_anims.py (Claude). Пока пусто: враги рисуются прямоугольниками.
export interface EnemyClip { frames: number; fps: number; loop: boolean; hit?: number }
export const ENEMY_ANIMS: Partial<Record<string, Record<string, EnemyClip>>> = {};
