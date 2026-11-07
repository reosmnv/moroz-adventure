import { settings } from './settings.ts';

// Звук для проверки разблокировки на iPhone: контекст создаётся по первому касанию
let ctx: AudioContext | null = null;
let output: GainNode | null = null;
const last = new Map<string, number>();
window.addEventListener('bc-settings-change', () => {
  if (ctx && output) output.gain.setValueAtTime(settings.sound ? 1 : 0, ctx.currentTime);
});

export function unlockAudio() {
  if (ctx?.state === 'running') return;
  // Без этого Web Audio молчит при включённом беззвучном режиме iPhone
  const nav = navigator as any;
  if (nav.audioSession) nav.audioSession.type = 'playback';
  if (!ctx) {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    output = ctx!.createGain(); output.gain.value = settings.sound ? 1 : 0;
    output.connect(ctx!.destination);
  }
  if (ctx.state !== 'running') void ctx.resume().catch(() => { /* повторим на следующем жесте */ });
}

for (const gesture of ['pointerdown', 'touchend', 'keydown']) {
  document.addEventListener(gesture, unlockAudio, { capture: true, passive: true });
}

export function beep(freq: number, dur: number) {
  if (!settings.sound || !ctx || ctx.state !== 'running') return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'square';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.08, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  o.connect(g).connect(output!);
  o.start();
  o.stop(ctx.currentTime + dur);
}

type Sound = 'hit' | 'hurt' | 'block' | 'shot' | 'danger' | 'ult' | 'bossDown' | 'heal' | 'dash';
const SOUND: Record<Sound, { freq: number; end: number; dur: number; type: OscillatorType; gain: number; gap: number }> = {
  hit:      { freq: 190, end: 95,  dur: .055, type: 'square',   gain: .07, gap: 45 },
  hurt:     { freq: 120, end: 65,  dur: .12,  type: 'sawtooth', gain: .07, gap: 80 },
  block:    { freq: 720, end: 260, dur: .09,  type: 'square',   gain: .045, gap: 100 },
  shot:     { freq: 980, end: 420, dur: .045, type: 'square',   gain: .035, gap: 55 },
  danger:   { freq: 310, end: 430, dur: .16,  type: 'triangle', gain: .04, gap: 180 },
  ult:      { freq: 180, end: 760, dur: .32,  type: 'sawtooth', gain: .055, gap: 250 },
  bossDown: { freq: 260, end: 52,  dur: .48,  type: 'sawtooth', gain: .07, gap: 500 },
  heal:     { freq: 520, end: 880, dur: .18,  type: 'sine',     gain: .045, gap: 120 },
  dash:     { freq: 1300,end: 260, dur: .07,  type: 'sawtooth', gain: .035, gap: 80 },
};

// Короткие синтезированные сигналы. Лимит по имени не даёт толпе и серии
// Рамиля превратить попадания в непрерывный писк.
export function sfx(name: Sound) {
  if (!settings.sound || !ctx || ctx.state !== 'running') return;
  const d = SOUND[name], nowMs = performance.now();
  if (nowMs - (last.get(name) ?? -Infinity) < d.gap) return;
  last.set(name, nowMs);
  const now = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = d.type; o.frequency.setValueAtTime(d.freq, now);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, d.end), now + d.dur);
  g.gain.setValueAtTime(d.gain, now);
  g.gain.exponentialRampToValueAtTime(.001, now + d.dur);
  o.connect(g).connect(output!); o.start(now); o.stop(now + d.dur);
}

export function audioState() { return ctx?.state ?? 'нет'; }
