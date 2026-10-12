# セキュリティレビュー v1 — 実装（公開前）

## 文書情報

| 項目 | 内容 |
|---|---|
| 文書 ID | REV-SEC-001 |
| 版 | v1.0 |
| 日付 | 2026-10-12 |
| 対象 | `main` 作業ツリー（HEAD `13e2db7`。実装は `57587bd`、`e3ca42e` で追加された `backup.yml`・`renovate.json` を含む）。`src/`、`drizzle/*.sql`、`scripts/`、`public/sw.js`、`next.config.ts`、`vercel.json`、`.github/workflows/*`、`.env.example`、`package.json`/`package-lock.json` |
| 基準 | AGENTS.md（Non-negotiable rules）、DES-08 セキュリティ設計（v0.3 を読んでレビューし、途中で入った v0.4 の差分も確認）、DES-06 API 設計、要件定義書 NFR-SC-01〜10・10.3・12 章、OWASP Top 10:2025、CWE |
| 方法 | (1) コードを追跡するレビュー（全 Server Action・Route Handler・proxy・DAL）。(2) スクラッチ領域にコピーした本番ビルド（`next build` → `next start`、`NODE_ENV=production`、`SITE_URL=http://localhost:3100` と `https://localhost:3101` の 2 系統）に対して、curl と Node スクリプトで細工したリクエストを送る検証（Server Action は React `encodeReply` と同じ形式で送信）。(3) 専用 DB `barber_probe`（ローカル Postgres 16.15）での `EXPLAIN ANALYZE`。(4) `npm test`（17 ファイル・118 件すべて成功）と `npm audit` |
| 評価者 | 開発者 + AI（読み取り専用レビュー。ソースは変更していない） |
| 確認方法の区分 | **確認済み**: 検証リクエスト・テスト・コード追跡のいずれかで実際に挙動を確かめた。**推定**: 外部サービスの仕様（Cloudflare・Vercel・Neon）に依存し、ローカルでは再現できないもの |
| 重大度 | **高**: 公開前に必ず直す（認証回避・PII 漏えい・二重予約など）。**中**: 公開前に直すのが望ましい（設計した統制の迂回、無認証の DoS、法令・ポリシーとの不一致）。**低**: 公開後の早い時期に直す（多層防御・限定的な影響）。**情報**: 記録のみ、または運用で対処する |

---

## 1. サマリー

| 重大度 | 件数 | ID |
|---|---|---|
| 高 | 0 | — |
| 中 | 6 | SR-01〜SR-06 |
| 低 | 10 | SR-07〜SR-16 |
| 情報 | 8 | SR-17〜SR-24 |
| 計 | 24 | |

**総評.** 認可（全管理アクションの `requireAdmin()`）、CSRF（Next.js の Origin 照合と Better Auth の `trustedOrigins`）、Cookie（`__Host-bb.session_token; Secure; HttpOnly; SameSite=Lax; Max-Age=2592000`）、トークンの扱い（256 bit、ハッシュのみ保存、定数時間比較）、SQL インジェクション対策、PII を含めないログ・監査・通知は、検証リクエストで期待どおりに動くことを確かめた。**認証回避や PII 漏えいにつながる高の所見はない。**

中の所見は、設計した濫用対策（レート制限・Turnstile・電話 3 件/日）を迂回できる経路と、無認証で重い DB 処理を起こせる経路（DoS と無料枠の枯渇。T-13）、Vercel 以外の環境で安全側に倒れない設定、保存期間ポリシーと匿名化処理の食い違いである。いずれも修正は小さい（各数行〜数十行）。

**優先度の高い所見（上位 5 件）**

1. **SR-04** 空き計算 SQL の実行のたびに Postgres の JIT コンパイルが走り（約 0.43 秒）、キャッシュもレート制限もない `/{locale}/book/time` 1 回で DB の CPU を約 1.4 秒使う（ローカルで実測）。予約確定時は同じ SQL を advisory lock を保持したまま実行する。`jit = off` にすると 0.7 ms。
2. **SR-02** 電話番号ごとの 3 件/日 の制限を、同時送信で迂回できる（同じ電話番号で 8 件同時に送ると 8 件とも確定した）。
3. **SR-01** キャンセル用 Server Action を、ドットを含むパス（`/ja/cancel/x.y`）へ POST すると proxy のレート制限（10 回/分）を通らない（25/25 件が処理された）。しかも処理のたびに予約全体の advisory lock を取ってからトークンを照合する。
4. **SR-03** Turnstile の `idempotency_key` にクライアントが決める `submissionNonce` を渡しているため、1 回解いたトークンを 300 秒の有効期間内に何度でも使える（Cloudflare の仕様による。推定）。
5. **SR-05** 秘密情報が必須かどうかを `VERCEL_ENV` だけで判定しているため、Vercel 以外（ADR-0001 の移行先 Cloudflare、`next start` での自前運用）では、Turnstile の検証が黙って省略され、`BETTER_AUTH_SECRET`・`PII_HASH_SECRET` がリポジトリにある固定の開発用値に置き換わる（`NODE_ENV=production` の `next start` で `turnstile.skipped` が出ることを確認）。

---

## 2. 所見一覧

