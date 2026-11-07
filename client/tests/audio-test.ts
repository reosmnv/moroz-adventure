// Механические проверки без браузера и аудиоустройства.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let now = 1000, timerId = 0, contexts = 0;
const timers = new Map<number, { at: number; run: () => void }>();
const flush = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
const advance = async (ms = 1000) => {
  now += ms;
  for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.run(); }
  await flush();
};
class Param {
  value = 1;
  ramps: { value: number; at: number }[] = [];
  cancelScheduledValues() {}
  setValueAtTime(value: number) { this.value = value; }
  linearRampToValueAtTime(value: number, at: number) { this.value = value; this.ramps.push({ value, at }); }
}
class Node {
  output?: Node;
  disconnected = false;
  connect(node: Node) { this.output = node; return node; }
  disconnect() { this.disconnected = true; }
}
class Gain extends Node { gain = new Param(); }
class Panner extends Node { pan = new Param(); }
class Source extends Node {
  buffer: { file: string } | undefined;
  loop = false;
  playbackRate = new Param();
  onended?: () => void;
  stopped = false;
  at = 0;
  start(at: number) { this.at = at; played.push(this); }
  stop() { this.stopped = true; }
  end() { this.onended?.(); }
}
const gains: Gain[] = [], played: Source[] = [], media: Media[] = [], requests: string[] = [];
const decodes: string[] = [];
class Context {
  state = 'suspended';
  destination = new Node();
  constructor() { contexts++; }
  get currentTime() { return now / 1000; }
  resume() { this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  createGain() { const node = new Gain(); gains.push(node); return node; }
  createBufferSource() { return new Source(); }
  createStereoPanner() { return new Panner(); }
  createMediaElementSource(element: Media) { return element.source = new Node(); }
  async decodeAudioData(data: { file: string }) { decodes.push(data.file); if (data.file.includes('corrupt')) throw Error('decode failed'); return data; }
}
class Media extends EventTarget {
  src = ''; preload = ''; loop = false; paused = true; plays = 0; source?: Node;
  constructor() { super(); media.push(this); }
  play() { this.paused = false; this.plays++; return Promise.resolve(); }
  pause() { this.paused = true; }
  load() {}
  removeAttribute(name: string) { if (name === 'src') this.src = ''; }
}
const doc = Object.assign(new EventTarget(), { baseURI: 'https://example.test/game/', hidden: false });
const win = Object.assign(new EventTarget(), { AudioContext: Context, setTimeout: (run: () => void, ms: number) => { timers.set(++timerId, { at: now + ms, run }); return timerId; } });
const nav = { audioSession: { type: '' } };
const stored = new Map([['bc-settings', '{"sound":false,"shake":false,"flashes":"off"}']]);
const fixture = JSON.parse(readFileSync(new URL('../public/audio/manifest.json', import.meta.url), 'utf8'));
for (const [id, entry] of Object.entries(fixture) as [string, any][]) entry.files = [id + '.mp3'];
fixture.impact_light = { bus: 'sfx', files: ['impact_a.mp3', 'impact_b.mp3'], vol: .8, gap: 60, max: 2, pitch: .04 };
fixture.missing = { bus: 'sfx', files: ['missing.mp3'], vol: 1, gap: 0 };
fixture.corrupt = { bus: 'sfx', files: ['corrupt.mp3'], vol: 1, gap: 0 };
fixture.slow = { bus: 'sfx', files: ['slow.mp3'], vol: 1, gap: 0 };
let resolveSlow: (data: any) => void = () => {};
Object.defineProperties(globalThis, {
  window: { value: win }, document: { value: doc }, navigator: { value: nav }, Audio: { value: Media },
  performance: { value: { now: () => now } }, clearTimeout: { value: (id: number) => timers.delete(id) },
  localStorage: { value: { getItem: (key: string) => stored.get(key), setItem: (key: string, value: string) => stored.set(key, value) } },
  fetch: { value: async (url: URL) => {
    const file = url.pathname.split('/').at(-1)!; requests.push(file);
    if (file === 'manifest.json') return { ok: true, json: async () => fixture };
    return { ok: file !== 'missing.mp3', arrayBuffer: () => file === 'slow.mp3' ? new Promise(resolve => { resolveSlow = resolve; }) : Promise.resolve({ file }) };
  } },
});
const audio = await import('../src/audio.ts');
const { settings, updateSettings } = await import('../src/settings.ts');
assert.equal(settings.sound, false); assert.equal(settings.music, 100); assert.equal(settings.sounds, 100); assert.equal(settings.ambience, 100);
assert.equal(settings.flashes, 'off'); assert.equal(settings.shake, false);
updateSettings({ sound: true });
audio.playMusic('music_menu'); audio.playAmb('amb_street'); await flush();
assert.equal(media.length, 0, 'media не создаётся до жеста');
audio.unlockAudio(); await flush();
assert.equal(contexts, 1); assert.equal(nav.audioSession.type, 'playback'); assert.equal(media.length, 2);
assert.ok(media.every(m => m.loop && !m.paused));
assert.equal(decodes.filter(f => /music_|amb_/.test(f)).length, 0, 'длинные файлы не декодируются');
audio.unlockAudio(); audio.playMusic('music_menu'); await flush(); assert.equal(contexts, 1); assert.equal(media.length, 2);
const first = media[0]; audio.playMusic('music_route1'); await flush();
assert.equal(media.length, 3); assert.ok(!first.paused, 'старая музыка звучит во время fade');
await advance(799); assert.ok(!first.paused); await advance(1); assert.ok(first.paused && first.source?.disconnected);
const music = gains[4], amb = gains[3];
audio.duckMusic(); assert.ok(Math.abs(music.gain.value - 10 ** (-6 / 20)) < 1e-9);
await advance(611); assert.equal(music.gain.value, 1);
audio.setCombat(true); assert.ok(Math.abs(amb.gain.value - 10 ** (-6 / 20)) < 1e-9);
audio.setCombat(false); assert.equal(amb.gain.value, 1);
audio.setAudioPaused(true); assert.ok(Math.abs(music.gain.value - 10 ** (-10 / 20)) < 1e-9); assert.ok(media[1].paused);
audio.setAudioPaused(false); await flush(); assert.equal(music.gain.value, 1); assert.ok(!media[1].paused);
updateSettings({ music: 50, sounds: 30, ambience: 20 });
assert.equal(music.gain.value, .5); assert.equal(gains[1].gain.value, .3); assert.equal(gains[2].gain.value, .3); assert.equal(amb.gain.value, .2);
assert.equal(JSON.parse(stored.get('bc-settings')!).sounds, 30);
updateSettings({ music: 100, sounds: 100, ambience: 100 });
audio.setAudioCamera(100, 400);
audio.play('impact_light', { x: 1000, vol: .7, delay: 120 }); audio.play('impact_light'); await flush();
assert.equal(played.length, 1, 'gap блокирует второй вызов');
assert.equal((played[0].output as Gain).gain.value, .8 * .7 * .5);
assert.equal(((played[0].output as Gain).output as Panner).pan.value, .4);
assert.equal(played[0].at, now / 1000 + .12);
assert.ok(played[0].playbackRate.value >= .96 && played[0].playbackRate.value <= 1.04);
await advance(61); audio.play('impact_light'); await flush(); assert.equal(played.length, 2);
assert.notEqual(played[0].buffer?.file, played[1].buffer?.file, 'варианты не повторяются подряд');
await advance(61); audio.play('impact_light'); await flush(); assert.equal(played.length, 2, 'max учитывает активные голоса');
played[0].end(); await advance(61); audio.play('impact_light'); await flush(); assert.equal(played.length, 3, 'onended освобождает слот');
assert.equal(requests.filter(f => f === played[0].buffer?.file).length, 1, 'AudioBuffer кэшируется');
audio.stopSound('impact_light'); assert.ok(played.every(p => p.stopped));
const count = played.length; audio.play('missing'); audio.play('corrupt'); audio.play('absent_id'); await flush(); assert.equal(played.length, count);
const cancel = audio.play('slow'); await flush(); cancel(); resolveSlow({ file: 'slow.mp3' }); await flush(); assert.equal(played.length, count, 'отменённая загрузка не начинает звук');
audio.play('ramil_spin'); await flush(); assert.equal(played.at(-1)?.loop, true); audio.stopSound('ramil_spin'); assert.equal(played.at(-1)?.stopped, true);
audio.play('ui_charge_step', { rate: 1.4 }); await flush(); assert.equal(played.at(-1)?.playbackRate.value, 1.4);
doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange')); await flush();
assert.equal(audio.audioState(), 'suspended'); assert.ok(media.every(m => m.paused));
doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange')); await flush();
assert.equal(audio.audioState(), 'running'); assert.ok(media.some(m => !m.paused));
audio.playMusic('music_katya'); await flush(); const broken = media.at(-1)!;
broken.dispatchEvent(new Event('error')); await flush(); const mediaCount = media.length;
for (let i = 0; i < 5; i++) audio.playMusic('music_katya'); await flush(); assert.equal(media.length, mediaCount, 'нет бесконечных повторов отсутствующего media');
audio.setAudioPaused(true); audio.setAudioPreview(true); await flush(); audio.play('amb_mfc'); await flush();
assert.ok(media.at(-1)?.src.endsWith('amb_mfc.mp3') && !media.at(-1)?.paused, 'окружение прослушивается на паузе');
audio.setAudioPreview(false); audio.setAudioPaused(false); await advance();
assert.ok(!audio.isAudioPreview());
await audio.preloadBank('game');
assert.equal(decodes.filter(f => /music_|amb_/.test(f)).length, 0);
console.log('OK audio: migration, unlock, media, crossfade, cache, gap/max, variants, pitch, pan/distance, cancellation, missing files, settings, ducking, pause, visibility, preview');

// Проверяем связь игровых событий/снимков с ID, не меняя sim и сеть.
const { GameAudio } = await import('../src/game-audio.ts');
const { HERO_ANIMS, HERO_FORM, moveAnim } = await import('../../shared/src/index.ts');
const hero = (char = 'anastasia', more: Record<string, unknown> = {}) => ({ char, x: 200, y: 200, hp: 100, facing: 1, anim: 'idle', move: 'idle', ult: 0, ...more });
let snapshot: any = { players: new Map([['me', hero()], ['friend', hero('ramil', { x: 250 })]]), enemies: new Map(), actors: new Map(), level: 'route', stage: 0, halt: -1, storyScene: '', storyIndex: 0, lockX0: -1, lockX1: -1, won: false, encDone: 0, encTotal: 3, tick: 1 };
let gamePaused = false;
const session: any = { me: 'me', snapshots: [snapshot], isPaused: () => gamePaused };
const game = new GameAudio(session);
const update = (patch: any = {}) => { snapshot = { ...snapshot, ...patch, tick: snapshot.tick + 1 }; session.snapshots = [snapshot]; game.update(snapshot, 0, 500, 16); };
const names = (from: number) => played.slice(from).map(s => s.buffer?.file?.replace('.mp3', ''));
const expect = async (id: string, action: () => void) => {
  played.forEach(s => s.end()); await advance(); const from = played.length;
  action(); await flush(); assert.ok(names(from).includes(id), `${id}: получены ${names(from).join(', ')}`);
};
await expect('ui_start', () => update());
await expect('ui_ult_ready', () => update({ players: new Map([['me', hero('anastasia', { ult: 100 })], ['friend', hero('ramil')]]) }));
await expect('ui_pause', () => { gamePaused = true; update(); });
await expect('ui_resume', () => { gamePaused = false; update(); });
const enemy = (more: any = {}) => ({ x: 300, y: 200, hp: 100, kind: 'omon', facing: -1, anim: 'idle', phase: 'none', ...more });
await expect('enemy_enter_door', () => update({ enemies: new Map([['e1', enemy({ anim: 'enter', enterMs: 500 })]]) }));
await expect('omon_windup', () => update({ enemies: new Map([['e1', enemy({ anim: 'windup' })]]) }));
await expect('omon_strike', () => update({ enemies: new Map([['e1', enemy({ anim: 'strike' })]]) }));
// Сначала сбрасываем фазу, чтобы смена вида не подменяла начало удара.
update({ enemies: new Map([['e1', enemy({ kind: 'omon_shield' })]]) });
await expect('shield_bash', () => update({ enemies: new Map([['e1', enemy({ kind: 'omon_shield', anim: 'strike' })]]) }));
await expect('freeze_apply', () => update({ enemies: new Map([['e1', enemy({ frozen: true })]]) }));
await expect('freeze_break', () => update({ enemies: new Map([['e1', enemy({ frozen: false })]]) }));
await expect('body_launch', () => update({ enemies: new Map([['e1', enemy({ air: 500 })]]) }));
await expect('body_fall', () => update({ enemies: new Map([['e1', enemy({ hp: 0, anim: 'down' })]]) }));
await expect('wagon_brake', () => update({ stage: 3, halt: 0 }));
await expect('wagon_stop', () => update({ halt: 2500 }));
await expect('turnstile_reject', () => update({ stage: 2, storyScene: 'vestibule' }));
update({ storyScene: '', stage: 0, halt: -1, enemies: new Map([['e1', enemy()]]) });
for (const [char, form, move, id] of [
  ['anastasia', 'prime', 'superman', 'nastya_dash'], ['anastasia', 'prime', 'slam', 'nastya_slam'],
  ['anastasia', 'ultimate', 'flying-knee', 'nastya_knee'], ['nadezhda', 'nadya', 'b1', 'nadya_slap'],
  ['nadezhda', 'nadya', 'b2', 'nadya_stun'], ['nadezhda', 'nadya', 'b3-draw', 'nadya_blade_draw'],
  ['kris', 'kris', 'a2', 'kris_tripod_swing'], ['kris', 'kris', 'hop', 'kris_hop'],
  ['ramil', 'ramil', 'a2', 'ramil_grab'], ['ramil', 'ramil', 'a3-throw', 'ramil_meteor_up'],
  ['ramil', 'ramil', 'b2', 'ramil_roundhouse'], ['ramil', 'ramil', 'b3', 'ramil_fire'],
] as const) {
  const p: any = hero(char, { form, move });
  const clip = moveAnim(form, move), def = HERO_ANIMS[form][clip];
  await expect(id, () => { game.frame('me', p, true, 'idle', 0, 8); game.frame('me', p, true, clip, def.hit?.east ?? 0, def.east); });
}
await expect('step_asphalt', () => game.frame('me', hero() as any, true, 'walk', 0, 8));
await expect('step_asphalt', () => game.frame('me', hero() as any, true, 'walk', 4, 8));
await expect('step_asphalt', () => game.frame('me', hero('anastasia', { move: 'dash', anim: 'walk' }) as any, true, 'dash', 0, 8));
await expect('omon_step', () => game.frame('e1', enemy() as any, false, 'walk', 0, 8));
await expect('nastya_storm_hit', () => game.events([{ t: 'hit', by: 'me', target: 'e1', dmg: 1, x: 300, y: 200 }]));
await expect('ramil_burn_tick', () => game.events([{ t: 'hit', by: 'friend', target: 'e1', dmg: 2, x: 300, y: 200, tick: true }]));
await expect('ramil_flurry_roll', () => game.events([{ t: 'flurry', id: 'friend', level: 5, k: 0, x: 250, y: 200 }]));
await expect('ramil_flurry_hit', () => game.events([{ t: 'flurry', id: 'friend', level: 2, k: 1, x: 250, y: 200 }]));
assert.equal((played.at(-1)?.output as Gain).gain.value, fixture.ramil_flurry_hit.vol * .7, 'чужой герой на 30% тише');
await expect('guard_block', () => game.events([{ t: 'block', id: 'e1' }]));
await expect('hero_hurt', () => game.events([{ t: 'hit', target: 'me', dmg: 10, x: 200, y: 200 }]));
await expect('impact_finisher', () => game.events([{ t: 'hit', by: 'me', target: 'e1', dmg: 20, kill: true, x: 300, y: 200 }]));
for (const [boss, attack, tele, hit] of [
  ['shaman', 'vstayu', 'shaman_vstayu_tele', 'shaman_vstayu'],
  ['pizdulina', 'grid', 'pizdulina_grid_tele', 'pizdulina_grid'],
  ['katya', 'katHeavy', 'boss_tele', 'katya_heavy'],
]) {
  await expect(boss + '_intro', () => update({ enemies: new Map([['boss-' + boss, enemy({ boss, kind: boss })]]) }));
  await expect(tele, () => update({ enemies: new Map([['boss-' + boss, enemy({ boss, kind: boss, atk: attack, phase: 'windup', anim: 'windup' })]]) }));
  await expect(hit, () => {
    if (boss === 'katya') update({ enemies: new Map([['boss-' + boss, enemy({ boss, kind: boss, atk: attack, phase: 'active', anim: 'strike' })]]) });
    else game.events([{ t: 'bossFx', id: 'boss-' + boss, attack, x: 300, y: 200, ms: 100 }]);
  });
  await expect(boss + '_phase2', () => game.events([{ t: 'phase', id: 'boss-' + boss }]));
  await expect(boss + '_down', () => game.events([{ t: 'bossDown', id: 'boss-' + boss }]));
}
update({ stage: 0, enemies: new Map() });
const p: any = hero('anastasia', { form: HERO_FORM.anastasia, move: 'hurricane' });
await expect('nastya_hurricane', () => update({ players: new Map([['me', p]]) }));
const hurricane = played.findLast(s => s.buffer?.file === 'nastya_hurricane.mp3')!;
assert.equal(hurricane.loop, true); update({ players: new Map([['me', hero()]]) }); assert.equal(hurricane.stopped, true, 'петля заканчивается вместе с приёмом');
game.destroy();
console.log('OK game audio: routing, hero moves/steps, enemy steps/attacks, shield, storm, foreign volume, boss telegraphs/phase/down, loop lifetime');
