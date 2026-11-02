"""Галерея Рамиля для mr.R: assets/gen/hero4/index.html. Новое сверху. python3 tools/ramil_gallery.py"""
from pathlib import Path
OUT = Path(__file__).resolve().parent.parent / 'assets/gen/hero4/index.html'
ITEMS = [  # (заголовок, [(файл от hero4/, подпись)])
    ('Сейчас на согласовании: лицо 3/4 по фото', [
        ('ramil-face2-lineup.gif', 'Рядом с героинями, с дымом'),
        ('ramil-face2-zoom.png', 'Крупно')]),
    ('Лицо: прошлые попытки', [
        ('ramil-face-lineup.png', 'Ручное лицо в профиль (отклонено)'),
        ('concept/faces-compare.png', 'Исходник, 3 попытки PixelLab, ручное'),
        ('concept/head-gpt-v1.png', 'Эскиз головы от GPT по фото лица')]),
    ('Стиль под героинь (выбран 4)', [('ramil-styles-lineup.png', '4 перерисовки PixelLab рядом с героинями')]),
    ('Дым', [('ramil-heavy.gif', 'Плотный дым: перед телепортом и при «Перекуре»')]),
    ('Концепты GPT', [
        ('concept/hero4-concept-v3.png', 'Курит (выбраны 1 и 3)'),
        ('concept/hero4-concept-v2.png', 'Расслабленные позы'),
        ('concept/hero4-concept-v1.png', 'Первый лист с курткой')]),
]
css = ("body{background:#26272d;color:#e8e8ec;font:16px system-ui;margin:0;padding:16px}h1{font-size:20px}"
       "h2{font-size:17px;margin:28px 0 8px;color:#ffd27a}figure{margin:0 0 18px}"
       "img{max-width:100%;image-rendering:pixelated;background:#3a3c46;border-radius:6px}figcaption{color:#aab;font-size:14px;margin-top:4px}")
html = [f"<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><title>Рамиль</title><style>{css}</style><h1>Рамиль: ход работы</h1>"]
for title, imgs in ITEMS:
    html.append(f"<h2>{title}</h2>")
    for f, cap in imgs:
        html.append(f"<figure><img src='{f}' loading=lazy><figcaption>{cap}</figcaption></figure>")
OUT.write_text('\n'.join(html), encoding='utf-8')
print(OUT)
