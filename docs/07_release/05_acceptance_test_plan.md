# 05 受入テスト計画（AT-01〜AT-31）

## 文書情報

| 項目 | 内容 |
|---|---|
| 文書 ID | REL-005 |
| 版 | v0.1 |
| 日付 | 2026-10-12 |
| 対象 | 開発者（実施・記録）、クライアント（実機での確認・合否判定） |
| 関連要件 | 要件定義書 15 章（AT-01〜AT-31、AT-14b）、NFR-EN-03・04 |
| 実施時期 | M5（2026-11-21、staging 中間デモで開始）〜 M6（2026-12-04、検収合格）。検収期間 14 日 |

表記: 【クライアント】= クライアントの端末・判断が要る項目。【要実機確認】= 自動テストでは確かめられず、実機でしか判定できない項目。

---

## 1. 進め方

| 層 | 何で確かめるか | いつ | 合否の記録先 |
|---|---|---|---|
| 自動（単体・コンポーネント・DB 統合） | `npm test`（Vitest。DB テストは実 Postgres） | 毎 PR（CI）・M5/M6 の開始時 | CI の実行 URL を §4 に記入 |
| E2E | `node test/e2e/run.mjs`（Playwright ライブラリ、ローカルビルド＋専用 DB `barber_e2e`、6 シナリオ） | M5/M6 の開始時 | 出力の `n/n scenarios passed` とスクリーンショット（`test-results/e2e`） |
| 手動（実機） | 下表の手順。staging（Vercel Authentication。管理 PWA の実機確認は REL-001 §7.4 の例外を設定）と本番公開前の本番 URL | M5〜M6 | §4 の表 |

端末:

| ID | 端末 | OS / ブラウザ | 所有 | 用途 |
|---|---|---|---|---|
| D-iOS-C | クライアントの iPhone | iOS 26（推奨）【クライアント: 機種・版】 | クライアント | 管理 PWA（AT-11〜19, 21〜23）、AT-01 |
| D-iOS-17 | 検証用 iPhone | iOS 17.x | 開発者【要確認: 用意できるか】 | 顧客サイト（NFR-EN-03 下限）、管理 PWA の下限確認 |
| D-And | 開発者の Android | Chrome 最新 | 開発者 | AT-20、顧客サイト |
| D-PC | PC | Chrome / Safari / Edge / Firefox 最新 | 開発者 | AT-03, 24〜27 |

前提データ（staging）: 全 9 メニュー公開（架空価格、学生価格あり）、営業時間は確定値、臨時休業 1 日、ブロック 1 件、既存予約 2 件。

---

## 2. 対応表

「自動」はテストファイル（`src/` からの相対パス）とテスト名の要点。「E2E」は `test/e2e/run.mjs` のシナリオ名。「手動」は §3 の手順番号。

### 2.1 予約フロー（顧客）

| AT | 内容 | 自動 | E2E | 手動 | 端末 |
|---|---|---|---|---|---|
| AT-01 | `/ja` で新規予約完了（iPhone） | `features/booking/booking.db.test.ts`「creates customer, booking, two consents and an audit row」、`features/booking/ics.test.ts` | JA full flow（menu → time → info → confirm → done → ics → cancel）、done page ≤ 844px | M-01 | D-iOS-C, D-iOS-17 |
| AT-02 | `/en` で予約（`+44…`） | `features/booking/schema.test.ts`「requires kana on /ja but not on /en」、`features/booking/validate.test.ts`「does not require furigana on /en」、`features/availability/components/slot-list.test.tsx`「JST times in 12-hour format on /en」、`lib/i18n/messages.test.ts`（ja/en のキー一致）、`domain/phone.test.ts` | EN flow: no furigana, JST, English only | M-02 | D-iOS-17, D-And |
| AT-03 | 同一枠の同時送信 | `booking.db.test.ts`「race: two concurrent submissions … exactly one succeeds」「race at the DB level … 23P01」、`availability.db.test.ts`「has the bookings_no_overlap exclusion constraint」 | — | M-03 | D-PC ×2 |
| AT-04 | 空き枠表示の正しさ | `features/availability/availability.db.test.ts`（営業時間境界、月曜定休、臨時休業、締切、61 日目、ブロック、半開区間、キャンセル済み）、`month-calendar.test.tsx`、`slot-list.test.tsx`（× 行は非リンク・理由付き、24:00 表記） | Keyboard-only month calendar | M-04 | D-iOS-C, D-PC |
| AT-05 | 学割 | `booking.db.test.ts`「creates customer, booking …」（学生で予約すると `price_jpy` が学生価格・`is_student = true` で保存される）。画面表示は自動テストなし | — | M-05 | D-iOS-17 |
| AT-06 | 入力検証（GOV.UK 形式） | `validate.test.ts`「returns the GOV.UK-style keys per field」、`schema.test.ts`、`booking.db.test.ts`「validation errors are returned as message keys」、`domain/kana.test.ts`、`domain/phone.test.ts` | — | M-06 | D-iOS-17 |
| AT-07 | セルフキャンセル | `booking.db.test.ts` cancelBooking（締切前・締切後 past_deadline・無効トークン・生トークン非保存・終了 24 時間後に非表示） | JA full flow（cancel dialog → cancelled → invalid link） | M-07 | D-iOS-C + D-iOS-17 |
| AT-08 | Bot 対策 | `booking.db.test.ts`「honeypot: pretends success and stores nothing」「rate limit: 6th attempt from one IP」「4th booking for the same phone」。Turnstile は自動テストなし（テストでは秘密鍵未設定で検証を省略） | — | M-08 | D-PC |
| AT-09 | ステップ順序・段階開示・戻る | `validate.test.ts`「finds the first stage that still needs input」 | JA full flow | M-09 | D-iOS-17 |
| AT-10 | 320px 幅 | — | 320px: no horizontal overflow, 44px targets | M-10（E2E の結果確認のみ） | D-PC |

