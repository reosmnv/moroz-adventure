"""Текстура тоннеля для окон вагона (ТЗ-04): рисуется кодом, без генераций.
python3 tools/route_fx.py -> client/public/route/tunnel.png (128x64 src, в игре tileScale 1.5, бежит влево)."""
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).parent.parent
W, H = 128, 64
rng = np.random.default_rng(7)
a = np.zeros((H, W, 3), np.float32)
for y in range(H):  # тёмная стена тоннеля, к низу светлее от огней вагона
    a[y] = (14 + 10 * y / H, 15 + 10 * y / H, 19 + 9 * y / H)
a += rng.normal(0, 1.6, a.shape)  # бетон
for x in range(0, W, 32):  # стыки тюбингов
    a[:, x] = a[:, x] * 0.55
    a[:, x + 1] = a[:, x + 1] * 1.25
for y, c in [(18, (34, 34, 38)), (21, (44, 40, 32)), (24, (30, 30, 34)), (27, (40, 36, 30))]:  # кабели
    a[y] = c
    a[y + 1] = np.array(c) * 0.6
a[46:48] = (36, 36, 40)  # консоль кабелей снизу
for x in range(8, W, 32):
    a[44:50, x:x + 2] = (46, 46, 52)
lx = 60  # фонарь тоннеля со смазом движения
a[8:11, lx:lx + 14] = (255, 214, 140)
a[7, lx + 2:lx + 12] = a[11, lx + 2:lx + 12] = (150, 120, 80)
a[8:11, lx + 14:lx + 34] = np.linspace(1, 0, 20)[None, :, None] * np.array([150, 120, 80]) + (1 - np.linspace(1, 0, 20))[None, :, None] * a[8:11, lx + 14:lx + 34]
img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
img.save(ROOT / "client/public/route/tunnel.png")
img.resize((W * 4, H * 4), Image.NEAREST).save(ROOT / "assets/level-route/build/tunnel-x4.png")
print("tunnel", img.size)
