#!/usr/bin/env python3
"""Сборка звуков игры: источники → обрезка, высота, громкость, петли → client/public/audio + manifest.json.

  python3 tools/audio/build.py            собрать всё (готовые файлы пересобираются)
  python3 tools/audio/build.py ui_click   только эти ID

Источник варианта:
  'k:<пакет>/<файл без .ogg>'   Kenney (assets/audio-lib/kenney-<пакет>/Audio/...)
  'fs:<id>'                     Freesound hq-превью (скачивается в assets/audio-lib/fs/)
  'gx:<имя>'                    Genex (assets/audio-src/gx/<имя>.mp3)
  'm:<имя>'                     музыка (assets/audio-src/music/<имя>.mp3)
Модификаторы варианта (dict): s старт с, d длительность с, r скорость/высота, g доп. усиление дБ.
Исходники и источники перечислены здесь же: это и есть список происхождения для README.
"""
import glob, json, os, subprocess, sys, tempfile
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LIB = os.path.join(ROOT, 'assets/audio-lib')
OUT = os.path.join(ROOT, 'client/public/audio')
SR = 44100
# Целевая громкость (LUFS, условно для коротких) по шине
TARGET = {'ui': -20.0, 'sfx': -15.0, 'amb': -26.0, 'music': -19.0}


def K(pack, name, n=None, **m):
    """Kenney: один файл или серия name_000..; n = индексы."""
    if n is None:
        return [dict(src=f'k:{pack}/{name}', **m)]
    return [dict(src=f'k:{pack}/{name}{i}', **m) for i in n]


def F(fid, **m):
    return [dict(src=f'fs:{fid}', **m)]


def G(name, **m):
    return [dict(src=f'gx:{name}', **m)]


def k3(i):
    return f'_{i:03d}'


S = {}


def add(id_, bus, variants, vol=1.0, gap=None, loop=False, pitch=None, max_=None):
    v = []
    for x in variants:
        v += x if isinstance(x, list) else [x]
    S[id_] = dict(bus=bus, variants=v, vol=vol, gap=gap if gap is not None else (40 if bus in ('ui', 'sfx') else 0), loop=loop,
                  pitch=pitch if pitch is not None else (0.04 if bus == 'sfx' else 0.0), max=max_)


def kn(pack, base, idx):
    return [dict(src=f'k:{pack}/{base}_{i:03d}') for i in idx]


# ---------- Интерфейс ----------
add('ui_click', 'ui', kn('interface-sounds', 'click', [1, 2, 3]), vol=0.7, gap=50)
add('ui_confirm', 'ui', kn('interface-sounds', 'confirmation', [1, 2]), vol=0.8)
add('ui_back', 'ui', kn('interface-sounds', 'back', [1, 2]), vol=0.7)
add('ui_start', 'ui', K('music-jingles', 'Hit jingles/jingles_HIT00'), vol=0.8)
add('ui_pick_anastasia', 'ui', [*F(550267, d=0.9)], vol=0.8)          # ледяной магический удар
add('ui_pick_nadezhda', 'ui', [*F(74515)], vol=0.9)                   # поцелуй-pop
add('ui_pick_kris', 'ui', [*F(51360)], vol=0.9)                       # затвор камеры
add('ui_pick_ramil', 'ui', [*F(42144)], vol=0.9)                      # зажигалка zippo
add('ui_error', 'ui', kn('interface-sounds', 'error', [4, 6]), vol=0.7)
add('ui_toggle', 'ui', K('ui-audio', 'switch', [24, 34]), vol=0.6)
add('ui_pause', 'ui', kn('interface-sounds', 'minimize', [3]), vol=0.7)
add('ui_resume', 'ui', kn('interface-sounds', 'maximize', [3]), vol=0.7)
add('ui_room_created', 'ui', kn('interface-sounds', 'confirmation', [4]), vol=0.8)
add('ui_player_join', 'ui', kn('interface-sounds', 'open', [2]), vol=0.8)
add('ui_player_leave', 'ui', kn('interface-sounds', 'close', [2]), vol=0.8)
add('ui_connection_lost', 'ui', K('digital-audio', 'lowDown'), vol=0.7)
add('ui_reconnected', 'ui', K('digital-audio', 'highUp'), vol=0.7)
add('ui_ult_ready', 'ui', G('ui_ult_ready_01'), vol=0.8, gap=500)
add('ui_charge_step', 'ui', kn('interface-sounds', 'tick', [2]), vol=0.8, gap=40)

