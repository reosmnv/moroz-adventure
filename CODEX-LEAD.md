# CODEX-LEAD: Codex ведёт проект сам (с 03.11.2026)

У Claude кончились лимиты недели. С этого момента Codex и архитектор, и исполнитель, и приёмка. Этот файл отменяет ограничения раздела «Нельзя» и «Проверки» в `AGENTS.md`, кроме тех, что повторены ниже. Схема ТЗ→ветка `tz-NN`→приёмка остаётся по желанию, не обязательна.

Порядок чтения при старте: этот файл → `HANDOFF.md` → `CLAUDE.md` (команды, грабли, архитектура) → `PLAN.md` по нужной теме → `SCENARIO.md`/`SOUNDS.md` при работе с текстами/звуком → `../PIXELLAB.md` перед любой генерацией.

## Теперь можно (mr.R разрешил это ведущему агенту ранее)
- Коммитить в `main`, пушить (`git push` → GitHub Pages за ~2 мин). Только по просьбе mr.R или после его «выкладывай»; приёмку принятых им правок можно выкладывать сразу, как раньше делал Claude.
- Вести `HANDOFF.md`, `HANDOFF-archive.md`, `PLAN.md`, `tasks/`.
- Перезапуск боевого сервера после пуша: `sudo -S -p '' systemctl restart birthday-coop < ~/.secrets/sudo`, затем `curl http://127.0.0.1:2567/health` и `SERVER_URL=http://127.0.0.1:2567 npm run test:net`. Пароль не печатать и не коммитить.
- Свой тестовый сервер на :2568 и `npm run test:net` на нём.
- Генерации PixelLab без вопросов о цене (решение mr.R 23.10: качество важнее экономии). Через `python3 tools/pl.py <tool> '<json>'`, токен скрипт берёт из `~/.claude.json` сам. Очередь: `tools/queue.py`. Не запускать повторно задачу, которая ещё идёт: двойной счёт. Ждать через `wait_for_jobs`.
- Концепты новых персонажей и поз: картинкой GPT по подписке (`codex exec --image <ref> - < prompt.txt`), PixelLab только после выбора mr.R.

## По-прежнему нельзя
- Удалять/перезаписывать чужие файлы: ассеты, `assets/source/` (там фото людей), `client/public/`, `tools/specs/`. `git clean`, `git reset --hard`, `git checkout -- .` запрещены.
- Коммитить фото из `assets/source/hero4/` и вообще `assets/source/` (в .gitignore, репозиторий публичный).
- `pkill -f` с шаблоном, `ops/dev.sh` при живом боевом сервере без нужды.
- Genex и другие платные сервисы кроме PixelLab: только после названной цены и «да» mr.R.
- Писать «работает на iPhone»: звук и iPhone проверяет только mr.R.
- Править `shared/src/anims-data.ts` руками (генерирует `tools/gen_anims_ts.py`).

## Как запускать Codex, чтобы всё это работало
Песочница по умолчанию без сети и без sudo: не пройдут push, test:net, Playwright, PixelLab. Ведущему нужен полный доступ:
```
cd ~/games/birthday-coop && codex -m gpt-6.1-sol --sandbox danger-full-access -a on-request
```
Через веб-интерфейс CloudCLI: открыть проект `~/games/birthday-coop` (не `~/games`), в настройках сессии Codex выбрать режим полного доступа (bypass / full access), иначе не будет сети для push, test:net, PixelLab и Haiku.
Если Codex падает с `bwrap: loopback: Failed RTM_NEWADDR: Operation not permitted` или `bwrap ... Operation not permitted`: это AppArmor, не права на папку. Профили `/etc/apparmor.d/codex-userns` (точный путь) и `codex-userns-any` (шаблон `/home/agent/**/@openai/codex-linux-x64/vendor/*/bin/codex`, покрывает копию CloudCLI и обновления, добавлен 03.11). Проверка: `<путь к codex> sandbox -- bash -c 'echo OK'`. Если Node переехал из `/home/agent`, шаблон надо поправить.

