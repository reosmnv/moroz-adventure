#!/usr/bin/env python3
"""Поиск по Freesound через публичную страницу поиска (без API-ключа) и скачивание hq-превью.

  fs_search.py search "<запрос>" [--min 0.1] [--max 5] [--n 15]
  fs_search.py get <id> <out.mp3>
Вывод search: id, длительность, скачивания, название. Кэш страниц в /tmp не ведётся.
"""
import html, re, sys, urllib.parse, urllib.request

UA = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) birthday-coop-sound'}


def fetch(url: str) -> bytes:
    import time, urllib.error
    for i in range(6):
        try:
            time.sleep(2.5)
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40).read()
        except urllib.error.HTTPError as e:
            if e.code != 429: raise
            time.sleep(15 * (i + 1))
    raise SystemExit('429: Freesound не отвечает')


def search(q: str, dmin: float, dmax: float, n: int, page: int = 1):
    f = f'duration:[{dmin} TO {dmax}]'
    url = 'https://freesound.org/search/?' + urllib.parse.urlencode({'q': q, 'f': f, 's': 'Downloads (most first)', 'page': page})
    h = fetch(url).decode('utf-8', 'replace')
    out = []
    for m in re.finditer(r'class="bw-player"(.*?)tabindex', h, re.S):
        b = m.group(1)
        g = lambda k: (re.search(k + r'="([^"]*)"', b) or [None, ''])[1]
        out.append({'id': g('data-sound-id'), 'user': g('data-username'), 'mp3': g('data-mp3').replace('-lq.', '-hq.'),
                    'title': html.unescape(g('data-title')), 'dur': float(g('data-duration') or 0), 'dl': int(g('data-num-downloads') or 0)})
    return out[:n]


def get(sid: str, out: str):
    # Страница звука даёт путь к превью; hq = 128 кбит/с mp3
    h = fetch(f'https://freesound.org/s/{sid}/').decode('utf-8', 'replace')
    m = re.search(r'https://cdn\.freesound\.org/previews/\d+/\d+_\d+-lq\.mp3', h)
    if not m:
        raise SystemExit(f'нет превью для {sid}')
    open(out, 'wb').write(fetch(m.group(0).replace('-lq.', '-hq.')))


if __name__ == '__main__':
    a = sys.argv[1:]
    if a[0] == 'search':
        q = a[1]; opt = dict(zip(a[2::2], a[3::2]))
        for r in search(q, float(opt.get('--min', 0)), float(opt.get('--max', 600)), int(opt.get('--n', 15)), int(opt.get('--page', 1))):
            print(f"{r['id']:>7} {r['dur']:7.2f}s {r['dl']:>6} {r['title'][:70]}")
    elif a[0] == 'get':
        get(a[1], a[2])