# ---------- Сюжет ----------
add('story_line', 'ui', kn('interface-sounds', 'pluck', [1]), vol=0.5, gap=150)
add('story_type', 'ui', kn('interface-sounds', 'tick', [1]), vol=0.25, gap=70)
add('story_phone', 'ui', G('story_phone_01'), vol=0.9)
add('story_push', 'ui', G('story_push_01'), vol=1.0)
add('story_caption', 'ui', G('story_caption_01'), vol=0.8)
add('story_card_in', 'ui', K('rpg-audio', 'bookFlip', [1]), vol=0.8)
add('story_card_out', 'ui', K('rpg-audio', 'bookFlip', [2]), vol=0.6)
add('story_composition', 'ui', F(98001), vol=0.9)                      # фото со вспышкой
add('story_rec', 'ui', K('digital-audio', 'twoTone', [1]), vol=0.6)
add('story_stamp', 'ui', G('story_stamp_01'), vol=1.0)
add('story_confetti', 'ui', F(26349), vol=0.9, gap=300)                # хлопушка
add('milonov_enter', 'ui', G('milonov_enter_01'), vol=0.8)
add('milonov_exit', 'ui', K('rpg-audio', 'doorClose_', [2]), vol=0.8)

# ---------- Окружение (петли) ----------
add('amb_street', 'amb', F(36734, s=36, d=40), loop=True)
add('amb_yard', 'amb', F(560354, s=52, d=40), loop=True)
add('amb_vestibule', 'amb', F(166015, s=130, d=40), loop=True)
add('amb_wagon', 'amb', F(87943, s=136, d=40), loop=True)
add('amb_mayak', 'amb', F(1945, s=10, d=40), loop=True)
add('amb_city', 'amb', F(167464, s=5, d=40), loop=True)
add('amb_mfc', 'amb', F(199896, s=144, d=40), loop=True)
add('amb_vokzal', 'amb', F(47236, s=46, d=40), loop=True)             # на будущее: Киевский вокзал
# разовые
add('enemy_enter_door', 'sfx', K('rpg-audio', 'doorOpen_', [1, 2]), vol=0.6, gap=300)
add('turnstile_reject', 'sfx', F(379159), vol=0.9)
add('wagon_brake', 'sfx', F(176068), vol=0.9)
add('wagon_stop', 'sfx', G('wagon_stop_01'), vol=0.8)
add('wagon_doors', 'sfx', F(121878), vol=0.9)
add('mayak_train', 'sfx', F(432730, s=0, d=20), vol=0.3, gap=20000, pitch=0)
add('mfc_queue_ping', 'sfx', G('mfc_queue_ping_01'), vol=0.35, gap=10000, pitch=0)
add('stage_exit', 'sfx', G('stage_exit_01'), vol=0.7)