| ID | 重大度 | CWE / OWASP 2025 | 箇所 | 内容 | 確認方法 | 修正案 | 関連 NFR |
|---|---|---|---|---|---|---|---|
| SR-01 | 中 | CWE-770, CWE-799 / A06 Insecure Design | `src/proxy.ts:75`（matcher）、`src/features/booking/service.ts:303-326`、`src/features/booking/actions.ts:30` | キャンセルの IP 制限（10 回/分）は proxy だけにある。proxy の matcher が `.*\..*`（ドットを含むパス）を除外するため、`/ja/cancel/x.y` などに `Next-Action: cancelBooking` で POST すると制限を通らない（Server Action はどのページの URL へ送っても実行される）。さらに `cancelByToken` はトークンを照合する前に `pg_advisory_xact_lock(calendar)` を取る。無効なトークンでも、無制限に予約全体のロックと DB 接続を占有できる | **確認済み**（検証リクエスト）: `/ja/cancel/<tok>` は 10 件で 429、`/ja/cancel/x.y` と `/en/cancel/anything.txt` は 25/25 件が `not_found` まで処理された | レート制限を service（`cancelByToken`）の中に移し、`ip` を ctx で渡す。ロックを取る前に、ロックなしでハッシュを引いて存在を確かめる。proxy の matcher は静的ファイルの拡張子だけを除外する。詳細は 3.1 | NFR-SC-04, FR-S-04, AT-07, T-04 |
| SR-02 | 中 | CWE-367 (TOCTOU) / A06 | `src/features/booking/service.ts:245`（確認）、`:205`（加算） | 電話番号の 3 件/日 を、トランザクションの外（ロックなし）で確かめ、成功時にトランザクションの中で加算している。同時に送ると、全員が確認を通ってから加算される。Turnstile を解いた Bot や嫌がらせ目的の人が、1 つの電話番号で枠を大量に押さえられる（T-03） | **確認済み**（検証リクエスト）: 同じ電話番号で別の 8 枠へ 8 件を同時に送ると 8 件とも `ok` になり、DB にも `confirmed` が 8 件 | 確認を `insertBooking` の `lockCalendar(tx)` の直後に移す（すべての予約書き込みは同じ advisory lock で直列になるため、確認と加算が不可分になる）。外側の確認は早期拒否として残してよい。詳細は 3.2 | NFR-SC-04, FR-S-04, AT-08, T-03 |
| SR-03 | 中 | CWE-294 / A06 | `src/lib/turnstile.ts:32`、`src/features/booking/service.ts:249-253` | siteverify に `idempotency_key = submissionNonce` を送っている。Cloudflare の仕様では、同じ `response` と `idempotency_key` で再検証すると同じ結果（成功）が返る。nonce はクライアントが決めるため、1 回解いたトークンと nonce の組を 300 秒以内なら何度でも使え、「1 件の予約ごとに 1 回解く」という前提が崩れる。`cdata` による束縛もない | **推定**（Cloudflare Turnstile の server-side validation の仕様。ローカルからは siteverify に到達できない）。コード上は確認済み | `idempotency_key` を送らない（Cloudflare 側で単回使用になり、2 回目は `timeout-or-duplicate`）。あわせて widget に `cData: submissionNonce` を渡し、siteverify の `cdata` が nonce と一致するか確かめる。DES-08 §7 の記述も改める。詳細は 3.3 | NFR-SC-04, FR-S-05, T-03 |
| SR-04 | 中 | CWE-400, CWE-405 / A06 | `src/lib/db/availability-sql.ts:53,70`（`generate_series` の行数見積もり）、`src/app/(public)/[locale]/book/time/page.tsx:74-76`、`src/features/booking/service.ts:123` | 空き計算 SQL は推定行数が大きく（`generate_series` の既定見積もり 1000 行が掛け合わされ、推定コストは約 170 万）、`jit_above_cost` を超えるため、毎回 JIT コンパイルが走る（Generation+Inlining+Optimization+Emission で約 427 ms、実際の処理は 0.7 ms）。`/book/time` は月カレンダーと日の枠で 2〜3 回この SQL を実行し、無認証・キャッシュなし（ルール 3）・レート制限なし・WAF の対象外。予約確定の再確認でも、advisory lock を保持したまま同じ SQL を実行する | **確認済み**（ローカル PG 16）: `/ja/book/time?menu=cut&date=…` は 1 回 1.4 秒、10 回で Postgres の CPU 14.6 秒、Node の CPU 0.8 秒。`EXPLAIN ANALYZE` の JIT 合計 426.6 ms、`SET jit=off` で 0.713 ms。**Neon での JIT の既定値は推定**（要確認） | アプリ用ロールに `ALTER ROLE … SET jit = off`（カスタム migration）。あわせて WAF ルールに `/book/time` を加え、Neon で `SHOW jit` と `EXPLAIN ANALYZE` を確かめる。詳細は 3.4 | NFR-PF-06, T-13, FR-S-02 |
| SR-05 | 中 | CWE-1188, CWE-798 / A02 Security Misconfiguration | `src/lib/env.ts:13-17`、`src/lib/turnstile.ts:23-26`、`src/lib/auth.ts:27-34`、`src/lib/hash.ts:14-24`、`src/features/admin/undo.ts:27` | 秘密情報が必須かどうかを `VERCEL_ENV ∈ {production, preview}` だけで決めている。Vercel 以外で本番運用すると（ADR-0001 の移行先 Cloudflare Workers、Docker や `next start`、System Environment Variables を公開しない設定）、(a) Turnstile が `info` ログ 1 行で常に通る、(b) `BETTER_AUTH_SECRET` と Undo の鍵がリポジトリにある固定値になる、(c) `PII_HASH_SECRET` が固定値になり、`phone_hash`・`phone_tail`・レート制限キーの HMAC を総当たりで逆算できる（電話番号の空間は約 10^9）。CRON は未設定なら拒否するので安全 | **確認済み**: `NODE_ENV=production` の `next start`（`VERCEL_ENV` なし）で予約すると `{"event":"turnstile.skipped"}` が出て確定まで進んだ。固定値はコードで確認 | 実行時は安全側に倒す。`NODE_ENV === 'production'` で秘密が無ければ Turnstile は `false` を返し、`authSecret()`・`piiSecret()`・Undo の鍵は例外を投げる（ビルドを通すため、読み込み時ではなく最初に使う時点で判定する）。開発用の固定値は `NODE_ENV === 'development' \|\| 'test'` のときだけ使う。詳細は 3.5 | NFR-SC-04, NFR-SC-05, ADR-0001 |
| SR-06 | 中 | CWE-359 / A06（個人情報保護法の保存期間の公表事項） | `src/features/notifications/retention.ts:17` | 匿名化の対象を `c.last_visit_at < now − 3 年` で選んでいる。`last_visit_at` は `completed` への遷移でしか入らないため、来店のない顧客（キャンセル・無断キャンセル・`restricted` のみ、手動登録で未来店）は NULL のままで、**永久に匿名化されない**。プライバシーポリシー（「最後のご来店から 3 年」）と要件 10.3 の運用が、実際の処理と食い違う | **確認済み**: 作成から 5 年経ち `last_visit_at` が NULL の顧客を入れて `/api/cron/retention` を呼ぶと `{"anonymized":0}` で、氏名と電話番号が残った | 基準日を `COALESCE(last_visit_at, 最後の予約の upper(during), created_at)` にする。ポリシーの文言も「最後のご来店（ご来店がない場合は最後のご予約日）から 3 年」に改め、`consents.ip/user_agent` も同時に NULL にする。詳細は 3.6 | 10.3, FR-S-09, 12.1 |
| SR-07 | 低 | CWE-308 / A07 Authentication Failures | `node_modules/@better-auth/passkey/dist/index.mjs:278,355,483`、`src/lib/auth.ts:99-104` | `authenticatorSelection.userVerification: 'required'` は登録時にブラウザへ渡す指定に過ぎない。Better Auth passkey 1.7.7 は認証オプションを `userVerification: "preferred"` に固定し、登録と認証の両方で `requireUserVerification: false` として検証する。PIN を設定していないセキュリティキーなど、ユーザー検証（UV）のない認証器でも、触れるだけでログインできる | **確認済み**（ライブラリのコード追跡と、`GET /api/auth/passkey/generate-authenticate-options` が `"userVerification":"preferred"` を返すこと） | `passkey({ authentication: { afterVerification: ({ verification }) => { if (!verification.authenticationInfo.userVerified) throw … } } })` で UV を必須にする。登録側も `registration.afterVerification` などで同様に確かめる | NFR-SC-01, T-01, T-14 |
| SR-08 | 低 | CWE-613 / A07 | `src/features/admin/components/notifications-panel.tsx:375-380`、`src/features/admin/queries.ts:736` | パスキーは件数と「追加」しか表示されず、一覧・削除の UI がない。セッション Cookie を盗まれると、Better Auth の freshAge（既定 1 日）以内なら攻撃者が自分のパスキーを登録でき、「この端末以外をログアウト」をしてもそのパスキーは残る | **確認済み**（コード追跡。`/passkey/generate-register-options` には `freshSessionMiddleware` がかかっている） | 設定画面にパスキーの一覧（名前・作成日時・最終利用日時）と削除（`authClient.passkey.deletePasskey`）を加え、「他端末ログアウト」の確認画面に「見覚えのないパスキーを削除」を案内する。インシデント手順にも入れる | NFR-SC-10, FR-A-16, T-14 |
| SR-09 | 低 | CWE-307, CWE-770 / A07 | `src/features/admin/service.ts:1097-1150`、`src/lib/auth-email.ts:38` | (a) コード送信の制限が IP ごと（3 回/10 分）だけで、全体の上限がない。IP を替えれば管理者のメールを大量送信させ、Resend の無料枠（100 通/日）を使い切れる。(b) 照合の `login:acct` が全体で 20 回/時のため、誰でも 20 回間違えれば、正規の管理者もコードでログインできなくなる（パスキーでのログインは可能）。(c) 件名にコード本体を入れており、ロック画面の通知プレビューに表示される | **確認済み**（検証リクエスト）: IP を替えた 8 回の送信はすべて送信処理まで進んだ。同じ IP では 4 回目から `rate_limited`。IP を替えた 22 回の照合は 21 回目から `rate_limited` | コード送信に全体の上限（例: 10 通/日、`otp:global`）を設け、上限に達したら監査ログに記録する。照合の全体制限は閾値を残しつつ、ロック中も UI がパスキーへ誘導するようにする。件名からコードを外す | FR-A-01, NFR-SC-01 |
| SR-10 | 低 | CWE-693 / A02 | `src/proxy.ts:75`、`next.config.ts:64` | ドットを含む管理パス（`/admin/bookings/a.b`、`/admin/customers/x.y`）は proxy を通らないため、**CSP が一切付かない**（公開ページの Report-Only は `/admin` を除外している）。楽観的なリダイレクトも働かない。データはページの `requireAdminPage()` が守るので漏れない（確認済み）が、XSS があった場合の多層防御が欠ける | **確認済み**（検証リクエスト）: 200 応答に `Content-Security-Policy` がなく、`<script>` にも nonce がない。未ログイン時は本文に login へのリダイレクトだけが入っていた | matcher を静的ファイルの拡張子に限る（SR-01 と同じ修正）。あわせて `next.config.ts` で `/admin/:path*` に既定の厳しい CSP を付けておく（proxy の nonce 付き CSP があればそちらで上書きされる） | NFR-SC-06 |
| SR-11 | 低 | CWE-693 / A02, A09 | `next.config.ts:17-32,64`、`.env.example` | 公開ページの CSP は Report-Only で、`SENTRY_CSP_REPORT_URI` が未設定のため `report-uri` がない。違反はどこにも報告されず、AT-26（違反 0 件）を確かめる手段がない。強制への切替もコードの変更に頼っている。`script-src 'unsafe-inline'` は設計どおり | **確認済み**（応答ヘッダー） | `report-to`/`report-uri` の受け口（Sentry、または同一オリジンの `/api/csp-report` を作って件数だけ記録）を用意する。`CSP_ENFORCE=1` の環境変数でヘッダー名を切り替えられるようにする | NFR-SC-06, AT-26 |
| SR-12 | 低 | CWE-203 / A06 | `src/features/booking/service.ts:94,118-133,161` | 応答の違いで情報が分かる。(a) 同じ枠・メニュー・電話番号で、`duplicate` か `slot_taken` かによって「その電話番号の人がその枠を予約しているか」が分かる（冪等性の確認は空き確認より先に行う）。(b) `restricted` で、その電話番号が制限中だと分かる | **確認済み**（検証リクエスト）: 同じ枠に別の nonce で送ると `duplicate`、別の電話番号では `slot_taken` | (a) 有効な予約で枠が埋まっている場合は、nonce が一致しない限り `slot_taken` に統一する（`duplicate` は nonce が一致し、かつ既存予約がない場合のみ）。(b) は FR-A-13 の文言要件との兼ね合いで許容してよい（記録のみ） | NFR-SC-07, T-05 |
| SR-13 | 低 | CWE-778 / A09（否認防止） | `src/config/shop.ts:45`、`messages/{ja,en}.json` の `privacy/policy/tokusho.version`・`date` | `consents.policy_version` に保存する値は `'2026-10-12'` だが、画面に出す版は「1.0（2026年11月1日）」。同意の記録から、どの文面に同意したかをたどれない（12.1「改定日とバージョンを掲載。`consents.policy_version` と対応」） | **確認済み**（コード・メッセージの突合） | `POLICY_VERSION` とメッセージの `version`/`date` を 1 か所（`shop.ts`）から生成し、両者の一致を確かめるテストを加える | 12.1, 12.3, FR-S-07, T-12 |
| SR-14 | 低 | CWE-778 / A09 | `src/features/booking/service.ts:139-159` | 電話番号で顧客を upsert すると氏名・ふりがな・職業・言語が上書きされるが、上書きしたことが `audit_log` に残らない（T-16 の対策「`audit_log` に変更の事実を記録」が未実装） | **確認済み**（コード追跡） | upsert の前に既存行の値と比べ、変わった場合は `customer.overwrite`（`fields: 'name,nameKana'` のように列名だけを記録し、値は記録しない）を残す | T-16, FR-S-07 |
| SR-15 | 低 | CWE-359 / A04 | `src/features/booking/service.ts:199,202`、`src/features/notifications/digest.ts:85`、AGENTS.md ルール 5 | `consents.ip` には IP を平文で保存している。AGENTS.md ルール 5 は「IP は HMAC で保存」と書き、DES-08 は「平文で保存し 1 年で NULL 化」と書いており、文書どうしが食い違う。NULL 化は日次サマリーの初回実行に組み込まれており、Push の送信が例外で落ちると実行されない | **確認済み**（コード追跡） | どちらかに統一する（同意の証跡に IP 原文が必要なら AGENTS.md に例外として明記する）。housekeeping を digest から切り離し、retention の Cron で必ず実行する | 10.3, 12.3, NFR-SC-07 |
| SR-16 | 低 | — / 法務（個人情報保護法 32 条の公表事項） | `messages/ja.json` `privacy.sections`（委託先・安全管理措置・Cookie 等） | プライバシーポリシーに、未導入の Sentry と Vercel Web Analytics を記載している。管理者セッション Cookie が Cookie の項にない（12.1 の記載項目）。バックアップの暗号化は `backup.yml`（`e3ca42e`）で実装されたが、公開時に実際に動いていることの確認が必要 | **確認済み**（メッセージとコードの突合。`@vercel/analytics`・Sentry SDK は依存関係にない） | 公開時点の構成に合わせて文面を直し、`POLICY_VERSION` を上げる（SR-13） | 12.1 |
| SR-17 | 情報 | CWE-352（緩和済み）/ A01 | Next.js の Server Action、`src/app/api/admin/push/rotate/route.ts:22` | Origin ヘッダーのない POST は、Server Action でも rotate でも受け付ける（Next.js の既定。rotate は `origin &&` で判定）。ブラウザはクロスサイトの POST に必ず Origin を付け、Cookie は `SameSite=Lax` のため、悪用はできない | **確認済み**: 別オリジンからは 500 または 403。Origin なしは 200 または 204 | rotate は `origin !== expected` で一律に拒否する（SW の fetch は Origin を付ける） | NFR-SC-02, T-08 |
| SR-18 | 情報 | CWE-918 / A01 | `src/features/admin/schema.ts:182`、`src/lib/push.ts:84` | Push の endpoint は `https:` であれば何でも登録できる（`https://127.0.0.1:9/x` も `ok`）。テスト送信のたびにサーバーがその宛先へ POST する。管理者しか登録できないため影響は小さい | **確認済み**（検証リクエスト） | endpoint のホストを主要な Push サービス（`*.push.apple.com`、`fcm.googleapis.com`、`updates.push.services.mozilla.com`、`*.notify.windows.com`）に限る | FR-A-09 |
| SR-19 | 情報 | CWE-116 / A05 | `src/features/booking/ics.ts:19` | ICS の TEXT エスケープで `;` が置換されていない（`.replace(/;/g, ';')` は何もしない）。単独の `\r` もエスケープされない。値は管理者が設定するメニュー名と店舗の設定値だけなので、インジェクションの危険は小さい | **確認済み**（コードのバイト列を確認） | `.replace(/;/g, '\;')`、`.replace(/\r\n?\|\n/g, '\\n')` に直し、ユニットテストに `;` の例を加える | FR-C-11 |
| SR-20 | 情報 | CWE-348 / A06 | `src/lib/client-ip.ts:7-9`、`src/lib/auth.ts:72` | クライアント IP に `x-forwarded-for` の先頭を使っている。Vercel はこのヘッダーを上書きするので偽装できないが、Vercel 以外では偽装できる（ローカルでは XFF を替えるだけでキャンセルページの制限を回避できた） | Vercel 上は**推定**（Vercel のドキュメントによる）。ローカルの偽装は**確認済み** | 移行時は信頼できるヘッダー（例: Cloudflare の `CF-Connecting-IP`）に切り替える。`clientIp()` 1 か所の変更で済む（DES-08 v0.4 §6.1 に注記済み） | FR-S-04, ADR-0001 |
| SR-21 | 情報 | — / A03 Software Supply Chain Failures | `package.json:7`、`package-lock.json`、`.github/workflows/ci.yml:23` | `npm audit --omit=dev`: high 0・moderate 4（drizzle-kit 経由の esbuild ≤0.24.2、GHSA-67mh-4wv8-2f99。開発サーバーを使わないため実害なし。lockfile で drizzle-kit に `dev` の印がなく本番依存として数えられている）。開発依存も含めると high 5（eslint-config-next 経由の braces/micromatch。ビルド時のみ）。CI の `postgres:16` は digest で固定していない（TODO）。`engines` は `>=22.12.0`（DES-08 v0.4 で ADR-0009 として追記済み）。ローカルの Node は 22.22 | **確認済み**（`npm audit`、ファイル確認） | 予告されている Next.js 16.4 系のパッチ（10/14）に即時更新する（下の 5 章）。drizzle-kit 0.31 系の esbuild 更新を Renovate で追う。CI イメージを digest で固定する | NFR-SC-08 |
| SR-22 | 情報 | CWE-598 / A04 | next-intl middleware の `Link` ヘッダー、`/ja/book/done/[token]` | トークンページの応答の `Link`（hreflang alternate）にトークン入りの URL が 3 本入る。Vercel のリクエストログにもパスが残る（ログの保持はプラットフォームが決める）。完了ページ（GET）はレート制限がなく、リクエストごとに DB を引く | **確認済み**（応答ヘッダー。done を 15 回取得してすべて 200） | トークンページでは next-intl の `alternateLinks` を出さない。完了ページもキャンセルと同じキー（`cancel:ip`）で制限するか、WAF の対象に加える | NFR-SC-05, T-06 |
| SR-23 | 情報 | CWE-532 / A09 | `src/lib/logger.ts:5-17`、`src/features/{booking,admin}/service.ts:56-62` | 伏せ字にするのはトップレベルの既知キーだけで、大文字小文字を区別する。`email`・`otp`・`code`・`endpoint`・`authorization`・`cookie` は対象外。`errorResult` は `err.message` をそのまま記録する（pg の一部エラーは入力値を message に含む）。現状、これらを渡している呼び出し箇所はない | **確認済み**（全ての呼び出し箇所を確認） | キーを追加し、ネストしたオブジェクトも再帰的に伏せ字にする。`err.message` は pg エラーなら `code`・`constraint` だけを残す | NFR-SC-07 |
| SR-24 | 情報 | CWE-203 / A06 | `src/features/booking/service.ts:237-240` | ハニーポットに引っかかったときの応答 `doneUrl: '/{locale}/book'` は本物（`/book/done/<43 文字>`）と形が違い、Bot が見分けられる | **確認済み**（検証リクエスト） | 実在しない 43 文字のトークンを付けたダミーの `doneUrl` を返す（遷移先は「見つかりません」表示になる） | FR-S-05 |

