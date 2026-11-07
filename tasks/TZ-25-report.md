# TZ-25: отчёт Codex

Рабочая ветка `tz-25`, без коммита. Изменены только клиентский код, добавлены стартовый манифест, механические проверки и этот отчёт. `shared/`, `server/`, `TEST_TOOLS` не менялись. Сеть, браузер и звук на устройстве не проверялись.

## Изменённые файлы

- `client/src/audio.ts`: файловый движок, Web Audio шины, потоковые music/amb, кэш, лимиты, панорама, fade, ducking, пауза, visibility, прослушка.
- `client/src/game-audio.ts` (новый): привязки к событиям, снимкам и фактическим кадрам рендера.
- `client/src/scene.ts`: подключение GameAudio, передача кадров, удаление всех beep/sfx.
- `client/src/settings.ts`: три уровня громкости и миграция сохранённого sound.
- `client/src/main.ts`: UI-звуки, состояния соединения/игроков, ползунки и каталог «Звуки» в ТЕСТ.
- `client/src/story.ts`, `client/src/ui.ts`, `client/src/level.ts`: звуки отображаемых реплик, печати, пушей, карточек и финала.
- `client/src/menus.css`: ползунки, прокрутка настроек/прослушки на низком экране.
- `client/public/audio/manifest.json` (новый): стартовые 175 ID, `files: []`, gap/pitch/loop по ТЗ. Дальнейшее заполнение принадлежит Claude.
- `client/tests/audio-test.ts` (новый): механические проверки с заглушками браузерного аудио.
- `tasks/TZ-25-report.md` (новый): этот отчёт, разрешён прямым указанием ТЗ.

Параллельно появились чужие изменения `.gitignore`, `.genex/`, `tools/audio/`, документы звукового плана. Их не правил и не включаю в собственный результат. `HANDOFF.md`, архив, план и исходное ТЗ оставлены Claude по проектным правилам.

## Требования

| Требование | Статус и реализация |
|---|---|
| Манифест и тишина без файлов | Сделано. Пустые files/неизвестный ID ничего не запускают. fetch/decode/play ошибки обработаны, отсутствующее media не перезапрашивается каждый кадр. |
| Один AudioContext и жест | Сделано. pointerdown/touchend/keydown, audioSession playback. Тихого служебного audio нет. |
| Master + ui/sfx/amb/music | Сделано. Громкости применяются сразу через GainNode. |
| Короткие звуки, варианты, кэш, предзагрузка | Сделано. AudioBuffer только для ui/sfx, до четырёх запросов предзагрузки одновременно. UI банк при меню/первом жесте; игровой банк после меню и при входе героя. |
| Потоковые музыка и окружение | Сделано. HTMLAudioElement → MediaElementSource → шина, loop=true, одна текущая петля на шину, старый поток освобождается после fade. |
| Кроссфейд, null, повтор ID, запуск после жеста | Сделано. 800 мс; тот же ID сохраняет поток; намерение до unlock запоминается. |
| play, gap, max, pitch, x | Сделано. Лимит включает ожидающие декодирования голоса; default max 3; стереопанорама ±0.4; вне камеры дальше 200 px множитель 0.5. Вернувшаяся позже 1 с загрузка короткого звука отбрасывается. |
| Ducking музыки | Сделано. −6 dB на 600 мс при ult/storm/rfinish/phase/bossDown. |
| Окружение в бою, пауза игры | Сделано. lock/снимок арены −6 dB; clear возвращает; пауза музыки −10 dB, media окружения pause. |
| Чужие герои | Сделано. Множитель 0.7 для событий/кадров и петель чужого героя; герой известен через session.me. |
| Скрытая вкладка | Сделано. Suspend контекста и pause media; возврат resume с повторной попыткой на следующем жесте при запрете autoplay. |
| Настройки и миграция | Сделано. Звук + Музыка/Звуки/Окружение 0–100, шаг 10, bc-settings. Старые sound/flashes/shake сохраняются, новые громкости получают 100. |
| UI, сюжет, окружение, бой, герои, враги, боссы, музыка | Подключено 175/175 ID. Конкретные места и оговорки ниже. |
| Тестовая прослушка | Сделано. Кнопка «Звуки» создаётся только при TEST_TOOLS, открывается только в session.testMode. Все ID, поиск, play и stop. Игра на паузе; её автоматическая музыка не перебивает прослушку, amb доступен и на паузе. При закрытии восстанавливается музыка/окружение и прежнее состояние паузы. |
| Без синтеза и правок сети | Сделано. beep/sfx/осцилляторы удалены, вызовы заменены. Общая симуляция и сервер не менялись. |

