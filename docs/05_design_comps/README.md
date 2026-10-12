# 05 デザインカンプ

第 2 回打ち合わせで提示したデザイン方向案（スタイルタイル）と、その後のベースデザイン・展開カンプを置くフォルダ。

## 方向の決定

**2026-10-12、方向 A「ヘリテージ・ペーパー」を採用した。** B「モダン・バーバー」からセクション間の余白 48px、日付・時刻・料金の大きな Lato 数字、カード内の罫線を減らすこと、ヘッダーのワードマーク併記を取り入れる（DESIGN-001 §6 の「A＋B」）。C「ナイト・チェア」は顧客サイトには使わず、管理 PWA のダークテーマ（`tokens.css` の `[data-theme="dark"]`）の素材にする。決定内容と仕様は `design_guide.md`（DG-001）。

**ベース v0.2 承認待ち（2026-10-12）。** ベース v0.1 へのクライアント FB 3 件（最終。ほかは承認済み）を反映した: (1) トップを「ヘッダー → 写真 → メニュー」に簡素化し、メニュー直後に全幅の「空き時間を見て予約する」、受付時間はアクセスカード内に 2 行、(2) 日付選択を週ストリップから月カレンダー（月曜始まり、60 日先まで）に、(3) 電話対応なしのため顧客側の電話導線をすべて Instagram の DM（`@neuer.kento`）に。`tokens.css` と視覚言語は変更なし。WF も WF-C / WF-A v0.3 で同時に更新した。

**ベース v0.3（2026-10-12）。** 決定事項 G1〜G4 を反映した: (G1) 導線の 1 本化。トップの CTA はヘッダー・メニュー直後とも「予約する」→ `/ja/book`（① メニュー）。「空き時間を見て予約する」はメニュー段の CTA だけ。「全 9 メニューと料金を見る」を削除し、トップにメニューカード 9 枚（情報表示）を並べた、(G2) Instagram `@neuer.kento` 確定、(G3) 特商法の電話番号は請求時開示で確定、(G4) 月カレンダーの初期の選択日 = 今日（02_time は今日 10/10 を選択）。WF-C v0.4 も同時に更新した。

## ファイル

| ファイル | 内容 |
|---|---|
| `design_direction.md` | DESIGN-001 デザイン方向案 v0.1（3 案の説明、パレット、推奨、質問、コントラスト検証表） |
| `design_guide.md` | **DG-001 デザインガイド v0.3**（変更履歴、決定事項、トークン表、タイポグラフィ、スペーシング、コンポーネント仕様、画像・ロゴ、アクセシビリティ確認結果、モーション、展開カンプへの申し送り、WF v0.2 との差分、未決） |
| `tokens.css` | **3 層トークン**（プリミティブ → セマンティック＋ダーク → Tailwind v4 `@theme inline` への接続例）と紙テクスチャのユーティリティ `.paper`。トークン値の正本 |
| `base/01_top.html` / `.jpg` | ベースデザイン S-C-01 トップ /ja（390px、full page。ヘッダー → 写真 → メニュー 9 件 → 予約 CTA「予約する」→ アクセス → 対応言語 → Instagram → フッター）。`01_top_desktop.jpg` は 1280px 幅の表示確認 |
| `base/02_time.html` / `.jpg` | ベースデザイン S-C-03 ② 日時を選ぶ /ja 状態 (a)（月カレンダー、初期表示 = 今日 10/10 を選択。full page） |
| `base/03_done.html` / `.jpg` | ベースデザイン S-C-05 予約完了 /ja（390×844 にスクロールなしで収まる。実測 809px） |
| `base/base_contact_sheet.jpg` | 3 画面の上部 1200px を横に並べた一覧（1596px 幅） |
| `style_tiles/A_heritage_paper.html` / `.jpg` | A「ヘリテージ・ペーパー」: ベージュ紙 `#f4ecdd`＋えんじ `#7c0000`、ブランドに忠実（**採用**） |
| `style_tiles/B_modern_barber.html` / `.jpg` | B「モダン・バーバー」: オフホワイト `#faf7f2`、余白と大見出し、テクスチャなし（一部の要素を採用） |
| `style_tiles/C_night_chair.html` / `.jpg` | C「ナイト・チェア」: チャコール `#191919`＋ベージュ文字＋明るいえんじ `#d9777b`（管理 PWA のダーク素材） |
| `style_tiles/compare_ABC.jpg` | 3 案の上部 1200px を横に並べた比較画像 |

