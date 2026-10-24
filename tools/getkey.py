"""Ждёт задачу edit_image и скачивает результат: python3 tools/getkey.py <job_id> <name>  -> assets/pixellab/keyposes/<name>.png"""
import sys, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from sprites import mcp, get, RAW

job, name = sys.argv[1], sys.argv[2]
while not mcp("get_image", {"job_id": job}).startswith("status: completed"):
    time.sleep(15)
(RAW / "keyposes" / f"{name}.png").write_bytes(get(f"https://api.pixellab.ai/mcp/images/{job}/download"))
print(name, "ok")