## Assumptions/Hypotheses

- В текущем клиенте нет старой вставки-знакомства с врагом. `enemy_intro_sting` привязан к первому видимому появлению каждого из семи видов за сессию. Саму вставку не возвращал.
- Карточки `stage.cards` маршрута отключены прежним решением mr.R в StageView. Не возвращал их. `story_card_in/out` подключены к существующим StoryStep card и карточке старого тестового уровня. В текущих STORY_SCENES шагов card нет; ID доступен в прослушке и сработает при добавлении такого шага.
- Шаги ОМОНа со щитом общие с ОМОН, шаги и замахи info_m/info_f общие с info. `shield_bash` отдельный. Это соответствует фактическим семи видам в enemy-data.ts.
- UI join/leave наблюдает героев из снимка и connected, то есть готовых игроков после выбора героя. Присутствие ещё не выбравшего героя комната в снимках не передаёт.
- `rstage.level` уже нумеруется 0…5. Формула rate ровно 1 + 0.08 × level; у ui_charge_step pitch=0. Ступени 32/64 соответствуют level 4/5.
- Буря опознаётся как hit от Анастасии с dmg=STORM_DMG: в sim это 1 и поле tick отсутствует. Для фона бури есть точная длительность storm в снимке; петля останавливается при storm=0.
- Атаки боссов melee/shots/summon не дают bossFx. Их сработка звучит по phase → active; остальные по bossFx. Телеграфы наблюдаются по началу windup, чтобы восстановление предупреждений по сети не дублировало звук каждой полосы.
- Взмах и индивидуальный звук приёма идут на активном кадре из HERO_ANIMS. При отсутствии hit (hop, smoke, blade_draw) берётся начало клипа. Непривязанных приёмов нет; общий whoosh остаётся дополнительным слоем.
- Если событие rland/charm не содержит автора, используется единственный герой соответствующего вида в команде. Новых сетевых полей не добавлял.
- Манифест читается при загрузке страницы. После добавления файлов/изменения манифеста страницу нужно перезагрузить. Ошибки отсутствующего ресурса обрабатываются в коде без unhandled rejection; диагностику HTTP браузера это не отключает.

## Проверки

| Команда | Результат |
|---|---|
| `npx tsc -p tsconfig.json --noEmit` | exit 0, вывода нет |
| `node --import tsx client/tests/audio-test.ts` | exit 0, две строки OK: движок и игровые привязки |
| `node --import tsx server/src/sim-test.ts` | exit 0, «Все проверки прошли» |
| `node --import tsx server/src/story-test.ts` | exit 0, «Все проверки прошли» |
| `node --import tsx server/src/lane-test.ts` | exit 0, 7/7 масок, «Все проверки прошли» |
| `node --import tsx server/src/boss-crowd-test.ts` | exit 0, boss/crowd checks passed |
| `node --import tsx server/src/enemy-sheets-test.ts` | exit 0, 74 ENEMY_ANIMS + 9 KATYA_ANIMS = 83 листа |
| `node --import tsx server/src/hero-controls-test.ts` | exit 0, Hero control checks passed |
| `cd client && node ../node_modules/vite/bin/vite.js build` | exit 0, 82 modules, built; предупреждение Vite о чанке >500 kB |
| `git diff --check` | exit 0, вывода нет |

