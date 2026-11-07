#!/usr/bin/env python3
"""Список звуков Genex (ElevenLabs SFX, 2 кр за штуку). Ставит в очередь и скачивает.

  gx_list.py queue    поставить всё, чего нет в gx_jobs.json (никогда не ставит повторно)
  gx_list.py fetch    дождаться и скачать готовые в assets/audio-src/gx/<name>.mp3
"""
import json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'assets/audio-src/gx')
JOBS = os.path.join(ROOT, 'tools/audio/gx_jobs.json')
TAIL = ', stylized modern comic beat em up game sound, clean isolated, dry, no music, no voice, no speech'

# имя файла: (длительность с или None, описание)
L = {
 'impact_finisher_02': (0.8, 'huge cartoon finishing punch, fist slams into body, deep boom thud plus whip crack, short air vacuum tail'),
 'hero_down_01': (1.0, 'hero knocked down, heavy body falls on hard floor, then a short descending sad tone'),
 'wave_start_01': (0.6, 'short tense drum hit with a rising brass stab sting, new wave of enemies incoming'),
 'arena_clear_01': (1.0, 'short satisfying resolving brass and percussion sting, fight won, area cleared'),
 'team_restart_01': (1.2, 'comic sad trombone wah-wah then a quick punchy reset whoosh hit'),
 'victory_boss_01': (1.6, 'short triumphant victory fanfare sting, brass and drums, comic and celebratory, not epic rpg'),
 'heal_01': (0.6, 'warm glassy healing sparkle rising upward, soft magical chime'),
 'story_push_01': (0.9, 'smartphone app push notification, official bureaucratic two note chime, slightly ominous, clean digital'),
 'story_phone_01': (0.9, 'phone vibrates twice on a table then a soft screen wake click'),
 'story_stamp_01': (0.8, 'heavy rubber stamp slammed down hard on paper document on a wooden desk, official and final'),
 'story_caption_01': (1.2, 'cinematic soft low boom with a gentle typewriter carriage ding, title card'),
 'milonov_enter_01': (1.2, 'pompous comic villain entrance sting, sneaky low brass and tuba, smug'),
 'wagon_stop_01': (1.2, 'original metro train arrival chime, two soft electronic tones in a tiled station, no voice'),
 'mfc_queue_ping_01': (1.0, 'electronic queue ticket system ding dong chime in an office hall, calling next number'),
 'boss_tele_01': (0.7, 'danger warning telegraph before an attack, quick rising tense whoosh with a sharp alarm tick'),
 'enemy_intro_sting_01': (1.0, 'short comic villain introduction sting, punchy orchestra hit with a cheeky brass slide'),
 'ui_ult_ready_01': (0.6, 'bright powerful energy charge ready chime, shimmering ping, special move available'),
 'nastya_uppercut_01': (0.5, 'fast rising uppercut whoosh from low to high ending in a punch impact'),
 'nastya_slam_01': (0.7, 'falling air whoosh then a very heavy ground slam impact, concrete crack'),
 'nastya_transform_01': (1.2, 'ice and violet energy power up transformation, crystals forming, rising magical swell ending in a hit'),
 'nastya_hurricane_01': (0.8, 'fast spinning air vortex whirlwind of kicks, whooshing loop, no impacts'),
 'nastya_storm_cast_01': (1.0, 'icy blizzard spell cast, low frosty swell expanding outward, crystals and cold wind'),
 'nastya_storm_loop_01': (3.0, 'cold snow storm wind with tinkling ice crystals, seamless loop'),
 'nastya_dash_01': (0.4, 'flying punch dash forward, fast air rush with a short doppler whoosh'),
 'nadya_stun_01': (0.5, 'cartoon dizzy stun, soft pop followed by a little spinning twinkle chime'),
 'nadya_charm_01': (0.5, 'cute magical heart pop with a sparkly twinkle, enemy charmed'),
 'nadya_dash_hit_01': (0.5, 'delayed clean katana slice through the air, sharp metallic shing with low impact'),
 'kris_aim_01': (0.6, 'camera lens zoom and focus, then an electronic target lock beep'),
 'kris_beam_01': (1.2, 'powerful photo flash energy beam firing, charging capacitor whine into a crackling bright light beam'),
 'kris_ball_throw_01': (0.4, 'springy techno gadget launch with a spinning whirr'),
 'kris_flash_hit_01': (0.4, 'bright camera flash burst crack hitting a target, electric snap'),
 'ramil_spin_01': (1.0, 'powerful spinning tornado whirlwind with debris, heavy rotating air, seamless loop'),
 'ramil_meteor_land_01': (0.9, 'body thrown from the sky crashing into the ground, huge ground slam with rubble and a short deep sub boom'),
 'ramil_flurry_start_01': (0.6, 'martial arts stance, vacuum air pull inward then a strong battle drum downbeat'),
 'ramil_flurry_roll_01': (0.7, 'rapid barrage of dozens of fast palm strikes, machine gun like flurry of hits'),
 'ramil_flurry_finish_01': (1.0, 'silent pause then a massive double palm strike impact with a long shockwave blast'),
 'ramil_dash_01': (0.5, 'fast teleport dash, low air burst with a smoke poof'),
 'ramil_burn_01': (0.6, 'enemy catches fire, short whoosh ignition and crackling flames'),
 'info_m_dash_01': (0.5, 'glossy smug digital swoosh dash, slick and arrogant'),
 'info_f_strike_01': (0.4, 'sharp fashionable swipe attack ending with a smartphone notification pop'),
 'clerk_strike_01': (0.5, 'heavy office folder full of papers slammed onto someone, paper slap thud'),
 'omon_strike_01': (0.4, 'police baton fast swing swish and a hard rubber baton hit'),
 'shaman_intro_01': (1.4, 'concert stage riser, crowd roar swell and pyro, then a heavy landing impact'),
 'shaman_vstayu_tele_01': (0.9, 'low stage riser expanding, building bass rumble, about to blast'),
 'shaman_vstayu_01': (0.7, 'circular bass blast shockwave from huge concert speakers, crowd hit'),
 'shaman_chorus_01': (0.7, 'powerful wordless male choir blast with a sonic wave, concert pa'),
 'shaman_pyro_tele_01': (0.4, 'gas igniter clicks of stage pyrotechnics'),
 'shaman_cross_01': (0.9, 'stage light sweep whoosh then a double heavy speaker blast'),
 'shaman_phase2_01': (1.2, 'music cuts out, then a massive concert comeback sting with drums and power chord'),
 'shaman_down_01': (1.5, 'microphone feedback squeal, amplifier switching off with a hum drop, heavy body fall'),
 'pizdulina_intro_01': (1.2, 'confident high heels steps, folder slammed on a desk, low ominous sting'),
 'pizdulina_ban_tele_01': (0.9, 'scanner beam sweep with a tense electronic system alarm tone'),
 'pizdulina_ban_01': (0.7, 'giant rubber stamp falling from the sky slamming onto concrete, huge thud'),
 'pizdulina_shots_01': (0.4, 'mechanical stamp launcher firing a stamp projectile, thunk and zip'),
 'pizdulina_zone_01': (0.6, 'heavy digital system lock stamp with a low forbidding pulse'),
 'pizdulina_cross_01': (0.9, 'two scanners sweeping across then a double stamp slam'),
 'pizdulina_omon_01': (1.0, 'alarm button press, police radio burst and heavy boots running'),
 'pizdulina_down_01': (1.5, 'stamp breaks apart, papers falling, computer system shutdown sound'),
 'katya_intro_01': (1.2, 'menacing boss entrance, heavy footsteps and a dark punchy sting'),
 'katya_heavy_01': (0.6, 'brutal heavy strike, wide whoosh into a crushing body impact'),
 'katya_ground_01': (0.8, 'fist pounding the ground, shockwave crack, rubble'),
 'katya_phase2_01': (1.1, 'boss enrages, aggressive roar like energy surge with a hard hit, no voice'),
 'katya_down_01': (1.4, 'defeated boss collapses, heavy fall, fading dark tone'),
 'enemy_down_heavy_01': (0.7, 'heavy armored body falls on the floor, gear rattle'),
 'arena_lock_01': (0.6, 'metal barrier gates slam shut, locking the area'),
 'stage_exit_01': (0.6, 'quick comic travel whoosh transition with a soft page turn'),
}


