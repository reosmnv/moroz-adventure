# Moroz Birthday Adventures

Кооп-битэмап ко дню рождения на Phaser 4 и Colyseus 0.18 с общей симуляцией боя для клиента и сервера. Офлайн-соло и онлайн-комната с приглашением по ссылке или коду. ТЗ: [SPEC.md](SPEC.md).

## Запуск для разработки

Из корня проекта установите зависимости: `npm install`. Сервер и клиент запускаются в отдельных терминалах на своих свободных портах. Ниже сервер использует 2568, клиент 5174.

```bash
HOST=127.0.0.1 PORT=2568 node --import tsx server/src/index.ts
```

Во втором терминале из корня проекта:

```bash
cd client
VITE_SERVER_URL=http://127.0.0.1:2568 node ../node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5174 --strictPort
```

Открыть http://127.0.0.1:5174/. `VITE_SERVER_URL` направляет клиент на отдельный dev-сервер. Боевой сервер работает на :2567.

**Не запускайте `ops/dev.sh` при работающем боевом сервере:** скрипт убивает процессы без проверки порта и может остановить боевой :2567. Свои dev-процессы останавливайте через Ctrl+C в их терминалах.

## Проверки

Из корня проекта:

```bash
npx tsc -p tsconfig.json
node --import tsx server/src/sim-test.ts
node --import tsx server/src/story-test.ts
node --import tsx server/src/lane-test.ts
node --import tsx server/src/boss-crowd-test.ts
node --import tsx server/src/enemy-sheets-test.ts
node --import tsx server/src/hero-controls-test.ts
```

Другие наборы запускаются так же: `node --import tsx server/src/<имя>-test.ts`. Для сетевого теста нужен запущенный сервер на своём порту:

```bash
SERVER_URL=http://127.0.0.1:2568 node --import tsx server/src/net-test.ts
```

Сборка клиента: `cd client && node ../node_modules/vite/bin/vite.js build`.

## Управление

Экранные кнопки и клавиатура заданы в `client/src/ui.ts`; в `scene.ts` отдельных клавиш нет. Клавиши действий определяются по физической позиции, раскладка не влияет.

| Действие | На экране | Клавиатура |
|---|---|---|
| Движение | Плавающий стик слева | Стрелки |
| Бег | Стик до упора | Shift со стрелками |
| Серия A | Кулак справа | Q / Й, также J |
| Серия B / особый удар | Кнопка B, иконка показывает следующий приём; у Kris удержание даёт непрерывные вспышки | W / Ц, также K; у Kris можно держать |
| Ульта | Кнопка ульты с кольцом заряда | E / У, также U |
| Второе действие | У Анастасии снежная буря, у Kris шар, у Рамиля «Перекур» (держать); у Нади кнопки нет | R / К, также I; перекур держать |
| Насмешка | Свой портрет слева в HUD | T / Е, также L |

Вверху есть «Пауза», а в тестовом режиме ещё «ТЕСТ». В паузе доступны продолжение, смена героя, настройки, приглашение друга онлайн и выход в меню. В диалоге первое нажатие раскрывает реплику, следующее у ведущего продолжает сцену.

## Структура

- `shared/` симуляция боя, общая для сервера и офлайна
- `server/` Colyseus 0.18, комната `game`
- `client/` Phaser 4 + Vite

## Ассеты

