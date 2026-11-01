# ТЗ-04: маршрут «подъезд 3 → метро → Маяковская»: локации, полоса ходьбы по x, переходы

Статус: принято Claude 01.11, выложено (см. PLAN.md). Автор: Claude. Исполнитель: Codex (gpt-6.1-sol, high: sim и сеть). Приёмка: Claude, затем mr.R по ссылке Pages.
Решение mr.R 01.11: новый уровень из нескольких локаций по маршруту, герои не должны ходить по стенам, полоса глубже. Старый уровень 1 остаётся и доступен по `?level=old`.

## 1. Что уже готово (Claude, не править)
- `shared/src/route-data.ts`: данные маршрута (`ROUTE: Stage[]`): ширина, точки верхней границы полосы, зона выхода, слои фона, эффекты, предметы, надписи, карточки. Значения правит только Claude (картинки ещё генерируются). Тип `Stage` ты объявляешь в `shared/src/levels.ts` ровно как в п. 3, `route-data.ts` импортирует его.
- `server/src/floor-data.ts`: генерирует Claude скриптом из масок пола картинок (`FLOOR[stageId] = { step, top[] }`: верх пола в координатах мира для x = i*step). Для теста пола.
- Картинки: `client/public/route/*.png` (слои 320x180-кратные, рисуются x1.5 от (0,0)), `client/public/route/props/*.png`, `route/tunnel.png`, `route/train.png`. Пока часть заглушки, имена файлов не меняются.

## 2. Ограничения
- Логика в `shared/`, отрисовка в `client/`, сервер только передаёт. Архитектура из `AGENTS.md`.
- Старый уровень (`client/src/level.ts`: `buildLevel`, `showCard`, `PROPS`, `SIGNS`, файлы `client/public/level1/`) не менять по поведению: с `?level=old` всё как сейчас (LANE_TOP 168, ширина 1920, карточка «ДОМ НА БЕГОВОЙ»). Код можно переносить, но картинки и числа те же.
- Баланс, герои, удары, интерфейс боя (ui.ts кнопки/HUD) не менять. `TEST_TOOLS` не трогать.
- Экспорт `LANE_TOP`, `LANE_BOTTOM`, `LEVEL_W` оставить (старые значения), но sim больше не использует `LANE_TOP`/`LEVEL_W` напрямую.

## 3. Данные (shared/src/levels.ts)
```ts
export interface LaneZone { x0: number; x1: number; y1: number } // выход: x в [x0, x1] и y <= y1
export interface StageLayer { file: string; fx?: 'tunnel' | 'train' } // fx рисуется сразу ПОД этим слоем
export interface StageProp { file: string; x: number; y: number; scale?: number; flip?: boolean; depth?: number } // x, y = низ-центр в мире; depth по умолчанию y
export interface StageSign { text: string; x: number; y: number; size: number; color: string; bg?: string }
export interface TunnelFx { y0: number; y1: number; speed: number }   // полоса окон в мире, скорость px/с влево
export interface TrainFx { y: number; h: number; arriveMs: number; standMs: number; leaveMs: number; emptyMs: number } // y верх полосы поезда в мире
export interface Stage {
  id: string;
  cards: [string, string][];   // карточки при входе: [малая строка, крупная], по 1,8 с подряд
  width: number;               // ширина мира, px
  lane: [number, number][];    // верх полосы: точки (x, y), x по возрастанию, первая x=0, последняя x=width; между точками линейно
  laneBottom: number;          // низ полосы (255)
  spawn: [number, number];     // где появляется первый игрок
  exit?: LaneZone;             // нет = конец маршрута
  layers: StageLayer[];        // снизу вверх
  tunnel?: TunnelFx;
  train?: TrainFx;
  props: StageProp[];
  signs: StageSign[];
}
export interface Level { id: 'route' | 'old'; stages: Stage[] }
```
- `LEVELS: Record<'route'|'old', Level>`: `route` = `ROUTE` из `route-data.ts`; `old` = одна стадия `old` (width 1920, lane [[0,168],[1920,168]], laneBottom 255, spawn [80,200], без выхода, layers пустой: клиент рисует старый уровень своим кодом).
- Функции: `stageOf(w)`, `laneTop(w, x)` (кусочно-линейно по `lane`, x за краями = крайняя точка), `laneBottom(w)`, `levelW(w)`, `clampToLane(w, x, y)`.

