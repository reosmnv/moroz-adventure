"""Вызов инструмента PixelLab MCP из терминала.
python3 tools/pl.py <tool> '<json args>'
Строковое значение "@путь.png" заменяется base64 этого файла (для *_base64 параметров)."""
import base64, json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from sprites import mcp


def expand(v):
    if isinstance(v, str) and v.startswith("@"):
        return base64.b64encode(Path(v[1:]).read_bytes()).decode()
    if isinstance(v, dict):
        return {k: expand(x) for k, x in v.items()}
    if isinstance(v, list):
        return [expand(x) for x in v]
    return v


if __name__ == "__main__":
    print(mcp(sys.argv[1], expand(json.loads(sys.argv[2]))))
