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
    cards: [['УРОВЕНЬ 1', 'ПОДЪЕЗД 3']],
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
    cards: [['ДВОР', 'К МЕТРО «БЕГОВАЯ»']],
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
    cards: [['ВЫХОД 3', 'ВЕСТИБЮЛЬ']],
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
    cards: [['ПОЕЗДКА', 'ВАГОН']],
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
    cards: [['ПЕРЕСАДКА', 'ПУШКИНСКАЯ → ТВЕРСКАЯ'], ['СТАНЦИЯ', 'МАЯКОВСКАЯ']],
    width: 1510,
    lane: flat(1510),
    laneBottom: 255,
    spawn: [80, 200],
    exit: { x0: 1465, x1: 1510, y1: 255 },
    layers: [{ file: 'route/mayak-back.png' }, { file: 'route/mayak.png', fx: 'train' }],
    train: { y: 60, h: 84, arriveMs: 3500, standMs: 5000, leaveMs: 3500, emptyMs: 5000 },
    props: [
      // Сцена для финального босса: отдельный спрайт, низ на линии стены, ступени вниз к героям
      { file: 'route/props/stage_b.png', x: 1240, y: 149, scale: 1 },
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
    cards: [['МОСКВА-СИТИ', 'К ГЛАВНОМУ МФЦ']],
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
    // Зал главного МФЦ (mfc_int, экран + зеркало + экран): окна приёма, табло. Финальная арена, выхода нет
    id: 'mfc',
    cards: [['ГЛАВНЫЙ МФЦ', 'ВЕРНУТЬ НАСТЮ']],
    width: 1440,
    lane: flat(1440),
    laneBottom: 255,
    spawn: [80, 200],
    layers: [{ file: 'route/mfc.png' }],
    props: [],
    signs: [
      { text: '1', x: 60, y: 66, size: 8, color: '#ff4040' },
      { text: '2', x: 98, y: 66, size: 8, color: '#ff4040' },
      { text: '3', x: 132, y: 66, size: 8, color: '#ff4040' },
      { text: '4', x: 168, y: 66, size: 8, color: '#ff4040' },
      { text: '5', x: 206, y: 66, size: 8, color: '#ff4040' },
      { text: '6', x: 242, y: 66, size: 8, color: '#ff4040' },
      { text: '7', x: 718, y: 66, size: 8, color: '#ff4040' },
      { text: '8', x: 754, y: 66, size: 8, color: '#ff4040' },
      { text: '9', x: 792, y: 66, size: 8, color: '#ff4040' },
      { text: '10', x: 828, y: 66, size: 8, color: '#ff4040' },
      { text: '11', x: 862, y: 66, size: 8, color: '#ff4040' },
      { text: '12', x: 900, y: 66, size: 8, color: '#ff4040' },
      { text: '13', x: 1020, y: 66, size: 8, color: '#ff4040' },
      { text: '14', x: 1058, y: 66, size: 8, color: '#ff4040' },
      { text: '15', x: 1092, y: 66, size: 8, color: '#ff4040' },
      { text: '16', x: 1128, y: 66, size: 8, color: '#ff4040' },
      { text: '17', x: 1166, y: 66, size: 8, color: '#ff4040' },
      { text: '18', x: 1202, y: 66, size: 8, color: '#ff4040' },
      { text: 'ВАШ ТАЛОН\nА-000', x: 324, y: 65, size: 8, color: '#ffffff' },
      { text: 'ВЫ НЕ\nСУЩЕСТВ.', x: 636, y: 65, size: 8, color: '#ffffff' },
      { text: 'ОЖИДАЙТЕ', x: 1284, y: 65, size: 8, color: '#ffffff' },
    ],
  },
];
