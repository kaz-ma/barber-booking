"""PNG (Playwright @1.5x) -> JPEG q85 (<=1600px wide), delete PNGs, build customer_contact_sheet.jpg."""
import pathlib
from PIL import Image, ImageDraw, ImageFont
DIR = pathlib.Path('/home/user/barber-booking/docs/04_wireframes/screens')
MAXW = 1600
LABELS = {
    'customer_01_top': 'S-C-01 トップ',
    'customer_02_book_menu': 'S-C-02 予約 1 メニューを選ぶ',
    'customer_02_book_info': 'S-C-02 予約 2 お客様情報',
    'customer_03_time': 'S-C-03 予約 3 日時を選ぶ',
    'customer_04_confirm': 'S-C-04 予約 4 確認',
    'customer_05_done': 'S-C-05 予約完了',
    'customer_06_cancel': 'S-C-06 キャンセル',
    'customer_07_policies_error': 'S-C-08/09 ポリシー・S-C-10 404/エラー',
}
font = ImageFont.truetype('/usr/share/fonts/truetype/fonts-japanese-gothic.ttf', 28)
tiles = []
for stem in LABELS:  # flow order, not alphabetical
    png = DIR / f'{stem}.png'
    im = Image.open(png).convert('RGB')
    if im.width > MAXW:
        im = im.resize((MAXW, round(im.height * MAXW / im.width)), Image.LANCZOS)
    jpg = png.with_suffix('.jpg')
    im.save(jpg, quality=85, optimize=True, progressive=True)
    png.unlink()
    print(jpg.name, im.size, jpg.stat().st_size // 1024, 'KB')
    tiles.append((png.stem, im))
BAR, GAP = 64, 24
H = sum(BAR + im.height + GAP for _, im in tiles)
sheet = Image.new('RGB', (MAXW, H), '#c8c8c8')
d = ImageDraw.Draw(sheet)
y = 0
for stem, im in tiles:
    d.rectangle((0, y, MAXW, y + BAR), fill='#1a1a1a')
    d.text((24, y + 16), f'{stem}  —  {LABELS.get(stem, "")}', fill='#ffffff', font=font)
    sheet.paste(im, ((MAXW - im.width) // 2, y + BAR))
    y += BAR + im.height + GAP
out = DIR / 'customer_contact_sheet.jpg'
sheet.save(out, quality=85, optimize=True, progressive=True)
print(out.name, sheet.size, out.stat().st_size // 1024, 'KB')