# ---------- Бой общий ----------
add('whoosh_light', 'sfx', [*F(389590), *F(12658), *F(160756), *F(9509)], vol=0.55, gap=35)
add('whoosh_heavy', 'sfx', [*F(475135), *F(461017, d=0.6), *F(72190)], vol=0.6, gap=60)
add('impact_light', 'sfx', kn('impact-sounds', 'impactPunch_medium', [0, 1, 2, 3, 4]), vol=0.8, gap=30, max_=4)
add('impact_heavy', 'sfx', kn('impact-sounds', 'impactPunch_heavy', [0, 1, 2, 3, 4]), vol=0.9, gap=40, max_=3)
add('impact_finisher', 'sfx', [*G('impact_finisher_01'), *G('impact_finisher_02')], vol=1.0, gap=80)
add('impact_air', 'sfx', kn('impact-sounds', 'impactSoft_medium', [0, 1, 2]), vol=0.8)
add('body_launch', 'sfx', [*F(496188), *F(160756, r=0.85)], vol=0.6)
add('body_fall', 'sfx', [*F(160742), *F(82027), *F(417994, d=1.0)], vol=0.75, gap=60)
add('hero_hurt', 'sfx', kn('impact-sounds', 'impactSoft_heavy', [0, 1, 2]), vol=0.8, gap=120)
add('hero_down', 'sfx', G('hero_down_01'), vol=0.9)
add('hero_getup', 'sfx', K('rpg-audio', 'cloth', [1, 2]), vol=0.6)
add('guard_block', 'sfx', kn('impact-sounds', 'impactPlate_heavy', [0, 1, 2, 3]), vol=0.8, gap=60)
add('freeze_apply', 'sfx', [*F(446145), *F(683180)], vol=0.8)
add('freeze_break', 'sfx', [*F(719973), *F(262635)], vol=0.8)
add('heal', 'sfx', G('heal_01'), vol=0.7, gap=150)
add('arena_lock', 'sfx', G('arena_lock_01'), vol=0.8)
add('wave_start', 'sfx', G('wave_start_01'), vol=0.8)
add('arena_clear', 'sfx', G('arena_clear_01'), vol=0.8)
add('team_restart', 'sfx', G('team_restart_01'), vol=0.9)
add('victory_boss', 'sfx', G('victory_boss_01'), vol=0.9)
add('step_asphalt', 'sfx', kn('impact-sounds', 'footstep_concrete', [0, 1, 2, 3, 4]), vol=0.35, gap=150, pitch=0.06)
add('step_tile', 'sfx', [*[dict(src=f'k:impact-sounds/footstep_concrete_{i:03d}', r=1.12) for i in range(5)]], vol=0.35, gap=150, pitch=0.06)
add('step_wagon', 'sfx', kn('impact-sounds', 'footstep_carpet', [0, 1, 2, 3, 4]), vol=0.4, gap=150, pitch=0.06)

# ---------- Анастасия ----------
add('nastya_dash', 'sfx', G('nastya_dash_01'), vol=0.8)
add('nastya_highkick', 'sfx', [*F(72191), *F(59988)], vol=0.7)
add('nastya_teep', 'sfx', [*F(127197), *F(395368)], vol=0.7)
add('nastya_uppercut', 'sfx', G('nastya_uppercut_01'), vol=0.8)
add('nastya_cross', 'sfx', [*F(127197, r=1.1), *F(9509)], vol=0.7)
add('nastya_slam', 'sfx', G('nastya_slam_01'), vol=0.9)
add('nastya_transform', 'sfx', G('nastya_transform_01'), vol=0.9)
add('nastya_knee', 'sfx', [*F(59988, r=0.9)], vol=0.7)
add('nastya_elbow', 'sfx', [*F(72190, r=1.1)], vol=0.7)
add('nastya_hurricane', 'sfx', G('nastya_hurricane_01'), vol=0.7, loop=True, pitch=0)
add('nastya_storm_cast', 'sfx', G('nastya_storm_cast_01'), vol=0.9)
add('nastya_storm_loop', 'sfx', G('nastya_storm_loop_01'), vol=0.5, loop=True, pitch=0)
add('nastya_storm_hit', 'sfx', [*F(89771), *F(262635, r=1.2)], vol=0.5, gap=150)

# ---------- Надя ----------
add('nadya_swing', 'sfx', [*F(12658, r=1.1), *F(389590, r=1.1)], vol=0.55)
add('nadya_slap', 'sfx', [*F(368298), *F(209764), *F(567605)], vol=0.9)
add('nadya_stun', 'sfx', G('nadya_stun_01'), vol=0.8)
add('nadya_blade_draw', 'sfx', F(107589), vol=0.8)
add('nadya_dash', 'sfx', F(724716), vol=0.8)
add('nadya_dash_hit', 'sfx', G('nadya_dash_hit_01'), vol=0.9)
add('nadya_kiss', 'sfx', [*F(26403), *F(74515)], vol=0.8)
add('nadya_charm', 'sfx', G('nadya_charm_01'), vol=0.7, gap=120)

