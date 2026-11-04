# Примеры Playwright для прогонов (перенесены из временных папок Claude 03.11)
Запуск: `node <скрипт>.mjs <папка-скриншотов>` (offline-example берёт папку из env `S`, стадию из `ST`).
Playwright импортируется по абсолютному пути `/home/agent/node_modules/playwright/index.mjs`. Для WebGL: `--use-gl=swiftshader --enable-webgl`.
- `prod-example.mjs`: боевая ссылка Pages, меню после TZ-18 (`#start`, `#newOnline`, `#menuNote`). Селекторы актуальные.
- `online-example.mjs`: два клиента (хост + друг по ссылке) на локальном клиенте :5199.
- `offline-example.mjs`: старый офлайн-прогон до TZ-18 (чекбокс `#online` уже убран, меню сменилось): брать как образец ударов J/K/U и `?stage=N`, селекторы меню взять из prod-example.
Клиент для прогона поднимать отдельно (vite dev/preview на свободном порту), боевой :2567 не трогать.
