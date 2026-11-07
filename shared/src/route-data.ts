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
    cards: [['РЕЗИДЕНТСТВО АННУЛИРОВАНО', 'ПОДЪЕЗД 3']],
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
    signs: [],
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
    signs: [],
  },
  {
    // Вестибюль выхода 3 (условно, референса нет): двойные двери, кассы, турникеты → эскалаторы вниз. Выход у эскалатора
    id: 'vestibule',
    cards: [['ТУРНИКЕТЫ ПРОТИВ РОЗЫСКА', '«БЕГОВАЯ»']],
    width: 1440,
    walkX: [20, 1245],
    lane: flat(1440),
    laneBottom: 255,
    spawn: [80, 200],
    exit: { x0: 1208, x1: 1280, y1: 255 },
    layers: [{ file: 'route/vestibule.png' }],
    props: [],
    signs: [],
  },
  {
    // Вагон 81-765 (wagon_w1, 5 повторов): в окнах бежит тоннель. Выход в последнюю дверь
    id: 'wagon',
    cards: [['СЛЕДУЮЩАЯ СТАНЦИЯ: ПРОБЛЕМЫ', 'ВАГОН'], ['РАЗЫСКИВАЕМЫХ ПРОСЯТ ВЫЙТИ', 'ОСТОРОЖНО']],
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
    cards: [['СЕГОДНЯ КОНЦЕРТ. БИЛЕТОВ НЕТ', '«МАЯКОВСКАЯ»'], ['ПЕРЕХОД ЗАКРЫТ: ПОЁТ ШАМАН', 'ПЕРЕХОД']],
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
    signs: [],
  },
  {
    // Улица у Москва-Сити (день): кафе, остановка с газоном, зеркала, вход в главный МФЦ (без привязки к реальному). Выход в двери
    id: 'city',
    cards: [['ПРОДАЮТ УСПЕХ. ЗА ВАШ СЧЁТ', 'МОСКВА-СИТИ']],
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
    signs: [],
  },
  {
    // Главный МФЦ, 9 экранов: вход (рамки, охрана), окна 1-6, ожидание (вендинг, детский уголок), архив (фотобудка),
    // окна 7-12, кабинеты (руководитель), ожидание, архив, главный зал (красная дорожка к главному окну). Финал, выхода нет
    id: 'mfc',
    cards: [['ПОСЛЕДНЯЯ ИНСТАНЦИЯ', 'ГЛАВНЫЙ МФЦ']],
    width: 4320,
    lane: flat(4320),
    laneBottom: 255,
    spawn: [80, 200],
    exit: { x0: 4200, x1: 4310, y1: 255 }, // после сцены «sender» группа уходит на вокзал
    layers: [{ file: 'route/mfc.png' }],
    props: [],
    signs: [],
  },
  {
    // Киевский вокзал, 7 экранов: зал ожидания, выход к поездам, перрон под дебаркадером Шухова, конец перрона с часовой башней.
    // Бой «встреча выпускников» и Катя у правого края.
    id: 'vokzal',
    cards: [['ВСТРЕЧА ВЫПУСКНИКОВ', 'КИЕВСКИЙ ВОКЗАЛ']],
    width: 3360,
    lane: flat(3360),
    laneBottom: 255,
    spawn: [80, 200],
    layers: [{ file: 'route/vokzal.png' }],
    props: [],
    signs: [],
  },
];
