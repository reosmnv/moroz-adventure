// Данные маршрута «подъезд 3 → метро Беговая → вагон → Маяковская → Москва-Сити → главный МФЦ» (ТЗ-04 и далее).
// Ведёт Claude: значения подобраны по картинкам (tools/route_build.py), Codex не правит.
// Координаты мира: фон 320x180 растянут x1.5, высота 270. lane = верх полосы ходьбы по точкам (x, y).
// Низ стены у всех фонов собран на y=100 src = 150 мира (55% высоты), полоса 150..255 = 105.
import type { Stage } from './levels.ts';

const TOP = 150; // верх полосы = низ стены на всех экранах маршрута
const flat = (w: number): [number, number][] => [[0, TOP], [w, TOP]];
const DECAL = -500; // декали на полу рисуются под героями

export const ROUTE: Stage[] = [
  {
    // 6 экранов: подъезд 3 → подъезд 4 → его зеркало (подъезд 5) → столпы → зеркало столпов → проход под домом (выход)
    id: 'street',
    cards: [['08:47. НАСТЮ ТОЛЬКО ЧТО СТЁРЛИ', 'ПОДЪЕЗД 3']],
    width: 2880,
    lane: flat(2880),
    laneBottom: 255,
    spawn: [80, 200],
    exit: { x0: 2608, x1: 2688, y1: 172 },
    layers: [{ file: 'route/street.png' }],
    props: [
      { file: 'route/props/lamp.png', x: 420, y: 147, scale: 1 },
      { file: 'route/props/urn.png', x: 760, y: 148 },
      { file: 'route/props/street_bench.png', x: 1080, y: 148 },
      { file: 'route/props/lamp.png', x: 1520, y: 147, scale: 1 },
      { file: 'route/props/urn.png', x: 1860, y: 148 },
      { file: 'route/props/street_bench.png', x: 2160, y: 148 },
      { file: 'route/props/lamp.png', x: 2420, y: 147, scale: 1 },
      { file: 'route/props/manhole.png', x: 1080, y: 222, scale: 1, depth: DECAL },
      { file: 'route/props/manhole.png', x: 1900, y: 196, scale: 1, depth: DECAL },
      { file: 'route/props/manhole.png', x: 2450, y: 232, scale: 1, depth: DECAL },
    ],
    signs: [
      { text: 'ПОДЪЕЗД 3', x: 196, y: 62, size: 8, color: '#ffffff', bg: '#1f4e8c' },
      { text: 'ПОДЪЕЗД 4', x: 630, y: 34, size: 8, color: '#ffffff', bg: '#1f4e8c' },
      { text: 'ПОДЪЕЗД 5', x: 1302, y: 34, size: 8, color: '#ffffff', bg: '#1f4e8c' },
    ],
  },
  {
    // Двор: зеркало двора, двор (yard_a), павильон «Беговая», выход 3 (rt_e). Выход в двери павильона
    id: 'yard',
    cards: [['ДО МЕТРО 300 МЕТРОВ. И ТОЛПА', 'ДВОР']],
    width: 1290,
    lane: flat(1290),
    laneBottom: 255,
    spawn: [80, 200],
    exit: { x0: 903, x1: 953, y1: 172 },
    layers: [{ file: 'route/yard.png' }],
    props: [
      { file: 'route/props/street_bench.png', x: 150, y: 148 },
      { file: 'route/props/street_bench.png', x: 655, y: 148 },
      { file: 'route/props/bin.png', x: 705, y: 148 },
      { file: 'route/props/manhole.png', x: 300, y: 214, scale: 1, depth: DECAL },
      { file: 'route/props/manhole.png', x: 785, y: 230, scale: 1, depth: DECAL },
    ],
    signs: [
      { text: 'БЕГОВАЯ', x: 1005, y: 60, size: 8, color: '#ffffff', bg: '#c8102e' },
      { text: 'ВЫХОД 3', x: 930, y: 82, size: 8, color: '#ffffff', bg: '#1f2a44' },
    ],
  },
  {
    // Вестибюль выхода 3 (условно, референса нет): двойные двери, кассы, турникеты → эскалаторы вниз. Выход у эскалатора
    id: 'vestibule',
    cards: [['ТУРНИКЕТЫ НЕ ДЛЯ НЕСУЩЕСТВУЮЩИХ', '«БЕГОВАЯ»']],
    width: 1440,
    walkX: [20, 1245],
    lane: flat(1440),
    laneBottom: 255,
    spawn: [80, 200],
    exit: { x0: 1208, x1: 1280, y1: 255 },
    layers: [{ file: 'route/vestibule.png' }],
    props: [],
    signs: [
      { text: 'ВЫХОД В ГОРОД', x: 480, y: 42, size: 8, color: '#ffffff', bg: '#1f2a44' },
      { text: 'БЕГОВАЯ', x: 1046, y: 72, size: 8, color: '#ffffff' },
      { text: 'К ПОЕЗДАМ', x: 1320, y: 24, size: 8, color: '#ffffff', bg: '#1f2a44' },
    ],
  },
  {
    // Вагон 81-765 (wagon_w1, 5 повторов): в окнах бежит тоннель. Выход в последнюю дверь
    id: 'wagon',
    cards: [['СЛЕДУЮЩАЯ СТАНЦИЯ: ПРОБЛЕМЫ', 'ВАГОН']],
    width: 2400,
    lane: flat(2400),
    laneBottom: 255,
    spawn: [80, 200],
    exit: { x0: 2298, x1: 2378, y1: 172 },
    layers: [{ file: 'route/wagon.png', fx: 'tunnel' }],
    tunnel: { y0: 50, y1: 108, speed: 900 },
    props: [],
    signs: [],
  },
  {
    // Маяковская (mayak_w1, экран + зеркальные куски по центрам арок): за арками приходит и уходит поезд.
    // Выход у правого края (позже откроется только после победы над боссами)
    id: 'mayak',
    cards: [['СЕГОДНЯ КОНЦЕРТ. БИЛЕТОВ НЕТ', '«МАЯКОВСКАЯ»']],
    width: 1510,
    lane: flat(1510),
    laneBottom: 255,
    spawn: [80, 200],
    exit: { x0: 1465, x1: 1510, y1: 255 },
    layers: [{ file: 'route/mayak-back.png' }, { file: 'route/mayak.png', fx: 'train' }],
    train: { y: 60, h: 84, arriveMs: 3500, standMs: 5000, leaveMs: 3500, emptyMs: 5000 },
    props: [
      // Сцена для финального босса: отдельный спрайт, низ на линии стены, ступени вниз к героям
      { file: 'route/props/stage_b.png', x: 940, y: 149, scale: 1 },
      { file: 'route/props/metro_bench.png', x: 170, y: 148 },
      { file: 'route/props/metro_bench.png', x: 450, y: 148 },
      { file: 'route/props/metro_bench.png', x: 800, y: 148 },
    ],
    signs: [
      { text: 'МАЯКОВСКАЯ', x: 300, y: 66, size: 8, color: '#f6e7c8', bg: '#3b2a20' },
      { text: 'МАЯКОВСКАЯ', x: 900, y: 66, size: 8, color: '#f6e7c8', bg: '#3b2a20' },
    ],
  },
  {
    // Улица у Москва-Сити (день): кафе, остановка с газоном, зеркала, вход в главный МФЦ (без привязки к реальному). Выход в двери
    id: 'city',
    cards: [['ТУТ ПРОДАЮТ КУРС «КАК СУЩЕСТВОВАТЬ»', 'МОСКВА-СИТИ']],
    width: 2400,
    lane: flat(2400),
    laneBottom: 255,
    spawn: [80, 200],
    exit: { x0: 2110, x1: 2205, y1: 172 },
    layers: [{ file: 'route/city.png' }],
    props: [
      { file: 'route/props/street_bench.png', x: 700, y: 148 },
      { file: 'route/props/bin.png', x: 1000, y: 148 },
      { file: 'route/props/street_bench.png', x: 1700, y: 148 },
      { file: 'route/props/manhole.png', x: 520, y: 226, scale: 1, depth: DECAL },
      { file: 'route/props/manhole.png', x: 1500, y: 204, scale: 1, depth: DECAL },
    ],
    signs: [
      { text: 'ГЛАВНЫЙ МФЦ', x: 2160, y: 70, size: 8, color: '#1f3a6b' },
    ],
  },
  {
    // Главный МФЦ, 9 экранов: вход (рамки, охрана), окна 1-6, ожидание (вендинг, детский уголок), архив (фотобудка),
    // окна 7-12, кабинеты (руководитель), ожидание, архив, главный зал (красная дорожка к главному окну). Финал, выхода нет
    id: 'mfc',
    cards: [['ОКНО 1. ПОСЛЕДНЯЯ ИНСТАНЦИЯ', 'ГЛАВНЫЙ МФЦ']],
    width: 4320,
    lane: flat(4320),
    laneBottom: 255,
    spawn: [80, 200],
    layers: [{ file: 'route/mfc.png' }],
    props: [],
    signs: [
      { text: 'ВХОД', x: 33, y: 63, size: 8, color: '#ffffff', bg: '#1f3a6b' },
      { text: 'ТАЛОНЫ', x: 142, y: 99, size: 8, color: '#ffffff', bg: '#2e7d4f' },
      { text: 'ОХРАНА', x: 308, y: 102, size: 8, color: '#ffffff', bg: '#5a5f6b' },
      { text: '1', x: 540, y: 68, size: 8, color: '#ff4040' },
      { text: '2', x: 578, y: 68, size: 8, color: '#ff4040' },
      { text: '3', x: 612, y: 68, size: 8, color: '#ff4040' },
      { text: '4', x: 648, y: 68, size: 8, color: '#ff4040' },
      { text: '5', x: 686, y: 68, size: 8, color: '#ff4040' },
      { text: '6', x: 722, y: 68, size: 8, color: '#ff4040' },
      { text: 'ВАШ ТАЛОН\nА-000', x: 806, y: 70, size: 8, color: '#ffffff' },
      { text: 'ОЖИДАЙТЕ\nВЫЗОВА', x: 1106, y: 70, size: 8, color: '#ffffff' },
      { text: 'ДЕТИ', x: 1398, y: 111, size: 8, color: '#ffffff', bg: '#e07a2e' },
      { text: 'ФОТО', x: 1467, y: 63, size: 8, color: '#ffffff', bg: '#1f3a6b' },
      { text: 'АРХИВ', x: 1590, y: 51, size: 8, color: '#ffffff', bg: '#5a5f6b' },
      { text: '7', x: 2158, y: 68, size: 8, color: '#ff4040' },
      { text: '8', x: 2194, y: 68, size: 8, color: '#ff4040' },
      { text: '9', x: 2232, y: 68, size: 8, color: '#ff4040' },
      { text: '10', x: 2268, y: 68, size: 8, color: '#ff4040' },
      { text: '11', x: 2302, y: 68, size: 8, color: '#ff4040' },
      { text: '12', x: 2340, y: 68, size: 8, color: '#ff4040' },
      { text: 'ВЫ НЕ\nСУЩЕСТВ.', x: 2074, y: 70, size: 8, color: '#ffffff' },
      { text: '101', x: 2496, y: 66, size: 8, color: '#1f3a6b' },
      { text: 'РУКОВОДИТЕЛЬ', x: 2607, y: 66, size: 8, color: '#ffffff', bg: '#5a3a2a' },
      { text: '102', x: 2847, y: 66, size: 8, color: '#1f3a6b' },
      { text: 'ОБЪЯВЛЕНИЯ', x: 2726, y: 60, size: 8, color: '#1f3a6b' },
      { text: 'ПЕРЕРЫВ\n13-14', x: 3214, y: 70, size: 8, color: '#ffffff' },
      { text: 'АРХИВ 2', x: 3690, y: 51, size: 8, color: '#ffffff', bg: '#5a5f6b' },
      { text: 'ФОТО', x: 3813, y: 63, size: 8, color: '#ffffff', bg: '#1f3a6b' },
      { text: 'ГЛАВНОЕ ОКНО', x: 4080, y: 50, size: 8, color: '#ffd84a' },
      { text: 'СТАТУС:\nНЕ СУЩ.', x: 3926, y: 70, size: 8, color: '#ff4040' },
      { text: 'ВЕРНУТЬ\nНАСТЮ', x: 4233, y: 70, size: 8, color: '#ffffff' },
    ],
  },
];
