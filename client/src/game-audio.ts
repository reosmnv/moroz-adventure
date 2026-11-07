import { HERO_ANIMS, HERO_FORM, STRIKES, KIND, LEVELS, HALT_MS, STORM_DMG, dirOf, type Form, type SimEvent, type EnemyKind } from '@bc/shared';
import type { EntitySnap, GameSession, Snapshot } from './session.ts';
import { play, playAmb, playMusic, duckMusic, setAudioCamera, setCombat, setAudioPaused, preloadBank, isAudioPreview, isAudioMenu, setAudioMenu } from './audio.ts';

const HERO_MOVES: Record<string, Record<string, string>> = {
  prime: { superman: 'nastya_dash', highkick: 'nastya_highkick', teep: 'nastya_teep', uppercut: 'nastya_uppercut', cross: 'nastya_cross', slam: 'nastya_slam' },
  ultimate: { 'flying-knee': 'nastya_knee', knee: 'nastya_knee', elbow: 'nastya_elbow', 'spin-elbow': 'nastya_elbow' },
  nadya: { a1: 'nadya_swing', a2: 'nadya_swing', a3: 'nadya_swing', b1: 'nadya_slap', b2: 'nadya_stun', 'b3-draw': 'nadya_blade_draw', 'b3-end': 'nadya_dash_hit' },
  kris: { 'a1-back': 'kris_tripod_swing', a2: 'kris_tripod_swing', hop: 'kris_hop' },
  ramil: { a1: 'ramil_kick', a2: 'ramil_grab', 'a3-throw': 'ramil_meteor_up', b2: 'ramil_roundhouse', b3: 'ramil_fire', smoke: 'ramil_smoke' },
};
const BOSS_ATTACK_SOUND: Record<string, string> = {
  mic: 'shaman_mic_hit', vstayu: 'shaman_vstayu', chorus: 'shaman_chorus', pyro: 'shaman_pyro', salute: 'shaman_salute', crossStage: 'shaman_cross', fans: 'shaman_fans',
  slap: 'pizdulina_slap', banStrike: 'pizdulina_ban', shots: 'pizdulina_shots', grid: 'pizdulina_grid', zones: 'pizdulina_zone', crossBan: 'pizdulina_cross', omon: 'pizdulina_omon',
  katHeavy: 'katya_heavy', katHeavy2: 'katya_heavy', katGround: 'katya_ground', katGround2: 'katya_ground', katRush: 'katya_rush',
};
const BOSS_TELE: Record<string, string> = { mic: 'shaman_mic_windup', vstayu: 'shaman_vstayu_tele', chorus: 'shaman_chorus_tele', pyro: 'shaman_pyro_tele', banStrike: 'pizdulina_ban_tele', grid: 'pizdulina_grid_tele' };
const ENEMY_STRIKE: Record<string, string> = { omon: 'omon_strike', omon_shield: 'shield_bash', vatnik: 'vatnik_strike', zek: 'zek_dash', clerk: 'clerk_strike', info_m: 'info_m_dash', info_f: 'info_f_strike' };
const EVENT_SOUND: Partial<Record<SimEvent['t'], string>> = { block: 'guard_block', rdash: 'ramil_dash', tele: 'ramil_dash', rspinHit: 'ramil_spin_hit', rland: 'ramil_meteor_land', rfinish: 'ramil_flurry_finish', ball: 'kris_ball_throw', boom: 'kris_ball_boom', kiss: 'nadya_kiss', charm: 'nadya_charm', aim: 'kris_aim', beam: 'kris_beam', dash: 'nadya_dash', heal: 'heal', down: 'hero_down', lock: 'arena_lock', wave: 'wave_start', clear: 'arena_clear', restart: 'team_restart' };
const enemyGroup = (kind: string) => kind === 'omon_shield' ? 'omon' : kind.startsWith('info_') ? 'info' : kind;

