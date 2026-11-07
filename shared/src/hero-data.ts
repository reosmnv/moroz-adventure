// Боевые данные героев со спрайтами: серии, удары, числа. Тайминги кадров берутся из anims-data.ts.
import { HERO_ANIMS, type AnimDef, type Form } from './anims-data.ts';

export const HERO_ID = 'anastasia';
export const NADYA_ID = 'nadezhda';
export const KRIS_ID = 'kris';
export const RAMIL_ID = 'ramil';
// Рамиль: стартовые числа приёмов и их постановки, для настройки mr.R.
export const RAMIL = {
  A1_REACH: 56, A1_DASH_MAX: 200, A1_DASH_MS: 140, A1_GAP: 38, // рывок с ногой
  A1_RANGE: 66, A1_DMG: 5, A1_KB: 10, A1_STUN: 500,
  A2_STEP: 16, A2_RANGE: 64, A2_DMG: 10, GRAB_HOLD_MS: 2500,
  GRIP_X: 20, GRIP_Y: -50, HOLD_SPEED_MULT: 0.6, SPIN_SPEED_MULT: 0.5,
  SPIN_TURN_MS: [220, 160, 155, 155, 155, 155], SPIN_MS: 1000, SPIN_TURNS: 6,
  SPIN_R: 26, SPIN_HIT_R: 56, SPIN_DMG: 6, SPIN_HELD_DMG: 3, SPIN_KB: 110,
  SPIN_LANE_KB: 8, SPIN_HIT_ANGLE: Math.PI / 6, SPIN_STOP_MS: 40,
  SPIN_TILT: [30, 80, 80, 80, 80, 80], SPIN_GHOSTS: [2, 3, 5], SPIN_DUST_MS: 120,
  THROW_CLUSTER_R: 70, THROW_EMPTY: 200,
  METEOR_UP_MS: 200, METEOR_HANG_MS: 270, METEOR_FALL_MS: 110,
  METEOR_HEIGHT: 400, METEOR_AOE: 90, METEOR_DMG: 16, METEOR_HELD_DMG: 20, METEOR_KB: 150,
  KICK_MAX: 2, KICK_RANGE: 66, KICK_DMG: 20, RETURN_RANGE: 70, // серия B
  FIRE_LEN: 120, FIRE_BAND: 30, FIRE_MS: 330, FIRE_DMG: 10,
  BURN_MS: 3000, BURN_TICK: 500, BURN_DMG: 3,
  TELE_MS: 150, TELE_GAP: 34, RETURN_GAP: 40, TELE_DMG: 5, RETURN_DMG: 5,
  MARK_MS: 6000, KICK_FLY: 300, B_COMBO_MS: 1200,
  B_COOLDOWN_MS: 3500,
  ULT_HITS: [2, 4, 8, 16, 32, 64], ULT_STEPS: [200, 140, 95, 65, 42, 28], // шесть ступеней
  ULT_DMG: [2, 1.5, 1, 0.5, 0.5, 0.5], ULT_FINISH: [10, 10, 12, 14, 18, 30],
  ULT_HITSTOP: [90, 60, 30, 0, 0, 0], ULT_LAST_STOP: 120, ULT_FINISH_STOP: 200,
  ULT_WINDOW: 800, ULT_REACH: 260, ULT_RANGE: 70, ULT_STUN: 300, ULT_NUDGE: 2,
  ULT_DASH_MS: 160, ULT_EMPTY_MS: 400,
  ULT_MAIN_KB: 300, ULT_OTHER_KB: 160, ULT_SLOWMO: 250,
  SMOKE_RATE: 20, SMOKE_LINE_MS: 1600, HEAVY_SMOKE_MS: 300,
  HAND_X: 30, HAND_Y: -52, IDLE_MIN: 4000, IDLE_MAX: 7000,
} as const;
export const RAMIL_SMOKE_LINES = ['Ща-ща, подождите, докурю', 'Минуту, я на перекуре', 'Не торопите', 'Ещё затяжечку', 'Сейчас-сейчас', 'Пять минут, мужики'];
export const RAMIL_FINISH_WORDS = ['ХВАТИТ.', 'ХВАТИТ.', 'ВСЁ.', 'ВСЁ!', 'ВОН!', 'ШЕСТЬДЕСЯТ ЧЕТЫРЕ!'];
export const RAMIL_MOVE_NAMES = { b1: 'Телепорт', b2: 'С разворота', b3: 'Огонь', b4: 'К ним' };

