# 08 セキュリティ設計

## 文書情報

| 項目 | 内容 |
|---|---|
| 文書 ID | DES-08 |
| 版 | v0.4 |
| 日付 | 2026-10-12 |
| 変更履歴 | v0.4（2026-10-12）: 実装との同期。3 章のパイプラインのコード、4 章の Better Auth の実設定（Cookie 名 `__Host-bb.*`／HTTP では `bb.*`、`Max-Age` 30 日・1 日ごとの延長、OTP のハッシュ保存・試行回数、emailOTP の HTTP エンドポイント無効化、`auth_rate_limit`）、proxy.ts の挙動、5 章の Undo トークン、6 章のレート制限値（`otp:ip` を追加）と `x-forwarded-for` の扱い、8 章の CSP（公開は Report-Only で `upgrade-insecure-requests` なし、管理は nonce＋`'strict-dynamic'`＋`instant = false`）、9 章のロガーの伏せ字キーと通知ペイロード（氏名なし）、10 章を `backup.yml` に、11 章の `engines`・Renovate、Sentry・Web Analytics の未導入を明記。v0.3（2026-10-12）: 顧客向けの代替受付を電話から Instagram DM に変更（要件定義書 v0.5 FR-C-16、F3）。T-19 の切替先と Turnstile 障害時の案内。v0.2（2026-10-10）: ログインのフォールバックをアプリ内ワンタイムコード（`emailOTP()`）に確定（OI-12 決定済み、ADR-0006 改訂） |
| 関連要件 | NFR-SC-01〜10, FR-A-01, FR-A-16, FR-C-10, FR-C-12, FR-S-04〜08, FR-S-11, NFR-AV-04, NFR-OP-01, NFR-OP-04, 10.3, 12 章, AT-07, AT-08, AT-19, AT-26〜28 |
| 関連 ADR | ADR-0001, ADR-0004, ADR-0006, ADR-0007 |

---

## 1. 保護対象

| 資産 | 分類 | 保管場所 | 主な脅威 |
|---|---|---|---|
| 顧客の氏名・ふりがな・電話・備考 | 個人情報 | `customers`、`bookings.note` | 漏えい、目的外利用 |
| キャンセルトークン | 秘密（予約ごとの権限） | URL（顧客の手元）、DB はハッシュ | 推測・漏えいによる不正キャンセル |
| 管理者セッション・パスキー | 秘密（全権限） | Cookie、`auth_session`、`auth_passkey` | なりすまし |
| 予約枠（在庫） | 業務上の可用性 | `bookings` | Bot による枠埋め（営業妨害） |
| VAPID 秘密鍵・`CRON_SECRET`・`TURNSTILE_SECRET_KEY`・`BETTER_AUTH_SECRET`・`PII_HASH_SECRET`・DB 接続文字列 | 秘密 | Vercel / GitHub の環境変数 | 漏えい |
| バックアップ | 個人情報を含む | GitHub Actions（暗号化） | 漏えい |
| 同意記録・監査ログ | 証跡 | `consents`、`audit_log` | 改ざん・消失 |

---

## 2. 脅威モデル（STRIDE-lite）

S=なりすまし、T=改ざん、R=否認、I=情報漏えい、D=サービス妨害、E=権限昇格。

