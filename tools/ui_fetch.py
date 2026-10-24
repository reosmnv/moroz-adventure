"""Забирает результаты UI-генераций из tools/specs/ui.json.done в assets/ui/raw/<name>/.
python3 tools/ui_fetch.py  -> повторять, пока не напишет ALL FETCHED"""
import json, re, sys, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from sprites import mcp, get

ROOT = Path(__file__).parent.parent
done = json.loads((ROOT / "tools/specs/ui.json.done").read_text())
GETTER = {"create_portrait_character": "get_portrait_character", "create_ui_asset": "get_ui_asset"}
specs = {s["name"]: s for s in json.loads((ROOT / "tools/specs/ui.json").read_text())}
pending = 0
for name, d in done.items():
    out = ROOT / "assets/ui/raw" / name
    if (out / "result.txt").exists() or "out" not in d:
        continue
    tool = specs[name]["tool"]
    jid = re.search(r"(?:ui_asset_id|job_id|id): (\S+)", d["out"]).group(1)
    arg = {"ui_asset_id": jid, "include_preview": False} if tool == "create_ui_asset" else {"job_id": jid}
    text = mcp(GETTER.get(tool, "get_image"), arg)
    if re.search(r"processing|pending|queued", text.split("\n")[0], re.I):
        pending += 1
        print(name, text.split("\n")[0])
        continue
    out.mkdir(parents=True, exist_ok=True)
    urls = re.findall(r"https://\S+?\.png|https://api\.pixellab\.ai/\S+download\S*", text)
    for i, u in enumerate(dict.fromkeys(urls)):
        (out / f"{i}.png").write_bytes(get(u.rstrip(").,")))
    (out / "result.txt").write_text(text)
    print(name, "fetched", len(urls))
print("ALL FETCHED" if pending == 0 and len(done) == len(specs) else f"pending {pending}, queued {len(done)}/{len(specs)}")
