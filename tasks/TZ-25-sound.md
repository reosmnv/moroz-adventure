# TZ-25: звуковой движок и подключение всех звуков (ветка tz-25)

Исполнитель: Codex. Ведущий и приёмка: Claude. Читай `AGENTS.md`, `CLAUDE.md`. Каталог звуков по смыслу: `SOUND_DESIGN_TZ.md` (ID и характер), `SOUND-PLAN.md` (что берём). Файлы звуков делает Claude параллельно: твоя задача код, он должен работать и без файлов (нет файла = тишина, без ошибок).

## Контракт: манифест
`client/public/audio/manifest.json` (его генерирует Claude, ты создаёшь стартовую версию со всеми ID ниже и пустыми `files`):
```json
{ "ui_confirm": { "files": ["ui/ui_confirm_01.mp3", "ui/ui_confirm_02.mp3"], "bus": "ui", "vol": 0.8, "gap": 60, "loop": false, "pitch": 0.04 } }
```
- `files` пути от `client/public/audio/`. Несколько файлов = случайный вариант, не повторять подряд тот же.
- `bus`: `ui` | `sfx` | `amb` | `music`. `vol` 0..1 множитель. `gap` мс: минимальный интервал повтора этого ID (лимит частоты). `pitch`: случайный разброс playbackRate ±pitch (по умолчанию 0.03 для sfx, 0 для ui/music/amb). `loop` для петель.
- Поле `max` (необязательно): сколько копий ID звучит одновременно (по умолчанию 3).

## Движок `client/src/audio.ts` (переписать, API сохранить совместимым или заменить вызовы)
- Один AudioContext, как сейчас: разблокировка по первому жесту, `navigator.audioSession.type = 'playback'` (см. грабли в CLAUDE.md: тихий зацикленный `<audio>` вешает Safari, его не делать).
- Шины: master → ui/sfx/amb/music GainNode. Короткие звуки (ui, sfx) декодируются в AudioBuffer (fetch + decodeAudioData), лениво, с кэшем; предзагрузка банка при старте игры (после меню) и UI-банка при открытии меню.
- `music` и `amb`: НЕ декодировать целиком (память iPhone). Через `HTMLAudioElement` + `createMediaElementSource` в шину, `loop = true`. Одна музыка и одна фоновая петля окружения одновременно. `playMusic(id)` / `playAmb(id)` с кроссфейдом 800 мс; тот же id = ничего не делать; `null` = стоп с fade. Запускать только после разблокировки; если вызвали до неё, запомнить и запустить на разблокировке.
- `play(id, opts?: { x?: number; vol?: number; delay?: number })`: лимит `gap`, `max`, разброс pitch. `x` мировая координата: если источник за краем камеры дальше 200 px, тише в 2 раза; лёгкая панорама по x (StereoPannerNode, ±0.4), если есть.
- Глушение (ducking): во время `ult`, финального удара Рамиля, смены фазы и поражения босса музыка −6 dB на 600 мс. Во время боя окружение −6 dB (арена заперта), после `clear` возвращать.
- Чужие игроки (не свой герой) звучат на 30% тише: у событий есть `by`/`id` героя, свой герой известен сцене.
- Пауза игры: музыка −10 dB, окружение пауза; продолжение возвращает.
- Видимость вкладки (`visibilitychange`): скрыта = suspend контекста и пауза media; вернулась = resume.
- Удалить `beep` и синтезированный `sfx` после замены всех вызовов.

## Настройки
Сейчас в `settings.ts` есть переключатель звука. Сделать три ползунка (0–100, шаг 10): «Музыка», «Звуки», «Окружение» (UI и sfx = «Звуки»), плюс общий выключатель «Звук» оставить. Сохранение в `bc-settings` с миграцией старого поля. Применять сразу.

## ID и где звучат
Если события в коде нет, добавь в клиенте (по снимкам/смене анимации) или в sim событием (тогда тесты и сеть). Звуки только в клиенте; sim не знает про звук. Предпочитай клиентские триггеры по смене `anim` сущности между снимками, чтобы не трогать сеть. Всё, что делается в sim/server, должно пройти тесты.