| ID | 脅威 | STRIDE | 起こりやすさ | 影響 | 対策 | 残存リスク | 関連 |
|---|---|---|---|---|---|---|---|
| T-01 | 管理画面へのなりすましログイン | S, E | 低 | 高 | パスキー主（パスワードなし）、サインアップ無効、ログイン試行制限、`__Host-bb.*` Cookie、全アクションで `requireAdmin()`（`ADMIN_EMAIL` とも照合） | フォールバック（OI-12）の強度に依存 | FR-A-01, NFR-SC-01 |
| T-02 | UI を迂回した直接 POST（営業時間外・過去・ブロック内・上限超） | T | 中 | 中 | Server Action 内で Zod＋advisory lock 下の空き計算 SQL による再検証 | — | FR-S-02, AT-27 |
| T-03 | Bot・嫌がらせによる枠の大量確保 | D, T | 中 | 高 | Turnstile、ハニーポット、IP 5 回/10 分・電話 3 件/日、WAF、`booking_restriction`（Should）、管理者による一括キャンセル | 別 IP・別番号を大量に使う攻撃は完全には防げない（監視と手動対応） | FR-S-04, FR-S-05, AT-08 |
| T-04 | キャンセルトークンの総当たり | I, T | 低 | 中 | 256 bit 乱数、DB はハッシュのみ、形式で早期拒否、IP 10 回/分（キャンセルページは proxy、ICS は Route Handler。共通キー＋WAF）、理由を区別しない「見つかりません」 | 実質ゼロ | FR-S-06, AT-07 |
| T-05 | 冪等性キー（枠＋メニュー＋電話）を知る第三者が再送して他人の完了 URL を得る | I | 低 | 中 | `23505` 時は `submission_nonce` が一致する場合のみ既存予約を返す。不一致は `duplicate`（内容非開示） | — | FR-C-10, 00_overview G-04 |
| T-06 | トークンの漏えい（Referer、解析、ログ、ブラウザ履歴） | I | 中 | 中 | トークンはパスのみ、トークンページは `Referrer-Policy: no-referrer`・`Cache-Control: private, no-store`、ログ出力禁止（ロガーが `token`・`doneUrl`・`cancelUrl` を伏せ字にする）、Web Analytics と Sentry の導入時はパスを `[token]` に置換（いずれも未導入） | 顧客端末の共有・スクリーンショットの流出 | NFR-SC-05, NFR-SC-07 |
| T-07 | DB・バックアップの漏えい | I | 低 | 高 | トークンはハッシュ、PII は最小（メール・住所・生年月日なし）、バックアップは `age` 暗号化、接続は TLS、バックアップ用ロールは読み取り専用 | 匿名化前の顧客データ | FR-S-08, NFR-SC-09 |
| T-08 | CSRF | T | 低 | 中 | Server Action は POST のみ＋Origin/Host 照合（Next.js 既定）、Cookie `SameSite=Lax`、Route Handler の POST（`/api/admin/push/rotate`）は Origin を検証 | — | NFR-SC-02 |
| T-09 | XSS | T, I | 低 | 高 | React のエスケープ、`dangerouslySetInnerHTML` は JSON-LD のみ（`<` を `\u003c` にエスケープ）、CSP、備考など自由記述はテキストとして描画 | CSP の `unsafe-inline`（公開ページ、8 章） | NFR-SC-06 |
| T-10 | リンクプレビュー（メッセンジャーのクローラー）による誤キャンセル | T | 中 | 中 | キャンセル GET は副作用なし、実行は確認ダイアログ後の Server Action | — | FR-C-12 |
| T-11 | 通知データを使ったオープンリダイレクト | E | 低 | 低 | SW の `notificationclick` で同一オリジンかつ `/admin` 配下のみ許可 | — | FR-A-10 |
| T-12 | 予約・キャンセル・同意の否認 | R | 中 | 中 | `audit_log`（actor・action・時刻）、`consents`（版・時刻・IP・UA）、`notification_log` | IP・UA は 1 年で削除 | FR-S-07, 12.3 |
| T-13 | 無料枠の枯渇（ポーリング・攻撃による Neon CU、Vercel Hobby の同梱量） | D | 中 | 高 | 非表示時はポーリング停止、WAF、レート制限、月次の使用量確認。Hobby は超過時に機能が 30 日止まるため 80% で Pro 移行判断 | Hobby の同梱量超過 | NFR-PF-06, ADR-0001 |
| T-14 | 管理者端末の紛失 | I, S | 低 | 高 | 「この端末以外をログアウト」（他セッションと購読を失効）、通知本文に電話番号を含めない、iOS の通知プレビュー非表示の案内、パスキーは端末ロックに依存 | ロック解除済み端末の物理的奪取 | FR-A-16, AT-19 |
| T-15 | サプライチェーン攻撃 | T, E | 中 | 高 | 11 章 | ゼロデイ | NFR-SC-08 |
| T-16 | 他人の電話番号で予約し、既存顧客の氏名を上書き | T | 低 | 低 | `audit_log` に変更の事実を記録、管理画面で確認可能、`phone_unverified` 表示 | 許容（顧客名は自己申告） | ADR-0008 |
| T-17 | Push ペイロードの盗聴・偽装 | I, S | 低 | 中 | Web Push の `aes128gcm` 暗号化、VAPID 署名（秘密鍵は不変・サーバー専用） | — | FR-S-03 |
| T-18 | Cron エンドポイントの不正呼び出し | T, D | 低 | 低 | `CRON_SECRET` を `timingSafeEqual` で照合、`daily_digests` による冪等性 | — | FR-A-12 |
| T-19 | Vercel Hobby の規約による警告・停止 | D | 中 | 高 | ADR-0001 の移行手順（Pro／Cloudflare）、Instagram DM 受付への切替、バックアップから任意環境へ復元可能 | 停止から移行完了まで数時間の予約停止 | ADR-0001 |

---

## 3. Server Action パイプライン

### 3.1 公開（`createBooking` の例）

