"""WCAG 2.x contrast check for every text/background and UI pair used in style tiles A/B/C.
Usage: python3 contrast_check.py [--md]   (exit 1 if any pair fails)"""
import re, sys, pathlib
DIR = pathlib.Path('/home/user/barber-booking/docs/05_design_comps/style_tiles')
def lum(h):
    h = h.lstrip('#'); rgb = [int(h[i:i+2], 16) / 255 for i in (0, 2, 4)]
    f = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = map(f, rgb); return 0.2126*r + 0.7152*g + 0.0722*b
def ratio(a, b):
    hi, lo = sorted((lum(a), lum(b)), reverse=True); return (hi + 0.05) / (lo + 0.05)
NEED = {'text': 4.5, 'large': 3.0, 'ui': 3.0}
A_DIS = '#655b52'   # ink-45 (was #6b6158: 4.46 on paper-90 -> fixed)
TILES = {
 'A_heritage_paper': [
  ('#191919', '#f4ecdd', 'text', '本文・見出し / 紙'),
  ('#191919', '#fbf7ef', 'text', '本文 / カード'),
  ('#191919', '#e9dcc3', 'text', '注記 / 沈み面'),
  ('#5c5046', '#f4ecdd', 'text', '補助文字 / 紙'),
  ('#5c5046', '#fbf7ef', 'text', '補助文字 / カード'),
  ('#7c0000', '#f4ecdd', 'text', 'セクション番号・電話リンク / 紙'),
  ('#7c0000', '#fbf7ef', 'text', 'CONFIRMED スタンプ / カード'),
  ('#f4ecdd', '#7c0000', 'text', 'CTA・選択中の文字'),
  ('#0f5f8f', '#fbf7ef', 'text', '◎ 空き / 時刻ボタン'),
  ('#0f5f8f', '#f4ecdd', 'text', '凡例 ◎ / 紙'),
  (A_DIS,     '#e9dcc3', 'text', '× 満席の時刻 / 沈み面'),
  (A_DIS,     '#f4ecdd', 'text', '定休日・凡例 × / 紙'),
  ('#0f5f8f', '#fbf7ef', 'ui',   '空き枠ボタンの枠線'),
  ('#191919', '#f4ecdd', 'ui',   'セカンダリボタン枠線'),
  ('#0f5f8f', '#f4ecdd', 'ui',   'フォーカスリング'),
  ('#7c0000', '#f4ecdd', 'ui',   'CTA コンテナ'),
 ],
 'B_modern_barber': [
  ('#191919', '#faf7f2', 'text', '本文・見出し / 背景'),
  ('#191919', '#ffffff', 'text', '本文 / カード'),
  ('#191919', '#f0ece5', 'text', '60分ピル・コピー / 沈み面'),
  ('#5e5852', '#faf7f2', 'text', '補助文字 / 背景'),
  ('#5e5852', '#ffffff', 'text', '補助文字 / カード'),
  ('#ffffff', '#7c0000', 'text', 'CTA・選択中の文字'),
  ('#0f5f8f', '#ffffff', 'text', '◎ 空き・完了ラベル / カード'),
  ('#0f5f8f', '#faf7f2', 'text', '凡例 ◎ / 背景'),
  ('#666058', '#f0ece5', 'text', '× 満席の時刻 / 沈み面'),
  ('#666058', '#faf7f2', 'text', '定休日・凡例 × / 背景'),
  ('#0f5f8f', '#ffffff', 'ui',   '空き枠ボタンの枠線'),
  ('#191919', '#faf7f2', 'ui',   'セカンダリボタン・矢印枠線'),
  ('#0f5f8f', '#faf7f2', 'ui',   'フォーカスリング'),
  ('#7c0000', '#faf7f2', 'ui',   'CTA コンテナ'),
 ],
 'C_night_chair': [
  ('#f4ecdd', '#191919', 'text', '本文・見出し / 背景'),
  ('#f4ecdd', '#241e1a', 'text', '本文 / カード'),
  ('#f4ecdd', '#2b2926', 'text', '本文 / 沈み面'),
  ('#b8b0a4', '#191919', 'text', '補助文字 / 背景'),
  ('#b8b0a4', '#241e1a', 'text', '補助文字 / カード'),
  ('#b8b0a4', '#2b2926', 'text', '日付補足 / 沈み面'),
  ('#b8875a', '#191919', 'text', 'セクションラベル（wood）/ 背景'),
  ('#b8875a', '#241e1a', 'text', '所要時間・ムード EN / カード'),
  ('#191919', '#d9777b', 'text', 'CTA・選択中の文字'),
  ('#e38b8b', '#191919', 'text', '電話リンク・H1 強調 / 背景'),
  ('#e38b8b', '#241e1a', 'text', '使用禁止ラベル / カード'),
  ('#7cc0e8', '#241e1a', 'text', '◎ 空き・完了ラベル / カード'),
  ('#7cc0e8', '#191919', 'text', '凡例 ◎ / 背景'),
  ('#9a948c', '#2b2926', 'text', '× 満席の時刻 / 沈み面'),
  ('#9a948c', '#191919', 'text', '定休日・凡例 × / 背景'),
  ('#7cc0e8', '#241e1a', 'ui',   '空き枠ボタンの枠線'),
  ('#f4ecdd', '#191919', 'ui',   'セカンダリボタン枠線'),
  ('#7cc0e8', '#191919', 'ui',   'フォーカスリング'),
  ('#d9777b', '#191919', 'ui',   'CTA コンテナ'),
  ('#7c0000', '#191919', 'ref',  '参考: #7c0000 を暗面に置いた場合（不使用）'),
 ],
}
fails = 0; md = '--md' in sys.argv
if md: print('| 案 | 前景 / 背景 | 比 | 種別（基準） | 用途 | 判定 |\n|---|---|---|---|---|---|')
for tile, pairs in TILES.items():
    html = (DIR / f'{tile}.html').read_text().lower()
    grouped = {}
    for fg, bg, kind, where in pairs:
        r = ratio(fg, bg); need = NEED.get(kind)
        for h in (fg, bg):
            if kind != 'ref' and h not in html: print(f'!! {tile}: {h} not found in HTML'); fails += 1
        ok = 'n/a' if need is None else ('PASS' if r >= need else 'FAIL')
        if ok == 'FAIL': fails += 1
        aaa = ' AAA' if kind == 'text' and r >= 7 else ''
        if not md: print(f'{tile[0]}  {fg} on {bg}  {r:5.2f}:1  {kind:5} need {need}  {ok}{aaa}  {where}')
        g = grouped.setdefault((fg, bg), {'r': r, 'kinds': [], 'where': [], 'ok': []})
        g['kinds'].append(f'{kind} {need}' if need else '参考'); g['where'].append(where); g['ok'].append(ok + aaa)
    if md:
        for (fg, bg), g in grouped.items():
            ok = 'FAIL' if 'FAIL' in g['ok'] else ('PASS AAA' if any('AAA' in o for o in g['ok']) else g['ok'][0])
            print(f"| {tile[0]} | `{fg}` / `{bg}` | {g['r']:.2f}:1 | {' + '.join(g['kinds'])} | {'；'.join(g['where'])} | {ok} |")
    # printed swatch numbers must equal computed values
    for fg, bg, txt in re.findall(r'data-fg="(#[0-9a-f]{6})" data-bg="(#[0-9a-f]{6})">([\d.]+):1', html):
        calc = f'{ratio(fg, bg):.2f}'
        if calc != txt: print(f'!! {tile}: swatch {fg}/{bg} prints {txt}, computed {calc}'); fails += 1
print(f'\n{"ALL PASS" if not fails else f"{fails} FAIL(S)"}', file=sys.stderr)
sys.exit(1 if fails else 0)
