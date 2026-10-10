# 09. 調査ギャップ検証: iOS/Safari Web Push と二次通知チャネル（LINE / メール / SMS）のコスト

> 本ノートは `05_pwa_push_admin.md` の Gaps と、報告書末尾「調査ギャップ」表の「iOS / WebKit」「通知コスト」「ツール（web-push）」行を、一次資料を直接取得して検証した結果である。取得日はすべて **2026-10-10**。取得方法は curl（HTML を素のテキストに変換）、Apple Developer のドキュメント JSON API（`developer.apple.com/tutorials/data/documentation/...json`）、WebKit Bugzilla の CSV 出力、WebKit ソース（GitHub raw）、mdn/browser-compat-data v8.1.5 の JSON、npm レジストリ。JS レンダリングが必要なページ（AWS SNS / Vonage / KWC）は Playwright で描画した。
>
> 判定の凡例: **確認** = 以前の記載が一次資料と一致 / **訂正** = 一次資料と食い違いがあり修正 / **補強** = 以前は二次情報・推測だったものを一次資料で裏付け（記載内容は概ね正しい） / **不明** = 一次資料で確定できず（実機検証が必要）

---

## 1. サマリー表

| # | 項目 | 以前の記載（05 ノート / 報告書） | 一次資料での確認結果 | 判定 | 出典 URL（取得日 2026-10-10） |
|---|---|---|---|---|---|
| 1 | iOS Web Push の基本要件 | ホーム画面追加 + manifest `display` 非デフォルト + ユーザー操作に応答して許可要求 | WebKit 2023 記事: 「A web app that has been added to the Home Screen can request permission to receive push notifications as long as that request is in response to direct user interaction」。manifest `display` は `standalone`/`fullscreen` でウェブアプリ化。iOS 26 以降は manifest 無しでも「ホーム画面に追加 = ウェブアプリとして開く」が既定 | 確認 | https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/ ; https://webkit.org/blog/17333/webkit-features-in-safari-26-0/ |
| 2 | サイレント push で許可取り消し | SW が `showNotification` を呼ばないと Safari が許可を取り消す（Firebase issue 経由の二次情報） | Apple 公式: 「Safari doesn't support invisible push notifications. Present push notifications to the user immediately after your service worker receives them. If you don't, Safari revokes the push notification permission for your site.」WebKit 2025 記事: 「if an event handler doesn't show the user visible notification for any reason we revoke its push subscription」。**回数（N 回）は公表されていない**（「for any reason」= 1 回でも対象になり得る） | 補強（回数は不明） | https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers ; https://webkit.org/blog/16535/meet-declarative-web-push/ |
| 3 | `pushsubscriptionchange` の iOS 対応 | iOS 未実装（BCD `false`） | BCD 8.1.5: `safari_ios: version_added: false`（macOS Safari は 16 で `true` 扱い）。WebKit エンジニア Ben Nham（Bug 273063 Comment 5, 2024-05）: 「We don't fire PushSubscriptionChangeEvent ... The IDL is in the repo but is otherwise unused.」 | 確認 | https://github.com/mdn/browser-compat-data/blob/main/api/ServiceWorkerGlobalScope.json ; https://bugs.webkit.org/show_bug.cgi?id=273063 |
| 4 | `notificationclick` の iOS 対応 | BCD は `false` だが実際は動く報告多数（BCD 不備の疑い） | BCD 8.1.5 は依然 `safari_ios: false`。しかし WebKit Bug 268797 で WebKit 側が「the notificationclick event is firing properly, but some methods called in the notificationclick event handler are not working as intended」(Comment 26, 2024-09) と整理し、`Clients.matchAll`/`openWindow` の早期 resolve を別バグ（279456/279458）に分離。iOS 26.7.1 での動作報告あり（Comment 39, 2026-09-30）。**BCD のデータ不備と判断して差し支えない** | 訂正（BCD の `false` は実態と不一致） | https://bugs.webkit.org/show_bug.cgi?id=268797 |
| 5 | Declarative Web Push の JSON キー | explainer 由来の `title` / `options` / `default_action_url` / `mutable` / `app_badge` | **出荷版は別形式**: トップレベル `"web_push": 8030` + `"notification": { title, lang, dir, body, navigate, silent, tag, icon, data }`。`navigate` が必須（旧 `default_action_url` の後継）。`mutable` はトップレベル（`notification` の兄弟）が正。`app_badge` は WebKit 現行ソースではトップレベルで読む（ブログ例は `notification` 内）。Push API 仕様には `app_badge` が無い | 訂正 | https://webkit.org/blog/16535/meet-declarative-web-push/ ; https://w3c.github.io/push-api/ ; https://github.com/WebKit/WebKit/blob/main/Source/WebCore/Modules/notifications/NotificationJSONParser.cpp |
| 6 | `Content-Type: application/notification+json` 必須 | explainer 記載の要件として扱っていた | 出荷版の WebKit ブログ・Push API 仕様・Apple ドキュメントのいずれにも Content-Type 要件は無い。仕様は「A user agent opportunistically parses each incoming push message」、WebKit `webpushd` も受信ペイロードを無条件に `NotificationPayload::parseJSON()` に通す。**判別は JSON の `web_push: 8030` のみ** | 訂正 | https://w3c.github.io/push-api/ ; https://github.com/WebKit/WebKit/blob/main/Source/WebKit/webpushd/WebPushDaemon.mm |
| 7 | 前面表示中の通知バナー表示 | 一次資料なし | Apple / WebKit の公開文書・Bugzilla に該当記述なし。表示判断は非公開の Web.app（iOS 側）で行われるため一次資料が存在しない | 不明（実機検証） | — |
| 8 | 購読の静かな失効 | フォーラム体験談「1〜2 週間」 | WebKit Bugzilla に 2024〜2026 年の NEW 状態のバグが複数（273063, 279277, 284111「endpoint 'forgotten'」, 319865「APNs 201 but never delivered」）。失効条件・期間は Apple 未公表。Ben Nham: 17.5 RC で Web.app 側のバグ（権限を失ったと誤報告し購読が削除される）を修正済み | 補強（条件は不明のまま） | https://bugs.webkit.org/show_bug.cgi?id=284111 ; https://bugs.webkit.org/show_bug.cgi?id=319865 |
| 9 | Safari 18.x / 26.x / 27 の Push 関連リリースノート | 26.1 以降未確認 | 18.4「Added support for Declarative Web Push」、18.5「...on macOS」、26.0「Added support for any website to become a web app on iOS or iPadOS」+ Add to Home Screen 修正、26.2「Fixed reading the `mutable` field from the outer object instead of as a child of `notification`」、27「Fixed incorrect URL parser invocation on the `Notification` object」。26.1/26.3〜26.6/27.2β に Push 固有の項目なし。**Safari 27（2026 年 9 月）が最新安定版** | 確認（追補） | https://developer.apple.com/documentation/safari-release-notes/safari-18_4-release-notes ほか（§3） |
| 10 | WebKit 272325（iOS 17.x セッション Cookie リセット） | 修正状況不明 | **Status: NEW（未解決）**。最終コメント 2024-11-21（英国政府サイトが iOS 18.1 でも再現と報告、POST 時のみ発生する回避策を記述）。以後更新なし | 確認（未修正のまま） | https://bugs.webkit.org/show_bug.cgi?id=272325 |
| 11 | WebKit 185400（ホーム画面アプリが復帰時にリロード） | 修正状況不明 | **RESOLVED INVALID**（2018-06-18）。Brady Eidson: 「This is a known issue, but is also not a WebKit issue; We're tracking it in Radar.」= WebKit 外（iOS 側）の問題として非公開 Radar 追跡 | 訂正（WebKit では追跡されていない） | https://bugs.webkit.org/show_bug.cgi?id=185400 |
| 12 | ITP 7 日ルールのホーム画面アプリ適用 | 未確認（HttpOnly Cookie なら対象外と推測） | WebKit 2020 記事: 「Web applications added to the home screen are not part of Safari and thus have their own counter of days of use. Their days of use will match actual use of the web application which resets the timer. We do not expect the first-party in such a web application to have its website data deleted.」= **実使用があれば削除されない設計**。ただし 2025 記事は「ITP deletes all website data for websites you haven't visited in a while. This includes service worker registrations.」と明記（長期未使用なら SW ごと消える） | 確認 | https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/ ; https://webkit.org/blog/16535/meet-declarative-web-push/ |
| 13 | `Notification.actions` / `expirationTime` / `setAppBadge` の Safari 対応 | actions 非対応、setAppBadge iOS 16.4〜 | BCD 8.1.5: `actions` Safari `false`（iOS mirror）、`PushSubscription.expirationTime` Safari 16 / iOS 16.4、`setAppBadge` Safari 17 / iOS 16.4（`0` でクリア）、Chrome Android `false`。追加: `Notification.navigate` Safari 18.4、`tag` Safari `false`（「can be set, but has no effect」、Bug 258922 は 2026-07 時点でも NEW）、`silent` macOS 16.6 / iOS `false`、`Window.pushManager` Safari 18.4（Chrome/Firefox 未実装） | 確認（追補） | https://github.com/mdn/browser-compat-data/blob/main/api/Notification.json ほか |
| 14 | Chrome `beforeinstallprompt` | Chrome 61〜、Safari 非対応 | BCD: Chrome 61〜（44〜60 は partial）、Safari/Firefox `false`、`standard_track: true, deprecated: false`。Chrome の発火条件（web.dev、2024-09-19 更新）: 未インストール・クリック/タップ 1 回以上・閲覧 30 秒以上・HTTPS・manifest（`name|short_name`, 192/512 icons, `start_url`, `display` が fullscreen/standalone/minimal-ui/window-controls-overlay, `prefer_related_applications` 無し/false）。**Service Worker は条件に含まれない** | 確認（追補） | https://web.dev/articles/install-criteria ; https://github.com/mdn/browser-compat-data/blob/main/api/Window.json |
| 15 | Chrome push の user-visible-only | `userVisibleOnly: true` 必須 | web.dev: 「You must pass a value of true. If you do not include the userVisibleOnly key or pass false, you receive the following error: Chrome currently only supports the Push API for subscriptions that will result in user-visible messages.」通知を出さなかった場合: 「Chrome will only show the "This site has been updated in the background." notification when a push message is received and the push event in the service worker does not show a notification after the promise passed to event.waitUntil() has finished.」 | 確認 | https://web.dev/articles/push-notifications-subscribing-a-user ; https://web.dev/articles/push-notifications-handling-messages |
| 16 | Chrome の quiet notification permission UI | 未調査 | Chromium Blog（2020-01-07）: Chrome 80 で導入。手動有効化（Settings > Site Settings > Notifications > "Use quieter messaging"）に加え、「users who typically block notification permission requests」と「sites with very low opt in rates」で自動有効化。Google 公式ヘルプ: 「When Chrome finds a site to be disruptive, it may automatically remove a site's permission to send notifications and require the site to request your permission again.」 | 確認（新規） | https://blog.chromium.org/2020/01/introducing-quieter-permission-ui-for.html ; https://support.google.com/chrome/answer/3220216 |
| 17 | LINE 公式アカウント料金 | コミュニケーション 0 円/200 通、ライト 5,000 円/5,000 通、スタンダード 15,000 円/30,000 通（追加 〜3 円）、2026-10-01 改定 | lycbiz 料金ページ（現行）: 上記と一致。追加メッセージは**スタンダードプランのみ**（※3）。2026-10-01 改定（実施済み告知 2026.10.01）: 「20万通/月までのご利用は1通3円、20万通を超えたご利用分からの追加メッセージは1通2.5円」（税別、日本のみ）。カウント対象: Messaging API の Push / Multicast / Broadcast / Narrowcast、**Reply API・LINE チャット・応答/あいさつメッセージは非課金** | 確認 | https://www.lycbiz.com/jp/service/line-official-account/plan/ ; https://www.lycbiz.com/jp/news/line-official-account/20261001/ ; https://developers.line.biz/ja/docs/messaging-api/pricing/ |
| 18 | Resend 料金 | 無料 3,000 通/月・100 通/日・1 ドメイン、ログ保持 1 日/30 日で不一致 | resend.com/pricing（現行）: Free **$0 / 3,000 emails / mo, 100 emails a day, 3 domains, 30-day data retention**, 1 webhook endpoint, Ticket support。Pro $20/月 50,000 通、日次上限なし、超過 $0.90/1,000（Pay-as-you-go は有料プランのみ）。受信メールも同一クォータに算入 | 訂正（ドメイン数 1→3、保持 30 日で確定） | https://resend.com/pricing |
| 19 | Vercel–Resend 連携 | 未確認 | Vercel Marketplace「Resend」: `vc i resend` でインストール、Free/Paid プラン選択、送信リージョンに `ap-northeast-1` を選択可、Vercel が Resend アカウント作成・ドメイン接続・API キー発行を代行。前提「A domain purchased in Vercel」（Vercel 側にドメインがあること） | 確認（新規） | https://resend.com/docs/guides/vercel-marketplace-integration ; https://vercel.com/marketplace/resend |
| 20 | Twilio 日本宛 SMS 単価 | $0.0800（ショートコード）/ $0.0890（ロングコード）/ $0.089（英数字送信者 ID）、失敗 $0.001 | 現行ページで一致（Outbound）。Inbound $0.0800。「charged per segment」「A failed message processing fee of $0.001 per message」。ガイドライン: 国際ゲートウェイは**登録不要**で動的ロングコード・英数字送信者 ID 可（送信者 ID は保持されない）、国内ゲートウェイ（ロング/ショートコード）は**登録必須・営業経由・プロビジョニング 5 週間**、KDDI 網は 5 セグメント超で遅延、国際番号は `010` が前置、本文中の電話番号は不可 | 確認（追補） | https://www.twilio.com/en-us/sms/pricing/jp ; https://www.twilio.com/en-us/guidelines/jp/sms |
| 21 | Twilio 以外の SMS 単価 | 未調査 | Plivo 日本宛（キャリア別・公開値）: SoftBank $0.0587、Ymobile/Okinawa/その他 $0.0788、NTT DoCoMo $0.0823、KDDI $0.0872 / sms。AWS SNS: 日本宛の従量単価は JS 描画後も国選択 UI 経由でしか表示されず取得不可（専用ショートコードは初期 $1,750 + 月額 $1,150、12 週）。Vonage は国選択が JS のため未取得 | 補強（Plivo のみ確定） | https://www.plivo.com/sms/pricing/jp/ ; https://aws.amazon.com/sns/sms-pricing/ |
| 22 | web-push npm（VAPID・ヘッダ） | 3.6.7（2024-01）、`headers` で追加ヘッダ、Content-Type 上書きは未検証 | npm: latest 3.6.7（2024-01-16）、`engines.node >= 16`、master の package.json も 3.6.7 で `"type": "module"`。README: `headers` は「an object with all the extra headers you want to add to the request」、`contentEncoding` 既定 `aes128gcm`、VAPID `subject` は `https:` か `mailto:`、`https://localhost` は Safari が `BadJwtToken` で拒否。**Content-Type 上書きは不要になった（#6）ため検証自体が不要** | 確認 | https://github.com/web-push-libs/web-push/blob/master/README.md ; https://registry.npmjs.org/web-push |
| 23 | Vercel 関数で push 送信可能か | Hobby 300 秒上限 | Vercel docs: Hobby「300s default and maximum」、Pro/Enterprise 300s 既定・800s 上限・1800s 拡張（Beta）、メモリ Hobby 2 GB/1 vCPU、ペイロード 4.5 MB、超過時 504 `FUNCTION_INVOCATION_TIMEOUT`。Apple 側: HTTP/1.1 は未確認リクエスト 100 件まで、ペイロード 4 KB 上限（`PayloadTooLarge`）、JWT は 1 時間に 1 回以上更新しない。購読 1〜3 件への送信は数秒で完了し制限内 | 確認 | https://vercel.com/docs/functions/limitations ; https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers |

---

## 2. 項目別の詳細

### 2.1 WebKit「Web Push for Web Apps on iOS and iPadOS」（2023-02-16, Brady Eidson / Jen Simmons）

取得: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/

- 要件の原文: 「Web developers have the option to create a manifest file (with its display member set to standalone or fullscreen) and serve it along with their website. If they do, that site becomes a Home Screen web app.」
- 許可要求: 「A web app that has been added to the Home Screen can request permission to receive push notifications as long as that request is in response to direct user interaction — such as tapping on a 'subscribe' button provided by the web app.」
- 配信基盤: 「Web Push on iOS and iPadOS uses the same Apple Push Notification service ... You do not need to be a member of the Apple Developer Program to use it. Just be sure to allow URLs from *.push.apple.com」
- バッジ: 「Both setAppBadge and clearAppBadge change the count while the user has the web app open in the foreground or while the web app is handling push events in the background — even before permission to display the count has been granted. ... Once a user gives permission to allow notifications, the icon on the Home Screen will immediately display the current badge count.」→ 05 ノートの「通知許可が付与されるまでバッジは表示されない」と整合。
- 集中モード: 「Notifications for Home Screen web apps on iPhone and iPad integrate with Focus」→ 「通知が届かない」一次切り分けに集中モードを入れる根拠。
- Manifest `id`: Focus 設定の端末間同期に使用。同名で複数インストール可。
- 前面表示中の挙動、`pushsubscriptionchange`、Content-Type についてはこの記事に記述なし。

