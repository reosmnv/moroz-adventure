# Задачи для Codex: схема работы (решение mr.R 30.10)

Роли: Claude = архитектор, автор ТЗ, тестер и приёмка; Codex = код по ТЗ; mr.R = решения и проверка на iPhone.
План и статусы: `PLAN.md`. Правила для Codex: `AGENTS.md`.

## Цикл одного ТЗ
1. Claude пишет `tasks/TZ-NN-<тема>.md`: цель, ограничения, требования R1..Rn, таблица приёмки, что не входит. Решения mr.R записаны в PLAN.md.
2. Claude создаёт ветку `tz-NN` от `main` (без коммита) и запускает Codex напрямую из основной сессии, фоновой командой Bash (`run_in_background`):
   `node ~/.claude/plugins/marketplaces/openai-codex/plugins/codex/scripts/codex-companion.mjs task --write --model <модель> --effort <уровень> --cwd /home/agent/games/birthday-coop "Выполни tasks/TZ-NN-...md ..."`
   Не через субагент `codex:codex-rescue` с `--background`: 30.10 его фоновый процесс убивался при завершении субагента, Codex обрывался на середине. Статус: `codex-companion.mjs status --cwd ...`.
3. Приёмка Claude: diff, `tsc`, `vite build`, `test:sim`/`test:net` (свой сервер :2568), Playwright-скриншоты, сверка с таблицей приёмки. Можно добавить `/codex:review` как второе мнение.
4. Замечания: та же команда с `--resume-last` и текстом правок, повторить шаг 3.
5. Принято Claude: коммит в `tz-NN`, мерж в `main` (ff), пуш (Pages ~2 мин), `sudo systemctl restart birthday-coop`, `test:net` на боевом сервере, скриншоты с Pages. mr.R тестирует всё по одной ссылке https://reosmnv.github.io/moroz-adventure/ (решение mr.R 30.10: все тесты сразу с деплоем, без тестовых адресов в tailnet).
6. Статус ТЗ в PLAN.md и строка в HANDOFF.md.

## Модели (ChatGPT Plus, решение 30.10)
| Работа | Модель | Флаги |
|---|---|---|
| ТЗ: интерфейс, клиент | gpt-6.1-sol | `--model gpt-6.1-sol --effort medium` |
| ТЗ: sim, сеть, сервер | gpt-6.1-sol | `--model gpt-6.1-sol --effort high` |
| Правки по замечаниям приёмки | gpt-6.1-terra | `--resume --model gpt-6.1-terra --effort medium` |
| Sol дважды не справился | gpt-6-astra | `--model gpt-6-astra --effort low`, выше по необходимости |
Лимит Plus за 5 ч (оценка OpenAI): Sol 15–160, Terra 35–285, Astra 5–45 запросов. Упёрлись в лимит: ждать сброса или переводить мелкое на Terra.

## Пока Codex работает
Claude не правит те же файлы в той же рабочей папке. Генерации PixelLab и сборка ассетов (`assets/`, `tools/*.py`) идут параллельно, если ТЗ их не касается.

## Список
| ТЗ | Тема | Ветка | Статус |
|---|---|---|---|
| TZ-01 | Кнопки x1.5, насмешка по портрету, раскладка по числу кнопок, стик x1.3, цвет героя, камера с запасом | tz-01 | выложено 30.10 (коммит a3e7676, Pages, сервис перезапущен, test:net на боевом OK); ждёт отзыва mr.R |
| TZ-02 | Анастасия: две цепочки, врыв, жонглирование, счётчик, кегли, кураж | tz-02 | выложено 30.10 (tsc, sim, test:net на :2568, Playwright: подброс, слова, счётчик, Ultimate); ждёт отзыва mr.R |
| TZ-03 | Kris: обратный взмах, взмах с отбросом, отскок назад | tz-03 | ждёт TZ-02 (те же файлы) |

