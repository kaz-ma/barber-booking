# コードレビュー v1 — 正しさ（correctness）レビュー

## 文書情報

| 項目 | 内容 |
|---|---|
| 文書 ID | REV-CODE-001 |
| 版 | v1.0 |
| 日付 | 2026-10-12 |
| 対象 | ブランチ `claude/affectionate-mayer-kiw0pl`、コミット `57587bd`（作業ツリーの `src/`・`drizzle/`・`scripts/`・`test/`・`public/sw.js`・`vercel.json`・`next.config.ts`・`.github/workflows/ci.yml`） |
| 方法 | 読み取り専用レビュー。入力をコード上で追跡（trace）し、疑わしい箇所はローカルのテスト DB（`TEST_DATABASE_URL`、Postgres 16）に対する再現テストで確認。再現テストはリポジトリ外（スクラッチパッド）で実行し、ソースは一切変更していない |
| 実行した検証 | `npm test`（17 ファイル・118 テスト全件成功）、`npm run typecheck`（成功）、`npm run build`（成功）、再現テスト 13 件（後述「再現・根拠」列の R1〜R11・PII-1/2） |
| 判定基準 | `AGENTS.md`（非交渉ルール 1〜10）、DES-04 データモデル、DES-05 状態遷移・処理フロー、DES-06 API、要件定義書 FR-C / FR-A / FR-S・15 章 AT-01〜31 |
| 重大度 | **高**: 個人情報の漏えい・二重予約・予約不可・通知不達など検収保留相当（要件定義書 15.1「重大」）／ **中**: 仕様と異なる動作、データ欠損、CI を壊す欠陥など公開前に直すもの／ **低**: 境界条件・堅牢性・表示の不整合など公開後でもよいもの |
| 備考 | レビュー中に `docs/03_design/00_overview.md`・`04_data_model.md`・`06_api.md` が別作業で v0.4（実装との同期）に更新されている。「設計書との差分」は更新後の記述も確認した上で記載した |

---

## サマリー

| 重大度 | 件数 |
|---|---|
| 高 | 1 |
| 中 | 6 |
| 低 | 17 |
| 合計 | 24 |

総評:

- **二重予約の防止は堅牢**。`bookings_no_overlap`（`EXCLUDE USING gist`、`[)`、有効 3 状態のみ）、READ COMMITTED＋`pg_advisory_xact_lock(hashtext('calendar'), 1)`、ロック下での同一 SQL による再検証、冪等性キー（有効予約のみの部分 UNIQUE）＋ `submission_nonce` の判定は設計どおりで、同時送信・同一ペイロード再送・キャンセル後の再予約・Undo 時の 23P01 をテストと再現で確認した。空き計算 SQL も JST 暦日の帰属、リードタイム境界（`now = 19:00:00` で 20:00 枠は ◎、19:01 で ×）、60/61 日目、オーバーライド（休業・時間変更・定休日の臨時営業）、ブロック（削除済みは無視）、`buffer_after_min`、24:00 閉店（翌日 00:00）で正しい。
- **唯一の「高」はログへの個人情報混入**（CR-01）。Drizzle 0.45 の `DrizzleQueryError` はメッセージに SQL のパラメータ全体を含むため、予期しない DB 例外を `err.message` のまま記録すると、備考・生 IP・UA（失敗した文によっては氏名・ふりがな・電話）がログに出る。再現済み。
- 「中」は、管理画面の設定が効かない（当日予約の可否、CR-02）、営業時間の変更がトップ・JSON-LD に反映されない（キャッシュタグ不一致、CR-03）、保存期間ジョブが来店記録のない顧客を永久に匿名化しない（CR-04）、`/en` からの予約で既存顧客のふりがなが消える（CR-05）、完了画面（唯一の証憑）に学生価格が適用されていないのに「学生料金」と出る（CR-06）、2026-12-01 以降に CI が必ず落ちるテスト（CR-07）。

### 上位 10 件

| 順 | ID | 重大度 | 要旨 |
|---|---|---|---|
| 1 | CR-01 | 高 | 予期しない DB 例外のログに SQL パラメータ（備考・生 IP・UA・氏名・電話）がそのまま出る |
| 2 | CR-02 | 中 | 設定「当日の web 予約を受け付ける」（`allow_same_day`）を OFF にしても当日枠が ◎ のまま予約できる |
| 3 | CR-04 | 中 | 保存期間ジョブは `last_visit_at` が NULL の顧客（キャンセルのみ・無断・「完了」未操作）を永久に対象外にする |
| 4 | CR-03 | 中 | 営業時間の保存は `updateTag('hours')`、トップの営業時間は `cacheTag('settings','business-hours')` でタグが一致せず、定休日・受付時間の変更がトップ／JSON-LD／キャンセル画面に最大 1 日〜1 週間反映されない |
| 5 | CR-05 | 中 | 既存の電話番号で `/en` から予約すると `customers.name_kana` が NULL で上書きされる |
| 6 | CR-07 | 中 | `digest.db.test.ts` の保存期間テストが DB の実時刻 `now()` に依存し、2026-12-01 19:00 JST 以降は必ず失敗する |
| 7 | CR-06 | 中 | 学生価格未設定のメニューを学生が予約すると、完了・キャンセル画面と管理詳細に「学生料金」と表示される（金額は一般価格） |
| 8 | CR-08 | 低 | 電話番号の 1 日 3 件制限はトランザクション外で判定するため、同時送信で 4 件以上作れる |
| 9 | CR-09 | 低 | キャンセル確定ボタンの連打で 2 回目が `not_found` になり、成功画面が「この予約は見つかりません」に置き換わる |
| 10 | CR-10 | 低 | `isDateString` が `2026-11-31` を通し、`/book/time?date=` などで Postgres の日付エラー（500 / エラー画面）になる |

---

## 所見一覧

