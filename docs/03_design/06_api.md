# 06 API 設計 — Server Actions / RSC データ取得 / Route Handlers

## 文書情報

| 項目 | 内容 |
|---|---|
| 文書 ID | DES-06 |
| 版 | v0.2 |
| 日付 | 2026-10-10 |
| 変更履歴 | v0.2（2026-10-10）: 要件定義書 v0.4 の反映。ログインのフォールバック `requestAdminOtp`・`verifyAdminOtp`（OI-12）、`getAvailability` が × の枠も理由付きで返す（FR-C-07）、`createTimeBlock` のプリセット変更（FR-A-06）、`createManualBooking` に重なり上書きがないことを明記（OI-11） |
| 関連要件 | FR-C-07〜12, FR-A-01〜16, FR-S-02〜08, FR-S-10〜12, NFR-SC-02〜05, AT-03, AT-07, AT-08, AT-27 |
| 関連 ADR | ADR-0004（公開 REST なし）、ADR-0006（認証）、ADR-0007（Push） |

---

## 1. 共通規約

| # | 規約 | 内容 |
|---|---|---|
| API-01 | 書き込みは Server Action | `features/*/actions.ts`（`'use server'`）は薄く、`service.ts`（`server-only`）に委譲。POST のみ・Origin/Host 照合は Next.js 既定 |
| API-02 | 読み取りは RSC | ページの Server Component が DAL（`queries.ts`、`server-only`、DTO を返す）を直接呼ぶ。クライアントからの定期取得のみ Route Handler GET |
| API-03 | 認可は毎回 | 管理アクションは最初に `requireAdmin()`（Better Auth のセッションをサーバーで検証）。proxy.ts の Cookie チェックは楽観的な導線に過ぎない |
| API-04 | 検証順 | 公開: Zod → ハニーポット → レート制限 → Turnstile → トランザクション。管理: `requireAdmin` → Zod → トランザクション |
| API-05 | 期待されるエラーは戻り値 | `throw` は予期しない例外のみ（`error.tsx`・Sentry、`digest` を返す） |
| API-06 | 最小の戻り値 | 予約確定は `doneUrl` のみ。DTO に `cancel_token_hash`・`idempotency_key`・IP・UA を含めない |
| API-07 | 監査 | 状態を変えるアクションは同一トランザクションで `audit_log` に記録（`actor`、`action`、`entity`、PII を含まない `diff`） |
| API-08 | キャッシュ無効化 | メニュー・営業時間・設定の変更は `updateTag('menus' / 'hours' / 'settings')`。予約系は `refresh()`（タグなし） |
| API-09 | 文言 | エラー文はサーバーでキー（`booking.errors.slotTaken` 等）を返し、クライアントが next-intl で解決（`/admin` は ja 固定） |
| API-10 | 時刻 | 入力の日時は `z.iso.datetime({ offset: true })`（`+09:00`）、暦日は `z.iso.date()`（JST）。サーバーで `Asia/Tokyo` として解釈 |

### 1.1 共通の戻り値型

```ts
// src/lib/action-result.ts
export type ActionResult<T = void> =
  | { status: 'ok'; data: T }
  | { status: 'invalid'; fieldErrors: Record<string, string[]>; reason?: 'not_bookable' }
  | { status: 'conflict'; reason: 'slot_taken' | 'overlap' | 'undo_blocked'; overlaps?: OverlapDTO[] }
  | { status: 'duplicate' }
  | { status: 'rate_limited'; retryAfterSec: number }
  | { status: 'bot_check_failed' }
  | { status: 'restricted' }                 // booking_restriction（Should）
  | { status: 'past_deadline' }
  | { status: 'not_found' }
  | { status: 'unauthorized' }               // 401 相当（Cookie なしの直接 POST、AT-27）
  | { status: 'error'; digest: string }

export type OverlapDTO = { kind: 'booking' | 'block'; id: string; start: string; end: string; label: string }
```

### 1.2 共有 Zod 部品

