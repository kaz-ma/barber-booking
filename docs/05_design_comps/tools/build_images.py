"""PNG (Playwright @2x) -> JPEG q85 (<=780px) + compare_ABC.jpg; also samples texture/logo pixels."""
import pathlib
from PIL import Image, ImageDraw, ImageFont
SRC = pathlib.Path(__file__).parent
OUT = pathlib.Path('/home/user/barber-booking/docs/05_design_comps/style_tiles')
NAMES = ['A_heritage_paper', 'B_modern_barber', 'C_night_chair']
LABELS = ['A  Heritage Paper / ヘリテージ・ペーパー', 'B  Modern Barber / モダン・バーバー', 'C  Night Chair / ナイト・チェア']
def lum(rgb):
    f = lambda c: c/12.92 if c <= 0.04045 else ((c+0.055)/1.055)**2.4
    r, g, b = (f(v/255) for v in rgb); return 0.2126*r + 0.7152*g + 0.0722*b
def cr(a, b):
    hi, lo = sorted((lum(a), lum(b)), reverse=True); return (hi+.05)/(lo+.05)
hx = lambda h: tuple(int(h[i:i+2], 16) for i in (1, 3, 5))
tiles = []
for n in NAMES:
    im = Image.open(SRC / f'{n}.png').convert('RGB')
    if im.width > 780: im = im.resize((780, round(im.height*780/im.width)), Image.LANCZOS)
    im.save(OUT / f'{n}.jpg', quality=85, optimize=True, progressive=True)
    print(n, im.size, (OUT / f'{n}.jpg').stat().st_size // 1024, 'KB')
    tiles.append(im)
# texture: empty strip of paper in tile A (section 1 top padding, CSS y 56-84 -> @2x 112-168)
strip = tiles[0].crop((0, 112, 780, 168)); px = list(strip.get_flattened_data() if hasattr(strip, 'get_flattened_data') else strip.getdata())
dark, light = min(px, key=lum), max(px, key=lum)
print('A texture darkest', '#%02x%02x%02x' % dark, 'lightest', '#%02x%02x%02x' % light,
      'luminance spread %.1f%%' % ((lum(light)-lum(dark))/lum(hx('#f4ecdd'))*100))
for fg in ('#191919', '#5c5046', '#7c0000', '#655b52', '#0f5f8f'):
    print(f'  {fg} vs darkest texture px: {cr(hx(fg), dark):.2f}:1')
# compare image: top 1200 CSS px of each tile at 390px wide
W, H, G, TOP = 390, 1200, 24, 56
font = ImageFont.truetype('/usr/share/fonts/truetype/fonts-japanese-gothic.ttf', 18)
canvas = Image.new('RGB', (W*3 + G*4, H + TOP + G), '#d9d2c6')
d = ImageDraw.Draw(canvas)
for i, im in enumerate(tiles):
    small = im.resize((W, round(im.height*W/im.width)), Image.LANCZOS).crop((0, 0, W, H))
    x = G + i*(W+G); canvas.paste(small, (x, TOP)); d.text((x, 20), LABELS[i], fill='#191919', font=font)
canvas.save(OUT / 'compare_ABC.jpg', quality=85, optimize=True)
print('compare_ABC', canvas.size)