### 2.2 管理 PWA

| AT | 内容 | 自動 | E2E | 手動 | 端末 |
|---|---|---|---|---|---|
| AT-11 | Safari タブで「ホーム画面に追加」案内 | — | — | M-11 | D-iOS-C |
| AT-12 | ホーム画面に追加 → standalone | — | — | M-12 | D-iOS-C |
| AT-13 | パスキー／6 桁コードでログイン → 通知オン | `features/admin/otp.db.test.ts`（コード送信・誤り・期限切れ・5 回失敗・レート制限）、`admin.db.test.ts`「upserts by endpoint」 | — | M-13 | D-iOS-C |
| AT-14 | テスト通知（閉・開・ロック）と遷移 | `lib/push.db.test.ts`「sends the declarative payload with no name or phone, badge = unread count」「deletes 404/410 subscriptions」 | — | M-14 | D-iOS-C |
| AT-14b | iOS 設定で通知 OFF → 案内 | — | — | M-14b | D-iOS-C |
| AT-15 | 顧客予約 → 10 秒以内に通知、バッジ | `push.db.test.ts` notifyOwner、`admin.db.test.ts`「counts unread web bookings and customer cancellations」 | — | M-15 | D-iOS-C + D-And（予約側） |
| AT-16 | 端末再起動後、非起動で通知 | — | — | M-16 | D-iOS-C |
| AT-17 | 1 週間後に起動（購読・ログイン維持、下書き） | — | — | M-17 | D-iOS-C |
| AT-18 | 機内モードで起動（Should） | — | — | M-18 | D-iOS-C |
| AT-19 | この端末以外をログアウト（Should） | `admin.db.test.ts`「logoutOtherDevices revokes other sessions and their subscriptions」 | — | M-19 | D-iOS-C + D-And |
| AT-20 | Android Chrome（インストール・通知・置換） | `push.db.test.ts`（`topic` 付き送信） | — | M-20 | D-And |
| AT-21 | 手動予約・ブロック | `admin.db.test.ts` createManualBooking（重なりは保存されない・接する範囲は可・既存顧客の紐付け）、time blocks（顧客の空きから消える・予約と重なる場合は force のみ・プリセット・Undo の時間内のみ） | — | M-21 | D-iOS-C |
| AT-22 | 設定変更の即時反映 | `availability.db.test.ts`「closed override wins over the weekly template」（反映後の計算）。キャッシュ無効化（`updateTag`）は自動テストなし | — | M-22 | D-iOS-C + D-PC |
| AT-23 | 日次サマリー（21 時台） | `features/notifications/digest.db.test.ts`（Bearer なし拒否、JST 1 日 1 回、件数と最初・最後の開始、氏名なし、0 件の日・定休日） | — | M-23 | D-iOS-C |

### 2.3 非機能・運用

