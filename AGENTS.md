# AGENTS.md: правила для Codex в birthday-coop

Кооп-битэмап ко дню рождения. Схема (одна, с 07.11): Claude ведущий, пишет ТЗ (`tasks/TZ-NN-*.md`) и принимает; ты (Codex) исполнитель, тебя запускает Claude-оркестратор через `codex exec`; генерации ассетов делает Claude; решения принимает mr.R. Полные правила проекта: `CLAUDE.md`, план: `PLAN.md`, запуск и окружение Codex: `CODEX-LEAD.md`. Жёсткого срока нет.

## Как работаем
- Одно ТЗ = одна ветка `tz-NN`. Работай в текущей ветке, другие не трогай.
- Делай ровно то, что в ТЗ. Нашёл проблему вне ТЗ: опиши в отчёте, не чини сам.
- Неясно или требование противоречит коду: выбери самый простой вариант, назови его в отчёте как допущение.
- Отчёт в конце: изменённые файлы; по каждому требованию ТЗ сделано или нет; допущения; команды проверок и их вывод; пути к скриншотам.

## Нельзя
- Править `HANDOFF.md`, `HANDOFF-archive.md`, `PLAN.md`, `tasks/`: это ведёт Claude. Всё, что хочешь передать, пиши в отчёт.
- Коммитить, пушить, мержить, переключать ветки, `git reset`/`git checkout -- .`/`git clean`.
- Удалять или перезаписывать файлы, которые не создавал сам (ассеты, спрайты, `assets/`, `client/public/`, `tools/specs/`).
- Запускать генерации (PixelLab, Genex) и тратить платные сервисы.
- Запускать `ops/dev.sh`, `pkill -f`, трогать systemd-сервис `birthday-coop`: на :2567 работает боевой сервер.
- Менять `TEST_TOOLS` в `shared/src/sim.ts`.

## Архитектура (держать)
- `shared/src/sim.ts`: вся логика боя, чистые функции, без Phaser и Colyseus, случайность только через `world.seed`.
- `server/`: Colyseus 0.18. Поле `inputs` в Room зарезервировано Colyseus, не использовать.
- `client/`: Phaser 4.2 + Vite. Сцена знает только снимки и события из `GameSession`, веток `if (online)` в рендере нет.
- UI с `setScrollFactor(0)` и позицией от `this.scale.width`: ширина игры меняется под экран, высота фиксирована 270.
- `shared/src/anims-data.ts` генерируется `tools/gen_anims_ts.py`, руками не править.
- Стиль: TypeScript без новых зависимостей, короткие комментарии по-русски, константы в начале файла.

## Проверки
Песочница Codex (`workspace-write`) без сети и без listen: свой сервер, `net-test`, `story-actors-net-test` и браузер у тебя не запустятся. Их делает Claude при приёмке (Playwright на VPS работает импортом `/home/agent/node_modules/playwright/index.mjs`), не трать на них попытки.
Твои проверки:
- `npx tsc -p tsconfig.json --noEmit` (весь проект), сборка `cd client && node ../node_modules/vite/bin/vite.js build` (`npx vite build` молча выходит с кодом 216).
- После правок `shared/`/`server/`: `node --import tsx server/src/{sim,story,lane,boss-crowd,enemy-sheets,hero-controls}-test.ts` из корня проекта (`npm run test:sim` в песочнице падает).
- В отчёте перечисли, что Claude должен проверить в браузере и по сети.
- Звук и iPhone проверяет только mr.R: не пиши «работает на iPhone».
