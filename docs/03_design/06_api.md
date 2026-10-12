# 06 API 設計 — Server Actions / RSC データ取得 / Route Handlers

## 文書情報

| 項目 | 内容 |
|---|---|
| 文書 ID | DES-06 |
| 版 | v0.4 |
| 日付 | 2026-10-12 |
| 変更履歴 | v0.4（2026-10-12）: 実装との同期。戻り値型（`ActionResult` と管理用 `AdminResult`）、公開アクションの `(prevState, FormData)` 形式と入力、管理アクションのエクスポート名（`…Action`）と入出力、`moveMenuAction`・`unacknowledgeAction` の追加と `reorderMenus`・`mergeCustomers`（未実装）の整理、ログインのフォールバックのレート制限値、DAL の関数名（`getMenuCatalog`・`getWeeklyHours`・`getDayAvailability`）と `null` 返却、Route Handler に `/api/admin/free-starts` を追加、manifest を Route Handler に、キャッシュタグの実態（API-08）。v0.3（2026-10-12）: 要件定義書 v0.5 の反映。月カレンダー用の `getMonthAvailability(month)` を追加し、週ストリップの廃止に伴い `getAvailability` は選択日の時間枠の取得に用途を限定（FR-C-07、F2）。`updateCustomerRestriction` の値を `phone_only` → `dm_only` に変更（FR-A-13）。5 章のエラー文言の電話案内を Instagram DM 案内に置換（FR-C-16、F3）。v0.2（2026-10-10）: 要件定義書 v0.4 の反映。ログインのフォールバック `requestAdminOtp`・`verifyAdminOtp`（OI-12）、`getAvailability` が × の枠も理由付きで返す（FR-C-07）、`createTimeBlock` のプリセット変更（FR-A-06）、`createManualBooking` に重なり上書きがないことを明記（OI-11） |
| 関連要件 | FR-C-07〜12, FR-C-14, FR-C-16, FR-A-01〜16, FR-S-02〜08, FR-S-10〜12, NFR-SC-02〜05, AT-03, AT-07, AT-08, AT-27 |
| 関連 ADR | ADR-0004（公開 REST なし）、ADR-0006（認証）、ADR-0007（Push） |

---

## 1. 共通規約

| # | 規約 | 内容 |
|---|---|---|
| API-01 | 書き込みは Server Action | `features/*/actions.ts`（`'use server'`）は薄く、`service.ts`（`server-only`）に委譲。POST のみ・Origin/Host 照合は Next.js 既定 |
| API-02 | 読み取りは RSC | ページの Server Component が DAL（`queries.ts`、`server-only`、DTO を返す）を直接呼ぶ。クライアントからの定期取得のみ Route Handler GET |
| API-03 | 認可は毎回 | 管理アクションは最初に `requireAdmin()`（Better Auth のセッションをサーバーで検証）。proxy.ts の Cookie チェックは楽観的な導線に過ぎない |
| API-04 | 検証順 | 公開: Zod → ハニーポット → レート制限 → Turnstile → トランザクション。管理: `requireAdmin` → Zod → トランザクション |
| API-05 | 期待されるエラーは戻り値 | 予期しない例外は service で捕捉し、`digest`（UUID 先頭 8 文字）付きで `logger.error` に記録して `{ status: 'error', digest }` を返す（PII はログに出さない）。ページ側の例外は `error.tsx` |
| API-06 | 最小の戻り値 | 予約確定は `doneUrl` のみ。DTO に `cancel_token_hash`・`idempotency_key`・IP・UA を含めない |
| API-07 | 監査 | 状態を変えるアクションは同一トランザクションで `audit_log` に記録（`actor`、`action`、`entity`、PII を含まない `diff`） |
| API-08 | キャッシュ無効化 | メニューは `updateTag('menus')`、設定は `updateTag('settings')`、営業時間・休業日は `updateTag('hours')`。顧客側のキャッシュタグは `menus`（`getActiveMenus`・`getMenuCatalog`）、`settings`（`getPublicSettings`）、`settings`＋`business-hours`（`getWeeklyHours`）で、`hours` を付けた関数はない【不整合: 営業時間の変更がトップの受付時間に反映されない。実装側で `updateTag('business-hours')` に揃える予定】。予約・ブロック・受信箱・端末・顧客の変更は `refresh()`（タグなし） |
| API-09 | 文言 | エラー文はサーバーでキー（`booking.errors.*` の `phoneInvalid` 等）を返し、クライアントが next-intl で解決。`/admin` は next-intl を通さず、`features/admin/strings.ts`（ja 固定）でキーを解決 |
| API-10 | 時刻 | 入力の日時は `z.iso.datetime({ offset: true })`（`+09:00`）、暦日は `z.iso.date()`（JST）。サーバーで `Asia/Tokyo` として解釈 |

