"""PNG -> JPG (q85, <=1600px wide), delete PNGs, build admin_contact_sheet.jpg."""
import glob, os, sys
from PIL import Image

DIR = sys.argv[1]
MAXW = 1600
jpgs = []
for png in sorted(glob.glob(os.path.join(DIR, 'admin_[0-9][0-9]_*.png'))):
    im = Image.open(png).convert('RGB')
    if im.width > MAXW:
        im = im.resize((MAXW, round(im.height * MAXW / im.width)), Image.LANCZOS)
    jpg = png[:-4] + '.jpg'
    im.save(jpg, 'JPEG', quality=85, optimize=True, progressive=True)
    os.remove(png)
    jpgs.append(jpg)
    print(f'{os.path.basename(jpg)} {im.width}x{im.height} {os.path.getsize(jpg)//1024}KB')

if not jpgs:
    sys.exit(0)
# contact sheet: all screens stacked, scaled to <=1600 wide, with 16px gaps
all_jpgs = sorted(glob.glob(os.path.join(DIR, 'admin_[0-9][0-9]_*.jpg')))
ims = [Image.open(p) for p in all_jpgs]
W = min(MAXW, max(i.width for i in ims))
ims = [i if i.width == W else i.resize((W, round(i.height * W / i.width)), Image.LANCZOS) for i in ims]
gap = 16
H = sum(i.height for i in ims) + gap * (len(ims) - 1)
sheet = Image.new('RGB', (W, H), (200, 200, 200))
y = 0
for i in ims:
    sheet.paste(i, (0, y)); y += i.height + gap
out = os.path.join(DIR, 'admin_contact_sheet.jpg')
sheet.save(out, 'JPEG', quality=85, optimize=True, progressive=True)
print(f'admin_contact_sheet.jpg {W}x{H} {os.path.getsize(out)//1024}KB ({len(ims)} screens)')