// Персонаж -> его стартовый набор спрайтов (у Анастасии две формы, у остальных одна)
export const HERO_FORM: Record<string, Form> = { [HERO_ID]: 'prime', [NADYA_ID]: 'nadya', [KRIS_ID]: 'kris', [RAMIL_ID]: 'ramil' };
export const isSpriteHero = (char: string) => char in HERO_FORM;
export const RANGE_MULT = 1.3; // дальность всех ударов героини +30% (mr.R 24.10)
export const ULT_MS = 16000; // сколько длится Ultimate
export const COMBO_MS = 700; // окно, в которое следующий удар продолжает серию
export const COMBO_MS_BY: Partial<Record<Form, number>> = { nadya: 1000, kris: 1000, ramil: 1000 }; // гостям-негеймерам окно шире
export const HURT_INVULN_MS = 800;
export const IMMUNE_INVULN_MS = 300; // в Ultimate удары по героине не прерывают её, но подряд не копятся
export const KNOCK_MULT: Record<Form, number> = { prime: 2, ultimate: 4, nadya: 2, kris: 2, ramil: 2 }; // отбрасывание врагов по просьбе mr.R: зрелищность
export const HITSTOP_MS = 50; // заморозка героини при попадании (один тик)
export const HITSTOP_HEAVY_MS = 100; // при сбивании с ног
export const RUN_MULT = 1.7; // бег: стик на максимум (или Shift)

// Анастасия: врыв, магнит и воздушные серии.
export const SLAM_ANIM = 'axe';
export const MAGNET_DIST = 60; // добавочная дистанция подведения
export const RUSH_DIST = 110; // длина врыва
export const ATTACK_BAND = 40; // глубина сектора
export const MAGNET_GAP = 2; // запас до границы попадания
export const LAUNCH_H = 90; // высота подброса
export const JUGGLE_REFRESH_MS = 600; // новое время воздуха при попадании
export const JUGGLE_MULT = 1.25; // первый воздушный множитель
export const JUGGLE_STEP = 0.1; // прирост за воздушное попадание
export const JUGGLE_MULT_MAX = 1.75; // предел множителя
export const JUGGLE_MAX_MS = 3500; // предел непрерывного полёта
export const SLAM_MULT = 1.5; // множитель добивания
export const BOUNCE_MS = 250; // длительность отскока
export const BOUNCE_H = 25; // высота отскока
export const HIT_CHAIN_MS = 1500; // сброс счётчика без попаданий
export const PIN_MS = 300; // полёт кегли и оглушение задетого
export const PIN_KB_MIN = 14; // порог исходного kb для кегли
export const PIN_SIZE = 20; // допуск столкновения по обеим осям
export const PIN_DMG = 5; // урон от кегли
export const PIN_KB = 20; // отброс задетого кеглей
export const KILL_EXTEND_MS = 500; // продление Ultimate за убийство
export const AIR_CHARGE_MULT = 1.5; // заряд за попадание в воздухе

