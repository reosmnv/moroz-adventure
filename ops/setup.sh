#!/bin/bash
# Одноразовая установка прод-сервера: Caddy (https/wss) + systemd unit для Colyseus.
# Запуск (из любой папки):  sudo ALLOWED_ORIGINS=https://<user>.github.io ./ops/setup.sh
# Идемпотентен: повторный запуск безопасен. Необязательные переменные:
#   PUBLIC_IP   публичный IPv4 (по умолчанию определяется)
#   NODE_BIN    абсолютный путь к node (по умолчанию самый новый из ~/.nvm пользователя)
#   APP_USER    пользователь сервиса (по умолчанию тот, кто вызвал sudo)
set -euo pipefail

[ "$(id -u)" = 0 ] || { echo "Запускай через sudo: sudo ALLOWED_ORIGINS=https://<user>.github.io $0"; exit 1; }
: "${ALLOWED_ORIGINS:?Задай ALLOWED_ORIGINS, например https://<user>.github.io (origin клиента на Pages, без пути и слэша в конце)}"

APP_USER="${APP_USER:-${SUDO_USER:-}}"
[ -n "$APP_USER" ] && [ "$APP_USER" != root ] || { echo "Не определён APP_USER (не root). Задай APP_USER=..."; exit 1; }
APP_HOME="$(getent passwd "$APP_USER" | cut -d: -f6)"
ROOT="$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)"
PORT=2567
MARK="# managed by birthday-coop/ops/setup.sh"

# --- node и tsx: абсолютные пути (nvm не виден systemd) ---
if [ -z "${NODE_BIN:-}" ]; then
  NODE_BIN="$(ls -d "$APP_HOME"/.nvm/versions/node/v*/bin/node 2>/dev/null | sort -V | tail -1 || true)"
fi
[ -x "${NODE_BIN:-}" ] || { echo "node не найден. Задай NODE_BIN=/абсолютный/путь/к/node"; exit 1; }
TSX_CLI="$ROOT/node_modules/tsx/dist/cli.mjs"
[ -f "$TSX_CLI" ] || { echo "Нет $TSX_CLI. Сначала: cd $ROOT && npm ci"; exit 1; }
NODE_MAJOR="$("$NODE_BIN" -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 22 ] || { echo "Нужен Node 22+, найден $("$NODE_BIN" -v)"; exit 1; }

# --- публичный IP и имя ---
PUBLIC_IP="${PUBLIC_IP:-$(ip -4 route get 1.1.1.1 | sed -n 's/.* src \([0-9.]*\).*/\1/p' | head -1)}"
[[ "$PUBLIC_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "Не определён PUBLIC_IP: $PUBLIC_IP"; exit 1; }
HOSTNAME_SSLIP="${PUBLIC_IP//./-}.sslip.io"
echo "IP $PUBLIC_IP, имя $HOSTNAME_SSLIP, node $NODE_BIN ($("$NODE_BIN" -v)), пользователь $APP_USER"

# --- 80/443 на публичном IP должны быть свободны или принадлежать caddy ---
# Caddy биндим строго на публичный IP: tailscale serve держит 443/8443 на 100.x, wildcard-bind с ним конфликтует.
for p in 80 443; do
  busy="$(ss -ltnpH "sport = :$p" | grep -E "(^|[[:space:]])(0\.0\.0\.0|\*|\[::\]|$PUBLIC_IP):$p" | grep -v '"caddy"' || true)"
  [ -z "$busy" ] || { echo "Порт $p на публичном интерфейсе занят не caddy:"; echo "$busy"; exit 1; }
done

# --- Caddy (официальный apt-репозиторий) ---
if ! command -v caddy >/dev/null; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl gpg
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt -o /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y -qq caddy
else
  echo "caddy уже установлен: $(caddy version)"
fi

# --- Caddyfile (чужой не затираем: бэкап) ---
CADDYFILE=/etc/caddy/Caddyfile
if [ -f "$CADDYFILE" ] && ! grep -qF "$MARK" "$CADDYFILE"; then
  cp -n "$CADDYFILE" "$CADDYFILE.bak-before-birthday-coop"
  echo "Прежний Caddyfile сохранён: $CADDYFILE.bak-before-birthday-coop"
fi
cat > "$CADDYFILE" <<CADDY
$MARK
$HOSTNAME_SSLIP {
	bind $PUBLIC_IP
	reverse_proxy 127.0.0.1:$PORT
}
CADDY
caddy validate --config "$CADDYFILE" --adapter caddyfile

# --- systemd unit сервера ---
cat > /etc/birthday-coop.env <<ENV
$MARK
HOST=127.0.0.1
PORT=$PORT
NODE_ENV=production
ALLOWED_ORIGINS=$ALLOWED_ORIGINS
ENV
chmod 644 /etc/birthday-coop.env
cat > /etc/systemd/system/birthday-coop.service <<UNIT
$MARK
[Unit]
Description=birthday-coop Colyseus server
After=network-online.target
Wants=network-online.target

[Service]
User=$APP_USER
WorkingDirectory=$ROOT/server
EnvironmentFile=/etc/birthday-coop.env
ExecStart=$NODE_BIN $TSX_CLI src/index.ts
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable birthday-coop.service >/dev/null
systemctl restart birthday-coop.service

# --- файрвол ---
if command -v ufw >/dev/null && ufw status | grep -q '^Status: active'; then
  ufw allow 80/tcp comment 'caddy http-01'
  ufw allow 443/tcp comment 'caddy https'
else
  echo "ufw не активен: правила не добавлял. Если у провайдера VPS есть свой файрвол (панель), открой 80 и 443 там."
fi
if command -v iptables >/dev/null && iptables -S INPUT 2>/dev/null | grep -q '^-P INPUT DROP'; then
  echo "ВНИМАНИЕ: iptables INPUT по умолчанию DROP, проверь, что 80/443 разрешены."
fi

systemctl enable caddy >/dev/null
systemctl restart caddy

cat <<DONE

Готово. Проверка:
  systemctl status birthday-coop caddy --no-pager
  ss -ltnp | grep -E ':(80|443|2567)\b'       # caddy на $PUBLIC_IP:80/443, node на 127.0.0.1:2567
  tailscale serve status                      # 443 и 8443 на tailnet не тронуты
  curl -i http://127.0.0.1:$PORT/health        # сервер отвечает локально
  curl -i https://$HOSTNAME_SSLIP/health       # сертификат получается 5-60 секунд после старта
  journalctl -u caddy -n 30 --no-pager         # если https не заработал: ищи ошибки ACME
  cd $ROOT && SERVER_URL=https://$HOSTNAME_SSLIP npm run test:net
Для клиента: переменная репозитория SERVER_URL = https://$HOSTNAME_SSLIP
DONE