| AT | 内容 | 自動 | E2E | 手動 | 端末 |
|---|---|---|---|---|---|
| AT-24 | Lighthouse（モバイル） | —（CI 未組み込み: NFR-OP-07 の残課題） | — | M-24 | D-PC |
| AT-25 | axe（WCAG 2.2 AA） | —（同上） | 320px（44px ターゲットのみ） | M-25 | D-PC |
| AT-26 | セキュリティヘッダー・CSP 違反 0 | — | — | M-26（REL-002 E 群） | D-PC |
| AT-27 | 直接 POST の拒否 | `booking.db.test.ts`「re-check rejects times that are not offered: outside hours, lead time, closed day」、`digest.db.test.ts`「rejects a missing or wrong bearer token」 | — | M-27 | D-PC |
| AT-28 | バックアップ復元リハーサル | `.github/workflows/backup.yml`（ダンプが読めること・`bookings_no_overlap` を含むことをジョブ内で検査） | — | M-28（REL-001 §9.2） | D-PC |
| AT-29 | ドメイン非依存（`SITE_URL` 変更） | — | — | M-29 | D-PC, D-iOS-17 |
| AT-30 | 匿名化（Should） | `admin.db.test.ts`「anonymizeCustomer removes PII, cancels future bookings, keeps statistics; wrong last 4 digits is refused」、`digest.db.test.ts` runRetention | — | M-30 | D-iOS-C |
| AT-31 | 運用マニュアル（日英・スクリーンショット）とレクチャー | — | — | M-31 | — |

---

## 3. 手動テスト手順

各手順の「期待結果」をすべて満たせば合格。iOS / Android で結果が違う場合は両方を記録する。

### 予約フロー

| # | 手順 | 期待結果 |
|---|---|---|
| M-01 | 1. iPhone の Safari で `/ja` → 「予約する」。2. メニューを選ぶ → 日付 → 時間 → お客様情報（氏名・ふりがな・携帯番号・同意）→ 確認 → 確定。3. 完了画面で「カレンダーに追加」→ iOS カレンダーに取り込む。4. 1〜3 を全 9 メニューで行う（staging） | 全メニューで完了。完了画面が縦スクロールなしで 1 画面（390×844 相当）。ICS に前日と 1 時間前の通知、場所に店名＋住所、説明欄にキャンセル URL |
| M-02 | 1. 英語設定の iPhone / Android で `/en` → 予約。2. 電話番号に `+44 7700 900123` | 全画面が英語（日本語の取り残しなし。固有名詞のみ `lang="ja"`）、時刻に JST 表記、ふりがな欄なし、完了画面に店名・住所（地図リンク）・キャンセルリンク（共有・コピー）が 1 画面 |
| M-03 | 1. PC で 2 つのブラウザ（または通常＋シークレット）で同じ枠の確認画面まで進む。2. 2 つの「確定」をほぼ同時に押す | 片方だけ完了。もう片方に「その枠はたった今埋まりました」と時間枠の再表示 |
| M-04 | 1. staging で臨時休業・ブロック・既存予約・締切内の時刻を用意。2. `/ja/book/time` の月カレンダーと時間枠を確認。3. 日をタップ | 月曜は「× 定休」、過去日と 61 日目以降は非活性、ブロック・予約・締切内の枠は × の非活性行（理由ラベル付き、フォーカスが当たらない）、閉店をまたぐ枠は出ない、タップで時間枠リストが更新 |
| M-05 | 1. 学生価格のあるメニューで「学生」を選んで予約 | 確認画面・完了画面・管理 PWA の予約詳細が学生価格（「（学生価格）」表記） |
| M-06 | 1. 無効な電話番号、ふりがな空欄、同意未チェックでそれぞれ進もうとする | 進めない。エラー文が「〜を入力してください（例: …）」の形式で、該当欄にフォーカス |
| M-07 | 1. 締切前の予約の完了画面からキャンセルリンク → キャンセル。2. 同じリンクを再度開く。3. 締切後の予約のリンクを開く（staging で締切を一時的に長くして作る）。4. `curl` で無効トークンの URL を 11 回/分 | 1: キャンセル完了、管理 PWA に通知、枠が空きに戻る。2: 「この予約は見つかりません」。3: Instagram DM の案内のみ、`tel:` リンクなし。4: 11 回目が 429 |
| M-08 | 1. DevTools で Turnstile のトークンを消して確定を送る（または同じトークンで 2 回送る）。2. ハニーポット欄（`website`）に値を入れて送る。3. 同じ IP から 10 分で 6 回確定する | 1: 拒否（Instagram DM の案内）。2: 完了画面風に見えるが DB に予約が残らない。3: 6 回目が拒否 |
| M-09 | 1. メニュー → 日時 → お客様情報と進み、上部の要約と「変更」を確認。2. 入力途中でブラウザの「戻る」→「進む」。3. 要約をタップして日時を変える | 順序どおり。後続の項目は初期非表示。戻っても入力が消えない。要約から再編集できる |
| M-10 | E2E「320px」の結果とスクリーンショットを確認。iPhone SE 相当（320px）で主要画面を目視 | 横スクロールなし、タップ領域 44px 以上 |