## 仕様

### ベースデザイン（`base/`）

- 各 HTML は実際の画面そのもの（アートボードの枠や注記なし）。`../tokens.css` と Google Fonts（Lato 400/700、Noto Sans JP variable）だけを読み込み、外部 JS なし。部品の CSS は各 HTML に書き、色・余白・角丸・時間はトークンだけを参照する。
- ロゴは `../../research/reference/neuer_logo.png` を相対パスで参照する（`base/` から開くこと）。CSS filter でチャコール単色にしている。
- 写真・地図は CSS で描いたプレースホルダー（写真素材の決定待ち）。料金は `¥—`（OI-01）。問い合わせは Instagram の DM（`@neuer.kento`、`https://ig.me/m/neuer.kento`）で、電話番号は載せない。
- JPEG は Playwright（viewport 390×844、deviceScaleFactor 3、`document.fonts.ready` を待ち、Lato と Noto Sans JP の読み込みを `document.fonts.check` と FontFace の状態で確認）で PNG に描画し、品質 88 で変換した。01・02 は full page、03 は viewport。
- 検証（すべて合格）: 全ての文字・枠線・アイコン・CTA の面のコントラスト（紙の上はテクスチャの最暗ピクセルで判定）、操作要素 44px 以上、390px と 320px で横スクロールなし、完了画面 ≤ 844px、`prefers-reduced-motion`、紙テクスチャの輝度の幅 ≤ 7.5%（実測 7.28%）。v0.3 で再検証（2026-10-12）: 文字の最小 4.88:1、操作要素 01/02/03 = 10/30/9 個すべて 44px 以上、完了画面 809px。結果は DG-001 §7。

### スタイルタイル（`style_tiles/`）

- HTML は 390px 幅のモバイル用アートボード 1 枚。CSS はインライン、外部 JS なし、フォントは Google Fonts（Lato 400/700、Noto Sans JP 400/500/700）だけ読み込む。
- JPEG は Playwright（viewport 390×844、deviceScaleFactor 2、fullPage、`document.fonts.ready` を待つ）で PNG に描画し、PIL で幅 780px・品質 85 に変換したもの。
- 各タイルに入れた部品（この順）: ロゴ配置 → カラー（hex と base に対するコントラスト比）→ 書体 → ボタン → メニューカード → 週ストリップと時刻ボタン（◎/×＋凡例）→ 完了カード → ムード。

## tools/

- `render.mjs` … スタイルタイルを PNG に描画（390×844 @2x、フォント読込待ち）
- `build_images.py` … タイルの PNG を JPEG に縮小し `compare_ABC.jpg` を生成
- `contrast_check.py` … タイルの全配色ペアの WCAG コントラスト比を検証（ALL PASS が合格）
- `render_base.mjs` … ベースデザインを描画し検証データを収集（390×844 @3x、320px のリフロー、reduced-motion、1280px のデスクトップ、全要素の色ペアと操作要素の寸法を `audit.json` に出力）
- `contrast_check_base.py` … `tokens.css` のペア（ライト・ダーク）と画面で実測したペアのコントラスト、ターゲット、横幅、完了画面の高さ、フォントを判定（`--md` で DG-001 §7 の表を出力、ALL PASS で終了コード 0）
- `build_base_images.py` … ベースデザインの PNG を JPEG（q88）にし `base_contact_sheet.jpg` を生成

再生成の手順は DG-001 の付録を参照。
