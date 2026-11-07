# CODEX-LEAD: как Claude запускает Codex (схема с 07.11)

Схема «Codex ведёт проект сам» (03.11) отменена; её текст в `HANDOFF-archive.md`, раздел «Архив 07.11». Сейчас: Claude ведущий (ТЗ, приёмка, коммит в `tz-NN`, генерации), Codex исполнитель (`AGENTS.md`), решения mr.R. Жёсткого срока нет.

## Запуск исполнителя
Из корня рабочего дерева (лучше отдельный `git worktree` на ветку `tz-NN`, чтобы не мешать параллельной работе):
```
timeout 2400 codex exec -s workspace-write --skip-git-repo-check -c model_reasoning_effort=high -o <файл-ответа> - < <файл-ТЗ>
```
- Модель по умолчанию gpt-6.1-sol. Без `-c model_reasoning_effort=high` работает без рассуждений.
- `workspace-write`: без сети и без listen. Сервер, `net-test`, `story-actors-net-test`, Playwright гоняет Claude при приёмке.
- Независимые пачки можно запускать параллельно, если у них не пересекаются файлы. Идущую задачу не перезапускать.
- Если Codex падает с `bwrap: loopback: Failed RTM_NEWADDR: Operation not permitted`: это AppArmor, не права на папку. Профили `/etc/apparmor.d/codex-userns` и `codex-userns-any` (шаблон `/home/agent/**/@openai/codex-linux-x64/vendor/*/bin/codex`). Проверка: `<путь к codex> sandbox -- bash -c 'echo OK'`.

## Модели ChatGPT Plus (лимит за 5 ч)
| Работа | Модель | effort |
|---|---|---|
| Основная работа, sim/сеть | gpt-6.1-sol | high |
| Интерфейс, мелкие правки | gpt-6.1-sol / gpt-6.1-terra | medium |
| Аудит, ресерч, Sol дважды не справился | gpt-6-astra | low и выше |

## Приёмка (делает Claude)
- `npx tsc -p tsconfig.json --noEmit`; `node --import tsx server/src/{sim,story,lane,boss-crowd,enemy-sheets,hero-controls}-test.ts`; сборка `cd client && node ../node_modules/vite/bin/vite.js build`.
- После правок `shared/`/`server/`: свой сервер `HOST=127.0.0.1 PORT=2568 node --import tsx server/src/index.ts`, затем `SERVER_URL=http://127.0.0.1:2568 node --import tsx server/src/net-test.ts`; `story-actors-net-test` (фикстура `PORT=2569 ... --serve`, затем клиент). Боевой :2567 (systemd `birthday-coop`) не трогать, `ops/dev.sh` при живом боевом не запускать, процессы останавливать по PID.
- Браузер: Playwright импортом `/home/agent/node_modules/playwright/index.mjs` (пример `scratchpad/tz22b-main.mjs`), vite dev на своём порту, 844x390 и 667x375. Механический прогон можно отдать Haiku: `ops/haiku.sh playtester <отчёт> '<полный сценарий>'`.
- Звук и iPhone проверяет только mr.R: не писать «работает на iPhone».

## Что знать о mr.R и игре
- Игра личный подарок Анастасии. Играют друзья, не все геймеры: сложность щадящая, баланс на четверых. Объяснений для посторонних не добавлять.
- Сюжет и сатира заданы mr.R (`STORY-V3.md`, `PLAN.md`). Рамиль = сам mr.R (`characters/hero4.md`).
- На «как сделать лучше» отвечать вариантами (таблица + рекомендация), генерировать и кодить после выбора.
- Тесты mr.R по ссылке Pages https://reosmnv.github.io/moroz-adventure/. Публичный репозиторий раскрывает сюрприз и сатиру (вопрос T9 открыт).
- Не трогать без задания: `TEST_TOOLS=true` (решение mr.R), `assets/source/` (фото людей, в .gitignore), `shared/src/anims-data.ts` (генерируется).
