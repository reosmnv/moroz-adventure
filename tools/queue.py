"""Очередь PixelLab. Не повторяет платный запрос после неоднозначного сбоя.
python3 tools/queue.py specs.json -> id и статус в specs.json.done"""
import json, re, sys, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from pl import expand
from sprites import mcp

specs = json.loads(Path(sys.argv[1]).read_text())
done_path = Path(sys.argv[1] + ".done")
done = json.loads(done_path.read_text()) if done_path.exists() else {}
def save():
    done_path.write_text(json.dumps(done, indent=1, ensure_ascii=False))

def identify(out):
    try:
        data = json.loads(out.split("\nid:")[0])
        if isinstance(data, dict):
            return data.get("background_job_id") or data.get("job_id") or data.get("character_id") or data.get("id")
    except (ValueError, TypeError):
        pass
    ids = re.findall(r"(?:background_job_id|job_id|character_id|animation_group_id|id)[\"']?\s*[:=]\s*[\"']?([\w-]{12,})", out)
    return ids[0] if ids else None

def ambiguous(name, reason):
    # Ищем только точное имя в структурированном списке; отсутствие записи не доказывает отсутствие задачи.
    try:
        jobs = mcp("list_jobs", {})
    except Exception as error:
        jobs = f"list_jobs failed: {error}"
    try:
        records = json.loads(jobs)
        matches = []
        def visit(value):
            if isinstance(value, dict):
                if value.get("name") == name:
                    job_id = value.get("background_job_id") or value.get("job_id") or value.get("id")
                    if job_id: matches.append(job_id)
                for child in value.values(): visit(child)
            elif isinstance(value, list):
                for child in value: visit(child)
        visit(records)
        if len(set(matches)) == 1:
            job_id = matches[0]
            done[name] = {"status": "recovered", "job_id": job_id, "reason": str(reason)[:300]}
            save()
            print(name, "recovered", job_id, flush=True)
            return job_id
    except (ValueError, TypeError):
        pass
    done[name] = {"status": "ambiguous", "reason": str(reason)[:300], "jobs": jobs[:3000]}
    save()
    print(name, "AMBIGUOUS; inspect list_jobs and .done before any retry", flush=True)
    sys.exit(2)

for s in specs:
    if s["name"] in done:
        continue
    while True:
        try:
            out = mcp(s["tool"], expand(s["args"]))
        except Exception as e:
            ambiguous(s["name"], e)
            break
        if re.search(r"slot|rate limit|concurrent", out):
            print(s["name"], "wait:", out.splitlines()[0][:150], flush=True)
            time.sleep(25)
            continue
        if out.startswith("error"):
            print(s["name"], "ERROR", out[:300], flush=True)
            done[s["name"]] = {"error": out[:300]}
            break
        job_id = identify(out)
        if not job_id:
            ambiguous(s["name"], "submission returned no identifiable job id: " + out[:300])
            break
        done[s["name"]] = {"status": "queued", "job_id": job_id, "out": out[:600]}
        save()  # ID фиксируется сразу, до следующего запроса и даже до печати лога.
        print(s["name"], "queued", job_id, flush=True)
        break
while (m := re.match(r"(\d+) jobs", mcp("list_jobs", {}))) and int(m.group(1)) > 0:
    time.sleep(30)
print("ALL DONE", flush=True)