---

## 3. 詳細（中）

### 3.1 SR-01 キャンセル Server Action のレート制限迂回とロックの先取り

**再現手順**（本番ビルド、`SITE_URL=http://localhost:3100`）

```js
// action ID は .next/server/server-reference-manifest.json の cancelBooking
const f = new FormData()
f.set('_1_locale', 'ja'); f.set('_1_token', 'C'.repeat(43))
f.set('0', JSON.stringify(['$undefined', '$K1']))
await fetch('http://localhost:3100/ja/cancel/x.y', {          // ← ドットを含むパス
  method: 'POST', body: f,
  headers: { 'Next-Action': '<cancelBooking id>', Origin: 'http://localhost:3100' },
})
```

| 送信先 | 25 回の結果 |
|---|---|
| `/ja/cancel/CCC…C` | 200 `not_found` × 10、429 × 15（proxy の制限が働く） |
| `/ja/cancel/x.y` | 200 `not_found` × 25 |
| `/en/cancel/anything.txt` | 200 `not_found` × 25 |

トークンは 256 bit のため総当たりは成立しない。ただし `cancelByToken` は `lockCalendar(tx)` を取ってから `SELECT … WHERE cancel_token_hash = …` を実行するため、無効なトークンを大量に送るだけで、予約・ブロック・Undo のすべての書き込みと advisory lock を奪い合わせ、DB 接続（インスタンスごとに 5 本）を占有できる。WAF ルール（未設定。30 回/60 秒）が唯一の歯止めになる。