# ---------- Kris ----------
add('kris_tripod_swing', 'sfx', [*F(461017, d=0.6, r=1.1), *F(475135, r=1.15)], vol=0.6)
add('kris_tripod_hit', 'sfx', kn('impact-sounds', 'impactMetal_light', [0, 1, 2]), vol=0.8)
add('kris_hop', 'sfx', [*F(494797)], vol=0.6)
add('kris_shutter', 'sfx', [*F(51360), *F(178186), *F(431588)], vol=0.8, gap=60)
add('kris_flash_hit', 'sfx', G('kris_flash_hit_01'), vol=0.8, gap=60)
add('kris_ball_throw', 'sfx', G('kris_ball_throw_01'), vol=0.8)
add('kris_ball_boom', 'sfx', [*F(587196), *F(587183)], vol=0.9)
add('kris_aim', 'sfx', G('kris_aim_01'), vol=0.8)
add('kris_beam', 'sfx', G('kris_beam_01'), vol=0.9)

# ---------- Рамиль ----------
add('ramil_dash', 'sfx', [*G('ramil_dash_01'), *F(208111)], vol=0.8)
add('ramil_kick', 'sfx', [*F(475135, r=0.9), *F(72190, r=0.85)], vol=0.7)
add('ramil_grab', 'sfx', [*K('rpg-audio', 'cloth', [3, 4])], vol=0.8)
add('ramil_spin', 'sfx', G('ramil_spin_01'), vol=0.8, loop=True, pitch=0)
add('ramil_spin_hit', 'sfx', kn('impact-sounds', 'impactPunch_heavy', [1, 3]), vol=0.7, gap=90)
add('ramil_meteor_up', 'sfx', [*F(461017, d=0.7, r=0.8)], vol=0.7)
add('ramil_meteor_land', 'sfx', G('ramil_meteor_land_01'), vol=1.0)
add('ramil_roundhouse', 'sfx', [*F(524956), *F(390462)], vol=0.9)
add('ramil_fire', 'sfx', [*F(472688), *F(539972)], vol=0.8)
add('ramil_burn_tick', 'sfx', G('ramil_burn_01'), vol=0.4, gap=400)
add('ramil_smoke', 'sfx', [*F(268963)], vol=0.6, gap=1500)
add('ramil_flurry_start', 'sfx', G('ramil_flurry_start_01'), vol=0.9)
add('ramil_flurry_hit', 'sfx', kn('impact-sounds', 'impactPunch_medium', [0, 2, 4]), vol=0.6, gap=70)
add('ramil_flurry_roll', 'sfx', G('ramil_flurry_roll_01'), vol=0.8, gap=350)
add('ramil_flurry_finish', 'sfx', G('ramil_flurry_finish_01'), vol=1.0)

