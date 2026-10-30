// Боевые данные героев со спрайтами: серии, удары, числа. Тайминги кадров берутся из anims-data.ts.
import { HERO_ANIMS, type AnimDef, type Form } from './anims-data.ts';

export const HERO_ID = 'anastasia';
export const NADYA_ID = 'nadezhda';
export const KRIS_ID = 'kris';
// Персонаж -> его стартовый набор спрайтов (у Анастасии две формы, у остальных одна)
export const HERO_FORM: Record<string, Form> = { [HERO_ID]: 'prime', [NADYA_ID]: 'nadya', [KRIS_ID]: 'kris' };
export const isSpriteHero = (char: string) => char in HERO_FORM;
export const RANGE_MULT = 1.3; // дальность всех ударов героини +30% (mr.R 24.10)
export const ULT_MS = 16000; // сколько длится Ultimate
export const COMBO_MS = 700; // окно, в которое следующий удар продолжает серию
export const COMBO_MS_BY: Partial<Record<Form, number>> = { nadya: 1000, kris: 1000 }; // гостям-негеймерам окно шире
export const HURT_INVULN_MS = 800;
export const IMMUNE_INVULN_MS = 300; // в Ultimate удары по героине не прерывают её, но подряд не копятся
export const KNOCK_MULT: Record<Form, number> = { prime: 2, ultimate: 4, nadya: 2, kris: 2 }; // отбрасывание врагов по просьбе mr.R: зрелищность
export const HITSTOP_MS = 50; // заморозка героини при попадании (один тик)
export const HITSTOP_HEAVY_MS = 100; // при сбивании с ног
export const RUN_MULT = 1.7; // бег: стик на максимум (или Shift)

// Анастасия: врыв, магнит и воздушные серии.
export const SLAM_ANIM = 'highkick'; // замена до генерации axe
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
  word?: string; // комиксное слово над попаданием
  kind?: 'flash' | 'ball' | 'kiss' | 'dash'; // особое действие в кадре удара вместо обычного попадания
}
export const AIR_MS = 900; // сколько враг летит после подброса

// Анастасия: независимые серии A и B по три удара.
// Надя: B своя серия из трёх (B, B B, B B B). Kris: серия A из двух (mr.R 30.10: третий удар убран), B всегда вспышка
export const CHAIN: Record<Form, string[]> = {
  prime: ['superman', 'highkick', 'teep'],
  ultimate: ['flying-knee', 'elbow', 'roundhouse'],
  nadya: ['a1', 'a2', 'a3'],
  kris: ['a1', 'a2'],
};
export const HEAVY: Record<Form, string[]> = {
  prime: ['uppercut', 'cross', 'slam'],
  ultimate: ['spin-elbow', 'knee', 'hurricane'],
  nadya: ['b1', 'b2', 'b3-draw'],
  kris: ['b', 'b', 'b'],
};

export const STRIKES: Record<Form, Record<string, Strike>> = {
  prime: {
    jab: { range: 52, dmg: 5, kb: 2, stun: 250 },
    cross: { range: 54, dmg: 7, kb: 3, stun: 250 },
    teep: { range: 66, dmg: 10, kb: 14, stun: 400, word: 'БУМ!' },
    superman: { range: 86, dmg: 15, kb: 28, stun: 500, rush: true, word: 'ВЖУХ!' },
    highkick: { range: 70, dmg: 25, kb: 30, stun: 500 },
    uppercut: { range: 58, dmg: 25, kb: 10, stun: 500, down: true, launch: true, word: 'ОП!' },
    slam: { range: 70, dmg: 25, kb: 30, stun: 500, down: true, slam: true, word: 'ХРЯСЬ!' },
  },
  ultimate: {
    elbow: { range: 52, dmg: 15, kb: 2, stun: 250 },
    knee: { range: 54, dmg: 20, kb: 3, stun: 250 },
    roundhouse: { range: 72, dmg: 25, kb: 16, stun: 400, word: 'БУМ!' },
    'spin-elbow': { range: 66, dmg: 30, kb: 24, stun: 500, down: true, launch: true, word: 'ОП!' },
    'flying-knee': { range: 86, dmg: 35, kb: 30, stun: 500, rush: true, word: 'ВЖУХ!' },
    hurricane: { range: 75, dmg: 30, kb: 1, stun: 400, word: 'УРАГАН!' }, // на каждое из трёх попаданий
  },
  // Надя: контроль, урон ниже (числа предварительные, nadezhda.md)
  nadya: {
    a1: { range: 80, dmg: 4, kb: 2, stun: 250, word: 'ХЛЯСЬ!' },
    a2: { range: 58, dmg: 5, kb: 3, stun: 450, word: 'БАМ!' },
    a3: { range: 70, dmg: 6, kb: 14, stun: 400, around: true },
    b1: { range: 62, dmg: 5, kb: 4, stun: 300, slowMs: 1500, slow: 0.5, word: 'ШЛЁП!' },
    b2: { range: 50, dmg: 6, kb: 2, stun: 0, single: true, stunMs: 1800, word: 'ОЙ!' },
    'b3-end': { range: 0, dmg: 10, kb: 6, stun: 400, slowMs: 1250, slow: 0.2, kind: 'dash' },
    ult: { range: 0, dmg: 0, kb: 0, stun: 0, kind: 'kiss' }, // воздушный поцелуй: без урона, только ревность
  },
  // Kris: штатив вблизи, вспышка и шар издалека (числа предварительные, kris.md)
  kris: {
    a1: { range: 78, dmg: 5, kb: 3, stun: 250 },
    a2: { range: 70, dmg: 6, kb: 4, stun: 250 },
    b: { range: 320, dmg: 4, kb: 2, stun: 500, kind: 'flash' },
    ball: { range: 0, dmg: 20, kb: 20, stun: 500, kind: 'ball' },
  },
};