**修正案**

```ts
// src/features/booking/service.ts
export async function cancelByToken(raw: unknown, context: { ip: string; now?: Date }): Promise<CancelBookingResult> {
  const now = context.now ?? new Date()
  const rate = await hitWindow(rateKeys.cancelIp(context.ip), LIMITS.cancelIp.windowSec, LIMITS.cancelIp.limit)
  if (!rate.ok) return { result: { status: 'rate_limited', retryAfterSec: rate.retryAfterSec } }
  const parsed = cancelBookingSchema.safeParse(raw)
  if (!parsed.success || !isCancelTokenFormat(parsed.data.token)) return { result: { status: 'not_found' } }
  const hash = hashCancelToken(parsed.data.token)
  // 存在しないトークンではロックを取らない（UNIQUE 索引で引くだけ）
  const pre = await db.execute(sql`SELECT 1 FROM bookings WHERE cancel_token_hash = ${hash} AND deleted_at IS NULL`)
  if (pre.rows.length === 0) return { result: { status: 'not_found' } }
  // 以降は現行どおり（lock → FOR UPDATE で再取得 → 判定 → 更新）
}
```

```ts
// src/features/booking/actions.ts
const h = await headers()
const { result, cancelledBookingId } = await cancelByToken(formToObject(form), { ip: clientIp(h) })
```