# ---------- Враги ----------
add('omon_step', 'sfx', [dict(src=f'k:impact-sounds/footstep_concrete_{i:03d}', r=0.8) for i in range(5)], vol=0.3, gap=250, pitch=0.05)
add('vatnik_step', 'sfx', [dict(src=f'k:impact-sounds/footstep_carpet_{i:03d}', r=0.9) for i in range(5)], vol=0.3, gap=250, pitch=0.05)
add('zek_step', 'sfx', [dict(src=f'k:impact-sounds/footstep_concrete_{i:03d}', r=1.2) for i in range(5)], vol=0.25, gap=250, pitch=0.05)
add('clerk_step', 'sfx', [dict(src=f'k:impact-sounds/footstep_wood_{i:03d}', r=0.9) for i in range(5)], vol=0.3, gap=250, pitch=0.05)
add('info_step', 'sfx', [dict(src=f'k:impact-sounds/footstep_wood_{i:03d}', r=1.15) for i in range(5)], vol=0.25, gap=250, pitch=0.05)
add('omon_windup', 'sfx', [*F(494797, r=0.9)], vol=0.5, gap=150)
add('vatnik_windup', 'sfx', [*F(496188, r=0.9)], vol=0.5, gap=150)
add('zek_windup', 'sfx', [*F(494797, r=1.2)], vol=0.5, gap=150)
add('clerk_windup', 'sfx', [*K('rpg-audio', 'bookFlip', [3])], vol=0.6, gap=150)
add('info_windup', 'sfx', [*F(802490)], vol=0.5, gap=150)
add('omon_strike', 'sfx', G('omon_strike_01'), vol=0.8, gap=100)
add('shield_bash', 'sfx', kn('impact-sounds', 'impactPlate_medium', [0, 1, 2]), vol=0.9, gap=100)
add('vatnik_strike', 'sfx', [*F(160756, r=0.8), *F(389590, r=0.8)], vol=0.6, gap=100)
add('zek_dash', 'sfx', [*F(461017, d=0.6, r=1.2)], vol=0.7, gap=100)
add('clerk_strike', 'sfx', G('clerk_strike_01'), vol=0.8, gap=100)
add('info_m_dash', 'sfx', G('info_m_dash_01'), vol=0.7, gap=100)
add('info_f_strike', 'sfx', G('info_f_strike_01'), vol=0.7, gap=100)
add('enemy_hurt_light', 'sfx', kn('impact-sounds', 'impactSoft_medium', [2, 3, 4]), vol=0.5, gap=60)
add('enemy_hurt_heavy', 'sfx', kn('impact-sounds', 'impactSoft_heavy', [2, 3, 4]), vol=0.6, gap=60)
add('enemy_down_heavy', 'sfx', G('enemy_down_heavy_01'), vol=0.8, gap=80)
add('enemy_intro_sting', 'ui', G('enemy_intro_sting_01'), vol=0.8)

# ---------- Боссы ----------
add('boss_tele', 'sfx', G('boss_tele_01'), vol=0.8, gap=200)
add('shaman_intro', 'sfx', G('shaman_intro_01'), vol=1.0)
add('shaman_mic_windup', 'sfx', [*F(475135, r=0.9)], vol=0.7)
add('shaman_mic_hit', 'sfx', [*F(506504, d=1.2), *kn('impact-sounds', 'impactMetal_heavy', [0, 1])], vol=0.9)
add('shaman_vstayu_tele', 'sfx', G('shaman_vstayu_tele_01'), vol=0.9)
add('shaman_vstayu', 'sfx', G('shaman_vstayu_01'), vol=1.0)
add('shaman_chorus_tele', 'sfx', F(489566), vol=0.6)
add('shaman_chorus', 'sfx', G('shaman_chorus_01'), vol=1.0)
add('shaman_pyro_tele', 'sfx', G('shaman_pyro_tele_01'), vol=0.8)
add('shaman_pyro', 'sfx', [*F(539972), *F(472688, r=0.85)], vol=0.9, gap=120)
add('shaman_salute', 'sfx', [*F(587184, d=1.6), *F(587183)], vol=0.8, gap=120)
add('shaman_cross', 'sfx', G('shaman_cross_01'), vol=1.0)
add('shaman_fans', 'sfx', F(194814, d=3.0), vol=0.8)
add('shaman_phase2', 'sfx', G('shaman_phase2_01'), vol=1.0)
add('shaman_down', 'sfx', G('shaman_down_01'), vol=1.0)
add('pizdulina_intro', 'sfx', G('pizdulina_intro_01'), vol=1.0)
add('pizdulina_slap', 'sfx', [*F(368298, r=0.9), *F(209764, r=0.9)], vol=1.0)
add('pizdulina_ban_tele', 'sfx', G('pizdulina_ban_tele_01'), vol=0.8)
add('pizdulina_ban', 'sfx', G('pizdulina_ban_01'), vol=1.0)
add('pizdulina_shots', 'sfx', G('pizdulina_shots_01'), vol=0.8, gap=100)
add('pizdulina_grid_tele', 'sfx', F(458587), vol=0.7)
add('pizdulina_grid', 'sfx', F(136542), vol=0.8)
add('pizdulina_zone', 'sfx', G('pizdulina_zone_01'), vol=0.9, gap=150)
add('pizdulina_cross', 'sfx', G('pizdulina_cross_01'), vol=1.0)
add('pizdulina_omon', 'sfx', G('pizdulina_omon_01'), vol=0.9)
add('pizdulina_phase2', 'sfx', F(26389), vol=0.9)
add('pizdulina_down', 'sfx', G('pizdulina_down_01'), vol=1.0)
add('katya_intro', 'sfx', G('katya_intro_01'), vol=1.0)
add('katya_heavy', 'sfx', G('katya_heavy_01'), vol=1.0)
add('katya_ground', 'sfx', G('katya_ground_01'), vol=1.0)
add('katya_rush', 'sfx', [*F(475135, r=0.85), *F(461017, d=0.6, r=0.8)], vol=0.8)
add('katya_phase2', 'sfx', G('katya_phase2_01'), vol=1.0)
add('katya_down', 'sfx', G('katya_down_01'), vol=1.0)

