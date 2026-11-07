import { settings } from './settings.ts';

type Bus = 'ui' | 'sfx' | 'amb' | 'music';
export interface SoundEntry { files: string[]; bus: Bus; vol: number; gap: number; loop?: boolean; pitch?: number; max?: number }
export interface PlayOptions { x?: number; vol?: number; delay?: number; rate?: number; loop?: boolean }
type Stop = () => void;
interface Stream { id: string; element: HTMLAudioElement; source: MediaElementAudioSourceNode; gain: GainNode }
const FADE_MS = 800;
const RETRY_MS = 5000;
const DB6 = 10 ** (-6 / 20), DB10 = 10 ** (-10 / 20);
const BASE = new URL('audio/', document.baseURI);
let ctx: AudioContext | null = null;
let master: GainNode | undefined;
const buses = {} as Record<Bus, GainNode>;
const manifest: Record<string, SoundEntry> = {};
const buffers = new Map<string, Promise<AudioBuffer | null>>();
const last = new Map<string, number>(), variants = new Map<string, number>();
const voices = new Map<string, Set<Stop>>();
const streams = new Set<Stream>();
const desired: Record<'music' | 'amb', string | null> = { music: null, amb: null };
const current: Partial<Record<'music' | 'amb', Stream>> = {};
let cameraX = 0, cameraWidth = 480, paused = false, fighting = false, unlocked = false;
let duckUntil = 0, duckTimer = 0, uiPreloaded = false, preview = false, menu = false;
let beforePreview: typeof desired | undefined;
const failedStreams = new Map<string, number>();
let manifestReady = false, manifestRetryAt = 0;
let manifestRequest: Promise<void> | undefined;
// Отсутствующий манифест или файл допустимы во время производства ассетов.
function ready(): Promise<void> {
  if (manifestReady || performance.now() < manifestRetryAt) return Promise.resolve();
  if (manifestRequest) return manifestRequest;
  manifestRequest = fetch(new URL('manifest.json', BASE)).then(async r => {
    if (!r.ok) throw new Error('manifest');
    const data: unknown = await r.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('manifest');
    for (const [id, value] of Object.entries(data)) {
      const d = value as SoundEntry;
      if (d && Array.isArray(d.files) && ['ui', 'sfx', 'amb', 'music'].includes(d.bus)) {
        manifest[id] = { ...d, files: d.files.filter(f => typeof f === 'string') };
      }
    }
    manifestReady = true;
  }).catch(() => { manifestRetryAt = performance.now() + RETRY_MS; })
    .finally(() => { manifestRequest = undefined; });
  return manifestRequest;
}
void ready();
const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
function ramp(node: GainNode, value: number, seconds = .05) {
  if (!ctx) return;
  const gain = node.gain, now = ctx.currentTime;
  gain.cancelScheduledValues(now); gain.setValueAtTime(gain.value, now);
  gain.linearRampToValueAtTime(value, now + seconds);
}
function applySettings() {
  if (!ctx || !master) return;
  ramp(master, settings.sound ? 1 : 0);
  ramp(buses.ui, settings.sounds / 100); ramp(buses.sfx, settings.sounds / 100);
  ramp(buses.music, settings.music / 100 * (paused && !preview ? DB10 : 1) * (performance.now() < duckUntil ? DB6 : 1));
  ramp(buses.amb, settings.ambience / 100 * (fighting ? DB6 : 1));
}
window.addEventListener('bc-settings-change', applySettings);