// Только клиентские наблюдения. Сеть и детерминированная симуляция не знают о звуке.
export class GameAudio {
  private previous?: Snapshot;
  private location = '';
  private stageId = '';
  private bossMusic = '';
  private bossReturnAt = 0;
  private nextBackground = 0;
  private clock = 0;
  private active = false;
  private milonovExiting = false;
  private damageOwners = new Map<string, string>();
  private paused = false;
  private introduced = new Set<string>();
  private defeated = new Set<string>();
  private bosses = new Map<string, string>();
  private loops = new Map<string, () => void>();
  private loopKeys = new Set<string>();
  private frames = new Map<string, { clip: string; frame: number }>();
  private heroSteps = new Set<string>();
  private enemySteps = new Set<string>();
  constructor(private session: GameSession) {}
  private latest() { return this.session.snapshots.at(-1); }
  private entity(id?: string) { return id ? this.latest()?.players.get(id) ?? this.latest()?.enemies.get(id) ?? this.previous?.players.get(id) ?? this.previous?.enemies.get(id) : undefined; }
  private ownerVol(id?: string) { return id && id !== this.session.me && (this.latest()?.players.has(id) || this.previous?.players.has(id)) ? .7 : 1; }
  private sound(name: string, entity?: Pick<EntitySnap, 'x'>, by?: string, rate?: number) { play(name, { x: entity?.x, vol: this.ownerVol(by), rate }); }
  private loop(key: string, name: string, p: EntitySnap, by: string) {
    this.loopKeys.add(key);
    if (!this.loops.has(key)) this.loops.set(key, play(name, { x: p.x, vol: this.ownerVol(by), loop: true }));
  }
  private stopLoops() { for (const stop of this.loops.values()) stop(); this.loops.clear(); }
  destroy() { setAudioMenu(false); this.stopLoops(); setCombat(false); setAudioPaused(false); playAmb(null); playMusic('music_menu'); }

