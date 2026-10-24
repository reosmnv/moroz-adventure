"""Ждёт позы апперкота (batch8), ставит выпад/возврат (batch9)."""
import json, subprocess, sys, time
sys.path.insert(0, "tools")
from sprites import mcp, get, RAW

P = "8f079407-9eb2-48f9-9b07-695c53169e9f"
K = RAW / "keyposes"
while True:
    try:
        done = json.loads(open("tools/specs/batch8.json.done").read())
    except FileNotFoundError:
        done = {}
    if len(done) == 2:
        break
    time.sleep(30)
specs = []
for k, v in done.items():
    d = k.rsplit("-", 1)[1]
    job = v["out"].split("job_id: ")[1].split()[0]
    while not mcp("get_image", {"job_id": job}).startswith("status: completed"):
        time.sleep(15)
    (K / f"prime-uppercut-{d}.png").write_bytes(get(f"https://api.pixellab.ai/mcp/images/{job}/download"))
    url = f"https://api.pixellab.ai/mcp/images/{job}/download"
    st = f"@{K}/prime-idle0-{d}-64.png"
    specs += [
        {"name": f"uppercut-in-{d}", "tool": "animate_character", "args": {"character_id": P, "mode": "v3", "action_description": "explosive jumping uppercut: from fighting stance she dips low, then springs straight up driving the rear fist upward above her head", "frame_count": 6, "directions": [d], "custom_start_frame_base64": st, "end_frame_url": url, "animation_name": "uppercut-in"}},
        {"name": f"uppercut-out-{d}", "tool": "animate_character", "args": {"character_id": P, "mode": "v3", "action_description": "after a jumping uppercut she falls back down, lands and settles into fighting stance", "frame_count": 4, "directions": [d], "custom_start_frame_url": url, "end_frame_base64": st, "animation_name": "uppercut-out"}},
    ]
    print("key", k, flush=True)
json.dump(specs, open("tools/specs/batch9.json", "w"), indent=1)
subprocess.run([sys.executable, "-u", "tools/queue.py", "tools/specs/batch9.json"])