export function unlockAudio() {
  try {
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = 'playback';
    if (!ctx) {
      const AudioCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return;
      ctx = new AudioCtor(); master = ctx.createGain(); master.connect(ctx.destination);
      for (const bus of ['ui', 'sfx', 'amb', 'music'] as Bus[]) {
        buses[bus] = ctx.createGain(); buses[bus].connect(master);
      }
      applySettings();
    }
    unlocked = true;
    if (!uiPreloaded) { uiPreloaded = true; void preloadBank('ui'); }
    if (!document.hidden) {
      // Вызов resume остаётся синхронно внутри обработчика жеста.
      void ctx.resume().then(resumeMedia).catch(() => {});
      syncStream('music'); syncStream('amb');
      // play тоже вызывается в стеке жеста, даже если resume ещё не завершён.
      for (const bus of ['music', 'amb'] as const) {
        const stream = current[bus];
        if (stream && !(bus === 'amb' && paused && !preview)) startStream(stream, bus);
      }
    }
    void ready().then(() => { syncStream('music'); syncStream('amb'); });
  } catch { /* устройство без Web Audio остаётся без звука */ }
}
for (const gesture of ['pointerdown', 'touchend', 'keydown']) {
  document.addEventListener(gesture, unlockAudio, { capture: true, passive: true });
}
function variant(id: string, files: string[]) {
  const previous = variants.get(id) ?? -1;
  let n = Math.floor(Math.random() * files.length);
  if (files.length > 1 && n === previous) n = (n + 1 + Math.floor(Math.random() * (files.length - 1))) % files.length;
  variants.set(id, n); return files[n];
}
function buffer(file: string): Promise<AudioBuffer | null> {
  let cached = buffers.get(file);
  if (!cached) {
    cached = fetch(new URL(file, BASE)).then(async r => {
      if (!r.ok || !ctx) return null;
      return await ctx.decodeAudioData(await r.arrayBuffer());
    }).catch(() => null).then(data => {
      if (!data) buffers.delete(file);
      return data;
    });
    buffers.set(file, cached);
  }
  return cached;
}
export async function preloadBank(bank: 'ui' | 'game') {
  await ready();
  if (!ctx) return;
  const files = [...new Set(Object.values(manifest).filter(d => bank === 'ui' ? d.bus === 'ui' : d.bus === 'sfx').flatMap(d => d.files))];
  // Не запускаем сотню запросов одновременно.
  let index = 0;
  await Promise.all(Array.from({ length: Math.min(4, files.length) }, async () => {
    while (index < files.length) await buffer(files[index++]);
  }));
}
export function setAudioCamera(x: number, width: number) { cameraX = x; cameraWidth = width; }
export function play(id: string, opts: PlayOptions = {}): Stop {
  let cancelled = false, source: AudioBufferSourceNode | undefined, gain: GainNode | undefined, pan: StereoPannerNode | undefined;
  const stop = () => {
    cancelled = true;
    try { source?.stop(); } catch { /* уже закончился */ }
    source?.disconnect(); gain?.disconnect(); pan?.disconnect(); voices.get(id)?.delete(stop);
  };
  const requested = performance.now();
  void ready().then(async () => {
    const d = manifest[id];
    if (cancelled || !d?.files.length || (!settings.sound && !(opts.loop ?? d.loop)) || !ctx || ctx.state !== 'running' || document.hidden) return;
    if (d.bus === 'music') { playMusic(id); return; }
    if (d.bus === 'amb') { playAmb(id); return; }
    const active = voices.get(id) ?? new Set<Stop>(); voices.set(id, active);
    if (requested - (last.get(id) ?? -Infinity) < (d.gap ?? 0) || active.size >= (d.max ?? 3)) return;
    last.set(id, requested); active.add(stop);
    const data = await buffer(variant(id, d.files));
    if (cancelled || !data || !ctx || ctx.state !== 'running' || document.hidden || performance.now() - requested > 1000) { stop(); return; }
    source = ctx.createBufferSource(); gain = ctx.createGain(); source.buffer = data;
    source.loop = opts.loop ?? d.loop ?? false;
    const spread = d.pitch ?? (d.bus === 'sfx' ? .03 : 0);
    source.playbackRate.value = Math.max(.1, (opts.rate ?? 1) + (Math.random() * 2 - 1) * spread);
    const offscreen = opts.x !== undefined && (opts.x < cameraX - 200 || opts.x > cameraX + cameraWidth + 200);
    gain.gain.value = clamp(d.vol ?? 1) * Math.max(0, opts.vol ?? 1) * (offscreen ? .5 : 1);
    source.connect(gain);
    if (opts.x !== undefined && ctx.createStereoPanner) {
      pan = ctx.createStereoPanner(); pan.pan.value = clamp((opts.x - cameraX - cameraWidth / 2) / (cameraWidth / 2), -1, 1) * .4;
      gain.connect(pan).connect(buses[d.bus]);
    } else gain.connect(buses[d.bus]);
    source.onended = stop; source.start(ctx.currentTime + Math.max(0, opts.delay ?? 0) / 1000);
  }).catch(stop);
  return stop;
}
export function stopSound(id: string) {
  for (const stop of [...(voices.get(id) ?? [])]) stop();
  if (desired.music === id) playMusic(null);
  if (desired.amb === id) playAmb(null);
}
function dispose(s: Stream) {
  if (!streams.has(s)) return;
  streams.delete(s); s.element.pause(); s.element.removeAttribute('src'); s.element.load();
  s.source.disconnect(); s.gain.disconnect();
}
function fadeOut(s: Stream) {
  ramp(s.gain, 0, FADE_MS / 1000);
  window.setTimeout(() => dispose(s), FADE_MS);
}
function startStream(s: Stream, bus: 'music' | 'amb') {
  void s.element.play().then(() => {
    if (current[bus] === s && ctx?.state === 'running' && !document.hidden && !(bus === 'amb' && paused && !preview)) ramp(s.gain, clamp(manifest[s.id]?.vol ?? 1), FADE_MS / 1000);
    else if (current[bus] === s || document.hidden) s.element.pause();
  }).catch(() => {});
}
function resumeMedia() {
  if (!ctx || ctx.state !== 'running' || document.hidden) return;
  for (const bus of ['music', 'amb'] as const) {
    const s = current[bus];
    if (s && !(bus === 'amb' && paused && !preview)) startStream(s, bus);
  }
}
function syncStream(bus: 'music' | 'amb') {
  const id = desired[bus];
  if (!unlocked || !ctx || document.hidden || (id && bus === 'amb' && paused && !preview)) return;
  if (current[bus]?.id === id) return;
  const old = current[bus]; delete current[bus];
  if (old) fadeOut(old);
  if (!id) return;
  const d = manifest[id];
  if (!d?.files.length || d.bus !== bus || (failedStreams.get(id) ?? 0) > performance.now()) return;
  try {
    const element = new Audio(); element.preload = 'none'; element.loop = true;
    element.src = new URL(variant(id, d.files), BASE).href;
    const source = ctx.createMediaElementSource(element), gain = ctx.createGain();
    gain.gain.value = 0; source.connect(gain).connect(buses[bus]);
    const s: Stream = { id, element, source, gain }; streams.add(s); current[bus] = s;
    element.addEventListener('error', () => {
      failedStreams.set(id, performance.now() + RETRY_MS);
      if (current[bus] === s) delete current[bus];
      dispose(s);
    }, { once: true });
    if (ctx.state === 'running') startStream(s, bus);
  } catch { /* неподдерживаемый формат или media source */ }
}
function requestStream(bus: 'music' | 'amb', id: string | null) {
  desired[bus] = id;
  void ready().then(() => syncStream(bus));
}
export const playMusic = (id: string | null) => requestStream('music', id);
export const playAmb = (id: string | null) => requestStream('amb', id);
export function duckMusic() {
  duckUntil = performance.now() + 600; clearTimeout(duckTimer); applySettings();
  duckTimer = window.setTimeout(applySettings, 610);
}
export function setCombat(on: boolean) { if (fighting !== on) { fighting = on; applySettings(); } }
export function setAudioPaused(on: boolean) {
  if (paused === on) return;
  paused = on; applySettings();
  if (on) for (const s of streams) { if (manifest[s.id]?.bus === 'amb') s.element.pause(); }
  else { syncStream('amb'); resumeMedia(); }
}
document.addEventListener('visibilitychange', () => {
  if (!ctx || !unlocked) return;
  if (document.hidden) {
    for (const s of streams) s.element.pause();
    void ctx.suspend().catch(() => {});
  } else void ctx.resume().then(() => { applySettings(); syncStream('music'); syncStream('amb'); resumeMedia(); }).catch(() => {});
});
export function setAudioMenu(on: boolean) { menu = on; if (on) { playMusic('music_menu'); playAmb(null); void preloadBank('ui'); } }
export function isAudioMenu() { return menu; }
export function isAudioPreview() { return preview; }
export function setAudioPreview(on: boolean) {
  if (preview === on) return;
  if (on) { beforePreview = { ...desired }; preview = true; playMusic(null); playAmb(null); }
  else {
    preview = false;
    for (const stops of voices.values()) for (const stop of [...stops]) stop();
    playMusic(beforePreview?.music ?? null); playAmb(beforePreview?.amb ?? null); beforePreview = undefined;
  }
  applySettings();
}
export async function soundManifest() { await ready(); return manifest; }
export function audioState() { return ctx?.state ?? 'нет'; }