def load():
    return json.load(open(JOBS)) if os.path.exists(JOBS) else {}


def queue():
    jobs = load()
    for name, (dur, text) in L.items():
        if name in jobs:
            continue
        cmd = ['npx', 'genex', 'sfx', text + TAIL, '--out-dir', OUT, '--no-wait']
        if dur:
            cmd += ['--duration', str(dur)]
        r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
        m = re.search(r'Queued \((\w+)\)', r.stdout + r.stderr)
        if not m:
            print('НЕ ПОСТАВЛЕН', name, (r.stdout + r.stderr)[-400:]); break
        jobs[name] = m.group(1); json.dump(jobs, open(JOBS, 'w'), indent=1)
        print('queued', name, m.group(1))


def fetch():
    jobs = load()
    for name, jid in jobs.items():
        dst = os.path.join(OUT, name + '.mp3')
        if os.path.exists(dst):
            continue
        r = subprocess.run(['npx', 'genex', 'wait', jid, '--timeout', '300'], cwd=ROOT, capture_output=True, text=True)
        m = re.findall(r'https://assets\.genex\.technology/\S+', r.stdout)
        if not m:
            print('нет ссылки', name, r.stdout[-300:]); continue
        subprocess.run(['curl', '-s', '-o', dst, m[0]])
        print('ok', name)


if __name__ == '__main__':
    {'queue': queue, 'fetch': fetch}[sys.argv[1]]()