```ts
// src/features/booking/schema.ts（抜粋）
export const Locale = z.enum(['ja', 'en'])
export const MenuSlug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(40)
export const PhoneE164 = z.preprocess(normalizePhone, z.e164())            // domain/phone.ts で NFKC・ダッシュ除去・+81 付与
export const Kana = z.preprocess(toHiragana, z.string().regex(/^[ぁ-ゖー\s　]+$/).min(1).max(50))
export const StartsAt = z.iso.datetime({ offset: true })                  // 例 2026-11-04T18:00:00+09:00
export const CancelToken = z.string().regex(/^[A-Za-z0-9_-]{43}$/)
export const Uuid = z.uuid()
```

---

## 2. 公開（顧客）

### 2.1 Server Actions

| 名前 | 入力（Zod の形） | 出力 | 認証 | 副作用 | エラー | 関連 |
|---|---|---|---|---|---|---|
| `createBooking` | `{ locale: Locale, menuSlug: MenuSlug, startsAt: StartsAt, name: string(1..50), nameKana?: Kana（locale='ja' で必須）, occupation: 'student'\|'worker', phone: PhoneE164, note?: string(0..500), consent: literal('on'), turnstileToken: string(1..2048), website: literal('')（ハニーポット）, submissionNonce: uuid }` | `ok: { doneUrl: '/{locale}/book/done/{token}' }` | なし（Turnstile＋レート制限） | `customers` upsert、`bookings` INSERT、`consents` 2 行、`rate_limits` 加算、`audit_log`、after: Push `booking_created`、`notification_log` | `invalid`（`not_bookable` 含む）、`rate_limited`、`bot_check_failed`、`restricted`、`conflict: slot_taken`（23P01）、`duplicate`（23505 かつ nonce 不一致）、`error` | FR-C-10, FR-S-01〜06, AT-03, AT-08 |
| `cancelBooking` | `{ locale: Locale, token: CancelToken }` | `ok` | トークン | `bookings.status = cancelled_by_customer`、`cancelled_at`、`cancel_token_hash = NULL`、`acknowledged_at = NULL`、`audit_log`、after: Push `booking_cancelled` | `not_found`、`past_deadline`、`rate_limited`、`error` | FR-C-12, FR-S-06, AT-07 |

`createBooking` の詳細な段階と SQLSTATE の写像は 05_state_and_flows.md 2 章。`23505` で `submissionNonce` が一致した場合のみ既存予約のトークンを再発行して `ok` を返す（00_overview.md G-04）。

### 2.2 RSC データ取得（DAL、Server Action ではない）

| 関数 | 引数 | 戻り値（DTO） | キャッシュ | 呼び出し元 | 関連 |
|---|---|---|---|---|---|
| `getActiveMenus(locale)` | `Locale` | `MenuDTO[]`（`slug, name, description, priceJpy, priceStudentJpy, durationMin`） | `"use cache"` `cacheTag('menus')` `cacheLife('days')` | S-C-01, 02, 02b, 04 | FR-C-02, FR-S-12 |
| `getBusinessCalendar()` | — | 曜日テンプレート＋今後 60 日のオーバーライド | `cacheTag('hours')` | S-C-01、JSON-LD | FR-C-14 |
| `getPublicSettings()` | — | `{ leadTimeMin, cancelDeadlineMin, maxAdvanceDays }` | `cacheTag('settings')` | S-C-03, 09 | FR-C-07 |
| `getAvailability({ menuSlug, from, to })` | `MenuSlug`, JST 暦日 ×2（最大 14 日） | `{ days: { date, status: 'available'\|'full'\|'deadline'\|'closed'\|'out_of_range', closedReason?: 'regular'\|'override', slots: { startsAt: string, status: 'available'\|'full'\|'deadline' }[] }[], nextAvailableDate?: string }`。`slots` は営業時間内の候補時刻すべて（閉店をまたぐ時刻は含めない）で、`available` 以外は UI で × の非活性行（理由ラベル 満席 / 締切）になる | **なし**（Suspense 配下） | S-C-03 | FR-C-07, 08, FR-S-02 |
| `getBookingByToken(token)` | `CancelToken` | `{ publicCode, menuName, start, end, priceJpy, isStudent, locale, canCancel, deadline } \| null` | なし（`connection()`） | S-C-05, 06, ICS | FR-C-11, 12 |

---

