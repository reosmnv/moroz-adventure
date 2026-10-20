# Развёртывание birthday-coop с нуля (SPEC H-7)

Схема: клиент на GitHub Pages (https) → `wss://<ip-через-дефисы>.sslip.io` → Caddy (80/443 на публичном IP) → Colyseus на `127.0.0.1:2567` под systemd.
Бесплатно: домен через sslip.io, сертификат Let's Encrypt выпускает сам Caddy.

## Что нужно
- VPS с Ubuntu 22.04/24.04, публичным IPv4 и sudo; Node 22+ (у нас через nvm).
- Свободные 80 и 443 на публичном IP. Если на машине есть Tailscale с `tailscale serve`, он держит 443 на 100.x: это не мешает, потому что Caddy биндится только на публичный IP (`bind` в Caddyfile).
- Если у провайдера VPS свой файрвол в панели, открыть там TCP 80 и 443 (скрипт этого не видит).
- Аккаунт GitHub. Pages на бесплатном тарифе только из публичного репозитория ([docs](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)).

## 1. Сервер (один раз, ~10 минут)
```bash
git clone <репозиторий> ~/games/birthday-coop && cd ~/games/birthday-coop
npm ci
sudo ALLOWED_ORIGINS=https://<user>.github.io ./ops/setup.sh
```
Скрипт: ставит Caddy из официального apt-репозитория, пишет `/etc/caddy/Caddyfile` (прежний, если был чужой, сохраняет как `.bak-before-birthday-coop`), создаёт `/etc/birthday-coop.env` и `birthday-coop.service` (`Restart=always`, абсолютные пути к node и tsx), открывает 80/443 в ufw, если он активен. В конце печатает команды проверки. Повторный запуск безопасен; его нужно повторить, если сменился путь к node (обновили версию через nvm) или origin клиента.

`ALLOWED_ORIGINS`: список origin через запятую, которым разрешён матчмейкинг (SPEC N-11). Только схема и хост, без пути: `https://<user>.github.io`.

## 2. Проверка сервера
```bash
curl -i https://<ip-через-дефисы>.sslip.io/health      # 200 {"ok":true,...}
SERVER_URL=https://<ip-через-дефисы>.sslip.io npm run test:net
systemctl status birthday-coop caddy --no-pager
```
Если https не отвечает: `journalctl -u caddy -n 50 --no-pager` (ошибки ACME: чаще всего закрыт порт 80 снаружи).

## 3. Клиент
1. Создать репозиторий на GitHub и запушить код (видимость репозитория: см. открытый вопрос в HANDOFF.md).
2. Settings > Pages > Source: **GitHub Actions**.
3. Settings > Secrets and variables > Actions > Variables: `SERVER_URL` = `https://<ip-через-дефисы>.sslip.io`.
4. Push в `main`/`master` запускает `.github/workflows/pages.yml` (tsc, `vite build`, публикация `client/dist`). Адрес: `https://<user>.github.io/<repo>/`. Ссылка-приглашение: `.../<repo>/#<КОД>`.

Vite собран с `base: './'`, поэтому имя репозитория в конфиге не нужно.

## Эксплуатация
| Что | Команда |
|---|---|
| Логи сервера | `journalctl -u birthday-coop -f` |
| Перезапуск | `sudo systemctl restart birthday-coop` |
| Обновить код | `git pull && npm ci && sudo systemctl restart birthday-coop` |
| Срок сертификата | `echo | openssl s_client -connect <host>:443 -servername <host> 2>/dev/null | openssl x509 -noout -enddate` |
| Dev-режим (tailnet) | `ops/dev.sh` (не мешает проду: другой адрес) |

Проверка перед вручением (H-6): `/health`, тестовая комната с двух телефонов, срок сертификата.