### 1.1 共通の戻り値型

```ts
// src/lib/action-result.ts
export type ActionResult<T = void> =
  | { status: 'ok'; data: T }
  | { status: 'invalid'; fieldErrors: Record<string, string[]>; reason?: 'not_bookable' }  // 値はメッセージキー、キーはフィールドパス（無いときは '_form'）
  | { status: 'conflict'; reason: 'slot_taken' | 'overlap' | 'undo_blocked' }
  | { status: 'duplicate' }
  | { status: 'rate_limited'; retryAfterSec: number }
  | { status: 'bot_check_failed' }
  | { status: 'restricted' }                 // booking_restriction（Should）
  | { status: 'past_deadline' }
  | { status: 'not_found' }
  | { status: 'unauthorized' }               // 401 相当（Cookie なしの直接 POST、AT-27）
  | { status: 'error'; digest: string }

// src/features/admin/types.ts — 重なり詳細を返す管理アクション（手動予約・ブロック）の戻り値
export type AdminResult<T> = ActionResult<T> | { status: 'conflict'; reason: 'overlap'; overlaps: OverlapDTO[] }
export type OverlapDTO = { kind: 'booking' | 'block'; id: string; start: string; end: string; label: string }  // JST ISO
```

予約確定の成功は `{ status: 'ok', data: { doneUrl: '/{locale}/book/done/{token}' } }`（相対パスのみ。API-06）。

### 1.2 共有 Zod 部品

```ts
// src/features/booking/schema.ts（抜粋。エラーは booking.errors.* のキー）
export const Locale = z.enum(['ja', 'en'])
export const MenuSlug = z.string({ error: 'menuRequired' }).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, { error: 'menuRequired' }).max(40)
export const StartsAt = z.iso.datetime({ offset: true, error: 'startsAtInvalid' })   // 例 2026-11-04T18:00:00+09:00
export const PhoneE164 = z.string().trim().min(1, { error: 'phoneRequired' }).max(32, { error: 'phoneInvalid' })
  .transform(normalizePhone).refine(isValidE164, { error: 'phoneInvalid' })     // domain/phone.ts で NFKC・記号除去・+81 付与
const Name = z.string().trim().min(1, { error: 'nameRequired' }).max(50, { error: 'nameTooLong' })
  .regex(/^[^\p{Cc}]+$/u, { error: 'nameInvalid' })                              // 制御文字を拒否
const Kana = z.string().transform(toHiragana)
  .pipe(z.string().max(50, { error: 'kanaTooLong' }).regex(HIRAGANA_RE, { error: 'kanaHiragana' }))
export const CancelToken = z.string().regex(/^[A-Za-z0-9_-]{43}$/)
// 管理側（src/features/admin/schema.ts）: Uuid = z.uuid()、IsoDate = z.iso.date()、同じ Name・Kana・PhoneE164 を別定義
```

---

## 2. 公開（顧客）

### 2.1 Server Actions

| 名前 | 入力（Zod の形） | 出力 | 認証 | 副作用 | エラー | 関連 |
|---|---|---|---|---|---|---|
| `createBooking(prevState, formData)` | `FormData`（`useActionState`）を `formToObject` で文字列化して検証: `{ locale: Locale, menuSlug: MenuSlug, startsAt: StartsAt, name: Name(1..50), nameKana?: Kana（locale='ja' で必須、`kanaRequired`）, occupation: 'student'\|'worker', phone: PhoneE164, note?: string(..500), consent: literal('on'), turnstileToken: string(1..2048), website: string(..500, 既定 '')（ハニーポット）, submissionNonce: uuid }` | `{ status: 'ok', data: { doneUrl: '/{locale}/book/done/{token}' } }` | なし（Turnstile＋レート制限） | `customers` upsert、`bookings` INSERT、`consents` 2 行、`rate_limits`（電話）加算、`audit_log booking.create`、after: `notifyOwner('booking_created')`（Push、`notification_log`）。ハニーポットに値があれば何も保存せず `ok`（`doneUrl: '/{locale}/book'`） | `invalid`（フィールドのキー、または `reason: 'not_bookable'`）、`rate_limited`、`bot_check_failed`、`restricted`、`conflict: slot_taken`（ロック下の再検証で満席。23P01 も同じ写像）、`duplicate`（同じ冪等性キーの有効な予約があり nonce 不一致）、`error` | FR-C-10, FR-S-01〜06, AT-03, AT-08 |
| `cancelBooking(prevState, formData)` | `{ locale: Locale, token: CancelToken }` | `{ status: 'ok', data: null }` | トークン | `bookings.status = cancelled_by_customer`、`cancelled_at`、`cancel_token_hash = NULL`、`acknowledged_at = NULL`、`status_changed_at`、`audit_log booking.cancel`、after: `notifyOwner('booking_cancelled')` | `not_found`（形式不正・不一致・`confirmed` 以外・閲覧期限切れを区別しない）、`past_deadline`、`error`。IP のレート制限はページと同じ URL への POST として proxy.ts が先に 429 を返す（アクションの戻り値にはならない） | FR-C-12, FR-S-06, AT-07 |

