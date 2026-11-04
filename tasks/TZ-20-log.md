# TZ-20: журнал этапов

План: `tasks/TZ-20-comic-scenes.md`. Ветка `tz-20` от main 864331d.

## S0 04.11 вечер готово (Claude)
Сделано: план, контракт данных, ветка.
Дальше: S1.

## S1 2026-11-04 17:55 CET готово
Сделано: ActorRef, at, act (spawn/walk/face/exit/pose/focus, keep); actors и камера в World, Schema и Snapshot. Общий tickStory отдельно от боя в сервере и LocalSession, защита act от storyNext, очистка сцены. Герой двигается через актёра по char, отсутствующий пропускается. keep сохраняется до конца sender.
Проверено (команды и итог): npx tsc -p tsconfig.json --noEmit; npm run test:story (включая таймер, нулевые шаги, дубли, героя и очистку); npm run test:sim; npm run test:lane; Vite build; git diff --check: OK. node --import tsx server/src/story-actors-net-test.ts --serve + клиент без --serve: все 7 OK, reconnect и смена ведущего посреди act, актёр/камера через Schema. SERVER_URL=http://127.0.0.1:2569 npm run test:net: ВСЕ OK; сервер из /tmp/tz20-net-m2ikmsjx с TEST_TOOLS=true, в ветке false. Лог: scratchpad/tz20/test-net.log.
Не проверено: браузер (начинается в S2), iPhone/звук.
Коммит: 227cb84.
Дальше: S2. Работать в /home/agent/games/birthday-coop-tz20 (worktree tz-20). Исходная папка birthday-coop остаётся на main с НЕЗАВЕРШЁННЫМ чужим git revert; git switch tz-20 там отклонён Git, состояние не изменяли. :2568 занят прежним сервером mr.R, проверка на :2569.
Вопросы mr.R / Claude: нет. Допущение: keep=true удерживает актёра до завершения sender, камера сбрасывается после каждой сцены.