## 3. 管理（`/admin`）Server Actions

### 3.0 ログインのフォールバック（認証前）

OI-12 で「アプリ内で入力する 6 桁のワンタイムコード」に決定（ADR-0006 の改訂）。マジックリンク用のアクション・`magicLink()` プラグインは設けない。実装は Better Auth の `emailOTP()` プラグイン（`otpLength: 6`、`disableSignUp: true`）のサーバー API を薄く包む。この 2 つだけは `requireAdmin()` の前に呼べる。

| 名前 | 入力（Zod の形） | 出力 | 副作用 | エラー | 関連 |
|---|---|---|---|---|---|
| `requestAdminOtp` | `{}`（宛先はサーバーの `ADMIN_EMAIL` に固定し、入力で受け取らない） | `ok`（送信の有無にかかわらず同じ応答。列挙対策） | 6 桁コードを生成しハッシュ化して `auth_verification` に保存（期限 仮 10 分）、Resend で管理者メールへ送信、`rate_limits`（`otp:ip:{hmac}` 3 回/10 分・仮）、`audit_log auth.otp_requested`。配信経路は【要確認: OI-21】（メールを使わない場合は事前発行のリカバリーコードに置き換え、このアクションは不要） | `rate_limited`、`error` | FR-A-01, AT-13 |
| `verifyAdminOtp` | `{ code: string.regex(/^\d{6}$/), next?: string（同一オリジンの相対パスのみ） }` | `ok: { redirectTo }` | 照合（`timingSafeEqual`、失敗 5 回で失効・仮）→ セッション発行（`__Host-` Cookie、30 日ローリング）、`audit_log auth.otp_login` | `invalid`（不一致・期限切れ）、`rate_limited` | FR-A-01, AT-13 |

### 3.1 管理アクション（要ログイン）

すべて `requireAdmin()` を最初に実行し、未認証は `unauthorized` を返す（AT-27）。

