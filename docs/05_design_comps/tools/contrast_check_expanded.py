"""WCAG 2.x contrast + structural check for the expanded comps. Adapted from contrast_check_base.py.
1) token pairs: the light semantic pairings used by the pages (hex must exist in tokens.css) + the page-local
   --danger / --danger-pressed (not in tokens.css yet: DG-001 §9.1 leaves --danger undefined; listed separately)
2) DOM pairs: every text / placeholder / UI-border / icon / fill pair from render_expanded_customer.mjs (audit.json);
   pairs on the paper texture are re-judged against the darkest rendered texture pixel (texture.png)
3) layout + structure: targets >= 44px (390 and 320), scrollWidth 390 / 320, fonts loaded, and the in-page
   structural issues (focusable x / disabled / inert, unlabelled controls, error <-> aria-describedby, h1, tel:, dialog)
4) copy rules (DG-001 §5.0): 「空き時間を見て予約する」 only on the S-C-02 page with a menu selected; no tel:
Usage: python3 contrast_check_expanded.py <render_out_dir> [--md]   (exit 1 on any failure)"""
import json, sys, pathlib
from PIL import Image
ROOT = pathlib.Path(__file__).resolve().parent.parent
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
px = sorted(set(im.get_flattened_data() if hasattr(im, 'get_flattened_data') else im.getdata()), key=lum_rgb)
dark, light = '#%02x%02x%02x' % px[0], '#%02x%02x%02x' % px[-1]
spread = (lum(light) - lum(dark)) / lum('#f4ecdd') * 100
if spread > 7.5: fails.append(f'texture spread {spread:.2f}% > 7.5%')
# ---- 1) token pairs ----
tokens = (ROOT / 'tokens.css').read_text().lower()
PAGE_LOCAL = {'#a33b0b': '--danger', '#862f08': '--danger-pressed'}
L = [
 ('#191919', '#f4ecdd', 'text', '本文・見出し / 紙'), ('#191919', '#fbf7ef', 'text', '本文・入力値 / カード・入力欄'),
 ('#191919', '#e9dcc3', 'text', '本文 / 沈み面（ポリシー要点・目次・フッター）'), ('#5c5046', '#f4ecdd', 'text', '補助文字 / 紙'),
 ('#5c5046', '#fbf7ef', 'text', 'ラベル dt・ヘルプ・プレースホルダー / カード'), ('#5c5046', '#e9dcc3', 'text', '補助文字 / 沈み面'),
 ('#655b52', '#f4ecdd', 'text', '無効 CTA・次の段の予告 / 紙（--fg-subtle）'), ('#655b52', '#fbf7ef', 'text', 'ステッパー未到達 / カード'),
 ('#f4ecdd', '#7c0000', 'text', 'CTA・選択中バッジの文字'), ('#fbf7ef', '#191919', 'text', 'ステッパー現在'),
 ('#191919', '#f4ecdd', 'ui', '操作部品の枠（入力欄・ラジオ・同意・secondary）'), ('#191919', '#fbf7ef', 'ui', 'ラジオの輪・チェックの箱 / カード'),
 ('#7c0000', '#f4ecdd', 'ui', 'CTA の面・選択中カードの 2px 枠'), ('#7c0000', '#fbf7ef', 'ui', '選択中カードのラジオの点 / カード'),
 ('#655b52', '#f4ecdd', 'ui', '無効 CTA の破線枠'), ('#0f5f8f', '#f4ecdd', 'ui', 'フォーカスリング / 紙'), ('#0f5f8f', '#fbf7ef', 'ui', 'フォーカスリング / カード'),
 ('#a33b0b', '#f4ecdd', 'text', '破壊的操作の文字・枠 / 紙（page-local --danger）'), ('#a33b0b', '#fbf7ef', 'text', '破壊的操作の文字 / カード面のボタン'),
 ('#a33b0b', '#e9dcc3', 'text', '--danger / 沈み面（参考）'), ('#f4ecdd', '#a33b0b', 'text', '「予約を取り消す」の文字 / --danger の面'),
 ('#f4ecdd', '#862f08', 'text', '押下中の文字 / --danger-pressed'), ('#a33b0b', '#fbf7ef', 'ui', '--danger の面 / シート（カード）'),
]
rows = []
for fg, bg, kind, where in L:
    r = ratio(fg, bg); need = NEED[kind]
    for h in (fg, bg):
        if h not in tokens and h not in PAGE_LOCAL: fails.append(f'{h} not in tokens.css')
    tex = ratio(fg, dark) if bg == '#f4ecdd' else None
    ok = r >= need and (tex is None or tex >= need)
    if not ok: fails.append(f'token {fg}/{bg} {r:.2f}')
    rows.append((fg, bg, r, tex, kind, need, where, ok))