| ID | 重大度 | 箇所 file:line | 内容 | 再現・根拠 | 修正案 | 関連 FR・AT |
|---|---|---|---|---|---|---|
| CR-01 | 高 | `src/features/booking/service.ts:56-63`、`src/features/admin/service.ts:56-60`（同様に `src/lib/notify.ts:85`、`src/features/admin/service.ts:1127`）。加えて未捕捉例外を Next.js が記録する経路 | 予期しない例外を `err.message` のまま `logger.error` に渡している。`DrizzleQueryError` のメッセージは `Failed query: … params: …` でパラメータ全体を含み、ロガーのキー単位の伏せ字では防げない | 再現 PII-1/PII-2: `consents` の挿入失敗で生 IP と UA、`bookings` の挿入失敗で備考・トークンハッシュがログ行に出力された（下記詳細） | `pgErrorOf()` で SQLSTATE・制約名だけを記録する `errorFields(err)` を lib に置き、全 `logger.error` で使う。Server Action をラップして未捕捉例外もメッセージを捨てる | AGENTS 6、NFR-SC-07、FR-S-11 |
| CR-02 | 中 | `src/lib/db/availability-sql.ts:104-157`、`src/features/admin/components/hours-settings.tsx:452-467` | `settings.allow_same_day` を空き計算 SQL も予約時の再検証も参照しない。管理画面のスイッチは保存されるだけで効果がない | 再現 R4: `allow_same_day = false` で当日（11/3）の ◎ が 11 枠、`submitBooking` も `ok` | CTE `p` に `allow_same_day` を取り、`cand` で `allow_same_day OR hr.d > today` を条件に加える（再検証も同じ SQL なので自動で効く）。または UI から外す | FR-A-07、FR-C-08、AT-22 |
| CR-03 | 中 | `src/features/admin/actions.ts:178,189,198` ↔ `src/features/booking/catalog.ts:46` | 営業時間系アクションは `updateTag('hours')`、`getWeeklyHours()` は `cacheTag('settings','business-hours')`。`'hours'` を持つキャッシュが存在しない。設定保存（`'settings'`）を伴わない営業時間だけの変更では、トップのアクセス欄・JSON-LD・キャンセル締切後画面の受付時間が古いまま（ビルド表で revalidate 1d / expire 1w） | トレース: `hours-settings.tsx:67-90` は曜日だけ変えたとき `updateBusinessHoursAction` のみ呼ぶ。`next build` のルート表で `/ja` が 1d/1w の静的ページ | `getWeeklyHours` を `cacheTag('hours')` に統一（または actions 側を `updateTag('business-hours')`）。タグ名を `lib` の定数に集約 | FR-A-07、FR-S-12、AT-22 |
| CR-04 | 中 | `src/features/notifications/retention.ts:119-125`、`src/features/admin/service.ts:277-284` | 対象条件が `last_visit_at < now() - 3 years` のみで、`last_visit_at` は `completed` 遷移でしか入らない。キャンセル・無断キャンセルだけの顧客、店主が「完了」を押さない運用の顧客は永久に匿名化されない | 再現 R2: 2022 年のキャンセル済み予約のみの顧客、2022 年の `confirmed`（完了未操作）予約の顧客とも `runRetention` で `anonymized: 0` | 起点を `GREATEST(last_visit_at, max(upper(during)) of bookings, created_at)` 等の「最終接点」にする（DB 統合テストを追加）。プライバシーポリシーの記載と一致させる | FR-S-09、10.3、AT-30 |
| CR-05 | 中 | `src/features/booking/service.ts:149-158` | 顧客 upsert の `DO UPDATE` が `name_kana = excluded.name_kana`。`/en` はふりがなを送らないため、同じ電話の既存顧客（`/ja` で登録）のふりがなが NULL になる。管理画面のかな検索・サジェストで見つからなくなる | 再現 R3: `/ja` で予約 → 同じ電話で `/en` 予約 → `name_kana = null`（顧客は 1 行） | `name_kana` を `COALESCE(excluded.name_kana, customers.name_kana)` で更新。氏名の上書き方針（ADR-0008）も合わせて明文化 | FR-A-13、ADR-0008 |
| CR-06 | 中 | `src/features/booking/service.ts:180`、`src/features/booking/components/booking-card.tsx:43`、`src/app/(admin)/admin/(app)/bookings/[id]/page.tsx`（`S.detail.studentPrice`） | `is_student` を「職業が学生」で保存し、表示側は「学生料金が適用された」と解釈している。学生価格が未設定のメニューでは、完了画面（唯一の証憑）に一般価格＋「学生料金」タグ、管理詳細に「（学生価格）」と出る。確認画面は `isStudentRate` で正しく出し分けており不一致 | トレース: `isStudent: input.occupation === 'student'`、`BookingPrice` は `booking.isStudent` だけでタグを出す | `isStudent: input.occupation === 'student' && menu.priceStudentJpy !== null`（＝学生価格を適用したか）に統一 | FR-C-04、FR-C-11、AT-05 |
| CR-07 | 中 | `src/features/notifications/digest.db.test.ts:94-96` | `UPDATE bookings SET customer_id = … WHERE lower(during) > now()` が DB の実時刻に依存。固定日 2026-12-01 19:00 JST を過ぎると 0 行更新になり、`kept` 顧客に未来予約がなくなって `anonymized: 2` で失敗する（時限爆弾） | トレース: `runRetention(jst('2026-11-03 03:00'))` は注入時刻だが、フィクスチャの付け替えは `now()`。AGENTS 10「DB テストは now を注入」違反 | `WHERE lower(during) > ${jst('2026-11-03 03:00').toISOString()}::timestamptz` か、`insertNamedBooking` の customer を直接指定 | AGENTS 10、FR-S-09 |
| CR-08 | 低 | `src/features/booking/service.ts:245-246,205`、`src/lib/rate-limit.ts:46-64` | 電話番号の日次上限は「ロック外で判定・トランザクション内で加算」。同時送信は全件が判定を通る | 再現 R7: 同じ電話で 4 枠を同時送信 → 4 件とも `ok`、予約 4 件 | 判定をロック取得後（`insertBooking` 内、`incrementPhoneDaily` の前）に移す。advisory lock で直列化されるので追加コストはない | FR-S-04、AT-08 |
| CR-09 | 低 | `src/features/booking/components/cancel-flow.tsx:130-138` | 確定ボタンは `aria-disabled` のみで送信を止めない。`useActionState` は連打をキューに積むため、2 回目が `not_found` を返し、成功表示が「この予約は見つかりません」に置き換わる（キャンセル自体は成立） | トレース: `Button` は `aria-disabled` を素通し（`button.tsx:31-47`）。確認画面（`confirm-form.tsx:102-106`）は `pending` で `preventDefault` しているがキャンセル側にはない | `onSubmit` で `pending` 中は `preventDefault`、または一度 `ok` になったら後続結果を無視 | FR-C-12、AT-07 |
| CR-10 | 低 | `src/domain/time.ts:140-142` → `src/app/(public)/[locale]/book/time/page.tsx:71`、`src/app/(admin)/admin/(app)/page.tsx:39`、`week/page.tsx:152` | `Date.parse` は `2026-11-31` を 12/1 に繰り上げて受理するため、存在しない日付が SQL `::date` に渡り例外（エラー画面） | 再現 R1: `isDateString('2026-11-31') === true`、`getDayAvailability` が `date/time field value out of range` を投げる | `toUtcDate(s).toISOString().slice(0,10) === s` で往復一致を確認 | FR-C-07、NFR（堅牢性） |
| CR-11 | 低 | `src/features/admin/queries.ts:368,569` | ID 検査が `/^[0-9a-f-]{36}$/i` で、ハイフンの位置を見ない（例 36 個のハイフン）。`uuid` キャストで例外 → 500 | トレース | `z.uuid().safeParse(id)` で判定 | FR-A-04 |
| CR-12 | 低 | `src/features/booking/ics.ts:71` | `.replace(/;/g, ';')` が無変換で、`;` がエスケープされない（RFC 5545 は `\;`） | 再現 R5: `SUMMARY:a;b` | `.replace(/;/g, '\;')`。テストに `;` を追加 | FR-C-11、AT-01 |
| CR-13 | 低 | `src/features/booking/components/booking-info-form.tsx:154-160` | `writeStep` が `url.search = '?step=…'` で `menu`・`startsAt` を消す。sessionStorage が使えない環境では下書きが保存されず、初回描画直後に `/book` へ戻される | トレース: 子の `useEffect`（`writeStep` replace）→ 親の `updateDraft`（保存失敗）→ `useSearchParams` 更新で `menuSlug = ''` → `router.replace('/book')` | `url.searchParams.set('step', stage)` で既存クエリを保持 | FR-C-01、AT-09 |
| CR-14 | 低 | `src/features/booking/components/confirm-form.tsx:73-91`、`src/features/booking/messages.ts:39-40` | `invalid / not_bookable`（確認中にリードタイムを過ぎた等）は確認画面にメッセージを出すだけで S-C-03 へ戻さない（DES-06 5 章は「S-C-03 へ」） | トレース | `conflict` と同様に `/book/time?…&taken=1` へ遷移、または「日時を選び直す」リンクを出す | FR-C-10、DES-06 5 章 |
| CR-15 | 低 | `src/features/admin/components/menus-settings.tsx:140` | 「最終開始」のプレビューが `close − duration − buffer` で、枠刻み・開店時刻に揃えていない。75 分メニューで 22:45 と表示されるが実際の最終開始は 22:30 | トレース（SQL は `generate_series(open, close−dur−buf, step)`。再現 R6 で 60+15 分の最終開始 22:30 を確認） | `open + floor((close−dur−buf−open)/step)*step` で計算 | FR-A-08 |
| CR-16 | 低 | `src/features/notifications/digest.ts:55-69` | 臨時休業（オーバーライド）の前日も「明日は定休日です」と送る | トレース | `o.date IS NOT NULL` を取り「明日は休業日です」と出し分け | FR-A-12 |
| CR-17 | 低 | `src/app/(public)/[locale]/book/done/[token]/page.tsx:148`、`cancel/[token]/page.tsx:227` | 「ご来店の {hours} 時間前まで」を現在の `settings.cancel_deadline_min` で表示。予約ごとの締切（`cancel_token_expires_at`）と、設定変更後にずれる | トレース | `booking.start − booking.deadline` から時間を算出 | FR-C-11、FR-C-12 |
| CR-18 | 低 | `src/features/booking/booking.db.test.ts:164-186`、`src/features/admin/otp.db.test.ts:65` | レート制限は DB の `now()` で固定窓を切るため、テストが 10 分窓・JST 日付の境界をまたぐと失敗する（確率は低いがフレーク） | トレース（`rate-limit.ts:31-37,43`） | `hitWindow`・`checkPhoneDaily` に `now` を注入可能にする | AGENTS 10 |
| CR-19 | 低 | `src/lib/turnstile.ts:45-46` | `hostname === new URL(SITE_URL).hostname` を必須にしている。PR プレビュー（`*.vercel.app` の都度 URL）で `SITE_URL` が固定値だと全予約が `bot_check_failed` | トレース | プレビューは `VERCEL_URL` を許可リストに加える、または `VERCEL_ENV==='preview'` で hostname 照合を緩める | FR-S-05、FR-S-13 |
| CR-20 | 低 | `src/features/admin/service.ts:1061-1069`、`retention.ts:127-134` | 匿名化で `bookings.note`・`owner_note` は消すが、`cancel_reason`（管理者の自由記述、最大 200 字）は残る | トレース（`updateBookingStatus` の `reason`） | 匿名化時に `cancel_reason` を NULL（`deleted`・`anonymized` の定型値は残してよい） | FR-A-14、10.3 |
| CR-21 | 低 | `src/proxy.ts:29-46` | キャンセル用 IP 制限は `/{locale}/cancel/*` の POST（Server Action）にも HTML の 429 を返す。クライアントのアクション呼び出しが例外になりエラー画面へ。設計の `cancelBooking → rate_limited` は返らない | トレース | `next-action` ヘッダー付き POST は proxy で数えず、`cancelByToken` 内で同じキーを判定して `rate_limited` を返す | FR-S-04、DES-06 2.1 |
| CR-22 | 低 | `.github/workflows/ci.yml:22-23` | サービスの `postgres:16` イメージがダイジェスト固定でない（TODO のまま）。E2E（`test/e2e/run.mjs`）は CI で実行されず、Playwright の場所も `/opt/node-tools` 固定 | トレース | イメージを `@sha256:` で固定。E2E は `PLAYWRIGHT_MODULE` を必須にし、staging 向けジョブを追加（FR-S-13） | AGENTS 8、FR-S-13 |
| CR-23 | 低 | `scripts/seed.ts:183`、`scripts/seed-admin.ts:16`、`src/features/admin/service.ts:1118` | `seed-admin` はメールを小文字化、`seed` はそのまま。`requestAdminOtp` は `ADMIN_EMAIL` と完全一致で検索するため、`ADMIN_EMAIL` に大文字を含むと「未登録」扱いでコードが送られない（`requireAdmin` は小文字比較） | トレース | 検索・保存とも `lower()` に統一 | FR-A-01、AT-13 |
| CR-24 | 低 | `src/domain/booking-status.ts:76-77` | `arrived`・`in_progress` から直前状態へ戻す遷移がない。「完了」の押し間違いは戻せず `last_visit_at` も確定する（DES-05 1.1 は「直前状態へ戻すボタン」） | トレース | Undo トークン方式を進行系にも適用（`completed` の Undo は `last_visit_at` を元の値に戻す） | FR-A-04 |

