#!/bin/bash
# Перезапуск сервера и клиента в режиме разработки (tailnet). LATENCY=200 ops/dev.sh — с задержкой
for pid in $(ps -eo pid,args | awk '/node .*tsx.*src\/index.ts|node .*vite --host/ && !/awk/ {print $1}'); do kill $pid; done
sleep 1
cd /home/agent/games/birthday-coop/server && LATENCY=${LATENCY:-0} nohup npx tsx src/index.ts > /tmp/bc-server.log 2>&1 &
cd /home/agent/games/birthday-coop/client && nohup npx vite --host 100.118.72.60 --port 5173 > /tmp/bc-client.log 2>&1 &