### 2.2 WebKit「Meet Declarative Web Push」（2025-03-27, Brady Eidson）

取得: https://webkit.org/blog/16535/meet-declarative-web-push/

- 提供範囲: 「You can test it out on iOS 18.4, iPadOS 18.4, and on the macOS 15.5 beta.」Safari 18.4 リリースノート「Added support for Declarative Web Push. (141082392)」、18.5「Added support for Declarative Web Push on macOS. (148109003)」で裏付け。
- サイレント push ペナルティ（原文）: 「WebKit requires you as the developer to always show a notification; no silent push messages are allowed. ... if an event handler doesn't show the user visible notification for any reason we revoke its push subscription」。宣言的方式では「browsers don't have to apply their "silent push penalties" to Declarative Web Push messages.」
- SW 不要の購読: 「Declarative Web Push also exposes window.pushManager to support subscription management without requiring a service worker.」「the removal of that service worker registration will not affect the associated push subscription.」
- **出荷版 JSON（記事の例そのまま）**:
  ```json
  {
    "web_push": 8030,
    "notification": {
      "title": "Webkit.org — Meet Declarative Web Push",
      "lang": "en-US",
      "dir": "ltr",
      "body": "Send push notifications without JavaScript or service worker!",
      "navigate": "https://webkit.org/blog/16535/meet-declarative-web-push/",
      "silent": false,
      "app_badge": "1"
    }
  }
  ```
  「The top level "web_push" value is an homage to RFC 8030 ... This is the magic value that opts the rest of your push message into declarative parsing.」「a non-empty "title" value is required」「the required "navigate" value ... describes a URL that will be navigated to by the browser upon activation.」