### 管理 PWA（D-iOS-C。staging または公開前の本番）

| # | 手順 | 期待結果 |
|---|---|---|
| M-11 | Safari のタブで `/admin` を開く | 通知ボタンは出ず「ホーム画面に追加してください」の案内 |
| M-12 | 共有 → ホーム画面に追加 → アイコンから起動 | URL バーのない standalone 表示 |
| M-13 | 1. 「メールのコードでログイン」→ 6 桁コード入力。2. パスキー登録 → ログアウト → 「Face ID でログイン」。3. 「通知をオンにする」→ 許可 | 1: Safari に切り替わらずログイン。2: Face ID でログイン。3: 「この端末で通知を受け取ります」、DB の `push_subscriptions` に 1 行（開発者が確認） |
| M-14 | 「テスト通知を送る」を (a) アプリ前面 (b) アプリを閉じた状態（完全終了）(c) バックグラウンド・スリープ後 (d) ロック画面 で行い、通知をタップ | すべて届き、タップで該当画面が開く。`app_badge` の反映（アイコンのバッジ）を記録。届かない場合は「届かない」→「購読を作り直す」で復帰できる |
| M-14b | iOS「設定 > 通知 > 予約管理」で通知を OFF → アプリを再起動 | 「この端末の通知がオフになっています」と「設定 > 通知」への案内 |
| M-15 | Android（または PC）から顧客サイトで予約 → iPhone の通知を待つ（ストップウォッチ） | **10 秒以内**に通知、受信箱の未確認 +1・アイコンのバッジ、アプリを開いて行を開くと解消 |
| M-16 | iPhone を再起動し、アプリを開かずに予約を入れる | 通知が届く |
| M-17 | 1 週間アプリを開かずに置いてから起動。手動予約の入力途中でホームに戻り、時間をおいて戻る | 購読が有効（テスト通知が届く）か再購読バナー。ログインが維持。手動予約の下書きが残る |
| M-18 | 機内モードにしてアプリを起動 | 今日の一覧がキャッシュから表示され「オフラインです」のバナー |
| M-19 | Android でもログインしておく → iPhone で「この端末以外をログアウト」→ 確認 | Android のセッションが切れ、Android の購読が削除される（テスト通知が届かない） |
| M-20 | Android Chrome で `/admin` → インストール → ログイン → 通知オン → 同じ予約の通知が 2 回続けて来る状況を作る（予約 → キャンセル） | インストールプロンプト、通知受信、`topic` により未配信の通知が置き換わる |
| M-21 | 1. 既存予約と重なる時刻で手動予約。2. 「今から 1 時間」を 2 タップでブロック（予約と重なる場合はタップ前にシートに表示）。3. 「今から 2 時間」または「今日はここまで」→ 顧客サイトで開始が 60 分以上先の枠を確認。4. ブロック直後に「取り消す」 | 1: 保存できない（「それでも保存」はない）、近い空き時間の表示。2: 2 タップで完了。3: 該当枠が ◎ から × に変わる。4: 5 秒以内なら戻る |
| M-22 | 定休日の変更、臨時休業の追加、メニューの所要時間変更を保存 → PC で顧客サイトを再読み込み | すぐに反映（月カレンダー・時間枠・トップのメニュー表示） |
| M-23 | 予約がある日の前日に何もせず待つ | 21:00〜21:59 に「明日の予約 n 件」（Hobby は ±59 分。Pro 移行後は ±1 分）。氏名・電話番号は含まれない |

### 非機能・運用