### Интерфейс (bus ui)
`ui_click` любая кнопка меню/паузы/настроек (по умолчанию, делегированием на document для `button`) · `ui_confirm` основные действия (Новая игра, Войти, Продолжить, выбор героя) · `ui_back` кнопки Назад/закрыть (`.menuBack`, `pickBack`) · `ui_start` старт игры (вход в бой из меню) · `ui_pick_anastasia` / `ui_pick_nadezhda` / `ui_pick_kris` / `ui_pick_ramil` выбор героя (вместо ui_confirm) · `ui_error` ошибка (неверный код, комната не найдена, сервер недоступен, занятый герой) · `ui_toggle` переключатели/ползунки · `ui_pause` / `ui_resume` · `ui_room_created` · `ui_player_join` / `ui_player_leave` · `ui_connection_lost` / `ui_reconnected` · `ui_ult_ready` шкала ульты своего героя стала полной · `ui_charge_step` ступень ульты Рамиля (событие `rstage`, pitch растёт со ступенью: playbackRate 1 + 0.08·номер).

### Сюжет (bus ui)
`story_line` появление реплики с портретом · `story_type` печать текста (если текст печатается побуквенно; не чаще 70 мс) · `story_phone` появление экрана телефона (`phone`) · `story_push` пуш Госуслуг · `story_caption` титры (`caption`) · `story_card_in` / `story_card_out` карточка локации (`card` и карточки `cards` маршрута) · `story_composition` стоп-кадр (`composition`) · `story_rec` включение записи Kris (`state recording on`) · `story_stamp` печать «отзыв доноса» / победа сюжета (`withdrawal`) · `story_confetti` экран поздравления и конфетти (`party-confetti`, victory) · `milonov_enter` / `milonov_exit` появление и уход Милонова (act spawn/exit milonov).

### Окружение (bus amb, петли по локации) и разовые
Петля по `stage.id`: `street` → `amb_street`, `yard` → `amb_yard`, `vestibule` → `amb_vestibule`, `wagon` → `amb_wagon`, `mayak` → `amb_mayak`, `city` → `amb_city`, `mfc` → `amb_mfc`. Меню без окружения.
Разовые (bus sfx): `enemy_enter_door` враг выходит из двери подъезда · `turnstile_reject` вестибюль (сцена vestibule) · `wagon_brake` торможение поезда · `wagon_stop` «СТАНЦИЯ!» · `wagon_doors` выход из вагона · `mayak_train` фоновый поезд на Маяковской раз в 25–40 с · `mfc_queue_ping` в МФЦ раз в 15–30 с · `stage_exit` переход между локациями.

### Бой общий (bus sfx)
`whoosh_light` / `whoosh_heavy` взмах героя на активном кадре атаки (лёгкие/тяжёлые приёмы; по `impact` в hero-data или по урону) · `impact_light` / `impact_heavy` / `impact_finisher` попадание по врагу (`hit`: dmg<18 light, ≥18 heavy, kill или impact 2 finisher) · `impact_air` по подброшенному · `body_launch` подброс · `body_fall` падение врага (kill) · `hero_hurt` урон героя · `hero_down` / `hero_getup` · `guard_block` (`block`) · `freeze_apply` / `freeze_break` · `heal` · `arena_lock` (`lock`) · `wave_start` (`wave`) · `arena_clear` (`clear`) · `team_restart` (`restart`) · `victory_boss` (`bossDown`) · шаги: `step_asphalt` (street, yard, city), `step_tile` (vestibule, mayak, mfc), `step_wagon` (wagon) по кадрам ходьбы героя (2 шага на цикл анимации), только свой герой и максимум 2 ближайших чужих, gap 180.