  update(s: Snapshot, x: number, width: number, dt: number) {
    setAudioCamera(x, width);
    if (isAudioPreview()) { this.stopLoops(); return; }
    const isPaused = this.session.isPaused();
    if (isPaused !== this.paused) { this.paused = isPaused; play(isPaused ? 'ui_pause' : 'ui_resume'); setAudioPaused(isPaused); }
    if (isAudioMenu()) { this.stopLoops(); this.previous = s; return; }
    const me = s.players.get(this.session.me);
    if (!this.active && me) { this.active = true; play('ui_start'); void preloadBank('game'); }
    if (!this.active) { playMusic('music_menu'); playAmb(null); this.previous = s; return; }
    const location = `${s.level}:${s.stage}`;
    if (location !== this.location) {
      this.stopLoops(); this.frames.clear(); this.bosses.clear(); this.defeated.clear(); this.damageOwners.clear(); this.bossMusic = ''; this.bossReturnAt = 0;
      this.location = location; this.stageId = LEVELS[s.level].stages[s.stage].id;
      this.nextBackground = this.clock + this.backgroundDelay();
    }
    setCombat(s.lockX0 >= 0);
    playAmb('amb_' + this.stageId);
    const aliveBoss = [...s.enemies.entries()].find(([id, e]) => e.boss && e.hp > 0 && !this.defeated.has(id));
    if (aliveBoss) {
      this.bossMusic = aliveBoss[1].boss!; this.bossReturnAt = 0;
    } else if (this.bossMusic && !this.bossReturnAt) this.bossReturnAt = this.clock + 800;
    if (this.bossReturnAt && this.clock >= this.bossReturnAt) { this.bossMusic = ''; this.bossReturnAt = 0; }
    const finale = s.finaleReady || s.storyScene === 'withdrawal' || s.won && !s.storyScene;
    playMusic(finale ? 'music_finale' : this.bossReturnAt ? null : this.bossMusic ? 'music_' + this.bossMusic : ['street', 'yard', 'vestibule', 'wagon'].includes(this.stageId) ? 'music_route1' : 'music_route2');
    if (this.paused || document.hidden) { this.stopLoops(); return; }
    this.clock += dt;
    if (!s.storyScene && this.clock >= this.nextBackground) {
      if (this.stageId === 'mayak') play('mayak_train');
      if (this.stageId === 'mfc') play('mfc_queue_ping');
      this.nextBackground = this.clock + this.backgroundDelay();
    }
    this.heroSteps = new Set([this.session.me, ...[...s.players.entries()].filter(([id, p]) => id !== this.session.me && p.hp > 0 && !p.away).sort((a, b) => Math.abs(a[1].x - (me?.x ?? x)) - Math.abs(b[1].x - (me?.x ?? x))).slice(0, 2).map(([id]) => id)]);
    this.enemySteps = new Set([...s.enemies.entries()].filter(([, e]) => !e.boss && e.hp > 0 && e.x >= x && e.x <= x + width && !e.carried).sort((a, b) => Math.abs(a[1].x - (me?.x ?? x)) - Math.abs(b[1].x - (me?.x ?? x))).slice(0, 2).map(([id]) => id));
    this.loopKeys.clear();
    for (const [id, p] of s.players) {
      if (p.hp <= 0 || p.away || s.storyScene) continue;
      if (p.move === 'hurricane') this.loop(id + ':hurricane', 'nastya_hurricane', p, id);
      if (p.move === 'a3-spin') this.loop(id + ':spin', 'ramil_spin', p, id);
      if ((p.storm ?? 0) > 0) this.loop(id + ':storm', 'nastya_storm_loop', p, id);
      const old = this.previous?.players.get(id);
      if (id === this.session.me && (p.ult ?? 0) >= 100 && (old?.ult ?? 0) < 100) play('ui_ult_ready');
      if (old?.anim === 'down' && p.anim !== 'down') this.sound('hero_getup', p, id);
    }
    for (const [key, stop] of this.loops) if (!this.loopKeys.has(key)) { stop(); this.loops.delete(key); }
    if (s !== this.previous) {
      for (const key of this.frames.keys()) if (!(key.startsWith('p:') ? s.players : s.enemies).has(key.slice(2))) this.frames.delete(key);
      for (const id of this.damageOwners.keys()) if (!s.enemies.has(id)) this.damageOwners.delete(id);
      for (const [id, e] of s.enemies) {
        const old = this.previous?.enemies.get(id), kind = e.boss || e.kind || 'omon';
        if (e.boss) {
          this.bosses.set(id, e.boss);
          if (!old && e.hp > 0) this.sound(e.boss + '_intro', e);
          if (e.phase === 'windup' && (old?.phase !== 'windup' || old.atk !== e.atk)) this.sound(BOSS_TELE[e.atk ?? ''] ?? 'boss_tele', e);
          // Для melee/shots/summon sim не присылает bossFx.
          if (e.phase === 'active' && old?.phase !== 'active' && ['mic', 'slap', 'shots', 'fans', 'omon', 'katHeavy', 'katHeavy2', 'katRush'].includes(e.atk ?? '')) this.sound(BOSS_ATTACK_SOUND[e.atk!], e);
        } else {
          const visible = e.x >= x && e.x <= x + width;
          if (visible && !this.introduced.has(kind)) { this.introduced.add(kind); this.sound('enemy_intro_sting', e); }
          if (!old && e.anim === 'enter' && this.stageId === 'street') this.sound('enemy_enter_door', e);
          if (e.anim === 'windup' && old?.anim !== 'windup') this.sound(enemyGroup(kind) + '_windup', e);
          if (['strike', 'dash'].includes(e.anim) && old?.anim !== e.anim) this.sound(ENEMY_STRIKE[kind] ?? 'whoosh_light', e);
        }
        if (e.frozen && !old?.frozen) this.sound('freeze_apply', e, [...s.players].find(([, p]) => (p.storm ?? 0) > 0)?.[0]);
        if (old?.frozen && !e.frozen) this.sound('freeze_break', e, [...s.players].find(([, p]) => p.char === 'anastasia')?.[0]);
        if ((e.air ?? 0) > 0 && !(old?.air ?? 0)) this.sound('body_launch', e, this.damageOwners.get(id));
        if (old && old.hp > 0 && e.hp <= 0) this.sound(!e.boss && KIND[kind as EnemyKind]?.role === 'tank' ? 'enemy_down_heavy' : 'body_fall', e, this.damageOwners.get(id));
      }
      if (s.halt >= 0 && (this.previous?.halt ?? -1) < 0) play('wagon_brake');
      if (s.halt >= HALT_MS && (this.previous?.halt ?? -1) < HALT_MS) play('wagon_stop');
      if (s.recording && !this.previous?.recording) play('story_rec');
      if (s.actors.has('milonov') && !this.previous?.actors.has('milonov')) { this.milonovExiting = false; play('milonov_enter'); }
      const mil = s.actors.get('milonov'), oldMil = this.previous?.actors.get('milonov');
      if (oldMil && !this.milonovExiting && (!mil || mil.anim === 'walk' && Math.abs(mil.tx - oldMil.tx) > 100)) { this.milonovExiting = true; play('milonov_exit'); }
      if (s.storyScene === 'vestibule' && this.previous?.storyScene !== 'vestibule') play('turnstile_reject');
      this.previous = s;
    }
  }
  private backgroundDelay() { return this.stageId === 'mayak' ? 25000 + Math.random() * 15000 : 15000 + Math.random() * 15000; }