`createBooking` の詳細な段階と失敗時の応答は 05_state_and_flows.md 2 章。同じ冪等性キー（`sha256(startsAt|menuId|phone)`）の有効な予約があり `submissionNonce` が一致した場合のみ、既存予約のトークンを再発行（旧リンクは無効）して `ok` を返す（00_overview.md G-04）。

### 2.2 RSC データ取得（DAL、Server Action ではない）

| 関数 | 引数 | 戻り値（DTO） | キャッシュ | 呼び出し元 | 関連 |
|---|---|---|---|---|---|
| `getActiveMenus()`（`features/settings`） | — | `MenuDTO[]`（`slug, name: { ja, en }, description: { ja, en }, priceJpy, priceStudentJpy, durationMin`。`is_active` のみ、`sort_order` 順） | `"use cache"` `cacheTag('menus')` `cacheLife('days')` | S-C-02, 03, 02b, 04 | FR-C-02, FR-S-12 |
| `getMenuCatalog()`（`features/booking/catalog.ts`） | — | `MenuCatalogItem[]`（上と同じ項目＋`isActive`。非公開を含む全件） | `"use cache"` `cacheTag('menus')` `cacheLife('days')` | S-C-01（情報表示カード） | FR-C-14 |
| `getWeeklyHours()`（同上） | — | 曜日 7 行 `{ weekday, isClosed, openMin, closeMin }`（オーバーライドは含めない） | `"use cache"` `cacheTag('settings', 'business-hours')` `cacheLife('days')` | S-C-01（アクセスの受付時間）、JSON-LD | FR-C-14 |
| `getPublicSettings()` | — | `{ leadTimeMin, cancelDeadlineMin, maxAdvanceDays }` | `"use cache"` `cacheTag('settings')` `cacheLife('days')` | S-C-01, 03, 05, 06, 09 | FR-C-07 |
| `getAvailability({ menuSlug, from, to }, now?)` | `MenuSlug`, JST 暦日 ×2（最大 14 日） | `DayAvailabilityDTO[] \| null` = `{ date, status: 'available'\|'full'\|'deadline'\|'closed'\|'out_of_range', closedReason?: 'regular'\|'override', slots: { startsAt: string（JST ISO）, status: 'available'\|'full'\|'deadline' }[] }[]`。日付の形式不正・14 日超・未知または非公開のメニューは `null`。`slots` は営業時間内の候補時刻すべて（閉店をまたぐ時刻は含めない）で、`available` 以外は UI で × の非活性行（理由ラベル 満席 / 締切）になる。v0.3 で週ストリップを廃止したため、S-C-03 は 1 日分のラッパー `getDayAvailability({ menuSlug, date }, now?)`（`DayAvailabilityDTO \| null`）で呼び、日ごとの状態は `getMonthAvailability` を使う（2 週間分の一括取得はしない） | **なし**（Suspense 配下、`await connection()`） | S-C-03（時間枠リスト） | FR-C-07, 08, FR-S-02 |
| `getMonthAvailability({ menuSlug, month }, now?)` | `MenuSlug`, `month: 'YYYY-MM'`（JST の暦月） | `MonthAvailabilityDTO \| null` = `{ month, days: { date, status: 'available'\|'full'\|'deadline'\|'closed'\|'out_of_range', closedReason?: 'regular'\|'override' }[], prevMonth?, nextMonth?, firstAvailableDate? }`（その月の全日。`out_of_range` は過去日と 61 日以降で UI は非活性。`prevMonth`・`nextMonth` は範囲内のときのみ）。形式不正・今月〜 `today + maxAdvanceDays` を含む月の範囲外・未知または非公開のメニューは `null`（ページは今月で取り直す） | **なし**（Suspense 配下。React `cache()` による重複排除は未実装） | S-C-03（月カレンダー） | FR-C-07, 08, FR-S-02 |
| `getBookingByToken(token, now?)` | `CancelToken` | `{ id, publicCode, menuName: { ja, en }, start, end（バッファを除く表示上の終了）, priceJpy, isStudent, locale, canCancel, deadline } \| null`（`id` は ICS の UID 用でサーバー内のみ。`status = confirmed` かつ終了 24 時間後までのみ返す） | なし（呼び出し側で `await connection()`） | S-C-05, 06, ICS | FR-C-11, 12 |

---

## 3. 管理（`/admin`）Server Actions

### 3.0 ログインのフォールバック（認証前）

