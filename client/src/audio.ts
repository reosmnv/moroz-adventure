// Звук для проверки разблокировки на iPhone: контекст создаётся по первому касанию
let ctx: AudioContext | null = null;

export function unlockAudio() {
  // Без этого Web Audio молчит при включённом беззвучном режиме iPhone
  const nav = navigator as any;
  if (nav.audioSession) nav.audioSession.type = 'playback';
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (ctx.state !== 'running') ctx.resume();
}

export function beep(freq: number, dur: number) {
  if (!ctx || ctx.state !== 'running') return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'square';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.08, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  o.connect(g).connect(ctx.destination);
  o.start();
  o.stop(ctx.currentTime + dur);
}

export function audioState() { return ctx?.state ?? 'нет'; }
