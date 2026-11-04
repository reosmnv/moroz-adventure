#!/usr/bin/env bash
# Помощник Claude на Haiku (дёшево по лимиту Claude). Зовёт Codex.
# ops/haiku.sh <агент> <файл-отчёта> "<задание>"
# Агенты: playtester, anim-producer (~/games/.claude/agents). Код 3 = Claude недоступен (лимит/сеть): тот же скилл на gpt-6.1-terra.
set -u
AGENT="$1"; OUT="$(realpath -m "$2")"; TASK="$3"
RAW=$(mktemp)
( cd /home/agent/games && timeout 1800 claude -p --model haiku --agent "$AGENT" --dangerously-skip-permissions \
    --add-dir /home/agent/games/birthday-coop --output-format json "$TASK" ) >"$RAW" 2>"$RAW.err"
python3 - "$RAW" "$OUT" <<'PY'
import json, sys
raw = open(sys.argv[1]).read()
try:
    d = json.loads(raw)
except Exception:
    err = open(sys.argv[1] + ".err").read()
    print("Claude недоступен:", (err or raw)[-500:]); sys.exit(3)
if d.get("is_error"):
    print("Claude вернул ошибку:", d.get("result")); sys.exit(3)
open(sys.argv[2], "w").write(d.get("result") or "")
print("OK, отчёт:", sys.argv[2], "| модели:", ",".join((d.get("modelUsage") or {}).keys()), "| $", round(d.get("total_cost_usd") or 0, 4))
PY
rc=$?; rm -f "$RAW" "$RAW.err"; exit $rc
