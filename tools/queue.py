"""Очередь задач PixelLab: ставит задачи из JSON-файла по мере освобождения слотов (лимит 8).
python3 tools/queue.py specs.json   -> лог в stdout, результат (id задач) в specs.json.done"""
import json, re, sys, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from pl import expand
from sprites import mcp

specs = json.loads(Path(sys.argv[1]).read_text())
done_path = Path(sys.argv[1] + ".done")
done = json.loads(done_path.read_text()) if done_path.exists() else {}
for s in specs:
    if s["name"] in done:
        continue
    while True:
        try:
            out = mcp(s["tool"], expand(s["args"]))
        except Exception as e:  # сеть: подождать и повторить
            print(s["name"], "network", e, flush=True)
            time.sleep(20)
            continue
        if re.search(r"slot|rate limit", out):
            print(s["name"], "wait:", out.splitlines()[0][:150], flush=True)
            time.sleep(25)
            continue
        if out.startswith("error"):
            print(s["name"], "ERROR", out[:300], flush=True)
            done[s["name"]] = {"error": out[:300]}
            break
        ids = re.findall(r"(?:job_ids?|group|id): (\S+)", out)
        done[s["name"]] = {"out": out[:600]}
        print(s["name"], "queued", " ".join(ids[:3]), flush=True)
        break
    done_path.write_text(json.dumps(done, indent=1, ensure_ascii=False))
while (m := re.match(r"(\d+) jobs", mcp("list_jobs", {}))) and int(m.group(1)) > 0:
    time.sleep(30)
print("ALL DONE", flush=True)
