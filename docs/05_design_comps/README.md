# 05 デザインカンプ

第 2 回打ち合わせで提示するデザイン方向案（スタイルタイル）と、その後のベースデザイン・展開カンプを置くフォルダ。

## ファイル

| ファイル | 内容 |
|---|---|
| `design_direction.md` | DESIGN-001 デザイン方向案 v0.1（3 案の説明、パレット、推奨、質問、コントラスト検証表） |
| `style_tiles/A_heritage_paper.html` / `.jpg` | A「ヘリテージ・ペーパー」: ベージュ紙 `#f4ecdd`＋えんじ `#7c0000`、ブランドに忠実 |
| `style_tiles/B_modern_barber.html` / `.jpg` | B「モダン・バーバー」: オフホワイト `#faf7f2`、余白と大見出し、テクスチャなし |
| `style_tiles/C_night_chair.html` / `.jpg` | C「ナイト・チェア」: チャコール `#191919`＋ベージュ文字＋明るいえんじ `#d9777b`（対比案。管理 PWA のダーク素材） |
| `style_tiles/compare_ABC.jpg` | 3 案の上部 1200px を横に並べた比較画像 |

## 仕様

- HTML は 390px 幅のモバイル用アートボード 1 枚。CSS はインライン、外部 JS なし、フォントは Google Fonts（Lato 400/700、Noto Sans JP 400/500/700）だけ読み込む。
- ロゴは `../../research/reference/neuer_logo.png` を相対パスで参照する（`style_tiles/` から開くこと）。
- JPEG は Playwright（viewport 390×844、deviceScaleFactor 2、fullPage、`document.fonts.ready` を待つ）で PNG に描画し、PIL で幅 780px・品質 85 に変換したもの。
- 各タイルに入れた部品（この順）: ロゴ配置 → カラー（hex と base に対するコントラスト比）→ 書体 → ボタン → メニューカード → 週ストリップと時刻ボタン（◎/×＋凡例）→ 完了カード → ムード。

## tools/

- `render.mjs` … Playwright で各 HTML を PNG に描画（390×844、フォント読込待ち）
- `build_images.py` … PNG を JPEG に縮小し `compare_ABC.jpg` を生成
- `contrast_check.py` … 全配色ペアの WCAG コントラスト比を検証（ALL PASS が合格）