# ---- 2) DOM pairs ----
audit = json.loads((OUT / 'audit.json').read_text())
dom = {}
for page, p in audit['pages'].items():
    for q in p['pairs']:
        if q.get('alpha', 1) < 1: fails.append(f'{page}: translucent text {q}')
        r = ratio(q['fg'], q['bg']); r2 = ratio(q['fg'], dark) if q.get('paper') else r
        worst = min(r, r2); need = NEED[q['kind']]
        k = (page, q['kind'], q['fg'], q['bg'] + (' +紙' if q.get('paper') else ''))
        g = dom.setdefault(k, {'r': worst, 'n': 0, 'ex': q['text'], 'need': need}); g['n'] += 1
        if worst < need: fails.append(f"{page}: {q['fg']} on {q['bg']} {worst:.2f} < {need} ({q['text']})")
summary = {}
for (page, kind, fg, bg), g in dom.items():
    s = summary.setdefault(page, {'n': 0, 'text': (99, ''), 'large': (99, ''), 'ui': (99, '')})
    s['n'] += g['n']
    if g['r'] < s[kind][0]: s[kind] = (g['r'], f'`{fg}` / `{bg}`（{g["ex"][:14]}）')
# ---- 3) layout + structure ----
lay = []
for page, p in audit['pages'].items():
    small = [t for t in p['targets'] if t['w'] < 44 or t['h'] < 44]
    mn = min(min(t['w'], t['h']) for t in p['targets'])
    fonts_ok = all(p['fonts'][k] for k in ('lato400', 'lato700', 'noto', 'noto700'))
    ok = not small and p['targets320'] >= 44 and p['scrollWidth390'] == 390 and p['scrollWidth320'] == 320 and fonts_ok and not p['issues'] \
        and not p['overflow390'] and not p['overflow320']
    if not ok: fails.append(f'layout {page}: small={small} t320={p["targets320"]} sw={p["scrollWidth390"]}/{p["scrollWidth320"]} ovf={p["overflow390"]}/{p["overflow320"]} fonts={fonts_ok} issues={p["issues"]}')
    i = p['info']
    lay.append((page, len(p['targets']), mn, p['targets320'], p['scrollWidth390'], p['scrollWidth320'], p['scrollHeight'], fonts_ok,
                i['controls'], i['errors'], i['nonFocusChecked'], ', '.join(f"{a['text'][:10]}{'（Tab 可）' if a['tabbable'] else ''}" for a in i['ariaDisabled']) or '—', p['issues'], ok))
# ---- 4) copy rules ----
SEE = '空き時間を見て予約する'
for page, p in audit['pages'].items():
    txt = p['info']['text']
    if SEE in txt and page != '04_menu': fails.append(f'copy {page}: 「{SEE}」 outside the menu step with a selection')
if SEE not in audit['pages'].get('04_menu', {}).get('info', {}).get('text', SEE): fails.append('copy 04_menu: sticky CTA missing')
# ---- print ----
pf = lambda ok: 'PASS' if ok else 'FAIL'
if MD:
    print(f'紙テクスチャ: 最暗 `{dark}` / 最明 `{light}`、輝度の幅 {spread:.2f}%（上限 7.5%）\n')
    print('| 前景 / 背景 | 比 | 紙の最暗部で | 種別（基準） | 用途 | 判定 |\n|---|---|---|---|---|---|')
    for fg, bg, r, tex, kind, need, where, ok in rows:
        print(f"| `{fg}` / `{bg}` | {r:.2f}:1 | {'%.2f:1' % tex if tex else '—'} | {kind} {need} | {where} | {pf(ok)} |")
    print('\n| 画面 | ペア | 通常文字の最小 | 大きな文字の最小 | UI の最小 | 判定 |\n|---|---|---|---|---|---|')
    for page in sorted(summary):
        s = summary[page]; f = lambda t: '—' if t[0] == 99 else f'{t[0]:.2f}:1 {t[1]}'
        ok = all(g['r'] >= g['need'] for k, g in dom.items() if k[0] == page)
        print(f"| {page} | {s['n']} | {f(s['text'])} | {f(s['large'])} | {f(s['ui'])} | {pf(ok)} |")
    print('\n| 画面 | 操作要素 | 最小辺 390 | 最小辺 320 | sw 390 | sw 320 | 高さ | フォント | 入力欄（ラベル付き） | エラー文（describedby） | 非活性の検査数 | aria-disabled | 構造の問題 | 判定 |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|')
    for page, n, mn, m320, w1, w2, h, fo, c, e, nf, ad, iss, ok in lay:
        print(f"| {page} | {n} | {mn} | {m320} | {w1} | {w2} | {h} | {'OK' if fo else 'NG'} | {c} | {e} | {nf} | {ad} | {len(iss)} | {pf(ok)} |")
else:
    print(f'texture darkest {dark} lightest {light} spread {spread:.2f}%')
    for row in rows: print(row[0], row[1], f'{row[2]:.2f}', f'{row[3]:.2f}' if row[3] else '-', row[4], pf(row[7]), row[6])
    for page in sorted(summary): print(page, summary[page])
    for row in lay: print(*row)
print('\n' + ('ALL PASS' if not fails else '\n'.join(fails)), file=sys.stderr)
sys.exit(1 if fails else 0)
