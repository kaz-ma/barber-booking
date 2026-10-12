"""WCAG 2.x contrast + structural check for the expanded admin comps. Adapted from contrast_check_base.py.
1) token pairs: the admin pairings of tokens.css (light + dark); every hex must exist in tokens.css
2) DOM pairs: every text / UI-border / icon / fill pair found by render_expanded_admin.mjs (audit.json).
   Light pages: pairs on the paper texture are re-judged against the darkest texture pixel (measured here by
   rendering a paper strip). Dark page (data-theme="dark"): no texture, judged as is.
3) structure: targets >= 44px, booking cards >= 56px, tab bar 72px + safe area, FAB 56px, no horizontal overflow at
   390 / 320 (scrollWidth and no element beyond the edges), labels on all inputs, toasts role="status",
   overlap alerts role="alert", sheets role="dialog" aria-modal, fonts loaded, no page errors, no animations.
Usage: python3 contrast_check_expanded_admin.py <render_out_dir> [--md]   (exit 1 on any failure)"""
import json, sys, pathlib, subprocess
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
# ---- texture (render an empty paper strip once) ----
tex = OUT / 'texture.png'
if not tex.exists():
    (OUT / 'texture.html').write_text(f'<!doctype html><html><head><link rel="stylesheet" href="file://{ROOT}/tokens.css"></head><body class="paper" style="margin:0;height:844px"></body></html>')
    js = ("import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';"
          "const b=await chromium.launch();const p=await b.newPage({viewport:{width:390,height:844}});"
          f"await p.goto('file://{OUT}/texture.html');await p.waitForTimeout(300);await p.screenshot({{path:'{tex}'}});await b.close();")
    subprocess.run(['node', '--input-type=module', '-e', js], check=True)
_im = Image.open(tex).convert('RGB'); px = sorted(set(getattr(_im, 'get_flattened_data', _im.getdata)()), key=lum_rgb)
dark, light = '#%02x%02x%02x' % px[0], '#%02x%02x%02x' % px[-1]
spread = (lum(light) - lum(dark)) / lum('#f4ecdd') * 100
if spread > 7.5: fails.append(f'texture spread {spread:.2f}% > 7.5%')
# ---- 1) token pairs used by the admin comps ----
tokens = (ROOT / 'tokens.css').read_text().lower()
L = [
 ('#191919', '#f4ecdd', 'text', '本文・見出し / 紙（--fg / --bg）'), ('#191919', '#fbf7ef', 'text', '予約カード・リスト / カード（--fg / --bg-card）'),
 ('#191919', '#e9dcc3', 'text', '完了カード・経路 pill / 沈み面（--fg / --bg-sunken）'), ('#5c5046', '#f4ecdd', 'text', '時刻ラベル・補足 / 紙（--fg-muted）'),
 ('#5c5046', '#fbf7ef', 'text', 'ふりがな・補足 / カード'), ('#5c5046', '#e9dcc3', 'text', '空き区間の「＋ 空き」・完了の時刻 / 沈み面'),
 ('#655b52', '#fbf7ef', 'text', '無効ボタンの文字 / カード（--fg-subtle）'), ('#655b52', '#f4ecdd', 'text', '無効ボタン・FAB（オフライン）/ 紙'),
 ('#0f5f8f', '#fbf7ef', 'text', '未確認チップ・未確認ボタン・空き時刻 ◎ / カード（--info = --status-open）'),
 ('#fbf7ef', '#0f5f8f', 'text', '未確認の件数バッジ（--on-info / --info）'),
 ('#f4ecdd', '#7c0000', 'text', 'primary・FAB・現在時刻ラベル（--on-accent / --accent）'),
 ('#fbf7ef', '#191919', 'text', '施術中・今日チップ、選択中のセグメント、手順番号（--bg-card / --fg）'),
 ('#f4ecdd', '#191919', 'text', 'トースト（--on-inverse / --inverse）'),
 ('#191919', '#fbf7ef', 'ui', '操作部品の枠・tel ボタン・スイッチ ON（--border / --fg）'),
 ('#7c0000', '#f4ecdd', 'ui', '現在時刻の線・FAB・primary の面（--accent）/ 紙'), ('#7c0000', '#fbf7ef', 'ui', '現在時刻の線（カードを横切る）'),
 ('#0f5f8f', '#fbf7ef', 'ui', '空き時刻チップ・未確認ボタンの枠、フォーカスリング'), ('#0f5f8f', '#f4ecdd', 'ui', '情報バナーの左罫・リング / 紙'),
 ('#655b52', '#f4ecdd', 'ui', 'ブロックの破線枠・無効の破線（--fg-subtle）'), ('#655b52', '#e9dcc3', 'ui', 'スイッチ OFF のつまみ / 沈み面'),
 ('#655b52', '#fbf7ef', 'ui', 'スイッチ OFF の枠 / カード'),
]
D = [
 ('#f4ecdd', '#191919', 'text', '本文 / 背景'), ('#f4ecdd', '#241e1a', 'text', '予約カード / カード'), ('#f4ecdd', '#2b2926', 'text', '完了カード・pill / 沈み面'),
 ('#b8b0a4', '#191919', 'text', '時刻ラベル・補足 / 背景'), ('#b8b0a4', '#241e1a', 'text', 'ふりがな・タブ（非選択）/ カード'), ('#b8b0a4', '#2b2926', 'text', '「＋ 空き」・完了の時刻 / 沈み面'),
 ('#9a948c', '#241e1a', 'text', '完了チップの枠 / カード（参考）'),
 ('#7cc0e8', '#241e1a', 'text', '未確認チップ・未確認ボタン / カード'), ('#241e1a', '#7cc0e8', 'text', '未確認の件数バッジ'),
 ('#191919', '#d9777b', 'text', 'FAB・現在時刻ラベル（--on-accent / --accent）'), ('#241e1a', '#f4ecdd', 'text', '施術中・今日チップ（--bg-card / --fg）'),
 ('#d9777b', '#191919', 'ui', '現在時刻の線・FAB の面 / 背景'), ('#d9777b', '#241e1a', 'ui', '現在時刻の線（カードを横切る）'),
 ('#9a948c', '#191919', 'ui', '操作部品の枠・ブロックの破線'), ('#9a948c', '#241e1a', 'ui', 'tel ボタンの枠 / カード'), ('#7cc0e8', '#191919', 'ui', 'フォーカスリング'),
]
rows = []
for theme, prs in (('light', L), ('dark', D)):
    for fg, bg, kind, where in prs:
        r = ratio(fg, bg); need = NEED[kind]
        for h in (fg, bg):
            if h not in tokens: fails.append(f'{h} not in tokens.css')
        tx = ratio(fg, dark) if theme == 'light' and bg == '#f4ecdd' else None
        ok = r >= need and (tx is None or tx >= need)
        if not ok: fails.append(f'token {theme} {fg}/{bg} {r:.2f}')
        rows.append((theme, fg, bg, r, tx, kind, need, where, ok))