```ts
// src/features/booking/actions.ts — 'use server'。薄く保ち、検査はすべて service に置く（直接 POST でも迂回できない）
export async function createBooking(_prev: CreateBookingState, form: FormData): Promise<CreateBookingState> {
  const h = await headers()
  const { result, createdBookingId } = await submitBooking(formToObject(form), {
    ip: clientIp(h),
    userAgent: h.get('user-agent'),
  })
  // (6) 通知はレスポンス後。予約の成否に影響させない
  if (createdBookingId) after(() => notifyOwner('booking_created', createdBookingId))
  return result
}

// src/features/booking/service.ts — server-only。Next.js のリクエストなしで DB 統合テストできる（ctx.now を注入）
export async function submitBooking(raw: unknown, context: RequestContext): Promise<CreateBookingResult> {
  const ctx = { ...context, now: context.now ?? new Date() }
  // (1) 構文・意味の検証（安価）
  const parsed = createBookingSchema.safeParse(raw)
  if (!parsed.success) return { result: invalid(parsed.error) }
  const input = parsed.data
  // (2) ハニーポット: 成功を装って破棄
  if (input.website !== '') return { result: { status: 'ok', data: { doneUrl: `/${input.locale}/book` } } }
  // (3) レート制限（IP は毎回加算、電話は確認のみ・加算は成功時にトランザクション内で）
  const ipLimit = await hitWindow(rateKeys.bookingIp(ctx.ip), LIMITS.bookingIp.windowSec, LIMITS.bookingIp.limit)
  if (!ipLimit.ok) return { result: { status: 'rate_limited', retryAfterSec: ipLimit.retryAfterSec } }
  const phoneLimit = await checkPhoneDaily(input.phone)
  if (!phoneLimit.ok) return { result: { status: 'rate_limited', retryAfterSec: phoneLimit.retryAfterSec } }
  // (4) Turnstile（外部 I/O。ここまでで弾けるものは弾いておく）
  if (!(await verifyTurnstile({ token: input.turnstileToken, ip: ctx.ip, idempotencyKey: input.submissionNonce }))) {
    return { result: { status: 'bot_check_failed' } }
  }
  // (5) トランザクション insertBooking()（lock → 冪等性 → 再検証 → upsert → INSERT → カウンタ → 監査）。
  //     catch で 23P01 → conflict: slot_taken、23505（冪等性）→ 再判定、public_code / トークン衝突 → 1 回再試行、
  //     それ以外 → { status: 'error', digest }（05_state_and_flows.md 2.1）
  // …
}
```

### 3.2 管理

```ts
// src/features/admin/actions.ts — 'use server'
export async function createTimeBlockAction(input: unknown): Promise<AdminResult<service.TimeBlockOk>> {
  if (!(await requireAdmin())) return { status: 'unauthorized' }   // (1) 認証・認可（Cookie なしの直接 POST は unauthorized）
  const parsed = createTimeBlockSchema.safeParse(input)             // (2) 検証
  if (!parsed.success) return invalid(parsed.error)
  const result = await service.createTimeBlock(parsed.data)         // (3) lock 下で重なり判定・INSERT・audit_log
  if (result.status === 'ok') refresh()                             // (4) クライアントの表示を更新
  return result
}
```

| 段階 | 公開 | 管理 | 失敗時 |
|---|---|---|---|
| 認証 | なし | `requireAdmin()`（Better Auth `getSession` をサーバーで検証し `auth_session.expires_at` を確認、`ADMIN_EMAIL` 設定時はセッションのメールと照合。React `cache()` で 1 リクエスト 1 回）。ページは `requireAdminPage()` が `/admin/login?next=` へリダイレクト | `unauthorized` |
| 入力検証 | Zod（共有スキーマ） | Zod | `invalid` |
| Bot 対策 | ハニーポット → レート制限 → Turnstile | なし（認証済み） | `ok`（ダミー）/ `rate_limited` / `bot_check_failed` |
| ビジネス検証 | advisory lock 下で冪等性の判定と空き計算 SQL | advisory lock 下で重なり判定（`findOverlaps`） | `invalid` / `conflict` / `duplicate` |
| 永続化 | 1 トランザクション（READ COMMITTED） | 同左 | SQLSTATE を写像 |
| 監査 | `audit_log`（actor `customer:<booking_id>`） | `audit_log`（actor `owner`） | — |
| 戻り値 | 最小（`doneUrl`） | DTO | — |
| 副作用 | `after()` で Push | `refresh()`／`updateTag()` | 予約の成否に影響させない |

`serverActions.bodySizeLimit` は既定 1 MB。`serverActions.allowedOrigins` は設定しない（同一オリジンのみ）。

---

## 4. 認証・セッション（Better Auth）

