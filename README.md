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

Управление: джойстик в левой половине экрана (в покое виден полупрозрачным слева внизу), справа A (кулак, серия), B (нога, завершающий), рожица (насмешка), U (молния, ульта; кольцо вокруг показывает заряд).
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
| Интерфейс: кнопка, стик, иконки A/B/U/насмешки, рамка портрета, портреты Prime и Ultimate | `client/public/ui/`, все кандидаты в `assets/ui/raw/` (спеки `tools/specs/ui.json`) | PixelLab (`create_image_pro` со спрайтом героини как образцом стиля, `create_portrait_character`), выбор и обрезка вручную | По ToS PixelLab, как спрайты |
| Шрифт Press Start 2P (кириллица есть) | `client/public/fonts/` | CodeMan38, Google Fonts | SIL Open Font License 1.1 (`client/public/fonts/OFL.txt`) |

Формат листов: полоса кадров 128x128, ступни на y=112, центр корпуса на x=64. В `anims.json` у каждой анимации число кадров по направлениям, `fps`, `loop`, у ударов `hit` (номер кадра попадания).
Просмотр: `python3 -m http.server 8090 --bind 100.118.72.60` в папке проекта, затем http://100.118.72.60:8090/anim-preview/ (или GIF в `assets/sprites/gif/`).
Пересборка: `python3 tools/sprites.py fetch && python3 tools/sprites.py build && python3 tools/gifs.py`.
