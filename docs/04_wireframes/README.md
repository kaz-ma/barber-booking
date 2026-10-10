# 04_wireframes — ワイヤーフレーム

## 目的

顧客サイト（JP/EN）と管理 PWA の画面構造・情報の優先順位・振る舞いを、グレースケールのワイヤーフレーム（WF）で合意する。ブランド色・写真・最終文言は含めず、要件定義書の FR ID と対応づけた付箋（黄色の番号）で「押したらどうなるか」を示す。M3（WF 承認）を経て、設計書（`../03_design/`）とデザインカンプ（`../05_design_comps/`）の前提になる。

- アートボード: iPhone 390×844、8px グリッド、日本語フォント Noto Sans JP。
- 表記ルール、画面ごとの設計意図、未決事項は `customer_flow.md`（WF-C）と `admin_flow.md`（WF-A）に書く。

## ファイル構成

| パス | 内容 |
|---|---|
| `customer_flow.md` | WF-C v0.1。顧客サイトの画面一覧・画面フロー（Mermaid）・設計意図・検証結果・未決事項 |
| `admin_flow.md` | WF-A v0.1。管理 PWA の画面一覧・画面フロー・短くした 2 経路（2 タップブロック、DM → 手動予約 → 確認 URL）・設計意図・検証結果・未決事項 |
| `wf.css` | 共通キット（グレースケールのトークン、`.frame` 390×844、`.btn` `.slot` `.day` `.toggle` などの部品、付箋 `.note`） |
| `screens/*.html` | WF の原本。1 ファイル = 1 画面で、状態ごとのアートボードを横に並べる。付箋の説明はアートボードの下 |
| `screens/*.jpg` | 各 HTML の書き出し画像（Playwright・deviceScaleFactor 1.5、JPEG 品質 85、幅 1600px 以下） |
| `screens/customer_contact_sheet.jpg` | 顧客サイト全画面をフロー順に縦に並べた一覧（見出しバー付き） |
| `screens/admin_contact_sheet.jpg` | 管理 PWA 全画面を番号順に縦に並べた一覧 |
| `tools/render_customer.mjs` | 顧客 WF を PNG に描画し、レイアウト規則を検証する |
| `tools/build_jpg_customer.py` | 顧客 WF の PNG → JPEG 変換、PNG 削除、顧客コンタクトシート作成 |
| `tools/render_admin.mjs` | 管理 WF を PNG に描画・検証し、最後に後処理（Python）を呼ぶ |
| `tools/post_admin.py` | 管理 WF の PNG → JPEG 変換、PNG 削除、管理コンタクトシート作成 |

## 画面一覧

状態数 = HTML 内のアートボード数（顧客 27、管理 39）。

### 顧客サイト（WF-C）

| 画面 ID | 名称 | ファイル | 状態数 |
|---|---|---|---|
| S-C-01 | トップ（/ja・/en） | `screens/customer_01_top.html` | 2 |
| S-C-02 | 予約 1 メニューを選ぶ | `screens/customer_02_book_menu.html` | 2 |
| S-C-02 | 予約 2 お客様情報 | `screens/customer_02_book_info.html` | 5 |
| S-C-03 | 予約 3 日時を選ぶ | `screens/customer_03_time.html` | 4 |
| S-C-04 | 予約 4 確認 | `screens/customer_04_confirm.html` | 3 |
| S-C-05 | 予約完了（/ja・/en） | `screens/customer_05_done.html` | 2 |
| S-C-06 | キャンセル | `screens/customer_06_cancel.html` | 5 |
| S-C-08 / 09 / 10 | ポリシー（骨子）、404、エラー | `screens/customer_07_policies_error.html` | 4 |

S-C-07（ICS）は Route Handler のため画面なし。

### 管理 PWA（WF-A）

| 画面 ID | 名称 | ファイル | 状態数 |
|---|---|---|---|
| S-A-01 / S-A-12 | ログイン、インストール案内 | `screens/admin_01_login_install.html` | 4 |
| S-A-02 | 今日 | `screens/admin_02_today.html` | 4 |
| S-A-03 | 週 | `screens/admin_03_week.html` | 3 |
| S-A-04 | 予約詳細 | `screens/admin_04_booking_detail.html` | 2 |
| S-A-05 | 手動予約 | `screens/admin_05_manual_booking.html` | 4 |
| S-A-06 | 時間ブロック | `screens/admin_06_time_block.html` | 6 |
| S-A-07 | 受信箱 | `screens/admin_07_inbox.html` | 3 |
| S-A-08 / S-A-09 | 営業時間・休業日、メニュー | `screens/admin_08_settings_hours_menus.html` | 5 |
| S-A-10 | 通知・端末 | `screens/admin_09_settings_notifications.html` | 4 |
| S-A-11 | 顧客一覧・詳細（Should） | `screens/admin_10_customers.html` | 4 |

## 再レンダリング手順

HTML を直したら、画像と検証結果を作り直す。スクリプトは作業用の場所で書かれたため、パスが絶対パスで埋め込まれている。

### 必要なもの

- Node.js 22 と Playwright（Chromium）。スクリプトは `/opt/node-tools/node_modules/playwright/index.mjs` から読み込む。
- Python 3 と Pillow。
- 日本語フォント: 顧客 WF は Google Fonts の Noto Sans JP を読むためネット接続が必要。管理 WF は描画時に IPA ゴシックへのフォールバックを足す。`build_jpg_customer.py` は見出しに `/usr/share/fonts/truetype/fonts-japanese-gothic.ttf` を使う。

### コマンド（`docs/04_wireframes/` で実行）

