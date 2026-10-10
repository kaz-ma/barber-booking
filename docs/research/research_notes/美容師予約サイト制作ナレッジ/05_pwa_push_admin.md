# 05. 管理者向けPWA + Web Push + 管理ダッシュボードUX（2026年10月時点）

> 調査環境メモ: 本調査では WebFetch が使えず、webkit.org / developer.apple.com / vercel.com / developers.line.biz / resend.com 等への直接 curl もネットワークポリシー（CONNECT 403）で遮断された。そのため一次情報は (a) GitHub 上の原典（MDN content / browser-compat-data、WebKit explainers、Next.js 公式 docs の mdx、Serwist リポジトリの example、web-push README）と npm レジストリ、(b) WebSearch の検索結果スニペットの2系統で裏取りしている。スニペット経由の数値（Vercel/LINE/Resend/Twilio の料金・上限）は「実装前に公式ページで再確認」を前提に記載する。途中で WebSearch の予算上限に達したため、未検証のまま残った点は各節の Gaps に明記した。

---

## Q1. iOS/iPadOS の Web Push 要件・変遷（iOS 16.4 → 26）・既知の不具合・EU 制限

### Takeaway
iOS では「Safari の共有メニューから『ホーム画面に追加』したウェブアプリ」内でのみ Push API / Notification / Badging が有効で、通知許可はユーザー操作（タップ）に応答して要求する必要がある。iOS 18.4（2025年3月）で Service Worker 不要の Declarative Web Push が追加され、iOS 26 では「ホーム画面に追加した全サイトがデフォルトでウェブアプリとして開く」仕様になった。一方で購読が静かに失効する・`pushsubscriptionchange` が未実装などの運用上の落とし穴は 2026 年時点でも残っており、「Push は best-effort」を前提に設計する必要がある。

### Cited Findings