```ts
// src/proxy.ts — 静的ファイルの拡張子だけを除外する（SR-10 も同時に解消）
matcher: ['/((?!api|_next|_vercel|monitoring|sw\\.js|manifest\\.webmanifest|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|avif|woff2?|txt|xml|webmanifest|js|css|map)$).*)'],
```

- proxy は GET（ページ表示）だけを数えるようにし（`request.method === 'GET'`）、Server Action の POST は service 側で数える（二重に数えない）。
- テスト: `booking.db.test.ts` に「11 回目の `cancelByToken` が `rate_limited`」「存在しないトークンでは `pg_locks` に advisory lock が現れない」を加える。

### 3.2 SR-02 電話番号 3 件/日 の同時送信による迂回

**再現手順**: 電話番号 `080-5555-0001` で、2026-10-17〜18 の別々の 8 枠へ `createBooking` を `Promise.all` で同時に送る（IP は 8 通り。Vercel 上では、1 つの IP からでも IP 制限の 5 件までは同時に送れる）。結果は 8 件とも `{"status":"ok"}` で、DB でも `confirmed` が 8 件。

**原因**: `checkPhoneDaily()`（読むだけ）がロックの外で実行され、`incrementPhoneDaily()` はトランザクションの中で実行される。advisory lock を取るのは `insertBooking` に入ってからなので、同時に来たリクエストはすべて確認を通過する。

**修正案**

```ts
// src/features/booking/service.ts — insertBooking 内
return db.transaction(async (tx) => {
  await lockCalendar(tx)
  // ロックの下で確認すると、確認と加算（同じトランザクション内）が不可分になる
  const phoneLimit = await checkPhoneDaily(input.phone, tx)
  if (!phoneLimit.ok) throw new Abort({ status: 'rate_limited', retryAfterSec: phoneLimit.retryAfterSec })
  // …（以下は現行どおり）
```

- `submitBooking` 側の `checkPhoneDaily` は、Turnstile を呼ぶ前の早期拒否として残してよい。
- テスト: 同じ電話番号で `submitBooking` を 5 本同時に実行し、`ok` がちょうど 3 件、`rate_limited` が 2 件になること（DB 統合テスト、`now` を注入）。

### 3.3 SR-03 Turnstile トークンの再利用（idempotency_key）

**内容**: Cloudflare の siteverify は、トークンを 1 回しか検証させない。ただし「失敗した呼び出しを再試行するため」に `idempotency_key` を渡すと、同じ `response`＋`idempotency_key` の 2 回目以降も成功を返す。本実装は `idempotency_key` にクライアントが決める `submissionNonce` を使い、かつ `submissionNonce` はトークンと結び付けられていない。そのため次の手順で、1 回解くだけで 300 秒間に何件でも予約できる。

1. ブラウザで Turnstile を 1 回解き、`turnstileToken` を取り出す。
2. `submissionNonce` を固定し、`menuSlug`・`startsAt`・`phone` だけを変えて `createBooking` を繰り返し送る（IP を替えれば IP 制限 5 件/10 分も越えられる）。
3. siteverify は毎回 `success: true` を返す（hostname と action は一致するため）。

（**推定**: ローカルからは siteverify に到達できないため実機では確かめていない。Cloudflare のドキュメントに記載された仕様に基づく。staging で、同じトークンと nonce で 2 回送り、2 回目も成功することを確かめれば確定する。）

**修正案**

