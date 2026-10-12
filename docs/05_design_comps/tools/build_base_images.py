"""PNG (render_base.mjs, @3x) -> JPEG q88 in base/ + base_contact_sheet.jpg (3 screens side by side,
top 1200 CSS px each, <= 1600px wide). Usage: python3 build_base_images.py <render_out_dir>"""
import sys, pathlib
from PIL import Image, ImageDraw, ImageFont
SRC = pathlib.Path(sys.argv[1]); OUT = pathlib.Path('/home/user/barber-booking/docs/05_design_comps/base')
NAMES = ['01_top', '02_time', '03_done', '01_top_desktop']
for n in NAMES:
    im = Image.open(SRC / f'{n}.png').convert('RGB')
    im.save(OUT / f'{n}.jpg', quality=88, optimize=True, progressive=True)
    print(n, im.size, (OUT / f'{n}.jpg').stat().st_size // 1024, 'KB')
LABELS = ['S-C-01 トップ /ja', 'S-C-03 ② 日時を選ぶ /ja（月カレンダー）', 'S-C-05 予約完了 /ja（844px 内）']
COL, G, TOP, H_CSS = 500, 24, 56, 1200
H = round(H_CSS * COL / 390)
font = ImageFont.truetype('/usr/share/fonts/truetype/fonts-japanese-gothic.ttf', 20)
sheet = Image.new('RGB', (COL * 3 + G * 4, TOP + H + G), '#d8ccb6')
d = ImageDraw.Draw(sheet)
for i, n in enumerate(NAMES[:3]):
    im = Image.open(SRC / f'{n}.png').convert('RGB')
    im = im.resize((COL, round(im.height * COL / im.width)), Image.LANCZOS).crop((0, 0, COL, min(H, round(im.height * COL / im.width))))
    x = G + i * (COL + G); sheet.paste(im, (x, TOP)); d.text((x, 18), LABELS[i], fill='#191919', font=font)
    if n == '03_done':  # mark the 844px fold
        y = TOP + round(844 * COL / 390); d.line([(x, y), (x + COL, y)], fill='#0f5f8f', width=2)
        d.text((x + 8, y + 6), '844px（画面下端）', fill='#191919', font=font)
sheet.save(OUT / 'base_contact_sheet.jpg', quality=88, optimize=True)
print('contact sheet', sheet.size)