# ---- 2) DOM pairs ----
audit = json.loads((OUT / 'audit.json').read_text())
dom = {}; summary = {}
for page, p in audit['pages'].items():
    mins = summary.setdefault(page, {'theme': p['theme'], 'n': 0, 'text': (99, ''), 'large': (99, ''), 'ui': (99, '')})
    for q in p['pairs']:
        if q.get('alpha', 1) < 1: fails.append(f'{page}: translucent text {q}')
        r = ratio(q['fg'], q['bg']); r2 = ratio(q['fg'], dark) if q.get('paper') else r
        worst = min(r, r2); need = NEED[q['kind']]
        k = (page, q['kind'], q['fg'], q['bg'] + (' +紙' if q.get('paper') else ''))
        g = dom.setdefault(k, {'r': worst, 'n': 0, 'ex': q['text'], 'need': need}); g['n'] += 1
        mins['n'] += 1
        if worst < mins[q['kind']][0]: mins[q['kind']] = (worst, f"`{q['fg']}` / `{q['bg']}`{'（紙の最暗部）' if q.get('paper') else ''} {q['text'][:14]}")
        if worst < need: fails.append(f"{page}: {q['fg']} on {q['bg']} {worst:.2f} < {need} ({q['text']})")
# ---- 3) structure ----
lay = []
for page, p in audit['pages'].items():
    small = [t for t in p['targets'] if t['w'] < 44 or t['h'] < 44]
    mn = min(min(t['w'], t['h']) for t in p['targets'])
    fonts_ok = any(f.startswith('Lato') for f in p['fonts']['loaded']) and any(f.startswith('Noto Sans JP') for f in p['fonts']['loaded']) and all(p['fonts'][k] for k in ('lato400', 'lato700', 'noto', 'noto700'))
    cards_ok = all(h >= 56 for h in p['cards'])
    tab_ok = p['tabbar'] is None or (p['tabbar']['ul'] == 72 and p['tabbar']['padBottom'] >= 34 and all(h >= 44 for h in p['tabbar']['tabs']))
    fab_ok = all(h == 56 for h in p['fabs'])
    flow_ok = p['scrollWidth390'] == 390 and p['scrollWidth320'] == 320 and p['offscreenCount390'] == 0 and p['offscreenCount320'] == 0
    toast_ok = all(t['role'] == 'status' or t['live'] in ('polite', 'assertive') for t in p['toasts'])
    alert_ok = all(a == 'alert' for a in p['alerts'])
    sheet_ok = all(s['role'] == 'dialog' and s['modal'] == 'true' and s['top'] >= 47 for s in p['sheets'])
    misc_ok = not p['errors'] and p['animations'] == 0 and p['h1'] == 1
    checks = dict(targets=not small, cards=cards_ok, tabbar=tab_ok, fab=fab_ok, overflow=flow_ok, labels=not p['unlabeled'], toast=toast_ok, alert=alert_ok, sheet=sheet_ok, fonts=fonts_ok, misc=misc_ok)
    ok = all(checks.values())
    if not ok: fails.append(f"structure {page}: {[k for k, v in checks.items() if not v]} small={small} unlabeled={p['unlabeled']} off={p['offscreen390']}/{p['offscreen320']} errors={p['errors']} h1={p['h1']}")
    lay.append((page, p, len(p['targets']), mn, ok))