## 4. Требования
R1. **World**: поля `level: 'route'|'old'`, `stage: number`, `trans?: { ms: number; to: number }`. `createWorld(seed, testTools, level = 'route', stage = 0)`.

R2. **Полоса по x вместо констант** во всём `sim.ts`: каждое `clamp(y, LANE_TOP, LANE_BOTTOM)` → по `laneTop(w, x)` для той x, где сущность окажется; каждое `LEVEL_W` → `levelW(w)` (движение, рывки, отскок Kris, магнит/врыв, поцелуй, шар, луч, отброс врагов, `clampEnemyX`). В конце `step()` для всех игроков и врагов (кроме тех, кто в воздухе, их y = земля) общий проход: x игрока в `[20, W-20]`, y = `clamp(y, laneTop(x), laneBottom)`; враг: y так же, x как сейчас (`clampEnemyX`), но для y брать `laneTop(clamp(x, 0, W))`.

R3. **Спавн только на полу**: `addPlayer` в `spawn` стадии (второй рядом с напарником, как сейчас), y прижат к полосе. `spawnEnemies`: x в `[20, W-20]` (сейчас бывает за краем), y случайно внутри полосы при этом x. Манекен (`ensureDummy`): x = spawn.x + 250 (не дальше W-40), y = середина полосы при этом x; ставится заново после смены стадии.

R4. **Переход между стадиями** (в sim): живой подключённый игрок в зоне `exit` → `w.trans = { ms: 900, to: stage+1 }`, событие `{ t: 'exit', to }`. Пока `trans` идёт: ввод игнорируется, враги стоят. По окончании: `stage = to`, все враги удалены (`pending` очищен), игроки в `spawn` (второй рядом), hp и формы без изменений, событие `{ t: 'stage', stage }`, манекен заново (в тест-режиме). Последняя стадия без `exit` = конец.

R5. **Тест-кнопка «→ Локация»** (только `TEST_TOOLS`), рядом с «+3 врага» в `client/index.html` и `main.ts`: сразу запускает переход на следующую стадию (по кругу: после последней первая). Офлайн через `LocalSession`, онлайн сообщение `next` в `GameRoom` (как `spawn`).

R6. **Выбор уровня из адреса**: `?level=old` старый уровень, иначе `route`. `?stage=N` (0..) стартовая стадия для проверки. Офлайн: передать в `createWorld`. Онлайн: `client.create('game', { level, stage })`, `GameRoom.onCreate(options)` проверяет значения; вошедший по коду получает уровень комнаты.

R7. **Состояние в сети и снимках**: `GameState` + `level: string`, `stage: number`, `trans: number` (мс). `Snapshot` + те же поля, `LocalSession` и `OnlineSession` их заполняют.

