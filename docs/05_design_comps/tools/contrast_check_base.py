"""WCAG 2.x contrast check for the base comps (DG-001). Adapted from contrast_check.py.
1) token pairs: every semantic pairing in tokens.css (light + dark), hex must exist in tokens.css
2) DOM pairs: every text / UI-border / icon / CTA-fill pair found by render_base.mjs (audit.json);
   pairs on the paper texture are re-judged against the darkest rendered texture pixel (texture.png)
3) layout: 44px targets, scrollWidth at 390 / 320, done-screen height <= 844, fonts loaded
Usage: python3 contrast_check_base.py <render_out_dir> [--md]   (exit 1 on any failure)"""
import json, sys, pathlib
from PIL import Image
ROOT = pathlib.Path('/home/user/barber-booking/docs/05_design_comps')
OUT = pathlib.Path(sys.argv[1]); MD = '--md' in sys.argv
def lum_rgb(rgb):
    f = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (f(v / 255) for v in rgb); return 0.2126 * r + 0.7152 * g + 0.0722 * b
hx = lambda h: tuple(int(h.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4))
lum = lambda h: lum_rgb(hx(h))
def ratio(a, b):
    hi, lo = sorted((lum(a), lum(b)), reverse=True); return (hi + 0.05) / (lo + 0.05)
NEED = {'text': 4.5, 'large': 3.0, 'ui': 3.0}
fails = []
# ---- texture ----
im = Image.open(OUT / 'texture.png').convert('RGB')
px = sorted(set(im.getdata()), key=lum_rgb)
dark, light = '#%02x%02x%02x' % px[0], '#%02x%02x%02x' % px[-1]
spread = (lum(light) - lum(dark)) / lum('#f4ecdd') * 100
if spread > 7.5: fails.append(f'texture spread {spread:.2f}% > 7.5%')
# ---- 1) token pairs ----
tokens = (ROOT / 'tokens.css').read_text().lower()
L = [  # fg, bg, kind, 用途
 ('#191919', '#f4ecdd', 'text', '本文・見出し / 紙（--fg / --bg）'), ('#191919', '#fbf7ef', 'text', '本文 / カード（--fg / --bg-card）'),
 ('#191919', '#e9dcc3', 'text', '注記・フッター / 沈み面（--fg / --bg-sunken）'), ('#5c5046', '#f4ecdd', 'text', '補助文字 / 紙（--fg-muted）'),
 ('#5c5046', '#fbf7ef', 'text', '補助文字 / カード'), ('#5c5046', '#e9dcc3', 'text', '補助文字 / 沈み面'),
 ('#655b52', '#f4ecdd', 'text', '× 日セル・凡例 × / 紙（--fg-subtle）'), ('#655b52', '#e9dcc3', 'text', '× 時間枠行 / 沈み面'),
 ('#655b52', '#fbf7ef', 'text', 'ステッパー未到達 / カード'), ('#0f5f8f', '#fbf7ef', 'text', '◎ / 時間枠・日セル（--status-open）'),
 ('#0f5f8f', '#f4ecdd', 'text', '凡例 ◎ / 紙'), ('#f4ecdd', '#7c0000', 'text', 'CTA・選択中の文字（--on-accent / --accent）'),
 ('#fbf7ef', '#191919', 'text', 'ステッパー現在・地図ピン（--bg-card / --fg）'),
 ('#191919', '#f4ecdd', 'ui', '操作部品の枠線（--border）'), ('#191919', '#fbf7ef', 'ui', '枠線・アイコン / カード'),
 ('#0f5f8f', '#f4ecdd', 'ui', '◎ セル・行の枠線、フォーカスリング（--ring）'), ('#0f5f8f', '#fbf7ef', 'ui', 'フォーカスリング / カード'),
 ('#7c0000', '#f4ecdd', 'ui', 'CTA・選択中の面（--accent）'), ('#600000', '#f4ecdd', 'ui', 'CTA 押下（--accent-pressed）'),
 ('#f4ecdd', '#600000', 'text', '押下中 CTA の文字'), ('#655b52', '#f4ecdd', 'ui', '× セルの破線枠（非活性・参考）'),
]
D = [
 ('#f4ecdd', '#191919', 'text', '本文 / 背景'), ('#f4ecdd', '#241e1a', 'text', '本文 / カード'), ('#f4ecdd', '#2b2926', 'text', '本文 / 沈み面'),
 ('#b8b0a4', '#191919', 'text', '補助文字 / 背景'), ('#b8b0a4', '#241e1a', 'text', '補助文字 / カード'),
 ('#9a948c', '#191919', 'text', '× / 背景'), ('#9a948c', '#2b2926', 'text', '× / 沈み面'),
 ('#191919', '#d9777b', 'text', 'CTA・選択中の文字'), ('#191919', '#e38b8b', 'text', '押下中 CTA の文字'),
 ('#7cc0e8', '#241e1a', 'text', '◎ / カード'), ('#7cc0e8', '#191919', 'ui', 'フォーカスリング・◎ 枠'),
 ('#d9777b', '#191919', 'ui', 'CTA の面'), ('#9a948c', '#191919', 'ui', '操作部品の枠線'),
]
rows = []
for theme, pairs in (('light', L), ('dark', D)):
    for fg, bg, kind, where in pairs:
        r = ratio(fg, bg); need = NEED[kind]
        for h in (fg, bg):
            if h not in tokens: fails.append(f'{h} not in tokens.css')
        tex = ratio(fg, dark) if theme == 'light' and bg == '#f4ecdd' else None
        ok = r >= need and (tex is None or tex >= need)
        if not ok: fails.append(f'token {fg}/{bg} {r:.2f}')
        rows.append((theme, fg, bg, r, tex, kind, need, where, ok))