export interface Strike {
  range: number;
  dmg: number; // за одно попадание
  kb: number; // отбрасывание
  stun: number; // оглушение врага, мс
  down?: boolean; // сбивает с ног
  launch?: boolean; // подбрасывает врага
  slam?: boolean; // вбивает с коротким отскоком
  rush?: boolean; // бьёт по всей линии врыва
  around?: boolean; // бьёт всех вокруг, а не только перед собой
  single?: boolean; // только ближайший враг перед героем
  slowMs?: number; slow?: number; // замедление врага: длительность и доля скорости, которую он теряет
  stunMs?: number; // оглушение: враг стоит и не бьёт
  impact?: 1 | 2;
  word?: string; // комиксное слово над попаданием
  kind?: 'flash' | 'ball' | 'kiss' | 'dash'; // особое действие в кадре удара вместо обычного попадания
}
export const AIR_MS = 900; // сколько враг летит после подброса

// Анастасия: независимые серии A и B по три удара.
// Надя: B своя серия из трёх. Kris: два взмаха и отскок, B всегда вспышка
export const CHAIN: Record<Form, string[]> = {
  ramil: ['a1', 'a2', 'a3'],
  prime: ['superman', 'highkick', 'teep'],
  ultimate: ['flying-knee', 'elbow', 'roundhouse'],
  nadya: ['a1', 'a2', 'a3'],
  kris: ['a1-back', 'a2', 'hop'],
};
export const HEAVY: Record<Form, string[]> = {
  ramil: ['b1', 'b2', 'b3', 'b4'],
  prime: ['uppercut', 'cross', 'slam'],
  ultimate: ['spin-elbow', 'knee', 'hurricane'],
  nadya: ['b1', 'b2', 'b3-draw'],
  kris: ['b', 'b', 'b'],
};

export const STRIKES: Record<Form, Record<string, Strike>> = {
  ramil: {
    b1: { range: 0, dmg: RAMIL.TELE_DMG, kb: 0, stun: 0, word: 'ВЖУХ' },
    b2: { range: RAMIL.KICK_RANGE, dmg: RAMIL.KICK_DMG, kb: RAMIL.KICK_FLY, stun: 400, down: true, impact: 2, word: 'ПОКА!' },
    b3: { range: RAMIL.FIRE_LEN, dmg: RAMIL.FIRE_DMG, kb: 0, stun: 0 },
    b4: { range: 0, dmg: RAMIL.RETURN_DMG, kb: 0, stun: 0, word: 'Я ТУТ' },
    a1: { range: RAMIL.A1_RANGE, dmg: RAMIL.A1_DMG, kb: RAMIL.A1_KB, stun: RAMIL.A1_STUN, stunMs: RAMIL.A1_STUN, impact: 1, word: 'НА!' },
    a2: { range: RAMIL.A2_RANGE, dmg: RAMIL.A2_DMG, kb: 0, stun: 0 },
  },
  prime: {
    jab: { range: 52, dmg: 5, kb: 2, stun: 250 },
    cross: { range: 54, dmg: 9, kb: 3, stun: 250 },
    teep: { impact: 1, range: 66, dmg: 12, kb: 14, stun: 400, word: 'БУМ!' },
    superman: { impact: 1, range: 86, dmg: 7, kb: 28, stun: 500, rush: true, word: 'ВЖУХ!' },
    highkick: { impact: 1, range: 70, dmg: 9, kb: 30, stun: 500 },
    uppercut: { impact: 1, range: 58, dmg: 7, kb: 10, stun: 500, down: true, launch: true, word: 'ОП!' },
    slam: { impact: 1, range: 70, dmg: 8, kb: 30, stun: 500, down: true, slam: true, word: 'ХРЯСЬ!' },
  },
  ultimate: {
    elbow: { range: 52, dmg: 11, kb: 2, stun: 250 },
    knee: { range: 54, dmg: 12, kb: 3, stun: 250 },
    roundhouse: { impact: 1, range: 72, dmg: 14, kb: 16, stun: 400, word: 'БУМ!' },
    'spin-elbow': { impact: 1, range: 66, dmg: 10, kb: 24, stun: 500, down: true, launch: true, word: 'ОП!' },
    'flying-knee': { impact: 1, range: 86, dmg: 10, kb: 30, stun: 500, rush: true, word: 'ВЖУХ!' },
    hurricane: { impact: 1, range: 75, dmg: 5, kb: 1, stun: 400, word: 'УРАГАН!' }, // на каждое из трёх попаданий
  },
  // Надя: контроль, урон ниже (числа предварительные, nadezhda.md)
  nadya: {
    a1: { range: 80, dmg: 6, kb: 2, stun: 250, word: 'ХЛЯСЬ!' },
    a2: { range: 58, dmg: 7, kb: 3, stun: 450, word: 'БАМ!' },
    a3: { impact: 1, range: 70, dmg: 9, kb: 14, stun: 400, around: true },
    b1: { impact: 1, range: 62, dmg: 7, kb: 4, stun: 300, slowMs: 1500, slow: 0.5, word: 'ШЛЁП!' },
    b2: { range: 50, dmg: 8, kb: 2, stun: 0, single: true, stunMs: 1800, word: 'ОЙ!' },
    'b3-end': { impact: 1, range: 0, dmg: 18, kb: 6, stun: 400, slowMs: 1250, slow: 0.2, kind: 'dash' },
    ult: { range: 0, dmg: 0, kb: 0, stun: 0, kind: 'kiss' }, // воздушный поцелуй: без урона, только ревность
  },
  // Kris: штатив вблизи, вспышка и шар издалека (числа предварительные, kris.md)
  kris: {
    'a1-back': { range: 78, dmg: 5, kb: 0, stun: 0, stunMs: 800, word: 'СТОП!' },
    a2: { impact: 1, range: 78, dmg: 10, kb: 30, stun: 0, stunMs: 800, word: 'ВЖУХ!' },
    b: { range: 320, dmg: 3.7, kb: 2, stun: 500, kind: 'flash' },
    ball: { impact: 1, range: 0, dmg: 25, kb: 20, stun: 500, kind: 'ball' },
  },
};

