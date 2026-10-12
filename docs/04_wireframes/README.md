# 04_wireframes — ワイヤーフレーム

## 目的

顧客サイト（JP/EN）と管理 PWA の画面構造・情報の優先順位・振る舞いを、グレースケールのワイヤーフレーム（WF）で合意する。ブランド色・写真・最終文言は含めず、要件定義書の FR ID と対応づけた付箋（黄色の番号）で「押したらどうなるか」を示す。M3（WF 承認）を経て、設計書（`../03_design/`）とデザインカンプ（`../05_design_comps/`）の前提になる。

- アートボード: iPhone 390×844、8px グリッド、日本語フォント Noto Sans JP。
- 表記ルール、画面ごとの設計意図、未決事項は `customer_flow.md`（WF-C）と `admin_flow.md`（WF-A）に書く。

## ファイル構成

| パス | 内容 |
|---|---|
| `customer_flow.md` | WF-C v0.3。顧客サイトの画面一覧・画面フロー（Mermaid）・設計意図・検証結果・未決事項・変更履歴 |
| `admin_flow.md` | WF-A v0.3。管理 PWA の画面一覧・画面フロー・短くした 2 経路（2 タップブロック、DM → 手動予約 → 確認 URL）・設計意図・検証結果・未決事項・変更履歴 |
| `wf.css` | 共通キット（グレースケールのトークン、`.frame` 390×844、`.btn` `.slot` `.day` `.toggle` などの部品、付箋 `.note`、v0.2 で追加した要約 `.recap`、v0.3 で追加した月カレンダー `.monthnav` `.dow` `.mcal`） |
| `screens/*.html` | WF の原本。1 ファイル = 1 画面で、状態ごとのアートボードを横に並べる。付箋の説明はアートボードの下 |
| `screens/*.jpg` | 各 HTML の書き出し画像（Playwright・deviceScaleFactor 1.5、JPEG 品質 85、幅 1600px 以下） |
| `screens/customer_contact_sheet.jpg` | 顧客サイト全画面をフロー順に縦に並べた一覧（見出しバー付き） |
| `screens/admin_contact_sheet.jpg` | 管理 PWA 全画面を番号順に縦に並べた一覧 |
| `tools/render_customer.mjs` | 顧客 WF を PNG に描画し、レイアウト規則を検証する |
| `tools/build_jpg_customer.py` | 顧客 WF の PNG → JPEG 変換、PNG 削除、顧客コンタクトシート作成 |
| `tools/render_admin.mjs` | 管理 WF を PNG に描画・検証し、最後に後処理（`post_admin.py`）を呼ぶ |
| `tools/post_admin.py` | 管理 WF の PNG → JPEG 変換、PNG 削除、管理コンタクトシート作成 |

## 画面一覧

状態数 = HTML 内のアートボード数（v0.3: 顧客 32、管理 39。v0.2 は顧客 31）。

### 顧客サイト（WF-C）

予約の順序は「1 メニュー → 2 日時 → 3 お客様情報 → 4 確認」（OI-19 決定）。ファイル番号はフロー順。

| 画面 ID | 名称 | ルート | ファイル | 状態数 |
|---|---|---|---|---|
| S-C-01 | トップ（/ja・/en） | `/{locale}` | `screens/customer_01_top.html` | 2 |
| S-C-02 | 予約 1 メニューを選ぶ | `/{locale}/book` | `screens/customer_02_book_menu.html` | 2 |
| S-C-03 | 予約 2 日時を選ぶ | `/{locale}/book/time` | `screens/customer_03_time.html` | 7 |
| S-C-02b | 予約 3 お客様情報 | `/{locale}/book/info` | `screens/customer_04_book_info.html` | 5 |
| S-C-04 | 予約 4 確認 | `/{locale}/book/confirm` | `screens/customer_05_confirm.html` | 4 |
| S-C-05 | 予約完了（/ja・/en） | `/{locale}/book/done/{token}` | `screens/customer_06_done.html` | 2 |
| S-C-06 | キャンセル | `/{locale}/cancel/{token}` | `screens/customer_07_cancel.html` | 6 |
| S-C-08 / 09 / 10 | ポリシー（骨子）、404、エラー | `/{locale}/privacy` ほか | `screens/customer_08_policies_error.html` | 4 |

S-C-07（ICS）は Route Handler のため画面なし。v0.1 からの改名: `customer_02_book_info` → `customer_04_book_info`、`customer_04_confirm` → `customer_05_confirm`、`customer_05_done` → `customer_06_done`、`customer_06_cancel` → `customer_07_cancel`、`customer_07_policies_error` → `customer_08_policies_error`。

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

HTML を直したら、画像と検証結果を作り直す。スクリプトのパスは `import.meta.url`（Python は `__file__`）からの相対で解決するので、リポジトリをどこに置いてもそのまま動く。

### 必要なもの

- Node.js 22 と Playwright（Chromium）。`import('playwright')` を先に試し、見つからなければ `/opt/node-tools/node_modules/playwright/index.mjs` を読む。別の環境では `npm i -D playwright && npx playwright install chromium`。
- Python 3 と Pillow。
- 日本語フォント: 顧客 WF は Google Fonts の Noto Sans JP を読むためネット接続が必要。管理 WF は描画時に IPA ゴシックへのフォールバックを足す。`build_jpg_customer.py` は見出しに `/usr/share/fonts/truetype/fonts-japanese-gothic.ttf` を使う（無ければ既定フォント）。

### コマンド（リポジトリのルートで実行）