# ---------- Музыка ----------
# Incompetech (Kevin MacLeod): menu «Sneaky Snitch», route1 «Jet Fueled Vixen», route2 «MTA»,
# pizdulina «Chee Zee Lab», katya «Volatile Reaction». Genex: shaman, finale.
for m in ['music_menu', 'music_route1', 'music_route2', 'music_shaman', 'music_pizdulina', 'music_katya', 'music_finale']:
    add(m, 'music', [dict(src=f'm:{m}')], loop=True)


# ================= обработка =================
def path_of(src):
    kind, ref = src.split(':', 1)
    if kind == 'k':
        pack, name = ref.split('/', 1)
        return os.path.join(LIB, f'kenney-{pack}/Audio/{name}.ogg')
    if kind == 'fs':
        p = os.path.join(LIB, f'fs/{ref}.mp3')
        if not os.path.exists(p):
            os.makedirs(os.path.dirname(p), exist_ok=True)
            sys.path.insert(0, os.path.dirname(__file__))
            import fs_search
            fs_search.get(ref, p)
        return p
    if kind == 'gx':
        return os.path.join(ROOT, f'assets/audio-src/gx/{ref}.mp3')
    if kind == 'm':
        return os.path.join(ROOT, f'assets/audio-src/music/{ref}.mp3')
    raise ValueError(src)


def decode(p, ch):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-f', 'f32le', '-ac', str(ch), '-ar', str(SR), '-'], capture_output=True, check=True)
    a = np.frombuffer(r.stdout, dtype=np.float32).copy()
    return a.reshape(-1, ch)


def resample_rate(a, r):
    if abs(r - 1) < 1e-3:
        return a
    n = int(len(a) / r)
    x = np.linspace(0, len(a) - 1, n)
    return np.stack([np.interp(x, np.arange(len(a)), a[:, c]) for c in range(a.shape[1])], 1).astype(np.float32)


def loudness(a):
    """Приближённая громкость: RMS по окнам 50 мс, среднее по громким окнам (как gate), в дБ."""
    m = a.mean(1)
    w = int(SR * 0.05)
    if len(m) < w:
        w = max(1, len(m))
    k = len(m) // w
    rms = np.sqrt((m[:k * w].reshape(k, w) ** 2).mean(1) + 1e-12)
    db = 20 * np.log10(rms)
    loud = db[db > db.max() - 20]
    return 10 * np.log10(np.mean(10 ** (loud / 10)))