- 記事に `Content-Type`、`mutable`、`default_action_url`、`options` の記述は**無い**。explainer（https://github.com/WebKit/explainers/blob/main/DeclarativeWebPush/README.md）は依然として `title`/`options`/`default_action_url`/`mutable`/`app_badge` と `application/notification+json` を提案形として記載しているが、これは出荷版と一致しない。
- 後方互換: 「Most applications will find it straightforward to send the declarative standard JSON in their push messages and rewrite their service worker's PushEvent handler to display it.」

### 2.3 Push API 仕様（W3C Editor's Draft）と WebKit 実装の突合

取得: https://w3c.github.io/push-api/ ; https://github.com/WebKit/WebKit/blob/main/Source/WebCore/Modules/notifications/NotificationJSONParser.cpp ; https://github.com/WebKit/WebKit/blob/main/Source/WebKit/webpushd/WebPushDaemon.mm

| キー | 仕様（Push API ED） | WebKit main（NotificationJSONParser.cpp） | 備考 |
|---|---|---|---|
| `web_push` | required, 「An integer that must be 8030」 | トップレベル、`expectedDeclarativeWebPushValue = 8030` | 判別はこの値のみ（Content-Type 不使用） |
| `notification.title` | required | 空文字なら SyntaxError | |
| `notification.navigate` | required, URL | 無効 URL なら SyntaxError | explainer の `default_action_url` に相当 |
| `notification.{dir,lang,body,tag,icon,silent,data}` | optional | 読み取る | `tag` は iOS で置換が効かない（Bug 319860, 258922 とも NEW） |
| `notification.{image,badge,vibrate,timestamp,renotify,requireInteraction,actions}` | optional（`actions[].navigate` required） | **パーサーにキー定義なし**（無視される） | iOS の通知 UI 制約と一致 |
| `mutable` | トップレベル（`message["mutable"]`） | トップレベルを優先、`notification` 内も後方互換で許容（FIXME: webkit.org/b/297389） | Safari 26.2「Fixed reading the `mutable` field from the outer object instead of as a child of `notification`」、Bug 297389「When we first shipped Declarative Web Push we accidentally added support for the mutable field ... inside notification, while instead it should be a sibling to notification.」 |
| `app_badge` | **仕様に無い** | **トップレベル** `outerObject.getValue("app_badge")`、文字列（数字のみ）または非負整数 | ブログ例は `notification` 内に `"app_badge": "1"`。Bug 268797 Comment 39（iOS 26.7.1）: 「app_badge in the payload was not applied on our device」。出荷版と trunk で位置が異なる可能性があるため、**両方の位置に入れる**のが安全（パーサーは未知キーを無視） |

`webpushd` の受信処理（WebPushDaemon.mm）: 受信ペイロードを `NotificationPayload::parseJSON(payloadString)` に無条件で通し、`!isMutable && supportsBuiltinNotifications` なら SW を起動せず即時に `showNotification(...)`（コメント: 「This is a declarative push message without the mutable flag set, so we don't need to remember it for later. Instead we can just display its notification right now.」）。したがって **`Content-Type: application/notification+json` は不要**であり、web-push の `headers` で Content-Type を上書きする必要もない（05 ノート Q3 Gaps の検証項目は解消）。

既知の不具合（すべて Status NEW）:
- 319860（2026-07）: 「Tag-based notification coalescing does not work with Declarative Web Push on iOS 18.4」
- 321666（2026-08, iOS 18.7 / Safari 26.6）: immutable な宣言的通知は SW から `close()` できない（`creationTime` 未保存）
- 296242（2025-07）: 「Declarative Web Push: local URLs are not supported」
- 294421（2025-06）: 「Declarative Web Push: pushSubscriptionChange requires Service Worker」（SW なし運用では購読変更を知る手段が無い）
- 268797 Comment 38（2026）: 既存の PWA ウィンドウがバックグラウンド + 端末スリープ中に宣言的通知をタップしても `navigate` URL へ遷移しない（アプリ完全終了時は正常）。Comment 39（iOS 26.7.1）: 「Declarative Web Push (web_push: 8030 + navigate) opened the right URL when the app was terminated, but not when it was already running.」

### 2.4 Safari リリースノート（18.4〜27.2 beta）の Push / ウェブアプリ関連項目

取得: `https://developer.apple.com/documentation/safari-release-notes/safari-<ver>-release-notes`（JSON API 経由で全文取得）。一覧ページには 12〜27.2 beta まで掲載。

| バージョン | 関連項目（原文） |
|---|---|
| 18.4 | 「Added support for Declarative Web Push. (141082392)」「Fixed Wake Lock API for Home Screen Web Apps. (108573133)」SW: busy loop / navigation preload 修正 |
| 18.5 | 「Added support for Declarative Web Push on macOS. (148109003)」 |
| 18.6 | Push / ウェブアプリ関連なし |
| 26.0 | 「Added support for any website to become a web app on iOS or iPadOS. (113034903)」「Fixed the "Add to Home Screen" flow failing to load webpage data, preventing users from making new Home Screen web apps. (154655565)」Web Inspector「Added support for automatic inspection of Service Workers. (118233905)」 |
| 26.1 | 関連項目なし（Accessibility/CSS 等の修正のみ） |
| 26.2 | 「Fixed an issue where an audio element failed to play when re-opening a Home Screen Web App. (155336513)」「Fixed reading the `mutable` field from the outer object instead of as a child of `notification`. (157475553)」「Added asynchronous URL error handling for Service Workers. (157769176)」 |
| 26.3 / 26.4 / 26.5 | 関連項目なし |
| 26.6 | 「Fixed an issue where service worker registrations with missing main scripts were not automatically unregistered, preventing pages from re-registering new service workers. (175522651)」（imported scripts 版も） |
| 27（2026-09） | 「Added support for the service worker static routing API. (157951894)」「Fixed incorrect URL parser invocation on the `Notification` object. (176762955)」SW 登録の自動解除修正（26.6 と同内容） |
| 27.2 beta | 関連項目なし |

WebKit ブログ「WebKit Features in Safari 26.0」: 「By default, every website added to the Home Screen opens as a web app. If the user prefers to add a bookmark for their browser, they can disable "Open as Web App" when adding to Home Screen」「there are now zero requirements for "installability" in Safari.」また Web Inspector の「automatic inspection and pausing of Service Workers」は Web Push イベントのデバッグ用途として明記（「This can happen, for example, with Web Push events」）。2026 年のブログ（26.6 / 27.0 の Features 記事、STP 248〜253）に Push 固有の新機能は無い。