Механические аудиопроверки: миграция, один контекст, отложенный старт media, отсутствие decode длинных файлов, crossfade 800 мс, кэш, gap/max, варианты без повтора, rate/pitch, pan/расстояние, отмена ожидающей загрузки, тишина при 404/decode error/неизвестном ID, громкости/ducking/пауза/visibility, прослушка amb на паузе. Игровые: конкретные приёмы, два шага за цикл и бег, enemy windup/strike/shield, freeze/launch/fall, поезд, буря без tick, чужой герой ×0.7, блок, три босса и телеграфы/фазы/поражение, остановка петли при выходе из приёма. Это проверки механики, не качества звучания.

## Приёмка Claude

- Браузер без файлов: меню → выбор → игра, настройки, все сцены; никаких необработанных JS-ошибок.
- Затем с заполненным манифестом: menu/route/boss/finale, переходы, повтор того же трека, crossfade/null, войти/выйти из каталога прослушки, стоп петель, возврат прежней паузы.
- 844×390 и 667×375: прокрутка настроек и длинного списка ID, работа range и поиска, кнопка «Звуки» только в ТЕСТ.
- Бой всеми героями: активные кадры, шаги своего + двух ближайших чужих, только два ближайших видимых врага, уровни Рамиля 32/64, остановка spin/hurricane/storm при паузе/переходе/смерти.
- Боссы: отдельные tele/active, phase/down, duck; поражение → fade → победный звук → маршрут или следующий босс. Сюжет: телефоны/пуши, REC, Милонов, отзыв, финал.
- Два клиента: выбор героя и отказ занятых, join/leave, потеря и восстановление связи, чужие звуки ×0.7, общая пауза. Прогнать net-test/story-actors-net-test по процедуре CODEX-LEAD при приёмке; формат сети не менялся.
- Скрыть и вернуть вкладку во время игры/паузы/смены трека, повторить первый жест после возврата при блокировке autoplay.
- Только mr.R: прослушать файлы и баланс шин на реальном iPhone, проверить беззвучный режим, прерывание/возврат Safari и память на длинной музыке. Подтверждения «работает на iPhone» нет.

Скриншоты: не создавались. Браузер, свой сервер, net-test и платные генерации не запускались по ограничениям AGENTS.md.

## ID → точка подключения

Таблицы HERO_MOVES/BOSS_ATTACK_SOUND/BOSS_TELE/ENEMY_STRIKE/EVENT_SOUND используются GameAudio.frame/events/update; для них указана строка таблицы. Динамические ID указывают на формирование имени и вызов. Все 175 ID также доступны через каталог прослушки в main.ts.