def trim_silence(a, thr_db=-45):
    m = np.abs(a).max(1)
    idx = np.where(m > 10 ** (thr_db / 20))[0]
    if len(idx) == 0:
        return a
    s = max(0, idx[0] - int(0.003 * SR)); e = min(len(a), idx[-1] + int(0.02 * SR))
    return a[s:e]


def fade(a, fin=0.003, fout=0.03):
    n1, n2 = int(fin * SR), min(int(fout * SR), len(a) // 2)
    if n1:
        a[:n1] *= np.linspace(0, 1, n1)[:, None]
    if n2:
        a[-n2:] *= np.linspace(1, 0, n2)[:, None]
    return a


def loopify(a, xf=1.5):
    """Бесшовная петля: хвост длиной xf плавно перетекает в начало."""
    n = int(xf * SR)
    if len(a) < 3 * n:
        return a
    head, body, tail = a[:n], a[n:-n], a[-n:]
    t = np.linspace(0, 1, n)[:, None]
    mixed = tail * np.cos(t * np.pi / 2) + head * np.sin(t * np.pi / 2)
    return np.concatenate([body, mixed])


def encode(a, out, ch, kbps):
    os.makedirs(os.path.dirname(out), exist_ok=True)
    peak = np.abs(a).max()
    if peak > 0.97:
        a = a * (0.97 / peak)  # мягче лимитера, но не даёт клиппинг
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ac', str(ch), '-ar', str(SR), '-i', '-', '-c:a', 'libmp3lame', '-b:a', f'{kbps}k', out],
                   input=a.astype(np.float32).tobytes(), check=True)


def build_one(id_, spec):
    bus = spec['bus']
    ch = 2 if bus in ('amb', 'music') else 1
    files, missing = [], []
    for i, v in enumerate(spec['variants'], 1):
        p = path_of(v['src'])
        if not os.path.exists(p):
            missing.append(v['src']); continue
        a = decode(p, ch)
        if 's' in v or 'd' in v:
            s = int(v.get('s', 0) * SR); e = s + int(v['d'] * SR) if 'd' in v else len(a)
            a = a[s:e]
        a = resample_rate(a, v.get('r', 1.0))
        if bus in ('ui', 'sfx') and not spec['loop']:
            a = trim_silence(a)
        if len(a) < 100:
            missing.append(v['src'] + ' (пусто)'); continue
        gain = TARGET[bus] - loudness(a) + v.get('g', 0)
        a = a * (10 ** (gain / 20))
        if spec['loop']:
            a = loopify(a, 2.0 if bus == 'music' else 1.5)
            a = fade(a, 0.0, 0.0)
        else:
            a = fade(a)
        sub = {'ui': 'ui', 'sfx': 'sfx', 'amb': 'amb', 'music': 'music'}[bus]
        rel = f'{sub}/{id_}_{i:02d}.mp3'
        encode(a, os.path.join(OUT, rel), ch, 128 if bus == 'music' else 96)
        files.append(rel)
    return files, missing


def main(only):
    man_path = os.path.join(OUT, 'manifest.json')
    man = json.load(open(man_path)) if os.path.exists(man_path) else {}
    report = []
    for id_, spec in S.items():
        if only and id_ not in only:
            continue
        for old in glob.glob(os.path.join(OUT, '*', id_ + '_[0-9][0-9].mp3')):
            os.remove(old)
        files, missing = build_one(id_, spec)
        e = {'files': files, 'bus': spec['bus'], 'vol': spec['vol'], 'gap': spec['gap'], 'loop': spec['loop'], 'pitch': spec['pitch']}
        if spec['max']:
            e['max'] = spec['max']
        man[id_] = e
        if missing:
            report.append(f'{id_}: нет {missing}')
        print(f"{id_:24} {len(files)} файл(ов)" + (f'  НЕТ: {missing}' if missing else ''))
    json.dump(man, open(man_path, 'w'), ensure_ascii=False, indent=1)
    print('\nвсего ID', len(man), '; с файлами', sum(1 for v in man.values() if v['files']))
    for r in report:
        print('!', r)


if __name__ == '__main__':
    main(set(sys.argv[1:]))
