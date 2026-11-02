import { settings } from './settings.ts';

// Звук для проверки разблокировки на iPhone: контекст создаётся по первому касанию
let ctx: AudioContext | null = null;
let output: GainNode | null = null;
window.addEventListener('bc-settings-change', () => {
  if (ctx && output) output.gain.setValueAtTime(settings.sound ? 1 : 0, ctx.currentTime);
});

export function unlockAudio() {
  // Без этого Web Audio молчит при включённом беззвучном режиме iPhone
  const nav = navigator as any;
  if (nav.audioSession) nav.audioSession.type = 'playback';
  if (!ctx) {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    output = ctx!.createGain(); output.gain.value = settings.sound ? 1 : 0;
    output.connect(ctx!.destination);
  }
  if (ctx.state !== 'running') ctx.resume();
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

export function audioState() { return ctx?.state ?? 'нет'; }