// Надя: рывок самурая и ревность
export const DASH_DIST = 160; // ~5 ширин фигуры
export const DASH_DELAY_MS = 200; // урон приходит с задержкой после рывка
export const DRAW_HOLD_MS = 300; // замирает с мечом перед рывком
export const NADYA_B_COOLDOWN_MS = 2000;
export const SAMURAI_TIME_MULT = 0.65;
export const CHARM_MS = 6000;
export const KISS_SPEED = 200; // воздушный поцелуй летит втрое медленнее вспышки Kris (FLASH_SPEED / 3)
export const KISS_HALF_W = 16; // полуширина сердца: кого задело по x
export const KISS_BAND = 36; // по глубине: кого задело по y
export const CONTROL_ULT = 5; // шкала ульты Нади за каждого замедленного или оглушённого
// Kris: отскок, вспышка, шар, луч
export const HOP_MS = 350;
export const HOP_DIST = 120;
export const HOP_HEIGHT = 30;
export const FLASH_SPEED = 600; // ед/с, урон приходит, когда вспышка долетела
export const FLASH_CD_MS = 300; // темп вдвое выше, чем был (mr.R 30.10)
export const BALL_PER_HIT = 12.5; // 8 попаданий вспышкой = полный заряд шара
export const BALL_FLIGHT_MS = 450;
export const BALL_RADIUS = 80;
export const BALL_THROW = 300; // дальше шар не бросает
export const BALL_NEAR_NASTYA = 140; // враги в этом радиусе от Анастасии в приоритете
export const AIM_MS = 1000;
export const BEAM_MS = 700;
export const BEAM_DMG = 70;
export const BEAM_LEN = 720; // до края видимой области с запасом
export const KRIS_LENS = { x: 37 * 1.5, y: -46 * 1.5 }; // объектив камеры в позе ult-hold от ступней, в единицах мира
export const BALL_LINES = ['Прикрою!', 'Насть, я в кадре', 'Страховка на месте', 'Работаем вдвоём'];
export const CHARM_LINE = 'Мальчики, не ссорьтесь';