### 2.5 WebKit Bugzilla の状態

| Bug | 件名 | Status | 最終更新 | 要点 |
|---|---|---|---|---|
| 272325 | REGRESSION (iOS 17.x): Session cookies being reset randomly in a Home Screen web app | **NEW** | 2024-11-21 | 報告者はセッション Cookie（`Expires` なし）のみで再現、永続 Cookie では再現せず。英国政府サイト（月 100 万 UU）が iOS 18.1 でも 0.35% の iPhone ユーザーで再現と報告。Apple からの修正コメントなし |
| 185400 | Apps added to home screen lose context when multitasking and reload | **RESOLVED INVALID** | 2018-06-18 | 「not a WebKit issue; We're tracking it in Radar」→ WebKit 側では追跡終了 |
| 273063 | iOS service worker - webPush subscription becomes invalid for few users | NEW | 2024-07-30 | Ben Nham: 「We don't fire PushSubscriptionChangeEvent」「We did fix a number of bugs with Web Push on iOS recently (which should be in 17.5 RC) ... bugs where Web.app would handle the push, but then tell WebKit that the website didn't have permissions anymore, which would then result in the subscription being deleted.」 |
| 284111 | Web Push subscription endpoint 'forgotten' | NEW | 2024-12-12 | 再起動後 `getSubscription()` が null、古いエンドポイントに送っても APNs は 201 を返し続ける（410 にならない） |
| 319865 | Web Push accepted by APNs (HTTP 201) but never delivered to Home Screen PWA on iOS | NEW | 2026-07-29 | iOS 18.7。PHP / Node（web-push）の 2 実装で 201 だが未配信。再インストールでも再現せず原因不明 |
| 320551 | Notification.permission returns "default" instead of "denied" (iOS Web App) | NEW | 2026-08-05 | iOS 設定で通知 OFF にしても `Notification.permission === "default"`、`permissions.query` も `prompt`。`requestPermission()` はダイアログを出さない |
| 268797 | notificationclick events in serviceworkers not firing | NEW | 2026-09-30 | §2.3 参照。WebKit 側は「イベント自体は発火」と整理し 279456/279458 に分離。`console.log` は push/notificationclick 内で Web Inspector に出ない |
| 263687 | notificationClick openWindow goes to PWA root instead of url given | NEW | 2025-12-02 | iOS 17.0.3: アプリ終了状態で `clients.openWindow(deeplink)` するとルート URL で開く |
| 258922 | Push notifications with same tag do not replace each other | NEW | 2026-07-31 | BCD の `Notification.tag` Safari `false` の根拠 |
| 249766 | Push to expired endpoint returns 200 still | RESOLVED WONTFIX | 2023-01-04 | 05 ノートの記載どおり |

### 2.6 ITP（Intelligent Tracking Prevention）とホーム画面アプリ

取得: https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/（2020-03-24）

- 7 日ルール原文: 「deleting all of a website's script-writable storage after seven days of Safari use without user interaction on the site. These are the script-writable storage forms affected: Indexed DB, LocalStorage, Media keys, SessionStorage, Service Worker registrations and cache」
- ホーム画面アプリ（原文、節題「A Note On Web Applications Added to the Home Screen」）: 「Web applications added to the home screen are not part of Safari and thus have their own counter of days of use. Their days of use will match actual use of the web application which resets the timer. We do not expect the first-party in such a web application to have its website data deleted. If your web application does experience website data deletion, please let us know since we would consider it a serious bug.」
- 2025 年の WebKit 記事は「ITP deletes all website data for websites you haven't visited in a while. This includes service worker registrations.」「after the website's service worker JavaScript has been removed either by the user or by ITP」と述べており、**長期間使われないホーム画面アプリでは SW 登録が消え得る**ことを前提に Declarative Web Push を設計している。
- 結論: 日常的に使う管理 PWA では ITP による削除は想定しなくてよい。ただし HttpOnly の永続 Cookie（サーバー側セッション）という 05 ノートの方針はそのまま妥当（Cookie はスクリプト書き込みではない）。

### 2.7 MDN browser-compat-data（v8.1.5, 2026-10-10 main）

取得: https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/{ServiceWorkerGlobalScope,Notification,PushSubscription,Navigator,PushManager,Window}.json

| API | safari | safari_ios | chrome / chrome_android | 注記 |
|---|---|---|---|---|
| `ServiceWorkerGlobalScope.notificationclick_event` | 16 | **false** | 40 / mirror | WebKit Bug 268797 の経緯から BCD 側の不備と判断（§2.5） |
| `ServiceWorkerGlobalScope.pushsubscriptionchange_event` | 16 | **false** | 138 / mirror | WebKit は発火しない（Bug 273063 C5）。Chrome は 138 で正式対応、Firefox は partial（`oldSubscription`/`newSubscription` なし） |
| `ServiceWorkerGlobalScope.push_event` | 16 | 16.4 | 40 / mirror | 「Notifications are supported in web apps saved to the home screen.」 |
| `Notification`（interface） | 7 | 16.4 partial | 20 / 42 partial | 「The `Notification` interface is undefined, unless the page is a web app saved to the home screen. The app's manifest must have a non-default `display` value.」「A notification can only be sent from a service worker.」 |
| `Notification.actions` | **false** | mirror | 53 / mirror | Firefox 152 で対応 |
| `Notification.navigate` | 18.4 | mirror | — | Declarative Web Push と同時に追加 |
| `Notification.tag` | false（「can be set, but has no effect」, impl_url webkit.org/b/258922） | false | — | |
| `Notification.silent` | 16.6 | **false** | — | |
| `Notification.data` | 16 | 16.4 | — | |
| `Notification.image` / `badge` / `requireInteraction` | false | mirror | — | `badge` は webkit.org/b/280160 |
| `PushSubscription.expirationTime` | 16 | 16.4 | 60 / mirror | 値は返るが WebKit/APNs が非 null を返すかは別問題（Bug 284111 のとおり 410 も返らない） |
| `Navigator.setAppBadge` | 17 | 16.4 | 81（Win/mac、ChromeOS 91、Linux 非対応）/ **false** | 「Passing `0` as an argument will clear the badge instead of displaying an unnumbered dot.」 |
| `PushManager` | 16 | 16.4 | 42 / mirror | |
| `Window.pushManager` | 18.4 | 18.4 | false（crbug 382298314）/ mirror | Firefox も未実装（bugzil.la/1935325） |
| `Window.beforeinstallprompt_event` | false | mirror | 61（44–60 partial）/ mirror | `standard_track: true, deprecated: false` |