# ---- print ----
pf = lambda ok: 'PASS' if ok else 'FAIL'
if MD:
    print(f'紙テクスチャ: 最暗 `{dark}` / 最明 `{light}`、輝度の幅 {spread:.2f}%（上限 7.5%）\n')
    print('### トークンのペア\n\n| テーマ | 前景 / 背景 | 比 | 紙の最暗部で | 種別（基準） | 用途 | 判定 |\n|---|---|---|---|---|---|---|')
    for t, fg, bg, r, tx, kind, need, where, ok in rows:
        aaa = ' AAA' if kind == 'text' and r >= 7 and (tx is None or tx >= 7) else ''
        print(f"| {t} | `{fg}` / `{bg}` | {r:.2f}:1 | {'%.2f:1' % tx if tx else '—'} | {kind} {need} | {where} | {pf(ok)}{aaa} |")
    print('\n### 画面で実測したペア（各画面の最小）\n\n| 画面 | テーマ | ペア数 | 通常文字の最小 | 大きな文字の最小 | UI（枠・アイコン・面）の最小 | 判定 |\n|---|---|---|---|---|---|---|')
    for page, s in summary.items():
        f = lambda k: '—' if s[k][0] == 99 else f'{s[k][0]:.2f}:1（{s[k][1]}）'
        ok = all(s[k][0] >= NEED[k] for k in NEED)
        print(f"| {page} | {s['theme']} | {s['n']} | {f('text')} | {f('large')} | {f('ui')} | {pf(ok)} |")
    print('\n### 構造\n\n| 画面 | 操作要素 | 最小辺 px | 予約カードの高さ px | タブバー | FAB | scrollWidth 390 / 320 | ラベルなし入力 | トースト role | 判定 |\n|---|---|---|---|---|---|---|---|---|---|')
    for page, p, n, mn, ok in lay:
        tb = f"{p['tabbar']['ul']}＋{p['tabbar']['padBottom']:.0f}" if p['tabbar'] else '—'
        print(f"| {page} | {n} | {mn} | {', '.join(map(str, p['cards'])) or '—'} | {tb} | {', '.join(map(str, p['fabs'])) or '—'} | {p['scrollWidth390']} / {p['scrollWidth320']} | {len(p['unlabeled'])} | {', '.join(t['role'] or '-' for t in p['toasts']) or '—'} | {pf(ok)} |")
else:
    print(f'texture darkest {dark} lightest {light} spread {spread:.2f}%')
    for row in rows: print(row[0], row[1], row[2], f'{row[3]:.2f}', f'{row[4]:.2f}' if row[4] else '-', row[5], pf(row[8]), row[7])
    for page, s in summary.items(): print(page, s['theme'], s['n'], *(f"{k}={s[k][0]:.2f} {s[k][1]}" for k in NEED))
    for page, p, n, mn, ok in lay: print(page, n, mn, p['cards'], pf(ok))
print('\n' + ('ALL PASS' if not fails else '\n'.join(fails)), file=sys.stderr)
sys.exit(1 if fails else 0)
