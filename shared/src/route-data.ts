// Данные маршрута «подъезд 3 → метро Беговая → вагон → Маяковская» (ТЗ-04).
// Ведёт Claude: значения подобраны по картинкам (tools/route_build.py), Codex не правит.
// Координаты мира: фон 320x180 растянут x1.5, высота 270. lane = верх полосы ходьбы по точкам (x, y).
// Низ стены у всех фонов собран на y=100 src = 150 мира (55% высоты), полоса 150..255 = 105.
import type { Stage } from './levels.ts';

const TOP = 150; // верх полосы = низ стены на всех экранах маршрута
const flat = (w: number): [number, number][] => [[0, TOP], [w, TOP]];
const DECAL = -500; // декали на полу рисуются под героями

export const ROUTE: Stage[] = [
  {
    // 4 экрана: подъезд 3 (rt_s_start_v1) → подъезд 4 (rt_a) → столпы (rt_c) → проход под домом (rt_d), выход в проход
    id: 'street',
    cards: [['УРОВЕНЬ 1', 'ПОДЪЕЗД 3']],
    width: 1920,
    lane: flat(1920),
    laneBottom: 255,
    spawn: [80, 200],
    exit: { x0: 1648, x1: 1728, y1: 172 },
    layers: [{ file: 'route/street.png' }],
    props: [
      { file: 'route/props/lamp.png', x: 420, y: 147, scale: 1 },
      { file: 'route/props/urn.png', x: 760, y: 148 },
      { file: 'route/props/street_bench.png', x: 1010, y: 148 },
      { file: 'route/props/lamp.png', x: 1290, y: 147, scale: 1 },
      { file: 'route/props/urn.png', x: 1560, y: 148 },
      { file: 'route/props/manhole.png', x: 1080, y: 222, scale: 1, depth: DECAL },
      { file: 'route/props/manhole.png', x: 1500, y: 196, scale: 1, depth: DECAL },
    ],
    signs: [
      { text: 'ПОДЪЕЗД 3', x: 196, y: 62, size: 8, color: '#ffffff', bg: '#1f4e8c' },
      { text: 'ПОДЪЕЗД 4', x: 630, y: 34, size: 8, color: '#ffffff', bg: '#1f4e8c' },
    ],
  },
  {
    // Двор (yard_a) → павильон «Беговая», выход 3 (rt_e). Выход в двери павильона
    id: 'yard',
    cards: [['ДВОР', 'К МЕТРО «БЕГОВАЯ»']],
    width: 885,
    lane: flat(885),
    laneBottom: 255,
    spawn: [80, 200],
    exit: { x0: 498, x1: 548, y1: 172 },
    layers: [{ file: 'route/yard.png' }],
    props: [
      { file: 'route/props/street_bench.png', x: 250, y: 148 },
      { file: 'route/props/bin.png', x: 300, y: 148 },
      { file: 'route/props/manhole.png', x: 380, y: 230, scale: 1, depth: DECAL },
    ],
    signs: [
      { text: 'БЕГОВАЯ', x: 600, y: 60, size: 8, color: '#ffffff', bg: '#c8102e' },
      { text: 'ВЫХОД 3', x: 525, y: 82, size: 8, color: '#ffffff', bg: '#1f2a44' },
    ],
  },
  {
    // Вестибюль выхода 3 (условно, референса нет): двери, кассы, турникеты → эскалаторы вниз. Выход у эскалатора
    id: 'vestibule',
    cards: [['ВЫХОД 3', 'ВЕСТИБЮЛЬ']],
    width: 960,
    walkX: [20, 765],
    lane: flat(960),
    laneBottom: 255,
    spawn: [80, 200],
    exit: { x0: 728, x1: 800, y1: 255 },
    layers: [{ file: 'route/vestibule.png' }],
    props: [],
    signs: [
      { text: 'ВЫХОД В ГОРОД', x: 90, y: 42, size: 8, color: '#ffffff', bg: '#1f2a44' },
      { text: 'БЕГОВАЯ', x: 566, y: 72, size: 8, color: '#ffffff' },
      { text: 'К ПОЕЗДАМ', x: 840, y: 24, size: 8, color: '#ffffff', bg: '#1f2a44' },
    ],
  },
  {
    // Вагон 81-765 (wagon_w1, 3 повтора): в окнах бежит тоннель. Выход в последнюю дверь
    id: 'wagon',
    cards: [['ПОЕЗДКА', 'ВАГОН']],
    width: 1440,
    lane: flat(1440),
    laneBottom: 255,
    spawn: [80, 200],
    exit: { x0: 1338, x1: 1418, y1: 172 },
    layers: [{ file: 'route/wagon.png', fx: 'tunnel' }],
    tunnel: { y0: 50, y1: 108, speed: 900 },
    props: [],
    signs: [],
  },
  {
    // Маяковская (mayak_w1, экран + зеркало по центрам арок): за арками приходит и уходит поезд.
    // Выход у правого края (позже откроется только после победы над боссами)
    id: 'mayak',
    cards: [['ПЕРЕСАДКА', 'ПУШКИНСКАЯ → ТВЕРСКАЯ'], ['СТАНЦИЯ', 'МАЯКОВСКАЯ']],
    width: 946,
    lane: flat(946),
    laneBottom: 255,
    spawn: [80, 200],
    exit: { x0: 900, x1: 946, y1: 255 },
    layers: [{ file: 'route/mayak-back.png' }, { file: 'route/mayak.png', fx: 'train' }],
    train: { y: 60, h: 84, arriveMs: 3500, standMs: 5000, leaveMs: 3500, emptyMs: 5000 },
    props: [
      // Сцена для финального босса: отдельный спрайт, низ на линии стены, ступени вниз к героям
      { file: 'route/props/stage_b.png', x: 700, y: 149, scale: 1 },
      { file: 'route/props/metro_bench.png', x: 170, y: 148 },
      { file: 'route/props/metro_bench.png', x: 450, y: 148 },
    ],
    signs: [
      { text: 'МАЯКОВСКАЯ', x: 300, y: 66, size: 8, color: '#f6e7c8', bg: '#3b2a20' },
    ],
  },
  {
    // Москва-Сити у главного МФЦ (Афимолл, Пресненская наб., 2): свод на колоннах, КПП с колючкой, экраны. Выход в двери МФЦ
    id: 'city',
    cards: [['МОСКВА-СИТИ', 'К ГЛАВНОМУ МФЦ']],
    width: 1440,
    lane: flat(1440),
    laneBottom: 255,
    spawn: [80, 200],
    exit: { x0: 1172, x1: 1262, y1: 172 },
    layers: [{ file: 'route/city.png' }],
    props: [],
    signs: [
      { text: 'ВЫ НЕ\nСУЩЕСТВУЕТЕ', x: 838, y: 69, size: 8, color: '#ffffff' },
      { text: 'ОЧЕРЕДЬ 9999', x: 300, y: 72, size: 8, color: '#0b2a33' },
      { text: 'ГЛАВНЫЙ МФЦ', x: 1200, y: 92, size: 8, color: '#ffffff', bg: '#1a1f2b' },
    ],
  },
  {
    // Зал главного МФЦ (mfc_v0 без яруса балконов + зеркало): окна приёма, табло, камеры. Финальная арена, выхода нет
    id: 'mfc',
    cards: [['ГЛАВНЫЙ МФЦ', 'ВЕРНУТЬ НАСТЮ']],
    width: 960,
    lane: flat(960),
    laneBottom: 255,
    spawn: [80, 200],
    layers: [{ file: 'route/mfc.png' }],
    props: [],
    signs: [
      { text: 'ОКНО 1', x: 480, y: 80, size: 8, color: '#ff5050', bg: '#10151c' },
    ],
  },
];