OI-12 で「アプリ内で入力する 6 桁のワンタイムコード」に決定（ADR-0006 の改訂）。マジックリンク用のアクション・`magicLink()` プラグインは設けない。実装は Better Auth の `emailOTP()` プラグイン（`otpLength: 6`、`expiresIn: 600`、`allowedAttempts: 5`、`storeOTP: 'hashed'`、`disableSignUp: true`）のサーバー API（`auth.api.sendVerificationOTP`・`auth.api.signInEmailOTP`）を薄く包む。emailOTP の HTTP エンドポイントは `disabledPaths` で無効にしてあり、コードの送信・照合はこの 2 つの Server Action からしかできない。この 2 つだけは `requireAdmin()` の前に呼べる。

| 名前 | 入力（Zod の形） | 出力 | 副作用 | エラー | 関連 |
|---|---|---|---|---|---|
| `requestAdminOtpAction()` | なし（宛先はサーバーの `ADMIN_EMAIL` に固定し、入力で受け取らない） | `{ status: 'ok', data: null }`（送信の有無にかかわらず同じ応答。列挙対策。`ADMIN_EMAIL` 未設定・管理者未作成でも警告ログのみで同じ応答） | `rate_limits`（`otp:ip:{hmac}` 3 回/10 分）→ 6 桁コードを生成しハッシュ化して `auth_verification` に保存（期限 10 分）、Resend の HTTP API で管理者メールへ送信（`RESEND_FROM`）、`audit_log auth.otp_requested`（`actor = system`）。配信経路は【要確認: OI-21】（メールを使わない場合は事前発行のリカバリーコードに置き換え、このアクションは不要） | `rate_limited`（送信失敗はログのみで `ok`） | FR-A-01, AT-13 |
| `verifyAdminOtpAction(input)` | `{ code: string（NFKC 正規化・空白除去後に /^\d{6}$/、`otpFormat`）, next?: string(..512)（`/admin` で始まる同一オリジンの相対パスのみ。`//`・`\`・`/admin/login` は `/admin` に置換） }` | `{ status: 'ok', data: { redirectTo } }` | `rate_limits`（`login:ip:{hmac}` 10 回/10 分、`login:acct` 20 回/時）→ Better Auth が照合（期限 10 分、失敗 5 回で失効）→ セッション発行（`nextCookies()` で Server Action から Cookie を設定。`__Host-bb.session_token`、30 日ローリング）、`audit_log auth.otp_login` | `invalid`（`code: otpInvalid`。不一致・期限切れ・試行超過を区別しない）、`rate_limited` | FR-A-01, AT-13 |

### 3.1 管理アクション（要ログイン）

すべて `requireAdmin()` を最初に実行し、未認証は `unauthorized` を返す（AT-27）。`features/admin/actions.ts` のエクスポート名は `<名前>Action`（例 `createManualBookingAction`）で、Zod 検証の後に同名（接尾辞なし）の service 関数（`features/admin/service.ts`）へ委譲する。ほかの設計書の `createManualBooking` 等の表記は service 関数名を指す。入力はオブジェクト（`FormData` ではない）。