| ID | Где | Триггер |
|---|---|---|
| `ui_click` | `client/src/main.ts:39` | делегирование click на document, обычная кнопка |
| `ui_confirm` | `client/src/main.ts:32` | Новая игра / Войти / Продолжить / создание игры |
| `ui_back` | `client/src/main.ts:33` | Назад / закрытие панели |
| `ui_start` | `client/src/game-audio.ts:62` | свой герой впервые появился, вход из выбора в игру |
| `ui_pick_anastasia` | `client/src/main.ts:207` | выбор героя anastasia вместо ui_confirm |
| `ui_pick_nadezhda` | `client/src/main.ts:207` | выбор героя nadezhda вместо ui_confirm |
| `ui_pick_kris` | `client/src/main.ts:207` | выбор героя kris вместо ui_confirm |
| `ui_pick_ramil` | `client/src/main.ts:207` | выбор героя ramil вместо ui_confirm |
| `ui_error` | `client/src/main.ts:89` | неверный код, ошибка подключения/переподключения или pickError |
| `ui_toggle` | `client/src/main.ts:34` | переключатель или input ползунка |
| `ui_pause` | `client/src/game-audio.ts:59` | изменение isPaused → true |
| `ui_resume` | `client/src/game-audio.ts:59` | изменение isPaused → false |
| `ui_room_created` | `client/src/main.ts:133` | успешное создание онлайн-комнаты |
| `ui_player_join` | `client/src/main.ts:280` | новый/подключившийся чужой герой в снимке |
| `ui_player_leave` | `client/src/main.ts:281` | чужой герой исчез/отключён в снимке |
| `ui_connection_lost` | `client/src/main.ts:284` | connectionLost → true |
| `ui_reconnected` | `client/src/main.ts:284` | connectionLost → false |
| `ui_ult_ready` | `client/src/game-audio.ts:95` | своя шкала перешла к 100 |
| `ui_charge_step` | `client/src/game-audio.ts:192` | rstage, rate = 1 + 0.08 × e.level (0…5) |
| `story_line` | `client/src/story.ts:119` | начало отображения реплики |
| `story_type` | `client/src/story.ts:140` | таймер печати; gap 70 мс |
| `story_phone` | `client/src/story.ts:119` | начало отображения phone |
| `story_push` | `client/src/story.ts:121` | push в HUD и phone с push.* / intro.body |
| `story_caption` | `client/src/story.ts:119` | caption |
| `story_card_in` | `client/src/story.ts:119` | card; также карточка старого тестового уровня |
| `story_card_out` | `client/src/story.ts:110` | уход card; таймер карточки старого уровня |
| `story_composition` | `client/src/story.ts:119` | composition |
| `story_rec` | `client/src/game-audio.ts:124` | recording false → true |
| `story_stamp` | `client/src/story.ts:82` | phone kat.withdraw и печать на финальном экране |
| `story_confetti` | `client/src/story.ts:82` | появление финального экрана с конфетти |
| `milonov_enter` | `client/src/game-audio.ts:125` | появление актёра milonov |
| `milonov_exit` | `client/src/game-audio.ts:127` | начало ухода актёра, один раз |
| `enemy_enter_door` | `client/src/game-audio.ts:113` | новый enter на street (именно дверь, прочие враги входят run) |
| `turnstile_reject` | `client/src/game-audio.ts:128` | начало storyScene vestibule |
| `wagon_brake` | `client/src/game-audio.ts:122` | halt -1 → ≥0 |
| `wagon_stop` | `client/src/game-audio.ts:123` | halt достиг HALT_MS |
| `wagon_doors` | `client/src/game-audio.ts:196` | exit из wagon |
| `mayak_train` | `client/src/game-audio.ts:82` | таймер 25–40 с на mayak вне сюжетной вставки |
| `mfc_queue_ping` | `client/src/game-audio.ts:83` | таймер 15–30 с на mfc вне сюжетной вставки |
| `stage_exit` | `client/src/game-audio.ts:196` | exit |
| `whoosh_light` | `client/src/game-audio.ts:115` | активный кадр STRIKES: dmg <18, impact ≠2 |
| `whoosh_heavy` | `client/src/game-audio.ts:157` | активный кадр STRIKES: dmg ≥18 или impact 2 |
| `impact_light` | `client/src/game-audio.ts:177` | hit по врагу, dmg <18 |
| `impact_heavy` | `client/src/game-audio.ts:177` | hit по врагу, dmg ≥18 |
| `impact_finisher` | `client/src/game-audio.ts:177` | hit: kill или impact 2 |
| `impact_air` | `client/src/game-audio.ts:178` | hit по врагу с air >0 |
| `body_launch` | `client/src/game-audio.ts:119` | air 0 → >0 |
| `body_fall` | `client/src/game-audio.ts:120` | HP врага >0 → 0 |
| `hero_hurt` | `client/src/game-audio.ts:172` | hit по игроку |
| `hero_down` | `client/src/game-audio.ts:19` | down |
| `hero_getup` | `client/src/game-audio.ts:96` | anim down → другое состояние |
| `guard_block` | `client/src/game-audio.ts:19` | block |
| `freeze_apply` | `client/src/game-audio.ts:117` | frozen false → true |
| `freeze_break` | `client/src/game-audio.ts:118` | frozen true → false |
| `heal` | `client/src/game-audio.ts:19` | heal |
| `arena_lock` | `client/src/game-audio.ts:19` | lock |
| `wave_start` | `client/src/game-audio.ts:19` | wave |
| `arena_clear` | `client/src/game-audio.ts:19` | clear |
| `team_restart` | `client/src/game-audio.ts:19` | restart |
| `victory_boss` | `client/src/game-audio.ts:188` | bossDown, задержка 300 мс после начала fade музыки |
| `step_asphalt` | `client/src/game-audio.ts:144` | кадры 0 и N/2 ходьбы/бега: street, yard, city |
| `step_tile` | `client/src/game-audio.ts:144` | те же кадры: vestibule, mayak, mfc |
| `step_wagon` | `client/src/game-audio.ts:144` | те же кадры: wagon |
| `nastya_dash` | `client/src/game-audio.ts:6` | prime superman, активный кадр |
| `nastya_highkick` | `client/src/game-audio.ts:6` | prime highkick, активный кадр |
| `nastya_teep` | `client/src/game-audio.ts:6` | prime teep, активный кадр |
| `nastya_uppercut` | `client/src/game-audio.ts:6` | prime uppercut, активный кадр |
| `nastya_cross` | `client/src/game-audio.ts:6` | prime cross, активный кадр |
| `nastya_slam` | `client/src/game-audio.ts:6` | prime slam, кадр axe |
| `nastya_transform` | `client/src/game-audio.ts:190` | ult Анастасии |
| `nastya_knee` | `client/src/game-audio.ts:7` | ultimate knee / flying-knee, активный кадр |
| `nastya_elbow` | `client/src/game-audio.ts:7` | ultimate elbow / spin-elbow, активный кадр |
| `nastya_hurricane` | `client/src/game-audio.ts:91` | петля пока move hurricane |
| `nastya_storm_cast` | `client/src/game-audio.ts:194` | storm |
| `nastya_storm_loop` | `client/src/game-audio.ts:93` | петля пока storm >0 |
| `nastya_storm_hit` | `client/src/game-audio.ts:174` | hit от Анастасии с dmg = STORM_DMG (в sim у бури нет tick) |
| `nadya_swing` | `client/src/game-audio.ts:8` | nadya a1 / a2 / a3, активный кадр |
| `nadya_slap` | `client/src/game-audio.ts:8` | nadya b1, активный кадр |
| `nadya_stun` | `client/src/game-audio.ts:8` | nadya b2, активный кадр |
| `nadya_blade_draw` | `client/src/game-audio.ts:8` | nadya b3-draw, начало клипа |
| `nadya_dash` | `client/src/game-audio.ts:19` | dash |
| `nadya_dash_hit` | `client/src/game-audio.ts:8` | nadya b3-end, начало клипа |
| `nadya_kiss` | `client/src/game-audio.ts:19` | kiss |
| `nadya_charm` | `client/src/game-audio.ts:19` | charm |
| `kris_tripod_swing` | `client/src/game-audio.ts:9` | kris a1-back / a2, активный кадр |
| `kris_tripod_hit` | `client/src/game-audio.ts:181` | hit от Kris в ближнем приёме / слова СТОП!, ВЖУХ! |
| `kris_hop` | `client/src/game-audio.ts:9` | kris hop, начало клипа |
| `kris_shutter` | `client/src/game-audio.ts:195` | shot |
| `kris_flash_hit` | `client/src/game-audio.ts:195` | shot, у цели через время полёта FLASH_SPEED |
| `kris_ball_throw` | `client/src/game-audio.ts:19` | ball |
| `kris_ball_boom` | `client/src/game-audio.ts:19` | boom |
| `kris_aim` | `client/src/game-audio.ts:19` | aim |
| `kris_beam` | `client/src/game-audio.ts:19` | beam |
| `ramil_dash` | `client/src/game-audio.ts:19` | rdash / tele с fromX |
| `ramil_kick` | `client/src/game-audio.ts:10` | ramil a1, активный кадр |
| `ramil_grab` | `client/src/game-audio.ts:10` | ramil a2, активный кадр |
| `ramil_spin` | `client/src/game-audio.ts:92` | петля пока move a3-spin (~1 с) |
| `ramil_spin_hit` | `client/src/game-audio.ts:19` | rspinHit, gap 90 |
| `ramil_meteor_up` | `client/src/game-audio.ts:10` | ramil a3-throw, активный кадр |
| `ramil_meteor_land` | `client/src/game-audio.ts:19` | rland |
| `ramil_roundhouse` | `client/src/game-audio.ts:10` | ramil b2, активный кадр |
| `ramil_fire` | `client/src/game-audio.ts:10` | ramil b3, активный кадр |
| `ramil_burn_tick` | `client/src/game-audio.ts:175` | hit tick от Рамиля, gap 400 |
| `ramil_smoke` | `client/src/game-audio.ts:10` | ramil smoke, начало цикла |
| `ramil_flurry_start` | `client/src/game-audio.ts:193` | flurry k=0 |
| `ramil_flurry_hit` | `client/src/game-audio.ts:193` | flurry level <4, gap 70 |
| `ramil_flurry_roll` | `client/src/game-audio.ts:193` | flurry level 4/5 (32/64), gap 400 |
| `ramil_flurry_finish` | `client/src/game-audio.ts:19` | rfinish |
| `omon_step` | `client/src/game-audio.ts:145` | кадры 0 и N/2 ходьбы omon; два ближайших видимых врага, gap 250 |
| `vatnik_step` | `client/src/game-audio.ts:145` | кадры 0 и N/2 ходьбы vatnik; два ближайших видимых врага, gap 250 |
| `zek_step` | `client/src/game-audio.ts:145` | кадры 0 и N/2 ходьбы zek; два ближайших видимых врага, gap 250 |
| `clerk_step` | `client/src/game-audio.ts:145` | кадры 0 и N/2 ходьбы clerk; два ближайших видимых врага, gap 250 |
| `info_step` | `client/src/game-audio.ts:145` | кадры 0 и N/2 ходьбы info; два ближайших видимых врага, gap 250 |
| `omon_windup` | `client/src/game-audio.ts:114` | anim → windup: группа omon |
| `vatnik_windup` | `client/src/game-audio.ts:114` | anim → windup: группа vatnik |
| `zek_windup` | `client/src/game-audio.ts:114` | anim → windup: группа zek |
| `clerk_windup` | `client/src/game-audio.ts:114` | anim → windup: группа clerk |
| `info_windup` | `client/src/game-audio.ts:114` | anim → windup: группа info |
| `omon_strike` | `client/src/game-audio.ts:18` | anim → strike/dash, реальный вид из ENEMY_STRIKE; shield_bash только omon_shield |
| `shield_bash` | `client/src/game-audio.ts:18` | anim → strike/dash, реальный вид из ENEMY_STRIKE; shield_bash только omon_shield |
| `vatnik_strike` | `client/src/game-audio.ts:18` | anim → strike/dash, реальный вид из ENEMY_STRIKE; shield_bash только omon_shield |
| `zek_dash` | `client/src/game-audio.ts:18` | anim → strike/dash, реальный вид из ENEMY_STRIKE; shield_bash только omon_shield |
| `clerk_strike` | `client/src/game-audio.ts:18` | anim → strike/dash, реальный вид из ENEMY_STRIKE; shield_bash только omon_shield |
| `info_m_dash` | `client/src/game-audio.ts:18` | anim → strike/dash, реальный вид из ENEMY_STRIKE; shield_bash только omon_shield |
| `info_f_strike` | `client/src/game-audio.ts:18` | anim → strike/dash, реальный вид из ENEMY_STRIKE; shield_bash только omon_shield |
| `enemy_hurt_light` | `client/src/game-audio.ts:180` | hit, обычный враг |
| `enemy_hurt_heavy` | `client/src/game-audio.ts:180` | hit, KIND.role tank: clerk / omon_shield |
| `enemy_intro_sting` | `client/src/game-audio.ts:112` | первое видимое появление вида за сессию |
| `boss_tele` | `client/src/game-audio.ts:107` | boss phase windup для атак без отдельного _tele |
| `shaman_intro` | `client/src/game-audio.ts:106` | новый живой босс shaman в снимке |
| `shaman_mic_windup` | `client/src/game-audio.ts:17` | windup mic |
| `shaman_mic_hit` | `client/src/game-audio.ts:13` | active mic (у melee нет bossFx) |
| `shaman_vstayu_tele` | `client/src/game-audio.ts:17` | windup vstayu |
| `shaman_vstayu` | `client/src/game-audio.ts:13` | bossFx vstayu |
| `shaman_chorus_tele` | `client/src/game-audio.ts:17` | windup chorus |
| `shaman_chorus` | `client/src/game-audio.ts:13` | bossFx chorus |
| `shaman_pyro_tele` | `client/src/game-audio.ts:17` | windup pyro |
| `shaman_pyro` | `client/src/game-audio.ts:13` | bossFx pyro |
| `shaman_salute` | `client/src/game-audio.ts:13` | bossFx salute |
| `shaman_cross` | `client/src/game-audio.ts:13` | bossFx crossStage |
| `shaman_fans` | `client/src/game-audio.ts:13` | active fans (у summon нет bossFx) |
| `shaman_phase2` | `client/src/game-audio.ts:187` | phase босса shaman |
| `shaman_down` | `client/src/game-audio.ts:187` | bossDown босса shaman |
| `pizdulina_intro` | `client/src/game-audio.ts:106` | новый живой босс pizdulina в снимке |
| `pizdulina_slap` | `client/src/game-audio.ts:14` | active slap (у melee нет bossFx) |
| `pizdulina_ban_tele` | `client/src/game-audio.ts:17` | windup banStrike |
| `pizdulina_ban` | `client/src/game-audio.ts:14` | bossFx banStrike |
| `pizdulina_shots` | `client/src/game-audio.ts:14` | active shots (нет bossFx) |
| `pizdulina_grid_tele` | `client/src/game-audio.ts:17` | windup grid |
| `pizdulina_grid` | `client/src/game-audio.ts:14` | bossFx grid |
| `pizdulina_zone` | `client/src/game-audio.ts:14` | bossFx zones |
| `pizdulina_cross` | `client/src/game-audio.ts:14` | bossFx crossBan |
| `pizdulina_omon` | `client/src/game-audio.ts:14` | active omon (у summon нет bossFx) |
| `pizdulina_phase2` | `client/src/game-audio.ts:187` | phase босса pizdulina |
| `pizdulina_down` | `client/src/game-audio.ts:187` | bossDown босса pizdulina |
| `katya_intro` | `client/src/game-audio.ts:106` | новый живой босс katya в снимке |
| `katya_heavy` | `client/src/game-audio.ts:15` | active katHeavy / katHeavy2 (нет bossFx) |
| `katya_ground` | `client/src/game-audio.ts:15` | bossFx katGround / katGround2 |
| `katya_rush` | `client/src/game-audio.ts:15` | active katRush (нет bossFx) |
| `katya_phase2` | `client/src/game-audio.ts:187` | phase босса katya |
| `katya_down` | `client/src/game-audio.ts:187` | bossDown босса katya |
| `amb_street` | `client/src/game-audio.ts:71` | stage.id street, потоковая петля |
| `amb_yard` | `client/src/game-audio.ts:71` | stage.id yard, потоковая петля |
| `amb_vestibule` | `client/src/game-audio.ts:71` | stage.id vestibule, потоковая петля |
| `amb_wagon` | `client/src/game-audio.ts:71` | stage.id wagon, потоковая петля |
| `amb_mayak` | `client/src/game-audio.ts:71` | stage.id mayak, потоковая петля |
| `amb_city` | `client/src/game-audio.ts:71` | stage.id city, потоковая петля |
| `amb_mfc` | `client/src/game-audio.ts:71` | stage.id mfc, потоковая петля |
| `music_menu` | `client/src/game-audio.ts:53` | главное меню / выбор героя, без amb |
| `music_route1` | `client/src/game-audio.ts:78` | street, yard, vestibule, wagon, без живого босса |
| `music_route2` | `client/src/game-audio.ts:78` | mayak, city, mfc, без живого босса |
| `music_shaman` | `client/src/game-audio.ts:78` | живой босс shaman; после bossDown fade и возврат к музыке локации через 800 мс |
| `music_pizdulina` | `client/src/game-audio.ts:78` | живой босс pizdulina; после bossDown fade и возврат к музыке локации через 800 мс |
| `music_katya` | `client/src/game-audio.ts:78` | живой босс katya; после bossDown fade и возврат к музыке локации через 800 мс |
| `music_finale` | `client/src/game-audio.ts:78` | withdrawal / finaleReady / victory / showFinale |