### Герои (bus sfx)
Анастасия: `nastya_dash`, `nastya_highkick`, `nastya_teep`, `nastya_uppercut`, `nastya_cross`, `nastya_slam`, `nastya_transform` (ult), `nastya_knee`, `nastya_elbow`, `nastya_hurricane` (петля на время приёма), `nastya_storm_cast` (storm), `nastya_storm_loop` (пока буря активна; если длительность неизвестна, проиграть один раз), `nastya_storm_hit` (gap 150).
Надя: `nadya_swing`, `nadya_slap` (B1 «ШЛЁП!»), `nadya_stun` (B2 «ОЙ!»), `nadya_blade_draw`, `nadya_dash` (`dash`), `nadya_dash_hit`, `nadya_kiss` (`kiss`), `nadya_charm` (`charm`).
Kris: `kris_tripod_swing`, `kris_tripod_hit`, `kris_hop`, `kris_shutter` (`shot`), `kris_flash_hit` (вспышка у цели), `kris_ball_throw` (`ball`), `kris_ball_boom` (`boom`), `kris_aim` (`aim`), `kris_beam` (`beam`).
Рамиль: `ramil_dash` (`rdash`), `ramil_kick`, `ramil_grab`, `ramil_spin` (ураган, петля ~1 с), `ramil_spin_hit` (`rspinHit`, gap 90), `ramil_meteor_up`, `ramil_meteor_land` (`rland`), `ramil_roundhouse` («ПОКА!»), `ramil_fire` («ПЫХ!»), `ramil_burn_tick` (gap 400), `ramil_smoke` (перекур), `ramil_flurry_start` (`flurry`), `ramil_flurry_hit` (удары серии, gap 70; на ступенях 32/64 вместо отдельных ударов `ramil_flurry_roll` раз в 400 мс), `ramil_flurry_finish` (`rfinish`).
Где ID приёма не совпадает с событием, ставь по слову (`e.word`) или по смене `anim` героя. Если приём нельзя надёжно определить, используй общий `whoosh_*` и запиши в отчёт.

### Враги (bus sfx)
Шаги по кадрам ходьбы (только видимые, максимум 2 одновременно, gap 250): `omon_step`, `vatnik_step`, `zek_step`, `clerk_step`, `info_step`.
Замах (`anim` → windup): `omon_windup`, `vatnik_windup`, `zek_windup`, `clerk_windup`, `info_windup`. Удар (`anim` → strike/dash): `omon_strike`, `shield_bash` (ОМОН со щитом), `vatnik_strike`, `zek_dash`, `clerk_strike`, `info_m_dash`, `info_f_strike`. Боль: `enemy_hurt_light` / `enemy_hurt_heavy` (tank). Падение: `body_fall`. Первая вставка-знакомство с типом врага: `enemy_intro_sting`.
Уточни реальные виды врагов в `enemy-data.ts`; щит отдельным ID, если вид отдельный.

### Боссы (bus sfx)
Шаман: `shaman_intro`, `shaman_mic_windup`, `shaman_mic_hit`, `shaman_vstayu_tele`, `shaman_vstayu`, `shaman_chorus_tele`, `shaman_chorus`, `shaman_pyro_tele`, `shaman_pyro`, `shaman_salute`, `shaman_cross`, `shaman_fans`, `shaman_phase2`, `shaman_down`.
Пиздулина: `pizdulina_intro`, `pizdulina_slap`, `pizdulina_ban_tele`, `pizdulina_ban`, `pizdulina_shots`, `pizdulina_grid_tele`, `pizdulina_grid`, `pizdulina_zone`, `pizdulina_cross`, `pizdulina_omon`, `pizdulina_phase2`, `pizdulina_down`.
Катя: `katya_intro`, `katya_heavy`, `katya_ground`, `katya_rush`, `katya_phase2`, `katya_down`.
Телеграф (`tele`/windup атаки) и сработка (`bossFx`) разные ID; атаки без `_tele` звучат на сработке, а телеграф у них общий `boss_tele`.

### Музыка (bus music)
`music_menu` меню и выбор героя · `music_route1` street, yard, vestibule, wagon · `music_route2` mayak (до босса), city, mfc · `music_shaman` с появления Шамана до его поражения · `music_pizdulina` · `music_katya` · `music_finale` финал и экран поздравления. После поражения босса: короткий fade, `victory_boss`, затем музыка локации.

## Тест-страница звуков
В тест-режиме (только при `TEST_TOOLS`) кнопка «Звуки» в панели ТЕСТ открывает список всех ID манифеста с кнопкой проигрывания (и стоп для петель/музыки). Нужна mr.R для прослушки на iPhone.

## Проверка (сделай сам, что можешь)
`npx tsc -p tsconfig.json --noEmit`; тесты из CODEX-LEAD.md; сборка клиента. Если менял `shared/` или `server/`, напиши это в отчёте явно: сеть прогонит Claude.
Отчёт: `tasks/TZ-25-report.md`: что сделано, таблица ID → где вызывается (файл:строка), какие ID не удалось привязать и почему. Коммиты в ветку tz-25 не делай, оставь рабочие изменения: принимает и коммитит Claude.