```ts
// src/lib/turnstile.ts
const body = new URLSearchParams({ secret, response: input.token, remoteip: input.ip })
// idempotency_key は送らない → 2 回目は 'timeout-or-duplicate' で失敗（単回使用）
…
const ok = data.success && data.hostname === expectedHost && data.action === TURNSTILE_ACTION
  && data.cdata === input.nonce        // widget に cData: submissionNonce を渡す
```

```tsx
// src/features/booking/components/turnstile-widget.tsx
window.turnstile.render(ref.current, { sitekey: siteKey, action: TURNSTILE_ACTION, cData: submissionNonce, … })
```

- 二重送信（ネットワークの再送）は、既存の冪等性キーと nonce（G-04）で同じ予約が返るため、Turnstile の再試行機能は要らない。送信に失敗したら widget を `reset()` する（現行どおり）。
- DES-08 §7 の表（`idempotency_key（= submissionNonce）`）を改め、判定に `cdata` の一致を加える。

### 3.4 SR-04 空き計算 SQL の JIT コンパイルによる DoS・コストの増幅

**再現手順**

```sql
-- availability-sql.ts の CTE を展開したもの（1 日分。ファイル: スクラッチの avail.sql）
EXPLAIN (ANALYZE) WITH … SELECT …;
--  JIT: Functions: 55, Timing: … Total 426.631 ms
--  Execution Time: 443.241 ms
SET jit = off;  EXPLAIN (ANALYZE) …;
--  Execution Time: 0.713 ms
```

| 計測（ローカル PG 16.15、データはほぼ空） | 値 |
|---|---|
| `GET /ja/book/time?menu=cut&date=2026-10-16` の所要時間 | 1.40〜1.44 秒/回 |
| 同 10 回の CPU 時間 | Postgres 14.6 秒、Node 0.8 秒 |
| `GET /ja/book/time?menu=cut&month=2026-11` | 0.66〜0.76 秒/回 |
| 静的ページ（`/ja/privacy`） | 0.004 秒 |

**影響**: `/book/time` は無認証・キャッシュなし（AGENTS.md ルール 3）・アプリのレート制限なし・WAF ルール（`cancel/`・`book/confirm`・`/api/ics/`）の対象外。数 req/s で Neon の小さなコンピュート（0.25 CU）を飽和させられ、月の Compute 時間も消費する（T-13）。さらに予約確定の再確認（`insertBooking`）は同じ SQL を **advisory lock を保持したまま**実行するため、平常時でも 1 件の確定でロックを約 0.45 秒占有し、混雑時の待ち時間とタイムアウトの原因になる。Neon で JIT が有効かどうかは未確認（**推定**）。有効なら重大度は高とみなす。

**修正案**

1. カスタム migration（`npx drizzle-kit generate --custom --name=jit_off`）:
   ```sql
   -- このクエリ群は数ミリ秒で終わる OLTP。行数の見積もりが過大なため JIT が常に発動する。
   ALTER ROLE CURRENT_USER SET jit = off;
   ```
   （Neon の pooler は接続ごとの `SET` を保持しないため、ロールに設定する。`options: '-c jit=off'` は pooler で使えない。）
2. 行数の見積もりを補正する（任意）: 日付の列挙を `generate_series(…)::date` から `SELECT ($from::date + i) FROM generate_series(0, $days) i` に変え、ステップの列挙に `LIMIT` を付けるなどして推定コストを下げる。
3. WAF ルール（Hobby は 1 本）の条件に `book/time` を加える（5 章）。
4. 確認: Neon で `SHOW jit;` を実行し、`/book/time` の `EXPLAIN (ANALYZE)` に `JIT:` の行が出ないことを確かめる。
5. 回帰テスト: `availability.db.test.ts` で `SHOW jit` が `off` であること（migration 適用後）。

### 3.5 SR-05 Vercel 以外で安全側に倒れない秘密情報の扱い

**再現手順**: `VERCEL_ENV` を設定せずに `TURNSTILE_SECRET_KEY` を未設定のまま `next build && next start`（`NODE_ENV=production`）で起動し、`createBooking` を送る。サーバーログに `{"level":"info","event":"turnstile.skipped","reason":"TURNSTILE_SECRET_KEY unset"}` が出て、予約が確定する（確認済み）。`BETTER_AUTH_SECRET` と `PII_HASH_SECRET` が未設定でも起動し、`auth.ts:27`・`hash.ts:14`・`undo.ts:27` の固定値が使われる。

**影響**: ADR-0001 の移行手順（Cloudflare Workers Paid）では `VERCEL_ENV` が存在しないため、移行と同時に Bot 対策が無効になり、HMAC 鍵がリポジトリにある既知の値になる（`phone_hash` や監査ログの `phone_tail` を辞書攻撃で逆算できる）。

**修正案**（ビルド〔CI は秘密なしで `next build` する〕を壊さず、実行時に安全側へ倒す）

```ts
// src/lib/env.ts
export const allowDevFallbacks = env.NODE_ENV === 'development' || env.NODE_ENV === 'test'

// src/lib/turnstile.ts
if (!secret) {
  if (!allowDevFallbacks) { logger.error('turnstile.unconfigured', {}); return false }   // fail closed
  logger.info('turnstile.skipped', { reason: 'TURNSTILE_SECRET_KEY unset' }); return true
}

// src/lib/hash.ts / src/lib/auth.ts / src/features/admin/undo.ts
if (!env.PII_HASH_SECRET) {
  if (!allowDevFallbacks) throw new Error('PII_HASH_SECRET is required in production')
  …
}
```

- Better Auth は `betterAuth()` の呼び出し時に secret を評価するため、`authSecret()` が production で例外を投げても `next build` が通ること（`auth.ts` はページ収集時に読み込まれる）を確かめる。通らない場合は `process.env.NEXT_PHASE === 'phase-production-build'` のときだけ例外を投げないようにする。
- `.env.example` と運用マニュアルに「Vercel 以外へ移すときは `TURNSTILE_SECRET_KEY`・`BETTER_AUTH_SECRET`・`PII_HASH_SECRET`・`CRON_SECRET` が必須」と明記する。

### 3.6 SR-06 匿名化の対象漏れ（来店のない顧客）

**再現手順**

```sql
INSERT INTO customers (name, name_kana, phone_e164, phone_display, created_at)
VALUES ('古い 顧客', 'ふるい こきゃく', '+819000000077', '09000000077', now() - interval '5 years');
```

`GET /api/cron/retention`（Bearer `CRON_SECRET`）→ `{"anonymized":0}`。行は氏名・電話番号を保持したまま残る（確認済み）。