// Надя: рывок самурая и ревность
export const DASH_DIST = 160; // ~5 ширин фигуры
export const DASH_DELAY_MS = 200; // урон приходит с задержкой после рывка
export const DRAW_HOLD_MS = 300; // замирает с мечом перед рывком
export const CHARM_MS = 6000;
export const KISS_SPEED = 200; // воздушный поцелуй летит втрое медленнее вспышки Kris (FLASH_SPEED / 3)
export const KISS_HALF_W = 16; // полуширина сердца: кого задело по x
export const KISS_BAND = 36; // по глубине: кого задело по y
export const CONTROL_ULT = 5; // шкала ульты Нади за каждого замедленного или оглушённого
// Kris: вспышка, шар, луч
export const FLASH_SPEED = 600; // ед/с, урон приходит, когда вспышка долетела
export const FLASH_CD_MS = 300; // темп вдвое выше, чем был (mr.R 30.10)
export const BALL_PER_HIT = 12.5; // 8 попаданий вспышкой = полный заряд шара
export const BALL_FLIGHT_MS = 450;
export const BALL_RADIUS = 80;
export const BALL_THROW = 300; // дальше шар не бросает
export const BALL_NEAR_NASTYA = 140; // враги в этом радиусе от Анастасии в приоритете
export const AIM_MS = 1000;
export const BEAM_MS = 700;
export const BEAM_DMG = 40;
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
  nadya: { 'b3-draw': DRAW_HOLD_MS },
  kris: { 'ult-hold': AIM_MS + BEAM_MS },
};

// Подписи для кнопки B
export const MOVE_NAMES: Record<string, string> = {
  slam: 'Добивание', cross: 'Кросс', knee: 'Колено', superman: 'Суперман', highkick: 'Хай-кик', uppercut: 'Апперкот',
  'spin-elbow': 'Локоть с разворота', 'flying-knee': 'Колено в прыжке', hurricane: 'Ураган',
  b1: 'Пощёчина', b2: 'По яйцам', 'b3-draw': 'Самурай', b: 'Вспышка',
};

// Снежная буря (утилити-ультимейт): та же шкала заряда, что у превращения
export const STORM_MS = 3000;
export const STORM_TICK_MS = 500;
export const STORM_DMG = 1; // за тик каждому врагу в зоне
export const FREEZE_MS = 700; // заморозка обновляется каждый тик, после бури враги оттаивают через это время
export const STORM_RADIUS = Math.round(STRIKES.ultimate.hurricane.range * RANGE_MULT * 4); // в 4 раза шире урагана

export const SPEED_MULT: Record<Form, number> = { prime: 1, ultimate: 2.5, nadya: 1, kris: 1 };

export const dirOf = (facing: number): 'east' | 'west' => (facing >= 0 ? 'east' : 'west');
export const moveAnim = (form: Form, move: string) => form === 'prime' && move === 'slam' ? SLAM_ANIM : move;
export const animDef = (form: Form, move: string): AnimDef | undefined => HERO_ANIMS[form][moveAnim(form, move)];
export const isLoop = (form: Form, move: string) => !!animDef(form, move)?.loop;

// Удары проигрываются быстрее исходных fps: меньше задержка от нажатия до попадания (mr.R 24.10)
export const ATTACK_SPEED = 1.4;
export const moveSpeed = (form: Form, move: string): number => (STRIKES[form][move] ? ATTACK_SPEED : 1);

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