| 項目 | 設定 | 関連 |
|---|---|---|
| 構成 | Better Auth 1.7.7（`src/lib/auth.ts`。共有の `pg` Pool＋Drizzle アダプタ、表は `auth_*`。`telemetry` 無効）＋`@better-auth/passkey` の `passkey()`。フォールバックは `emailOTP()`（6 桁、アプリ内で入力。OI-12 決定済み）。`magicLink()` は使わない（メールのリンクが Safari で開き PWA にセッションが入らないため）。プラグインの最後に `nextCookies()`（Server Action からセッション Cookie を設定するため） | FR-A-01, ADR-0006 |
| ワンタイムコード | `otpLength: 6`、`expiresIn: 600`（10 分）、`allowedAttempts: 5`（超過で失効）、`storeOTP: 'hashed'`（`auth_verification.value` はハッシュ）、`disableSignUp: true`、送信は `type === 'sign-in'` のみ。配信は Resend の HTTP API を直接呼ぶ（SDK なし、タイムアウト 8 秒、差出人 `RESEND_FROM`、件名・本文にコード）。`RESEND_API_KEY` 未設定時は開発環境（Vercel 外）だけコードをサーバーログに表示、テストはメモリに保持、本番・preview はエラーログのみ（コードは出さない）。メールを使わない場合はリカバリーコード【要確認: OI-21】 | FR-A-01, OI-21 |
| HTTP エンドポイントの無効化 | `disabledPaths` で emailOTP の全エンドポイント（`/email-otp/*`、`/sign-in/email-otp`、`/forget-password/email-otp`）と `/update-user`・`/delete-user`・`/change-email` を無効化。コードの送信・照合は `requestAdminOtpAction`・`verifyAdminOtpAction`（独自のレート制限付き、06_api.md 3.0）からサーバー API でのみ行う | FR-A-01, T-01 |
| サインアップ | 無効（`emailAndPassword.enabled: false`、`disableSignUp`）。管理者は `scripts/seed-admin.ts`（`npm run db:seed-admin`。`db:seed` も `ADMIN_EMAIL` があれば作成）で `ADMIN_EMAIL` から作成し、初回ログイン（フォールバック経由）後に S-A-10 でパスキーを登録 | FR-A-01 |
| パスキー | `rpID` = `new URL(SITE_URL).hostname`、`rpName` = `予約管理`、`origin` = `SITE_URL`、`authenticatorSelection: { residentKey: 'required', userVerification: 'required' }`。iCloud キーチェーン同期を前提に 2 本目（予備端末）の登録を推奨 | FR-A-01 |
| セッション | `expiresIn: 30 日`、`updateAge: 1 日`（1 日以上経ったセッションを利用時に延長＝30 日ローリング）。PWA は起動時と可視化時に `authClient.getSession()` を呼ぶ（1 時間に 1 回まで）。`auth_session` に UA・IP を保持し端末一覧に使う。`trustedOrigins` は `SITE_URL` のみ | NFR-SC-01 |
| Cookie | HTTPS（`SITE_URL` が `https://`）では Better Auth の全 Cookie を `__Host-bb.*`（セッションは `__Host-bb.session_token`）とし、`HttpOnly; Secure; SameSite=Lax; Path=/`、Domain なし。HTTP のローカル開発は `__Host-` が `Secure` を要するため接頭辞を `bb` にする（`lib/auth-cookie.ts`）。Better Auth 自身の `__Secure-` を重ねないよう `advanced.useSecureCookies: false`＋`advanced.cookiePrefix`＋`defaultCookieAttributes` で指定。**`Max-Age=2592000` を付けた永続 Cookie**（セッション Cookie にしない。WebKit 272325 対策）で、延長のたびに更新される | FR-A-01, AT-17 |
| ログイン試行制限 | Better Auth の `rateLimit`（本番のみ有効、`storage: 'database'` ＝ `auth_rate_limit` 表、全体 60 回/60 秒、`/sign-in/passkey`・`/passkey/verify-authentication` は 10 回/10 分。IP は `x-forwarded-for`・`x-real-ip`）＋`rate_limits` の `otp:ip:{hmac}` 3 回/10 分（コード送信）、`login:ip:{hmac}` 10 回/10 分・`login:acct` 20 回/時（コード照合） | FR-S-04 |
| proxy.ts | `/admin` と `/admin/*` で、`/admin/login`・`/admin/install` と Server Action の POST（`Next-Action` ヘッダー付き）以外は、セッション Cookie（`sessionCookieName()`）の有無だけを確認し、無ければ `/admin/login?next={パス＋クエリ}` へ 307。Server Action は `requireAdmin()` が `unauthorized` を返す。**認可の本体ではない** | NFR-SC-02 |
| DAL | `requireAdmin()`（`features/admin/auth.ts`）は `import 'server-only'`。React `cache()` で 1 リクエスト 1 回 | NFR-SC-02 |
| 他端末ログアウト | 1 トランザクションで、現セッション以外に紐づく（`session_id` が NULL を含む）`push_subscriptions` を削除 → 現セッション以外の `auth_session` 行を削除（Better Auth の `revokeOtherSessions` は使わない）、`audit_log session.revoke_others` | FR-A-16 |
| ログアウト | 端末の購読解除（`unsubscribePushAction`＋`pushManager` の解除）→ `authClient.signOut()` → `/admin/login` | FR-A-09 |
| ドメイン移行 | パスキーは RP ID（ホスト名）に紐づくため、新ドメインではフォールバックでログインしてパスキーを再登録する（移行手順書に記載） | ADR-0001 |

---

## 5. トークン・ハッシュ

