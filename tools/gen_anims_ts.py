#!/usr/bin/env python3
"""assets/sprites/anims.json -> shared/src/anims-data.ts (тайминги для sim) и client/public/sprites (полосы кадров).
Запуск из корня проекта после пересборки спрайтов: python3 tools/gen_anims_ts.py"""
import json, shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets/sprites"
data = json.loads((SRC / "anims.json").read_text())

out = ["// Сгенерировано tools/gen_anims_ts.py из assets/sprites/anims.json, руками не править.", "",
       "export type Form = 'prime' | 'ultimate';",
       "export interface AnimDef { east: number; west: number; fps: number; loop: boolean; hit?: { east: number; west: number }; hits?: number[] }",
       "", "export const HERO_ANIMS: Record<Form, Record<string, AnimDef>> = {"]
dest = ROOT / "client/public/sprites"
for form, anims in data["states"].items():
    out.append(f"  {form}: {{")
    for name, a in sorted(anims.items()):
        if name == "static":
            continue
        parts = [f"east: {a['east']}", f"west: {a['west']}", f"fps: {a['fps']}", f"loop: {str(a['loop']).lower()}"]
        if "hit" in a:
            parts.append(f"hit: {{ east: {a['hit']['east']}, west: {a['hit']['west']} }}")
        if "hits" in a:
            parts.append(f"hits: {json.dumps(a['hits'])}")
        out.append(f"    '{name}': {{ {', '.join(parts)} }},")
        (dest / form).mkdir(parents=True, exist_ok=True)
        for d in ("east", "west"):
            shutil.copyfile(SRC / form / f"{name}-{d}.png", dest / form / f"{name}-{d}.png")
    out.append("  },")
out.append("};")
(ROOT / "shared/src/anims-data.ts").write_text("\n".join(out) + "\n")
print("ok", sum(len(v) for v in data["states"].values()))