### 2.8 Chrome / Android

- **インストール条件**（web.dev「What does it take to be installable?」最終更新 2024-09-19）: 「In Chrome, your Progressive Web App must meet the following criteria before it will fire the beforeinstallprompt event and show the in-browser install promotion: The web app is not already installed. Meets the user engagement heuristics: The user needs to have clicked or tapped on the page at least once ... The user needs to have spent at least 30 seconds viewing the page ... Be served over HTTPS. Includes a web app manifest that includes: short_name or name / icons - must include a 192px and a 512px icon / start_url / display - must be one of fullscreen, standalone, minimal-ui, or window-controls-overlay / prefer_related_applications must not be present, or be false」。注記「Users can install your web app even if it doesn't meet the PWA installability criteria listed below.」Service Worker は条件に含まれない。
- **userVisibleOnly**（web.dev「Subscribing a user」）: 「Passing a value of true is a symbolic agreement with the browser that the web app displays a notification every time it receives a push message (that is, no silent push). You must pass a value of true.」「It appears that blanket silent push will not be implemented in Chrome.」
- **通知を出さなかった場合**（web.dev「Handling messages」）: 「Chrome will only show the "This site has been updated in the background." notification when a push message is received and the push event in the service worker does not show a notification after the promise passed to event.waitUntil() has finished.」`showNotification()` の Promise を `waitUntil` に渡し忘れると断続的に既定通知が出る。
- **Quiet UI**（Chromium Blog 2020-01-07 + Google ヘルプ）: 「Chrome 80 will show, under certain conditions, a new, quieter notification permission UI」「the quieter UI will be automatically enabled for users under two conditions: first, for users who typically block notification permission requests and second, on sites with very low opt in rates.」ヘルプ: 「A website can still ask you to allow notifications, but no pop-up prompt will show. Instead, you'll only find a bell icon next to the website's address.」「When Chrome finds a site to be disruptive, it may automatically remove a site's permission to send notifications」。管理者 1 名の PWA では opt-in 率データが無く、自動 enroll の影響は限定的だが、許可要求は必ずユーザー操作直後に行う。
- Android の Doze / 省電力による遅延、2025–2026 年の `beforeinstallprompt` 仕様変更は、Chrome 公式ドキュメントに該当記述なし（BCD も deprecated フラグなし）。

### 2.9 LINE 公式アカウント / Messaging API

取得: https://www.lycbiz.com/jp/service/line-official-account/plan/ ; https://www.lycbiz.com/jp/news/line-official-account/20260216/（2026-09-01 再掲）; https://www.lycbiz.com/jp/news/line-official-account/20261001/ ; https://developers.line.biz/ja/docs/messaging-api/pricing/

- プラン（現行ページ）: コミュニケーションプラン「月額固定費 ¥0 / 無料メッセージ 200 通 / 追加メッセージ 不可」、ライトプラン「¥5,000（税別）/ 5,000 通 / 不可」、スタンダードプラン「¥15,000（税別）/ 30,000 通 / ~¥3/通（税別）」。「※2 開設時はコミュニケーションプランに設定されています。」「※3 スタンダードプランのみ、従量課金制で追加メッセージを配信いただけます。」「料金プランによって利用できる機能に差はありません。」初期費用なし、年払い不可。
- 2026-10-01 改定（告知原文）: 「20万通/月までのご利用は1通3円、20万通を超えたご利用分からの追加メッセージは1通2.5円でご利用頂けます。※金額は税別です。」「適用対象国は日本のみ」。上限引き上げの最大値は 359 万通。
- カウント（lycbiz）: カウントされる = 「メッセージ配信（絞り込み配信・ステップ配信含む）」「Messaging API の『Push API』『Multicast API』『Broadcast API』『Narrowcast API』」。カウントされない = 「LINEチャットの送受信」「応答メッセージ」「あいさつメッセージ」「Messaging APIの『Reply API』」。
- LINE Developers: 「メッセージ通数は、メッセージの送信対象となった人数でカウントされます」「ブロックしているユーザーID ... 実際には届かないユーザーを宛先に指定した場合は、メッセージ通数にはカウントされません」「上限を超えてメッセージを送信しようとした場合、エラーレスポンスが返りメッセージは送信されません」。当月の利用状況は専用エンドポイントで取得可。
- 本案件への含意: 理容師本人 1 名宛の Push API は 1 通 = 1 カウント。月 200 通を超えると**送信エラーで止まる**（課金されない）ので、新規予約 + キャンセル + 日次サマリー（約 30 通/月）で十分。

### 2.10 Resend

取得: https://resend.com/pricing ; https://resend.com/docs/guides/vercel-marketplace-integration ; https://vercel.com/marketplace/resend

- Free プラン（ページ原文）: 「$0 / mo 3,000 emails / mo, 100 emails a day, 3 domains, Ticket support, 10,000 automation runs, 30-day data retention」。比較表「Daily limit: Free 100 / Pro No limit」「Custom domains: Free 3 / Pro 10」「Data retention: 30 days（Free/Pro/Scale）」「Webhook endpoints: Free 1 endpoint」。
- Pro: 「$20 / mo 50,000 emails / mo, Extra emails: $0.90 / 1,000, No daily email limit」。
- 超過（FAQ）: 「With pay-as-you-go pricing, you can continue sending beyond your monthly quota ... Overages are billed in buckets of 1,000 emails at your plan's overage rate. ... It's an option on paid plans, not a plan of its own.」→ Free は上限で停止。「Each received email counts towards your transactional emails quota.」
- Vercel 連携: 「`vc i resend` ... `-m region=eu-west-1` ... Supported regions: us-east-1, eu-west-1, sa-east-1, and ap-northeast-1」「Select a plan (free or paid).」「Vercel creates a new Resend account for your Vercel project, connects the domain to Resend, and provisions an API key.」前提「A domain purchased in Vercel.」。Marketplace カード「Free plan with generous quotas」「Pro plans available from $20」。
- 以前の記載の訂正: ドメイン数は 1 → **3**、ログ（データ）保持は **30 日**で確定。

### 2.11 SMS（日本宛）