// Что идёт следом за анимацией сама (цепочки приёмов) и сколько ещё держать её последний кадр
export const NEXT_MOVE: Partial<Record<Form, Record<string, string>>> = {
  nadya: { 'b3-draw': 'b3-dash', 'b3-dash': 'b3-end' },
  kris: { 'ult-setup': 'ult-hold', 'ult-hold': 'ult-out' },
};
export const HOLD_MS: Partial<Record<Form, Record<string, number>>> = {
  nadya: { 'b3-draw': DRAW_HOLD_MS * SAMURAI_TIME_MULT },
  kris: { 'ult-hold': AIM_MS + BEAM_MS },
};

// Подписи для кнопки B; у Нади и Рамиля одинаковые имена анимаций.
export const NADYA_MOVE_NAMES: Record<string, string> = { b1: 'Пощёчина', b2: 'По яйцам', 'b3-draw': 'Самурай' };
export const MOVE_NAMES: Record<string, string> = {
  slam: 'Добивание', cross: 'Кросс', knee: 'Колено', superman: 'Суперман', highkick: 'Хай-кик', uppercut: 'Апперкот',
  'spin-elbow': 'Локоть с разворота', 'flying-knee': 'Колено в прыжке', hurricane: 'Ураган',
  ...RAMIL_MOVE_NAMES, 'b3-draw': 'Самурай', b: 'Вспышка',
};

// Снежная буря (утилити-ультимейт): та же шкала заряда, что у превращения
export const STORM_MS = 3000;
export const STORM_TICK_MS = 500;
export const STORM_DMG = 1; // за тик каждому врагу в зоне
export const FREEZE_MS = 700; // заморозка обновляется каждый тик, после бури враги оттаивают через это время
export const STORM_RADIUS = Math.round(STRIKES.ultimate.hurricane.range * RANGE_MULT * 4); // в 4 раза шире урагана

export const SPEED_MULT: Record<Form, number> = { prime: 1, ultimate: 2.5, nadya: 1, kris: 1, ramil: 1 };

export const dirOf = (facing: number): 'east' | 'west' => (facing >= 0 ? 'east' : 'west');
export const moveAnim = (form: Form, move: string) => form === 'ramil' && /^u[1-6]$/.test(move) ? (+move[1] < 3 ? 'flurry' : 'flurry2') : form === 'prime' && move === 'slam' ? SLAM_ANIM : move;
export const animDef = (form: Form, move: string): AnimDef | undefined => HERO_ANIMS[form][moveAnim(form, move)];
export const isLoop = (form: Form, move: string) => !!animDef(form, move)?.loop;

// Удары проигрываются быстрее исходных fps: меньше задержка от нажатия до попадания (mr.R 24.10)
export const ATTACK_SPEED = 1.4;
export const moveSpeed = (form: Form, move: string): number => form === 'ramil' ? 1 : form === 'kris' && move === 'hop' ? 9000 / (16 * HOP_MS) : form === 'nadya' && move.startsWith('b3-') ? (STRIKES[form][move] ? ATTACK_SPEED : 1) / SAMURAI_TIME_MULT : (STRIKES[form][move] ? ATTACK_SPEED : 1);

export function moveDurMs(form: Form, move: string, facing: number): number {
  const a = animDef(form, move);
  return a ? (a[dirOf(facing)] * 1000) / (a.fps * moveSpeed(form, move)) : 0;
}
// Вместе с удержанием последнего кадра (замирание Нади, прицел и луч Kris)
export const moveTotalMs = (form: Form, move: string, facing: number) => moveDurMs(form, move, facing) + (HOLD_MS[form]?.[move] ?? 0);

// Моменты попаданий от начала анимации, мс (начало кадра удара)
export function hitTimesMs(form: Form, move: string, facing: number): number[] {
  const a = animDef(form, move);
  if (!a) return [];
  const frames = a.hits ?? (a.hit ? [a.hit[dirOf(facing)]] : []);
  return frames.map(f => (f * 1000) / (a.fps * moveSpeed(form, move)));
}