**基本要件（iOS 16.4〜）**
- MDN browser-compat-data: `PushManager` / `PushManager.subscribe()` は Safari iOS 16.4 で追加、注記「Notifications are supported in web apps saved to the home screen.」 — [mdn/browser-compat-data api/PushManager.json](https://github.com/mdn/browser-compat-data/blob/main/api/PushManager.json)
- 同 BCD: `Notification` インターフェースは iOS 16.4 から partial 実装で、「ホーム画面に保存したウェブアプリでなければ `Notification` は undefined（コンストラクタは ReferenceError）。**マニフェストの `display` が非デフォルト値（= `browser` 以外）であること**」「通知は Service Worker からのみ送出可能（`showNotification()` を使う）」 — [mdn/browser-compat-data api/Notification.json](https://github.com/mdn/browser-compat-data/blob/main/api/Notification.json)
- 同 BCD: `Notification.requestPermission()` も iOS 16.4〜 同条件（ホーム画面アプリ + 非デフォルト `display`） — [同上](https://github.com/mdn/browser-compat-data/blob/main/api/Notification.json)
- WebKit 公式「Web Push for Web Apps on iOS and iPadOS」（iOS 16.4 発表記事）: ホーム画面に追加したウェブアプリは、**ユーザーの直接操作（購読ボタンのタップ等）に応答する場合に限り**通知許可を要求できる — [webkit.org/blog/13878](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)（検索スニペット経由）
- Next.js 公式 PWA ガイド: 「Web Push は iOS 16.4+（ホーム画面にインストールしたアプリ）、macOS 13+ の Safari 16、Chromium 系、Firefox で利用可能」 — [vercel/next.js docs progressive-web-apps.mdx](https://github.com/vercel/next.js/blob/canary/docs/01-app/02-guides/progressive-web-apps.mdx)
- MDN「Making PWAs installable」: iOS 16.3 以前は Safari からのみインストール可能、**iOS 16.4 以降は Safari / Chrome / Edge / Firefox / Orion の共有メニューからインストール可能**。`beforeinstallprompt` は iOS 非対応 — [mdn/content making_pwas_installable](https://github.com/mdn/content/blob/main/files/en-us/web/progressive_web_apps/guides/making_pwas_installable/index.md)
- Pushpad（ベンダー解説）: Safari の通常タブには Push API 自体が存在しない。ホーム画面アイコンから起動した場合のみ購読でき、同じサイトをブラウザで開いても未購読扱いになる — [pushpad.xyz ios-special-requirements](https://pushpad.xyz/blog/ios-special-requirements-for-web-push-notifications)

**バッジ（Badging API）**
- BCD: `navigator.setAppBadge()` は Safari iOS 16.4〜（ホーム画面ウェブアプリ限定）。`0` を渡すとバッジがクリアされる（数字なしドットにはならない）。**Chrome Android は Badging API 非対応**（`version_added: false`） — [mdn/browser-compat-data api/Navigator.json](https://github.com/mdn/browser-compat-data/blob/main/api/Navigator.json)
- MDN「Display a badge on the app icon」: iOS/iPadOS では**通知許可が付与されるまでバッジは表示されない**。Android の Chromium 系では Badging API 非対応だが、未読通知があると OS が自動でアイコンにバッジを付ける。Service Worker から `navigator.setAppBadge()` を呼べばアプリ非起動中でも更新可能 — [mdn/content display_badge_on_app_icon](https://github.com/mdn/content/blob/main/files/en-us/web/progressive_web_apps/how_to/display_badge_on_app_icon/index.md)
- WebKit Bugzilla 275797: macOS では PWA 非起動時に SW から `setAppBadge()` を呼んでもアイコンが更新されない不具合報告（iOS では期待通り動作、2024年） — [bugs.webkit.org 275797](https://bugs.webkit.org/show_bug.cgi?id=275797)

**通知オプションのサポート差（iOS Safari）**
- BCD `Notification` 各プロパティ: `actions`（通知ボタン）は Safari 非対応、`image` 非対応、`badge`（モノクロ小アイコン）非対応、`vibrate` 非対応、`requireInteraction` 非対応、`renotify` 非対応、`tag` は「設定できるが効果なし」、`silent` は Safari 16.6〜、`data` は iOS 16.4〜 — [mdn/browser-compat-data api/Notification.json](https://github.com/mdn/browser-compat-data/blob/main/api/Notification.json)
- BCD: `pushsubscriptionchange` イベントは **Safari iOS で `version_added: false`（未実装）**。`notificationclick` も BCD 上は iOS `false`（ただし下記 WebKit 記事では SW での click 処理が前提。BCD の記録不備の可能性あり） — [mdn/browser-compat-data api/ServiceWorkerGlobalScope.json](https://github.com/mdn/browser-compat-data/blob/main/api/ServiceWorkerGlobalScope.json)

**iOS 17.x（2024）**
- Apple は iOS 17.4 で EU 域内のホーム画面ウェブアプリを廃止すると一旦告知（DMA の代替ブラウザエンジン対応のため）したが、**2024年3月初旬に撤回し、EU でも WebKit ベースのホーム画面ウェブアプリを継続提供**すると発表 — [9to5mac 2024/02/15](https://9to5mac.com/2024/02/15/ios-17-4-web-apps-european-union/); [mactrast 2024/03](https://www.mactrast.com/2024/03/apple-decides-not-to-disable-home-screen-web-apps-in-the-eu/amp/); [computerbase.de](https://www.computerbase.de/2024-03/dma-apple-deaktiviert-progressive-web-apps-mit-ios-17-4-doch-nicht/)
- WebKit Bugzilla 272325「REGRESSION (iOS 17.x): Session cookies being reset randomly in a Home Screen web app」: iOS 17.2〜17.4.1 でホーム画面アプリのセッション Cookie がランダムにリセットされる回帰バグ（サーバは Cookie を変えていないのに `Cookie` ヘッダが古い値を持つ） — [bugs.webkit.org 272325](https://bugs.webkit.org/show_bug.cgi?id=272325)

**iOS 18.x（2024–2025）: Declarative Web Push**
- WebKit「Meet Declarative Web Push」: Safari 18.4 / iOS・iPadOS 18.4（2025年3月）で導入。**Service Worker をインストールしなくても購読と通知表示が可能**。SW の JS で通知内容を任意に書き換えられ、失敗時は宣言的メッセージがフォールバックとして表示される。省電力・プライバシー面で有利で、従来の Web Push と後方互換 — [webkit.org/blog/16535](https://webkit.org/blog/16535/meet-declarative-web-push/); [WebKit Features in Safari 18.4](https://webkit.org/blog/16574/digital-credentials-api/)
- WebKit explainer（一次資料・GitHub）: 宣言的 push は HTTP リクエストの **`Content-Type: application/notification+json`** で判別。ペイロード JSON は `title`（必須）、`options`（`body`/`lang`/`dir`/`silent`/`actions[]`/`data` 等）、**`default_action_url`（必須）**、`mutable`（既定 false）、`app_badge`（整数、0 でクリア）。`actions[]` の各要素には `url` が必須。通知タップ時は `notificationclick` を経由せず URL を直接開く。`mutable: true` かつ SW に `pushnotification` ハンドラがあれば書き換え可能、時間内に完了しなければプラットフォームが元の通知を表示。`window.navigator.pushManager` を公開し SW 登録なしで `subscribe()` 可能。`app_badge` のみのペイロードは immutable なら許容、mutable は不可 — [WebKit/explainers DeclarativeWebPush](https://github.com/WebKit/explainers/blob/main/DeclarativeWebPush/README.md)
- Apple Developer Forums（ベータ期）: 宣言的方式でテスト送信に苦労する開発者スレッドあり（初期は情報不足） — [developer.apple.com/forums/thread/776836](https://developer.apple.com/forums/thread/776836)
- 二次情報（webscraft.org）: iOS 18 は Push に大きな変更なし、ただし購読が理由不明で「消える」報告は継続 — [webscraft.org](https://webscraft.org/blog/pwa-pushspovischennya-na-ios-u-2026-scho-realno-pratsyuye?lang=en)
- Apple Forums 770749「PWA Web Push not arriving on iOS 18.0 - solved」: 17.7.2 で届いていた通知が 18.0 で届かない → 原因は端末の**おやすみモード/集中モード設定**だった — [developer.apple.com/forums/thread/770749](https://developer.apple.com/forums/thread/770749)
- 開発者報告: iOS 18.1.1 で push イベントにより SW が起動した際 `indexedDB` グローバルが undefined になる WebKit バグ疑い — [Apple Forums プロフィール投稿](https://origin-devforums.apple.com/forums/profile/corrideat)

**iOS 26（2025年9月〜）**
- WebKit「WebKit Features in Safari 26.0」: **iOS/iPadOS 26 ではホーム画面に追加したすべてのサイトがデフォルトでウェブアプリとして開く**（manifest 設定の有無に関係なく）。ユーザーは追加時に「Open as Web App（ウェブアプリとして開く）」をオフにして従来動作を選べる。Safari における「インストール可能性」の要件はゼロになった。SVG アイコン対応 — [webkit.org/blog/17333](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/); [MacRumors 経由 thenote.app](https://thenote.app/post/en/safari-changes-on-ios-26-go-beyond-the-address-bar-vf7viqkr7d?amp=true)
- 検索結果上、Safari 26.0 の WebKit 記事に Push 固有の新機能は見当たらなかった（宣言的 Web Push は 18.4 で既出）。ブログ mjtsai.com は「26 系 OS では Web Push が workerless（追加 JS 不要）になった」と述べるが、これは 18.4 の Declarative Web Push を指す可能性が高く、一次資料で未確認 — [mjtsai.com 2025/10/03](https://mjtsai.com/blog/?p=49472)
- Apple Developer Forums 801602: 「iOS 26 で PWA をホーム画面に追加するのに最低 5 タップ必要になった」とする開発者の投稿（公式声明ではない） — [developer.apple.com/forums/thread/801602](https://developer.apple.com/forums/thread/801602)

**購読の静かな失効・通知必須ルール（運用上の不具合）**
- Apple Forums 728796「PWA PUSH NOTIFICATION ISSUES IOS 16.4+」: エンドポイントが 1〜2 週間で失効し、「インストール済み PWA から何の兆候もなく消える」「受信直後に `getSubscription()` が null を返す」等の報告 — [developer.apple.com/forums/thread/728796](https://developer.apple.com/forums/thread/728796)
- Firebase JS SDK issue 8010: iOS で push が届かなくなり再登録が必要になる問題。スレッド内で「**SW が push を受信したら即座にユーザー向け通知を表示すること。表示しないと Safari がそのサイトの通知許可を取り消す**」「`event.waitUntil()` を使わないと初期に失敗する」 — [github firebase-js-sdk #8010](https://github.com/firebase/firebase-js-sdk/issues/8010)
- Apple Forums 728850: 通知を表示していても数回の push で Safari が許可を取り消したという報告 — [developer.apple.com/forums/thread/728850](https://developer.apple.com/forums/thread/728850)
- WebKit Bugzilla 273063「iOS service worker - webPush subscription becomes invalid for few users」: `pushsubscriptionchange` が iOS 未対応のため復旧フックがない — [bugs.webkit.org 273063](https://bugs.webkit.org/show_bug.cgi?id=273063)
- Apple Forums 786360: Safari Web Push トークンの有効期限問題。「トークンの有効性をプログラムから確認する手段がない」 — [developer.apple.com/forums/thread/786360](https://developer.apple.com/forums/thread/786360)
- XenForo コミュニティ分析: iOS/Safari は再認証が必要な場面で push 購読を失い、クリックなしに静かに再購読できない — [xenforo.com](https://www.xenforo.com/community/threads/how-do-you-all-handle-expiring-push-notifications.225544)
- WebKit Bugzilla 249766: WebKit は「unsubscribe 後に 410 を返す保証はなく、410 までの遅延は非決定的」。推奨回避策は「訪問のたびにクライアントから現在の購読をバックエンドに送り、一致しない保存済み購読を削除する」 — [bugs.webkit.org 249766](https://bugs.webkit.org/show_bug.cgi?id=249766)

**フォアグラウンド時の表示**
- 検索範囲では「インストール済み PWA が前面表示中に iOS がシステム通知バナーを抑制するか」を明記した一次資料は見つからなかった。Apple Forums に「前面では表示されるが背景では出ない」等の断片的報告と、`new Notification()` をページ側で直接呼ぶ案があるのみ（未解決） — [developer.apple.com/forums/thread/735402](https://developer.apple.com/forums/thread/735402); [Apple Forums プロフィール投稿](https://origin-devforums.apple.com/forums/profile/UtkarshYeolekar)

### Inferences
- 本案件（iPhone の理容師 1 名）では「ホーム画面に追加 → アプリアイコンから起動 → 設定画面の『通知をオンにする』ボタンをタップ → `Notification.requestPermission()` → `pushManager.subscribe()`」の 1 本道をオンボーディングとして用意し、**Safari タブで開いている場合は購読 UI を出さず『ホーム画面に追加してください』の手順を表示**する（`window.matchMedia('(display-mode: standalone)')` と `'PushManager' in window` で分岐）。
- iOS の購読は「いつの間にか失効する」前提で、**管理 PWA を開くたびに `registration.pushManager.getSubscription()` を確認し、null なら赤バナーで再購読ボタンを表示、非 null ならエンドポイントをサーバへ送って `last_seen_at` を更新**する（WebKit 249766 の推奨と一致）。サーバ側は「数日以上 `last_seen_at` が更新されない購読」を疑わしいものとして扱う。
- `pushsubscriptionchange` は iOS で発火しないので、Android 向けには実装しつつ、iOS は上記「起動時チェック」が唯一の復旧経路。
- iOS の SW `push` ハンドラでは**例外なく毎回 `event.waitUntil(self.registration.showNotification(...))` を呼ぶ**（サイレント push 禁止。許可取り消しの原因になる）。テスト用 push も必ず通知を出す。
- iOS では `actions`/`image`/`badge`/`vibrate`/`requireInteraction`/`tag`（置換）/`renotify` が効かないので、**通知は「タイトル + 本文 + `data.url`」の最小構成**で設計し、ボタン操作（承認/拒否）は通知タップ後の管理画面側で行う。Android では `tag` による置換・`actions` を追加的に活用してよい。
- Declarative Web Push（iOS 18.4+）は「SW が壊れていても通知が出る」安全網として有用。実装は 2 段構え: ペイロードを WebKit 形式 JSON（`title`/`options`/`default_action_url`/`app_badge`）に統一し、`Content-Type: application/notification+json` で送る。非対応ブラウザ（Chrome 等）は従来通り `push` イベントで同じ JSON を `showNotification` に転記する（explainer が明示する後方互換トリック）。ただし web-push ライブラリの `headers` オプションで `Content-Type` を上書きできるかは未検証（Gaps 参照）。
- iOS 26 以降「ホーム画面に追加 = ウェブアプリとして開く」がデフォルトになったため、追加手順の説明文から「Safari の設定を確認」といった注意書きは不要になった。ただし `display: 'standalone'` と `apple-mobile-web-app-capable` は引き続き指定する（Notification の BCD 条件「非デフォルト display」を満たすため）。
- 通知が届かない問い合わせの一次切り分けは「集中モード/おやすみモード」「設定 > 通知 > （アプリ名）」「ホーム画面アイコンから起動しているか」「iOS のバージョン（16.4+）」の順。

### Gaps
- iOS 26.x / 2026 年に入ってからの Push 固有の回帰バグ・修正の一次資料は未取得（WebSearch 予算上限のため、Safari 26.1〜26.x リリースノートを確認できず）。
- 前面表示中の通知バナー抑制の有無（`visibilityState` 依存）は一次資料で確認できなかった。実機検証が必要。
- 購読失効の具体的な期間・条件は Apple が公表しておらず、フォーラムの体験談（「1〜2 週間」等）のみ。
- Declarative Web Push の「WebKit 18.4 出荷版での実際の JSON キー名・必須項目」は explainer の提案内容で、出荷版 webkit.org 記事本文（JSON 例）は取得できなかった。実装前に webkit.org/blog/16535 を直接確認すること。
- `notificationclick` の iOS 対応状況は BCD で `false` だが、実際には SW からの `clients.openWindow()` が動作するという開発者報告が多数あり、BCD のデータ不備の可能性が高い。実機で確認が必要。

---

## Q2. Android/Chrome の Web Push 挙動・インストールプロンプト（beforeinstallprompt）・iOS との差

### Takeaway
Android Chrome は Push・通知オプション（actions/image/tag 等）・`beforeinstallprompt`・`pushsubscriptionchange` を一通りサポートし、manifest の `screenshots`+`description` を付ければアプリストア風の「richer install UI」が出る。Badging API は非対応だが未読通知があれば OS が自動でバッジを付ける。iOS と異なり通常のブラウザタブでも Push 購読できる。

### Cited Findings
- MDN `beforeinstallprompt`: ブラウザが「インストール可能」と判定した時点で発火（通常はページ読み込み時だが保証なし）。典型パターンは `preventDefault()` でイベントを保持し、自前のインストールボタンから `prompt()` を呼ぶ。インストール UI は既定で隠しておく（非対応ブラウザがあるため） — [mdn/content beforeinstallprompt_event](https://github.com/mdn/content/blob/main/files/en-us/web/api/window/beforeinstallprompt_event/index.md)
- BCD: `beforeinstallprompt` は Chrome 61〜（44〜60 は部分実装）、Safari（macOS/iOS）は `false` — [mdn/browser-compat-data api/Window.json](https://github.com/mdn/browser-compat-data/blob/main/api/Window.json)
- web.dev「Installation prompt」: 保持した `prompt()` は**1回しか呼べず**、ユーザーが却下した場合は次に `beforeinstallprompt` が発火するまで待つ必要がある。Chromium は `appinstalled` イベントを `window` に発火。**iOS/iPadOS の Chrome/Edge は PWA インストール非対応で `beforeinstallprompt` は発火しない**ため、Safari で開いて共有メニューから追加する案内を出すしかない — [GoogleChrome/web.dev learn/pwa/installation-prompt](https://github.com/GoogleChrome/web.dev/blob/main/src/site/content/en/learn/pwa/installation-prompt/index.md)
- 同 web.dev: Android Chrome で manifest に `description` と `screenshots` があると、小さな「ホーム画面に追加」インフォバーからアプリストア風の大きなダイアログに変わる — [同上](https://github.com/GoogleChrome/web.dev/blob/main/src/site/content/en/learn/pwa/installation-prompt/index.md)
- Chrome Developers「Richer PWA installation UI」: 対象フォームファクタのスクリーンショットを `screenshots` に最低 1 枚。`description` は任意だが推奨。Chrome 94（Android）/108（デスクトップ）〜 — [developer.chrome.com richer-pwa-installation](https://developer.chrome.com/blog/richer-pwa-installation)
- MDN「Making PWAs installable」: Chromium 系が要求する manifest 必須メンバーは `name`/`short_name`、`icons`、`start_url`、`display` または `display_override`、（+`prefer_related_applications` が false）。HTTPS/localhost 必須。`description`/`screenshots` は **Android のみ**インストールプロンプトに表示。Chrome（デスクトップ/Android）・Safari（デスクトップ）・Edge は manifest の有無に関係なく任意サイトをアプリとしてインストール可能 — [mdn/content making_pwas_installable](https://github.com/mdn/content/blob/main/files/en-us/web/progressive_web_apps/guides/making_pwas_installable/index.md)
- MDN `screenshots`: `form_factor`（`narrow`/`wide`）、`platform`（`android`/`ios`/…）、`sizes`、`type`、`label` を指定 — [mdn/content manifest screenshots](https://github.com/mdn/content/blob/main/files/en-us/web/progressive_web_apps/manifest/reference/screenshots/index.md)
- BCD: Chrome Android は `Notification.actions`（Chrome 53〜）、`image`（56〜）、`badge`、`vibrate`、`tag`、`renotify`、`requireInteraction` をサポート（`mirror`）。通知は SW からのみ（`showNotification()`） — [mdn/browser-compat-data api/Notification.json](https://github.com/mdn/browser-compat-data/blob/main/api/Notification.json)
- BCD: Chrome Android は `pushsubscriptionchange` をサポート（`mirror`）、`setAppBadge` は非対応 — [api/ServiceWorkerGlobalScope.json](https://github.com/mdn/browser-compat-data/blob/main/api/ServiceWorkerGlobalScope.json); [api/Navigator.json](https://github.com/mdn/browser-compat-data/blob/main/api/Navigator.json)
- MDN `showNotification` の `badge` オプション: Android 通知バーで使われるモノクロ小アイコン。4x 解像度まで想定し約 96×96px、自動でマスクされる — [mdn/content shownotification](https://github.com/mdn/content/blob/main/files/en-us/web/api/serviceworkerregistration/shownotification/index.md)
- MDN `pushsubscriptionchange`: ブラウザが購読を更新/失効/取り消した際に SW に送られる。例では `event.oldSubscription.options` で再購読し、新旧を `fetch('register')` で送信。オフライン時に `fetch` が失敗する前提で堅牢化が必要 — [mdn/content pushsubscriptionchange_event](https://github.com/mdn/content/blob/main/files/en-us/web/api/serviceworkerglobalscope/pushsubscriptionchange_event/index.md)
- Next.js 公式ガイド: `beforeinstallprompt` によるカスタムボタンは「iOS Safari で動かずクロスプラットフォームでないため推奨しない」とし、iOS 向けには共有ボタン→ホーム画面に追加の文言案内コンポーネントを例示 — [vercel/next.js progressive-web-apps.mdx](https://github.com/vercel/next.js/blob/canary/docs/01-app/02-guides/progressive-web-apps.mdx)

### Inferences
- 管理 PWA のインストール導線は 2 系統: (1) Android Chrome: `beforeinstallprompt` を保持し「アプリとして追加」ボタンを表示（却下されたら 1 セッションは非表示）。(2) iOS: Safari 判定時に「共有 → ホーム画面に追加」の図解。どちらも `display-mode: standalone` なら非表示。
- manifest には `screenshots`（`form_factor: "narrow"`、1080×1920 等の PNG 1〜2 枚）と `description` を入れて Android の richer install UI を有効化する。コストは画像 2 枚のみ。
- Android ではサーバ送信時に `topic`（RFC 8030 collapse）と SW 側の `tag` を同一予約 ID にすると、同じ予約の「新規→変更」通知が置き換わり通知欄が散らからない。iOS は `tag` 無効なので重複表示を許容する。
- 通知のバッジ数: iOS は `navigator.setAppBadge(n)` を SW の push ハンドラ内で呼ぶ（`app_badge` を payload に含める）。Android は OS 自動バッジに任せる。両者ともアプリ起動時に `clearAppBadge()`/`setAppBadge(0)`（Android では no-op だが安全）。

### Gaps
- Android の Doze/省電力による Push 遅延、Chrome の「サイレント push 違反時の既定通知」挙動は WebSearch 予算切れで一次資料未確認（知識上は Chrome が「このサイトはバックグラウンドで更新されました」通知を代理表示する仕様だが、2026 年時点の挙動は要確認）。
- `beforeinstallprompt` の 2025–2026 の仕様変更（Chrome の install 条件緩和など）は未確認。

---

## Q3. Next.js での実装（Serwist / next-pwa / 手書き、manifest、VAPID、web-push on Vercel、Postgres 保存、410 処理、再購読、notificationclick）

### Takeaway
Next.js 公式ガイドは「`app/manifest.ts` + 手書き SW（`push`/`notificationclick` のみ）+ Server Actions + `web-push`」の最小構成を示しており、本案件の規模ではこれで十分。オフラインキャッシュまで欲しければ Serwist（9.5.13、2026-10-04 時点、Next 16/Turbopack 対応の `@serwist/turbopack` あり）が現行の推奨。`next-pwa`（5.6.0、2022 年で更新停止）と `@ducanh2912/next-pwa`（2024 年で停止、Serwist へ移行推奨）は選ばない。購読は Postgres に `endpoint` ユニークで保存し、送信失敗 404/410 で削除、起動時に現在の購読を再送して差分削除する。

### Cited Findings

**ライブラリ選定（npm レジストリ 2026-10-10 取得）**
- `serwist` / `@serwist/next` / `@serwist/turbopack` 最新 **9.5.13**（2026-10-04 公開）。`@serwist/turbopack` は「Serwist を Next.js / Turbopack に統合するモジュール」、peerDeps: `next >=14`, `react >=18`, `esbuild >=0.25`。`@serwist/next` の peerDeps: `next >=14`, `@serwist/cli` — [registry.npmjs.org/@serwist/turbopack](https://registry.npmjs.org/@serwist/turbopack); [registry.npmjs.org/@serwist/next](https://registry.npmjs.org/@serwist/next)
- `next-pwa` 最新 5.6.0（2022-08-23）、`@ducanh2912/next-pwa` 最新 10.2.9（2024-09-18）で README に「特別な理由がなければ `@serwist/next` へ移行を検討」 — [registry.npmjs.org/next-pwa](https://registry.npmjs.org/next-pwa); [registry.npmjs.org/@ducanh2912/next-pwa](https://registry.npmjs.org/@ducanh2912/next-pwa)
- `web-push` 最新 **3.6.7**（2024-01-16）、ESM（`"type": "module"`）、MPL-2.0、CLI 同梱 — [registry.npmjs.org/web-push](https://registry.npmjs.org/web-push)
- Next.js 公式ガイド: Next.js 16 系のオフライン対応は実験的 `useOffline` フック/`experimental.useOffline` 設定で「接続状態に応じた UI と失敗したナビゲーション/Server Action の自動再試行」を提供。フル SW キャッシュは Serwist を案内（Turbopack 例 `examples/next-turbo-basic`、webpack 例 `examples/next-basic`） — [vercel/next.js progressive-web-apps.mdx](https://github.com/vercel/next.js/blob/canary/docs/01-app/02-guides/progressive-web-apps.mdx)
- Serwist 公式 example（Turbopack）: `next.config.mjs` は `import { withSerwist } from "@serwist/turbopack"; export default withSerwist({ reactStrictMode: true })`。`app/sw.ts` は `new Serwist({ precacheEntries: self.__SW_MANIFEST, skipWaiting: true, clientsClaim: true, navigationPreload: true, runtimeCaching: defaultCache, fallbacks: { entries: [{ url: "/~offline", matcher: ({request}) => request.destination === "document" }] } }); serwist.addEventListeners();`。`layout.tsx` で `<SerwistProvider swUrl="/serwist/sw.js">` と `metadata.appleWebApp = { capable: true, statusBarStyle: "default", title }`、`manifest: "/manifest.json"`、`icons.apple` 180×180 を指定。example の依存は `next 16.3.8` / `react 19.3.0` / `esbuild 0.28.2`、スクリプトは `next build --turbopack` — [serwist examples/next-turbo-basic](https://github.com/serwist/serwist/tree/main/examples/next-turbo-basic)
- Serwist example（webpack）: `withSerwistInit({ cacheOnNavigation: true, swSrc: "app/sw.ts", swDest: "public/sw.js", additionalPrecacheEntries: [{ url: "/~offline", revision }] })` — [serwist examples/next-basic/next.config.mjs](https://github.com/serwist/serwist/blob/main/examples/next-basic/next.config.mjs)
- 第三者ガイド: Next.js 16 は Turbopack が既定のため、Serwist は `@serwist/turbopack` + `serwist` を使う。フル PWA 機能（インストールプロンプト含む）のテストは dev ではなく production build で行う — [skills.sh nextjs-pwa](https://www.skills.sh/jakerains/agentskills/nextjs-pwa); [docs.monad.xyz next-serwist](https://docs.monad.xyz/templates/next-serwist-thirdweb)

**manifest / SW 登録 / 購読（Next.js 公式）**
- `app/manifest.ts` で `MetadataRoute.Manifest` を返す: `name`, `short_name`, `description`, `start_url: '/'`, `display: 'standalone'`, `background_color`, `theme_color`, `icons`（192/512 PNG） — [vercel/next.js progressive-web-apps.mdx](https://github.com/vercel/next.js/blob/canary/docs/01-app/02-guides/progressive-web-apps.mdx)
- SW 登録は `navigator.serviceWorker.register(new URL('../lib/service-worker.js', import.meta.url), { scope: '/', updateViaCache: 'none' })`、購読は `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(NEXT_PUBLIC_VAPID_PUBLIC_KEY) })`、購読オブジェクトは `JSON.parse(JSON.stringify(sub))` でシリアライズして Server Action に渡す — [同上](https://github.com/vercel/next.js/blob/canary/docs/01-app/02-guides/progressive-web-apps.mdx)
- Server Action 側: `webpush.setVapidDetails('mailto:...', NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)`、`webpush.sendNotification(subscription, JSON.stringify({ title, body, icon }))`。「本番では購読を DB に保存する」と明記 — [同上](https://github.com/vercel/next.js/blob/canary/docs/01-app/02-guides/progressive-web-apps.mdx)
- VAPID 鍵生成: `npx web-push generate-vapid-keys`（`--json` も可）→ `.env` に `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — [同上](https://github.com/vercel/next.js/blob/canary/docs/01-app/02-guides/progressive-web-apps.mdx); [web-push README](https://github.com/web-push-libs/web-push/blob/master/README.md)
- SW 例: `push` で `event.data.json()` → `event.waitUntil(self.registration.showNotification(data.title, { body, icon, badge: '/badge.png', vibrate: [100,50,100], data }))`、`notificationclick` で `event.notification.close(); event.waitUntil(clients.openWindow(url))` — [同上](https://github.com/vercel/next.js/blob/canary/docs/01-app/02-guides/progressive-web-apps.mdx)
- セキュリティヘッダ例: `/sw.js` に `Content-Type: application/javascript; charset=utf-8`、`Cache-Control: no-cache, no-store, must-revalidate`、`Content-Security-Policy: default-src 'self'; script-src 'self'`。ローカルテストは `next dev --experimental-https` — [同上](https://github.com/vercel/next.js/blob/canary/docs/01-app/02-guides/progressive-web-apps.mdx)

**web-push API 詳細**
- `sendNotification(pushSubscription, payload, options)` の `options`: `vapidDetails {subject, publicKey, privateKey}`、`timeout`（ソケットタイムアウト ms）、`TTL`（秒。push サービスが保持する期間）、`headers`（追加ヘッダ）、`urgency`（`very-low|low|normal|high`、即時配信は `high`）、`topic`（32 文字以内の URL-safe Base64、同一 topic の未配信メッセージを置換）、`proxy`、`agent`。VAPID `subject` は `https:` か `mailto:` URI。**Safari の push エンドポイントは `https://localhost` を subject にすると `BadJwtToken` で拒否** — [web-push README](https://github.com/web-push-libs/web-push/blob/master/README.md)
- 失敗時は `statusCode`、`headers`、`body` を持つ `WebPushError` で reject される — [同上](https://github.com/web-push-libs/web-push/blob/master/README.md)

**404/410 処理・購読整理**
- Pushpad: 404 と 410 は「購読が存在しない/失効」のシグナルで、送信側は DB から削除すべき（RFC 8030 §7.3 の意図） — [pushpad.xyz web-push-error-410](https://pushpad.xyz/blog/web-push-error-410-the-push-subscription-has-expired-or-the-user-has-unsubscribed)
- DEV Community 事後検証: クライアントライブラリがエラー時に返さないレスポンスに対し 410 判定していたため削除が一度も走らず、死んだ購読が溜まり続けた — [dev.to tonytonycoder11](https://dev.to/tonytonycoder11/the-cleanup-that-could-never-run-a-silent-web-push-leak-in-go-1kaj)
- Pushpad: 一部 push サービスは放置された購読に 2xx を返し続けるので、ステータスコードだけに頼らず古い購読を間引く — [pushpad.xyz how-to-check-if-a-push-endpoint-is-still-valid](https://pushpad.xyz/blog/web-push-how-to-check-if-a-push-endpoint-is-still-valid)
- WebKit 249766: unsubscribe 後の 410 は保証されず遅延も非決定的。訪問時に現在の購読を送って不一致を削除せよ — [bugs.webkit.org 249766](https://bugs.webkit.org/show_bug.cgi?id=249766)

**notificationclick / 深いリンク**
- MDN `notificationclick` 例: `clients.matchAll({ type: 'window' })` で既存ウィンドウを探し `client.focus()`、無ければ `clients.openWindow('/')`。全体を `event.waitUntil()` で包む。`event.action` で通知ボタンを分岐 — [mdn/content notificationclick_event](https://github.com/mdn/content/blob/main/files/en-us/web/api/serviceworkerglobalscope/notificationclick_event/index.md)
- MDN `Clients.openWindow()`: 少なくとも 1 つのウィンドウに transient activation が必要（通知クリックは該当）。**`Client.url` は実ページ読み込み時しか更新されず、SPA がクライアント側遷移した場合は古いままなので URL 一致でフォーカスする手法は SPA には不向き** — [mdn/content clients/openwindow](https://github.com/mdn/content/blob/main/files/en-us/web/api/clients/openwindow/index.md)
- Declarative Web Push では `default_action_url` / `actions[].url` を直接開くため `notificationclick` を経由しない — [WebKit/explainers DeclarativeWebPush](https://github.com/WebKit/explainers/blob/main/DeclarativeWebPush/README.md)

### Inferences（実装設計）
- **推奨構成**: `app/manifest.ts`（公式）+ `public/sw.js` 手書き（push / notificationclick / pushsubscriptionchange のみ。オフラインは Next.js の `useOffline` か後付け Serwist）+ `web-push@3.6.7` を Route Handler/Server Action から呼ぶ + Postgres `push_subscriptions` テーブル。1 人運用でオフラインキャッシュの価値は低く、SW のバグが push 配信を壊すリスク（iOS は SW 例外で許可取り消し）の方が大きいので、**最初は SW を最小にする**。
- Serwist を入れる場合は Next 16 + Turbopack なら `@serwist/turbopack`、`swUrl="/serwist/sw.js"` を SerwistProvider に渡す。`skipWaiting`/`clientsClaim` を true にすると更新即時反映。push ハンドラは `serwist.addEventListeners()` の後に `self.addEventListener('push', ...)` を追加すればよい（Serwist は Workbox フォークで push を扱わない）。
- **Postgres スキーマ案**
  ```sql
  create table push_subscriptions (
    id            bigserial primary key,
    user_id       text not null,            -- admin user
    endpoint      text not null unique,
    p256dh        text not null,
    auth          text not null,
    expiration_time timestamptz,
    user_agent    text,
    platform      text,                     -- 'ios' | 'android' | 'desktop'
    created_at    timestamptz not null default now(),
    last_seen_at  timestamptz not null default now(),
    last_success_at timestamptz,
    fail_count    int not null default 0
  );
  ```
- **送信ロジック（Route Handler / Server Action）**
  ```ts
  import webpush from 'web-push';
  webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);

  export async function notifyAdmins(payload: PushPayload, opts: { topic?: string; urgency?: 'high'|'normal' } = {}) {
    const subs = await db.pushSubscriptions.findMany({ where: { user_id: ADMIN_ID } });
    await Promise.allSettled(subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 6, urgency: opts.urgency ?? 'high', topic: opts.topic, timeout: 8000 }
        );
        await db.pushSubscriptions.update({ where: { id: s.id }, data: { last_success_at: new Date(), fail_count: 0 } });
      } catch (e: any) {
        const code = e?.statusCode;
        if (code === 404 || code === 410) {
          await db.pushSubscriptions.delete({ where: { id: s.id } });   // expired / unsubscribed
        } else {
          await db.pushSubscriptions.update({ where: { id: s.id }, data: { fail_count: { increment: 1 } } });
        }
      }
    }));
  }
  ```
  `topic` は `booking-<id>` 等（32 文字以内）。`urgency: 'high'` は新規予約・キャンセル向け、日次サマリーは `normal`。`timeout` を設定し、Vercel の関数制限（Q5）内で確実に返す。
- **クライアント起動時の整合**（iOS の静かな失効対策）: `app/(admin)/layout.tsx` 配下のクライアントコンポーネントで `navigator.serviceWorker.ready → pushManager.getSubscription()`。非 null → `POST /api/push/heartbeat { endpoint }` で `last_seen_at` 更新 + 同一 user の他エンドポイントは削除しない（複数端末想定）が、**同一 `platform`+`user_agent` で `last_seen_at` が 14 日以上古いものは削除**。null かつ `Notification.permission === 'granted'` → 「通知が無効になっています。再度有効にする」ボタン（ユーザー操作で `subscribe()`）。
- **SW（最小）**
  ```js
  self.addEventListener('push', (event) => {
    const data = event.data?.json() ?? { title: '新しい通知', options: {} };
    const { title, options = {}, default_action_url, app_badge } = data; // same shape as Declarative Web Push
    event.waitUntil((async () => {
      await self.registration.showNotification(title, { ...options, data: { url: default_action_url, ...(options.data ?? {}) } });
      if (typeof app_badge === 'number' && 'setAppBadge' in self.navigator) {
        try { await self.navigator.setAppBadge(app_badge); } catch {}
      }
    })());
  });

  self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data?.url ?? '/admin';
    event.waitUntil((async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const client = all.find((c) => 'focus' in c);     // do not match on URL: SPA client.url is stale
      if (client) { await client.focus(); client.postMessage({ type: 'NAVIGATE', url }); return; }
      await self.clients.openWindow(url);
    })());
  });

  self.addEventListener('pushsubscriptionchange', (event) => {   // Android/Chrome only; iOS never fires this
    event.waitUntil((async () => {
      const sub = await self.registration.pushManager.subscribe(event.oldSubscription?.options ?? { userVisibleOnly: true, applicationServerKey: VAPID_PUBLIC_KEY_BYTES });
      await fetch('/api/push/subscribe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ old: event.oldSubscription?.endpoint, sub }) });
    })());
  });
  ```
  ページ側では `navigator.serviceWorker.addEventListener('message', e => e.data?.type === 'NAVIGATE' && router.push(e.data.url))` で深いリンクを処理する（`client.url` 一致判定が SPA で効かない MDN の注意に対応）。
- **ペイロード形式**を最初から Declarative Web Push の JSON（`title`/`options`/`default_action_url`/`app_badge`）に揃えておけば、将来 `Content-Type: application/notification+json` を付けるだけで iOS 18.4+ の宣言的配信に切り替えられる。
- `userVisibleOnly: true` は必須（Chrome は false を拒否、iOS もサイレント不可）。
- VAPID 鍵は一度生成したら固定（鍵を変えると既存購読が全て無効）。`VAPID_SUBJECT` は本番ドメインの `mailto:` か `https://` にする（`https://localhost` は Safari が拒否）。
- 管理画面のルートが `/admin` なら `start_url: '/admin'`、`scope: '/admin'` とし、顧客向け予約サイトと SW のスコープを分けると、顧客側に不要な SW を登録せずに済む（manifest も `/admin/manifest.webmanifest` を別出し。Next の `app/admin/manifest.ts` は非対応なので Route Handler で返す）。

### Gaps
- Serwist 公式ドキュメント（serwist.pages.dev）は取得不可。Push と Serwist の組み合わせ手順は公式 example に無く、上記は Workbox 系の一般知識からの推論。
- `web-push` で `Content-Type` ヘッダを `headers` オプションで上書きしたとき、内部の暗号化ヘッダ（`Content-Encoding: aes128gcm`）と競合しないかは未検証。Declarative Web Push 送信は実機検証が必要。
- web-push 3.6.7 以降のリリース（2024-01 以降更新なし）と Node 22/Vercel ランタイムでの ESM 互換は未確認。

---

## Q4. Push は best-effort — 信頼性向上策（アプリ内バッジ/件数、ポーリング、日次サマリー、二次チャネルの 2026 年コスト）

### Takeaway
Push 単独に依存せず、(1) 管理画面起動時の未確認件数表示 + 可視時ポーリング、(2) 日次サマリー、(3) 二次チャネルを組み合わせる。二次チャネルは、LINE Messaging API（コミュニケーションプラン月 200 通無料、2026/10/1 以降の追加料金は 20 万通まで 3 円/通）、Resend（無料 3,000 通/月・100 通/日・1 ドメイン）が低コストで、SMS（Twilio 日本宛 約 $0.08–0.089/通）は高い。

### Cited Findings
- MDN: Push API は「アプリが動いていなくてもサーバからメッセージを受信できる」が、**ほとんどのブラウザは push 受信のたびに通知表示を要求**し、通知なしで静かにバッジだけ更新することはできない。ユーザーの通知許可が必須 — [mdn/content display_badge_on_app_icon](https://github.com/mdn/content/blob/main/files/en-us/web/progressive_web_apps/how_to/display_badge_on_app_icon/index.md)
- MDN: Periodic Background Sync は登録した `minInterval` に関係なく発火頻度はブラウザ任せで、よく使うアプリほど多く発火する — [mdn/content offline_and_background_operation](https://github.com/mdn/content/blob/main/files/en-us/web/progressive_web_apps/guides/offline_and_background_operation/index.md)
- web-push: `TTL`（push サービス側保持秒数）、`urgency: 'high'` で即時配信要求、`topic` で未配信メッセージの置換が可能 — [web-push README](https://github.com/web-push-libs/web-push/blob/master/README.md)
- Pushpad: 古い購読ほど配信率が低下する — [pushpad.xyz subscription-age](https://pushpad.xyz/blog/web-push-subscription-age-affects-delivery-rates)
- **LINE Messaging API 料金（日本）**: コミュニケーションプラン 月額 0 円・無料 200 通/月（追加不可）、ライト 5,000 円・5,000 通（追加不可）、スタンダード 15,000 円・30,000 通（追加 〜3 円/通）。課金対象は Push/Multicast/Broadcast/Narrowcast API、**Reply API は課金対象外** — [developers.line.biz Messaging API の料金](https://developers.line.biz/ja/docs/messaging-api/pricing/); [ligla.jp 解説](https://ligla.jp/blog/line-official/cost/)
- LINE ヤフー公式告知: **2026 年 10 月 1 日に追加メッセージ料金を改定**。20 万通/月までは 1 通 3 円、20 万通超は 1 通 2.5 円（税別）、適用対象国は日本のみ。従来の多段階制から 2 段階へ — [lycbiz.com news 20260216](https://www.lycbiz.com/jp/news/line-official-account/20260216/); [lycbiz.com news 20261001](https://www.lycbiz.com/jp/news/line-official-account/20261001/)
- **Resend 無料プラン**: 3,000 通/月、**100 通/日**、1 ドメイン。超過時は課金されず送信停止。Pro $20/月で 50,000 通、日次上限なし。受信メールも同一クォータにカウント。ログ保持期間はソースにより 1 日/30 日で不一致 — [resend.com/pricing](https://resend.com/pricing.md); [automationatlas.io](https://automationatlas.io/answers/resend-free-tier-explained-2026/); [wpmailsmtp.com review](https://wpmailsmtp.com/resend-review/)
- **Twilio SMS 日本宛**: ショートコード $0.0800/通、ロングコード $0.0890/通、英数字送信者 ID $0.089/通（セグメント単位課金、失敗メッセージにも $0.001/通）。キャリア追加料金・予告なし変更あり — [twilio.com/ja/sms/pricing/jp](https://www.twilio.com/ja/sms/pricing/jp)
- Vercel Hobby の cron は **1 日 1 回・時間単位精度**（Q5 参照）であり、日次サマリーには使えるが「30 分前リマインド」には使えない — [vercel.com/docs/cron-jobs/usage-and-pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)

### Inferences
- **多層通知設計（本案件向け）**
  1. **即時**: 新規予約/キャンセル → Web Push（iOS/Android）。`urgency: 'high'`、`TTL: 6h`、`topic: booking-<id>`。
  2. **同時に LINE Push**（理容師本人の LINE へ、1 日数通 × 30 日 ≪ 200 通/月）。コミュニケーションプランの 200 通は「新規予約・キャンセル・日次サマリー」合計で月 200 件以下なら無料に収まる。超えそうなら LINE をキャンセル通知のみに絞る、またはメールへ。
  3. **メール（Resend 無料）**: 全イベントのバックアップ + 日次サマリー。100 通/日に十分収まる。
  4. **SMS は不採用**（1 通約 13 円換算 + 送信者 ID 登録手続き）。重要度が高いキャンセルだけに限定する選択肢として残す。
- **アプリ内の整合**: `bookings.acknowledged_at`（管理者が開いた/確認した時刻）を持ち、管理 PWA のヘッダに「未確認 n 件」バッジを表示。起動時と `visibilitychange` で `GET /api/admin/inbox?since=` を取得、画面が可視の間は 60 秒ごとにポーリング（Vercel の関数コールは安価）。これで Push 取りこぼしを「次に開いたとき」に必ず回収できる。
- **日次サマリー**: Vercel cron（Hobby: 1 日 1 回、UTC 指定）で「明日の予約一覧」を Push + LINE/メールで 21:00 JST 頃（= 12:00 UTC、時間単位のズレ ±59 分を許容）に送る。
- **ヘルスチェック**: 管理画面の設定ページに「テスト通知を送る」ボタンを置き、届かなければ Q1 の切り分け手順を画面内に表示する。
- 週次でサーバ側から「購読が 0 件」「`last_seen_at` が 7 日以上更新なし」を検知したら、メール/LINE で「アプリを開いて通知を再有効化してください」と案内する。

### Gaps
- LINE の「公式アカウント運用（LINE 公式アカウント開設 + Messaging API チャネル連携）」の 2026 年の手順・審査有無は未調査。
- Resend の日本発送信時の到達性・SPF/DKIM 設定は本調査範囲外。
- Twilio 以外の国内 SMS 事業者（KDDI、NTT Com 等）の 2026 年単価は未調査。

---

## Q5. Vercel 固有の制約（関数タイムアウト、Hobby の cron 制限）

### Takeaway
Fluid compute 有効時、Hobby の関数最大実行時間は 300 秒（旧 60 秒から引き上げ）で、push 送信は数秒で終わるため問題ない。Hobby の cron は最大 100 ジョブだが **各ジョブは 1 日 1 回のみ・時間単位精度（±59 分）・UTC・配信は best effort（再実行なし）**。分単位スケジュールは Pro 以上。

### Cited Findings
- Vercel Functions limits: Fluid compute 有効時、**Hobby は既定 300s・最大 300s**（延長不可）、Pro/Enterprise は既定 300s・最大 800s・拡張最大 1800s。超過時は 504 `FUNCTION_INVOCATION_TIMEOUT` — [vercel.com/docs/functions/limitations](https://vercel.com/docs/functions/limitations)
- Vercel changelog: 全プランの既定実行時間が 300 秒に、Hobby 最大は 60s → 300s — [vercel.com/changelog higher-defaults-and-limits](https://vercel.com/changelog/higher-defaults-and-limits-for-vercel-functions-running-fluid-compute)
- Vercel cron docs（2026-01-28 更新）: Hobby は **最大 100 cron ジョブ**、各ジョブは **1 日 1 回**、精度は時間単位（±59 分）。Pro/Enterprise は毎分実行可・分単位精度。より頻繁な式はデプロイ時に失敗。Hobby では「タイムリーな実行を保証しない」 — [vercel.com/docs/cron-jobs/usage-and-pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- 第三者ブログ（runhooks）は「Hobby は 2 ジョブ/プロジェクト」と記載するが、公式ドキュメント（100）と矛盾。公式を正とする — [runhooks.app](https://runhooks.app/blog/vercel-hobby-cron-job-limits-explained/); [crontap.com](https://crontap.com/blog/vercel-cron-hourly-limit-and-how-to-beat-it)
- Vercel Community / LogRocket: cron の時刻は **UTC**（17:05 と書けば UTC 17:05） — [community.vercel.com](https://community.vercel.com/t/cron-jobs-not-running/4606); [blog.logrocket.com](https://blog.logrocket.com/?p=179095)
- `CRON_SECRET` 環境変数を設定すると Vercel が `Authorization: Bearer <secret>` を付けて呼び出す。ハンドラは照合し不一致なら 401。配信は best effort で重複/欠落あり、失敗時の再試行なし → 冪等に — [temperstack.com](https://www.temperstack.com/learn/vercel/add-cron-jobs/); [cronuru.com](https://cronuru.com/guides/vercel-cron)

### Inferences
- 新規予約時の push 送信は **予約作成の Server Action / Route Handler 内で `await` せず `after()`（Next.js の `unstable_after`/`after`）やレスポンス後処理で実行**するか、単純に `await Promise.allSettled` で同期送信（購読数は 1〜3 件、各 `timeout: 8000ms`）する。300 秒上限には遠く及ばない。
- 日次サマリーは `vercel.json` の `crons: [{ path: '/api/cron/daily-digest', schedule: '0 12 * * *' }]`（= 21:00 JST）。ハンドラで `digest_sent_on = today(JST)` を記録して重複送信を防ぐ（best-effort で二重起動あり得る）。
- 「予約 1 時間前リマインド」のような分単位ジョブは Hobby では不可。代替は (a) 管理 PWA 起動時/可視時にクライアント側で算出して `setTimeout` 表示（アプリ非起動時は不可）、(b) 外部スケジューラ（GitHub Actions cron は最短 5 分間隔、または Upstash QStash / cron-job.org 等）から Route Handler を叩く、(c) Pro プラン。顧客向けリマインドは本稿スコープ外。
- cron ハンドラは `CRON_SECRET` 照合 + `export const maxDuration = 60` 程度を指定。

### Gaps
- Hobby プランの商用利用可否（Vercel の Fair Use / Hobby は非商用という規約）は本調査で未確認。理容室の業務利用なら Pro（$20/月）が規約上必要になる可能性が高く、要確認。
- 2026 年の Hobby 関数実行時間/呼び出し回数の無料枠（GB-hours 等）は未取得。

---

## Q6. ソロ事業者向け管理ダッシュボード UX（今日ビュー、週ビュー、クイック操作、競合表示、Undo、オフライン、タッチターゲット、ダークモード）と既存アプリの例

### Takeaway
既存の主要アプリ（Square Appointments、Fresha、Cal.com Companion、サロンボード）に共通するのは「カレンダー（日/週）を中心に、+ ボタンから予約作成/時間ブロックを即座に行え、ブロックは顧客側の空き枠から消える」設計。タッチターゲットは iOS HIG 44pt / Material 48dp / WCAG 2.5.8 AA 24px を満たし、ダークモードはトークン化して自動追従させる。

### Cited Findings
- **Square Appointments**: 時間ブロックは「Personal Event」で実現。アプリではカレンダーの **+ → Create Personal Event**、「Block Time」が自動でオンになり、オフなら切り替えてオンライン予約の空きから除外。Web ではカレンダー上をクリック/ドラッグして範囲選択 → Personal Event。メモ・日時・終日・繰り返しを指定可能。顧客の予約ページには個人イベントは表示されない — [squareup.com/help/gb/article/5533](https://squareup.com/help/gb/article/5533)
- Square コミュニティ: 固定の開始時刻だけ受けたい場合は「手動承認」「スタッフの稼働時間調整」「サービスに準備時間/ブロック時間を付与」で対応（モデレータ回答、公式仕様ではない） — [community.squareup.com](https://community.squareup.com/t5/Archived-Discussions-Read-Only/Square-Appointments-Is-there-a-way-to-schedule-in-time-blocks/td-p/65711)
- **Fresha**: 「スマートで柔軟なカレンダー」、予約は 24/7 受付でカレンダーに即時反映、Intelligent Waitlist で直前キャンセル枠を自動補充、カレンダー同期で私用予定を統合、自動確認・ノーショー防止ツール。サブスク無料で決済手数料で収益化。2026 年 5 月の Intelligent Scheduling は複数スタッフ向けでソロには恩恵が少ない（競合ブログの評） — [fresha.com scheduling](https://fresha.com/for-business/features/scheduling); [usecarly.com fresha-ai](https://www.usecarly.com/blog/fresha-ai/)
- **Cal.com Companion App（iPhone）**: 数タップで予約の作成・変更・キャンセル、カレンダー同期で空き枠表示とダブルブッキング防止、今後の予定/リマインド/確認の push 通知 — [apps.apple.com Cal.com](https://apps.apple.com/ca/app/cal-com/id6757157271)
- **サロンボード（リクルート）**: PC 版は 14 日分の予約をカレンダーで一覧、予約が入った際の通知メールを設定可能（販売側解説）。公式アプリの「今日の予約」画面や push 仕様は検索結果から確認できず。「サロンボードマスター2」は個人開発の非公式アプリ（要サブスク） — [lifestyle.assist-all.co.jp](https://lifestyle.assist-all.co.jp/salonboard-reservation-customer-management-guide/); [apps.apple.com サロンボードマスター2](https://apps.apple.com/jp/app/id6746419020)
- **タッチターゲット**: Apple HIG 最小 44×44pt、Material 48×48dp、WCAG 2.2 SC 2.5.5（AAA）44×44 CSS px / SC 2.5.8（AA）24×24 CSS px — [skills.sh touch-targets](https://www.skills.sh/thedaviddias/front-end-checklist/touch-targets); [openreplay tap targets](https://blog.openreplay.com/improving-tap-targets-mobile-ux/)
- **ダークモード**: Apple はセマンティックなシステムカラーで自動適応させ固定 hex を公開しない。ハードコード色を避ける — [superdesign.dev apple-design-system](https://www.superdesign.dev/blog/apple-design-system)
- **standalone 表示の検出/調整**: CSS `@media (display-mode: standalone)` と `window.matchMedia('(display-mode: standalone)').matches` でインストール時のみの UI（戻るボタン等）を出す。独自ナビが無いなら `minimal-ui` も選択肢 — [mdn/content create_a_standalone_app](https://github.com/mdn/content/blob/main/files/en-us/web/progressive_web_apps/how_to/create_a_standalone_app/index.md)
- Next.js `useOffline`（実験的）: 接続状態に応じた UI と、失敗したナビゲーション/Server Action の自動再試行 — [vercel/next.js progressive-web-apps.mdx](https://github.com/vercel/next.js/blob/canary/docs/01-app/02-guides/progressive-web-apps.mdx)
- MDN: Background Sync は短時間のタスク向けで、SW が一定時間内に終わらないと停止される。オフライン送信の再送に適する — [mdn/content offline_and_background_operation](https://github.com/mdn/content/blob/main/files/en-us/web/progressive_web_apps/guides/offline_and_background_operation/index.md)

### Inferences（画面設計案）
- **情報構造（ボトムタブ 3〜4 個）**: 「今日」「週」「受信箱（未確認）」「設定」。`start_url` は「今日」。
- **今日ビュー**: 縦タイムライン（営業時間 9:00–20:00 を 15 分刻み、現在時刻ライン）。各予約カードは高さ ≥ 56px、左にサービス色、タップで詳細シート。カード内に電話リンク（`tel:`）と「来店済み/キャンセル」のスワイプアクション。ヘッダに「未確認 n 件」バッジ（Q4）。
- **週ビュー**: 7 列の密度の高い概観（件数と空き率）。セルタップで日ビューへ。
- **クイック操作（FAB「+」）**: 「手動予約」「時間をブロック」の 2 択（Square の Personal Event 相当）。ブロックは「今から 30 分 / 1 時間 / 終日 / 期間指定」のプリセットで 2 タップ完結。
- **競合表示**: 手動予約/ブロック作成時にサーバで重なりを判定し、保存前に「14:00–14:30 の山田様と重なります」を赤で表示、`[それでも保存]`（ダブルブッキングを意図的に許容）と `[時間を変更]`。顧客側 API はブロック/予約済み枠を空きから除外（Square と同じ原則）。
- **Undo**: キャンセル・削除・ブロックは即時実行 + 画面下トースト「取り消す（5 秒）」。実装は `status='cancelled', cancelled_at` のソフトデリート + 5 秒間の復元エンドポイント。顧客への通知メール送信はトーストの猶予後にキューイングすることで誤操作を防ぐ（一般的 UX パターン。一次資料は本調査では取得できず）。
- **オフライン**: Next.js `useOffline` で「オフライン」バナー + 直近に取得した今日の一覧を SWR/React Query のキャッシュから表示（読み取り専用）。書き込みは「オンライン復帰時に再試行」。Serwist 導入時は `/~offline` フォールバックと `cacheOnNavigation`。
- **タッチ/視認性**: すべてのボタン ≥ 44×44px、主要アクションは画面下部（親指圏）、フォント最小 16px（iOS のフォーカス時ズーム回避）、`viewport-fit=cover` と `env(safe-area-inset-*)` でノッチ回避。
- **ダークモード**: `prefers-color-scheme` 追従をデフォルトにし、設定で固定も可。manifest の `theme_color` と `<meta name="theme-color" media="(prefers-color-scheme: dark)">` を両方指定。夜間の閉店後確認を想定し、コントラスト AA 以上。
- **standalone で消える戻る操作**: iOS のホーム画面アプリにはブラウザの戻るボタンが無いので、詳細画面には必ず明示的な「←」を置く。

### Gaps
- Square/Fresha/サロンボードの **具体的な画面構成（今日ビューの密度、通知音、既読管理）** は公式ヘルプのスクリーンショットを取得できておらず、機能説明文からの推定。
- Undo パターン・確認ダイアログの代替に関する NN/g 等の一次資料は WebSearch 予算切れで未取得。
- ホットペッパービューティー/サロンボード公式アプリの「新規予約 push 通知」の有無と仕様は未確認。

---

## Q7. 管理 PWA のセキュリティ（standalone でのセッション永続・iOS Cookie の癖、ログアウト、端末紛失）

### Takeaway
iOS のホーム画面ウェブアプリは Safari と**別ストレージパーティション**で動き、追加時に Cookie が一度だけコピーされる。したがって「Safari でログイン → ホーム画面に追加」では以降のセッション更新が共有されず、iOS 17.x にはセッション Cookie が消える回帰バグもあった。管理 PWA では**アプリ内でログインさせ、長寿命の永続 Cookie（`Max-Age` 明示）+ サーバ側セッション失効（全端末ログアウト）**を用意し、パスキー/Face ID は WebAuthn で利用可能。

### Cited Findings
- Progressier（ベンダー解説）: インストール済み PWA は Safari と別のストレージパーティションを使い、**iOS はホーム画面追加時に一度だけ Cookie をコピー**する。以後 Safari 側のログアウト/セッション変更は PWA に反映されず逆も同様 — [progressier.com cookies-demo](https://progressier.com/pwa-capabilities/cookies-demo)
- WebKit Bugzilla 272325（iOS 17.2〜17.4.1 回帰）: ホーム画面アプリでセッション Cookie がランダムにリセット。`document.cookie` は正しいのに `Cookie` ヘッダが古い値 — [bugs.webkit.org 272325](https://bugs.webkit.org/show_bug.cgi?id=272325)
- Discourse メタ: iOS PWA で「新しい Cookie を受け取ったと返すのに忘れる」、ネットワーク断復帰で再現、WebKit 185400 が PWA/Safari の Cookie コンテキスト分離の追跡バグとして引用 — [meta.discourse.org logged-out-of-forum-on-ios](https://meta.discourse.org/t/logged-out-of-forum-on-ios/60298)
- Apple Forums 825918: 特定セクションでアプリを閉じると PWA が壊れ、再インストールでしか直らない（iOS のみ、Android は問題なし） — [developer.apple.com/forums/thread/825918](https://developer.apple.com/forums/thread/825918)
- Apple Forums 740590: iPad を長期間オフにした場合の PWA データ/Cookie 消去に関する質問スレッド（結論は未確認） — [developer.apple.com/forums/thread/740590](https://developer.apple.com/forums/thread/740590)
- WebAuthn/パスキー: Yubico ガイド「iOS 16 では Face ID で作成したパスキーは同期可能（iCloud キーチェーン）、セキュリティキーは同期されない」。Progressier のデモは「PWA をホーム画面から起動してパスキー作成・認証が可能」と主張（ベンダーデモ） — [developers.yubico.com Register_Only_Face_ID](https://developers.yubico.com/Mobile_Dev/WebAuthn/IOS/Register_Only_Face_ID.html); [progressier.com biometric-authentication-with-passkeys](https://progressier.com/pwa-capabilities/biometric-authentication-with-passkeys)
- Next.js 公式: 全ルートに `X-Content-Type-Options: nosniff`、`X-Frame-Options: DENY`、`Referrer-Policy: strict-origin-when-cross-origin`、SW に厳格な CSP — [vercel/next.js progressive-web-apps.mdx](https://github.com/vercel/next.js/blob/canary/docs/01-app/02-guides/progressive-web-apps.mdx)

### Inferences
- **ログインはアプリ内で**: 「Safari でログインしてから追加」ではなく、追加後にアプリ内でログインする導線にする（ストレージ分離のため）。オンボーディングの順序は「ホーム画面に追加 → アプリを開く → ログイン → 通知をオン」。
- **Cookie 設計**: `Set-Cookie: session=...; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`（30 日程度）で**セッション Cookie（有効期限なし）を避ける**。iOS 17.x の回帰がセッション Cookie を対象にしていたこと、ホーム画面アプリは頻繁にプロセス終了されることから、永続 Cookie の方が安定。サーバ側でセッションをローリング更新（アクセスごとに `Max-Age` 延長）。
- **サーバ側セッション**（Postgres の `sessions` テーブル: `id`, `user_id`, `device_label`, `created_at`, `last_seen_at`, `revoked_at`）にして、**設定画面に「ログイン中の端末一覧」と「この端末以外をすべてログアウト」**を用意。端末紛失時は PC から全セッション失効 + push 購読の全削除（通知内容に顧客名が含まれるため）。
- **通知本文の情報量**: 通知には「新規予約 14:00 カット（山田様）」程度に留め、電話番号などは含めない（ロック画面に表示されるため）。iOS の設定でプレビュー非表示にできる旨を案内。
- **二要素/パスキー**: 1 人運用なので「メールのマジックリンク + 端末登録」または WebAuthn パスキー（Face ID）を推奨。パスキーは iCloud キーチェーンで同期されるため機種変更にも強い。管理画面のオリジン（RP ID）は顧客サイトと同一ドメインでよい。
- **ログアウト時**: `pushManager.getSubscription()?.unsubscribe()` + サーバの購読削除を行い、他人に端末を渡しても通知が届かないようにする。
- **CSP/ヘッダ**: 公式例に加え `Permissions-Policy` と `Strict-Transport-Security` を追加。SW ファイルは `Cache-Control: no-cache` で常に最新化。
- **ブルートフォース対策**: 管理ログインはレート制限（Upstash Ratelimit 等）+ 固定ユーザー 1 名なので IP ではなくアカウント単位でロック。

### Gaps
- iOS 26 時点で WebKit 272325 / 185400 が修正済みかはバグトラッカー（取得不可）で未確認。
- Safari の ITP による「スクリプト書き込みストレージ 7 日で削除」がホーム画面ウェブアプリに適用されるか（適用除外か）は、WebSearch 予算切れで一次資料を確認できなかった。HttpOnly の永続 Cookie を使えば ITP のスクリプト書き込み制限の対象外になる、という設計で回避できる。
- WebAuthn をホーム画面ウェブアプリ（standalone）内で使う際の 2026 年時点の制限（クロスオリジン iframe 不可等）は Apple 一次資料未確認。

---

## Q8. （補足）実装チェックリスト・テスト手順

### Takeaway
iOS 実機での検証項目が多いため、下記チェックリストで受け入れテストを定義する。

### Cited Findings
- Next.js 公式: ローカル検証は `next dev --experimental-https`、ブラウザ側の通知が無効化されていないことを確認、ダメなら別ブラウザで切り分け — [vercel/next.js progressive-web-apps.mdx](https://github.com/vercel/next.js/blob/canary/docs/01-app/02-guides/progressive-web-apps.mdx)
- web-push CLI: `web-push send-notification --endpoint=<url> --key=<p256dh> --auth=<auth> --payload=<msg> --vapid-subject=mailto:... --vapid-pubkey=... --vapid-pvtkey=... [--ttl=] [--encoding=aes128gcm]` で DB の購読に対し手動テスト送信できる — [web-push README](https://github.com/web-push-libs/web-push/blob/master/README.md)
- 第三者ガイド: インストールプロンプト等の PWA 機能は production build で検証する — [docs.monad.xyz next-serwist](https://docs.monad.xyz/templates/next-serwist-thirdweb)

### Inferences
- **受け入れテスト（iOS 実機, iOS 26 推奨 + 可能なら 17.x）**
  1. Safari タブで `/admin` を開く → 通知ボタンが出ず「ホーム画面に追加」案内が出る。
  2. 共有 → ホーム画面に追加 → アイコン起動 → standalone 表示（URL バーなし）。
  3. アプリ内ログイン → 「通知をオンにする」タップ → OS ダイアログ → 許可 → DB に購読行が 1 件。
  4. 設定の「テスト通知」→ 通知が届き、タップで `/admin/bookings/<id>` が開く（アプリが閉じている状態・開いている状態・ロック画面の 3 パターン）。
  5. 顧客サイトから予約 → 10 秒以内に通知 + バッジ数が増える → アプリ起動でバッジ 0。
  6. 端末再起動後、アプリ非起動で予約 → 通知が届く。
  7. 1 週間後に起動 → 購読がまだ有効（`getSubscription()` 非 null）か、無効なら再購読バナーが出る。
  8. 機内モードで起動 → 今日の一覧がキャッシュから表示され「オフライン」バナーが出る。
  9. 「この端末以外をログアウト」→ 他端末のセッションが失効、購読も削除。
- **Android（Chrome）**: `beforeinstallprompt` 由来のインストールボタン、richer install UI にスクリーンショットが表示されること、`tag`/`topic` による通知置換、`pushsubscriptionchange` 後の再登録（Chrome の DevTools > Application > Service Workers で "Push" / "Unregister" を使う）。
- **サーバ**: 410 を返すダミーエンドポイント（または削除済み購読）で削除ロジックの単体テスト。`WebPushError.statusCode` を見ていることを確認（DEV の事例の再発防止）。

### Gaps
- iOS シミュレータでは Web Push を検証できない（実機必須）という点は経験則で、本調査では一次資料を確認していない。