| 名前 | 入力（Zod の形） | 出力 | 副作用 | エラー | 関連 |
|---|---|---|---|---|---|
| `createManualBookingAction` | `{ customerId?: uuid, name: Name(1..50), nameKana?: Kana(..50), phone?: PhoneE164, menuId: uuid（非公開メニューも可）, startsAt: StartsAt, source: 'phone'\|'walk_in'\|'instagram'\|'line'\|'manual', ownerNote?: string(..500), linkLocale: Locale（既定 'ja'） }`（空文字は未指定扱い） | `AdminResult`: `ok: { bookingId, confirmUrl（absoluteUrl）, warnings: ('outside_hours'\|'block_overlap')[] }` | lock 下で有効予約との重なりを `findOverlaps` で判定 → 顧客の解決（`customerId` の既存顧客 → 電話一致の既存顧客 → 新規作成。新規かつ電話ありは `phone_unverified=true`）→ `bookings`（`price_jpy = menus.price_jpy`、`locale = linkLocale`、`acknowledged_at=now()`、トークン発行・`cancel_token_expires_at`）、`audit_log booking.create`、`refresh()` | `invalid`（`menuId: menuRequired`、`customerId: customerNotFound` ほか）、`conflict: overlap`（重なり詳細 `overlaps` 付き。23P01 も同じ写像）。重なりを上書きして保存する入力（`force` 等）は持たない（OI-11 決定済み） | FR-A-05, US-04 |
| `updateBookingStatusAction` | `{ bookingId: uuid, to: BookingStatus, lateMinutes?: int(0..180), reason?: string(..200) }` | `ok: { status, undoToken?, expiresAt? }`（`undoToken` は `cancelled_by_owner`・`cancelled_late`・`no_show` のときのみ） | 遷移表（05 章 1.1）に従う。`to: 'confirmed'` は不可（復帰は Undo のみ）。キャンセル系は `cancelled_at`・`cancel_token_hash = NULL`・`cancel_reason`、`cancelled_late`／`no_show` はカウンタ +1、`completed` は `customers.last_visit_at`、`arrived` は `late_minutes`。`audit_log booking.status`、`refresh()` | `invalid`（`to: transitionInvalid`）、`not_found` | FR-A-04 |
| `undoBookingChangeAction` | `{ undoToken: string(10..1000) }` | `ok` | 署名と期限（10 秒）を検証し、予約が変更直後の状態のままなら直前状態・元の `cancel_token_hash`（顧客の確認リンク）を復元、`cancelled_at`・`cancel_reason`・`deleted_at` を NULL、カウンタ −1、`audit_log booking.undo`、`refresh()` | `invalid`（`undoToken: undoExpired`）、`conflict: undo_blocked`（23P01） | FR-A-04 |
| `deleteBookingAction` | `{ bookingId: uuid }` | `ok: { status: 'cancelled_by_owner', undoToken, expiresAt }` | `confirmed` のみ。`status = cancelled_by_owner`、`deleted_at = now()`、`cancel_reason = 'deleted'`、トークン NULL、`audit_log booking.delete` | `not_found`、`invalid`（`confirmed` 以外） | FR-A-04 |
| `updateOwnerNoteAction` | `{ bookingId: uuid, ownerNote: string(..500) }`（空文字は NULL） | `ok` | `bookings.owner_note`、`audit_log booking.owner_note`（本文は記録しない） | `not_found` | FR-A-04 |
| `reissueConfirmationUrlAction` | `{ bookingId: uuid, linkLocale: Locale }` | `ok: { confirmUrl }` | 新トークン発行（旧リンクは無効）、`cancel_token_expires_at` を現在の締切設定で再計算、`audit_log booking.reissue_token`。S-A-04 の確認 URL 欄から呼ぶ | `not_found`、`invalid`（`bookingId: notReissuable`。`confirmed` 以外、または終了 24 時間後を過ぎた） | FR-A-05 |
| `acknowledgeBookingAction` | `{ bookingId: uuid }` | `ok: { unacknowledged: number }` | `acknowledged_at = coalesce(acknowledged_at, now())`（冪等）。S-A-04 の表示時に呼ぶ | `not_found` | FR-A-11 |
| `acknowledgeAllAction` | なし | `ok: { ids: uuid[], unacknowledged: number }`（`ids` は Undo 用） | 未確認（05 章 8）をすべて確認済み、`refresh()` | — | FR-A-11 |
| `unacknowledgeAction` | `{ ids: uuid[]（≤200） }` | `ok: { unacknowledged: number }` | 「すべて確認済みにする」の Undo（`acknowledged_at = NULL`）、`refresh()` | `invalid` | FR-A-11 |
| `createTimeBlockAction` | `{ preset?: 'now60'\|'now120'\|'untilClose', start?: StartsAt, end?: StartsAt, kind: 'break'\|'private'\|'closed', label?: string(..50), force?: boolean（既定 false） }`（preset か start/end のどちらか必須、`end > start`、最大 60 日） | `AdminResult`: `ok: { blockId, start, end, publicImpactUntil: string \| null }`（顧客サイトで受付を止めた終端。リードタイム内で影響がなければ `null`。トーストの 1 行に使う） | `now60`/`now120` は開始＝現在時刻を 5 分単位で切り捨て、`untilClose` は当日の閉店時刻まで。種別は入力どおり（UI の既定は `now60`/`now120` が `break`、`untilClose` が `closed`）。`time_blocks` INSERT（lock 下）、`audit_log time_block.create`、`refresh()` | `invalid`（`preset: afterClose`、`start: rangeRequired`、`end: endBeforeStart`・`rangeTooLong`）、`conflict: overlap`（有効予約あり かつ `force` なし。重なり詳細付き） | FR-A-06, AT-21 |
| `deleteTimeBlockAction` | `{ blockId: uuid }` | `ok` | `deleted_at = now()`、`audit_log`、`refresh()` | `not_found` | FR-A-06 |
| `restoreTimeBlockAction` | `{ blockId: uuid }` | `ok` | `deleted_at = NULL`（削除後 10 秒以内のみ）、`refresh()` | `invalid`（`blockId: undoExpired`） | FR-A-06 |
| `updateBusinessHoursAction` | `{ days: { weekday: 0..6, isClosed: boolean, openMin?: 0..1440, closeMin?: 0..1440 }[7] }` | `ok` | `business_hours` 7 行 upsert、`updateTag('hours')`（API-08 の不整合を参照）、`audit_log` | `invalid`（`hoursInvalid`: `open < close`） | FR-A-07, AT-22 |
| `upsertHourOverrideAction` | `{ date: iso.date, isClosed: boolean, openMin?, closeMin?, reason?: string(..100) }` | `ok: { warnings: { bookingsOnDate: number } }` | upsert、`updateTag('hours')`、`audit_log`。その日の有効予約の件数を返す（予約は自動キャンセルしない） | `invalid` | FR-A-07 |
| `deleteHourOverrideAction` | `{ date: iso.date }` | `ok` | DELETE、`updateTag('hours')` | `not_found` | FR-A-07 |
| `updateSettingsAction` | `{ slotStepMin: 10\|15\|20\|30\|60, leadTimeMin: 0..2880, maxAdvanceDays: 1..365, cancelDeadlineMin: 0..10080, allowSameDay: boolean, digestHourJst: 0..23 }` | `ok` | `settings` UPDATE、`updateTag('settings')`、`audit_log`（`diff` は値そのもの） | `invalid` | FR-A-07 |
| `upsertMenuAction` | `{ id?: uuid, slug: MenuSlug, nameJa: string(1..40), nameEn: string(1..60), descriptionJa?: (..120), descriptionEn?: (..200), priceJpy: int 0..1,000,000, priceStudentJpy?: int ≥0 ≤priceJpy, durationMin: 15..480 (5 刻み), bufferAfterMin: 0..120 (5 刻み), isActive: boolean }` | `ok: { menuId }` | `menus` upsert（新規は末尾の `sort_order`）、`updateTag('menus')`、`audit_log menu.create`／`menu.update` | `invalid`（`slug: slugTaken` ＝ `menus_slug_unique`、`priceStudentJpy: studentPriceTooHigh` ほか）、`not_found` | FR-A-08, AT-22 |
| `moveMenuAction` | `{ menuId: uuid, direction: 'up'\|'down' }` | `ok` | 隣のメニューと並び順を入れ替え `sort_order` を 1.. で振り直す（端では何もしない）、`updateTag('menus')`、`audit_log menu.reorder`。v0.3 の `reorderMenus({ ids })` は置き換え | `not_found` | FR-A-08 |
| `setMenuActiveAction` | `{ menuId: uuid, isActive: boolean }` | `ok` | `is_active`、`updateTag('menus')`、`audit_log menu.active` | `not_found` | FR-A-08 |
| `subscribePushAction` | `{ subscription: { endpoint: url(https, ..2048), keys: { p256dh: string(16..256), auth: string(8..64) } }, platform: 'ios'\|'android'\|'desktop'\|'other'（既定 'other'）, replaceEndpoint?: url }` | `ok: { subscriptionId }` | `push_subscriptions` upsert（`endpoint` で一意、`session_id` = 現セッション、`fail_count = 0`）、`replaceEndpoint` があれば自分の旧行を削除、`audit_log` | `invalid` | FR-A-09, AT-13 |
| `unsubscribePushAction` | `{ endpoint: url }` または `{ subscriptionId: uuid }` | `ok` | 自分（現ユーザー）の行だけ DELETE、`audit_log` | `invalid` | FR-A-09 |
| `touchPushSubscriptionAction` | `{ endpoint: url }` | `ok: { known: boolean }` | `last_seen_at = now()`・`session_id` = 現セッション。未知なら `known: false`（クライアントが `subscribePushAction` を呼ぶ） | — | FR-A-09, AT-17 |
| `sendTestPushAction` | なし | `ok: { results: { subscriptionId, platform, httpStatus: number \| null, error?: string }[] }` | 全購読へ `template: 'test'`（タイトル「テスト通知」、`navigate` は `/admin/settings/notifications?test=received`）を送信、`notification_log`、404/410 は削除 | — | FR-A-09, AT-14 |
| `logoutOtherDevicesAction` | なし | `ok: { revokedSessions: number, removedSubscriptions: number }` | 1 トランザクションで、現セッション以外（`session_id` が NULL を含む）の `push_subscriptions` を削除 → 現セッション以外の `auth_session` 行を削除、`audit_log session.revoke_others`、`refresh()` | — | FR-A-16, AT-19 |
| `exportCustomerAction`（Should） | `{ customerId: uuid }` | `ok: { filename, json: string }`（顧客・予約・同意履歴。IP・UA・トークンハッシュは含めない） | `audit_log customer.export` | `not_found` | FR-A-14 |
| `anonymizeCustomerAction`（Should） | `{ customerId: uuid, confirmPhoneLast4?: string(4 桁)（電話がある顧客は必須） }` | `ok: { cancelledBookings: number }` | lock 下で未来の有効予約を `cancelled_by_owner`、04_data_model.md 8 章の匿名化、`audit_log customer.anonymize`、`refresh()` | `not_found`（匿名化済みを含む）、`invalid`（`confirmPhoneLast4: last4Mismatch`） | FR-A-14, AT-30 |
| `updateCustomerRestrictionAction`（Should） | `{ customerId: uuid, restriction: 'none'\|'dm_only'\|'blocked' }`（`dm_only` = Instagram DM のみ受付。v0.2 の `phone_only` を置換） | `ok` | `customers.booking_restriction`、`audit_log customer.restriction`、`refresh()` | `not_found`（匿名化済みを含む） | FR-A-13 |
| `mergeCustomers`（Should、**未実装**） | `{ sourceId: uuid, targetId: uuid }` | `ok` | `bookings.customer_id`・`consents.customer_id` を付け替え、カウンタ合算、`source.merged_into_customer_id = target`、`audit_log` | `invalid`（同一 ID） | FR-A-13 |