---

## 詳細（高・中）

### CR-01（高）予期しない DB 例外のログに SQL パラメータが出る

該当コード（`src/features/booking/service.ts:56-63`。`src/features/admin/service.ts:56-60` も同形）:

```ts
function errorResult(err: unknown, event: string): ActionResult<never> {
  const digest = randomUUID().slice(0, 8)
  logger.error(event, {
    digest,
    error: err instanceof Error ? err.message : String(err),
  })
  return { status: 'error', digest }
}
```

`node_modules/drizzle-orm/errors.js`（0.45.4）:

```js
class DrizzleQueryError extends Error {
  constructor(query, params, cause) {
    super(`Failed query: ${query}\nparams: ${params}`);
```

確認方法（再現テスト、テスト DB）:

- PII-1: `submitBooking(…, { ip: 'unknown', userAgent: 'Mozilla/5.0 (iPhone)' })` で `consents.ip`（`inet`）への挿入が失敗 → 出力されたログ行:
  `{"level":"error","event":"booking.create_failed",…,"error":"Failed query: insert into \"consents\" … params: …,booking_policy,2026-10-12,unknown,Mozilla/5.0 (iPhone),…"}`
- PII-2: テスト DB に一時トリガー（`BEFORE INSERT ON bookings` で例外）を置いて `submitBooking` → ログ行に `…,5000,false,0,頭皮が弱いです,<idempotency_key>,<submission_nonce_hash のバイト列>,…` が出力された（テスト後にトリガーは削除）。
- 同じ仕組みで、`customers` の upsert が失敗すれば氏名・ふりがな・電話（E.164）が、手動予約（`createManualBooking`）の失敗では氏名・電話・店主メモが出る。Server Action や RSC で捕捉されない DB 例外は Next.js が `console.error` するため、ロガーを通らない経路でも同じ文字列がログに残る。