| 対象 | 生成 | 保存 | 照合・期限 | 関連 |
|---|---|---|---|---|
| キャンセルトークン | `randomBytes(32).toString('base64url')`（43 文字、256 bit） | `cancel_token_hash = sha256(raw)`（bytea, UNIQUE）。生値は保存・ログしない | 形式 `^[A-Za-z0-9_-]{43}$` → ハッシュで検索 → `timingSafeEqual`。キャンセル可は `now < cancel_token_expires_at`（開始 − `cancel_deadline_min`）、閲覧可は `upper(during) + 24h` まで。キャンセル実行・管理者キャンセルで `NULL` 化（単回使用）。管理者の再発行（`reissueConfirmationUrl`）と同一ブラウザの再送（`submission_nonce` 一致）で新しい値に置き換え、旧リンクは無効 | FR-S-06, NFR-SC-05 |
| 予約番号 `public_code` | Crockford base32 8 文字（約 40 bit、`I L O U` を除く） | 平文（UNIQUE） | **権限ではない**（表示・電話での照合用）。URL に使わない | FR-C-11 |
| 冪等性キー | `sha256(startsAt ISO + '\|' + menuId + '\|' + phone_e164)`（`\|` は表の区切りのエスケープ。区切り文字は縦棒 1 文字） の hex | 平文（有効状態で部分 UNIQUE） | 同一人物・同一枠の二重送信検出 | FR-S-01 |
| submission nonce | `crypto.randomUUID()`（確認画面表示時、`sessionStorage`） | `submission_nonce_hash = sha256(nonce)` | `23505` 時の同一ブラウザ判定（T-05） | G-04 |
| Undo トークン | `{ b: bookingId, prev, next, exp: now+10s, h?: 変更前の cancel_token_hash, d?: 削除フラグ }` の base64url を、`HMAC(BETTER_AUTH_SECRET, 'bb-undo-token-v1')` で導出した鍵で HMAC-SHA256 署名（`features/admin/undo.ts`） | 保存しない | 署名（`timingSafeEqual`）と期限を検証し、予約がまだ `next` の状態であることを確認。`h` は秘密ではない（生トークンは復元できない）が、Undo で顧客の確認リンクを元に戻すために使う | FR-A-04 |
| IP・電話の HMAC | `HMAC-SHA256(PII_HASH_SECRET, value)` を base64url 22 文字に切り詰め | `rate_limits.key`、`audit_log.diff.phone_tail`（末尾 4 桁の HMAC） | 突合のみ。逆算不可 | FR-S-04, FR-S-07 |
| 匿名化後の電話 | `HMAC-SHA256(PII_HASH_SECRET, phone_e164)` | `customers.phone_hash` | 再来時の名寄せ（任意） | 10.3 |

`PII_HASH_SECRET` を変更すると既存のレート制限キーと `phone_hash` の突合ができなくなる（機能上の影響は軽微）。年 1 回の見直しで必要時のみ変更する。

---

## 6. レート制限

### 6.1 アプリ側（Postgres `rate_limits`、固定窓）

| キー | 窓 | 上限 | 加算タイミング | 超過時 | 関連 |
|---|---|---|---|---|---|
| `book:ip:{hmac(ip)}` | 10 分 | 5 | `createBooking` の段階 3 で毎回 | `rate_limited`（`retryAfterSec` = 窓の残り） | FR-S-04, AT-08 |
| `book:phone:{hmac(phone)}` | JST 暦日 | 3 | 予約確定のトランザクション内（成功時のみ） | `rate_limited`（4 件目を拒否） | FR-S-04 |
| `cancel:ip:{hmac(ip)}` | 1 分 | 10 | proxy.ts（`/{locale}/cancel/*` の GET とキャンセルの Server Action POST）と `/api/ics/*` の Route Handler で毎回 | 429＋`Retry-After`（キャンセルはロケール別の簡易 HTML） | FR-S-04, AT-07 |
| `otp:ip:{hmac(ip)}` | 10 分 | 3 | `requestAdminOtpAction` ごと | `rate_limited` | FR-S-04, FR-A-01 |
| `login:ip:{hmac(ip)}` | 10 分 | 10 | `verifyAdminOtpAction` ごと | `rate_limited` | FR-S-04 |
| `login:acct` | 1 時間 | 20 | 同上 | `rate_limited`（管理者 1 名のためアカウント単位でも制限） | FR-S-04 |

```sql
-- 固定窓の加算（$1 key, $2 窓秒）。返り値の count が上限を超えたら拒否
INSERT INTO rate_limits (key, window_start, count)
VALUES ($1, to_timestamp(floor(extract(epoch FROM now()) / $2) * $2), 1)
ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1
RETURNING count,
  ceil(extract(epoch FROM (window_start + make_interval(secs => $2) - now())))::int AS retry_after;

-- 電話の確認のみ（加算は成功時）。JST 暦日の 0:00 を窓の起点にする
SELECT coalesce(sum(count), 0) FROM rate_limits
WHERE key = $1 AND window_start = ((now() AT TIME ZONE 'Asia/Tokyo')::date)::timestamp AT TIME ZONE 'Asia/Tokyo';
```

- クライアント IP は `lib/client-ip.ts` の `clientIp(headers)` が `x-forwarded-for` の先頭（無ければ `x-real-ip`、どちらも無ければ `127.0.0.1`）から取得する。Vercel はこのヘッダーを自ら設定する（`@vercel/functions` の `ipAddress()` と同じ値）ため、Vercel 上ではクライアントが偽装できない。Vercel 以外へ移す場合は前段のプロキシが `x-forwarded-for` を上書きすることを確認する。IP は HMAC（`rate_limits`）と `consents.ip`（1 年で NULL 化）以外に保存しない。
- 固定窓は境界で最大 2 倍のバーストを許すが、本件の規模では許容（スライディングウィンドウにするほどの価値はない）。
- 古い窓は日次サマリー Cron のハウスキーピングで削除（2 日超）。
- Neon の scale to zero でデータが消えないよう、`UNLOGGED` テーブルにはしない。

### 6.2 Vercel WAF（Hobby: 1 ルール）