パスキーのログイン・登録・ログアウトと起動時のセッション確認は Better Auth のクライアント（`lib/auth-client.ts` の `authClient.signIn.passkey()`、`passkey.addPasskey()`、`signOut()`、`getSession()`）経由で `/api/auth/*` を使う（Server Action ではない）。`getSession()` は PWA の起動時と可視化時（1 時間に 1 回まで）に呼び、30 日の Cookie を更新させる（05_state_and_flows.md 6 章）。フォールバックのコードログインは 3.0 の Server Action を使う。

---

## 4. Route Handlers

| メソッド・パス | 認証 | 入力 | 出力 | ヘッダー | 副作用 | エラー | 関連 |
|---|---|---|---|---|---|---|---|
| `GET /api/ics/[token]` | トークン | パス `token`（`CancelToken`） | `text/calendar; charset=utf-8`。`VEVENT`（`UID: booking-{id}@{host}`、`DTSTART/DTEND` は UTC `Z`、`SUMMARY`（メニュー＋店名）、`LOCATION`（店名＋住所）、`DESCRIPTION` に予約番号とキャンセル URL 全文、`URL`）＋`VALARM` 2 個（`TRIGGER:-P1D`、`TRIGGER:-PT1H`、`ACTION:DISPLAY`）。CRLF・75 オクテット折り返し。言語は `bookings.locale`（`ics` 名前空間） | `Content-Disposition: attachment; filename="booking-{publicCode}.ics"`、`Cache-Control: no-store`、`X-Robots-Tag: noindex, nofollow`、`Referrer-Policy: no-referrer` | なし（レート制限カウンタのみ） | 404（無効）、429（IP 10 回/分、キャンセルと共通キー） | FR-C-11, S-C-07, AT-01 |
| `GET /api/cron/daily-digest` | `Authorization: Bearer {CRON_SECRET}`（`timingSafeEqual`。`CRON_SECRET` 未設定なら常に拒否） | — | `200 { result: 'sent' \| 'skipped', count }` | `Cache-Control: no-store` | 05_state_and_flows.md 5 章（送信後に 04_data_model.md 8 章のハウスキーピング） | 401 `{ error: 'unauthorized' }` | FR-A-12, AT-23 |
| `GET /api/cron/retention`（Should） | 同上 | — | `200 { anonymized: n }` | 同上 | 04_data_model.md 8 章 | 401 | FR-S-09 |
| `GET /api/admin/inbox-count` | 管理者セッション | — | `200 { unacknowledged: number, latestChangeAt: string \| null }` | `Cache-Control: no-store` | なし | 401 | FR-A-11 |
| `GET /api/admin/overlaps` | 管理者セッション | `?start=StartsAt&end=StartsAt&excludeBookingId=uuid` | `200 { overlaps: OverlapDTO[]（有効予約と未削除ブロック）, outsideHours: boolean }` | `no-store` | なし | 400（`end <= start` を含む）、401 | FR-A-05, 06 |
| `GET /api/admin/free-starts` | 管理者セッション | `?date=iso.date&menuId=uuid` | `200 { starts: string[] }`（営業時間内の 15 分刻みで、現在より後、メニューの所要＋バッファが有効予約・ブロックと重ならない開始時刻。JST ISO） | `no-store` | なし | 400、401 | FR-A-05（S-A-05 の「空き」チップ） |
| `GET /api/admin/customers/suggest` | 管理者セッション | `?q=string(2..50)`（電話は E.164 に正規化して完全一致、かな・氏名は部分一致、匿名化・削除・統合済みは除外、最大 8 件） | `200 { items: { id, name, nameKana, phoneLast4, visitCount, lastVisitAt, restriction }[] }` | `no-store` | なし | 400、401 | FR-A-05, 13 |
| `POST /api/admin/push/rotate` | 管理者セッション（Cookie）＋`Origin` 照合（ヘッダーがあれば `SITE_URL` のオリジンと一致必須） | `{ oldEndpoint?: url, subscription: { endpoint: url(https), keys: { p256dh, auth } } }` | `204` | `no-store` | `subscribePush` を `replaceEndpoint = oldEndpoint` で呼び、旧 endpoint 行を新 endpoint に置換（`platform` は旧行から引き継ぎ、無ければ `android`） | 400、401、403 | FR-A-09, AT-20 |
| `GET, POST /api/auth/[...all]` | Better Auth（`toNextJsHandler`） | Better Auth の仕様（パスキーのログイン・登録、`get-session`、`sign-out`、セッション一覧）。emailOTP・`update-user`・`delete-user`・`change-email` 系は `disabledPaths` で無効 | 同左 | Cookie `__Host-bb.*`（HTTP のローカルは `bb.*`） | セッション・パスキー | ログイン試行のレート制限（Better Auth の `rateLimit`。本番のみ、DB 保存＝`auth_rate_limit`、全体 60 回/分、パスキー認証 10 回/10 分） | FR-A-01 |
| `GET /sw.js` | なし | — | 静的ファイル（`public/sw.js`） | `Content-Type: application/javascript; charset=utf-8`、`Cache-Control: no-cache, no-store, must-revalidate`、`Content-Security-Policy: default-src 'self'; script-src 'self'` | — | — | FR-A-15 |
| `GET /manifest.webmanifest` | なし | — | Route Handler `app/manifest.webmanifest/route.ts`（静的。ビルド時に生成）: `id: '/admin'`、`name`・`short_name: '予約管理'`、`description`、`lang: 'ja'`、`start_url: '/admin'`、`scope: '/admin'`、`display: 'standalone'`、`orientation: 'portrait'`、`theme_color`・`background_color: '#f4ecdd'`、`categories`、`icons`（192/512/maskable 512）。`screenshots` は未設定 | `Content-Type: application/manifest+json; charset=utf-8`、`Cache-Control: public, max-age=0, must-revalidate` | — | — | FR-A-15, AT-12 |
| `GET /robots.txt`・`/sitemap.xml` | なし | — | 01_sitemap.md 5 章 | — | — | — | FR-C-14 |
| `POST /monitoring`（**未導入**） | なし | Sentry envelope | Sentry へ中継（`tunnelRoute`）。proxy.ts の matcher は先に除外済み | — | — | — | FR-S-11 |

