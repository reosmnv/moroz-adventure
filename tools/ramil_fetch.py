"""Скачать готовые анимации Рамиля (pixminimax) из .done-файла спеки в полосы assets/pixellab/ramil/<имя>.png
и листы для просмотра assets/gen/hero4/anim/<имя>-sheet.png. python3 tools/ramil_fetch.py tools/specs/ramil-anim1.json"""
import io, json, re, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from sprites import mcp, get
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
RAW, PV = ROOT / 'assets/pixellab/ramil', ROOT / 'assets/gen/hero4/anim'
RAW.mkdir(parents=True, exist_ok=True); PV.mkdir(parents=True, exist_ok=True)
done = json.loads(Path(sys.argv[1] + '.done').read_text())
for name, v in done.items():
    if (RAW / f'{name}.png').exists():
        continue
    m = re.search(r'job_id\W+([0-9a-f-]{36})', v.get('out', ''))
    if not m:
        print(name, 'нет job'); continue
    out = mcp('get_image', {'job_id': m.group(1)})
    if 'status: completed' not in out:
        print(name, out.splitlines()[0]); continue
    n = int(re.search(r'frames: (\d+)', out).group(1))
    base = f'https://api.pixellab.ai/mcp/images/{m.group(1)}/download'
    fr = [Image.open(io.BytesIO(get(f'{base}?index={i}'))).convert('RGBA') for i in range(n)]
    c = fr[0].width
    strip = Image.new('RGBA', (c * n, c))
    for i, f in enumerate(fr):
        strip.paste(f, (i * c, 0))
    strip.save(RAW / f'{name}.png')
    sh = Image.new('RGBA', (n * 70, 104), (58, 60, 70, 255)); d = ImageDraw.Draw(sh)
    for i, f in enumerate(fr):
        sh.alpha_composite(f.crop((25, 16, 95, 116)) if c == 128 else f, (i * 70, 0)); d.text((i * 70 + 2, 92), str(i), fill='white')
    sh.resize((sh.width * 2, sh.height * 2), Image.NEAREST).save(PV / f'{name}-sheet.png')
    print(name, n, 'ok')