影響: AGENTS 非交渉ルール 6（氏名・電話・備考・トークン・生 IP をログに出さない）と NFR-SC-07 に違反。Vercel のログと Sentry（FR-S-11 で送る予定）に個人情報が転送される。要件定義書 15.1 の「個人情報漏えい」に該当するため高とした。

修正案（概略）:

```ts
// src/lib/pg-errors.ts に追加
export function errorFields(err: unknown): Record<string, string | null> {
  const pg = pgErrorOf(err)
  return {
    errorName: err instanceof Error ? err.name : 'unknown',
    sqlstate: pg?.code ?? null,
    constraint: pg?.constraint ?? null,
  }
}

// service.ts
logger.error(event, { digest, ...errorFields(err) })
```

あわせて、`actions.ts` の各 Server Action を `try { … } catch (e) { logger.error(…errorFields(e)); return { status: 'error', digest } }` でラップする小さな高階関数を用意し、未捕捉の DB 例外がメッセージごと Next.js のログに出ないようにする。ロガーの伏せ字に `params`・`query` キーを追加しても、文字列に埋め込まれた値は守れない点に注意。回帰テストとして「失敗時のログ行に電話・備考を含まない」DB テストを追加する（PII-2 の手順が流用できる）。

### CR-02（中）「当日の web 予約を受け付ける」が効かない

該当コード（`src/lib/db/availability-sql.ts:104-113, 136`）:

```sql
WITH s AS (
  SELECT slot_step_min, lead_time_min, max_advance_days FROM settings WHERE id = 1
), …
  WHERE NOT hr.is_closed AND hr.d <= p.last_date
```

`allow_same_day` は `features/admin`（保存・表示）以外から参照されていない（`grep allowSameDay|allow_same_day` で確認）。管理画面 S-A-08 には「当日の web 予約を受け付ける」スイッチがあり（`strings.ts:404`）、店主は OFF にすれば当日予約が止まると期待する。

確認方法: 再現 R4。`UPDATE settings SET allow_same_day = false` の後、`getDayAvailability('2026-11-03', now=11/3 12:00)` の ◎ が 11 枠、`submitBooking(startsAt=2026-11-03T19:00+09:00)` が `ok`。

修正案:

```sql
WITH s AS (
  SELECT slot_step_min, lead_time_min, max_advance_days, allow_same_day FROM settings WHERE id = 1
), p AS (
  SELECT …, s.allow_same_day, (…)::date AS today FROM m CROSS JOIN s
), …
cand AS ( …
  WHERE NOT hr.is_closed AND hr.d <= p.last_date
    AND (p.allow_same_day OR hr.d > p.today)
```

当日の候補が消えると日の状態は `full` になるため、理由ラベルを「締切」にしたい場合は `slots` で `in_lead_time OR (NOT allow_same_day AND d = today)` を `deadline` に分類する方が UI の一貫性がよい。予約確定時の再検証は同じ CTE を使うため追加修正は不要。契約テストに「`allow_same_day=false` で当日が × 締切」を追加する。

### CR-03（中）営業時間変更のキャッシュ無効化タグが一致しない

該当コード:

```ts
// src/features/admin/actions.ts:177-178
const result = await service.updateBusinessHours(parsed.data.days)
updateTag('hours')

// src/features/booking/catalog.ts:44-47
export async function getWeeklyHours(): Promise<WeeklyHoursRow[]> {
  'use cache'
  cacheTag('settings', 'business-hours')
  cacheLife('days')
```

確認方法（トレース）: `'hours'` を `cacheTag` に持つ関数は存在しない。`hours-settings.tsx:67-90` は曜日だけを変えた保存では `updateBusinessHoursAction` だけを呼ぶ（`updateSettingsAction` は `changedRules > 0` のときのみ）。`getWeeklyHours` はトップ（アクセス欄の受付時間・定休、JSON-LD の `openingHoursSpecification`）とキャンセル締切後画面の受付時間で使われ、`next build` の結果で `/ja`・`/en` は revalidate 1d / expire 1w の静的ページ。空き状況（カレンダー）はキャッシュしないため予約そのものは正しいが、トップの「定休 月曜」等が古いまま残り、AT-22（設定変更の即時反映）と FR-S-12（「メニュー更新が即時反映される」と同等の期待）を満たさない。設計書 00_overview.md v0.4 の表 3.2 にも同じ不一致が記録されている。