| 名前 | 入力（Zod の形） | 出力 | 副作用 | エラー | 関連 |
|---|---|---|---|---|---|
| `createManualBooking` | `{ customerId?: uuid, name: string(1..50), nameKana?: string(..50), phone?: PhoneE164, menuId: uuid, startsAt: StartsAt, source: 'phone'\|'walk_in'\|'instagram'\|'line'\|'manual', ownerNote?: string(..500), linkLocale: Locale }` | `ok: { bookingId, confirmUrl, warnings: ('outside_hours'\|'block_overlap')[] }` | `customers` 作成/紐付け（電話あり＝`phone_unverified=true`）、`bookings`（`acknowledged_at=now()`、トークン発行）、`audit_log` | `invalid`、`conflict: overlap`（23P01、重なり詳細付き）。重なりを上書きして保存する入力（`force` 等）は持たない（OI-11 決定済み） | FR-A-05, US-04 |
| `updateBookingStatus` | `{ bookingId: uuid, to: BookingStatus, lateMinutes?: int(0..180), reason?: string(..200) }` | `ok: { undoToken?: string, expiresAt? }` | 遷移表（05 章 1.1）に従う。カウンタ増減、`audit_log` | `invalid`（不正な遷移）、`not_found` | FR-A-04 |
| `undoBookingChange` | `{ undoToken: string }` | `ok` | 直前状態とカウンタを復元、`audit_log booking.undo` | `invalid`（期限切れ）、`conflict: undo_blocked`（23P01） | FR-A-04 |
| `deleteBooking` | `{ bookingId: uuid }` | `ok: { undoToken }` | `status = cancelled_by_owner`、`deleted_at = now()`、`cancel_reason = 'deleted'` | `not_found` | FR-A-04 |
| `updateOwnerNote` | `{ bookingId: uuid, ownerNote: string(..500) }` | `ok` | `bookings.owner_note`、`audit_log`（本文は記録しない） | `not_found` | FR-A-04 |
| `reissueConfirmationUrl` | `{ bookingId: uuid, linkLocale: Locale }` | `ok: { confirmUrl }` | 新トークン発行（旧リンク無効）、`audit_log booking.reissue_token` | `not_found`、`invalid`（有効状態でない） | FR-A-05 |
| `acknowledgeBooking` | `{ bookingId: uuid }` | `ok: { unacknowledged: number }` | `acknowledged_at = now()`（冪等） | `not_found` | FR-A-11 |
| `acknowledgeAll` | `{}` | `ok: { unacknowledged: 0 }` | 未確認をすべて確認済み | — | FR-A-11 |
| `createTimeBlock` | `{ preset?: 'now60'\|'now120'\|'untilClose', date?: iso.date, start?: StartsAt, end?: StartsAt, kind: 'break'\|'private'\|'closed', label?: string(..50), force?: boolean }`（preset か start/end のどちらか必須、`end > start`、最大 60 日） | `ok: { blockId, start, end, publicImpactUntil: string \| null }`（顧客サイトで受付を止めた終端。リードタイム内で影響がなければ `null`。トーストの 1 行に使う） | `time_blocks` INSERT（lock 下）、`audit_log`。`now60`/`now120` は種別 `break`、`untilClose` は当日の閉店時刻までで種別 `closed` | `invalid`、`conflict: overlap`（有効予約あり かつ `force` なし） | FR-A-06, AT-21 |
| `deleteTimeBlock` | `{ blockId: uuid }` | `ok` | `deleted_at = now()`、`audit_log` | `not_found` | FR-A-06 |
| `restoreTimeBlock` | `{ blockId: uuid }` | `ok` | `deleted_at = NULL`（削除後 10 秒以内のみ） | `invalid`（期限切れ） | FR-A-06 |
| `updateBusinessHours` | `{ days: { weekday: 0..6, isClosed: boolean, openMin?: 0..1440, closeMin?: 0..1440 }[7] }` | `ok` | `business_hours` 7 行 upsert、`updateTag('hours')`、`audit_log` | `invalid`（`open < close`） | FR-A-07, AT-22 |
| `upsertHourOverride` | `{ date: iso.date, isClosed: boolean, openMin?, closeMin?, reason?: string(..100) }` | `ok: { warnings: { bookingsOnDate: number } }` | upsert、`updateTag('hours')`、`audit_log`。既存予約がある日を休業にした場合は件数を警告（予約は自動キャンセルしない） | `invalid` | FR-A-07 |
| `deleteHourOverride` | `{ date: iso.date }` | `ok` | DELETE、`updateTag('hours')` | `not_found` | FR-A-07 |
| `updateSettings` | `{ slotStepMin: 10\|15\|20\|30\|60, leadTimeMin: 0..2880, maxAdvanceDays: 1..365, cancelDeadlineMin: 0..10080, allowSameDay: boolean, digestHourJst: 0..23 }` | `ok` | `settings` UPDATE、`updateTag('settings')`、`audit_log` | `invalid` | FR-A-07 |
| `upsertMenu` | `{ id?: uuid, slug: MenuSlug, nameJa: string(1..40), nameEn: string(1..60), descriptionJa?, descriptionEn?, priceJpy: int ≥0, priceStudentJpy?: int ≥0 ≤priceJpy, durationMin: 15..480 (5 刻み), bufferAfterMin: 0..120 (5 刻み), isActive: boolean }` | `ok: { menuId }` | `menus` upsert、`updateTag('menus')`、`audit_log` | `invalid`、`conflict`（slug 重複） | FR-A-08, AT-22 |
| `reorderMenus` | `{ ids: uuid[] }` | `ok` | `sort_order` 更新、`updateTag('menus')` | `invalid` | FR-A-08 |
| `setMenuActive` | `{ menuId: uuid, isActive: boolean }` | `ok` | `is_active`、`updateTag('menus')` | `not_found` | FR-A-08 |
| `subscribePush` | `{ subscription: { endpoint: url(https), keys: { p256dh: string, auth: string } }, platform: 'ios'\|'android'\|'desktop'\|'other', replaceEndpoint?: url }` | `ok: { subscriptionId }` | `push_subscriptions` upsert（`endpoint` で一意、`session_id` = 現セッション）、`replaceEndpoint` があれば旧行削除、`audit_log` | `invalid` | FR-A-09, AT-13 |
| `unsubscribePush` | `{ endpoint: url }` または `{ subscriptionId: uuid }` | `ok` | DELETE | — | FR-A-09 |
| `touchPushSubscription` | `{ endpoint: url }` | `ok: { known: boolean }` | `last_seen_at = now()`。未知なら `known: false`（クライアントが `subscribePush` を呼ぶ） | — | FR-A-09, AT-17 |
| `sendTestPush` | `{}` | `ok: { results: { subscriptionId, platform, httpStatus: number \| null, error?: string }[] }` | 全購読へ `template: 'test'` を送信、`notification_log`、404/410 は削除 | — | FR-A-09, AT-14 |
| `logoutOtherDevices` | `{}` | `ok: { revokedSessions: number, removedSubscriptions: number }` | 他セッションに紐づく `push_subscriptions` を削除 → Better Auth `revokeOtherSessions`、`audit_log session.revoke_others` | — | FR-A-16, AT-19 |
| `exportCustomer`（Should） | `{ customerId: uuid }` | `ok: { filename, json: string }`（顧客・予約・同意履歴。IP・UA は含めない） | `audit_log customer.export` | `not_found` | FR-A-14 |
| `anonymizeCustomer`（Should） | `{ customerId: uuid, confirmPhoneLast4: string(4) }` | `ok` | 未来の有効予約を `cancelled_by_owner`、04_data_model.md 8 章の匿名化、`audit_log customer.anonymize` | `not_found`、`invalid`（下 4 桁不一致） | FR-A-14, AT-30 |
| `updateCustomerRestriction`（Should） | `{ customerId: uuid, restriction: 'none'\|'phone_only'\|'blocked' }` | `ok` | `customers.booking_restriction`、`audit_log` | `not_found` | FR-A-13 |
| `mergeCustomers`（Should） | `{ sourceId: uuid, targetId: uuid }` | `ok` | `bookings.customer_id`・`consents.customer_id` を付け替え、カウンタ合算、`source.merged_into_customer_id = target`、`audit_log` | `invalid`（同一 ID） | FR-A-13 |