// Один цикл может содержать несколько ладоней: каждому hit отведён свой шаг.
export function flurryTiming(move: string, facing: number, def = HERO_ANIMS.ramil[Number(move[1]) < 3 ? 'flurry' : 'flurry2']) {
  const level = Number(move[1]) - 1, clip = level < 2 ? 'flurry' : 'flurry2';
  const n = def[dirOf(facing)], marks = def.hits ?? [def.hit?.[dirOf(facing)] ?? 0];
  const step = RAMIL.ULT_STEPS[level], count = RAMIL.ULT_HITS[level];
  const intro = (level === 0 || level === 2) ? moveDurMs('ramil', clip + '-in', facing) : 0;
  const recover = moveDurMs('ramil', clip + '-out', facing);
  const times = Array.from({ length: count }, (_, k) => intro + (Math.floor(k / marks.length) + marks[k % marks.length] / n) * step * marks.length);
  let stop = 0;
  const stops = times.map((time, k) => { const at = time + stop; stop += k === count - 1 ? RAMIL.ULT_LAST_STOP : RAMIL.ULT_HITSTOP[level]; return at; });
  return { level, clip, n, marks, step, count, intro, recover, stops, activeMs: intro + count * step + stop, hasOut: !!HERO_ANIMS.ramil[clip + '-out'], times, duration: intro + count * step + stop + recover };
}
export function flurryPose(move: string, t: number, facing: number, dashMs = 0) {
  const f = flurryTiming(move, facing);
  if (t < dashMs) return { clip: 'dash', frame: Math.floor(t * HERO_ANIMS.ramil.dash.fps / 1000) % HERO_ANIMS.ramil.dash[dirOf(facing)], active: false };
  t = Math.max(0, t - dashMs);
  for (let k = 0; k < f.count; k++) {
    const stop = k === f.count - 1 ? RAMIL.ULT_LAST_STOP : RAMIL.ULT_HITSTOP[f.level];
    if (t >= f.stops[k] && t < f.stops[k] + stop) return { clip: f.clip, frame: f.marks[k % f.marks.length], active: true };
  }
  t -= f.stops.reduce((sum, at, k) => sum + (t >= at + (k === f.count - 1 ? RAMIL.ULT_LAST_STOP : RAMIL.ULT_HITSTOP[f.level]) ? (k === f.count - 1 ? RAMIL.ULT_LAST_STOP : RAMIL.ULT_HITSTOP[f.level]) : 0), 0);
  if (t < f.intro) return { clip: f.clip + '-in', frame: Math.floor(t * HERO_ANIMS.ramil[f.clip + '-in'].fps / 1000), active: false };
  t -= f.intro;
  if (t < f.count * f.step) return { clip: f.clip, frame: Math.floor((t % (f.step * f.marks.length)) / (f.step * f.marks.length) * f.n), active: true };
  const out = f.clip + '-out', def = HERO_ANIMS.ramil[out];
  return { clip: def ? out : 'idle', frame: def ? Math.min(def[dirOf(facing)] - 1, Math.floor((t - f.count * f.step) * def.fps / 1000)) : 0, active: false };
}

// Общая фаза оборота для симуляции и рендера.
export function ramilSpin(t: number) {
  let start = 0;
  for (let turn = 0; turn < RAMIL.SPIN_TURN_MS.length; turn++) {
    const ms = RAMIL.SPIN_TURN_MS[turn];
    if (t < start + ms || turn === RAMIL.SPIN_TURNS - 1) {
      const phase = Math.max(0, Math.min(1, (t - start) / ms));
      return { turn, phase, angle: (turn + phase) * Math.PI * 2 };
    }
    start += ms;
  }
  return { turn: 0, phase: 0, angle: 0 };
}