| Что | Где | Источник | Лицензия |
|---|---|---|---|
| Спрайты Анастасии (Moroz Prime и Moroz Ultimate): стойка, ходьба, рывок, серия ударов A, завершающие удары B, урон, падение, подъём, превращение; east и west | `assets/sprites/<форма>/<анимация>-<направление>.png`, описание в `assets/sprites/anims.json` | Сгенерировано в PixelLab (pixellab.ai, подписка Tier 1), собрано `tools/sprites.py` | По ToS PixelLab результат принадлежит пользователю, коммерческое использование разрешено на всех тарифах |
| Исходные кадры и ключевые позы | `assets/pixellab/` | PixelLab | То же |
| Интерфейс: кнопка, стик, иконки A/U/насмешки, 6 иконок B по завершающим ударам (`heavy-<удар>.png`), рамка портрета, портреты Prime и Ultimate | `client/public/ui/`, все кандидаты в `assets/ui/raw/` (спеки `tools/specs/ui.json`) | PixelLab (`create_image_pro` со спрайтом героини как образцом стиля, `create_portrait_character`), выбор и обрезка вручную | По ToS PixelLab, как спрайты |
| Надя (герой 2): 16 анимаций (east, west зеркалом), эффекты (ульта-сердце и взрыв, ревность, оглушение, замедление, попадание, пощёчина, взмах, рывок, блик клинка), интерфейс (портрет, лицо HUD, иконки A/B/BB/BBB/U, значки статусов) | `assets/sprites/nadya/`, `assets/vfx/nadya/`, `client/public/ui/nadya/`; кадры и позы `assets/pixellab/nadya/`, кандидаты `assets/ui/raw/nadya_*` | PixelLab: `animate_character`, `edit_image`, `create_image_pro`, `create_portrait_character`, `vfx_workbench` (эффекты, бесплатно); сердце ульты нарисовано скриптом; сборка `tools/hero_build.py` | По ToS PixelLab, как спрайты |
| Kris (герой 3): 15 анимаций (east, west зеркалом), ульта по частям, эффекты (вспышка-снаряд, шар и взрыв, попадания, удар о землю, зарядка, луч и прицел), интерфейс (портрет, лицо, иконки A/B/шар/U) | `assets/sprites/kris/`, `assets/vfx/kris/`, `client/public/ui/kris/`; кадры и позы `assets/pixellab/kris/`, кандидаты `assets/ui/raw/kris_*` | PixelLab (`animate_character`, `edit_image`, `create_image_pro`, `create_portrait_character`, `vfx_workbench`); шар, луч и прицел нарисованы скриптом; сборка `tools/hero_build.py` | По ToS PixelLab, как спрайты |
| Эффекты 06.11: Анастасия (снежная искра удара, снежный взрыв ульты, ледяное кольцо бури), блок щитом, исчезновение врага, лечение, падение героини, удар босса по земле, конфетти после боя | `assets/vfx/fx2/` (лист, json, gif), в игре `client/public/vfx/<ключ>.png`, сборка `tools/vfx_copy.py` (FX2) | PixelLab `vfx_workbench` (бесплатно по подписке), эффекты сохранены в My effects на pixellab.ai | По ToS PixelLab, как спрайты |
| Уровень 1 «Дом на Беговой»: 4 экрана фона (подъезд 3, арка с магазинами, стилобат ТЦ, вход в метро «Беговая»), предметы улицы, карточка уровня | `client/public/level1/`, сырьё и кандидаты в `assets/level1/` (спеки `tools/specs/bg*.json`, `props1.json`, `seams.json`, `floor.json`, `card.json`), сборка `tools/level_build.py` | PixelLab (`create_image_pro` со стилем первого экрана и фото ЖК как референсом, `inpaint_image` на швах, `create_map_object`). Фото-референсы ЖК с kvartiravmoskve.ru лежат только локально в `assets/source/` (в .gitignore), в репозиторий не попадают | По ToS PixelLab, как спрайты |
| Маршрут (ТЗ-04): улица у подъездов 3-4, столпы и проход под домом, двор и павильон «Беговая» выход 3, вестибюль (условно), вагон 81-765, «Маяковская»; пропсы (скамейки, урна, велопарковка, люк, сцена для финала), поезд за арками | `client/public/route/`, сырьё `assets/level-route/raw/`, окна швов `assets/level-route/win/` (спеки `tools/specs/loc-*.json`, `route-*.json`), сборка `tools/route_build.py` | PixelLab (`create_image_pro` со стилем `assets/level1/style-s1.png`, `inpaint_image` на швах и низе пола, `create_map_object`). Асфальт улицы и двора, окна вагона, проёмы арок, зеркальный второй экран «Маяковской» собраны скриптом; фонарь, урна и знак метро взяты из уровня 1 | По ToS PixelLab, как спрайты |
| Улица у Москва-Сити (5 экранов: кафе, остановка с газоном, зеркальные повторы, вход в большой МФЦ, без привязки к реальному адресу) и главный МФЦ (9 экранов: вход с рамками и охраной, окна приёма, ожидание с вендингом и детским уголком, архив с фотобудкой, кабинеты, главный зал с красной дорожкой; стыки закрыты пилястрой) | `client/public/route/city.png`, `mfc.png`, сырьё `assets/level-route/raw/cityd_*`, `mfc_ext`, `mfc_int`, `mfc_in`, `mfc_wait`, `mfc_arch`, `mfc_doors`, `mfc_main`, швы `ct2_seam*` (спеки `tools/specs/city-day.json`, `mfc-big.json`, `route-city-r1.json`); ранние тёмные пилоты `city_v*`, `mfc_v0`, `city_a/b` не используются | PixelLab (`create_image_pro`, `inpaint_image`); пол плиткой, зеркальные повторы и удлинение всех локаций собраны скриптом `tools/route_build.py` | По ToS PixelLab, как спрайты |
| Враги (7 видов: ОМОН, ОМОН со щитом, ватник, зэк, чиновник, инфоцыган, инфоцыганка) и боссы «Маяковской» (Шаман, Пиздулина): стойка, ходьба, замах, удар/рывок, восстановление, урон, падение, подъём; у боссов особая атака (cast, release); east, west зеркалом | `client/public/sprites/enemies/`, `assets/sprites/enemies/`; кадры `assets/pixellab/enemies/`, id персонажей `assets/pixellab/enemies/ids.json` (спеки `tools/specs/enemies-v1.json`, `bosses-v1.json`, `bosses-anim-v1.json`), сборка `tools/enemy_build.py` | Концепты: GPT-image через Codex CLI на подписке ChatGPT mr.R (`assets/enemy-concept/`, только референс). Спрайты: PixelLab `create_character_pro_flash` (стойка Анастасии как образец стиля), `animate_character` skeleton-v3 и pixminimax (Tier 2) | По ToS PixelLab, как спрайты; концепты GPT по условиям OpenAI принадлежат пользователю |
| Звук (07.11, TZ-25): 175 ID интерфейса, сюжета, окружения, боя, героев, врагов, боссов и 7 музыкальных петель | игра `client/public/audio/` + `manifest.json`; сборка `tools/audio/build.py` (там же источник каждого файла), исходники локально `assets/audio-lib/`, `assets/audio-src/` (в .gitignore) | Kenney.nl (Impact, Interface, UI, RPG, Digital, Music Jingles); Freesound.org (hq-превью, id звука в `build.py`); Genex Tools sfx и music (ElevenLabs), задания `tools/audio/gx_list.py`; музыка Kevin MacLeod, incompetech.com («Sneaky Snitch», «Jet Fueled Vixen», «MTA», «Chee Zee Lab», «Volatile Reaction») | Kenney CC0; Freesound по лицензии каждого звука (CC0/CC-BY/CC-BY-NC); Incompetech CC BY 4.0; Genex: принадлежит пользователю. Игра личная, некоммерческая |
| Референсы Сити (только для PixelLab, в репозиторий не попадают): Commons «Moscow City at evening light, 2024-3 (53566092780).jpg» (CC BY 2.0, силуэты башен); в ранних пилотах также «Moscow Presnenskaya Embankment 2 2023-04 1682351027.jpg» (Artyom Svetlov, CC BY-SA 4.0) и «AfiMall City.jpg» (mos.ru, CC BY 4.0) | `assets/source/city/` (в .gitignore), `REFERENCES.md` там же | Commons, лицензии проверены 01.11.2026 | см. источник |
| Тоннель за окнами вагона | `client/public/route/tunnel.png` | нарисован скриптом `tools/route_fx.py` | свой |
| Референсы маршрута (в игру и репозиторий не попадают, только для PixelLab): Wikimedia Commons: «81-765 interior - back view of head car.jpg» и «81-765 interior - door and seats.jpg» (Евгений Самарин, Пресс-служба Правительства Москвы, CC BY 4.0), «Begovaya view.jpg» (Anastasiya Lvova, CC BY-SA 3.0), «Mayakovskaya (Moscow Metro) (19964678325).jpg» (Jorge Láscar, CC BY 2.0), «Mayakovskaya (ceiling detail).jpg» (steve_w, CC BY 2.0), «Mayakovskaya columns.jpg» (Szabolcs Vörös, CC BY-SA 4.0); скриншоты Яндекс.Панорам от mr.R | `assets/source/begovaya/` (в .gitignore), список `REFERENCES.md` там же | Commons, лицензии проверены 01.11.2026; скриншоты панорам: лицензия не установлена, только референс | см. источник |
| Шрифт Press Start 2P (кириллица есть) | `client/public/fonts/` | CodeMan38, Google Fonts | SIL Open Font License 1.1 (`client/public/fonts/OFL.txt`) |

Формат листов: полоса кадров 128x128, ступни на y=112, центр корпуса на x=64. В `anims.json` у каждой анимации число кадров по направлениям, `fps`, `loop`, у ударов `hit` (номер кадра попадания).
Просмотр: `python3 -m http.server 8090 --bind 100.118.72.60` в папке проекта, затем http://100.118.72.60:8090/anim-preview/ (или GIF в `assets/sprites/gif/`).
Пересборка: `python3 tools/sprites.py fetch && python3 tools/sprites.py build && python3 tools/gifs.py`.
