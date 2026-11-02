"""Скачать ключевые позы (edit_image_pro_flash) из .done спеки в папку и лист сравнения.
python3 tools/ramil_keys_fetch.py tools/specs/<spec>.json <папка> -> <папка>/<имя>.png, <папка>/keys-sheet.png (x3, кроп по силуэтам)"""
import io, json, re, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from sprites import mcp, get
from PIL import Image, ImageDraw

spec, out = sys.argv[1], Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
done = json.loads(Path(spec + '.done').read_text()); ims = []
for name, v in done.items():
    p = out / f'{name}.png'
    if not p.exists():
        j = re.search(r'"job_id": "([0-9a-f-]{36})"', v.get('out', ''))
        if not j: print(name, 'нет job'); continue
        r = mcp('get_image', {'job_id': j.group(1)})
        if 'completed' not in r: print(name, r[:120]); continue
        Image.open(io.BytesIO(get(f'https://api.pixellab.ai/mcp/images/{j.group(1)}/download'))).convert('RGBA').save(p)
    ims.append((name, Image.open(p).convert('RGBA')))
sh = Image.new('RGBA', (100 * len(ims), 92), (200, 200, 205, 255)); d = ImageDraw.Draw(sh)
for i, (n, im) in enumerate(ims):
    sh.alpha_composite(im.crop((14, 34, 114, 116)), (i * 100, 0)); d.text((i * 100 + 2, 82), n, fill='black')
sh.resize((sh.width * 3, sh.height * 3), Image.NEAREST).save(out / 'keys-sheet.png'); print('ok', len(ims))