修正案: タグ名を `src/lib/cache-tags.ts` に `export const TAGS = { menus: 'menus', settings: 'settings', hours: 'hours' } as const` として集約し、`getWeeklyHours` を `cacheTag(TAGS.hours)`、営業時間系 3 アクションを `updateTag(TAGS.hours)` に揃える。将来オーバーライド（臨時休業）をトップに出す場合も同じタグを使う。

### CR-04（中）保存期間ジョブが来店記録のない顧客を永久に匿名化しない

該当コード（`src/features/notifications/retention.ts:119-125`）:

```sql
SELECT c.id, c.phone_e164 FROM customers c
WHERE c.anonymized_at IS NULL AND c.last_visit_at < ${t}::timestamptz - interval '3 years'
  AND NOT EXISTS (… future active booking …)
FOR UPDATE
```

`last_visit_at` を設定するのは `updateBookingStatus` の `completed` 遷移だけ（`src/features/admin/service.ts:277-284`）。`NULL < x` は偽のため、(a) キャンセル・無断キャンセルだけの顧客、(b) 店主が状態を「完了」まで進めない運用（来店・施術開始・完了は任意操作）の顧客は対象外のまま。(b) は日常運用で起こりやすく、その場合ジョブは実質的に誰も匿名化しない。

確認方法: 再現 R2。2022-06 のキャンセル済み予約のみの顧客と、2022-07 の `confirmed`（完了未操作）予約の顧客を作成し `runRetention(2026-11-03)` → `{ anonymized: 0 }`、両顧客の氏名が残る。設計書 04_data_model.md v0.4 の 8 章はこの挙動を「対象にならない」と追記しているが、要件 10.3（最終来店から 3 年で匿名化）とプライバシーポリシーの公表内容に対しては不足である。

修正案:

```sql
WITH last_touch AS (
  SELECT c.id, GREATEST(c.last_visit_at, max(upper(b.during)), c.created_at) AS t
  FROM customers c LEFT JOIN bookings b ON b.customer_id = c.id
  WHERE c.anonymized_at IS NULL
  GROUP BY c.id
)
SELECT c.id, c.phone_e164 FROM customers c JOIN last_touch l ON l.id = c.id
WHERE l.t < ${t}::timestamptz - interval '3 years'
  AND NOT EXISTS (…) FOR UPDATE OF c
```

「最終来店」の定義（予約日時の最終・完了のみ等）は要件側で確定し、ポリシーの文言と合わせる。DB テストに (a)(b) のケースを追加する。

### CR-05（中）`/en` からの予約で既存顧客のふりがなが消える

該当コード（`src/features/booking/service.ts:149-158`）:

```ts
.onConflictDoUpdate({
  target: customers.phoneE164,
  targetWhere: sql`phone_e164 IS NOT NULL AND deleted_at IS NULL AND merged_into_customer_id IS NULL`,
  set: {
    name: sql`excluded.name`,
    nameKana: sql`excluded.name_kana`,
    occupation: sql`excluded.occupation`,
    locale: sql`excluded.locale`,
  },
})
```

確認方法: 再現 R3。`/ja` で「山田 太郎／やまだ たろう」を予約 → 同じ電話で `/en`（ふりがな欄なし）から「Taro Yamada」で予約 → 顧客は 1 行のまま `name = 'Taro Yamada'`、`name_kana = null`。管理画面のかな部分一致検索（FR-A-13）と手動予約のサジェスト（FR-A-05）で以後ヒットしなくなる。

修正案:

```ts
nameKana: sql`COALESCE(excluded.name_kana, ${customers.nameKana})`,
```

氏名の上書き（家族が同じ電話で予約すると顧客名が変わる）は ADR-0008 の前提どおりだが、上書きした事実を `audit_log`（値は記録しない）に残すか、管理画面で「前回の氏名」を見せるかを検討事項として設計書に追記する。

### CR-06（中）学生価格を適用していない予約に「学生料金」と表示される

該当コード:

```ts
// src/features/booking/service.ts:179-180
priceJpy: applicablePrice(menu, input.occupation),
isStudent: input.occupation === 'student',

// src/features/booking/components/booking-card.tsx:41-43
<span className={className}>{yenText(booking.priceJpy)}</span>
…
{booking.isStudent ? <span className="tag">{t('student')}</span> : null}   // 「学生料金」
```

確認方法（トレース）: `applicablePrice` は学生価格が NULL なら一般価格を返すが、`is_student` は職業のみで真になる。完了画面（S-C-05、FR-C-11「唯一の証憑」）とキャンセル画面は `BookingPrice` で「¥5,000 学生料金」と表示し、管理の予約詳細も「（学生価格）」を付ける。一方、確認画面（`confirm-form.tsx:249-250`）は `occupation === 'student' && menu.priceStudentJpy !== null` で出し分けており、同じ予約で確認画面と完了画面の表示が食い違う。来店時の料金トラブルにつながるため中とした。

修正案: 保存時に「学生価格を適用したか」を記録する。

```ts
isStudent: input.occupation === 'student' && menu.priceStudentJpy !== null,
```

職業そのものは `customers.occupation` に既にあるので情報は失われない。DB テストに「学生価格未設定のメニューを学生が予約 → `is_student=false`、`price_jpy` は一般価格」を追加する（AT-05 の後半）。

### CR-07（中）2026-12-01 以降に必ず失敗するテスト

該当コード（`src/features/notifications/digest.db.test.ts:94-98`）:

```ts
await insertNamedBooking(jst('2026-12-01 19:00'), jst('2026-12-01 20:00'))
await db.execute(sql`UPDATE bookings SET customer_id = ${kept.customerId} WHERE lower(during) > now()`)

expect(await runRetention(jst('2026-11-03 03:00'))).toEqual({ anonymized: 1 })
```

確認方法（トレース）: `now()` は DB の実時刻。実時刻が 2026-12-01 19:00 JST を過ぎると `UPDATE` が 0 行になり、`kept` 顧客には（注入時刻 2026-11-03 から見た）未来予約がなくなるため `runRetention` は 2 名を匿名化し、アサーションが失敗する。`npm test` は CI の必須ステップなので、その日以降すべての PR が赤になる。AGENTS 10（DB テストは `now` を注入する）にも反する。

修正案:

```ts
const NOW = jst('2026-11-03 03:00')
await db.execute(sql`UPDATE bookings SET customer_id = ${kept.customerId}
  WHERE lower(during) > ${NOW.toISOString()}::timestamptz`)
expect(await runRetention(NOW)).toEqual({ anonymized: 1 })
```

（またはヘルパーに `customerId` 指定の引数を足して付け替え自体をなくす。）

---

## テストカバレッジの不足

自動テストがない、または不十分な受入基準・要件（★ は今回の所見に直結）:

| 対象 | 現状 | 追加すべきテスト |
|---|---|---|
| ★ CR-01 ログの PII | なし | DB 失敗時のログ行に電話・氏名・備考・IP を含まない（PII-2 の手順） |
| ★ AT-22 / CR-02 `allow_same_day` | なし | `allow_same_day=false` で当日が ×、`submitBooking` が `not_bookable` |
| ★ AT-22 / CR-03 キャッシュタグ | なし | タグ定数の一致を静的に確認する単体テスト（`updateTag` と `cacheTag` の引数を同じ定数から取る） |
| ★ FR-S-09 / CR-04 保存期間 | 「完了」顧客 1 ケースのみ | `last_visit_at IS NULL` の古い顧客、未来予約がある顧客、境界（ちょうど 3 年） |
| ★ AT-05 / CR-06 学割 | 学生価格ありのメニューのみ | 学生価格未設定メニューを学生が予約 → 一般価格・タグなし |
| AT-04 / FR-C-08 空き計算 | 主要ケースはあり | `buffer_after_min` ありメニュー（再現 R6 で正しさは確認済み）、営業時間を変えるオーバーライド・定休日の臨時営業（R9）、リードタイムのちょうど境界 `now=19:00:00`（R8）、JST 0:00 前後の月表示（R8）、`slot_step_min` 15/60 |
| AT-07 / FR-C-12 キャンセル | サービス層はあり | 顧客キャンセルで `notifyOwner('booking_cancelled')` が呼ばれる、キャンセル画面に `tel:` がない（E2E）、連打（CR-09） |
| AT-08 / FR-S-05 Turnstile | なし（シークレット未設定でスキップ） | `fetch` をモックして `success=false`・`hostname` 不一致・`action` 不一致・タイムアウト → `bot_check_failed` |
| FR-S-04 キャンセル・ICS の IP 制限（11 回目で 429） | なし | `proxy` の 429、`/api/ics` と共通キー |
| AT-27 直接 POST（Cookie なしで管理アクション拒否） | なし | `requireAdmin` をスタブして各 `…Action` が `unauthorized` を返す |
| AT-26 セキュリティヘッダー | なし | `next.config.ts` の `headers()` を呼んで各パスのヘッダーを検査、`adminCsp` の単体テスト |
| AT-29 / FR-S-10 ドメイン非依存 | なし | `SITE_URL` を変えて `absoluteUrl`・完了画面のキャンセル URL・ICS が追従 |
| AT-03 同時送信の UI（「たった今埋まりました」＋枠再表示） | サービス層の競合テストのみ | E2E で 2 コンテキストから同一枠を確定 |
| AT-09 戻る・段階開示 | E2E に `goBack` 1 か所 | `?step=` と `history.state` の往復、ストレージ不可時（CR-13） |
| FR-A-05 手動予約の重なり（ブロック警告・営業時間外警告） | あり | 顧客経路と同じ範囲（バッファ込み）で判定されることの明示テスト（R6 で確認済み） |
| FR-A-12 日次サマリー | 送信・重複防止・0 件・定休日前日はあり | 臨時休業前日の文言（CR-16） |
| FR-A-14 エクスポート | なし | IP・UA・トークンハッシュを含まないこと |
| 監査ログの allow-list | 個別に一部 | 全アクションの `diff` に氏名・電話・自由記述が入らないことを `audit_log` 全件で検査 |
| ICS（FR-C-11） | 改行・折り返し・`,` | `;`・`\`・改行のエスケープ（CR-12）、`LOCATION`・`DESCRIPTION` のキャンセル URL 全文 |
| 日付パラメータの検証 | なし | `isDateString('2026-11-31') === false`（CR-10） |

フレーク・誤ったアサーションの候補:

| テスト | 問題 |
|---|---|
| `digest.db.test.ts` 保存期間 | 実時刻依存の時限爆弾（CR-07） |
| `booking.db.test.ts` レート制限 2 件、`otp.db.test.ts` 要求回数制限 | DB `now()` の固定窓境界をまたぐと失敗（CR-18） |
| `admin.db.test.ts`「deletes and restores a block」 | 実時刻 `new Date()` を使うが差分のみで判定しており問題はない（参考） |

---

## 設計書との差分

### A. 実装の方が妥当で、設計書に取り込むべきもの

| # | 項目 | 実装 | 設計書の現状 |
|---|---|---|---|
| A-1 | 冪等性の判定順序 | ロック取得後、空き再検証より**前**に同じ冪等性キーの有効予約を `FOR UPDATE` で探し、nonce 一致なら再発行して `ok`（同じブラウザの再送が「満席」にならない） | DES-05 2 章のシーケンスは INSERT の 23505 を契機に判定する順序（04 v0.4 の 3.1 表は更新済み、05 は未更新） |
| A-2 | Undo の有効期限 | トースト 5 秒・サーバー検証 10 秒（`UNDO_WINDOW_MS`）、ブロックの復元も 10 秒 | 05 1.1 は「5 秒」表記（04 v0.4 M-07 は更新済み） |
| A-3 | 「すべて確認済み」の取り消し | `unacknowledgeAction(ids)` | 06 3.1 にない（v0.4 で追加中） |
| A-4 | メニュー並べ替え | `moveMenuAction(menuId, up/down)` | 06 3.1 は `reorderMenus(ids[])` |
| A-5 | ブロックのプリセット「今日はここまで」が閉店後 | `invalid`（`preset: afterClose`） | 06 3.1 に記載なし |
| A-6 | ICS の `DTEND` | 表示上の終了（バッファを除く） | 06 4 章は DTSTART/DTEND を UTC とだけ記載。バッファの扱いを明記するとよい |
| A-7 | manifest の配信 | `app/manifest.webmanifest/route.ts`（顧客ページに `<link rel="manifest">` を出さないため） | 06 4 章・FR-A-15 は `app/manifest.ts` |
| A-8 | Turnstile 未設定時 | シークレット未設定（ローカル・テスト）なら検証をスキップしてログ | 08_security は本番前提のみ |
| A-9 | 空き計算の型 | `generate_series` の引数を `::int` に明示（PG16 の関数解決） | 04 v0.4 で更新済み |
| A-10 | 管理の重なり判定 | 手動予約は INSERT 前に `findOverlaps` で検出し 23P01 は最後の防衛線 | 05 4 章のフローは INSERT→23P01 を主経路として描画 |

### B. 設計書が正しく、コードを直すべきもの

| # | 項目 | 設計書・要件 | 実装 | 所見 |
|---|---|---|---|---|
| B-1 | キャッシュタグ | 06 API-08「営業時間・休業日は `updateTag('hours')`」、02 FR-A-07「`updateTag` で営業時間キャッシュを即時失効」 | 読み側が `cacheTag('settings','business-hours')` | CR-03 |
| B-2 | 当日予約の可否 | 04 `settings.allow_same_day`、06 `updateSettings` | 空き計算・再検証で未使用 | CR-02 |
| B-3 | 保存期間 | 要件 10.3「最終来店から 3 年」・FR-S-09 | `completed` がない顧客は対象外 | CR-04 |
| B-4 | ログ・監査に PII を入れない | AGENTS 6、08_security 9 章、NFR-SC-07 | 例外メッセージ経由で漏れる | CR-01 |
| B-5 | ICS の TEXT エスケープ | RFC 5545（06 4 章で ICS を規定） | `;` 未エスケープ | CR-12 |
| B-6 | `not_bookable` の UI | 06 5 章「S-C-03 へ」 | 確認画面に留まる | CR-14 |
| B-7 | キャンセルのレート制限結果 | 06 2.1 `cancelBooking` のエラーに `rate_limited` | proxy が HTML 429 を返しアクションは例外 | CR-21 |
| B-8 | 進行系の取り消し | 05 1.1「直前状態へ戻すボタン」（arrived / in_progress / completed） | 遷移なし | CR-24 |
| B-9 | 匿名化の対象列 | 04 8 章「自由記述に個人情報が混入しうるため備考を消す」 | `cancel_reason` が残る | CR-20（設計書側にも `cancel_reason` を明記） |
| B-10 | `getMonthAvailability` の重複排除 | 04 6.1（v0.3）「React `cache()` で 1 リクエスト 1 回」 | 未実装（TODO）。v0.4 で「未実装」と記載変更中 | 性能上の実害は小さいが、残すなら TODO を課題票へ |
| B-11 | manifest の `screenshots` | FR-A-15・06 4 章（Android の richer install） | なし | 低。素材が揃った時点で追加 |
| B-12 | 日次サマリーの休業日文言 | FR-A-12「定休日前日は『明日は定休日です』」 | 臨時休業の前日も同文言 | CR-16（臨時休業の文言を要件に追加） |
| B-13 | 学生料金の表示 | FR-C-04「学生価格未設定のメニューは一般価格のまま」 | 一般価格に「学生料金」タグ | CR-06（04 の `is_student` の意味を「学生価格を適用したか」と明記） |

### 参考: 確認して問題がなかった主な点

- `bookings_no_overlap` の述語と `ACTIVE_STATUSES`、`bookings_deleted_inactive`・`bookings_cancel_consistency` と全状態遷移（顧客キャンセル・管理キャンセル・削除・匿名化・Undo）の整合。
- 半開区間（18:00–19:00 と 19:00–20:00 は衝突しない）、キャンセル済み・削除済みの行が枠を占有しないこと。
- 顧客経路と手動予約の重なり判定が同じ範囲（`duration + buffer`）で一致すること（R6: 60+15 分の予約に対し 20:00 開始の手動予約は `conflict`、顧客側も 20:00 は ×）。
- 再予約済みの枠に対する Undo が `undo_blocked` になり、カウンタは増えたまま（予約がキャンセルのまま）であること（R10）。
- キャンセルトークン（32 バイト base64url、SHA-256 のみ保存、形式チェック、`timingSafeEqual`、単回使用、閲覧は終了後 24 時間まで）、締切は `cancel_token_expires_at`（＝開始 − 締切分）で判定。
- Push: 宣言的ペイロード（`web_push: 8030`、`mutable: false`、`app_badge` 両位置、氏名・電話なし）、`topic` 23 文字、404/410 で購読削除・`fail_count`・`notification_log`。
- `CRON_SECRET` の定数時間比較、`vercel.json` の 2 本の日次 cron（Hobby の 1 日 1 回制約内）、JST の「明日」の算出、`daily_digests` による同日 2 回目の抑止。
- `proxy.ts` の matcher（`/admin` は next-intl を通さない、`/api`・静的ファイル除外）、管理 CSP の nonce、`after()` での Push（失敗が予約結果に影響しない）、`attachDatabasePool`、接続の `TimeZone=UTC`。
- ja / en のメッセージキー一致（テストあり）、`/en` の 12 時間表記＋JST、24:00 表記、カレンダーの初期選択が JST の今日、月移動の範囲。

---

## 対応状況（2026-10-12 修正パス）

検証: `npm run typecheck`・`npm run lint`・`npm test`（33 ファイル・206 件、修正前は 17 ファイル・118 件）・`npm run build`・`node test/e2e/run.mjs`（7/7 シナリオ）すべて成功。

| ID | 状況 | 対応内容 | 回帰テスト |
|---|---|---|---|
| CR-01 | 済 | `errorFields()`（エラー名・SQLSTATE・制約名・`errorCode` のみ）を `lib/pg-errors.ts` に追加し、サービス・notify・OTP・housekeeping の `err.message` 記録を全廃。`lib/unexpected-error.ts` の `guardAction`/`guardRoute` で全 Server Action・Route Handler をラップ（digest のみ返す、redirect 等は再送出）。加えて `lib/db/scrub-errors.ts` で drizzle の `DrizzleQueryError` をドライバ層でパラメータなしの `DbQueryError`（原因は SQLSTATE・制約・表・列だけの `PgError`）に置換し、Next.js 自身のエラーログにも PII が出ないようにした。ロガーは大文字小文字無視・再帰の伏せ字に強化 | `booking/error-logging.db.test.ts`（customers/bookings/consents 挿入失敗・キャンセル更新失敗・ドライバ例外の inspect 出力）、`admin.db.test.ts`「CR-01: admin errors…」、`lib/unexpected-error.test.ts`、`lib/logger.test.ts` |
| CR-02 | 済 | 空き計算 SQL の `s`/`p` に `allow_same_day` を取り、OFF のとき当日枠を `deadline`（締切）に分類。予約時の再検証も同じ SQL のため自動で `not_bookable` | `availability.db.test.ts`「allow_same_day (CR-02)」、`booking.db.test.ts`「CR-02: allow_same_day…」 |
| CR-03 | 済 | タグ名を `lib/cache-tags.ts` の `CACHE_TAGS`（`menus`・`settings`・`business-hours`）に集約。`getWeeklyHours` は `business-hours`、営業時間・休業日の 3 アクションは `updateTag(CACHE_TAGS.businessHours)` | `lib/cache-tags.test.ts`（全 `cacheTag`/`updateTag` が定数経由であること、読み側と無効化側のタグ集合が一致すること） |
| CR-04 | 済 | 匿名化の基準を `GREATEST(last_visit_at, 最終予約の upper(during), created_at)` に変更（SR-06 と同一） | `digest.db.test.ts`「SR-06 / CR-04: …」2 件と境界・保持ケース |
| CR-05 | 済 | upsert の `name_kana = COALESCE(excluded.name_kana, customers.name_kana)` | `booking.db.test.ts`「CR-05: an /en booking…」 |
| CR-06 | 済 | `domain/pricing.ts#isStudentRateApplied` を追加し、`is_student` を「学生価格を適用したか」で保存。確認画面・選択サマリーも同じ関数を使用（完了・キャンセル・管理詳細は保存値で一致） | `booking.db.test.ts`「CR-06: …」、`domain/pricing.test.ts` |
| CR-07 | 済 | 保存期間テストの付け替えを注入時刻で行い、フィクスチャの `created_at` も固定 | `digest.db.test.ts`「runRetention」4 件 |
| CR-08 | 済 | SR-02 と同一（ロック下で電話番号の日次上限を判定・加算） | `booking.db.test.ts`「SR-02 / CR-08: …」 |
| CR-09 | 済 | キャンセル送信中は `onSubmit` で再送を止める。サーバー側も冪等化（顧客キャンセル後もハッシュを残し、同じリンクの再送は `ok`＋`alreadyCancelled: true`、通知・監査は 1 回） | `booking.db.test.ts`「CR-09: a double tap…」「before the deadline…」 |
| CR-10 | 済 | `isDateString` を往復一致で厳密化（`2026-11-31` を拒否）。`?date`・`?start`（管理）・`/book/time?date` はすべてこの関数を経由 | `domain/time.test.ts`「parameter validation」、`availability.db.test.ts`「invalid dates (CR-10)」、E2E「Security…」 |
| CR-11 | 済 | `domain/uuid.ts#isUuid`（8-4-4-4-12）で `[id]` を検査 | `admin.db.test.ts`「malformed ids (CR-11)」、`domain/time.test.ts` |
| CR-12 | 済 | `escapeText` を RFC 5545 準拠に（`\`→`\\`、`;`→`\;`、`,`→`\,`、CRLF/LF/CR→`\n`） | `ics.test.ts`「escapeText (RFC 5545 TEXT, CR-12)」 |
| CR-13 | 済 | `writeStep` が `menu`・`startsAt` を保持（下書き取り込みは差分がある場合のみに変更し、再描画ループを防止） | E2E「JA full flow」（戻る・段階開示） |
| CR-14 | 済 | `not_bookable`（と `duplicate`）も確認画面から `/book/time?…&taken=deadline` へ戻し、「選んだ時間は予約できなくなりました」バナーを表示（ja/en キー追加） | `booking/messages.test.ts`（表示キー）、E2E |
| CR-15 | 済 | `domain/hours.ts#lastStartMin`（開店時刻から枠刻みで揃える）でプレビューを計算。代表的な営業時間と `slot_step_min` をページから渡す | `domain/hours.test.ts`「lastStartMin (CR-15)」 |
| CR-16 | 済 | オーバーライドによる休業の前日は「明日は臨時休業日です（予約 0 件）」 | `digest.db.test.ts`「runDailyDigest closures (CR-16)」 |
| CR-17 | 済 | 完了・キャンセル画面の「◯時間前まで」を予約ごとの `start − cancel_token_expires_at` から算出（DTO に `cancelDeadlineHours`） | `booking.db.test.ts`「CR-17: …」 |
| CR-18 | 済 | `hitWindow`・`checkPhoneDaily`・`incrementPhoneDaily` に `now` を注入可能にし、予約・キャンセル・OTP の各テストで固定時刻を使用 | `booking.db.test.ts`・`otp.db.test.ts`（既存のレート制限テストが固定窓で実行） |
| CR-19 | 済 | Vercel プレビューでは `VERCEL_URL`・`VERCEL_BRANCH_URL` も Turnstile の hostname として許可 | `lib/turnstile.test.ts`「accepts the deployment hostnames on Vercel previews only」 |
| CR-20 | 済 | 匿名化（保存期間ジョブ・手動）で `cancel_reason` の自由記述を NULL 化（`deleted`・`anonymized` は保持）、`cancel_token_hash` も NULL 化 | `digest.db.test.ts`「…free-text cancel reasons cleared」 |
| CR-21 | 済 | proxy は `Next-Action` 付き POST を数えず、`cancelByToken` が同じキーで判定して `rate_limited` を返す | `proxy.db.test.ts`、`booking.db.test.ts`「SR-01: the 11th cancel…」、E2E（`/ja/cancel/x.y` への 11 回目が `rate_limited`） |
| CR-22 | 済 | CI の `postgres:16` を digest（`sha256:ca0bd484…641d`）で固定。build 後に E2E（Playwright 1.56.1、専用 DB、本番モード）を実行し、失敗時はスクリーンショットを保存。`npm audit --omit=dev --audit-level=high` は継続 | CI 定義 |
| CR-23 | 済 | `seed` も小文字で保存、OTP の検索は `lower(email)` と小文字化した `ADMIN_EMAIL` で照合 | `otp.db.test.ts`「CR-23: a capitalised ADMIN_EMAIL…」 |
| CR-24 | 済 | 「直前の状態に戻す」（arrived→confirmed、in_progress→arrived、completed→in_progress）を `stepBackBookingStatus` として追加（遅刻分のクリア、`last_visit_at` を残りの完了予約から再計算、監査ログ `booking.step_back`、枠が再予約済みなら `undo_blocked`）。予約詳細にボタンを追加 | `admin.db.test.ts`「stepBackBookingStatus (CR-24)」、`domain/booking-status.test.ts` |