# ---- 2) DOM pairs ----
audit = json.loads((OUT / 'audit.json').read_text())
dom = {}
for page, p in audit['pages'].items():
    for q in p['pairs']:
        if q['kind'] == 'image': fails.append(f'{page}: text on image {q}'); continue
        if q.get('alpha', 1) < 1: fails.append(f'{page}: translucent text {q}')
        r = ratio(q['fg'], q['bg']); r2 = ratio(q['fg'], dark) if q.get('paper') else r
        worst = min(r, r2); need = NEED[q['kind']]
        k = (page, q['kind'], q['fg'], q['bg'] + (' +紙' if q.get('paper') else ''))
        g = dom.setdefault(k, {'r': worst, 'n': 0, 'ex': q['text'], 'need': need}); g['n'] += 1
        if worst < need: fails.append(f"{page}: {q['fg']} on {q['bg']} {worst:.2f} < {need} ({q['text']})")
# ---- 3) layout ----
lay = []
for page, p in audit['pages'].items():
    small = [t for t in p['targets'] if t['w'] < 44 or t['h'] < 44]
    mn = min(min(t['w'], t['h']) for t in p['targets'])
    fonts_ok = any(f.startswith('Lato') for f in p['fonts']['loaded']) and any(f.startswith('Noto Sans JP') for f in p['fonts']['loaded']) and all(p['fonts'][k] for k in ('lato400', 'lato700', 'noto', 'noto700'))
    h_ok = page != '03_done' or p['contentBottom'] <= 844
    ok = not small and p['scrollWidth390'] == 390 and p['scrollWidth320'] == 320 and h_ok and fonts_ok
    if not ok: fails.append(f'layout {page}: small={small} sw={p["scrollWidth390"]}/{p["scrollWidth320"]} h={p["contentBottom"]} fonts={fonts_ok}')
    lay.append((page, len(p['targets']), mn, p['scrollWidth390'], p['scrollWidth320'], p['contentBottom'], fonts_ok, p['reducedMotion'], ok))
# ---- print ----
pf = lambda ok: 'PASS' if ok else 'FAIL'
if MD:
    print(f'紙テクスチャ: 最暗 `{dark}` / 最明 `{light}`、輝度の幅 {spread:.2f}%（上限 7.5%）\n')
    print('| テーマ | 前景 / 背景 | 比 | 紙の最暗部で | 種別（基準） | 用途 | 判定 |\n|---|---|---|---|---|---|---|')
    for t, fg, bg, r, tex, kind, need, where, ok in rows:
        aaa = ' AAA' if kind == 'text' and r >= 7 and (tex is None or tex >= 7) else ''
        print(f"| {t} | `{fg}` / `{bg}` | {r:.2f}:1 | {'%.2f:1' % tex if tex else '—'} | {kind} {need} | {where} | {pf(ok)}{aaa} |")
    print('\n| 画面 | 種別 | 前景 / 背景 | 最小比 | 箇所数 | 例 | 判定 |\n|---|---|---|---|---|---|---|')
    for (page, kind, fg, bg), g in sorted(dom.items()):
        print(f"| {page} | {kind} {g['need']} | `{fg}` / `{bg}` | {g['r']:.2f}:1 | {g['n']} | {g['ex'][:18]} | {pf(g['r'] >= g['need'])} |")
    print('\n| 画面 | 操作要素 | 最小辺 px | scrollWidth 390 | scrollWidth 320 | 内容の下端 px | フォント | reduced-motion | 判定 |\n|---|---|---|---|---|---|---|---|---|')
    for page, n, mn, w1, w2, hb, fo, rm, ok in lay:
        print(f"| {page} | {n} | {mn} | {w1} | {w2} | {hb} | {'Lato・Noto 読込済' if fo else 'NG'} | {rm['transition']}・animations {rm['animations']} | {pf(ok)} |")
else:
    print(f'texture darkest {dark} lightest {light} spread {spread:.2f}%')
    for row in rows: print(row[0], row[1], row[2], f'{row[3]:.2f}', f'{row[4]:.2f}' if row[4] else '-', row[5], pf(row[8]), row[7])
    for k, g in sorted(dom.items()): print(*k, f"{g['r']:.2f}", g['n'], pf(g['r'] >= g['need']), g['ex'][:20])
    for row in lay: print(*row)
print('\n' + ('ALL PASS' if not fails else '\n'.join(fails)), file=sys.stderr)
sys.exit(1 if fails else 0)