**影響**: キャンセルした人・無断キャンセルの人・制限中の人・手動登録で未来店の人の PII は、期限なく残る。公表している保存期間（個人情報保護法 32 条 1 項の公表事項として掲げた「最後のご来店から 3 年」）と実際の運用が食い違い、T-07（漏えい時の影響）も大きくなる。

**修正案**

```sql
-- src/features/notifications/retention.ts の対象抽出
WHERE c.anonymized_at IS NULL
  AND COALESCE(
        c.last_visit_at,
        (SELECT max(upper(b.during)) FROM bookings b WHERE b.customer_id = c.id),
        c.created_at
      ) < ${t}::timestamptz - interval '3 years'
  AND NOT EXISTS (…未来の有効予約…)
```

- 同じループで `UPDATE consents SET ip = NULL, user_agent = NULL WHERE customer_id = …` を実行する（手動の匿名化と揃える）。
- プライバシーポリシー（ja/en）の保存期間を「最後のご来店（ご来店がない場合は最後のご予約日）から 3 年」に改め、要件 10.3 も同様に直す。`POLICY_VERSION` を上げる（SR-13）。
- テスト: `last_visit_at` が NULL で、最後の予約が 3 年以上前の顧客が匿名化されること。

---

## 4. 良好な点（検証で動作を確認した統制）

| 区分 | 確認内容 |
|---|---|
| 管理アクションの認可 | ログイン前に使う OTP の 2 個を除く 27 個の管理 Server Action が、すべて冒頭で `requireAdmin()` を呼ぶ（コードで確認）。Cookie なしで `exportCustomer`・`updateSettings`・`logoutOtherDevices`・`acknowledgeAll` を `/admin`・`/ja`・`/ja/privacy` へ POST すると、すべて `{"status":"unauthorized"}`（AT-27）。全管理ページが（レイアウトとは別に）自身で `requireAdminPage()` を呼ぶため、部分レンダリングでも迂回できない。`/api/admin/*` の GET は未認証で 401 |
| CSRF | 別オリジン（`Origin: https://evil.example`）からの Server Action は、有効な Cookie があっても拒否される（500 "Invalid Server Actions request"）。Better Auth の `revoke-sessions` は、Origin が別オリジンでも欠けていても 403 |
| セッション Cookie | HTTPS 構成で `__Host-bb.session_token=…; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Lax`（Domain なし）。HTTP（ローカル）では `bb.` の接頭辞になる。`updateAge` 経過後に `get-session` で延長される |
| Better Auth の攻撃面 | emailOTP の HTTP エンドポイント（`/sign-in/email-otp`・`/email-otp/*`）は 404。サインアップ・パスワード・リセット・検証メールは「無効」の応答。`/update-user`・`/delete-user` は 404。`generate-register-options`・`list-sessions`・`link-social` は未認証で 401 |
| CSP（管理） | nonce はリクエストごとに異なり（3 回とも別の値）、全 `<script>`（14 本）に同じ nonce が付く。部分プリレンダリング（`x-nextjs-postponed`）の `/admin/login` でも同様。`'strict-dynamic'`・`frame-ancestors 'none'`・`object-src 'none'`・`base-uri 'self'`。本番では `'unsafe-eval'` が付かない |
| トークンページのヘッダー | `/book/done/*`・`/cancel/*`・`/api/ics/*` に `Referrer-Policy: no-referrer`・`X-Robots-Tag: noindex, nofollow`・`Cache-Control: private, no-store`。`/admin/**` に `private, no-store`、`/api/**` に `no-store`。HSTS（preload）・`nosniff`・`X-Frame-Options: DENY`・`Permissions-Policy`・COOP を全ルートに付与し、`X-Powered-By` は出さない |
| トークンと秘密 | キャンセルトークンは `randomBytes(32)` を base64url にした 43 文字で、保存は SHA-256 のみ。照合は `timingSafeEqual`、形式での早期拒否、キャンセル・管理者キャンセル・匿名化で NULL 化（単回使用）。失敗の理由を区別しない表示（列挙対策）。Undo トークンは HMAC（鍵は用途ごとに導出）＋10 秒の期限で、状態が一致しないと復元しない。CRON は `timingSafeEqual` で照合し、未設定なら拒否（401 を確認）。クライアントバンドルに秘密の値は含まれない（`.next/static` を走査） |
| 予約の整合性 | `bookings_no_overlap`（EXCLUDE、`[)`、有効状態のみ）が最後の防衛線。同じ枠に別の電話番号で送ると `conflict: slot_taken`。冪等性の衝突は nonce が一致したときだけ既存予約を返し、他人には `duplicate`（T-05）。ハニーポットは DB に何も書かない |
| インジェクション | SQL はすべて Drizzle の `sql` テンプレート（`sql.raw` なし）。顧客検索の LIKE は `%`・`_`・`\` をエスケープ。`dangerouslySetInnerHTML` は JSON-LD のみで `<` を `<` にする。`tel:` の値は E.164 で検証済み |
| リダイレクト | `?next=` は `safeAdminNext()` が `/admin` で始まる同一オリジンの相対パスだけを通す（`//`・`\`・`/admin/login` を拒否）。SW の `notificationclick` と `NAVIGATE` メッセージも同一オリジンの `/admin` 配下に限る |
| PII | Push のペイロードは日付・時刻・メニュー・経路・未確認件数のみ（氏名・電話番号なし）。`notification_log.error` は「エラー名＋HTTP ステータス」だけ。監査ログの diff は許可したスカラー値のみ（備考は記録しない）。エクスポートに IP・UA・トークンハッシュを含めない。匿名化は 1 トランザクションで、CHECK 制約が中途半端な状態を拒否する。OTP は宛先をサーバー側で固定し、応答は常に同じ（列挙対策）。開発用に OTP を表示する処理は `NODE_ENV === 'development' && !VERCEL_ENV` に限る |
| サプライチェーン・CI | exact version、`.npmrc` の `ignore-scripts`・`save-exact`・`engine-strict`、`npm ci`、Actions は SHA で固定、`permissions: contents: read`、本番依存の `npm audit` は high 0。`backup.yml` は公開リポジトリでは実行を拒否し、age または AES256 で暗号化し、ダンプに `bookings_no_overlap` が含まれるか確かめる。`renovate.json` は `minimumReleaseAge: 7 days`、主要な依存は自動マージしない |
| テスト | `npm test`: 17 ファイル・118 件がすべて成功（DB 統合テストは実 Postgres） |

---

## 5. 公開前チェックリスト（セキュリティの差分）