| 項目 | 設定 |
|---|---|
| ルール名 | `booking-abuse-coarse` |
| 条件 | （Request Path が正規表現 `^/(ja\|en)/(cancel/\|book/confirm)` に一致）OR（Request Path が `/api/ics/` で始まる） |
| 方式 | Rate Limit、固定窓 60 秒、キー: IP |
| 閾値 | 30 リクエスト/60 秒（アプリ側より緩く、正当な操作を妨げない粗い上限） |
| アクション | 429 Too Many Requests（60 秒） |
| 目的 | アプリ・DB に届く前に大量アクセスを落とす（WAF で拒否したトラフィックは CDN リクエスト・転送量に計上されない） |
| Pro 移行後 | 40 ルールまで可能。キャンセル（10/分）と確定（5/10 分）を別ルールに分割し、`/admin/login` のルールを追加 |

---

## 7. Turnstile

| 項目 | 仕様 | 関連 |
|---|---|---|
| ウィジェット | S-C-04 のみ。Managed モード（多くの場合非対話）、`appearance: 'interaction-only'`、`language` はロケール、`action: 'create_booking'` | FR-S-05 |
| トークン | 300 秒有効・単回使用。`expired-callback` で `reset()`。送信失敗後も `reset()` | FR-S-05 |
| siteverify | `POST https://challenges.cloudflare.com/turnstile/v0/siteverify`、本文 `secret`, `response`, `remoteip`, `idempotency_key`（= submissionNonce）。タイムアウト 5 秒 | FR-S-05 |
| 判定 | `success === true` かつ `hostname` が `SITE_URL` のホストと一致かつ `action === 'create_booking'` | FR-S-05 |
| 障害時 | siteverify がタイムアウト・5xx の場合は **fail closed**（`bot_check_failed`）とし、画面に Instagram DM の案内（`InstagramLink`）を出す。警告ログに記録（Sentry 導入後は Sentry） | — |
| ローカル | `TURNSTILE_SECRET_KEY` 未設定時は siteverify を省略してログに記録（`env.ts` が deployed では必須にする）。サイトキー未設定時はウィジェットを描画せずダミートークンを送る | — |
| CSP | `script-src`・`frame-src` に `https://challenges.cloudflare.com` | NFR-SC-06 |
| アクセシビリティ | 画像 CAPTCHA を出さない（WCAG 3.3.8） | NFR-SC-01 |

---

## 8. CSP・HTTP ヘッダー

### 8.1 全ルート共通（`next.config.ts` の `headers()`）

| ヘッダー | 値 | 関連 |
|---|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | NFR-SC-06 |
| `X-Content-Type-Options` | `nosniff` | NFR-SC-06 |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | NFR-SC-06 |
| `X-Frame-Options` | `DENY` | NFR-SC-06 |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | NFR-SC-06 |
| `Cross-Origin-Opener-Policy` | `same-origin` | — |
| `X-Robots-Tag` | `noindex`（`VERCEL_ENV !== 'production'` の場合のみ） | 01_sitemap.md |

### 8.2 CSP（公開ページ: 静的シェルを持つため nonce なし。現在は `Content-Security-Policy-Report-Only`）

```text
default-src 'self';
script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com;
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
font-src 'self';
connect-src 'self';
frame-src https://challenges.cloudflare.com;
frame-ancestors 'none';
form-action 'self';
base-uri 'self';
object-src 'none';
worker-src 'self';
manifest-src 'self';
report-uri <SENTRY_CSP_REPORT_URI>          ← SENTRY_CSP_REPORT_URI 設定時のみ
```

- `next.config.ts` の `headers()` が `/admin` 以外の全パス（`/((?!admin(?:/|$)).*)`）に **`Content-Security-Policy-Report-Only`** として付与する。強制（`Content-Security-Policy`）への切替時に `upgrade-insecure-requests` を加える（Report-Only ではブラウザが無視するため、現在は含めない）。
- next/font は自己ホスト（ビルド時に取得）、Vercel Web Analytics は同一オリジン（`/_vercel/insights`）、Sentry は `tunnelRoute: '/monitoring'` で同一オリジンのため、`connect-src 'self'` で足りる（Analytics・Sentry は未導入）。
- 公開ページは Cache Components の静的シェルに nonce を埋められないため `script-src 'unsafe-inline'` を許容する（`'unsafe-eval'` は本番で不可）。代償として XSS 対策は React のエスケープと入力の非 HTML 描画に依存する（T-09）。
- 開発時のみ `'unsafe-eval'` を追加。

### 8.3 CSP（`/admin/**`: 動的レンダリングのため nonce 方式）

```text
default-src 'self';
script-src 'self' 'nonce-<per-request>' 'strict-dynamic';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
font-src 'self';
connect-src 'self';
frame-src 'none';
frame-ancestors 'none';
form-action 'self';
base-uri 'self';
object-src 'none';
worker-src 'self';
manifest-src 'self';
upgrade-insecure-requests;                  ← 開発時は付けない（開発時は script-src に 'unsafe-eval' を追加）
report-uri <SENTRY_CSP_REPORT_URI>          ← 設定時のみ
```

