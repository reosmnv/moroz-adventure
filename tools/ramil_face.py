"""Ручная голова Рамиля (вид 3/4 вправо, по фото лица и эскизу GPT) поверх стойки. Бесплатно.
python3 tools/ramil_face.py <in64.png> <out.png> [X0 Y0]
Ряды 0..CLEAR-1 стираются целиком в полосе X0..X0+18, ниже рисуются только непустые клетки."""
import sys
from PIL import Image

C = {'K': (8, 6, 10), '1': (40, 24, 26), '2': (64, 40, 36), '3': (100, 62, 46), '4': (132, 84, 58),
     's': (240, 172, 128), 'd': (204, 128, 104), 'l': (250, 202, 162), 'e': (30, 20, 22),
     'b': (34, 24, 26), 'B': (58, 38, 34), 'g': (44, 26, 22), 'w': (205, 225, 240), 'y': (96, 58, 40),
     'r': (196, 108, 108), 'c': (240, 238, 232), 't': (245, 139, 52)}
GRID = [
    ".....KKKK.KKK.....",
    "...KK2332K2332K...",
    "..K1234432344321K.",
    ".K122344322344321K",
    "K1223322112233221K",
    "K11222112sllsss1K.",
    "K12211ssseessseeK.",
    "K112211sgggggsggK.",
    "K111221dgwysgsygK.",
    "K112211dsgggssggK.",
    "K122111BsdsssdssK.",
    "K12211KbBsBbbbbBK.",
    ".K11K.KbBBbBbrrcct",
    "..KK..KbbBbBbbK...",
    "......KKbbbbbK....",
]
CLEAR = 12
# варианты для выбора mr.R: A как есть; B чёрная оправа; C борода короче, видно щёки
VARIANT = sys.argv[5] if len(sys.argv) > 5 else 'A'
if VARIANT == 'B':
    C['g'] = (10, 8, 12)
if VARIANT == 'C':
    GRID[10] = "K122111dsdsssdssK."
    GRID[11] = "K12211KdsssbBbbBK."
    GRID[12] = ".K11K.KdsBbBbrrcct"
    GRID[13] = "..KK..KdbbbBbbK..."
X0, Y0 = (int(sys.argv[3]), int(sys.argv[4])) if len(sys.argv) > 4 else (22, 2)
im = Image.open(sys.argv[1]).convert('RGBA')
for r in range(CLEAR):
    for x in range(X0 - 2, X0 + 20):
        im.putpixel((x, Y0 + r), (0, 0, 0, 0))
for r, row in enumerate(GRID):
    for p, ch in enumerate(row):
        if ch != '.':
            im.putpixel((X0 + p, Y0 + r), (*C[ch], 255))
# пышные волны на затылке шире головы (как на фото)
EXTRA = [(-1, 5, 'K'), (-1, 6, 'K'), (-1, 7, 'K'), (-1, 8, 'K'), (-2, 9, 'K'), (-2, 10, 'K'), (-1, 11, 'K'), (-1, 12, 'K'),
         (0, 5, '1'), (0, 6, '2'), (0, 7, '3'), (0, 8, '2'), (-1, 9, '2'), (-1, 10, '1'), (0, 9, '3'), (0, 10, '2'), (0, 11, '1'), (0, 12, 'K'),
         (1, 12, '2'), (2, 12, '1'), (3, 13, 'K')]
for dx, r, ch in EXTRA:
    im.putpixel((X0 + dx, Y0 + r), (*C[ch], 255))
im.save(sys.argv[2])
