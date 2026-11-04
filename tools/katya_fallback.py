"""Локальный запасной спрайт Кати из копии старых кадров. Исходники не меняет."""
from pathlib import Path
from PIL import Image, ImageDraw
import sys

SOURCE = Path('client/public/sprites/enemies/pizdulina')
TARGET = Path('client/public/sprites/enemies/katya')
FRAME = 128

def frame(source: Image.Image) -> Image.Image:
    source = source.convert('RGBA')
    bounds = source.getbbox()
    if not bounds:
        return source
    x0, y0, x1, y1 = bounds
    cut = source.crop(bounds)
    cut = cut.resize((int(cut.width * 1.35), cut.height), Image.Resampling.NEAREST)
    image = Image.new('RGBA', (FRAME, FRAME))
    left = (x0 + x1 - cut.width) // 2
    image.alpha_composite(cut, (left, y0))
    pixels = image.load()
    for y in range(FRAME):
        for x in range(FRAME):
            r, g, b, a = pixels[x, y]
            if a == 0: continue
            if r < 125 and b > r * .72 and y > y0 + 12:
                pixels[x, y] = (int(r * .65), min(255, int(g * 1.2)), int(b * .72), a)
            elif r > 90 and r > g * 1.4 and y > y0 + 25:
                pixels[x, y] = (86, 34, 48, a)
    draw = ImageDraw.Draw(image)
    center = (x0 + x1) // 2
    # Широкие плечи и ремни читаются даже на игровом масштабе 1.5.
    draw.polygon([(center - 20, y0 + 27), (center - 10, y0 + 19), (center - 5, y0 + 25), (center - 15, y0 + 34)], fill='#303c39')
    draw.polygon([(center + 20, y0 + 27), (center + 10, y0 + 19), (center + 5, y0 + 25), (center + 15, y0 + 34)], fill='#303c39')
    draw.line([(center - 15, y0 + 23), (center - 3, y0 + 46)], fill='#708279', width=3)
    draw.line([(center + 15, y0 + 23), (center + 3, y0 + 46)], fill='#708279', width=3)
    # Маска Бэйна на нижней части лица. Три металлические вертикали.
    face = []
    for y in range(y0 + 8, min(y0 + 29, FRAME)):
        for x in range(max(0, center - 12), min(FRAME, center + 17)):
            r, g, b, a = pixels[x, y]
            if a > 0 and r > 115 and g > 60 and r > b * 1.05: face.append((x, y))
    if face:
        fx0, fx1 = min(x for x, _ in face), max(x for x, _ in face)
        fy0, fy1 = min(y for _, y in face), max(y for _, y in face)
        mask_y = min(fy1, max(fy0 + 2, fy1 - 5))
        draw.rectangle((fx0, mask_y, fx1, fy1 + 1), fill='#252d30')
        for x in range(fx0 + 1, fx1, 3): draw.line((x, mask_y, x, fy1 + 1), fill='#8a9c92', width=1)
    return image

TARGET.mkdir(parents=True, exist_ok=True)
clips = ['idle', 'strike'] if '--all' not in sys.argv else [p.stem.removesuffix('-east') for p in SOURCE.glob('*-east.png')]
for clip in clips:
    source = Image.open(SOURCE / f'{clip}-east.png').convert('RGBA')
    result = Image.new('RGBA', source.size)
    for x in range(source.width // FRAME):
        result.alpha_composite(frame(source.crop((x * FRAME, 0, (x + 1) * FRAME, FRAME))), (x * FRAME, 0))
    result.save(TARGET / f'{clip}-east.png')
print('created', len(clips), 'Katya clips in', TARGET)
