# birthday-coop

Кооп-битэмап ко дню рождения. Сейчас: серый прототип сети (квадратики), без графики. ТЗ: [SPEC.md](SPEC.md).

## Запуск для проверки (tailnet)

```bash
npm install
ops/dev.sh                  # сервер :2567 и клиент :5173 на 100.118.72.60
LATENCY=200 ops/dev.sh      # то же с искусственной задержкой 200 мс
npm run test:net            # сетевые сценарии ботами (сервер должен работать)
```

Открыть на iPhone/Mac в tailnet: http://100.118.72.60:5173/

Управление: джойстик в левой половине экрана (в покое виден полупрозрачным слева внизу), справа A (кулак, серия), B (завершающий, иконка показывает удар, который выйдет), рожица (насмешка), U (молния, ульта; кольцо вокруг показывает заряд).
Клавиатура: WASD/стрелки, J K L U.

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
| Уровень 1 «Дом на Беговой»: 4 экрана фона (подъезд 3, арка с магазинами, стилобат ТЦ, вход в метро «Беговая»), предметы улицы, карточка уровня | `client/public/level1/`, сырьё и кандидаты в `assets/level1/` (спеки `tools/specs/bg*.json`, `props1.json`, `seams.json`, `floor.json`, `card.json`), сборка `tools/level_build.py` | PixelLab (`create_image_pro` со стилем первого экрана и фото ЖК как референсом, `inpaint_image` на швах, `create_map_object`). Фото-референсы ЖК с kvartiravmoskve.ru лежат только локально в `assets/source/` (в .gitignore), в репозиторий не попадают | По ToS PixelLab, как спрайты |
| Маршрут (ТЗ-04): улица у подъездов 3-4, столпы и проход под домом, двор и павильон «Беговая» выход 3, вестибюль (условно), вагон 81-765, «Маяковская»; пропсы (скамейки, урна, велопарковка, люк, сцена для финала), поезд за арками | `client/public/route/`, сырьё `assets/level-route/raw/`, окна швов `assets/level-route/win/` (спеки `tools/specs/loc-*.json`, `route-*.json`), сборка `tools/route_build.py` | PixelLab (`create_image_pro` со стилем `assets/level1/style-s1.png`, `inpaint_image` на швах и низе пола, `create_map_object`). Асфальт улицы и двора, окна вагона, проёмы арок, зеркальный второй экран «Маяковской» собраны скриптом; фонарь, урна и знак метро взяты из уровня 1 | По ToS PixelLab, как спрайты |
| Улица у Москва-Сити (5 экранов: кафе, остановка с газоном, зеркальные повторы, вход в большой МФЦ, без привязки к реальному адресу) и главный МФЦ (9 экранов: вход с рамками и охраной, окна приёма, ожидание с вендингом и детским уголком, архив с фотобудкой, кабинеты, главный зал с красной дорожкой; стыки закрыты пилястрой) | `client/public/route/city.png`, `mfc.png`, сырьё `assets/level-route/raw/cityd_*`, `mfc_ext`, `mfc_int`, `mfc_in`, `mfc_wait`, `mfc_arch`, `mfc_doors`, `mfc_main`, швы `ct2_seam*` (спеки `tools/specs/city-day.json`, `mfc-big.json`, `route-city-r1.json`); ранние тёмные пилоты `city_v*`, `mfc_v0`, `city_a/b` не используются | PixelLab (`create_image_pro`, `inpaint_image`); пол плиткой, зеркальные повторы и удлинение всех локаций собраны скриптом `tools/route_build.py` | По ToS PixelLab, как спрайты |
| Референсы Сити (только для PixelLab, в репозиторий не попадают): Commons «Moscow City at evening light, 2024-3 (53566092780).jpg» (CC BY 2.0, силуэты башен); в ранних пилотах также «Moscow Presnenskaya Embankment 2 2023-04 1682351027.jpg» (Artyom Svetlov, CC BY-SA 4.0) и «AfiMall City.jpg» (mos.ru, CC BY 4.0) | `assets/source/city/` (в .gitignore), `REFERENCES.md` там же | Commons, лицензии проверены 01.11.2026 | см. источник |
| Тоннель за окнами вагона | `client/public/route/tunnel.png` | нарисован скриптом `tools/route_fx.py` | свой |
| Референсы маршрута (в игру и репозиторий не попадают, только для PixelLab): Wikimedia Commons: «81-765 interior - back view of head car.jpg» и «81-765 interior - door and seats.jpg» (Евгений Самарин, Пресс-служба Правительства Москвы, CC BY 4.0), «Begovaya view.jpg» (Anastasiya Lvova, CC BY-SA 3.0), «Mayakovskaya (Moscow Metro) (19964678325).jpg» (Jorge Láscar, CC BY 2.0), «Mayakovskaya (ceiling detail).jpg» (steve_w, CC BY 2.0), «Mayakovskaya columns.jpg» (Szabolcs Vörös, CC BY-SA 4.0); скриншоты Яндекс.Панорам от mr.R | `assets/source/begovaya/` (в .gitignore), список `REFERENCES.md` там же | Commons, лицензии проверены 01.11.2026; скриншоты панорам: лицензия не установлена, только референс | см. источник |
| Шрифт Press Start 2P (кириллица есть) | `client/public/fonts/` | CodeMan38, Google Fonts | SIL Open Font License 1.1 (`client/public/fonts/OFL.txt`) |

Формат листов: полоса кадров 128x128, ступни на y=112, центр корпуса на x=64. В `anims.json` у каждой анимации число кадров по направлениям, `fps`, `loop`, у ударов `hit` (номер кадра попадания).
Просмотр: `python3 -m http.server 8090 --bind 100.118.72.60` в папке проекта, затем http://100.118.72.60:8090/anim-preview/ (или GIF в `assets/sprites/gif/`).
Пересборка: `python3 tools/sprites.py fetch && python3 tools/sprites.py build && python3 tools/gifs.py`.