  // Вызывается рендером на фактическом кадре: два шага за цикл, взмах на hit.
  frame(id: string, p: EntitySnap, isPlayer: boolean, clip: string, frame: number, frames: number) {
    const key = (isPlayer ? 'p:' : 'e:') + id;
    const previous = this.frames.get(key);
    this.frames.set(key, { clip, frame });
    if (isAudioPreview() || isAudioMenu() || this.paused || document.hidden || this.latest()?.storyScene || !this.active || p.hp <= 0) return;
    const changed = previous?.clip !== clip || frame < previous.frame;
    const crossed = (mark: number) => (changed ? -1 : previous.frame) < mark && frame >= mark;
    if (clip === 'walk' || isPlayer && (clip === 'dash' || clip === 'a2-walk')) {
      if (!(crossed(0) || crossed(Math.floor(frames / 2)))) return;
      if (isPlayer && this.heroSteps.has(id)) this.sound(this.stageId === 'wagon' ? 'step_wagon' : ['street', 'yard', 'city'].includes(this.stageId) ? 'step_asphalt' : 'step_tile', p, id);
      else if (!isPlayer && this.enemySteps.has(id)) this.sound(enemyGroup(p.kind ?? 'omon') + '_step', p);
      return;
    }
    if (!isPlayer) return;
    const form: Form = p.form ?? HERO_FORM[p.char ?? ''] ?? 'prime';
    const move = p.move ?? 'idle', def = HERO_ANIMS[form][clip];
    const hit = def?.hit?.[dirOf(p.facing)];
    if ((def?.hits ?? [hit ?? 0]).some(crossed)) {
      const sound = HERO_MOVES[form]?.[move];
      if (sound) this.sound(sound, p, id);
      if (STRIKES[form][move] && !STRIKES[form][move].kind) {
        const strike = STRIKES[form][move];
        this.sound(strike.impact === 2 || strike.dmg >= 18 ? 'whoosh_heavy' : 'whoosh_light', p, id);
      }
    }
  }

  events(events: SimEvent[]) {
    if (isAudioPreview() || isAudioMenu()) return;
    for (const e of events) {
      let by = 'by' in e ? e.by : 'id' in e ? e.id : undefined;
      if (!by && (e.t === 'rland' || e.t === 'charm')) by = [...(this.latest()?.players ?? [])].find(([, p]) => p.char === (e.t === 'rland' ? 'ramil' : 'nadezhda'))?.[0];
      const p = this.entity(by), pos = 'x' in e ? { x: e.x } : p;
      const emit = (name: string) => this.sound(name, pos, by);
      if (e.t === 'hit') {
        if (e.by) this.damageOwners.set(e.target, e.by);
        const target = this.entity(e.target), hero = this.latest()?.players.has(e.target) || this.previous?.players.has(e.target);
        if (hero) this.sound('hero_hurt', pos, e.target);
        else if (e.flurry) { /* ладони озвучивает flurry, а не каждое попадание в толпу */ }
        else if (p?.char === 'anastasia' && e.dmg === STORM_DMG) emit('nastya_storm_hit');
        else if (e.tick) emit(p?.char === 'ramil' ? 'ramil_burn_tick' : 'nastya_storm_hit');
        else {
          emit(e.kill || e.impact === 2 ? 'impact_finisher' : e.dmg >= 18 ? 'impact_heavy' : 'impact_light');
          if ((target?.air ?? 0) > 0) emit('impact_air');
          const kind = target?.kind as EnemyKind;
          emit(kind && KIND[kind]?.role === 'tank' ? 'enemy_hurt_heavy' : 'enemy_hurt_light');
          if (p?.char === 'kris' && (['a1-back', 'a2'].includes(p.move ?? '') || e.word === 'СТОП!' || e.word === 'ВЖУХ!')) emit('kris_tripod_hit');
        }
      }
      if (e.t === 'bossFx') { const sound = BOSS_ATTACK_SOUND[e.attack]; if (sound) emit(sound); }
      if (e.t === 'phase' || e.t === 'bossDown') {
        duckMusic(); const boss = p?.boss ?? this.bosses.get(e.id);
        if (boss) emit(boss + (e.t === 'phase' ? '_phase2' : '_down'));
        if (e.t === 'bossDown') { this.defeated.add(e.id); play('victory_boss', { delay: 300 }); playMusic(null); this.bossReturnAt = this.clock + 800; }
      }
      if (e.t === 'ult') { duckMusic(); if (p?.char === 'anastasia') emit('nastya_transform'); }
      if (e.t === 'rfinish') duckMusic();
      if (e.t === 'rstage') this.sound('ui_charge_step', pos, by, 1 + .08 * e.level);
      if (e.t === 'flurry') { if (!e.k) emit('ramil_flurry_start'); emit(e.level >= 4 ? 'ramil_flurry_roll' : 'ramil_flurry_hit'); }
      if (e.t === 'storm') { duckMusic(); emit('nastya_storm_cast'); }
      if (e.t === 'shot') { emit('kris_shutter'); play('kris_flash_hit', { x: e.tx, vol: this.ownerVol(e.id), delay: Math.abs(e.tx - e.x) / 600 * 1000 }); }
      if (e.t === 'exit') { play('stage_exit'); if (this.stageId === 'wagon') play('wagon_doors'); }
      if (e.t === 'restart') { this.defeated.clear(); this.frames.clear(); }
      if (e.t === 'victory') playMusic('music_finale');
      if (e.t === 'lock') setCombat(true);
      if (e.t === 'clear') setCombat(false);
      const name = EVENT_SOUND[e.t];
      if (name && (e.t !== 'tele' || 'fromX' in e)) emit(name);
    }
  }
}
