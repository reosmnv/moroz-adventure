import type * as Phaser from 'phaser';

export interface Settings { sound: boolean; flashes: 'full' | 'soft' | 'off'; shake: boolean }
const KEY = 'bc-settings';
const DEFAULTS: Settings = { sound: true, flashes: 'soft', shake: true };
function load(): Settings {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return { sound: typeof value?.sound === 'boolean' ? value.sound : DEFAULTS.sound,
      flashes: ['full', 'soft', 'off'].includes(value?.flashes) ? value.flashes : DEFAULTS.flashes,
      shake: typeof value?.shake === 'boolean' ? value.shake : DEFAULTS.shake };
  } catch { return { ...DEFAULTS }; }
}
export const settings = load();
export function updateSettings(patch: Partial<Settings>) {
  Object.assign(settings, patch);
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* настройки действуют до перезагрузки */ }
  window.dispatchEvent(new Event('bc-settings-change'));
}
export function shake(camera: Phaser.Cameras.Scene2D.Camera, duration: number, intensity: number) {
  if (settings.shake) camera.shake(duration, intensity);
}