- 強制（`Content-Security-Policy`）。`lib/admin-csp.ts` が組み立て、proxy.ts が `/admin` 配下のリクエストごとに付与する（公開ページの Report-Only は送らない）。
- nonce は proxy.ts で `Buffer.from(crypto.randomUUID()).toString('base64')` から生成し、レスポンスの `Content-Security-Policy` に加えて、リクエストヘッダーの `x-nonce` と `Content-Security-Policy` にも載せる（Next.js はリクエストの CSP ヘッダーから nonce を読み、自身のスクリプトに付与する）。`'strict-dynamic'` により nonce 付きスクリプトが読み込むチャンクも許可される。
- nonce を各リクエストで埋め込むため、管理のルートレイアウト（`(admin)/admin/layout.tsx`）と `(app)/layout.tsx` は `export const instant = false` とし、ルートレイアウトで `await headers()` を呼んで静的シェルを作らない。

### 8.4 ルート別の追加ヘッダー

| ルート | 追加 | 理由 |
|---|---|---|
| `/{locale}/book/done/*`、`/{locale}/cancel/*`、`/api/ics/*` | `Referrer-Policy: no-referrer`、`X-Robots-Tag: noindex, nofollow`、`Cache-Control: private, no-store`（ICS は Route Handler も同じヘッダーを返す） | トークン保護（T-06） |
| `/{locale}/book/time`・`/info`・`/confirm` | `X-Robots-Tag: noindex` | 01_sitemap.md 5.3 |
| `/admin`・`/admin/**` | `X-Robots-Tag: noindex, nofollow`、`Cache-Control: private, no-store` | 管理情報のキャッシュ禁止 |
| `/manifest.webmanifest` | `Cache-Control: public, max-age=0, must-revalidate` | 管理 PWA の manifest |
| `/sw.js` | `Cache-Control: no-cache, no-store, must-revalidate`、`Content-Type: application/javascript; charset=utf-8`、`Content-Security-Policy: default-src 'self'; script-src 'self'` | SW の即時更新 |
| `/api/**` | `Cache-Control: no-store` | — |

導入手順: 公開ページは現在 `Content-Security-Policy-Report-Only`。staging で 1 週間運用し、違反 0 件（Turnstile・Analytics・Sentry・next/font を含む全画面）を確認してから強制に切り替え、同時に `upgrade-insecure-requests` を加える（AT-26）。`/admin/**` は最初から強制。共通ヘッダーには `poweredByHeader: false` により `X-Powered-By` を出さない。

---

## 9. 個人情報とログ

| 区分 | 書いてよいもの | 書いてはいけないもの | 実装 |
|---|---|---|---|
| アプリログ（Vercel） | 予約 ID、`public_code`、状態、SQLSTATE、所要時間、`error.digest` | 氏名、ふりがな、電話番号、備考、トークン（生値・URL）、IP（HMAC は可） | `lib/logger.ts`（1 行 JSON）が既知キー（`name`, `nameKana`, `phone`, `phoneE164`, `note`, `token`, `cancelUrl`, `doneUrl`, `ip`, `userAgent`, `turnstileToken`）を `[redacted]` に置換。予期しない例外はメッセージと `digest` のみ |
| Sentry（未導入） | 例外、スタック、ルート名 | 同上、リクエスト本文、Cookie | 導入時: `sendDefaultPii: false`、`beforeSend` で URL の `/book/done/*`・`/cancel/*`・`/api/ics/*` を `[token]` に置換し `request.data`・`cookies` を削除 |
| Web Analytics（未導入） | 正規化したパス（`/[locale]/book/done/[token]`）、ステップ | トークン、クエリの個人情報 | 導入時: `<Analytics beforeSend>` |
| `audit_log.diff` | 変更前後の状態・時刻・メニュー ID・`phone_tail`（末尾 4 桁の HMAC）・件数・設定値 | 氏名・電話・備考（`owner_note` を含む）の本文 | `lib/audit.ts` の `audit()` はスカラー値の `diff` だけを受け付け、各呼び出し側が記録する列を明示的に選ぶ（許可リスト方式） |
| `notification_log.error` | HTTP ステータス、エラー種別 | エンドポイント URL 全体、ペイロード | — |
| 通知ペイロード | 日付・時刻・メニュー名・経路・件数（未確認件数、日次サマリーの予約数） | 氏名、電話番号、備考、トークン | `lib/notify.ts`・`features/notifications/digest.ts`（05_state_and_flows.md 7.1）、NFR-SC-07 |
| エクスポート | 顧客・予約・同意 | IP・UA、他顧客の情報、（Phase 3）要配慮情報 | FR-A-14 |

---

## 10. バックアップ・復元（概要。詳細手順は `docs/07_release/`）

