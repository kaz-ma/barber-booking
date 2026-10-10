# 04 技術アーキテクチャ（Next.js on Vercel + マネージド Postgres）

> 調査日: 2026-10-10。対象: 1スタイリスト・1チェア、即時確定予約、30分刻み 18:00–24:00 JST、月曜定休、全メニュー60分（将来はメニューごとの所要時間を可変に）、管理者の手動予約・時間ブロック、トークン式キャンセルリンク（アカウント・メールなし）、JP/EN 二言語、まず vercel.app → 後に独自ドメイン、将来フェーズでチャットとカルテ。
>
> 調査環境の制約: この環境では nextjs.org / vercel.com / supabase.com / neon.com / zenn.dev などへの直接 HTTP 取得がプロキシ（403）で拒否されたため、一次資料は主に (a) `npm pack next@16.4.0` で取得した **Next.js 16.4.0 同梱の公式ドキュメント**（`node_modules/next/dist/docs/`）、(b) raw.githubusercontent.com 経由の各ベンダー公式ドキュメント／ソースのリポジトリ（supabase/supabase, neondatabase/website, amannn/next-intl, postgres/postgres, nextauthjs/next-auth, better-auth/better-auth, calcom/cal.com, getsentry/sentry-docs, OWASP/CheatSheetSeries）、(c) npm レジストリのメタデータ、(d) Web 検索結果の要約、で構成した。Vercel の料金・上限ページ本文は取得できず、検索要約（一部は第三者サイト）に依存している。該当箇所には明記した。
>
> **npm で確認した最新バージョン（2026-10-10, `npm view <pkg> version`）**: next 16.4.0（dist-tag latest。canary 16.5.0-canary.7）/ react 19.3.0 / next-intl 4.14.9 / @inlang/paraglide-js 2.27.0（@inlang/paraglide-next 0.8.1 は deprecated: 「v2 以降は paraglide-js を直接使う。Next.js 用アダプタは不要」）/ next-i18next 16.3.1 / i18next 26.4.2 / next-auth latest 4.24.15・beta 5.0.0-beta.32 / @auth/core 0.41.3 / better-auth 1.7.7 / @clerk/nextjs 7.9.14 / @simplewebauthn/server 14.0.3 / iron-session 9.0.1 / jose 6.2.12 / @supabase/supabase-js 2.117.3 / @supabase/ssr 0.12.7 / @neondatabase/serverless 1.2.0 / postgres (postgres.js) 3.4.9 / drizzle-orm 0.45.4 / prisma（`npm view prisma version` は 8.0.0-rc.22 を返した。要再確認）/ @vercel/postgres 0.10.0（**deprecated**: 「新規 DB は Vercel Marketplace から選択。既存 Vercel Postgres は Neon のネイティブ統合へ移行済み」）/ @tanstack/react-query 5.104.1 / swr 2.5.1 / @upstash/ratelimit 2.2.0 / @sentry/nextjs 11.6.0 / zod 4.6.5 / date-fns 4.4.0 / @date-fns/tz 1.5.0 / luxon 3.7.2 / @t3-oss/env-nextjs 0.13.11 / typescript 7.0.2。出典: [npm registry](https://registry.npmjs.org/)（各パッケージページ例: [next](https://www.npmjs.com/package/next), [@vercel/postgres](https://www.npmjs.com/package/@vercel/postgres), [@inlang/paraglide-next](https://www.npmjs.com/package/@inlang/paraglide-next)）。

---

## Q1. Next.js（2026年の最新安定版 App Router）: Server Actions vs Route Handlers、空き状況データのキャッシュ/再検証の落とし穴、ストリーミング、ロケールルーティング用 Proxy（旧 Middleware）、Edge vs Node ランタイム

### Takeaway
2026-10 時点の安定版は Next.js 16.4.0。予約送信は **Server Action（`"use server"`）** が既定の選択肢で、Route Handler は Cron・Webhook・外部クライアント向けに限定する。空き状況は `"use cache"` せず Suspense 配下でリクエスト時に DB を読む（Vercel のようなサーバーレスでは `use cache` のインメモリキャッシュがリクエスト間で残らないため、キャッシュしても益が薄い）。Next.js 16 で `middleware.ts` は `proxy.ts` に改名され **Node.js ランタイム固定**、Edge Runtime はルートセグメント設定で deprecated になったため、ランタイムは全面的に Node で統一できる。

### Cited Findings
- Next.js の npm dist-tag `latest` は 16.4.0、`canary` は 16.5.0-canary.7（2026-10-10 確認）— [npm: next](https://www.npmjs.com/package/next)
- nextjs.org/blog の検索結果によると 2026-06-26 に「Next.js 16.3」が公開され、セキュリティリリースの案内では「16.2.11（Active LTS）または 15.5.21（Maintenance LTS）」へのアップグレードを案内している — [nextjs.org/blog（検索要約）](https://nextjs.org/blog)
- Next.js 16 の要件: Node.js 20.9.0 以上（18 は非対応）、TypeScript 5.1.0 以上、ブラウザは Chrome/Edge/Firefox 111+・Safari 16.4+。App Router は React Canary を使い React 19.2 の機能（View Transitions, `useEffectEvent`, Activity）を含む — [Next.js docs: Upgrading to v16（next@16.4.0 同梱 docs）](https://nextjs.org/docs/app/guides/upgrading/version-16)
- Next.js 16: `middleware` ファイル名は deprecated、`proxy` に改名。「`edge` ランタイムは `proxy` では **サポートされない**。`proxy` のランタイムは `nodejs` で設定不可。`edge` を使い続けたい場合は `middleware` を使い続ける」。`skipMiddlewareUrlNormalize` → `skipProxyUrlNormalize` 等のフラグも改名（codemod が対応）— [Next.js docs: Upgrading to v16](https://nextjs.org/docs/app/guides/upgrading/version-16)
- ルートセグメント設定 `runtime` は `'nodejs'`（既定）と `'edge'`（**deprecated**）。「Edge Runtime は deprecated。`runtime` export をルートファイルから削除せよ」「このオプションは Proxy では使えない」— [Next.js docs: runtime](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/runtime)
- Proxy は「ルートがレンダリングされる前に実行」され、`matcher` 未指定だと `_next/static` や `public/` の静的ファイルを含む**全リクエスト**で動く。負のマッチ `'/((?!api|_next/static|_next/image|.*\\.png$).*)'` の例が示されている。実行順序: `headers` → `redirects` → Proxy → `beforeFiles` rewrites → ファイルシステムルート → … — [Next.js docs: proxy.js](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)
- 「Server Functions はこのチェーン上の独立したルートではなく、使用されたルートへの POST として扱われる。あるパスを除外する Proxy の matcher は、そのパスの Server Function 呼び出しも素通りさせる」「各 Server Function の内部で必ず認証・認可を検証せよ」— [Next.js docs: proxy.js](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)
- Proxy は「遅いデータ取得には向かない」「権限ベースのリダイレクト等の楽観的チェックには有用だが、完全なセッション管理や認可の手段として使うべきではない」。Proxy 内の `fetch` の `cache`/`next.revalidate`/`next.tags` オプションは無効 — [Next.js docs: Proxy (getting started)](https://nextjs.org/docs/app/getting-started/proxy)
- Server Action は「裏では POST メソッドを使い、この HTTP メソッドだけが呼び出せる」「UI 経由だけでなく直接 POST でも到達可能。すべての Server Function 内で認証と認可を検証せよ」。Server Components のフォームは JS 未ロードでも送信できる（プログレッシブエンハンスメント）。Client Components のフォームは JS 未ロード時に送信をキューし、ハイドレーション後は再読み込みなしで送信 — [Next.js docs: Mutating Data](https://nextjs.org/docs/app/getting-started/mutating-data)
- Server Action は Origin ヘッダと Host（または X-Forwarded-Host）を比較し、不一致なら中断する。リバースプロキシ等でドメインが異なる構成では `serverActions.allowedOrigins` を設定する — [Next.js docs: Data Security](https://nextjs.org/docs/app/guides/data-security)
- Next.js はアクション ID を「暗号化された非決定的 ID」として生成し、ビルド間で定期的に再計算。未使用の Server Action はクライアントバンドルから除去（dead code elimination）— [Next.js docs: Data Security](https://nextjs.org/docs/app/guides/data-security)
- 「ページレベルの認証チェックはそのページ内で定義された Server Action には及ばない。アクション内で常に再検証せよ」。戻り値はシリアライズされてクライアントへ送られるため「UI が必要とするものだけ返す。生の DB レコードは返さない」。レート制限は「メール送信や DB 書き込みのような高コスト処理で検討せよ」— [Next.js docs: Data Security](https://nextjs.org/docs/app/guides/data-security) / [Backend for Frontend: Rate limiting](https://nextjs.org/docs/app/guides/backend-for-frontend#rate-limiting)（「コードでのチェックに加え、ホストが提供するレート制限機能も有効化せよ」）
- フォーム: `useActionState` で `pending` と検証エラー状態を扱う。サーバー側検証には Zod/Valibot を例示。`bind` で追加引数（例: `userId`）を渡せる。hidden input は HTML に露出し暗号化されない — [Next.js docs: Forms](https://nextjs.org/docs/app/guides/forms)
- Route Handlers は既定で**キャッシュされない**。`GET` のみ `export const dynamic = 'force-static'` 等でキャッシュをオプトイン可能。Cache Components 有効時、`GET` ハンドラはページと同じプリレンダリングモデルに従い、「DB クエリ、ネットワーク要求、`request.headers` 等へのアクセスでプリレンダリングが停止」する。`use cache` を Route Handler 本体に直接書くことはできず、ヘルパー関数に切り出す — [Next.js docs: Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers)
- Cache Components: `create-next-app` の既定で `cacheComponents` と `partialPrefetching` が有効。`"use cache"` は async 関数/コンポーネントの戻り値をキャッシュし、引数と外側スコープから捕捉した値がキャッシュキーになる。「API や DB など非同期ソースから毎回新鮮なデータが必要なコンポーネントには `"use cache"` を使わず、`<Suspense>` でラップしてフォールバックを返す」— [Next.js docs: Caching](https://nextjs.org/docs/app/getting-started/caching)
- `cookies`/`headers`/`searchParams`/`params` はランタイム API で、これらを読むコンポーネントは `<Suspense>` 配下に置く。`Math.random()`/`Date.now()`/`crypto.randomUUID()` は Cache Components 下で明示的な扱いが必要で、リクエストごとの値が要るなら `connection()` を先に呼んで Suspense で包む — [Next.js docs: Caching](https://nextjs.org/docs/app/getting-started/caching) / [connection](https://nextjs.org/docs/app/api-reference/functions/connection)
- `use cache` のランタイムキャッシュは既定でインメモリ LRU。「**サーバーレス**: キャッシュエントリは通常リクエスト間で持続しない（各リクエストが別インスタンスになりうる）」「セルフホスト: リクエスト間で持続」。キャッシュキーにビルド ID（または `deploymentId`）が含まれるため、デプロイをまたいで引き継がれない。永続が必要なら `'use cache: remote'`（プラットフォーム提供のキャッシュハンドラ、ネットワーク往復と料金が発生）— [Next.js docs: use cache](https://nextjs.org/docs/app/api-reference/directives/use-cache)
- `cacheLife` プロファイル: `default` stale 5m / revalidate 15m / expire never、`seconds` 30s/1s/1m、`minutes` 5m/1m/1h、`hours` 5m/1h/1d … `max` 5m/30d/1y。「`seconds` プロファイル、`revalidate: 0`、`expire` 5分未満のキャッシュは“短命”とみなされ、プリレンダーから自動的に除外されて動的ホールになる」— [Next.js docs: Revalidating](https://nextjs.org/docs/app/getting-started/revalidating) / [cacheLife](https://nextjs.org/docs/app/api-reference/functions/cacheLife)
- `updateTag(tag)`: **Server Action 専用**。即座にキャッシュを失効させ、次のリクエストは新鮮なデータを待つ（read-your-own-writes 向け）。`revalidateTag(tag, profile)`: Server Function と Route Handler で使え、stale-while-revalidate。第2引数なしの単引数形は deprecated（`{expire: 0}` 相当）で、推奨は `'max'`。Route Handler（Webhook 等）で即時失効したい場合は `revalidateTag(tag, { expire: 0 })` — [Next.js docs: updateTag](https://nextjs.org/docs/app/api-reference/functions/updateTag) / [revalidateTag](https://nextjs.org/docs/app/api-reference/functions/revalidateTag)
- `refresh()`（`next/cache`）は Server Action 専用でクライアントルーターを更新するが、タグ付きデータは再検証しない — [Next.js docs: refresh](https://nextjs.org/docs/app/api-reference/functions/refresh) / [Mutating Data](https://nextjs.org/docs/app/getting-started/mutating-data)
- ストリーミング: React のサーバーレンダラーは `<Suspense>` 境界に沿って HTML をチャンク送出。各境界は独立したストリーミングポイントで互いにブロックしない。`loading.js` でページレベルのストリーミング — [Next.js docs: Streaming](https://nextjs.org/docs/app/guides/streaming)
- `after()`: レスポンス送信後に実行する処理（ログ等）を登録。Server Components / Server Functions / Route Handlers で利用可。ルートの `maxDuration` の範囲で実行 — [Next.js docs: after](https://nextjs.org/docs/app/api-reference/functions/after)
- 環境変数: `NEXT_PUBLIC_` 接頭辞の値は `next build` 時に JS バンドルへ**インライン**され、ビルド後に環境変数を変えても反映されない。非 `NEXT_PUBLIC_` はサーバーのみで参照可。`serverRuntimeConfig`/`publicRuntimeConfig` は v16 で削除 — [Next.js docs: Environment Variables](https://nextjs.org/docs/app/guides/environment-variables) / [Upgrading to v16](https://nextjs.org/docs/app/guides/upgrading/version-16)
- 第三者ブログの比較でも「アプリ内のフォーム送信・ミューテーションは Server Actions、Webhook/モバイル/公開 API など外部クライアント向けは Route Handlers」が共通見解 — [MakerKit: Server Actions vs Route Handlers](https://makerkit.dev/blog/tutorials/server-actions-vs-route-handlers)

### Inferences
- **予約送信**: `app/[locale]/book/actions.ts` に `"use server"` の `createBooking(prevState, formData)` を置き、`useActionState` で pending/エラーを扱う。1 往復で UI 更新が返る・JS 無効でも動く・Origin/Host 検査が組み込み、という点で Route Handler より有利。冪等性キー（後述）は hidden input ではなく `bind` か、サーバー側で `(slot_start, email/phone)` から導出する。
- **Route Handler を使う場所**: Vercel Cron のエントリ（`app/api/cron/.../route.ts`）、将来の外部 Webhook、ICS ダウンロード、チャット用の長時間ストリーム。キャンセルリンクは **GET で副作用を起こさない**。`/[locale]/cancel/[token]` を**ページ**として表示し、「キャンセルする」ボタンの Server Action で実行する（トークンはサーバーで検証、UI には予約概要だけ返す）。
- **空き状況データのキャッシュ方針**: 空き枠コンポーネントは `"use cache"` を付けず、`<Suspense fallback={<SlotsSkeleton/>}>` 配下でリクエスト時に DB を読む。Vercel ではインメモリ `use cache` がリクエスト間で残らないので、短命キャッシュの設計コスト（`seconds` は動的ホール扱い）に見合わない。メニュー一覧・営業時間テンプレートなど「管理画面で変更したときだけ変わる」データは `"use cache"` + `cacheTag('menus')` + `cacheLife('days')` とし、管理の Server Action で `updateTag('menus')` を呼ぶ。
- **楽観 UI の落とし穴**: 予約確定後は `refresh()` だけだと `use cache` 済みのタグ付きデータは更新されない（docs 明記）。空き枠を万一キャッシュしているなら `updateTag('availability:<date>')` を忘れずに。本設計では空き枠は非キャッシュなので `refresh()` で足りる。
- **Proxy の責務を最小化**: next-intl のロケール判定・リダイレクトと、管理画面 `/admin` へのセッション Cookie 有無チェック（楽観的）だけにし、DB 問い合わせはしない。認可はページ/Server Action 内で再検証。`matcher` は `['/((?!api|_next|_vercel|.*\\..*).*)']` のように静的ファイルと `/api` を除外。
- **ランタイム**: Node で統一（proxy も Node 固定、edge は deprecated）。これにより `pg`/`postgres.js` 等の TCP ドライバも Proxy 以外で問題なく使える。Neon の HTTP ドライバはコールドスタートの観点で依然有利（Q2 参照）。
- **ストリーミング構成例**: `app/[locale]/book/page.tsx` で日付セレクタ（静的シェル）→ `<Suspense>` 内に `<AvailableSlots date={...} menuId={...} />`（DB 読み）。`loading.tsx` は不要になる場合が多い。

### Gaps
- Next.js 16.4 のリリースノート本文は取得できず（nextjs.org がブロック）。16.3 → 16.4 の差分は未確認。
- `cacheComponents` 有効時の `searchParams`（`?date=`）を使った空き枠の挙動は docs 上「ランタイム API は Suspense 配下」としか確認できず、実運用での細かい挙動（prefetch 範囲など）は要検証。

---

## Q2. 2026年の無料枠 DB 選定: Supabase / Neon / Vercel Postgres（Marketplace）/ Turso / PlanetScale

### Takeaway
Vercel Postgres は終了済み（Neon へ移行）。無料で Postgres を使うなら **Neon（Vercel Marketplace 経由）か Supabase** の二択。Neon Free は「5分でスケールtoゼロ、再開は数百ms、月100 CU時間、プロジェクトあたり 1 GB（公式 2026-10-06 更新）」で**一時停止（pause）はない**。Supabase Free は「DB 500 MB、Nano 共有 CPU、**1週間無通信で一時停止（手動復旧）**、バックアップなし」だが Realtime/Auth/Storage が同梱される。予約だけの Phase 1 では Neon が運用リスクが低く、チャット・カルテ写真を早期に出すなら Supabase が機能面で有利、というトレードオフ。

### Cited Findings
- 「Vercel Postgres はもう利用できない。既存 DB は 2024年12月に自動で Neon へ移行された」— [Vercel docs: Postgres（検索要約）](https://vercel.com/docs/postgres)。npm の `@vercel/postgres` は deprecated 表示（「Vercel Marketplace から代替を選べ。既存 DB は Neon のネイティブ統合へ移行済み」）— [npm: @vercel/postgres](https://www.npmjs.com/package/@vercel/postgres)
- Neon の Vercel-Managed Integration（Neon Postgres Native Integration）: Vercel Marketplace から導入し、請求は Vercel に統合。Neon アカウント未保有なら自動作成、`DATABASE_URL` 等を Vercel プロジェクトへ自動注入。Preview Deployment ごとに DB ブランチを作成可能 — [Neon docs: Vercel-Managed Integration](https://neon.com/docs/guides/vercel-managed-integration)（2026-10-09 更新）
- Neon プラン（公式 docs、2026-10-06 更新）: Free は $0、プロジェクト 100、ブランチ 10/プロジェクト、**コンピュート 100 CU-hours/プロジェクト**（0.25 CU を 400 時間/月分）、オートスケール最大 2 CU、**スケールtoゼロ 5分後（Free は無効化不可）**、**ストレージ 1 GB/プロジェクト・アカウント合計 20 GB**、公衆転送 5 GB/プロジェクト、履歴ウィンドウ 6 時間（最大 1 GB-month）、手動スナップショット 1、スケジュールバックアップなし（Free）。Launch は $0.106/CU-hour、$0.35/GB-month、履歴最大 7 日、月額最低料金なし（$0.50 未満の請求は徴収しない）— [Neon docs: Plans](https://neon.com/docs/introduction/plans)
- 「Free プランで CU-hours か公衆転送を使い切るとコンピュートは次の請求期間かアップグレードまで停止」「1 GB/プロジェクトまたは 20 GB 合計を超えるとストレージを増やす操作（INSERT/UPDATE/DELETE）が失敗」「サスペンド中のコンピュートは CU-hours を消費しない」— [Neon docs: Plans](https://neon.com/docs/introduction/plans) / [Cost optimization](https://neon.com/docs/introduction/cost-optimization)
- Neon Scale to Zero: 「5分無操作で自動停止」「再度クエリすると**数百ミリ秒**で再開」「Free では固定、有料では無効化可」— [Neon docs: Scale to Zero](https://neon.com/docs/introduction/scale-to-zero) / [Connection latency](https://neon.com/docs/connect/connection-latency)（「コールドスタートは通常数百ミリ秒を追加」「アプリと DB を同一リージョンに」「指数バックオフで再試行」）
- Neon serverless driver（`@neondatabase/serverless`）: HTTP または WebSocket で接続。「既定は HTTP の `neon()`（単発クエリ・非対話トランザクション向け）」「対話型トランザクションやセッション、`pg` 互換が必要な場合のみ `Pool`/`Client`（WebSocket）」。Node 19 以降が必要。HTTP の要求/応答上限 64 MB — [Neon docs: Serverless driver](https://neon.com/docs/serverless/serverless-driver)
- 第三者サイトでは Neon Free を「0.5 GB」「100 CU-hours」と記す記事が複数あり（2026-09 の記事含む）— [jetadmin: Neon Pricing 2026](https://www.jetadmin.io/blog/neon-pricing/)。**公式 docs（2026-10-06）の 1 GB/プロジェクトと矛盾**するため、公式値を優先しつつ直前に再確認が必要。
- Supabase Free（公式 pricing データ `packages/shared-data/plans.ts`）: 「Unlimited API requests」「50,000 MAU」「**500 MB database size / Shared CPU・500 MB RAM**」「5 GB egress」「5 GB cached egress」「1 GB file storage」「**Free projects are paused after 1 week of inactivity. Limit of 2 active projects.**」。Pro $25/月: 100,000 MAU、8 GB ディスク（超過 $0.125/GB）、250 GB egress、100 GB ストレージ、**日次バックアップ 7 日保持**、7 日ログ保持。Pausing は Free「1週間無通信後」/ Pro「Never」。自動バックアップ Free「なし」/ Pro「7 days」 — [supabase/supabase: plans.ts](https://github.com/supabase/supabase/blob/master/packages/shared-data/plans.ts) / [pricing.ts](https://github.com/supabase/supabase/blob/master/packages/shared-data/pricing.ts)（表示先: [supabase.com/pricing](https://supabase.com/pricing)）
- Supabase コンピュート: 「Nano（Free）: 共有 CPU、最大 0.5 GB メモリ、500 MB DB」「Micro: $0.01344/時（約 $10/月）、1 GB メモリ、10 GB」「Free プランのコンピュート資源は変更される可能性あり」— [Supabase docs: Compute and Disk](https://supabase.com/docs/guides/platform/compute-and-disk)
- Supabase 接続: サーバーレス/エッジ関数は「共有プーラー・トランザクションモード」を推奨（短命接続が多いため）。直接接続は IPv6（IPv4 アドオンで IPv4）。共有プーラーは全プランで IPv4 — [Supabase docs: Connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres)
- Supabase Vercel Marketplace 統合: Vercel から組織・プロジェクトを作成し請求は Vercel 経由、環境変数を自動同期。「Vercel Marketplace は現在 Public Alpha」と docs に記載 — [Supabase docs: Vercel Marketplace](https://supabase.com/docs/guides/integrations/vercel-marketplace)
- PlanetScale: 複数の検索結果が「2024年4月に無料枠終了」「最安は単ノード Postgres PS-5 で約 $5/月」とする。一部サイト（CostBench）は「永久無料プランあり」とするが同サイトの他ページと矛盾し信頼性が低い — [cloudinsight: 2026 Free Cloud Database List](https://cloudinsight.cc/en/blog/free-cloud-database) / [pkgpulse: Turso vs PlanetScale vs Neon 2026](https://www.pkgpulse.com/guides/turso-vs-planetscale-vs-neon-2026)
- Turso（SQLite 系、libSQL）: 無料枠は「100 DB、5 GB、月 5 億行読取・1,000 万行書込（削減後）」とする 2026 年記事と、旧値（9 GB/500 DB）を載せる記事が混在。有料 Developer は $4.99/月 — [pkgpulse](https://www.pkgpulse.com/guides/turso-vs-planetscale-vs-neon-2026) / [cloudinsight](https://cloudinsight.cc/en/blog/free-cloud-database)

### Inferences
- **推奨（Phase 1: 予約のみ）**: Neon Free を Vercel Marketplace から導入（`DATABASE_URL` 自動注入、請求一元化、Preview ブランチ）。理由: pause がなく無人運用に強い、1 GB は予約データなら数年分、コールドスタートは数百 ms でフォーム送信の UX として許容範囲（空き枠ページは Suspense で吸収）。Neon は Postgres 本体なので `btree_gist` + `EXCLUDE` が使える（Q3）。
- **推奨（チャット・カルテを早期に出す場合）**: Supabase Free。Realtime（Postgres Changes/Broadcast）、Auth、Storage（カルテ写真）が一体。ただし「1週間無通信で pause → ダッシュボードから手動復旧」が最大の運用リスク。予約サイトは毎日トラフィックがあると期待できるが、閉店期間（年末年始・休業）に止まる可能性がある。Vercel Hobby の Cron は 1 日 1 回まで（Q9）なので、日次 ping で「活動」とみなされるか（pause 判定の定義）は未確認（Gap）。
- **移行の容易さ**: どちらも素の Postgres なので、スキーマを SQL マイグレーション（Drizzle/raw SQL）で管理しておけば `pg_dump`/`pg_restore` で相互移行できる。Supabase 固有機能（RLS ポリシー、Realtime publication、Auth スキーマ）に依存する層は `/lib/db` の後ろに隠す。
- **Turso/PlanetScale は非推奨**: Turso は SQLite なので範囲型・排他制約が使えず、二重予約防止を全てアプリ側で担うことになる。PlanetScale は無料枠がない。
- **コスト上限の目安**: Neon は Launch へ上げても従量（$0.106/CU-h、0.25 CU で 1 日 3 時間稼働なら月 ≈ 23 CU-h ≈ $2.4、ストレージ 1 GB で $0.35）。Supabase は Pro $25/月（+Micro 1 台分込み）が最初の段差。

### Gaps
- Supabase の pause 判定の厳密な定義（API/DB どちらのアクセスが「activity」か、復旧 UI の手順）は公式ページが取得できず未確認。
- Neon Free の値は公式 docs（1 GB/プロジェクト、20 GB 合計）と第三者（0.5 GB）が食い違う。導入時に Console の表示で確定させること。
- Vercel Marketplace 経由の Supabase 無料プラン作成可否は Vercel 側ページが取得できず未確認（Supabase docs は「Via Vercel Marketplace: Details coming soon」）。

---

## Q3. 二重予約防止: `EXCLUDE USING gist` + `tstzrange` + `btree_gist`、slot start の UNIQUE、`SELECT … FOR UPDATE`、SERIALIZABLE、冪等性キー、「今取られました」の親切なエラー

### Takeaway
最終防衛線は **DB の排他制約**（`EXCLUDE USING gist (during WITH &&) WHERE (status = 'confirmed')`）。メニュー所要時間が可変になると「開始時刻 UNIQUE」では 18:00–19:30 と 19:00 の衝突を防げないため範囲重なりで判定する。アプリ側は (1) 空き再チェック → (2) INSERT → (3) SQLSTATE `23P01`（exclusion_violation）/`23505`（冪等性キー重複）を捕捉して「その枠は先ほど埋まりました」を返す、という流れで十分で、SERIALIZABLE や `FOR UPDATE` は 1 チェアの規模では不要。

### Cited Findings
- 「スカラー値には UNIQUE が自然な制約だが、範囲型には通常不適切。代わりに排他制約が適切で、範囲型の“重なりなし”のような制約を指定できる」。例: `CREATE TABLE reservation (during tsrange, EXCLUDE USING GIST (during WITH &&));` に重なる行を INSERT すると `ERROR: conflicting key value violates exclusion constraint "reservation_during_excl"`。`btree_gist` を入れると `EXCLUDE USING GIST (room WITH =, during WITH &&)` のようにスカラー等値と範囲重なりを組み合わせられる — [PostgreSQL docs: Range Types §Constraints on Ranges](https://www.postgresql.org/docs/current/rangetypes.html)
- 「排他制約は、任意の2行を指定列/式で指定演算子により比較したとき、少なくとも1つの比較が false か null を返すことを保証する」「排他制約を追加すると、宣言した種類のインデックスが自動作成される」— [PostgreSQL docs: Constraints §Exclusion Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)
- `CREATE TABLE` 構文: `EXCLUDE [ USING index_method ] ( exclude_element WITH operator [, ...] ) index_parameters [ WHERE ( predicate ) ]` — **部分排他制約（WHERE 述語）が可能**。「演算子がすべて等値なら UNIQUE 相当だが通常の UNIQUE の方が速い」「演算子は可換である必要がある」— [PostgreSQL docs: CREATE TABLE](https://www.postgresql.org/docs/current/sql-createtable.html)
- `btree_gist` は int/uuid/text/timestamptz/enum など多数の型に GiST 演算子クラスを提供し、「標準 B-tree より速くはならず一意性強制もできないが、GiST でしか索引できない列と単純型を混ぜた複数列 GiST インデックスに有用」「`<>` にも索引サポートがあり排他制約と組み合わせられる」「trusted 拡張（スーパーユーザーでなくても CREATE EXTENSION 可）」— [PostgreSQL docs: btree_gist](https://www.postgresql.org/docs/current/btree-gist.html)
- エラーコード: `23505 unique_violation`、`23P01 exclusion_violation`、`40001 serialization_failure`、`40P01 deadlock_detected`、`55P03 lock_not_available` — [PostgreSQL errcodes.txt](https://github.com/postgres/postgres/blob/master/src/backend/utils/errcodes.txt)（[公式表](https://www.postgresql.org/docs/current/errcodes-appendix.html)）
- 「Read Committed がデフォルトの分離レベル」。Repeatable Read/Serializable は「直列化異常を防ぐために設計されたエラーを出すので、アプリはトランザクションの再試行に備える必要がある。SQLSTATE は常に 40001」「デッドロック（40P01）や、場合により一意キー違反（23505）も再試行が適切」— [PostgreSQL docs: Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
- `SELECT … FOR { UPDATE | NO KEY UPDATE | SHARE | KEY SHARE } [ NOWAIT | SKIP LOCKED ]` 構文 — [PostgreSQL docs: SELECT](https://www.postgresql.org/docs/current/sql-select.html)
- 第三者解説も同じ型を示す: 「check-then-insert は競合する。2つの同時要求が両方 SELECT で空きを見て両方 INSERT できてしまう」「開始時刻だけの UNIQUE は同一開始しか防げない（2:00 の 60 分と 2:30 が衝突）」「`WHERE (not canceled)` のように部分制約でキャンセル行を除外」「`tstzrange(start_time, end_time, '[)')` の半開区間で 10:00 終了と 10:00 開始を衝突させない」— [dev.to: How to prevent double bookings in Next.js](https://dev.to/usamacheema453/how-to-prevent-double-bookings-in-nextjs-race-conditions-db-constraints-2cj9) / [sqlfordevs: Time Ranges without Overlapping](https://sqlfordevs.com/non-overlapping-time-ranges) / [Supabase blog: Range columns](https://supabase.com/blog/range-columns)
- 日本語記事: Zenn「PostgreSQL の制約」では room_id が同じで期間が重なるデータを `EXCLUDE USING GIST` + `tstzrange` で禁止する DDL を示す（`room_id` を含めるには `btree_gist` が必要）。予約システム解説記事は「アプリ側の if 文チェックは競合に無力。最終的な整合性は DB 制約とトランザクションで担保」「直列化は `FOR UPDATE` か SERIALIZABLE」。Speaker Deck の多重登録防止資料は「PostgreSQL の既定は Read Committed」を前提に注意喚起 — [zenn.dev/shoan: PostgreSQL の制約](https://zenn.dev/shoan/articles/95f1e3cd3aff02) / [issoh.co.jp 予約システム解説](https://www.issoh.co.jp/tech/details/7369/) / [Speaker Deck: 多重登録を防御するためのノウハウ](https://speakerdeck.com/kmtym1998/duo-zhong-deng-lu-wofang-yu-surutamenonouhau)
- Cal.com（OSS スケジューラ）の Prisma スキーマ: `Booking.idempotencyKey String? @unique` に「(optional) UID based on slot start/end time & email against duplicates」とコメント。`@@index([startTime, endTime, status])` 等。スキーマ内に `EXCLUDE`/`gist`/`tstzrange` は存在しない（grep で 0 件）— [calcom/cal.com schema.prisma](https://github.com/calcom/cal.com/blob/main/packages/prisma/schema.prisma)
- Cal.com の予約時チェックは `ensureAvailableUsers` → `checkForConflicts({busy, time, eventLength})` で、busy 区間をソートし `[slotStart, slotEnd)` と重なる区間があれば衝突、というアプリ側ロジック。見つからなければ `ErrorCode.NoAvailableUsersFound` を throw — [ensureAvailableUsers.ts](https://github.com/calcom/cal.com/blob/main/packages/features/bookings/lib/handleNewBooking/ensureAvailableUsers.ts) / [checkForConflicts.ts](https://github.com/calcom/cal.com/blob/main/packages/features/bookings/lib/conflictChecker/checkForConflicts.ts)

### Inferences
- **DDL（推奨）**:
  ```sql
  create extension if not exists btree_gist;

  create table bookings (
    id               uuid primary key default gen_random_uuid(),
    resource_id      smallint not null default 1,          -- 将来の複数チェア用
    menu_id          uuid not null references menus(id),
    during           tstzrange not null,                   -- [start, start+duration+buffer)
    status           text not null default 'confirmed'
                     check (status in ('confirmed','cancelled','no_show','completed')),
    source           text not null check (source in ('web','admin')),
    idempotency_key  text unique,                          -- sha256(slotStart|menu|contact) 等
    -- ... 顧客情報・トークン列（Q7, Q8）
    constraint bookings_during_half_open
      check (lower_inc(during) and not upper_inc(during) and not isempty(during)),
    constraint bookings_no_overlap
      exclude using gist (resource_id with =, during with &&)
      where (status = 'confirmed')
  );
  create index bookings_start_idx on bookings (lower(during)) where status = 'confirmed';

  create table time_blocks (                               -- 休憩・臨時休業・手動ブロック
    id uuid primary key default gen_random_uuid(),
    resource_id smallint not null default 1,
    during tstzrange not null,
    reason text,
    created_at timestamptz not null default now()
  );
  ```
  `WHERE (status='confirmed')` によりキャンセル済み行は制約対象外になり、同じ枠の再予約が可能。半開区間 `[)` で隣接枠（19:00 終了と 19:00 開始）が衝突しない。`resource_id` を入れておくと将来の 2 チェア化が DDL 変更なしで済む。
- **ブロックと予約の相互排他**: `time_blocks` と `bookings` は別テーブルなので DB 制約では相互に排他できない。管理者がブロックを作るときは「その区間の confirmed 予約がない」ことを同一トランザクション内で確認し、ユーザーの予約作成はブロック区間と重なる候補を空き枠生成（Q4）で除外する。厳密化したければ両者を 1 本の `calendar_items(kind, during)` テーブルに統合して 1 つの排他制約で守る案もある（kind='block' も `status='confirmed'` 相当として扱う）。
- **トランザクション戦略**: 既定の READ COMMITTED のまま、排他制約に任せる。並行 INSERT は GiST インデックスで衝突し片方が `23P01` で失敗するので `FOR UPDATE`/SERIALIZABLE は不要。`FOR UPDATE` は「行が既にある」場合にしか効かず、新規 INSERT の競合には向かない。SERIALIZABLE は `40001` の再試行ループが要るぶん複雑。
- **Server Action のエラー写像**:
  ```ts
  'use server'
  import { z } from 'zod'
  import { updateTag } from 'next/cache'
  export async function createBooking(prev: State, formData: FormData): Promise<State> {
    const input = BookingSchema.safeParse(Object.fromEntries(formData))
    if (!input.success) return { error: 'validation', issues: input.error.flatten() }
    const slot = await resolveSlot(input.data)          // JST → tstzrange(UTC)。lead-time/advance も再検証
    if (!slot.ok) return { error: slot.reason }          // 'outside_hours' | 'too_soon' | 'too_far'
    const idem = sha256(`${slot.start.toISOString()}|${input.data.menuId}|${input.data.contact}`)
    try {
      const booking = await db.insertBooking({ ...slot, idempotencyKey: idem, source: 'web' })
      updateTag('bookings:admin')                        // 管理画面がキャッシュしている場合
      return { ok: true, bookingId: booking.id, cancelUrl: booking.cancelUrl }
    } catch (e) {
      const code = (e as { code?: string }).code
      if (code === '23P01') return { error: 'slot_taken' }   // → t('errors.slotTaken') を表示し枠を再取得
      if (code === '23505') {                                 // 同一人物の二重送信: 既存予約を返す
        const existing = await db.findByIdempotencyKey(idem)
        return existing ? { ok: true, bookingId: existing.id, cancelUrl: existing.cancelUrl } : { error: 'slot_taken' }
      }
      throw e
    }
  }
  ```
  UI 側は `slot_taken` を受けたら `router.refresh()`（または `refresh()` を Server Action 側で呼ぶ）で空き枠を再取得し、選択中の枠を解除して「申し訳ありません、その枠はたった今埋まりました。他の時間をお選びください」を表示する。
- **冪等性キーの由来**: Cal.com と同様「開始時刻 + 連絡先」から決定的に作る。ネットワーク再送・二度押しで同一人物が同じ枠を 2 回 INSERT しようとしても `23505` で止まり、既存予約を返せる。異なる人物の同一枠は `23P01` で止まる。
- **ORM での表現**: Drizzle/Prisma のスキーマ DSL で `EXCLUDE` を宣言できるかは今回確認できなかった（Gap）。確実なのは SQL マイグレーション（`drizzle-kit generate` 後に手でカスタム SQL を追加、または Prisma の `migration.sql` を編集）。`tstzrange` 列は Drizzle では `customType`、Prisma では `Unsupported("tstzrange")` 扱いになる想定。
- **ロックが必要になる例外**: 「管理者が予約を 19:00→20:00 に時間変更」のような UPDATE は `during` を更新するだけで排他制約が再評価されるため、やはりロック不要。

### Gaps
- Prisma / Drizzle の排他制約・範囲型サポート状況は docs 取得に失敗（404）し未確認。
- Cal.com が DB レベルで二重予約を防いでいるか（アドバイザリロック等）はソース全体を追えておらず、スキーマに排他制約がないことのみ確認。

---

## Q4. 空き状況の計算: データモデル、スロット生成、空き枠のみ表示、リードタイム、最大先行予約、タイムゾーン（UTC 保存 / Asia/Tokyo 表示 / 海外ユーザー）、日本に DST がないこと

### Takeaway
「営業時間テンプレート（曜日ごと）」「例外（臨時休業・ブロック）」「予約」「メニュー（`duration_min`, `buffer_after_min`）」「設定（`slot_step_min=30`, `lead_time_min`, `max_advance_days`）」を分け、**候補枠を Asia/Tokyo で生成 → UTC の `tstzrange` に変換 → 予約/ブロックと `&&` で重なる候補を除外**する。これを SQL（`generate_series` + `NOT EXISTS`）かアプリ側で実装する。日本は DST がないため +09:00 固定で計算できるが、実装は IANA `Asia/Tokyo` を使っておく。

### Cited Findings
- Cal.com のスロット計算では、最小通知時間を `dayjs.utc().add(minimumBookingNotice || 1, 'minutes')` として「今 + 通知時間」より前の開始時刻を切り上げる。期間タイプ（`ROLLING_WINDOW`/`ROLLING`/`RANGE`）で先行予約上限を扱い、`timeZone` を全計算に通している。空き枠結果は Redis に `JSON.stringify(input)` をキーとして TTL キャッシュ（`SLOTS_CACHE_TTL`）し、キャッシュ障害時は直接計算にフォールバック — [calcom/cal.com slots/util.ts](https://github.com/calcom/cal.com/blob/main/packages/trpc/server/routers/viewer/slots/util.ts)
- Cal.com の衝突判定は「busy 区間を開始時刻でソートし、`busy.start >= slotEnd` なら打ち切り、`busy.end <= slotStart` なら次へ、それ以外は衝突」— [checkForConflicts.ts](https://github.com/calcom/cal.com/blob/main/packages/features/bookings/lib/conflictChecker/checkForConflicts.ts)
- Cal.com は `Booking` に `@@index([startTime, endTime, status])`、`@@index([userId, status, startTime])` を持つ — [schema.prisma](https://github.com/calcom/cal.com/blob/main/packages/prisma/schema.prisma)
- PostgreSQL の範囲型は「会議室が予約されている時間範囲を表す」用途が docs の筆頭例で、`&&`（重なり）演算子と GiST インデックスで効率的に検索できる — [PostgreSQL docs: Range Types](https://www.postgresql.org/docs/current/rangetypes.html)
- next-intl は `i18n/request.ts` の `getRequestConfig` で `locale`・`messages`・`now`・`timeZone`・`formats` をグローバルに設定でき、`useFormatter().dateTime(date, options)` は `Intl.DateTimeFormat` のオプションを受け取る。「日付は完全な ISO 8601 文字列（例 `2020-11-20T10:36:01.516Z`）にすべき」「`useNow` はクライアント再レンダー間で一貫した値を返し、`updateInterval` で更新可」— [next-intl docs: Configuration](https://next-intl.dev/docs/usage/configuration) / [Date and time formatting](https://next-intl.dev/docs/usage/dates-times)
- Next.js Cache Components では `Date.now()` 等はプリレンダー時に固定されるため、リクエストごとの値が要るなら `connection()` を先に呼ぶ — [Next.js docs: Caching](https://nextjs.org/docs/app/getting-started/caching)

### Inferences
- **データモデル（空き計算に関わる部分）**:
  ```sql
  create table menus (
    id uuid primary key default gen_random_uuid(),
    slug text unique not null,
    name_ja text not null, name_en text not null,
    description_ja text, description_en text,
    duration_min int not null check (duration_min > 0 and duration_min % 5 = 0),  -- 今は全て 60
    buffer_after_min int not null default 0,     -- 片付け・消毒時間
    price_jpy int, is_active boolean not null default true, sort_order int not null default 0
  );
  create table business_hours (                  -- 週テンプレート（0=Sun … 6=Sat）
    weekday smallint primary key check (weekday between 0 and 6),
    is_closed boolean not null default false,
    open_min int, close_min int,                 -- 分（0–1440）。18:00–24:00 → 1080, 1440
    check (is_closed or (open_min is not null and close_min is not null and open_min < close_min))
  );
  create table business_hour_overrides (        -- 特定日の営業時間変更／臨時休業
    date date primary key, is_closed boolean not null default false, open_min int, close_min int
  );
  create table settings (key text primary key, value jsonb not null);
  -- 'slot_step_min': 30, 'lead_time_min': 120, 'max_advance_days': 60, 'timezone': 'Asia/Tokyo'
  ```
  月曜定休は `business_hours` の `weekday=1, is_closed=true`。`time_blocks`/`bookings` は Q3 参照。
- **候補枠生成（SQL 版、1 日分）**:
  ```sql
  with p as (
    select $1::date as d, $2::int as duration, $3::int as buffer, $4::int as step,
           $5::timestamptz as not_before, $6::timestamptz as not_after
  ), hours as (
    select coalesce(o.is_closed, h.is_closed) as is_closed,
           coalesce(o.open_min, h.open_min) as open_min,
           coalesce(o.close_min, h.close_min) as close_min
    from p
    join business_hours h on h.weekday = extract(dow from p.d)
    left join business_hour_overrides o on o.date = p.d
  ), cand as (
    select (p.d::timestamp + make_interval(mins => m)) at time zone 'Asia/Tokyo' as start_at
    from p, hours, generate_series(hours.open_min, hours.close_min - p.duration - p.buffer, p.step) as m
    where not hours.is_closed
  )
  select c.start_at
  from cand c, p
  where c.start_at >= p.not_before and c.start_at <= p.not_after
    and not exists (select 1 from bookings b
                    where b.status = 'confirmed'
                      and b.during && tstzrange(c.start_at, c.start_at + make_interval(mins => p.duration + p.buffer), '[)'))
    and not exists (select 1 from time_blocks t
                    where t.during && tstzrange(c.start_at, c.start_at + make_interval(mins => p.duration + p.buffer), '[)'))
  order by c.start_at;
  ```
  `not_before = now() + lead_time`, `not_after = now() + max_advance_days`。60 分メニュー・18:00–24:00・30 分刻みなら 18:00…23:00 の 11 候補。`generate_series` の上限を `close - duration - buffer` にすることで「閉店をまたぐ枠」を出さない。
- **アプリ側版**（Cal.com 型）: 当日の `bookings`/`time_blocks` を 1 クエリで取り、候補ごとに「`busy.start < candEnd && busy.end > candStart`」で除外。候補数が小さいので計算量は無視できる。SQL 版はラウンドトリップ 1 回で済み、Neon の HTTP ドライバと相性がよい。
- **月表示**: 月のカレンダーで「空きあり/なし」を出すなら、日ごとに上記を回すより `bookings`/`time_blocks` を月範囲で 1 回取得してアプリ側で集計する。
- **タイムゾーン規約**: DB は `timestamptz`（UTC 格納）。日付入力は「JST の暦日 + 分」を受け取り、サーバーで `Asia/Tokyo` を明示して `Date` を作る（`@date-fns/tz` の `TZDate` や `Temporal` 相当、`luxon` の `DateTime.fromObject({...}, {zone:'Asia/Tokyo'})`）。クライアントの `new Date(y, m, d, h)` はブラウザのローカル TZ で解釈されるため海外ユーザーで壊れる——**フォームは ISO 文字列（例 `2026-11-03T18:00:00+09:00`）または `slot_start_utc` を hidden で送る**。
- **表示**: 店舗は東京にあるので、EN ページでも基本は **JST を主表示**し「(JST)」を明記。海外ユーザー向けに `Intl.DateTimeFormat(locale, { timeZone: userTz, timeZoneName: 'short' })` で副表示を出すのは任意（ブラウザの `Intl.DateTimeFormat().resolvedOptions().timeZone` で取得、サーバーレンダーとの不一致を避けるためクライアントコンポーネントで `useEffect` 後に描画）。next-intl の `getRequestConfig` で `timeZone: 'Asia/Tokyo'` を固定しておくとサーバー/クライアントで同じ TZ で整形される。
- **DST**: 日本は夏時間を実施していないため、`Asia/Tokyo` は常に +09:00。「JST の 18:00 = UTC 09:00」が年中一定で、日付境界（24:00）の扱いも単純。ただし実装は固定オフセットをハードコードせず IANA 名を使う（将来の海外展開や法改正に備える）。
- **リードタイム・先行予約**: `lead_time_min`（例 120 分）と `max_advance_days`（例 60 日）は `settings` に置き、空き枠生成と **Server Action の再検証の両方**で使う（UI でグレーアウトしても直接 POST で突破されうる）。
- **ふりがな**: `customer_name_kana` を別列（nullable）に持ち、`/ja` のフォームでのみ表示（任意入力）。`/en` では非表示。

### Gaps
- Supabase/Neon で `generate_series` + `at time zone` を使う上での性能上の注意点は未検証（候補数が小さく実用上問題ないと推定）。

---

## Q5. リアルタイム: 管理画面を最新に保つ Supabase Realtime か ポーリングか、SWR / React Query のパターン

### Takeaway
管理者 1 名の画面なら **React Query の `refetchInterval`（15–30 秒）+ ウィンドウフォーカス時再取得**で十分で、無料枠の制約もない。Supabase を採用する場合は Realtime Postgres Changes（Free: 同時接続 200、100 msg/秒、月 200 万メッセージ）で即時反映にできるが、publication と RLS の設定が追加で必要。将来のチャットは Supabase Broadcast/Postgres Changes が自然な選択肢。

### Cited Findings
- Supabase Realtime の上限（Free / Pro）: 同時接続 200 / 500、メッセージ 100 / 500 毎秒、チャネル join 100 / 500 毎秒、接続あたりチャネル 100、Broadcast ペイロード 256 KB / 3,000 KB、Postgres Changes ペイロード 1,024 KB。超過時は `too_many_connections` 等で join 拒否、メッセージ超過時は切断され `supabase-js` が自動再接続 — [Supabase docs: Realtime Limits](https://supabase.com/docs/guides/realtime/limits)
- 料金データ: Realtime「Concurrent Peak Connections: Free 200 / Pro 500（以降 $10/1000）」「Messages Per Month: Free 200 万 / Pro 500 万（以降 $2.50/100 万）」「Max Message Size: Free 256 KB / Pro 3 MB」— [supabase/supabase pricing.ts](https://github.com/supabase/supabase/blob/master/packages/shared-data/pricing.ts)
- メッセージ課金: 「DB 変更は、そのイベントを購読するクライアントごとに 1 メッセージ」「Broadcast は送信 1 + 受信クライアント数」「100 万メッセージ単位のパッケージ課金」— [Supabase docs: Manage Realtime Messages usage](https://supabase.com/docs/guides/platform/manage-your-usage/realtime-messages)
- Postgres Changes の購読にはテーブルを `supabase_realtime` publication に追加し（`alter publication supabase_realtime add table …`）、RLS を有効化してポリシーを定義する。`filter`（`column=operator.value`）はサーバー側で評価され、除外イベントは DB から出ない — [Supabase docs: Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)
- TanStack Query の既定: キャッシュは即 stale 扱い、stale なクエリは「新しいインスタンスのマウント / ウィンドウ再フォーカス / ネットワーク再接続」で自動再取得、`refetchInterval` で定期ポーリング、非アクティブクエリは 5 分で GC。`staleTime` で再取得頻度を制御 — [TanStack Query docs: Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults)
- Cal.com は空き枠をサーバー側で Redis キャッシュし、外部ツールには「遠い将来まで一括ではなく範囲を絞って slots を問い合わせ、ポーリングより Webhook を使う」ことが推奨されている — [calcom slots/util.ts](https://github.com/calcom/cal.com/blob/main/packages/trpc/server/routers/viewer/slots/util.ts) / [検索要約（Sonant/Cal.com 連携）](https://www.sonant.ai/integrations/cal-com)

### Inferences
- **Phase 1（管理画面）**: `useQuery({ queryKey: ['admin','bookings', date], queryFn, refetchInterval: 20_000, refetchOnWindowFocus: true })`。管理者が PWA を開きっぱなしでも 1 日 4,320 リクエスト程度で、Vercel/Neon の無料枠に影響しない（Neon は 5 分無操作で停止するため、ポーリングは「常時起動」を招き CU-hours を消費する点に注意: 20 秒間隔ならコンピュートは止まらない。管理画面を閉じれば停止する。100 CU-h/月 = 0.25 CU で 400 時間なので、1 日 10 時間開いていても約 75 CU-h で収まるが余裕は小さい。`refetchIntervalInBackground: false`（既定）でタブ非表示時は止まる）。
- **顧客側**: ポーリング不要。枠選択→送信時の `23P01` で競合を検知する（Q3）。
- **Supabase 採用時**: `bookings` を publication に追加し、管理画面で `supabase.channel('admin').on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => queryClient.invalidateQueries(...))` のように「通知を受けたら React Query を無効化して再取得」にすると、RLS で Realtime が返す列を気にせず済む。管理者 1 接続なので無料枠（200 接続・200 万 msg）は事実上無制限。
- **チャット（将来）**: Supabase Broadcast（DB 書き込み + 配信）か Postgres Changes を利用。Neon 採用の場合は Vercel 上でのロングポーリング／SSE（Route Handler の `ReadableStream`）か、外部サービス（Ably/Pusher 等。未調査）を追加する必要があり、ここが Supabase を選ぶ強い理由になりうる。

### Gaps
- SWR の最新ドキュメント（`refreshInterval` 等）は取得できず、React Query の一次資料のみ確認。
- Neon 上でのリアルタイム（LISTEN/NOTIFY のサーバーレス対応可否）は未調査。

---

## Q6. 国際化: next-intl vs next-i18next vs paraglide、URL 戦略（/ja, /en）、ロケール検出、Intl での日付・数値整形、ロケール別ふりがな欄

### Takeaway
App Router では **next-intl 4.x**（4.14.9、Next.js 16 対応を明記、`next/root-params` 対応）が最も整合的。`app/[locale]/…` + `proxy.ts` の `createMiddleware(routing)` で `/ja`・`/en` のプレフィックス式ルーティングを行い、ロケール検出は「パス → `NEXT_LOCALE` Cookie → `Accept-Language` → defaultLocale」の優先順。日付・数値は `useFormatter`（内部は `Intl.*`）で整形し、`timeZone: 'Asia/Tokyo'` を設定。paraglide は Next.js 専用アダプタが deprecated（paraglide-js 2 を直接使う）で、next-i18next は Pages Router 時代の設計。

### Cited Findings
- next-intl の最新は 4.14.9（2026-10-02）。CHANGELOG に「Next.js 16 update (#2054)」「Next.js 16.3 互換準備（ドキュメントリクエスト時のみロケール Cookie を更新、プリフェッチでは更新しない）(#2355)」— [next-intl CHANGELOG](https://github.com/amannn/next-intl/blob/main/packages/next-intl/CHANGELOG.md)
- 「`proxy.ts` は Next.js 16 までは `middleware.ts` と呼ばれていた」。`createMiddleware(routing)` が (1) ロケール交渉 (2) リダイレクト/リライト (3) 検索エンジン向け alternate links を担当。プレフィックス式（既定）の検出優先順位: ①パスのロケール接頭辞 ②以前検出したロケールの Cookie ③`accept-language` ④`defaultLocale`。マッチングは `@formatjs/intl-localematcher` の “best fit” — [next-intl docs: Proxy / middleware](https://next-intl.dev/docs/routing/middleware)
- matcher は「ページのみで動かし、`/favicon.ico` のような静的ファイルでは動かさない」。Vercel Analytics の `/_vercel/insights/view` のような内部エンドポイントも除外する — [next-intl docs: Proxy / middleware](https://next-intl.dev/docs/routing/middleware)
- `localePrefix`: `'always'`（既定、`/en/about`）/ `'as-needed'` / `'never'`。`localeDetection: false` で URL のみで判定（`accept-language` と Cookie を無視）。ユーザーが `accept-language` と異なるロケールを選ぶと `NEXT_LOCALE` Cookie を設定（`maxAge` 調整可）。`alternateLinks`（hreflang）は `false` でオプトアウト可 — [next-intl docs: Routing configuration](https://next-intl.dev/docs/routing/configuration)
- セットアップ: `messages/en.json`、`i18n/request.ts`（`getRequestConfig`）、`next.config.ts` の `createNextIntlPlugin`、`app/layout.tsx` の `NextIntlClientProvider`。async コンポーネントでは `getTranslations`。「`next/root-params` は Next.js 16.3 以降で既定利用可、それ以前は `experimental.rootParams`」「`setRequestLocale` はレガシー API」「`generateStaticParams` を layout か page に追加して静的レンダリング」— [next-intl docs: App Router setup](https://next-intl.dev/docs/getting-started/app-router) / [Routing setup](https://next-intl.dev/docs/routing/setup)
- Server Actions でユーザー向けメッセージを返す場合は `next-intl/server` の `getTranslations` を使う。Zod の contextual error map でリクエストのロケールに応じたエラー文言を作れる — [next-intl docs: Server Actions, Metadata & Route Handlers](https://next-intl.dev/docs/environments/actions-metadata-route-handlers)
- グローバル設定で `locale`・`messages`・`now`・`timeZone`・`formats` を提供可。`useFormatter().dateTime()` は `Intl.DateTimeFormat` のオプションを受ける。`dateTimeRange` で範囲整形 — [next-intl docs: Configuration](https://next-intl.dev/docs/usage/configuration) / [Dates & times](https://next-intl.dev/docs/usage/dates-times)
- Next.js 公式の i18n ガイド: `Accept-Language` と `@formatjs/intl-localematcher`/`negotiator` で Proxy 内でロケールを決め、`app/[lang]` 配下に全特別ファイルを置く。ロケールは `next/root-params` で深い階層から読める（Server Components とサーバーユーティリティで動作、Client Components / Server Actions / Route Handlers では不可）。参考ライブラリとして next-intl と next-international を挙げる — [Next.js docs: Internationalization](https://nextjs.org/docs/app/guides/internationalization)
- `@inlang/paraglide-next` は npm で deprecated（「v2 以降は paraglide-js を直接使用。Next.js アダプタは不要」）。`@inlang/paraglide-js` 最新 2.27.0 — [npm: @inlang/paraglide-next](https://www.npmjs.com/package/@inlang/paraglide-next)
- Next.js 16 向け next-intl の移行は「`middleware.ts` → `proxy.ts` に改名し、default export の `createMiddleware` ならファイル内容はそのまま」。改名漏れで「Unable to find next-intl locale」エラーが出る — [buildwithmatija: next-intl Next.js 16 proxy fix（第三者）](https://www.buildwithmatija.com/blog/next-intl-nextjs-16-proxy-fix)

### Inferences
- **構成**: `src/i18n/routing.ts` に `defineRouting({ locales: ['ja','en'], defaultLocale: 'ja', localePrefix: 'always' })`。`src/proxy.ts`:
  ```ts
  import createMiddleware from 'next-intl/middleware'
  import { routing } from './i18n/routing'
  export default createMiddleware(routing)
  export const config = { matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'] }
  ```
  管理画面も `/[locale]/admin` に置くと管理 UI も二言語化できるが、管理者が日本人 1 名なら `/admin` を matcher から除外して日本語固定にする方が単純（next-intl 側は「英語のみのルートを matcher から除外」を推奨）。
- **`localePrefix: 'always'` を推奨**: `/ja` と `/en` が常に明示され、QR コード・Google ビジネスプロフィールに貼る URL も固定できる。`as-needed` は既定ロケールで接頭辞が消えるため、キャンセルリンクなど絶対 URL を生成する際にロケール判定が絡んで複雑になる。
- **キャンセルメールを送らない前提**なので、予約完了画面に表示するキャンセル URL はそのページのロケールで生成（`/${locale}/cancel/${token}`）。トークンページ自体はどのロケールでも開ける。
- **SEO**: `alternateLinks` を有効のままにして `hreflang` を自動付与。`generateStaticParams` で `['ja','en']` を返し、トップ・メニューページは静的化。
- **日付整形**: `formats: { dateTime: { slot: { month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Tokyo' } } }` を定義し、`format.dateTime(start, 'slot')` で「11/3(火) 18:00」「Tue, 11/3, 18:00」を出す。価格は `format.number(price, { style: 'currency', currency: 'JPY' })`。
- **ふりがな**: メッセージキー `form.nameKana` は `ja.json` にのみ必須ラベル、`en.json` では欄自体を描画しない（`locale === 'ja' && <KanaField/>`）。DB 列は共通（Q4）。
- **paraglide を選ぶ場合**: コンパイル時にメッセージを関数化しバンドルが小さい利点があるが、Next.js のルーティング統合を自前で組む必要がある。二言語・小規模では next-intl の統合コストの低さが勝る。

### Gaps
- next-i18next の App Router 対応状況は一次資料を取得しておらず（Pages Router 中心という認識は一般知識ベース）。
- paraglide-js 2 の Next.js App Router での具体的なセットアップ手順（ミドルウェア実装）は未確認。

---

## Q7. 管理者 1 名の認証: Auth.js (NextAuth) v5、Supabase Auth、Clerk、パスキー/WebAuthn、マジックリンク、TOTP、PWA でのセッション

### Takeaway
Auth.js は「Better Auth の一部」となり README が「新規プロジェクトは Better Auth で始めることを推奨」と明記、v5 は依然 beta（5.0.0-beta.32）。**管理者 1 名**なら (a) Better Auth + passkey プラグイン（SimpleWebAuthn ベース）+ メールマジックリンク or パスワード、(b) Supabase を DB に選ぶなら Supabase Auth（Free 50,000 MAU）、(c) 最小構成として `iron-session`/`jose` の暗号化 Cookie + 単一パスワード + TOTP、の順で検討。Proxy では Cookie の有無だけを楽観的に確認し、実際の認可は Server Action / ページ内で行う。

### Cited Findings
- Auth.js README: 「Auth.js は Better Auth の一部になった。非常に特定の機能ギャップ（特に DB なしのステートレスセッション管理）がない限り、**新規プロジェクトは Better Auth で始めることを推奨**」。機能として Email/Passwordless、Passkeys/WebAuthn、DB あり/なし両対応 — [nextauthjs/next-auth README](https://github.com/nextauthjs/next-auth)
- npm dist-tags: `next-auth` latest 4.24.15、beta 5.0.0-beta.32。`@auth/core` 0.41.3。`better-auth` 1.7.7 — [npm: next-auth](https://www.npmjs.com/package/next-auth) / [npm: better-auth](https://www.npmjs.com/package/better-auth)
- Auth.js v5 移行ガイド: `next-auth@beta` をインストール。App Router ファースト、`auth()` 単一 API、Edge 互換、最低 Next.js 14。「Next.js 16 では `middleware.ts` が `proxy.ts` に改名」— [authjs.dev: Migrating to v5](https://authjs.dev/getting-started/migrating-to-v5)
- Auth.js の WebAuthn/Passkeys プロバイダは「**experimental で本番非推奨**」、`next-auth@5.0.0-beta.8` 以上・`@auth/prisma-adapter@1.3.0` 以上・Node 20 以上、`Authenticator` テーブル追加が必要 — [authjs.dev: WebAuthn](https://authjs.dev/getting-started/authentication/webauthn)
- Better Auth: 「フレームワーク非依存の TypeScript 認証/認可フレームワーク。2FA、パスキー、マルチテナント等をプラグインで追加」。Next.js 統合は `/api/auth/[...all]/route.ts` にハンドラをマウント、`auth.api.getSession({ headers })` を RSC/Server Action で利用、Server Action で Cookie を設定するには `nextCookies` プラグイン。「**proxy/middleware ではセッション Cookie の存在確認のみ**を推奨（API/DB 呼び出しでリクエストをブロックしない）」「Next.js 16+ では Node ランタイムで DB を含む完全なセッション検証も可能」「`getSessionCookie()` は Cookie の存在しか確認しないので安全性は低い」— [Better Auth docs: Next.js](https://www.better-auth.com/docs/integrations/next) / [Introduction](https://www.better-auth.com/docs/introduction)
- Better Auth Passkey プラグイン（`@better-auth/passkey`）は SimpleWebAuthn ベースで、マイグレーションでテーブル追加。Magic Link プラグインは `sendMagicLink({ email, token, url })` コールバックで送信手段を自前実装 — [Better Auth docs: Passkey](https://www.better-auth.com/docs/plugins/passkey) / [Magic link](https://www.better-auth.com/docs/plugins/magic-link)
- `@simplewebauthn/server` 14.0.3 は Node LTS 22.x 以上 — [npm: @simplewebauthn/server](https://www.npmjs.com/package/@simplewebauthn/server)
- Next.js 公式: 「自前実装より認証ライブラリを推奨」。セッションは「ステートレス（Cookie 内のトークン）」と「DB セッション（暗号化セッション ID のみ Cookie）」の 2 方式。「`iron-session` や `jose` のようなセッション管理ライブラリを推奨」。Cache Components 有効時、セッション読み取りはリクエスト時なので認証済み UI は `<Suspense>` の後ろでストリーミング（例は iron-session）— [Next.js docs: Authentication](https://nextjs.org/docs/app/guides/authentication) / [Authentication with Cache Components](https://nextjs.org/docs/app/guides/authentication-with-cache-components)
- Supabase Auth: Free 50,000 MAU、ソーシャル OAuth 可、Auth Hooks（Custom Access Token, カスタムメール/SMS）は Free でも利用可。Advanced MFA（Phone）等は有料。SSR では `@supabase/ssr` を使い Cookie ベースで、「Server Components は Cookie を書けないため Proxy でトークンをリフレッシュ」「Next.js 15 以前では `proxy.ts` は呼ばれないので `middleware.ts`」— [supabase pricing.ts](https://github.com/supabase/supabase/blob/master/packages/shared-data/pricing.ts) / [Supabase docs: Creating a client for SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- 第三者比較（ベンダー系ブログ多数）は 2026 年の新規 Next.js プロジェクトに Better Auth を推し、Auth.js は「既存アプリ向け」。一部の表に「Better Auth の所有者は Vercel（2026-07-07 買収）」とあるが他ソースで裏付けなし — [LogRocket: Best auth library Next.js 2026](https://blog.logrocket.com/best-auth-library-nextjs-2026/) / [MakerKit: Better Auth vs Clerk vs NextAuth vs Supabase Auth](https://makerkit.dev/blog/tutorials/better-auth-vs-clerk)
- OWASP: セッション ID は CSPRNG で 64 bit 以上（自前なら 128 bit 以上）、`Secure`/`HttpOnly`/`SameSite` 属性、アイドル・絶対タイムアウト — [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)

### Inferences
- **推奨**: Better Auth（Postgres アダプタ）+ `passkey()` + `magicLink()` または email/password。管理者は 1 名なので `signUp` を環境変数で無効化し、初回は CLI/seed で作成。Passkey を主、マジックリンクをフォールバックにすると PWA（ホーム画面追加）でも Face ID/Touch ID でログインでき、メール送信基盤（Resend 等）はフォールバック用だけで済む。
- **最小構成の代替**: 外部ライブラリなしで `iron-session`（暗号化 Cookie）+ 環境変数のパスワードハッシュ（`argon2`/`bcrypt`）+ TOTP（例: `otplib`。未調査）。実装 100 行程度だが、パスキーやブルートフォース対策を自前で持つことになる。
- **PWA のセッション**: Cookie `SameSite=Lax; Secure; HttpOnly`、有効期限は 30 日程度の長めに取り、スライディング更新。iOS のホーム画面 PWA は Safari と Cookie を共有しない場合があるため、PWA 内でログインする前提にする。
- **Proxy での保護**: `/admin` 配下は `getSessionCookie(request)` の有無で `/admin/login` へリダイレクト（楽観）。各管理 Server Action の先頭で `const session = await auth.api.getSession({ headers: await headers() }); if (!session) throw …` を必ず実行（Next.js docs の「ページの認証はアクションに及ばない」）。
- **Clerk**: 無料枠の 2026 年の条件は一次資料を取得できず（Gap）。管理者 1 名のためにサードパーティ SaaS を増やす理由は薄い。

### Gaps
- Clerk の 2026 年無料プラン（MAU 上限、ブランディング条件）は未確認。
- Better Auth が Vercel に買収されたという記述は 1 ソースのみで未検証。
- TOTP ライブラリ（otplib 等）の現行版・保守状況は未調査。

---

## Q8. トークン式キャンセルリンク: 安全な乱数、保存時ハッシュ、有効期限、レート制限

### Takeaway
32 バイト（256 bit）の CSPRNG トークンを base64url で URL に載せ、DB には **SHA-256 ハッシュのみ**保存し、照合は定数時間比較。有効期限は「予約開始時刻（または開始の N 時間前＝キャンセル締切）」で自然に決まり、キャンセル後は無効化。GET では表示のみ・実行は POST（Server Action）。トークンページと予約作成 Server Action には IP ベースのレート制限（Upstash Ratelimit か Postgres カウンタ）をかける。

### Cited Findings
- OWASP（Forgot Password）: URL トークンは「暗号学的に安全なアルゴリズムで生成」「単回使用で適切な期間で失効」「有効なトークンが提示されるまでアカウントに変更を加えない」「URL トークンのブルートフォースに対するレート制限等の保護」「アカウント単位のレート制限や CAPTCHA で自動送信を抑止」「レスポンス時間を一定にして列挙を防ぐ」— [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
- OWASP（Session Management）: 「ランダムなセッショントークンをそのまま保存するのは厳密に管理されたストアでは許容されるが、読める者は未失効トークンを再利用できる。高エントロピーは推測を防ぐが露出したトークンは守らない。ストアの読み取り専用漏洩が脅威モデルにあるなら**一方向ハッシュを保存**」「トークン（または分割設計の秘密検証子）は CSPRNG で 128 bit 以上、推奨 160 bit 以上」— [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- Cal.com は `Booking.uid String @unique` と `oneTimePassword String? @unique @default(uuid())` を持ち、`cancelledBy`/`rescheduledBy` にメールを記録する — [calcom schema.prisma](https://github.com/calcom/cal.com/blob/main/packages/prisma/schema.prisma)
- Next.js: 「メール送信や DB 書き込みのような高コスト処理にはレート制限を検討」「ホストが提供するレート制限機能も有効化」— [Next.js docs: Data Security](https://nextjs.org/docs/app/guides/data-security) / [BFF: Rate limiting](https://nextjs.org/docs/app/guides/backend-for-frontend#rate-limiting)
- `@upstash/ratelimit`（2.2.0, GA）: 「唯一のコネクションレス（HTTP ベース）レート制限ライブラリ」で Vercel などサーバーレス向け。Upstash Redis が必要 — [upstash/ratelimit-js README](https://github.com/upstash/ratelimit-js)
- Server Action は POST 限定かつ Origin/Host 比較があり、`SameSite` Cookie の既定と合わせて CSRF の大半を防ぐ — [Next.js docs: Data Security](https://nextjs.org/docs/app/guides/data-security)

### Inferences
- **DDL 追加列**: `cancel_token_hash bytea unique`, `cancel_token_expires_at timestamptz`, `cancelled_at timestamptz`, `cancelled_by text check (cancelled_by in ('customer','admin'))`。
- **生成・保存・検証**:
  ```ts
  import { randomBytes, createHash, timingSafeEqual } from 'node:crypto'
  export function issueCancelToken() {
    const raw = randomBytes(32).toString('base64url')           // 256 bit, 43 文字
    const hash = createHash('sha256').update(raw).digest()        // bytea で保存
    return { raw, hash }
  }
  export async function findBookingByToken(raw: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(raw)) return null             // 形式で早期拒否（DB を叩かない）
    const hash = createHash('sha256').update(raw).digest()
    const row = await db.bookingByTokenHash(hash)                 // unique index で O(log n)
    if (!row || !timingSafeEqual(hash, row.cancel_token_hash)) return null
    if (row.status !== 'confirmed' || new Date() > row.cancel_token_expires_at) return null
    return row
  }
  ```
  ハッシュを保存しているので DB 読み取り漏洩でもリンクを偽造できない。トークンは高エントロピーなのでソルト不要（ユーザー由来の値ではない）。
- **URL**: `https://<site>/{locale}/cancel/{raw}`。予約完了画面に表示し「このページをブックマーク／スクリーンショット」を促す（メールなし前提）。将来メール/LINE 送信を足すときも同じトークンを使える。
- **有効期限**: `cancel_token_expires_at = lower(during) - cancel_deadline_min`（例: 開始 2 時間前まで）。期限後は「お電話ください」を表示。キャンセル実行で `status='cancelled'`、`cancelled_at`、`cancel_token_hash=null`（再利用不可）。
- **レート制限**: (1) `/cancel/[token]` のページ: IP ごと 10 回/分（無効トークン連打対策）。(2) `createBooking`: IP ごと 5 回/10 分 + 同一連絡先 3 回/日。実装は Upstash Ratelimit（Redis、無料枠あり。上限未調査）か、Postgres に `rate_limits(key, window_start, count)` を置いた簡易スライディングウィンドウ（追加サービス不要）。Vercel の WAF/レート制限は Hobby での可否が未確認（Gap）。
- **副作用は POST のみ**: ページはトークン検証と予約概要の表示だけ。確定ボタンの Server Action で `cancelBooking(rawToken)` を再検証して UPDATE。これによりリンクプレビュー（メッセンジャーのクローラー等）による誤キャンセルを防ぐ。
- **列挙対策**: 無効トークンでも常に同じ「このリンクは無効か期限切れです」を返し、レスポンス時間差を出さない（DB ヒットの有無で差が出るが、形式チェック → ハッシュ → 単一クエリで差は小さい）。

### Gaps
- Upstash Redis の無料枠（コマンド数/日）と Vercel Hobby での WAF レート制限の可否は未確認。

---

## Q9. データモデル案（チャットとカルテを見据えたテーブル・列・インデックス）

### Takeaway
Phase 1 のテーブル（`menus`, `business_hours`, `business_hour_overrides`, `time_blocks`, `bookings`, `settings`）に、匿名顧客を後から束ねるための `customers`（任意）を足しておく。チャットは `chat_threads`/`chat_messages`、カルテは `karte_records`（JSONB 本文 + 写真参照）を `customers` に紐付け、`bookings.customer_id` を nullable で持つ。

### Cited Findings
- Cal.com の `Booking` は `uid`（unique）、`idempotencyKey`（unique）、`startTime`/`endTime`、`status`（`ACCEPTED` 既定）、`cancellationReason`、`cancelledBy`、`rescheduledBy`、`metadata Json`、`responses Json`、`creationSource` を持ち、`@@index([startTime, endTime, status])`、`@@index([status])`、`@@index([userId, status, startTime])` 等を張る。参加者は別テーブル `Attendee`（`@@unique([bookingUid, email])`）— [calcom schema.prisma](https://github.com/calcom/cal.com/blob/main/packages/prisma/schema.prisma)
- PostgreSQL の排他制約は宣言したインデックス（GiST）を自動作成する。`btree_gist` は uuid/int/text/enum 等を GiST で扱える — [PostgreSQL docs: Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html) / [btree_gist](https://www.postgresql.org/docs/current/btree-gist.html)
- Supabase Realtime の Postgres Changes はテーブルを publication に追加し RLS で保護する — [Supabase docs: Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)
- Supabase Free のファイルストレージは 1 GB、最大アップロード 50 MB、画像変換は Free 不可 — [supabase pricing.ts](https://github.com/supabase/supabase/blob/master/packages/shared-data/pricing.ts)

### Inferences
- **スキーマ案（Phase 1 + 拡張）**:
  ```sql
  -- 顧客（アカウントではなく、カルテ/チャットを束ねる内部エンティティ）
  create table customers (
    id uuid primary key default gen_random_uuid(),
    display_name text not null, name_kana text,
    phone text, email text, locale text not null default 'ja',
    notes text,                                   -- 管理メモ
    created_at timestamptz not null default now()
  );
  create unique index customers_phone_uidx on customers (phone) where phone is not null;
  create unique index customers_email_uidx on customers (lower(email)) where email is not null;

  alter table bookings
    add column customer_id uuid references customers(id),
    add column customer_name text not null,
    add column customer_name_kana text,
    add column customer_phone text, add column customer_email text,
    add column locale text not null default 'ja',
    add column note text,
    add column cancel_token_hash bytea unique,
    add column cancel_token_expires_at timestamptz,
    add column cancelled_at timestamptz, add column cancelled_by text,
    add column created_at timestamptz not null default now(),
    add column updated_at timestamptz not null default now();
  create index bookings_customer_idx on bookings (customer_id, lower(during) desc);

  -- 将来: カルテ
  create table karte_records (
    id uuid primary key default gen_random_uuid(),
    customer_id uuid not null references customers(id),
    booking_id uuid references bookings(id),
    visited_at timestamptz not null,
    menu_id uuid references menus(id),
    body jsonb not null default '{}'::jsonb,      -- {hairType, colorFormula, products, nextSuggestion}
    photos text[] not null default '{}',          -- Storage のオブジェクトキー
    created_at timestamptz not null default now(), updated_at timestamptz not null default now()
  );
  create index karte_customer_idx on karte_records (customer_id, visited_at desc);

  -- 将来: チャット
  create table chat_threads (
    id uuid primary key default gen_random_uuid(),
    customer_id uuid not null references customers(id),
    access_token_hash bytea unique,               -- 顧客側はトークン URL で参加（アカウントなし）
    last_message_at timestamptz, created_at timestamptz not null default now()
  );
  create table chat_messages (
    id bigint generated always as identity primary key,
    thread_id uuid not null references chat_threads(id),
    sender text not null check (sender in ('customer','admin')),
    body text not null, read_at timestamptz,
    created_at timestamptz not null default now()
  );
  create index chat_messages_thread_idx on chat_messages (thread_id, id);
  ```
- **設計意図**: 予約は顧客情報を**スナップショット**として自身の列に持つ（Cal.com の `userPrimaryEmail` と同じ発想）。`customers` への名寄せは管理者が電話番号/メールで後から行い、初回は `customer_id` NULL でよい。
- **プライバシー**: カルテ本文や連絡先は要配慮情報になりうるため、Supabase なら RLS で「service role / 管理者のみ」、Neon なら接続文字列を Server のみに限定し、Row 単位の権限は不要（単一テナント）。
- **インデックス**: 排他制約の GiST（`resource_id, during`）がそのまま「日付範囲の予約検索」に効く。管理画面の一覧用に `(status, lower(during))` 部分インデックス。チャットは `(thread_id, id)` で「スレッドの最新 N 件」。
- **監査**: `bookings_audit(booking_id, action, actor, payload jsonb, at)` を Phase 1 から持っておくと、手動変更・キャンセルの履歴が追える（トリガーで自動挿入）。

### Gaps
- 日本の個人情報保護法上の「カルテ」の保存義務・保存期間（美容室は医療機関ではないため法定保存義務は不明）は本調査の範囲外。

---

## Q10. 可観測性とバックアップ（Vercel ログ、Sentry 無料、Supabase バックアップ）、トラフィック増加時のコスト上限

### Takeaway
無料枠では **DB バックアップが最大の弱点**（Supabase Free: 自動バックアップなし、Neon Free: 履歴 6 時間＋手動スナップショット 1 つ）。GitHub Actions の日次 `pg_dump` を自前で回すのが実質必須。エラー監視は Sentry Developer（無料、第三者情報で 5,000 エラー/月・1 ユーザー、公式で全プランに cron モニタ 1・uptime モニタ 1）で足りる。コストの最初の段差は Supabase Pro $25/月（日次バックアップ 7 日付き）か Neon Launch 従量。

### Cited Findings
- Supabase: 「Pro/Team/Enterprise のプロジェクトを日次で自動バックアップ。Pro は直近 7 日、Team 14 日、Enterprise 30 日」。Free は自動バックアップ「なし」（pricing.ts: `database.automaticBackups.free: false`）。論理バックアップは「Supabase CLI の `db dump`」で自前取得可能。PITR は Pro 以上のアドオンで Small 以上のコンピュートが必要 — [Supabase docs: Database Backups](https://supabase.com/docs/guides/platform/backups) / [pricing.ts](https://github.com/supabase/supabase/blob/master/packages/shared-data/pricing.ts)
- Supabase Free のログ保持は 1 日（Pro 7 日）— [pricing.ts](https://github.com/supabase/supabase/blob/master/packages/shared-data/pricing.ts)
- Neon Free: 履歴ウィンドウ 6 時間（最大 1 GB-month）、手動スナップショット 1、スケジュールバックアップは Free 不可、モニタリング 1 日。Launch: 履歴最大 7 日、Instant restore $0.20/GB-month、スナップショット 100 — [Neon docs: Plans](https://neon.com/docs/introduction/plans)
- Sentry 公式: 「無料の Developer プラン 1 つと有料 3 プラン（Team/Business/Enterprise）」「新規アカウントは 14 日間 Business トライアル」「全プランに cron モニタ 1・uptime モニタ 1 を含む」「予約量と PAYG 予算を使い切ると以降のデータは破棄され課金されない」。有料プランの同梱量: 50k errors、5M spans、50 replays、5 GB logs — [Sentry docs: Pricing & Billing](https://docs.sentry.io/pricing/)
- Sentry Developer（無料）の内訳は第三者サイトで「5,000 errors/月、1 ユーザー」で一致。spans は 5M/10M/10k と不一致。Team は $26/月（50k errors）— [CostBench: Sentry Free Plan 2026](https://costbench.com/software/developer-tools/sentry/free-plan/) / [Spendflo: Sentry pricing guide](https://www.spendflo.com/blog/sentry-pricing-guide)
- Vercel Cron: Hobby は「1 日 1 回まで、時間精度（±59 分）」。毎時や 30 分間隔の式はデプロイ時に失敗。Pro は毎分可。Hobby の cron 数は limits 表で 2（usage ページは 100/プロジェクト、要確認）— [Vercel docs: Cron jobs usage and pricing（検索要約）](https://vercel.com/docs/cron-jobs/usage-and-pricing) / [Vercel docs: Limits（検索要約）](https://vercel.com/docs/limits)
- Vercel Hobby の関数実行時間は検索結果が「10 秒」（2026-03 記事）と「300 秒」（2026-07 記事）で矛盾。公式は「ランタイムと設定による」としか確認できず — [deploywise: Vercel free tier limits 2026](https://deploywise.dev/blog/vercel-free-tier-limits-2026) / [Vercel docs: Limits](https://vercel.com/docs/limits)
- Next.js `after()` でレスポンス送信後にログ送信などを実行できる（ルートの `maxDuration` 内）— [Next.js docs: after](https://nextjs.org/docs/app/api-reference/functions/after)

### Inferences
- **バックアップ運用（無料枠）**: GitHub Actions（public/private リポジトリの無料枠）で毎日 `pg_dump --format=custom "$DATABASE_URL"` を実行し、暗号化してアーティファクト or オブジェクトストレージ（Cloudflare R2/Backblaze B2 等。未調査）へ保存、30 世代ローテーション。Neon なら直接接続、Supabase なら「直接接続（IPv6）」または「session mode プーラー」を使う（docs 推奨）。Vercel Cron（1 日 1 回）で Route Handler から `pg_dump` 相当を実行するのは関数時間の上限が不確かなので避ける。
- **ログ**: Vercel の関数ログは Hobby だと保持が短い（具体値未確認）。Sentry を予約作成・キャンセル・管理操作の例外に絞って使い、`@sentry/nextjs` 11.x で Server Action のエラーを捕捉。重要イベント（予約作成/キャンセル）は `bookings_audit` に DB 記録しておけばログ保持に依存しない。
- **アップタイム**: Sentry の uptime モニタ 1 つを `/ja` に向ける。Supabase Free の pause 対策（Q2）とは別物。
- **コスト上限の見立て**（月）: 予約サイト規模（数百 PV/日）なら Vercel Hobby $0・Neon Free $0・Sentry Developer $0。段差: Supabase Pro $25、Neon Launch 数ドル〜（従量）、Sentry Team $26。Vercel Pro の価格は本調査で一次資料を取得できず（Gap）。商用利用規約（Hobby の非商用制限）は要確認（Gap）。

### Gaps
- Vercel Hobby のログ保持期間、関数の最大実行時間、商用利用可否は公式ページを取得できず未確認。
- Sentry Developer の正確な同梱量（公式）は取得できず第三者情報のみ。

---

## Q11. Vercel の独自ドメイン移行（手順、DNS、リダイレクト）と `NEXT_PUBLIC_SITE_URL` 的な設定でハードコードを避ける

### Takeaway
Vercel の Project Settings → Domains で apex（例 `example.jp`）を追加すると `www` も提案され、apex は A レコード `76.76.21.21`、サブドメインは CNAME `cname.vercel-dns-0.com`（または Vercel ネームサーバー）。Vercel は `www` を主にして apex をリダイレクトする構成を推奨。旧 `*.vercel.app` は自動で新ドメインへ 308 される設定が可能（ダッシュボードの Redirect to）。サイト URL は `NEXT_PUBLIC_` にせず **サーバー側の `SITE_URL`** として持ち、絶対 URL 生成（キャンセルリンク、`metadataBase`、hreflang）に使う。

### Cited Findings
- 「apex ドメインを追加すると `www` の追加を自動提案」「Vercel は `www` を主ドメインにし非 `www` からリダイレクトする構成を提案（CDN がトラフィックをより制御できる）」「ダッシュボードで Domains → 対象ドメインの Edit → Redirect to で設定、API でも可」「apex は A レコード、サブドメインは CNAME、どちらもネームサーバー方式も可。CLI: `vercel dns add example.com '@' A 76.76.21.21`、`www` は CNAME `cname.vercel-dns-0.com`」「検証できないときは重複 A レコードを削除」— [Vercel docs: Add a domain（検索要約）](https://vercel.com/docs/domains/working-with-domains/add-a-domain) / [Deploying and redirecting](https://vercel.com/docs/domains/deploying-and-redirecting) / [Set up custom domain](https://vercel.com/docs/domains/set-up-custom-domain) / [Guide: add a custom domain](https://vercel.com/guides/how-do-i-add-a-custom-domain-to-my-vercel-project)
- `NEXT_PUBLIC_` 変数は `next build` 時にインラインされ、ビルド後の変更は反映されない。非 `NEXT_PUBLIC_` はサーバーのみ — [Next.js docs: Environment Variables](https://nextjs.org/docs/app/guides/environment-variables)
- Server Action は Origin と Host（X-Forwarded-Host）を比較し、不一致なら中断。ドメインが異なる構成では `serverActions.allowedOrigins` — [Next.js docs: Data Security](https://nextjs.org/docs/app/guides/data-security)
- next-intl の alternate links（hreflang）はホストを `x-forwarded-host` → `host` から読む。ドメインベースルーティングもサポート — [next-intl docs: Proxy / middleware](https://next-intl.dev/docs/routing/middleware) / [Routing configuration](https://next-intl.dev/docs/routing/configuration)

### Inferences
- **移行手順**: (1) レジストラで DNS を用意（A `@ → 76.76.21.21`、CNAME `www → cname.vercel-dns-0.com`。Vercel の指示画面の値を正とする）。(2) Vercel で apex と `www` を追加、`www` を Primary、apex を Redirect。(3) `<project>.vercel.app` を Redirect to `www.example.jp`（308）に設定し、古い QR/リンクを救済。(4) 環境変数 `SITE_URL=https://www.example.jp` を Production に設定して再デプロイ。(5) Google ビジネスプロフィール等の URL 更新。(6) Sentry/uptime モニタの URL 更新。
- **設定のパターン**:
  ```ts
  // src/lib/site.ts（サーバー専用）
  import 'server-only'
  export const SITE_URL = (
    process.env.SITE_URL ??                                  // 本番で明示設定
    (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ??
    (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ??
    'http://localhost:3000'
  ).replace(/\/$/, '')
  export const absoluteUrl = (path: string) => new URL(path, SITE_URL).toString()
  ```
  `VERCEL_URL`/`VERCEL_PROJECT_PRODUCTION_URL` は Vercel のシステム環境変数（本調査では docs を取得できず、名称は一般知識ベース。要確認）。`app/[locale]/layout.tsx` の `metadata.metadataBase = new URL(SITE_URL)`。クライアントで絶対 URL が必要な場面（共有ボタン等）は `window.location.origin` を使い、`NEXT_PUBLIC_SITE_URL` のインライン値に依存しない。
- **キャンセル URL**: DB には相対パス（`/{locale}/cancel/{token}`）相当の情報だけを置き、表示時に `absoluteUrl()` で組み立てる。これによりドメイン移行後も過去予約のリンクが新ドメインで表示できる。
- **Server Action の Origin 検査**: Vercel の標準構成（同一ホストで配信）なら設定不要。独自ドメインの前に Cloudflare 等のプロキシを置く場合のみ `serverActions.allowedOrigins: ['www.example.jp']`。
- **Cookie/セッション**: ドメイン変更で既存セッション Cookie は失われるため、管理者は再ログイン。`Domain` 属性は付けない（ホストオンリー Cookie）。

### Gaps
- Vercel のシステム環境変数（`VERCEL_URL`, `VERCEL_PROJECT_PRODUCTION_URL`）と `.vercel.app` → 独自ドメインの自動リダイレクト仕様は公式ページが取得できず、検索要約と一般知識に基づく。導入時に Vercel ダッシュボードの表示で確認すること。
