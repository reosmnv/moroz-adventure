"""Ждёт ключевые позы из batch5, скачивает их и ставит выпады/возвраты (batch6)."""
import json, re, subprocess, sys, time
sys.path.insert(0, "tools")
from sprites import mcp, get, RAW

P = "8f079407-9eb2-48f9-9b07-695c53169e9f"; Ul = "fda7726a-5a4b-45df-b0e9-5e5adadc9540"
MOVES = {
    "superman": (P, "prime", "muay thai superman punch: from fighting stance she skips forward, leaps into the air and drives the rear fist straight forward at head height",
                 "after a superman punch she lands from the air, absorbs the landing and settles back into fighting stance"),
    "spin-elbow": (Ul, "ultimate", "muay thai spinning back elbow: from fighting stance she pivots and spins around fast, whipping the rear elbow horizontally at head height",
                   "after a spinning back elbow she completes the spin and returns to fighting stance facing forward"),
    "flying-knee": (Ul, "ultimate", "muay thai flying knee: from fighting stance she takes a step, jumps high and drives one knee forward and up to head height, hands grabbing forward",
                    "after a flying knee she lands from the jump and settles back into fighting stance"),
}
K = RAW / "keyposes"
while True:
    done = json.loads(open("tools/specs/batch5.json.done").read())
    keys = {k: v["out"].split("job_id: ")[1].split()[0] for k, v in done.items() if "-key-" in k and "out" in v}
    if len(keys) == 6:
        break
    time.sleep(30)
specs = []
for k, job in keys.items():
    move, d = k.split("-key-")
    cid, state, din, dout = MOVES[move]
    while not mcp("get_image", {"job_id": job}).startswith("status: completed"):
        time.sleep(15)
    (K / f"{state}-{move}-{d}.png").write_bytes(get(f"https://api.pixellab.ai/mcp/images/{job}/download"))
    url = f"https://api.pixellab.ai/mcp/images/{job}/download"
    st = f"@{K}/{state}-idle0-{d}-64.png"
    specs += [
        {"name": f"{move}-in-{d}", "tool": "animate_character", "args": {"character_id": cid, "mode": "v3", "action_description": din, "frame_count": 6, "directions": [d], "custom_start_frame_base64": st, "end_frame_url": url, "animation_name": f"{move}-in"}},
        {"name": f"{move}-out-{d}", "tool": "animate_character", "args": {"character_id": cid, "mode": "v3", "action_description": dout, "frame_count": 4, "directions": [d], "custom_start_frame_url": url, "end_frame_base64": st, "animation_name": f"{move}-out"}},
    ]
    print("key", k, flush=True)
json.dump(specs, open("tools/specs/batch6.json", "w"), indent=1)
subprocess.run([sys.executable, "-u", "tools/queue.py", "tools/specs/batch6.json"])