| 項目 | 内容 | 関連 |
|---|---|---|
| 方式 | GitHub Actions `.github/workflows/backup.yml`、毎日 18:17 UTC（03:17 JST。GitHub が毎時 0 分の起動を最も遅らせるため 0 分を避けた）＋手動実行、`environment: backup`（環境シークレット。デプロイ対象ブランチを `main` に限定し、必須レビューは付けない。付けると定期実行が承認待ちで止まる） | FR-S-08 |
| 接続 | シークレット `PROD_DATABASE_URL`（Neon の直結 URL。`-pooler` なら警告。読み取り専用ロール `backup_ro`: `pg_read_all_data` を推奨、`sslmode=require`） | T-07 |
| 取得 | `pg_dump --format=custom --no-owner --no-privileges`（クライアントは PGDG の `postgresql-client-${PG_MAJOR}`、既定 17。サーバーのメジャー版より古ければ失敗させる）。`pg_restore --list` で読めることと `bookings_no_overlap` が含まれることを確認 | FR-S-08 |
| 暗号化 | `age --encrypt --recipient $BACKUP_AGE_RECIPIENT`（CI は暗号化だけでき、復号できない）。未設定時のみ `BACKUP_PASSPHRASE` で gpg 対称暗号（AES256）。復号鍵は開発者とクライアントがオフラインで 2 部保管 | NFR-OP-01 |
| 保存 | Actions アーティファクト `retention-days: 30`（30 世代）＋SHA-256。**リポジトリが公開ならジョブ自体を失敗させる**（暗号化済みでもアーティファクトを置かず、Cloudflare R2 等の非公開ストレージに置く）【要確認: リポジトリの公開/非公開（11 章）】 | FR-S-08 |
| 監視 | ジョブ失敗は GitHub の通知メール（Sentry の cron モニタ枠は日次サマリーに使用） | NFR-OP-02 |
| 補助 | Neon の 6 時間履歴（ブランチ復元）で直近の誤操作に対応 | CON-03 |
| 復元手順 | ① アーティファクト取得 → ② `age -d` → ③ staging（または新規 Neon ブランチ）に `pg_restore --clean --if-exists --no-owner` → ④ 件数照合と `bookings_no_overlap` の存在確認 → ⑤ E2E スモーク → ⑥ 本番切替時は `DATABASE_URL` を差し替えて再デプロイ | NFR-AV-04, AT-28 |
| 目標 | RTO 4 時間、RPO 24 時間。公開前に 1 回、以後月 1 回リハーサル | NFR-AV-04, NFR-OP-01 |

---

## 11. 依存関係・サプライチェーン

| 項目 | 方針 | 関連 |
|---|---|---|
| バージョン固定 | すべて exact version。`engines.node: ">=22.12.0"`（本番・CI は `.nvmrc` の 24。ADR-0009） | NFR-SC-08 |
| `.npmrc` | `ignore-scripts=true`、`save-exact=true`、`engine-strict=true` | NFR-SC-08 |
| インストール | CI は `npm ci` のみ | NFR-OP-04 |
| 更新 | Renovate（`renovate.json`）: `config:recommended`＋`helpers:pinGitHubActionDigests`、`rangeStrategy: pin`、`minimumReleaseAge: "7 days"`、devDependencies の patch/minor は CI 通過で自動マージ、本番依存は PR レビュー、`next`・`react`・`drizzle`・`better-auth` などはグループ化して自動マージしない、major は Dependency Dashboard で承認。セキュリティ更新は即時 | NFR-OP-04 |
| Next.js | 着手時点の 16.4.x 最新パッチを使う（2026-10-14 に上流依存の Critical 2 件・High 1 件の修正版が予告されている） | — |
| 監査 | CI で `npm audit --omit=dev --audit-level=high`、GitHub Dependabot alerts | NFR-SC-08 |
| GitHub Actions | サードパーティ Action は SHA ピン留め、`permissions: contents: read` を既定、シークレットは環境単位で必須レビュー | NFR-SC-08 |
| 更新停止ライブラリ | `web-push` 3.6.7（2024-01 以降更新なし）は依存が少なく機能が安定しているため採用継続。脆弱性が出た場合は代替（Node `crypto` での自前 VAPID/aes128gcm 実装）を検討 | FR-S-03 |

---

## 12. 秘密情報の管理

| 秘密 | 保管 | ローテーション | 変更時の影響 |
|---|---|---|---|
| `VAPID_PRIVATE_KEY` | Vercel（Production / Preview 別） | 原則しない | 全購読が無効 → 端末で再購読 |
| `BETTER_AUTH_SECRET` | Vercel | 漏えい時 | 全セッション失効、Undo トークン無効 |
| `CRON_SECRET` | Vercel | 年 1 回 | なし（Vercel が自動で付与） |
| `TURNSTILE_SECRET_KEY` | Vercel | 漏えい時 | なし |
| `PII_HASH_SECRET` | Vercel | 原則しない | レート制限・`phone_hash` の突合不可（軽微） |
| `DATABASE_URL*` | Neon 連携 / GitHub | 漏えい時（Neon でパスワード再生成） | 再デプロイ |
| `BACKUP_AGE_RECIPIENT` と秘密鍵 | GitHub / オフライン 2 部 | 漏えい時 | 過去バックアップは旧鍵で復号 |

アカウント名義（Vercel・Neon・GitHub・Sentry・Cloudflare）は【要確認: OI-15】。引継ぎ時は秘密の一覧と保管場所を運用マニュアルの「アカウント一覧」に記載する（NFR-OP-05）。