```bash
# 顧客: 描画・検証 → JPEG 化とコンタクトシート
node docs/04_wireframes/tools/render_customer.mjs            # 一部だけなら: ... render_customer.mjs customer_03_time
python3 -I docs/04_wireframes/tools/build_jpg_customer.py

# 管理: 描画・検証 → JPEG 化とコンタクトシート（後処理は render_admin.mjs が呼ぶ）
node docs/04_wireframes/tools/render_admin.mjs               # 一部だけなら: ... render_admin.mjs 06_time
```

- 部分描画のあと `build_jpg_customer.py` を実行すると、新しい PNG のない画面は既存の JPEG をコンタクトシートに使う（v0.1 では PNG が揃っていないと失敗した）。
- 検証結果は `tools/verify_report.json`（顧客）と `tools/verify.json`（管理）に書き出される。成果物ではないので、確認後に削除するか `.gitignore` に入れる。
- 中間の PNG は後処理で削除される。終了コードは検証に失敗があると 1。
- v0.1 の README にあった「実行前に必要な修正」（後処理のファイル名、絶対パス、Playwright の絶対パス、旧コマンド名のコメント）は v0.2 ですべて解消した。

## 検証項目

スクリプトが `page.evaluate` で自動検証する。結果は `customer_flow.md` 4 章・`admin_flow.md` 4 章に記録する。

| 項目 | 基準 | 対象 | v0.3 の結果（2026-10-12） | v0.2 | v0.1 |
|---|---|---|---|---|---|
| 横はみ出し | どの `.frame` も `scrollWidth <= clientWidth` | 顧客・管理 | 顧客 32 / 管理 39 フレームすべて OK | 31 / 39 OK | 27 / 39 OK |
| タップ領域 44px | 顧客 `.btn,.slot,.radio,.input,.day,.lang,.back` ≥ 44px（`.change` は ≥ 24px）／ 管理 `.btn,.slot,.radio,.input,.tab,.fab,.toggle,.item` ≥ 44px | 顧客・管理 | 顧客 430 / 管理 352 要素すべて OK（月カレンダーの日セルを含む） | 276 / 352 OK | 224 / 349 OK |
| × の行・日セル | `.slot.full`・`.day.off` がリンク・ボタン・`tabindex` 付きでない（v0.2 で追加。v0.3 は過去日・60 日先より後の日も対象） | 顧客 | すべて OK | OK | — |
| 予約カード 56px | `.booking` の高さ ≥ 56px（FR-A-02） | 管理 | 18 枚すべて OK（最小 56px） | 18 枚 OK | 18 枚 OK |
| 完了画面の高さ | S-C-05（`customer_06_done`）のフレームの自然な高さ ≤ 844px（FR-C-11、AT-01） | 顧客 | /ja 775px、/en 822px | 775px / 822px | 783px / 811px |
| ページエラー・フォント | `pageerror` なし、Noto Sans JP の読み込み（顧客） | 顧客・管理 | OK | OK | OK |

手作業で確かめること: 空き状況の記号が ◎・× の 2 つだけか、× に理由（定休 / 休業 / 満席 / 締切）が付いているか、色だけで状態を表していないか、付箋の FR ID が要件定義書と一致しているか。

## 評価

- 認知的ウォークスルー＋簡易ヒューリスティック評価: [`../06_test/evaluation/cognitive_walkthrough_wf.md`](../06_test/evaluation/cognitive_walkthrough_wf.md)（EVAL-001）。問題 33 件（重大度 3 が 3 件、2 が 14 件、1 が 16 件）。WF v0.2 での対応状況は同書の「v0.2 対応状況」に ID ごとにまとめた。

## 承認フロー

| 段階 | 内容 |
|---|---|
| 1. 送付 | WF v0.1（本フォルダ）と評価レポート EVAL-001 をクライアントへ送る。コンタクトシート 2 枚と各画面の画像で確認できるようにする |
| 2. 非同期レビュー | 回答期限 48〜72 時間（計画書 6.1・10 章）。期限を過ぎた日数分はマイルストーンを後ろ倒しにする（計画書 6.4）。認知的ウォークスルーの T2・T4 の手順表は長田様に辿ってもらう |
| 3. 修正 | **修正は 2 回まで**（v0.2、v0.3）。上限を超える修正と、要件の範囲を超える変更は変更要求（CR）として扱う（計画書 11 章）。**v0.2（2026-10-10）**: EVAL-001 の WF 修正と第 2 回打ち合わせの決定を反映済み（修正 1 回目）。**v0.3（2026-10-12）**: クライアント FB 3 件（トップの簡素化、日付選択の月カレンダー化、電話対応なし → Instagram の DM）を反映済み（修正 2 回目＝上限。以降の修正は CR） |
| 4. 承認 | **M3 WF 承認（目標 2026-10-31）**。承認後は WF を凍結し、`customer_flow.md`・`admin_flow.md` の版と日付を更新して変更履歴に記録する |

決定済み（2026-10-10、v0.2 に反映）: OI-19（予約ステップの順序 = メニュー → 日時 → お客様情報 → 確認）、OI-09（店名・住所の掲載可）、OI-11（Phase 1 は手動予約の意図的な重複なし）、OI-12（ログインのフォールバック = アプリ内のワンタイムコード）。決定済み（2026-10-12、v0.3 に反映）: 電話対応なし・問い合わせは Instagram の DM のみ（OI-10 の電話番号は不要に。仮ハンドル `@neuer.kento`）、日付選択は月カレンダー（月曜始まり、60 日先まで）、トップは「ヘッダー → 写真 → メニュー」。承認前に残る主な未決: OI-13（/en のふりがな）、OI-01 / 05 / 06（価格・締切・リードタイム）、Instagram ハンドルの確定と電話なしでの特商法表記、学生料金の対象（CW-06）、手動予約の保存直後の取り消し（CW-27）。