パスキーのログインとログアウトは Better Auth のクライアント（`authClient.signIn.passkey()`、`signOut()`）経由で `/api/auth/*` を使う（Server Action ではない）。フォールバックのコードログインは 3.0 の Server Action を使う。

---

## 4. Route Handlers

| メソッド・パス | 認証 | 入力 | 出力 | ヘッダー | 副作用 | エラー | 関連 |
|---|---|---|---|---|---|---|---|
| `GET /api/ics/[token]` | トークン | パス `token`（`CancelToken`） | `text/calendar; charset=utf-8`。`VEVENT`（`UID: booking-{id}@{host}`、`DTSTART/DTEND` は UTC `Z`、`SUMMARY`、`LOCATION`、`DESCRIPTION` にキャンセル URL 全文、`URL`）＋`VALARM` 2 個（`TRIGGER:-P1D`、`TRIGGER:-PT1H`、`ACTION:DISPLAY`）。言語は `bookings.locale` | `Content-Disposition: attachment; filename="booking-{publicCode}.ics"`、`Cache-Control: no-store`、`X-Robots-Tag: noindex, nofollow`、`Referrer-Policy: no-referrer` | なし（レート制限カウンタのみ） | 404（無効）、429（IP 10 回/分、キャンセルと共通キー） | FR-C-11, S-C-07, AT-01 |
| `GET /api/cron/daily-digest` | `Authorization: Bearer {CRON_SECRET}`（`timingSafeEqual`） | — | `200 { result: 'sent' \| 'skipped', count }` | `Cache-Control: no-store` | 05_state_and_flows.md 5 章 | 401 | FR-A-12, AT-23 |
| `GET /api/cron/retention`（Should） | 同上 | — | `200 { anonymized: n }` | 同上 | 04_data_model.md 8 章 | 401 | FR-S-09 |
| `GET /api/admin/inbox-count` | 管理者セッション | — | `200 { unacknowledged: number, latestChangeAt: string \| null }` | `Cache-Control: no-store` | なし | 401 | FR-A-11 |
| `GET /api/admin/overlaps` | 管理者セッション | `?start=StartsAt&end=StartsAt&excludeBookingId=uuid` | `200 { overlaps: OverlapDTO[], outsideHours: boolean }` | `no-store` | なし | 400、401 | FR-A-05, 06 |
| `GET /api/admin/customers/suggest` | 管理者セッション | `?q=string(2..50)`（電話は完全一致、かなは部分一致、最大 8 件） | `200 { items: { id, name, nameKana, phoneLast4, visitCount }[] }` | `no-store` | なし | 400、401 | FR-A-05, 13 |
| `POST /api/admin/push/rotate` | 管理者セッション（Cookie）＋`Origin` 照合 | `{ oldEndpoint?: url, subscription: PushSubscriptionJSON }` | `204` | `no-store` | 旧 endpoint 行を新 endpoint に置換 | 400、401、403 | FR-A-09, AT-20 |
| `GET, POST /api/auth/[...all]` | Better Auth | Better Auth の仕様 | 同左 | Cookie `__Host-` | セッション・パスキー | ログイン試行のレート制限（Better Auth の rateLimit＋`login:` キー） | FR-A-01 |
| `GET /sw.js` | なし | — | 静的ファイル（`public/sw.js`） | `Content-Type: application/javascript; charset=utf-8`、`Cache-Control: no-cache, no-store, must-revalidate`、`Content-Security-Policy: default-src 'self'; script-src 'self'` | — | — | FR-A-15 |
| `GET /manifest.webmanifest` | なし | — | `app/manifest.ts` が生成: `name`、`short_name`、`start_url: '/admin'`、`scope: '/admin'`、`display: 'standalone'`、`theme_color`、`background_color`、`icons`（192/512/maskable）、`screenshots`（Android richer install）、`description` | `Cache-Control: public, max-age=0, must-revalidate` | — | — | FR-A-15, AT-12 |
| `GET /robots.txt`・`/sitemap.xml` | なし | — | 01_sitemap.md 5 章 | — | — | — | FR-C-14 |
| `POST /monitoring` | なし | Sentry envelope | Sentry へ中継（`tunnelRoute`） | — | — | — | FR-S-11 |