取得: https://www.twilio.com/en-us/sms/pricing/jp ; https://www.twilio.com/ja/sms/pricing/jp（同一価格）; https://www.twilio.com/en-us/guidelines/jp/sms ; https://www.plivo.com/sms/pricing/jp/ ; https://aws.amazon.com/sns/sms-pricing/（Playwright）

- Twilio 単価（Outbound/セグメント）: Short Codes $0.0800、Long Codes $0.0890、Alphanumeric Sender IDs $0.089。Inbound $0.0800。注記: 「Text messages are charged per segment ... Prices may change from time to time without notice and additional carrier fees may apply ... A failed message processing fee of $0.001 per message」。1 セグメント = 160 文字（GSM）。日本語（UCS-2）は 70 文字/セグメントが一般則だが本ページには明記なし。
- Twilio 日本ガイドライン: 「Twilio provides SMS delivery services to Japan via two distinct gateways: International and Domestic. For the International gateway: There's no need for registration. Both dynamic longcodes and alphanumeric sender IDs are supported. For the Domestic gateway: Registration is mandatory. Messages will be delivered using either a longcode or a shortcode. ... Please contact the sales team」。表: Alphanumeric「Domestic Pre-registration: Required / Provisioning time 5 weeks / Sender ID preserved: No（International）」、Long code domestic「Twilio supported: Not Supported」、Long code international「Supported」、Short code「Not Supported」。「SMS message to the KDDI network in Japan with over five (5) segments may experience delivery delay」「International Numeric Sender Id would also be prepended with 010」「Phone numbers in message content is not allowed.」Two-way SMS: Yes。MMS: Not Available。
- Plivo（公開・キャリア別、Outbound/sms）: SoftBank $0.0587、Ymobile / Okinawa Cellular / eMobile / Others $0.0788、NTT DoCoMo $0.0823、KDDI $0.0872。
- AWS SNS: 国別の従量単価は国選択 UI の裏にあり取得不可。専用ショートコード Japan「One-time setup fee $1,750 / Monthly fee $1,150 / 12 weeks」（小規模用途には不適）。
- 換算: 1 セグメント ≈ $0.06–0.09 ≈ 9〜14 円（1 ドル 150 円換算）。日本語 2 セグメント（70 文字超）なら 20〜28 円/通。

### 2.12 web-push npm と Vercel 関数

取得: https://registry.npmjs.org/web-push ; https://raw.githubusercontent.com/web-push-libs/web-push/master/README.md ; https://raw.githubusercontent.com/web-push-libs/web-push/master/package.json ; https://vercel.com/docs/functions/limitations ; Apple「Sending web push notifications in web apps and browsers」

- npm: `latest 3.6.7`（2024-01-16 公開、以降更新なし）、`engines: { node: ">= 16" }`。master の package.json も 3.6.7、`"type": "module"`（ESM）。依存: `asn1.js`, `http_ece 1.2.0`, `https-proxy-agent ^7`, `jws ^4`, `minimist`。Node 22 / Vercel ランタイム固有の互換性記述は README に無い（Node >= 16 のみ）。
- README `sendNotification(pushSubscription, payload, options)` の `options`: `vapidDetails {subject, publicKey, privateKey}`, `timeout`（ソケットタイムアウト）, `TTL`（「by default, four weeks」）, `headers`（「an object with all the extra headers you want to add to the request」）, `contentEncoding`（「'aes128gcm', by default, or 'aesgcm'」）, `urgency`, `topic`（32 文字以内）, `proxy`, `agent`。`setVapidDetails(subject, publicKey, privateKey)` の subject は「either an `https:` or `mailto:` URI」。注記「if a push notification request contains a VAPID `subject` referencing an `https://localhost` URI ... Safari's push notification endpoint rejects the request with a `BadJwtToken` error.」
- Apple 側の制約（公式）: ヘッダ `TTL`（「it may store the notification for 30 days or fewer」）、`Authorization`（VAPID JWT、「Don't refresh your JWT more frequently than once per hour」）、`Content-Encoding`、`Topic`（32 文字）、`Urgency`。ペイロード上限 4 KB（`PayloadTooLarge`）。HTTP/1.1 パイプラインは未確認 100 件まで。成功は **201**、`410`「The device token has expired」、`429`「too many requests for the same destination」。
- Vercel: Hobby「Maximum duration Hobby: 300s default and maximum」、メモリ「Hobby 2 GB / 1 vCPU」、ペイロード 4.5 MB、「The Hobby plan offers functions for free, within limits」。購読 1〜3 件への `Promise.allSettled` 送信は 1〜3 秒程度で制限内。Content-Type 上書きが不要になったため（§2.3）、`headers` オプションは使わなくてよい。

---

## 3. 設計判断への影響

### 3.1 Service Worker / ペイロードの変更（05 ノート Q3 の修正）

1. **ペイロード形式を出荷版 Declarative Web Push に合わせる**（explainer 形式は廃止）。
   ```json
   {
     "web_push": 8030,
     "notification": {
       "title": "新規予約 14:00 カット（山田様）",
       "body": "10/12(日) 14:00–14:30",
       "lang": "ja",
       "navigate": "https://<domain>/admin/bookings/<id>",
       "tag": "booking-<id>",
       "data": { "bookingId": "<id>", "kind": "created" },
       "app_badge": 3
     },
     "app_badge": 3,
     "mutable": false
   }
   ```
   - `app_badge` はトップレベルと `notification` 内の**両方**に入れる（WebKit trunk はトップレベルを読み、ブログ例は内側。未知キーは無視される）。`mutable` はトップレベルのみ（26.2 以降の正規位置）。
   - `Content-Type` の変更は不要。web-push の既定（`aes128gcm`）のまま `sendNotification(sub, JSON.stringify(payload), { TTL, urgency, topic })` で送る。
   - `topic` は `booking-<id>`（APNs/Chrome で未配信メッセージを置換）。`tag` は iOS では置換されない（Bug 258922/319860）ので、同一予約の重複表示を許容する。