`docs/07_release/02_prelaunch_checklist.md` を補う項目。**太字**は本レビューの所見に対応する。

### 5.1 コード修正（公開前）

| # | 項目 | 対応 |
|---|---|---|
| C1 | **SR-01** キャンセルのレート制限を service に移す。ロックの前に存在を確かめる。proxy の matcher を直す（SR-10 も解消） | 必須 |
| C2 | **SR-02** 電話番号 3 件/日 の確認をロックの下に移す | 必須 |
| C3 | **SR-03** siteverify から `idempotency_key` を外し、`cdata` を照合する | 必須 |
| C4 | **SR-04** `ALTER ROLE … SET jit = off` の migration を入れ、Neon で `EXPLAIN ANALYZE` を確かめる | 必須 |
| C5 | **SR-05** 実行時に安全側へ倒す（Turnstile は fail closed、秘密は production で必須） | 必須 |
| C6 | **SR-06・SR-13・SR-16** retention の基準日、ポリシーの文面、`POLICY_VERSION` の一致 | 必須 |
| C7 | Next.js を 16.4 系の最新パッチへ更新する（2026-10-14 に上流依存の Critical 2 件・High 1 件の修正版が予告されている。DES-08 §11） | 必須 |
| C8 | SR-07〜SR-09（UV の必須化、パスキーの一覧と削除、OTP の全体上限と件名） | 推奨（公開後 2 週間以内） |

### 5.2 Vercel（Production と Preview で別々の値を入れる）

| 環境変数 | 要件 |
|---|---|
| `SITE_URL` | `https://<本番ドメイン>`（末尾スラッシュなし）。パスキーの RP ID・Turnstile の hostname 照合・`trustedOrigins` の基準になる。ドメインを変えるとパスキーの再登録が必要 |
| `DATABASE_URL` / `DATABASE_URL_UNPOOLED` | Neon の pooled（`-pooler`、`sslmode=require`）と direct。アプリ用ロールに `jit = off`（C4） |
| `BETTER_AUTH_SECRET` | 32 バイト以上の乱数（`openssl rand -base64 32`）。漏えいしたら交換する（全セッションと Undo トークンが失効） |
| `ADMIN_EMAIL` | 小文字で書く（`seed-admin.ts` は小文字にして登録し、`requestAdminOtp` は値をそのまま検索するため、大文字が混じると OTP が届かない） |
| `RESEND_API_KEY` / `RESEND_FROM` | 検証済みドメインの送信元。未設定だと OTP は届かない（ログにだけ記録される） |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | 一度生成したら変えない。subject は `https:` か `mailto:` |
| `CRON_SECRET` | 32 バイト以上。Vercel Cron が Bearer で送る |
| `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | Cloudflare の widget は Managed モード。**Hostname は本番ドメインだけ**（Preview・staging は別の widget）。テスト用キー（`1x000…`）を本番に入れない |
| `PII_HASH_SECRET` | 32 バイト以上。変えない（変えるとレート制限と `phone_hash` の突合ができなくなる） |
| `SENTRY_DSN` / `SENTRY_CSP_REPORT_URI` | CSP の Report-Only を意味のあるものにするため、`SENTRY_CSP_REPORT_URI` は公開前に設定する（SR-11） |
| `SKIP_ENV_VALIDATION` | **設定しない**（設定すると秘密の必須チェックがすべて外れる） |
| System Environment Variables | 「Automatically expose System Environment Variables」を ON にする（`VERCEL_ENV` で秘密の必須判定と `X-Robots-Tag` を切り替えているため） |

### 5.3 Vercel Firewall（Hobby: 1 ルール）

| 項目 | 推奨値 |
|---|---|
| 条件 | Request Path が正規表現 `^/(ja\|en)/(cancel/\|book/(confirm\|time\|done/))\|^/api/ics/\|^/admin/login` に一致（DES-08 §6.2 の条件に **`book/time`（SR-04）・`book/done/`（SR-22）・`/admin/login`（SR-09）** を加える） |
| 方式・閾値 | Rate Limit、固定窓 60 秒、キーは IP、30 リクエスト/60 秒 → 429（60 秒） |
| 確認 | 02_prelaunch_checklist F2 の curl に加え、`/ja/cancel/x.y` への POST（SR-01 の修正前の経路）でも 429 になること |

### 5.4 その他のプラットフォーム設定

| # | 項目 |
|---|---|
| P1 | staging・Preview は Vercel Authentication で保護する（NFR-SC-09）。Git Fork Protection を ON にする（フォークからの PR で秘密付きのビルドを走らせない） |
| P2 | CSP の強制への切替（AT-26）: Report-Only を 1 週間運用して違反 0 件を確かめてから、`next.config.ts` のヘッダー名を `Content-Security-Policy` に変え、`upgrade-insecure-requests` を加える。SR-11 の環境変数による切替を入れれば再デプロイだけで済む |
| P3 | HSTS の `preload` と `includeSubDomains` は、独自ドメインを使う場合、すべてのサブドメインが HTTPS になることを確かめてから preload リストに申請する（`*.vercel.app` のままなら申請しない） |
| P4 | Neon: `SHOW jit` が `off`。`backup_ro`（`pg_read_all_data`）を作り、`backup.yml` の `PROD_DATABASE_URL` に設定する。GitHub の `backup` 環境はデプロイ対象ブランチを `main` に限る |
| P5 | 管理者: `npm run db:seed-admin` → OTP でログイン → パスキーを 2 本登録（予備端末）→「この端末以外をログアウト」の動作を確認（AT-19） |
| P6 | 公開時点でプライバシーポリシーの委託先・Cookie の記載を実際の構成に合わせる（SR-16）。Sentry や Web Analytics を入れるなら、トークンのパスを `[token]` に置き換える `beforeSend` を同時に入れる（T-06） |

---

## 6. 付記（検証環境と限界）

- 検証は、スクラッチ領域にコピーしたツリーの本番ビルド（`next start`）と、専用の DB `barber_probe` に対して行った。リポジトリのソース・`.next`・開発用 DB は変更していない。検証スクリプトはスクラッチ領域にあり、コミットしない。
- Vercel のエッジ（`x-forwarded-for` の上書き、WAF、関数の課金）、Cloudflare の siteverify、Neon の設定（JIT の既定値・pooler）は、ローカルでは再現できない。該当する所見は「推定」とし、staging で確かめる手順を各所見に書いた。
- 実機のブラウザ（iOS PWA の Push、パスキーの UV の挙動）は対象外（`docs/06_test/pwa_device_test.md` の予定に含める）。