R8. **Клиент: загрузка и смена стадии** (новый `client/src/stage.ts`, старый `level.ts` используется только для `old`):
- preload: все `layers`, `props`, `route/tunnel.png`, `route/train.png` всех стадий уровня (их немного).
- Сцена строит стадию по `snapshot.stage`; при смене номера: уничтожает объекты прошлой (контейнер/список), строит новую, `camera.setBounds(0, 0, width, 270)`, сбрасывает следование камеры на героиню, показывает карточки.
- Событие `exit`: `camera.fadeOut(350)`, после смены стадии `fadeIn(350)`.
- Слои: `image(0,0).setOrigin(0).setScale(1.5).setDepth(-1000 + i)`. Предметы как старые `PROPS` (origin низ-центр, scale 1.5 по умолчанию, depth = y). Надписи как старые `SIGNS` (шрифт `FONT`).
- `tunnel`: `tileSprite` из `route/tunnel.png` на всю ширину стадии в полосе `y0..y1`, под слоем с `fx: 'tunnel'`; `tilePositionX` растёт со скоростью `speed`; поверх полосы раз в 0,4–1,2 с (случайно, только клиент) пролетает светлый блик-прямоугольник справа налево (огни тоннеля) с прозрачностью 0,25–0,5.
- `train`: `tileSprite` из `route/train.png` (повторяемая полоса вагонов) высотой `h` с верхом в `y`, на всю ширину стадии, под слоем с `fx: 'train'`. Цикл: въезд справа налево с замедлением `arriveMs` (ease out, путь = ширина стадии), стоит `standMs`, уезжает влево с разгоном `leaveMs`, пусто `emptyMs`, повтор. Поезд сдвигается через `tilePositionX` и смещение по x так, чтобы при «пусто» его не было видно.
- Карточки (`cards`): как старая `showCard`, но без картинки: тёмная полоса по центру экрана, малая строка цветом `#f2a541`, крупная белым, каждая 1,8 с, затем исчезают. Карточка не блокирует ввод.
- Камера: как сейчас (`follow`), но граница по ширине стадии; героиня не выходит за край фона (sim уже держит x в `[20, W-20]`).

R9. **?debug=1**: поверх фона линия `laneTop(x)` (жёлтая, по точкам), линия `laneBottom` (красная), прямоугольник зоны `exit` (голубой, полупрозрачный), подписи y на точках `lane` шрифтом 8 px. Без `?debug=1` ничего этого нет.

R10. **Автотест пола** `server/src/lane-test.ts`, скрипт `test:lane` в `server/package.json` и корневом `package.json`. Для каждой стадии `route` с данными в `FLOOR`:
1. Статически: для каждого x от 0 до W шагом 2: `laneTop(x) >= floorTop(x)` (floorTop = максимум `FLOOR.top` на отрезке [x-6, x+6], ступни ~12 px), `laneBottom - laneTop(x) >= 105`.
2. Прогон героя через `step()`: Анастасия от `spawn` до правого края, сначала прижата вверх (`my=-1, mx=1`), затем вниз (`my=1`), затем бегом (`run`) по середине; на каждом тике ступни (x, y) на полу: `y >= floorTop(x)` и `y <= laneBottom`, x в `[20, W-20]`. Отключить переход: в тесте зона `exit` не должна срабатывать (временно `w.trans` сбрасывать или проверять стадию до выхода из `exit.x0`).
3. Толпа: 2 героя + `spawnEnemies(w, 5)`, 20 с игры с ботом (двигаются к врагам и бьют A/B), каждые 10 тиков все враги на земле и не в воздухе: `y` в полосе при `clamp(x,0,W)`. Плюс вывод минимального расстояния по глубине между врагами (для отчёта).
4. Переход: игрок в зоне `exit` → через ~900 мс `stage` +1, игроки в `spawn` на полу, событие `stage`.
5. Старый уровень: `laneTop` = 168 при любом x, ширина 1920.
Печать в стиле `sim-test.ts` (OK/FAIL), код выхода 1 при провале.

R11. **Не ломать**: `test:sim`, `test:net` проходят; в `sim-test.ts`/`net-test.ts` поправить только то, что зависит от `LANE_TOP`/`LEVEL_W`, если что-то зависит (с явным `createWorld(..., 'old')`, если тест рассчитан на старый уровень).

## 5. Приёмка
| Критерий | Проверка |
|---|---|
| tsc, vite build, test:sim, test:lane | Codex и Claude |
| test:net на своём :2568 | Claude |
| `?level=old` как раньше | Claude, Playwright |
| маршрут проходим по стадиям, затемнение, карточки | Claude, Playwright |
| `?debug=1` линии полосы, герой у верхней и нижней границы на каждом экране | Claude, скриншоты |
| вагон: тоннель бежит в окнах; Маяковская: поезд приходит и уходит за арками | Claude, глазами |

## 6. Не входит
Генерация и сборка картинок (Claude), значения `route-data.ts` (Claude), враги-спрайты, волны, боссы, сцена финального босса как механика (спрайт сцены = обычный предмет `props`), ловушки, звук.