```bash
cd /home/user/barber-booking/docs/04_wireframes

# 顧客: 描画・検証 → JPEG 化とコンタクトシート
node tools/render_customer.mjs                 # 一部だけなら: node tools/render_customer.mjs customer_03_time
python3 -I tools/build_jpg_customer.py

# 管理: 描画・検証 → JPEG 化とコンタクトシート（後処理は render_admin.mjs が呼ぶ）
node tools/render_admin.mjs                    # 一部だけなら: node tools/render_admin.mjs 06_time
```

### 実行前に必要な修正

| # | ファイル | 現状 | 必要な修正 |
|---|---|---|---|
| 1 | `tools/render_admin.mjs` 61 行目 | 後処理として `./post.py` を呼ぶが、ファイル名は `post_admin.py`。このままでは PNG を書き出した後に Python が失敗し、JPEG 化されない | `new URL('./post.py', import.meta.url)` を `new URL('./post_admin.py', import.meta.url)` に直す。直さずに済ませる場合は、手動で `python3 -I tools/post_admin.py "$PWD/screens"` を実行する |
| 2 | `tools/build_jpg_customer.py` | 画像の PNG がすべて揃っている前提（8 画面を順に開く）。`render_customer.mjs` を一部の画面だけで実行すると、PNG のない画面で失敗する | 部分描画の後は、残りの画面も描画してから実行する（または全画面で描画する） |
| 3 | 3 スクリプト共通 | `DIR = '/home/user/barber-booking/docs/04_wireframes/screens'`（絶対パス）。現在のリポジトリの場所では修正不要 | リポジトリを別の場所に置く場合は、`.mjs` を `fileURLToPath(new URL('../screens', import.meta.url))`、`build_jpg_customer.py` を `pathlib.Path(__file__).resolve().parent.parent / 'screens'` に直す |
| 4 | `render_customer.mjs`・`render_admin.mjs` 3 行目 | Playwright を `/opt/node-tools/...` から絶対パスで読む | 別の環境では `npm i -D playwright && npx playwright install chromium` のうえ、`import { chromium } from 'playwright';` に直す |
| 5 | 使い方のコメント | 両 `.mjs` の冒頭コメントが旧名 `node render.mjs` のまま | 実害はない。直すときは上のコマンドに合わせる |

- 検証結果は `tools/verify_report.json`（顧客）と `tools/verify.json`（管理）に書き出される。成果物ではないので、確認後に削除するか `.gitignore` に入れる。
- 中間の PNG は後処理で削除される。終了コードは検証に失敗があると 1。

## 検証項目

スクリプトが `page.evaluate` で自動検証する。結果は `customer_flow.md` 4 章・`admin_flow.md` 4 章に記録する。

| 項目 | 基準 | 対象 | v0.1 の結果 |
|---|---|---|---|
| 横はみ出し | どの `.frame` も `scrollWidth <= clientWidth` | 顧客・管理 | 顧客 27 / 管理 39 フレームすべて OK |
| タップ領域 44px | 顧客 `.btn,.slot,.radio,.input,.day,.lang,.back` ≥ 44px（`.change` は ≥ 24px）／ 管理 `.btn,.slot,.radio,.input,.tab,.fab,.toggle,.item` ≥ 44px | 顧客・管理 | 顧客 224 / 管理 349 要素すべて OK |
| 予約カード 56px | `.booking` の高さ ≥ 56px（FR-A-02） | 管理 | 18 枚すべて OK（最小 56px） |
| 完了画面の高さ | S-C-05 のフレームの自然な高さ ≤ 844px（FR-C-11、AT-01） | 顧客 | /ja 783px、/en 811px |
| ページエラー・フォント | `pageerror` なし（管理）、Noto Sans JP の読み込み（顧客） | 顧客・管理 | OK |

手作業で確かめること: 空き状況の記号が ◎・× の 2 つだけか、色だけで状態を表していないか、付箋の FR ID が要件定義書と一致しているか。

## 評価

- 認知的ウォークスルー＋簡易ヒューリスティック評価: [`../06_test/evaluation/cognitive_walkthrough_wf.md`](../06_test/evaluation/cognitive_walkthrough_wf.md)（EVAL-001 v0.1）。問題 33 件（重大度 3 が 3 件、2 が 14 件、1 が 16 件）、うち WF v0.2 で直すもの 17 件。

## 承認フロー

| 段階 | 内容 |
|---|---|
| 1. 送付 | WF v0.1（本フォルダ）と評価レポート EVAL-001 をクライアントへ送る。コンタクトシート 2 枚と各画面の画像で確認できるようにする |
| 2. 非同期レビュー | 回答期限 48〜72 時間（計画書 6.1・10 章）。期限を過ぎた日数分はマイルストーンを後ろ倒しにする（計画書 6.4）。認知的ウォークスルーの T2・T4 の手順表は長田様に辿ってもらう |
| 3. 修正 | **修正は 2 回まで**（v0.2、v0.3）。上限を超える修正と、要件の範囲を超える変更は変更要求（CR）として扱う（計画書 11 章） |
| 4. 承認 | **M3 WF 承認（目標 2026-10-31）**。承認後は WF を凍結し、`customer_flow.md`・`admin_flow.md` の版と日付を更新して変更履歴に記録する |

承認前に第 2 回打ち合わせ（M2）で決めること: OI-19（予約ステップの順序）、OI-09（住所掲載）、OI-11（意図的な重複）、OI-12（ログインのフォールバック）、OI-13（/en のふりがな）。どれも WF の一部画面の差し替えで済むよう作図してある。