2. **SW の `push` ハンドラは残す**（非対応ブラウザ用 + iOS で `mutable:false` のときは SW が起動しない）。ハンドラは `data.notification` を `showNotification(title, { body, lang, dir, tag, icon, silent, data: { url: navigate, ...data } })` に転記。`event.waitUntil()` に Promise を**必ず**渡す（Chrome の既定通知回避、Safari の許可取り消し回避）。
3. **`notificationclick` は Comment 39 の形**に揃える: `clients.matchAll({ type: 'window', includeUncontrolled: true })` → 既存ウィンドウがあれば `client.navigate(path).then(c => (c ?? client).focus())`、無ければ `clients.openWindow(path)`、失敗時は `openWindow` にフォールバック。SPA 側のクライアント遷移用 `postMessage` は補助として残す。05 ノートの「URL 一致でフォーカスしない」方針は維持。
4. **SW 更新**: iOS は古い SW を長く使い続ける（Comment 39）。ページ読み込みごとに `registration.update()` を呼び、`/sw.js` は `Cache-Control: no-cache` + `updateViaCache: 'none'`（既存方針）。
5. **`Notification.permission` を信用しすぎない**（Bug 320551）: iOS 設定で OFF にされても `"default"` を返す。起動時チェックは「`getSubscription()` が null」を主条件にし、`requestPermission()` が `"granted"` 以外を返した/ダイアログが出なかった場合は「設定 > 通知 > <アプリ名>」への案内を表示する。
6. **`pushsubscriptionchange` は Android 専用**のまま（iOS では発火しない、Declarative でも SW 必須: Bug 294421）。
7. web-push は 3.6.7（2024-01）で更新停止だが Node >= 16 / ESM で、Vercel Node ランタイムで動く前提に変更なし。Apple の 201/410/429 を `WebPushError.statusCode` で判定し、410 は削除、429 は再試行しない。

### 3.2 iOS 受け入れテストの追加・変更（05 ノート Q8）

- 追加 A: **宣言的通知のタップ遷移**を 3 状態で確認: (a) アプリ完全終了 → `navigate` の URL で開く、(b) アプリがバックグラウンド（端末スリープ後）→ Bug 268797 C38/C39 の「ルートに戻る」現象が出るか、(c) アプリ前面。(b) で遷移しない場合、`mutable: true` + SW の `notificationclick` 経路に切り替えるか、起動時に「未確認一覧」へ誘導する UI で吸収する。
- 追加 B: **`app_badge` の反映**（トップレベル / `notification` 内のどちらが効くか）を iOS 26.x 実機で確認し、効いた側だけ残す。
- 追加 C: **iOS 設定で通知を OFF → 再起動**し、アプリ内の案内（設定へ誘導）が出ること（Bug 320551 対策）。
- 追加 D: **前面表示中の通知バナー**: Apple に一次資料が無いため、アプリ前面 / バックグラウンド / ロック画面の 3 パターンを実機で確認し、前面で出ない場合はアプリ内トースト + 未確認バッジで代替（既存方針 Q4 のポーリングで吸収可能）。
- 追加 E: **APNs 201 だが未配信**（Bug 319865）の検出: 「テスト通知」ボタンでサーバーの 201 応答と端末の受信を突き合わせ、届かない場合は購読を作り直す導線（unsubscribe → subscribe）を設定画面に置く。
- 変更: 「1 週間後に起動して購読が有効か」は維持しつつ、**週次ヘルスチェック（サーバーから定期テスト通知、受信確認は次回起動時の `last_seen_at`）** を運用項目に追加。失効条件は Apple 未公表（Bug 284111 ほか NEW）のため期間は決め打ちしない。
- 変更: 272325 は未修正（NEW）のため、「セッション Cookie を使わず `Max-Age` 付き永続 Cookie」の方針を**必須**に格上げし、受け入れテストに「アプリを閉じて再度開いてもログイン状態が維持される」を明記する。185400 は WebKit 外の問題として追跡が無いので、「バックグラウンド復帰時のリロードでフォーム入力が失われない（下書きを `sessionStorage`/`IndexedDB` に保存）」をテスト項目に残す。
- 変更: ITP はホーム画面アプリでは実使用でタイマーがリセットされる（WebKit 2020）ため、「7 日間未使用でデータ消去」のテストは不要。長期未使用（数週間）後に SW 登録が消えている可能性はあるので、起動時の `register()` 再実行は必須。

### 3.3 Phase 2 通知チャネルの予算（05 ノート Q4 の更新）

| チャネル | 無料枠（確定値） | 上限超過時 | 本案件の月間想定 | 判断 |
|---|---|---|---|---|
| Web Push（APNs / FCM） | 無料 | — | 〜100 通 | 主経路。best-effort |
| LINE Messaging API（コミュニケーションプラン） | 200 通/月、0 円 | **送信エラーで停止**（追加購入不可。スタンダード 15,000 円/月なら 3 円/通） | 新規・キャンセル・日次サマリーで 〜60 通 | 採用。200 通到達前（150 通）で LINE をキャンセル通知のみに自動縮退 |
| Resend（Free） | 3,000 通/月・**100 通/日**・3 ドメイン・保持 30 日 | 送信停止（PAYG は有料のみ） | 〜100 通 | 採用（バックアップ + 日次サマリー）。Vercel Marketplace から `ap-northeast-1` で作成可 |
| SMS（Twilio 国際 GW） | なし。$0.089/セグメント（+失敗 $0.001） | — | 0〜10 通 | 不採用維持。緊急キャンセルのみ任意。英数字送信者 ID は登録不要だが受信側で保持されず「010〜」の国際番号表示になる点を了承事項に |
| SMS（Twilio 国内 GW / Plivo） | 国内 GW は登録必須・5 週間・営業経由。Plivo $0.0587–0.0872/sms | — | — | 小規模では手続きコストが見合わない |

月額の固定費は引き続き 0 円で成立する。LINE の 200 通は「理容師 1 名宛」なので十分だが、将来「顧客へのリマインド配信」を LINE で行う場合は 1 通 = 1 人なので、月の予約件数 × 送信回数がそのまま消費される。顧客 100 名 × リマインド 2 回 = 200 通で上限に達するため、顧客向けリマインドは Resend（メール）を主とし、LINE はライトプラン（5,000 円/月・5,000 通）へ移行を前提にする。

### 3.4 残る不明点（実機検証で確定させる項目）

1. 前面表示中の通知バナー表示の有無（iOS 26.x）。
2. `app_badge` の有効な位置（トップレベル / `notification` 内）と、SW が起動しない immutable 配信でバッジが更新されるか。
3. 宣言的通知タップ時の `navigate` が「既存ウィンドウ + スリープ後」で無視される現象（Bug 268797 C38）の再現有無。
4. 購読失効の頻度（運用ログの `last_seen_at` / テスト通知の到達率で計測）。
5. AWS SNS / Vonage の日本宛単価（必要になった時点で管理コンソールの見積りで確認）。