manifest は顧客サイトのページには `<link rel="manifest">` を出さず、`/admin` のルートレイアウトの `metadata.manifest` のみで参照する（顧客サイトに SW・インストール導線を出さない。`app/manifest.ts` にすると全ページに `<link>` が出るため Route Handler にした）。

---

## 5. エラーコード一覧（UI 文言キー）

| コード | 発生源 | JA（要旨） | EN（要旨） | UI の挙動 |
|---|---|---|---|---|
| `invalid` | Zod | 各フィールドの文言（03_screen_specs.md 1.3） | 同左 | ErrorSummary＋フィールドエラー |
| `invalid.not_bookable` | 枠再検証 | その時間は予約できません。日時を選び直してください | That time can't be booked. Please choose another time. | S-C-03 へ |
| `conflict.slot_taken` | 23P01 | 申し訳ありません。その枠はたった今埋まりました | Sorry, that time was just booked. | S-C-03 へ戻り枠再取得 |
| `conflict.overlap` | 23P01／ブロック判定 | ○○様の予約と重なります | — | OverlapAlert |
| `conflict.undo_blocked` | 23P01 | この枠は別の予約で埋まったため元に戻せません | — | トースト |
| `duplicate` | 23505 | 同じ内容のご予約がすでにあります | You already have a booking for this time. | Instagram DM 案内（`InstagramLink`） |
| `rate_limited` | rate_limits／WAF（キャンセルページ・ICS は proxy.ts／Route Handler の 429） | 短時間に操作が集中しました。しばらくしてからお試しください | Too many attempts. Please try again later. | `retryAfterSec` 表示 |
| `bot_check_failed` | Turnstile | 確認に失敗しました。もう一度お試しください | Verification failed. Please try again. | Turnstile reset |
| `restricted` | customers（`dm_only` / `blocked`） | お手数ですが、ご予約は Instagram の DM で承ります | Please book via Instagram DM. | `InstagramLink` |
| `past_deadline` | 締切 | キャンセル締切を過ぎています。Instagram の DM でご連絡ください | The cancellation deadline has passed. Please contact us via Instagram DM. | `InstagramLink` |
| `not_found` | トークン・ID | この予約は見つかりません | We couldn't find this booking. | 予約 CTA |
| `unauthorized` | requireAdmin | ログインしてください | — | `/admin/login` |
| `error` | 例外 | 処理できませんでした。時間をおいてお試しいただくか、Instagram の DM でご連絡ください | Something went wrong. Please try again or message us on Instagram. | `digest` をサーバーログ（Sentry 導入後は Sentry）と突合 |