manifest は顧客サイトのページには `<link rel="manifest">` を出さず、`/admin` のレイアウトのみで参照する（顧客サイトに SW・インストール導線を出さない）。

---

## 5. エラーコード一覧（UI 文言キー）

| コード | 発生源 | JA（要旨） | EN（要旨） | UI の挙動 |
|---|---|---|---|---|
| `invalid` | Zod | 各フィールドの文言（03_screen_specs.md 1.3） | 同左 | ErrorSummary＋フィールドエラー |
| `invalid.not_bookable` | 枠再検証 | その時間は予約できません。日時を選び直してください | That time can't be booked. Please choose another time. | S-C-03 へ |
| `conflict.slot_taken` | 23P01 | 申し訳ありません。その枠はたった今埋まりました | Sorry, that time was just booked. | S-C-03 へ戻り枠再取得 |
| `conflict.overlap` | 23P01／ブロック判定 | ○○様の予約と重なります | — | OverlapAlert |
| `conflict.undo_blocked` | 23P01 | この枠は別の予約で埋まったため元に戻せません | — | トースト |
| `duplicate` | 23505 | 同じ内容のご予約がすでにあります | You already have a booking for this time. | 電話案内 |
| `rate_limited` | rate_limits／WAF | 短時間に操作が集中しました。しばらくしてからお試しください | Too many attempts. Please try again later. | `retryAfterSec` 表示 |
| `bot_check_failed` | Turnstile | 確認に失敗しました。もう一度お試しください | Verification failed. Please try again. | Turnstile reset |
| `restricted` | customers | お手数ですが、お電話でご予約ください | Please call us to book. | `tel:` |
| `past_deadline` | 締切 | キャンセル締切を過ぎています。お電話ください | The cancellation deadline has passed. Please call us. | `tel:` |
| `not_found` | トークン・ID | この予約は見つかりません | We couldn't find this booking. | 予約 CTA |
| `unauthorized` | requireAdmin | ログインしてください | — | `/admin/login` |
| `error` | 例外 | 処理できませんでした。時間をおいてお試しいただくか、お電話ください | Something went wrong. Please try again or call us. | `digest` を Sentry と突合 |
