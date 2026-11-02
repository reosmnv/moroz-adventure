"""Уменьшение пиксель-арта «по моде» блока с приоритетом тёмного контура. python3 tools/mode_down.py in.png out.png H"""
import sys
import numpy as np
from collections import Counter
from PIL import Image


def mode_down(src, H, dark_share=0.34, dark_lum=120):
    a = np.asarray(src.convert('RGBA'))
    f = src.height / H; W = round(src.width / f)
    out = np.zeros((H, W, 4), np.uint8)
    for y in range(H):
        for x in range(W):
            y0, y1 = int(y * f), max(int(y * f) + 1, int((y + 1) * f))
            x0, x1 = int(x * f), max(int(x * f) + 1, int((x + 1) * f))
            blk = a[y0:y1, x0:x1].reshape(-1, 4); op = blk[blk[:, 3] > 128]
            if len(op) < blk.shape[0] * 0.4:
                continue
            q = (op[:, :3] // 8) * 8  # склейка близких оттенков
            lum = op[:, :3].astype(int).sum(1); dark = q[lum < dark_lum]
            pool = dark if len(dark) >= len(op) * dark_share else q
            out[y, x] = (*Counter(map(tuple, pool)).most_common(1)[0][0], 255)
    return Image.fromarray(out, 'RGBA')


if __name__ == '__main__':
    mode_down(Image.open(sys.argv[1]), int(sys.argv[2] if len(sys.argv) > 3 else 20)).save(sys.argv[2] if len(sys.argv) <= 3 else sys.argv[2])