## Проверки перед выкладкой
- `npx tsc -p tsconfig.json`; сборка `node ../node_modules/vite/bin/vite.js build` в `client/` (`npx vite build` тут молча выходит с кодом 216).
- `npm run test:sim` (если падает в песочнице: `node --import tsx server/src/sim-test.ts`).
- После правок `shared/`/`server/`: `test:net` на :2568, после пуша и рестарта на боевом.
- Браузер: Playwright импортом по абсолютному пути `/home/agent/node_modules/playwright/index.mjs`, пример `scratchpad/pw2.mjs`: офлайн, `?stage=N`, `?fx=0`, тест-режим из меню. Скриншоты в `scratchpad/`. Размеры iPhone: 844x390 и 667x375.
- В отчёте mr.R: что проверено, что глазами не видел.
- Строка `CLAUDE.md` «Playwright на VPS не работает» устарела: работает по абсолютному пути выше.

## Что знать о mr.R и игре (из памяти Claude)
- Игра личный подарок имениннице Анастасии, вручение **07.11.2026**, срок не двигается, режется объём. Играют друзья, не все геймеры: сложность щадящая, баланс на четверых, одному трудно.
- Не добавлять объяснения для посторонних («1–4 игрока», «у каждого свой телефон», роли героев): игра персональная (02.11).
- Сюжет и сатира заданы mr.R (`SCENARIO.md`, `PLAN.md`): не возвращаться к «бытовым» врагам, предлагать внутри сюжета. Пиздулина = Екатерина, блондинка. Ульта Нади не действует на боссов, Шаман отвечает «я люблю только Катеньку».
- Рамиль = сам mr.R (`characters/hero4.md`).
- На вопрос «как сделать лучше» отвечать вариантами словами (таблица + рекомендация), генерировать и кодить после выбора (02.11).
- Тесты mr.R только по ссылке Pages https://reosmnv.github.io/moroz-adventure/, без тестовых адресов в tailnet.
- Публичный репозиторий раскрывает сюрприз и сатиру (вопрос T9 открыт): напоминать одной строкой, не решать за него.
- Будильники «начни в 6 утра» ненадёжны: не обещать.

## Помощники (бывшие субагенты Claude)
Скиллы в `~/.codex/skills/`: `playtester`, `game-code-reviewer`, `anim-planner`, `anim-producer`, `anim-reviewer`. Примеры Playwright: `tools/playtest/`.
**Правило mr.R (03.11): механическую работу сначала отдавать Claude Haiku.** Он почти не тратит лимит Claude и не тратит лимит ChatGPT.
1. Сначала Haiku (агенты `playtester`, `anim-producer`):
```
ops/haiku.sh playtester scratchpad/playtest-report.md \
  'Игра ~/games/birthday-coop, прочитай tools/playtest/README.md. Сценарий: <шаги>. Клиент подними на свободном порту, боевой :2567 не трогай. Скриншоты в birthday-coop/scratchpad/pt/.'
```
   Код 0: отчёт в файле. Код 3: Claude недоступен (кончился лимит или сеть).
2. Только при коде 3 тот же скилл на Terra:
```
codex exec -m gpt-6.1-terra --sandbox danger-full-access -o scratchpad/playtest-report.md \
  'Используй $playtester. Игра ~/games/birthday-coop. Сценарий: <шаги>. Скриншоты в scratchpad/pt/.'
```
- Haiku видит только текст задания: пиши сценарий полностью (URL, порт, кнопки, что считать багом). Haiku не даёт генераций PixelLab, в `anim-producer` они ему и запрещены.
- Ревью кода и приёмка анимаций (`game-code-reviewer`, `anim-reviewer`) на Sol: там нужна внимательность, Haiku не годится. `anim-planner` на Sol high.
- Отчёт помощника проверяй сам: открой 2–3 его скриншота.

## Модели ChatGPT Plus (лимит за 5 ч)
| Работа | Модель | effort |
|---|---|---|
| Основная работа, sim/сеть | gpt-6.1-sol | high |
| Интерфейс, мелкие правки | gpt-6.1-sol / gpt-6.1-terra | medium |
| Аудит, ресерч, Sol дважды не справился | gpt-6-astra | low и выше |
Упёрлись в лимит Sol: мелкое переводить на Terra.

## Незакоммиченное на 03.11 (не потерять)
`git status`: изменён `HANDOFF.md`; не в git `SOUNDS.md`, `assets/gen/hero4/`, `assets/pixellab/ramil/`, `assets/pixellab/enemies/miz-*`, `assets/ui/raw/ramil_*`, `assets/enemy-concept/`, `assets/level-route/build/`. Это рабочие исходники генераций. Коммитить по просьбе mr.R, ничего из этого не удалять.