| # | 手順 | 期待結果 |
|---|---|---|
| M-24 | Chrome DevTools → Lighthouse（Mobile）でトップと `/ja/book`。3 回測って中央値 | performance ≥ 90、accessibility = 100、LCP ≤ 2.5 s、CLS ≤ 0.1 |
| M-25 | axe DevTools でトップ・予約 4 ステップ・完了・キャンセル・ポリシー・`/en`・管理 PWA 主要画面 | 重大（critical）・深刻（serious）の違反 0 |
| M-26 | REL-002 の E1〜E5 | ヘッダーが全ページで返る。CSP 違反 0 |
| M-27 | 1. Cookie なしで `curl -X POST` により管理 Server Action を呼ぶ（Next-Action ヘッダは管理画面の通信から取得）。2. 営業時間外の `startsAt` で予約の確定を送る | 1: 拒否（unauthorized）。2: 拒否（枠の再検証） |
| M-28 | REL-001 §9.2 で前日のダンプを一時 DB に復元 | 復元でき、`bookings_no_overlap` と件数が一致。所要時間を記録 |
| M-29 | staging の `SITE_URL` を別のホスト（例: staging に追加した別の `*.vercel.app`）に変えて Redeploy → 変更前に作った予約の確認 URL のパスを新しいホストで開く | 新しいホストで予約内容とキャンセルが表示される（ICS の URL も新ホスト）。確認後に元へ戻す |
| M-30 | 管理 PWA「設定 > 顧客」→ テスト顧客 →「匿名化する」（下 4 桁を誤入力 → 正しく入力） | 誤入力は拒否。成功後、氏名・ふりがな・電話・備考が消え、予約の日時・メニュー・状態と来店回数が残る。未来の予約は管理者キャンセル |
| M-31 | REL-004（日本語・英語）を確認し、店主にレクチャー（30〜60 分） | 手動予約・ブロック・休業設定・通知トラブルの手順があり、スクリーンショット付き。レクチャー実施日を記録 |

---

## 4. 結果記録（M5 / M6）

自動・E2E の実行記録:

| 実施 | CI の実行 URL / コミット | `npm test` | E2E | 実施者 |
|---|---|---|---|---|
| M5 | | /  pass | /6 pass | |
| M6 | | /  pass | /6 pass | |

AT ごとの結果（合否は ○ / × / ―（対象外）。× は不具合 ID を書く）:

| AT | 優先 | M5（staging）結果・日付 | M6 結果・日付 | 端末 | 不具合 ID | 備考 |
|---|---|---|---|---|---|---|
| AT-01 | Must | | | | | |
| AT-02 | Must | | | | | |
| AT-03 | Must | | | | | |
| AT-04 | Must | | | | | |
| AT-05 | Must | | | | | |
| AT-06 | Must | | | | | |
| AT-07 | Must | | | | | |
| AT-08 | Must | | | | | |
| AT-09 | Must | | | | | |
| AT-10 | Must | | | | | |
| AT-11 | Must | | | | | |
| AT-12 | Must | | | | | |
| AT-13 | Must | | | | | |
| AT-14 | Must | | | | | `app_badge` の位置: |
| AT-14b | Must | | | | | |
| AT-15 | Must | | | | | 通知までの秒数: |
| AT-16 | Must | | | | | |
| AT-17 | Must | | | | | 1 週間の開始日: |
| AT-18 | Should | | | | | |
| AT-19 | Should | | | | | |
| AT-20 | Must | | | | | |
| AT-21 | Must | | | | | |
| AT-22 | Must | | | | | |
| AT-23 | Must | | | | | 受信時刻: |
| AT-24 | Must | | | | | スコア: |
| AT-25 | Must | | | | | |
| AT-26 | Must | | | | | |
| AT-27 | Must | | | | | |
| AT-28 | Must | | | | | 所要時間: |
| AT-29 | Must | | | | | |
| AT-30 | Should | | | | | |
| AT-31 | Must | | | | | レクチャー日: |

不具合の区分（要件定義書 15.1）: 重大（予約不可・二重予約・通知不達・個人情報漏えい）は修正まで検収保留／中（表示崩れ・文言）は公開前修正／軽微は公開後 2 週間以内に修正。

## 検収合格（M6）

| 項目 | 内容 |
|---|---|
| 判定日 | |
| 結果 | 合格 ／ 条件付き合格（条件: ） ／ 不合格 |
| クライアント確認 | |

## 変更履歴

| 版 | 日付 | 内容 |
|---|---|---|
| v0.1 | 2026-10-12 | 初版 |
