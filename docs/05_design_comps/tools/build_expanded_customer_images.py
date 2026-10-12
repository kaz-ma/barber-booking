"""PNG (render_expanded_customer.mjs, @3x full page) -> JPEG q88 in expanded/customer/ + contact_sheet.jpg
(every page side by side in a 6-column grid, top 1100 CSS px each, labelled, <= 1600px wide).
Usage: python3 build_expanded_customer_images.py <render_out_dir>"""
import sys, pathlib
from PIL import Image, ImageDraw, ImageFont
SRC = pathlib.Path(sys.argv[1])
OUT = pathlib.Path(__file__).resolve().parent.parent / 'expanded' / 'customer'
LABELS = {
    '04_menu_initial': 'S-C-02 ① メニュー 初期（CTA なし）', '04_menu': 'S-C-02 ① メニュー 選択後＋固定 CTA',
    '05_info': 'S-C-02b ③ お客様情報 入力済み', '05_info_error': 'S-C-02b 電話 blur エラー＋ご要望', '05_info_en': 'S-C-02b /en（ふりがななし）',
    '06_confirm': 'S-C-04 ④ 確認 同意済み', '06_confirm_unchecked': 'S-C-04 同意未チェック', '06_confirm_error': 'S-C-04 HE-02 エラーサマリー',
    '06_confirm_en': 'S-C-04 /en 同意未チェック', '07_cancel': 'S-C-06 キャンセル 締切前', '07_cancel_sheet': 'S-C-06 確認シート',
    '07_cancel_done': 'S-C-06 取り消し完了', '07_cancel_deadline': 'S-C-06 締切後（DM）', '07_cancel_invalid': 'S-C-06 無効なトークン',
    '08_policy': 'S-C-08 プライバシーポリシー', '08_notfound': 'S-C-10 404',
}
ORDER = ['04_menu_initial', '04_menu', '05_info', '05_info_error', '05_info_en', '06_confirm', '06_confirm_unchecked', '06_confirm_error',
         '06_confirm_en', '07_cancel', '07_cancel_sheet', '07_cancel_done', '07_cancel_deadline', '07_cancel_invalid', '08_policy', '08_notfound']
names = [n for n in ORDER if (SRC / f'{n}.png').exists()] + sorted(p.stem for p in SRC.glob('*.png') if p.stem not in ORDER and not p.stem.endswith('_320') and p.stem != 'texture')
for n in names:
    im = Image.open(SRC / f'{n}.png').convert('RGB')
    im.save(OUT / f'{n}.jpg', quality=88, optimize=True, progressive=True)
    print(f'{n}.jpg', im.size, (OUT / f'{n}.jpg').stat().st_size // 1024, 'KB')
COLS, COL, G, LAB, H_CSS = 6, 240, 16, 52, 1100
H = round(H_CSS * COL / 390)
rows = -(-len(names) // COLS)
W = COLS * COL + (COLS + 1) * G
sheet = Image.new('RGB', (W, rows * (LAB + H + G) + G), '#d8ccb6')
d = ImageDraw.Draw(sheet)
f1 = ImageFont.truetype('/usr/share/fonts/truetype/fonts-japanese-gothic.ttf', 15)
f2 = ImageFont.truetype('/usr/share/fonts/truetype/fonts-japanese-gothic.ttf', 12)
for i, n in enumerate(names):
    r, c = divmod(i, COLS)
    x = G + c * (COL + G); y = G + r * (LAB + H + G)
    im = Image.open(SRC / f'{n}.png').convert('RGB')
    full_h = round(im.height * COL / im.width)
    im = im.resize((COL, full_h), Image.LANCZOS).crop((0, 0, COL, min(H, full_h)))
    d.text((x, y + 2), f'{n}.html', fill='#191919', font=f1)
    d.text((x, y + 24), LABELS.get(n, ''), fill='#5c5046', font=f2)
    sheet.paste(im, (x, y + LAB))
    d.rectangle([x - 1, y + LAB - 1, x + COL, y + LAB + im.height], outline='#191919')
    if full_h > H:  # cropped: mark it
        d.rectangle([x, y + LAB + H - 18, x + COL - 1, y + LAB + H - 1], fill='#191919')
        d.text((x + 6, y + LAB + H - 16), f'↓ 続く（全 {round(full_h * 390 / COL)}px）', fill='#f4ecdd', font=f2)
assert sheet.width <= 1600
sheet.save(OUT / 'contact_sheet.jpg', quality=88, optimize=True)
print('contact_sheet.jpg', sheet.size)
