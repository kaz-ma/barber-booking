# ADR-0007: Web Push は best-effort とし、未確認バッジ＋ポーリング＋日次サマリーで補完する。ペイロードは出荷版 Declarative Web Push 形式で送る

## 文書情報

| 項目 | 内容 |
|---|---|
| ID | ADR-0007 |
| 版 | v0.2 |
| 日付 | 2026-10-12 |
| ステータス | Accepted |
| 変更履歴 | v0.2（2026-10-12）: 実装との同期（決定は変更なし）。ペイロードに氏名を含めない（日時・メニュー・経路・未確認件数のみ）、`app_badge` を両方の位置に入れる実装、リアルタイム更新を TanStack Query ではなく自前の 20 秒ポーリング（`InboxProvider`）にしたことを追記。v0.1（2026-10-10）: 初版 |
| 決定者 | 開発者 |
| 関連要件 | FR-A-09〜12, FR-A-15, FR-A-17, FR-S-03, NFR-AV-03, NFR-MG-05, CON-01, KPI-07, AT-14〜17, AT-20, AT-23 |

## コンテキスト

- 目的の一つは「予約の見落としゼロ」。顧客への自動通知はなく、オーナーへの通知が主経路。
- iOS の Web Push はホーム画面アプリでのみ動作し、購読が無言で失効しうる、`pushsubscriptionchange` が未実装、APNs が 201 を返しても届かないことがある、設定で OFF にしても `Notification.permission` が `default` を返す、SW が push で通知を表示しないと許可が取り消される、といった制約がある。
- iOS 18.4 で Declarative Web Push が出荷された。判別は JSON 本体のトップレベル `"web_push": 8030` で、`notification.{title, navigate}` が必須、`mutable`・`app_badge` はトップレベル。Content-Type の変更は不要（`web-push` の既定 `aes128gcm` のまま送れる）。
- Hobby の Cron は 1 日 1 回・±59 分（ADR-0001）。

## 決定ドライバー

1. Push が届かなくても、PWA を開けば 20 秒以内に新規予約に気づけること（NFR-AV-03）。
2. iOS の SW 例外で許可を失うリスクを最小にすること。
3. 将来 SW を外す（宣言的のみにする）選択肢を残すこと（NFR-MG-05）。
4. 追加費用なし。

## 検討した選択肢

| 観点 | 採用 | 退けた案 |
|---|---|---|
| 通知チャネル | Web Push（主）＋未確認バッジ＋可視時 20 秒ポーリング＋日次サマリー | Push 単独（失効で見落とす）、LINE／メールの二次チャネル（Phase 1 では費用・設定負担。Phase 2 で検討）、SMS（高額） |
| SW | 手書き最小 SW（`push`・`notificationclick`・`pushsubscriptionchange`） | Serwist（オフラインキャッシュの価値が低く、SW の複雑化が push を壊すリスク。FR-A-17 で必要になれば後付け） |
| ペイロード | 出荷版 Declarative 形式（`web_push: 8030`） | explainer 形式（`application/notification+json`・`default_action_url`・`options`。出荷版に存在しない）、独自 JSON（iOS で SW 起動が必須になる） |
| リアルタイム更新 | 可視時のみの 20 秒ポーリング（v0.1 の想定は TanStack Query の `refetchInterval`。実装は依存を増やさず `InboxProvider` の `setInterval`＋`visibilitychange` で同じ挙動にした） | Supabase Realtime（Neon では不可、1 名運用に過剰）、SSE（サーバーレスで接続維持が不利） |

## 決定

- 送信: `web-push` 3.6.7、VAPID 固定。`Promise.allSettled`、`TTL: 21600`、`urgency: 'high'`（日次サマリーは `normal`）、`timeout: 8000`、`topic` は `b`＋base64url(UUID)（32 文字制限のため。要件の `booking-<id>` は上限超過）。`after()` で送り予約確定を遅らせない。404/410 は購読削除、429 は再送しない。
- ペイロード: 05_state_and_flows.md 7.1 の JSON（`lib/push-payload.ts` の `buildDeclarativePayload()`）。`app_badge` はトップレベルと `notification` 内の**両方**に入れ（実装済み）、iOS 26.x 実機（AT-14）で効いた側を残す。**氏名・電話番号・備考・トークンを含めない**（v0.1 の例にあった「山田様」は削除。AGENTS.md 規則 6）。新規・キャンセルは「新規予約 11/4(水) 18:00 カット」／「18:00–19:00（web）・未確認 2 件」のように日時・メニュー・経路・未確認件数だけ、日次サマリーは件数と開始時刻だけ。
- SW: `push` では例外時も必ず `showNotification`。`notificationclick` は `client.navigate` → `postMessage` → `openWindow` の順、同一オリジンの `/admin` 配下のみ許可。`/sw.js` は `no-cache`、ページ読み込みごとに `registration.update()`。
- 購読管理: 起動・可視化のたびに `getSubscription()`。null なら再購読バナー（`Notification.permission` は主条件にしない）。「テスト通知」で HTTP ステータスと端末受信を突き合わせ、届かなければ作り直し。
- 補完: `bookings.acknowledged_at` による未確認バッジ、可視時 20 秒ポーリング（非表示時停止。`InboxProvider`）、前面で通知が出ない場合のアプリ内トースト。
- 日次サマリー: Vercel Cron `0 12 * * *`（21:00 JST。Hobby は 21 時台）、`CRON_SECRET`、`daily_digests` への INSERT を先に行い同日 1 回（at-most-once）。0 件の日も送る（生存確認）。

## 結果

良い点:

- Push が失効・未達でも、起動時と可視中のポーリングで 20 秒以内に検知でき、日次サマリーで翌日の予約を毎晩確認できる。
- iOS 18.4+ では SW を起動せずに表示され、SW のバグで許可を失うリスクが下がる。旧環境・他ブラウザは SW が同じ JSON を表示する。

悪い点・未確定事項:

- 受け入れテストで確定させる項目が残る: 前面表示中のバナー、`app_badge` の有効位置、既存ウィンドウ＋スリープ後の `navigate` 無視（WebKit 268797）、購読失効の頻度（AT-14、AT-17）。
- iOS では `tag` による置換が効かず、同一予約の通知が重複表示されうる（`topic` で未配信分は置換）。
- ポーリングは Neon のコンピュートを消費する（ADR-0002）。
- 日次サマリーの時刻は Hobby 期間中 21:00〜21:59 で不定。

## 関連

- 統合レポート『iOS のプッシュは「ホーム画面追加・毎回通知表示・起動時再確認」で成立する』『信頼性は「未確認件数バッジ＋可視時ポーリング＋日次サマリー…」で多層化する』
- `05_pwa_push_admin.md` Q3–Q5、`09_gap_push_notifications.md` §3
- 05_state_and_flows.md 5〜8 章、03_screen_specs.md 9 章
