# 04 データモデル — ER 図・DDL・空き計算 SQL・Drizzle・匿名化

## 文書情報

| 項目 | 内容 |
|---|---|
| 文書 ID | DES-04 |
| 版 | v0.5 |
| 日付 | 2026-10-12 |
| 変更履歴 | v0.5（2026-10-12）: レビュー修正の反映（`docs/06_test/review/` の code_review_v1・security_review_v1 の対応状況）。`consents.ip`（inet）を `ip_hash`（HMAC。マイグレーション `0004_consent_ip_hash.sql` を追加し計 5 本）に、`bookings.is_student` を「学生価格を実際に適用したか」に、顧客キャンセル後も `cancel_token_hash` を残す（同じリンクの再送は「キャンセル済み」として冪等に応答）、3.1 の冪等性キー不一致を `conflict: slot_taken` に、空き計算 SQL が `allow_same_day` を判定し JIT をトランザクション単位で無効化（6 章）、同一リクエスト内の重複排除（6.1）、匿名化の基準を最終利用（`last_visit_at`・最終予約の終了・`created_at` のうち最も遅い日時）に、匿名化で `cancel_reason` の自由記述・`cancel_token_hash`・同意の `ip_hash`・`user_agent` も消去、ハウスキーピングを保存期間ジョブへ移動（8 章）。v0.4（2026-10-12）: 実装との同期。マイグレーションを 4 本（0000 手書き・0001 生成・0002 手書き・0003 Better Auth の追加分）に、UNIQUE 制約名を drizzle-kit 生成名（`bookings_public_code_unique` 等）に、Better Auth テーブルの実列（`credential_id`＝JS キー `credentialID`、`auth_rate_limit`）を追記。空き計算 SQL の `generate_series` に `::int` キャスト（PostgreSQL 16 で smallint 版が曖昧）、日の状態に `closed`・`out_of_range` を加えた区別、冪等性と重なりはロック下の再検証が通常経路で SQLSTATE は最後の防衛線（3.1）、`booking_restriction` の判定位置、seed（`seed-admin`）、保存期間ジョブとハウスキーピングの実装（8 章）。v0.3（2026-10-12）: 要件定義書 v0.5 の反映。`booking_restriction` の値 `phone_only` を `dm_only`（Instagram DM のみ受付）に変更（FR-A-13、F3）、月カレンダー用の日単位要約クエリ `getMonthAvailability(month)` を 6.1 に追加（FR-C-07、F2）。v0.2（2026-10-10）: 要件定義書 v0.4 の反映。空き計算 SQL が × の候補も状態付きで返す（FR-C-07）、`auth_verification` の用途をワンタイムコードに（OI-12）、意図的重複の拡張点の扱い（OI-11 決定済み） |
| 関連要件 | 10 章（10.1〜10.3）、FR-S-01, FR-S-02, FR-S-06, FR-S-07, FR-S-09, FR-C-08, FR-C-10, FR-C-11, FR-A-04〜08, FR-A-11〜14, NFR-PF-05, NFR-MG-02, NFR-SC-05, NFR-SC-07, NFR-EN-07 |
| 関連 ADR | ADR-0002（Neon）、ADR-0003（EXCLUDE を生 SQL で）、ADR-0006（Better Auth テーブル）、ADR-0008（顧客スナップショットを持たない） |

---

## 1. 設計原則

| # | 原則 | 内容 |
|---|---|---|
| M-01 | 時刻は `timestamptz`（UTC 格納） | 区間は `tstzrange` の半開区間 `[)`。暦日は JST の `date`、営業時間は「0 時からの分」（`smallint`、0〜1440） |
| M-02 | 二重予約は制約で禁止 | `EXCLUDE USING gist (resource_id WITH =, during WITH &&) WHERE (status IN ('confirmed','arrived','in_progress'))` |
| M-03 | 個人情報は `customers` のみ | 予約行は `customer_id` で参照し、氏名・電話のスナップショットを持たない（ADR-0008）。匿名化は `customers` 1 行の更新で完結 |
| M-04 | 金額は確定時スナップショット | `bookings.price_jpy`・`is_student`・`buffer_min` を確定時に保存し、後のメニュー改定の影響を受けない。`is_student` は職業ではなく「学生価格を適用したか」（学生価格のないメニューは学生でも false。`domain/pricing.ts#isStudentRateApplied`） |
| M-05 | 秘密はハッシュのみ | キャンセルトークンは SHA-256（`bytea`）、レート制限キー・同意記録の IP・監査ログの電話番号は HMAC（`PII_HASH_SECRET`）。生の IP はどの表にも保存しない |
| M-06 | 列挙は Postgres ENUM | 値の追加は `ALTER TYPE … ADD VALUE` で容易。削除は行わない |
| M-07 | ソフトデリートは誤操作復旧用 | `deleted_at` は Undo（トースト 5 秒、サーバー側の有効期限 10 秒）のため。法的消去は `anonymized_at`（実データを消す） |
| M-08 | 拡張点を先に置く | `resource_id`（複数席）、`customers.line_user_id`/`instagram_user_id`（Phase 2）、`consents.kind` の Phase 3 値 |

---

## 2. ER 図

```mermaid
erDiagram
  customers ||--o{ bookings : "books"
  menus ||--o{ bookings : "selected in"
  customers ||--o{ consents : "gives"
  bookings ||--o{ consents : "records"
  customers |o--o{ customers : "merged into"
  bookings ||--o{ notification_log : "notifies"
  push_subscriptions |o--o{ notification_log : "delivered via"
  auth_user ||--o{ auth_session : "has"
  auth_user ||--o{ auth_passkey : "registers"
  auth_user ||--o{ auth_account : "links"
  auth_user ||--o{ push_subscriptions : "owns"
  auth_session |o--o{ push_subscriptions : "created in"

  customers {
    uuid id PK
    text name "NULL after anonymization"
    text name_kana
    text phone_e164 UK "partial unique"
    text phone_display
    boolean phone_unverified
    bytea phone_hash "set on anonymization"
    occupation occupation
    locale_code locale
    int no_show_count
    int late_cancel_count
    booking_restriction booking_restriction
    uuid merged_into_customer_id FK
    text line_user_id UK "Phase 2"
    text instagram_user_id UK "Phase 2"
    timestamptz last_visit_at
    timestamptz anonymized_at
    timestamptz deleted_at
  }
  bookings {
    uuid id PK
    text public_code UK
    smallint resource_id
    uuid customer_id FK
    uuid menu_id FK
    tstzrange during "half-open, EXCLUDE"
    booking_status status
    booking_source source
    locale_code locale
    int price_jpy
    boolean is_student
    smallint buffer_min
    text note
    text owner_note
    text idempotency_key "partial unique"
    bytea submission_nonce_hash
    bytea cancel_token_hash UK
    timestamptz cancel_token_expires_at
    timestamptz cancelled_at
    uuid consent_id FK
    timestamptz acknowledged_at
    smallint late_minutes
    timestamptz deleted_at
  }
  menus {
    uuid id PK
    text slug UK
    text name_ja
    text name_en
    int price_jpy
    int price_student_jpy
    smallint duration_min
    smallint buffer_after_min
    smallint sort_order
    boolean is_active
  }
  business_hours {
    smallint weekday PK "0 Sun to 6 Sat"
    boolean is_closed
    smallint open_min
    smallint close_min
  }
  business_hour_overrides {
    date date PK
    boolean is_closed
    smallint open_min
    smallint close_min
    text reason
  }
  time_blocks {
    uuid id PK
    smallint resource_id
    tstzrange during
    block_kind kind
    text label
    timestamptz deleted_at
  }
  settings {
    smallint id PK "always 1"
    smallint slot_step_min
    smallint lead_time_min
    smallint max_advance_days
    smallint cancel_deadline_min
    text timezone
    boolean allow_same_day
    smallint digest_hour_jst
  }
  consents {
    uuid id PK
    uuid customer_id FK
    uuid booking_id FK
    consent_kind kind
    text policy_version
    timestamptz accepted_at
    timestamptz revoked_at
    text ip_hash "HMAC, NULL after 1 year"
    text user_agent
  }
  push_subscriptions {
    uuid id PK
    text user_id FK
    text session_id FK
    text endpoint UK
    text p256dh
    text auth
    push_platform platform
    timestamptz last_seen_at
    timestamptz last_success_at
    int fail_count
  }
  notification_log {
    bigint id PK
    uuid booking_id FK
    uuid subscription_id FK
    text template
    timestamptz scheduled_for
    timestamptz sent_at
    notification_status status
    smallint http_status
  }
  audit_log {
    bigint id PK
    text actor
    text action
    text entity_type
    text entity_id "polymorphic, no FK"
    jsonb diff
    timestamptz created_at
  }
  rate_limits {
    text key PK
    timestamptz window_start PK
    int count
  }
  daily_digests {
    date digest_sent_on PK
    date target_date
    int booking_count
  }
  auth_user {
    text id PK
    text email UK
  }
  auth_session {
    text id PK
    text user_id FK
    timestamptz expires_at
    text user_agent
  }
  auth_passkey {
    text id PK
    text user_id FK
    text credential_id
  }
  auth_account {
    text id PK
    text user_id FK
  }
  auth_verification {
    text id PK
    text identifier
    text value "hashed OTP"
    timestamptz expires_at
  }
  auth_rate_limit {
    text id PK
    text key UK
    int count
    bigint last_request
  }
```

`audit_log` は多態参照（`entity_type`＋`entity_id`）のため FK を張らない。`auth_verification`・`auth_rate_limit` は Better Auth が単独で使う表（FK なし）。`time_blocks`・`business_hours`・`business_hour_overrides`・`settings` は空き計算 SQL で結合する（FK なし）。

---

## 3. 完全 DDL

マイグレーション構成（ADR-0003）:

| ファイル | 生成方法 | 内容 |
|---|---|---|
| `drizzle/0000_extensions.sql` | `drizzle-kit generate --custom --name=extensions` に手書き | `btree_gist`、`pg_trgm` |
| `drizzle/0001_init.sql` | `drizzle-kit generate`（`src/lib/db/schema.ts` から） | ENUM、全テーブル、CHECK、通常インデックス、部分 UNIQUE |
| `drizzle/0002_constraints.sql` | `drizzle-kit generate --custom --name=constraints` に手書き | `EXCLUDE` 制約、DEFERRABLE FK、`updated_at` トリガー |
| `drizzle/0003_auth.sql` | `drizzle-kit generate`（`src/lib/db/auth-schema.ts` から） | Better Auth 1.7.7 との突き合わせ。**追加のみ**: CLI が生成する FK・検索列の索引 5 本と `auth_rate_limit` 表（`rateLimit.storage: 'database'`） |
| `drizzle/0004_consent_ip_hash.sql` | `drizzle-kit generate --custom --name=consent_ip_hash` に手書き | `consents.ip`（inet）を `ip_hash`（text、`HMAC-SHA256(PII_HASH_SECRET, ip)` の base64url 22 文字）に改名・型変更し、CHECK `consents_ip_hash_len`（32 文字以下）を追加。HMAC はアプリの秘密が要り SQL で変換できないため既存の生 IP は破棄（公開前のデータのみ）。部分索引 `consents_pii_purge_idx` は改名に追従（AGENTS.md 規則 5、SR-15） |

以下は 5 ファイルを統合した論理 DDL（PostgreSQL 16 以上。本番の Neon は 17、ローカル・CI は 16）。列に付けた `UNIQUE` は、実際には drizzle-kit が `<表>_<列>_unique` の名前の表制約として生成する（例 `bookings_public_code_unique`、`bookings_cancel_token_hash_unique`、`menus_slug_unique`。PostgreSQL 既定の `_key` ではない）。

```sql
-- ===== 0000_extensions.sql =====
CREATE EXTENSION IF NOT EXISTS btree_gist;   -- EXCLUDE で smallint の = と tstzrange の && を併用
CREATE EXTENSION IF NOT EXISTS pg_trgm;      -- 顧客のかな部分一致検索（FR-A-13, Should）

-- ===== 0001_init.sql =====
CREATE TYPE booking_status AS ENUM (
  'confirmed', 'arrived', 'in_progress', 'completed',
  'cancelled_by_customer', 'cancelled_by_owner', 'cancelled_late', 'no_show');
CREATE TYPE booking_source AS ENUM ('web', 'phone', 'walk_in', 'instagram', 'line', 'manual');
CREATE TYPE occupation AS ENUM ('student', 'worker');
CREATE TYPE locale_code AS ENUM ('ja', 'en');
CREATE TYPE booking_restriction AS ENUM ('none', 'dm_only', 'blocked');   -- v0.3: phone_only → dm_only（未リリースのため初期マイグレーションを直接修正）
CREATE TYPE block_kind AS ENUM ('break', 'private', 'closed', 'holiday');
CREATE TYPE consent_kind AS ENUM (
  'booking_policy', 'privacy', 'health_notes', 'photo_karte', 'photo_sns', 'marketing');
CREATE TYPE push_platform AS ENUM ('ios', 'android', 'desktop', 'other');
CREATE TYPE notification_status AS ENUM ('sent', 'failed', 'expired');

CREATE TABLE customers (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    text CHECK (name IS NULL OR char_length(name) BETWEEN 1 AND 50),
  name_kana               text CHECK (name_kana IS NULL OR char_length(name_kana) <= 50),
  phone_e164              text CHECK (phone_e164 IS NULL OR phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  phone_display           text CHECK (phone_display IS NULL OR char_length(phone_display) <= 32),
  phone_unverified        boolean NOT NULL DEFAULT false,
  phone_hash              bytea,                       -- 匿名化時に HMAC(phone_e164) を残す（再来の名寄せ・統計用）
  occupation              occupation,
  locale                  locale_code NOT NULL DEFAULT 'ja',
  no_show_count           integer NOT NULL DEFAULT 0 CHECK (no_show_count >= 0),
  late_cancel_count       integer NOT NULL DEFAULT 0 CHECK (late_cancel_count >= 0),
  booking_restriction     booking_restriction NOT NULL DEFAULT 'none',
  merged_into_customer_id uuid REFERENCES customers(id),
  line_user_id            text UNIQUE,                 -- Phase 2（NULL）
  instagram_user_id       text UNIQUE,                 -- Phase 2（NULL）
  last_visit_at           timestamptz,
  anonymized_at           timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  deleted_at              timestamptz,
  CONSTRAINT customers_name_present CHECK (anonymized_at IS NOT NULL OR name IS NOT NULL),
  CONSTRAINT customers_anonymized_clean CHECK (
    anonymized_at IS NULL OR (name IS NULL AND name_kana IS NULL AND phone_e164 IS NULL
                              AND phone_display IS NULL AND line_user_id IS NULL AND instagram_user_id IS NULL)),
  CONSTRAINT customers_not_self_merged CHECK (merged_into_customer_id IS DISTINCT FROM id)
);
CREATE UNIQUE INDEX customers_phone_e164_uidx ON customers (phone_e164)
  WHERE phone_e164 IS NOT NULL AND deleted_at IS NULL AND merged_into_customer_id IS NULL;
CREATE INDEX customers_name_kana_trgm_idx ON customers USING gin (name_kana gin_trgm_ops);
CREATE INDEX customers_retention_idx ON customers (last_visit_at) WHERE anonymized_at IS NULL;

CREATE TABLE menus (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name_ja           text NOT NULL CHECK (char_length(name_ja) BETWEEN 1 AND 40),
  name_en           text NOT NULL CHECK (char_length(name_en) BETWEEN 1 AND 60),
  description_ja    text CHECK (char_length(description_ja) <= 120),
  description_en    text CHECK (char_length(description_en) <= 200),
  price_jpy         integer NOT NULL CHECK (price_jpy >= 0),              -- 税込
  price_student_jpy integer CHECK (price_student_jpy IS NULL OR price_student_jpy BETWEEN 0 AND price_jpy),
  duration_min      smallint NOT NULL CHECK (duration_min BETWEEN 15 AND 480 AND duration_min % 5 = 0),
  buffer_after_min  smallint NOT NULL DEFAULT 0 CHECK (buffer_after_min BETWEEN 0 AND 120 AND buffer_after_min % 5 = 0),
  sort_order        smallint NOT NULL DEFAULT 0,
  is_active         boolean NOT NULL DEFAULT false,                      -- 価格確定まで非公開
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE business_hours (
  weekday    smallint PRIMARY KEY CHECK (weekday BETWEEN 0 AND 6),      -- 0=日 … 6=土（extract(dow) と一致）
  is_closed  boolean NOT NULL DEFAULT false,
  open_min   smallint CHECK (open_min BETWEEN 0 AND 1440),
  close_min  smallint CHECK (close_min BETWEEN 0 AND 1440),               -- 1440 = 24:00
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_hours_valid CHECK (
    is_closed OR (open_min IS NOT NULL AND close_min IS NOT NULL AND open_min < close_min))
);

CREATE TABLE business_hour_overrides (
  date       date PRIMARY KEY,                                            -- JST 暦日
  is_closed  boolean NOT NULL DEFAULT true,
  open_min   smallint CHECK (open_min BETWEEN 0 AND 1440),
  close_min  smallint CHECK (close_min BETWEEN 0 AND 1440),
  reason     text CHECK (char_length(reason) <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT overrides_valid CHECK (
    is_closed OR (open_min IS NOT NULL AND close_min IS NOT NULL AND open_min < close_min))
);

CREATE TABLE settings (
  id                  smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),     -- 単一行
  slot_step_min       smallint NOT NULL DEFAULT 30  CHECK (slot_step_min IN (10, 15, 20, 30, 60)),
  lead_time_min       smallint NOT NULL DEFAULT 60  CHECK (lead_time_min BETWEEN 0 AND 2880),
  max_advance_days    smallint NOT NULL DEFAULT 60  CHECK (max_advance_days BETWEEN 1 AND 365),
  cancel_deadline_min smallint NOT NULL DEFAULT 120 CHECK (cancel_deadline_min BETWEEN 0 AND 10080),
  timezone            text     NOT NULL DEFAULT 'Asia/Tokyo' CHECK (timezone = 'Asia/Tokyo'),
  allow_same_day      boolean  NOT NULL DEFAULT true,
  digest_hour_jst     smallint NOT NULL DEFAULT 21  CHECK (digest_hour_jst BETWEEN 0 AND 23),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE consents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id    uuid NOT NULL REFERENCES customers(id),
  booking_id     uuid,                                                    -- FK は 0002 で DEFERRABLE 付与
  kind           consent_kind NOT NULL,
  policy_version text NOT NULL CHECK (char_length(policy_version) <= 32),
  accepted_at    timestamptz NOT NULL DEFAULT now(),
  revoked_at     timestamptz,
  ip_hash        text CONSTRAINT consents_ip_hash_len CHECK (char_length(ip_hash) <= 32), -- 0004: HMAC(PII_HASH_SECRET, ip)。1 年で NULL 化
  user_agent     text CHECK (char_length(user_agent) <= 512),             -- 1 年で NULL 化
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX consents_customer_idx ON consents (customer_id, accepted_at DESC);
CREATE INDEX consents_pii_purge_idx ON consents (accepted_at) WHERE ip_hash IS NOT NULL OR user_agent IS NOT NULL;

CREATE TABLE bookings (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_code             text NOT NULL UNIQUE CHECK (public_code ~ '^[0-9A-HJKMNP-TV-Z]{8}$'), -- Crockford base32
  resource_id             smallint NOT NULL DEFAULT 1 CHECK (resource_id >= 1),
  customer_id             uuid NOT NULL REFERENCES customers(id),
  menu_id                 uuid NOT NULL REFERENCES menus(id),
  during                  tstzrange NOT NULL,                             -- [start, start + duration + buffer)
  status                  booking_status NOT NULL DEFAULT 'confirmed',
  source                  booking_source NOT NULL,
  locale                  locale_code NOT NULL DEFAULT 'ja',
  price_jpy               integer NOT NULL CHECK (price_jpy >= 0),        -- 適用価格スナップショット
  is_student              boolean NOT NULL DEFAULT false,                 -- 学生価格を適用したか（職業区分ではない）
  buffer_min              smallint NOT NULL DEFAULT 0 CHECK (buffer_min >= 0), -- 表示上の終了 = upper(during) - buffer_min
  note                    text CHECK (char_length(note) <= 500),
  owner_note              text CHECK (char_length(owner_note) <= 500),
  idempotency_key         text CHECK (idempotency_key IS NULL OR idempotency_key ~ '^[0-9a-f]{64}$'),
  submission_nonce_hash   bytea,                                          -- 同一ブラウザ再送の判定（G-04）
  cancel_token_hash       bytea UNIQUE CHECK (cancel_token_hash IS NULL OR octet_length(cancel_token_hash) = 32), -- 顧客キャンセル後も保持。管理者キャンセル・削除・匿名化で NULL
  cancel_token_expires_at timestamptz,                                    -- セルフキャンセル締切
  cancelled_at            timestamptz,
  cancel_reason           text CHECK (char_length(cancel_reason) <= 200),
  consent_id              uuid,                                           -- FK は 0002 で DEFERRABLE 付与
  acknowledged_at         timestamptz,                                    -- 未確認バッジ（NULL = 未確認）
  late_minutes            smallint CHECK (late_minutes >= 0),
  status_changed_at       timestamptz NOT NULL DEFAULT now(),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  deleted_at              timestamptz,
  CONSTRAINT bookings_during_half_open CHECK (
    lower_inc(during) AND NOT upper_inc(during) AND NOT isempty(during)
    AND NOT lower_inf(during) AND NOT upper_inf(during)),
  CONSTRAINT bookings_cancel_consistency CHECK (
    (status IN ('cancelled_by_customer', 'cancelled_by_owner', 'cancelled_late')) = (cancelled_at IS NOT NULL)),
  CONSTRAINT bookings_web_has_consent CHECK (source <> 'web' OR consent_id IS NOT NULL),
  CONSTRAINT bookings_web_has_idempotency CHECK (source <> 'web' OR idempotency_key IS NOT NULL),
  CONSTRAINT bookings_deleted_inactive CHECK (
    deleted_at IS NULL OR status NOT IN ('confirmed', 'arrived', 'in_progress'))
);
-- 冪等性キーは「有効な予約」の中で一意（キャンセル後に同じ人が同じ枠を取り直せる。G-03）
CREATE UNIQUE INDEX bookings_idempotency_active_uidx ON bookings (idempotency_key)
  WHERE idempotency_key IS NOT NULL AND status IN ('confirmed', 'arrived', 'in_progress');
CREATE INDEX bookings_start_idx    ON bookings (lower(during));
CREATE INDEX bookings_customer_idx ON bookings (customer_id, lower(during) DESC);
CREATE INDEX bookings_unack_idx    ON bookings (created_at DESC) WHERE acknowledged_at IS NULL;

CREATE TABLE time_blocks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id smallint NOT NULL DEFAULT 1,
  during      tstzrange NOT NULL,
  kind        block_kind NOT NULL,
  label       text CHECK (char_length(label) <= 50),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  CONSTRAINT time_blocks_during_half_open CHECK (
    lower_inc(during) AND NOT upper_inc(during) AND NOT isempty(during)
    AND NOT lower_inf(during) AND NOT upper_inf(during)),
  CONSTRAINT time_blocks_max_span CHECK (upper(during) - lower(during) <= interval '60 days')
);
CREATE INDEX time_blocks_during_gist ON time_blocks USING gist (resource_id, during) WHERE deleted_at IS NULL;

-- Better Auth 1.7.7（ADR-0006）。表名を auth_* にして予約語 "user" を避ける。Drizzle アダプタは
-- auth-schema.ts の JS キーで対応付けるため、プロパティ名は Better Auth のフィールド名と一致させる（例 credentialID）
--   auth_user(id, name, email UNIQUE, email_verified, image, created_at, updated_at)
--   auth_session(id, user_id FK CASCADE, token UNIQUE, expires_at, ip_address, user_agent, created_at, updated_at)
--   auth_account(id, user_id FK CASCADE, account_id, provider_id, access_token, refresh_token, id_token,
--                access_token_expires_at, refresh_token_expires_at, scope, password, created_at, updated_at)
--   auth_verification(id, identifier, value, expires_at, created_at, updated_at)
--                -- ログインのワンタイムコード（emailOTP、storeOTP: 'hashed'。OI-12 決定済み。マジックリンク案は不採用）
--   auth_passkey(id, name, public_key, user_id FK CASCADE, credential_id, counter, device_type, backed_up,
--                transports, aaguid, created_at)   -- credential_id の JS キーは credentialID

-- ===== 0003_auth.sql（追加のみ） =====
CREATE TABLE auth_rate_limit (                     -- Better Auth rateLimit.storage: 'database'（ログイン試行の制限）
  id           text PRIMARY KEY,
  key          text NOT NULL CONSTRAINT auth_rate_limit_key_unique UNIQUE,
  count        integer NOT NULL,
  last_request bigint NOT NULL                     -- epoch ミリ秒
);
CREATE INDEX auth_account_user_id_idx         ON auth_account (user_id);
CREATE INDEX auth_passkey_user_id_idx         ON auth_passkey (user_id);
CREATE INDEX auth_passkey_credential_id_idx   ON auth_passkey (credential_id);
CREATE INDEX auth_session_user_id_idx         ON auth_session (user_id);
CREATE INDEX auth_verification_identifier_idx ON auth_verification (identifier);

CREATE TABLE push_subscriptions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  session_id      text REFERENCES auth_session(id) ON DELETE SET NULL,
  endpoint        text NOT NULL UNIQUE CHECK (endpoint ~ '^https://'),
  p256dh          text NOT NULL,
  auth            text NOT NULL,
  platform        push_platform NOT NULL DEFAULT 'other',
  user_agent      text CHECK (char_length(user_agent) <= 512),
  last_seen_at    timestamptz NOT NULL DEFAULT now(),
  last_success_at timestamptz,
  fail_count      integer NOT NULL DEFAULT 0 CHECK (fail_count >= 0),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notification_log (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  booking_id      uuid REFERENCES bookings(id),
  subscription_id uuid REFERENCES push_subscriptions(id) ON DELETE SET NULL,
  channel         text NOT NULL DEFAULT 'push' CHECK (channel IN ('push')),
  template        text NOT NULL CHECK (template IN ('booking_created', 'booking_cancelled', 'daily_digest', 'test')),
  scheduled_for   timestamptz NOT NULL,                                   -- 起点（予約確定時刻など）。KPI-07 の計測
  sent_at         timestamptz,                                            -- Push サービスが 201 を返した時刻
  status          notification_status NOT NULL,
  http_status     smallint,
  error           text CHECK (char_length(error) <= 500),                 -- PII を含めない
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notification_log_booking_idx ON notification_log (booking_id);

CREATE TABLE audit_log (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor       text NOT NULL CHECK (actor ~ '^(owner|system|customer:[0-9a-f-]{36})$'),
  action      text NOT NULL CHECK (action ~ '^[a-z_]+\.[a-z_]+$'),        -- 例 booking.create, block.delete
  entity_type text NOT NULL CHECK (entity_type IN (
                'booking', 'customer', 'time_block', 'menu', 'business_hours',
                'override', 'settings', 'push_subscription', 'session')),
  entity_id   text NOT NULL,
  diff        jsonb NOT NULL DEFAULT '{}'::jsonb,                         -- 氏名・電話は入れない（08_security.md 7 章）
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_entity_idx ON audit_log (entity_type, entity_id, created_at DESC);

CREATE TABLE rate_limits (
  key          text NOT NULL CHECK (char_length(key) <= 128),             -- 例 book:ip:<hmac>, book:phone:<hmac>
  window_start timestamptz NOT NULL,
  count        integer NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);
CREATE INDEX rate_limits_window_idx ON rate_limits (window_start);

CREATE TABLE daily_digests (
  digest_sent_on date PRIMARY KEY,                                        -- 送信日（JST）。同日 2 回目を防ぐ
  target_date    date NOT NULL,
  booking_count  integer NOT NULL,
  sent_at        timestamptz NOT NULL DEFAULT now()
);

-- ===== 0002_constraints.sql（Drizzle DSL で表現できないもの） =====
ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (resource_id WITH =, during WITH &&)
  WHERE (status IN ('confirmed', 'arrived', 'in_progress'));

ALTER TABLE bookings ADD CONSTRAINT bookings_consent_fk
  FOREIGN KEY (consent_id) REFERENCES consents(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE consents ADD CONSTRAINT consents_booking_fk
  FOREIGN KEY (booking_id) REFERENCES bookings(id) DEFERRABLE INITIALLY DEFERRED;

CREATE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
CREATE TRIGGER customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER bookings_updated_at  BEFORE UPDATE ON bookings  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER menus_updated_at     BEFORE UPDATE ON menus     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER time_blocks_updated_at BEFORE UPDATE ON time_blocks FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### 3.1 制約とエラーコードの対応

| 制約・インデックス | SQLSTATE | アプリでの扱い（`lib/pg-errors.ts` は `constraint` 名で判別） | 関連 |
|---|---|---|---|
| `bookings_no_overlap` | `23P01` | `conflict: slot_taken`（顧客）／`conflict: overlap`（管理）／`conflict: undo_blocked`（Undo）。通常は advisory lock 下の再検証（顧客は空き計算 SQL、管理は `findOverlaps`）で先に検出して同じ結果を返すため、`23P01` はロックを経ない書き込みに対する最後の防衛線 | FR-C-10, FR-A-05 |
| `bookings_idempotency_active_uidx` | `23505` | 通常はロック下で同じキーの有効な予約を `FOR UPDATE` で探して判定する（`submission_nonce` 一致 → トークンを再発行して `ok`、不一致 → 満席と同じ `conflict: slot_taken`。内部の理由はログ `booking.duplicate_rejected` のみ。SR-12）。`23505` は同時送信の競合時のみで、同じ判定をやり直す | FR-C-10, G-04 |
| `bookings_public_code_unique`・`bookings_cancel_token_hash_unique` | `23505` | 生成し直して 1 回だけ再試行（衝突は実質発生しない） | — |
| `menus_slug_unique` | `23505` | `upsertMenu` が `invalid`（`slug: slugTaken`）を返す | FR-A-08 |
| `customers_phone_e164_uidx` | `23505` | upsert（`ON CONFLICT … DO UPDATE`）で発生させない | ADR-0008 |
| CHECK 違反 | `23514` | バグとして `error`（Zod を通過した値で起きないこと） | — |

---

## 4. 列挙値

| ENUM | 値 | 意味・遷移 | 関連 |
|---|---|---|---|
| `booking_status` | `confirmed` / `arrived` / `in_progress` / `completed` / `cancelled_by_customer` / `cancelled_by_owner` / `cancelled_late` / `no_show` | 05_state_and_flows.md 1 章。排他対象は前 3 つ | 6.3 |
| `booking_source` | `web` / `phone` / `walk_in` / `instagram` / `line` / `manual` | `web` のみ同意・冪等性キー必須 | FR-A-05 |
| `occupation` | `student` / `worker` | 学割判定 | FR-C-04 |
| `booking_restriction` | `none` / `dm_only`（Instagram DM のみ受付。v0.2 の `phone_only` を置換）/ `blocked` | web 予約のトランザクション内で顧客 upsert の直後に判定し、`none` 以外は `restricted` を返してロールバック（upsert も残らない）。画面は Instagram DM へ案内（Should）【要確認: OI-16】 | FR-A-13 |
| `block_kind` | `break`（休憩）/ `private`（私用）/ `closed`（臨時休業）/ `holiday`（将来の祝日休業） | UI は前 3 つ | FR-A-06 |
| `consent_kind` | Phase 1: `booking_policy`, `privacy`。Phase 3: `health_notes`, `photo_karte`, `photo_sns`。任意: `marketing` | Phase 1 は 1 チェックで 2 行作成 | 12.3 |
| `push_platform` | `ios` / `android` / `desktop` / `other` | UA から推定 | FR-A-09 |
| `notification_status` | `sent` / `failed` / `expired`（404/410 で購読削除） | — | FR-S-03 |

---

## 5. 初期データ（seed）

| テーブル | 内容 | 状態 |
|---|---|---|
| `settings` | `slot_step_min=30, lead_time_min=60, max_advance_days=60, cancel_deadline_min=120, allow_same_day=true, digest_hour_jst=21` | 【要確認: OI-05, OI-06】 |
| `business_hours` | 0（日）・2〜6（火〜土）: `open_min=1080, close_min=1440`。1（月）: `is_closed=true` | 【要確認: OI-02, OI-03】 |
| `menus` | 下表 9 件。**価格は第 2 回打ち合わせで確定するまで `price_jpy=0`・`is_active=false`**（推測値を入れない）。ローカル開発・テストだけ `npm run db:seed -- --activate-menus` で予約可能にする | 【要確認: OI-01, OI-07】 |
| `auth_user` | `ADMIN_EMAIL` で 1 名（`npm run db:seed-admin`。`db:seed` も `ADMIN_EMAIL` があれば作成）。初回はワンタイムコードでログインし、パスキーを登録 | コードの配信経路【要確認: OI-21】 |

| sort | slug | name_ja | name_en（仮） | duration_min | buffer_after_min |
|---|---|---|---|---|---|
| 1 | `cut` | カット | Haircut | 60 | 0 |
| 2 | `cut-perm` | カットパーマ | Cut & Perm | 60 | 0 |
| 3 | `cut-color` | カットカラー | Cut & Color | 60 | 0 |
| 4 | `special-perm` | 特殊パーマ | Special Perm | 60 | 0 |
| 5 | `bleach` | ブリーチ | Bleach | 60 | 0 |
| 6 | `retouch` | リタッチ | Root Retouch | 60 | 0 |
| 7 | `bleach-extra` | ブリーチ 2 回目以上 | Additional Bleach (2nd+) | 60 | 0 |
| 8 | `braids-special` | 編み込み・特殊ヘア | Braids & Special Styling | 60 | 0 |
| 9 | `iron-perm` | アイロンパーマ（濡れパン） | Iron Perm (Nurepan) | 60 | 0 |

---

## 6. 空き計算 SQL（FR-S-02）

1 回のクエリで「期間内の各日の状態」と「候補開始時刻とその状態（`available` / `full` / `deadline`）の配列」を返す。日の状態はこの 3 値に `closed`（定休・休業）と `out_of_range`（予約可能期間外）を加えた 5 値（`DayStatus`）。実装は `src/lib/db/availability-sql.ts`（CTE を共有し、最終 SELECT だけを 6 章用と 6.1 用の 2 種にする。表示用の DAL と予約確定時の再検証の両方が使うため `lib/db` に置く）。JST で候補を生成 → `tstzrange` に変換 → リードタイム内と、`settings.allow_same_day` が false のときの当日（JST 暦日）の候補を `deadline`、有効予約・未削除ブロックと `&&` で重なるものを `full` に分類する（v0.2: FR-C-07 の「× の行も表示し操作不可」に合わせ、埋まった候補も返す。閉店をまたぐ時刻は候補にしない）。

実行は常にトランザクション内で、先に `SET LOCAL jit = off` を行う（表示側の DAL は `readAvailability()` の読み取り専用トランザクション、予約確定はロック取得直後の `disableJit(tx)`）。`generate_series` の行数見積りが過大で推定コストが `jit_above_cost` を超え、約 1 ms のクエリに JIT コンパイルで約 0.4 秒かかるため。ロール設定や接続の起動オプションではなく `SET LOCAL` にしたのは、Neon のトランザクションモードのプーラー経由でも効き、マイグレーションも要らないため（SR-04）。

```sql
-- getAvailability: $1 menu_slug text, $2 from_date date (JST), $3 to_date date (JST), $4 now timestamptz
WITH s AS (
  SELECT slot_step_min, lead_time_min, max_advance_days, allow_same_day FROM settings WHERE id = 1
), m AS (
  SELECT duration_min, buffer_after_min FROM menus WHERE slug = $1 AND is_active
), p AS (
  SELECT m.duration_min, m.buffer_after_min, s.slot_step_min, s.allow_same_day,
         $4::timestamptz + make_interval(mins => s.lead_time_min)          AS not_before,
         ($4::timestamptz AT TIME ZONE 'Asia/Tokyo')::date + s.max_advance_days AS last_date,
         ($4::timestamptz AT TIME ZONE 'Asia/Tokyo')::date                      AS today
  FROM m CROSS JOIN s
), days AS (
  SELECT d::date AS d FROM generate_series($2::date, $3::date, interval '1 day') AS d
), hours AS (
  SELECT days.d,
         COALESCE(o.is_closed, h.is_closed) AS is_closed,
         COALESCE(o.is_closed, false)       AS override_closed,
         COALESCE(o.open_min,  h.open_min)  AS open_min,
         COALESCE(o.close_min, h.close_min) AS close_min
  FROM days
  JOIN business_hours h ON h.weekday = extract(dow FROM days.d)
  LEFT JOIN business_hour_overrides o ON o.date = days.d
), cand AS (
  SELECT hr.d,
         (hr.d::timestamp + make_interval(mins => g.m)) AT TIME ZONE 'Asia/Tokyo' AS start_at
  FROM hours hr
  CROSS JOIN p
  -- ::int: smallint 同士の generate_series は PostgreSQL 16 で関数解決が曖昧になるため明示する
  CROSS JOIN LATERAL generate_series(
       hr.open_min::int,
       (hr.close_min - p.duration_min - p.buffer_after_min)::int,   -- 閉店をまたぐ枠を出さない
       p.slot_step_min::int) AS g(m)
  WHERE NOT hr.is_closed AND hr.d <= p.last_date
), slots AS (
  SELECT c.d, c.start_at,
         tstzrange(c.start_at,
                   c.start_at + make_interval(mins => p.duration_min + p.buffer_after_min), '[)') AS r,
         c.start_at < p.not_before AS in_lead_time,              -- リードタイム内（× 締切）
         (NOT p.allow_same_day AND c.d <= p.today) AS same_day_off -- 当日の web 予約を受け付けない設定（× 締切。CR-02）
  FROM cand c CROSS JOIN p
), classified AS (
  SELECT sl.d, sl.start_at,
         CASE WHEN sl.in_lead_time OR sl.same_day_off THEN 'deadline'
              WHEN EXISTS (SELECT 1 FROM bookings b
                           WHERE b.resource_id = 1
                             AND b.status IN ('confirmed', 'arrived', 'in_progress')
                             AND b.during && sl.r)
                OR EXISTS (SELECT 1 FROM time_blocks t
                           WHERE t.resource_id = 1 AND t.deleted_at IS NULL
                             AND t.during && sl.r)
              THEN 'full'
              ELSE 'available' END AS slot_status
  FROM slots sl
)
SELECT hr.d::text AS date,
       CASE WHEN hr.d > (SELECT last_date FROM p)                         THEN 'out_of_range'
            WHEN hr.is_closed                                             THEN 'closed'
            WHEN count(*) FILTER (WHERE c.slot_status = 'available') > 0 THEN 'available'
            WHEN count(*) FILTER (WHERE c.slot_status = 'full') > 0      THEN 'full'
            WHEN count(c.start_at) > 0                                    THEN 'deadline'
            ELSE 'full' END                                               AS day_status,
       CASE WHEN hr.override_closed THEN 'override'
            WHEN hr.is_closed       THEN 'regular' END                    AS closed_reason,
       COALESCE(json_agg(json_build_object('startsAt', c.start_at, 'status', c.slot_status)
                         ORDER BY c.start_at) FILTER (WHERE c.start_at IS NOT NULL),
                '[]'::json)                                               AS slots
FROM hours hr
LEFT JOIN classified c ON c.d = hr.d
GROUP BY hr.d, hr.is_closed, hr.override_closed
ORDER BY hr.d;
```

| 確認ケース（契約テスト） | 期待 | 関連 |
|---|---|---|
| 60 分・18:00〜24:00・30 分刻み | 18:00 … 23:00 の 11 枠。23:30 は出ない | FR-C-08, AT-04 |
| 90 分メニュー | 最終開始 22:30 | FR-A-08 |
| 月曜 | `closed` | FR-C-08 |
| `now` = 19:01 JST、リードタイム 60 分 | `not_before` = 20:01 のため 20:00 開始以前は `deadline`、20:30 開始以降のみ `available`（「現在時刻 + 59 分の枠が予約可能として表示されない」を満たす） | FR-C-08 |
| 61 日後 | `out_of_range` | FR-C-08 |
| 19:00–20:00 の有効予約 | 18:30・19:00・19:30 開始が `full`（18:00 は 19:00 終了で `[)` のため `available` のまま） | FR-S-01 |
| キャンセル済み予約 | 枠に影響しない | 6.3 |
| 臨時休業オーバーライド | `closed` | FR-A-07 |
| 時間ブロック（`deleted_at` あり） | 影響しない | FR-A-06 |
| JST 0:00 前後（UTC 15:00） | 日付の帰属が JST 暦日 | NFR-EN-07 |
| `allow_same_day = false` | 今日の候補はすべて `deadline`（明日以降は影響なし）。予約確定時の再検証も同じ SQL のため `not_bookable` | FR-A-07 |
| JIT（SR-04） | トランザクション内で `SHOW jit` = `off`、`EXPLAIN (ANALYZE, FORMAT JSON)` に JIT 節がなく、設定が接続に残らない | NFR-PF-03 |
| 実在しない日付（`2026-11-31`） | DAL が `null`（`isDateString` は往復一致で判定。CR-10） | — |

上表のケースは DB 統合テスト `src/features/availability/availability.db.test.ts` が実 Postgres で SQL の結果を期待値と直接照合する（v0.3 までの「TS 版 `src/domain/availability.ts` をオラクルにする」案は採らない。管理画面の重なり表示は `features/admin/calendar.ts` の `findOverlaps`、手動予約の空き開始時刻は `getFreeStarts` が担う）。予約確定時の再検証は同じ SQL を `$2 = $3 = 対象日` で実行し、`startsAt` が `slots` に含まれ、`deadline` でなく（`deadline` または未掲載 → `invalid: not_bookable`）、`full` でない（→ `conflict: slot_taken`）ことを確認する（トランザクション内・advisory lock 下。05_state_and_flows.md 2 章）。v0.3 で週ストリップを廃止したため、S-C-03 の時間枠リストも `getDayAvailability({ menuSlug, date })`（＝ `$2 = $3 = 選択日`）で呼ぶ。`getAvailability` は 1 回 14 日までに制限し、未知・非公開のメニューと不正な日付には `null` を返す。

### 6.1 月カレンダー用の日単位要約（`getMonthAvailability`）

月カレンダー（S-C-03、FR-C-07）の各日の ◎ / × と理由ラベルは、上の SQL と**同じ CTE（`s`〜`classified`）**を `$2 = 月初`、`$3 = 月末`（JST 暦日）で実行し、最後の SELECT だけを日単位の要約に差し替えて求める。規則を二重に持たないため、日の状態と時間枠の状態は必ず一致する。

```sql
-- getMonthAvailability: $1 menu_slug text, $2 month_start date (JST), $3 month_end date (JST), $4 now timestamptz
-- WITH s AS (...), m AS (...), p AS (...), days AS (...), hours AS (...), cand AS (...), slots AS (...), classified AS (...)  ← 6 章と同一
SELECT hr.d::text AS date,
       CASE WHEN hr.d < (SELECT today FROM p)                             THEN 'out_of_range'  -- 過去日
            WHEN hr.d > (SELECT last_date FROM p)                         THEN 'out_of_range'  -- 61 日以降
            WHEN hr.is_closed                                             THEN 'closed'
            WHEN count(*) FILTER (WHERE c.slot_status = 'available') > 0 THEN 'available'
            WHEN count(*) FILTER (WHERE c.slot_status = 'full') > 0      THEN 'full'
            WHEN count(c.start_at) > 0                                    THEN 'deadline'
            ELSE 'full' END                                               AS day_status,
       CASE WHEN hr.override_closed THEN 'override'
            WHEN hr.is_closed       THEN 'regular' END                    AS closed_reason
FROM hours hr
LEFT JOIN classified c ON c.d = hr.d
GROUP BY hr.d, hr.is_closed, hr.override_closed
ORDER BY hr.d;
```

| 項目 | 内容 |
|---|---|
| コスト | 月表示 1 回につき 1 クエリ（最大 31 日 × 候補 11〜13 枠 ≒ 400 行の `&&` 判定。`bookings` / `time_blocks` の GiST 索引を使う）。週ストリップ時代の 14 日 × 1 クエリと同程度で、NFR-PF-03（p95 500 ms）の範囲内を想定。時間枠リスト用の 1 日分クエリと合わせて S-C-03 の表示は 2 クエリ |
| キャッシュ | 空き状況のためリクエスト間キャッシュはしない（FR-S-12、AGENTS.md 規則 3）。同じ引数（メニュー・月または日付・`now` のミリ秒）の呼び出しは React `cache()` で 1 リクエスト内だけ 1 回にまとめる（`getMonthAvailability`・`getAvailability`。リクエストをまたいで共有しない）。S-C-03 は、指定月が範囲外のときの今月へのやり直しと「次に空いている日」探索で翌月を引くときに限り、別の月を 1 リクエストで最大 3 回引く |
| 範囲 | 今月から `today + max_advance_days` を含む月まで。範囲外・形式不正の `month` と未知・非公開のメニューは DAL が `null` を返し、ページは今月で取り直す（06_api.md 2.2） |
| 契約テスト | 6 章の表に加え「月の途中で 61 日目を迎える月は以降が `out_of_range`」「今日より前の日は `out_of_range`」「同じ日の `day_status` が `getAvailability` の結果の集約と一致」 |

---

## 7. Drizzle での表現

```ts
// src/lib/db/custom-types.ts
import { customType } from 'drizzle-orm/pg-core'

/** 常に有限・半開区間 [start, end) として扱う */
export type TstzRange = { start: Date; end: Date }

export const tstzrange = customType<{ data: TstzRange; driverData: string }>({
  dataType: () => 'tstzrange',
  toDriver: ({ start, end }) => `[${start.toISOString()},${end.toISOString()})`,
  fromDriver: (value) => {
    // 例: ["2026-11-04 09:00:00+00","2026-11-04 10:00:00+00")  ※接続の TimeZone は UTC に固定
    const m = /^\["?([^",]+)"?,"?([^",)]+)"?\)$/.exec(value)
    if (!m?.[1] || !m[2]) throw new Error('unexpected tstzrange literal')
    const iso = (s: string) => s.replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00')
    return { start: new Date(iso(m[1])), end: new Date(iso(m[2])) }
  },
})
```

```ts
// src/lib/db/schema.ts（抜粋）
export const bookingStatus = pgEnum('booking_status', [
  'confirmed', 'arrived', 'in_progress', 'completed',
  'cancelled_by_customer', 'cancelled_by_owner', 'cancelled_late', 'no_show'])
export const ACTIVE_STATUSES = ['confirmed', 'arrived', 'in_progress'] as const

export const bookings = pgTable('bookings', {
  id: uuid('id').primaryKey().defaultRandom(),
  publicCode: text('public_code').notNull().unique(),
  resourceId: smallint('resource_id').notNull().default(1),
  customerId: uuid('customer_id').notNull().references(() => customers.id),
  menuId: uuid('menu_id').notNull().references(() => menus.id),
  during: tstzrange('during').notNull(),
  status: bookingStatus('status').notNull().default('confirmed'),
  // … 省略 …
  idempotencyKey: text('idempotency_key'),
  cancelTokenHash: bytea('cancel_token_hash').unique(),
}, () => [
  // CHECK / WHERE の本体は列名をそのまま書く（生成 SQL を素直にするため）
  check('bookings_during_half_open',
    sql`lower_inc(during) AND NOT upper_inc(during) AND NOT isempty(during) AND NOT lower_inf(during) AND NOT upper_inf(during)`),
  uniqueIndex('bookings_idempotency_active_uidx').on(sql`idempotency_key`)
    .where(sql`idempotency_key IS NOT NULL AND status IN ('confirmed', 'arrived', 'in_progress')`),
  // EXCLUDE 制約は DSL 非対応のため drizzle/0002_constraints.sql に手書き（ADR-0003）
])
```

運用ルール:

| # | ルール | 理由 |
|---|---|---|
| DZ-01 | 区間の読み取りは原則 `lower(during)` / `upper(during)` を `timestamptz` 列として SELECT し、`fromDriver` の文字列解析に頼らない | 出力形式がセッション TimeZone に依存するため |
| DZ-02 | DB 接続は `options=-c TimeZone=UTC` を付ける | 範囲リテラルの解析を安定させる |
| DZ-03 | `drizzle-kit push` は使わない。全環境 `drizzle-kit migrate` のみ | push は手書き制約（EXCLUDE・DEFERRABLE FK）を把握しない |
| DZ-04 | DB 統合テストで `pg_constraint` に `bookings_no_overlap` が存在することをアサート | マイグレーション漏れの検出 |
| DZ-05 | ドライバは `pg`（node-postgres）の Pool を Neon のプール接続文字列で使い、Fluid compute では `attachDatabasePool` で解放を保証 | 対話的トランザクション（advisory lock・再検証・INSERT）を 1 接続で行うため |

---

## 8. 匿名化・保存期間（10.3 の実装）

| 対象 | 契機 | 処理 | 残すもの | 関連 |
|---|---|---|---|---|
| 顧客（保存期間） | 最終利用 `GREATEST(last_visit_at, 最終予約の upper(during)（状態を問わない）, created_at) < now() - interval '3 years'` かつ未来の有効予約なし（`/api/cron/retention`、毎日 18:00 UTC＝03:00 JST、Should。`features/notifications/retention.ts`）。`last_visit_at` は `completed` への遷移でのみ設定されるため、キャンセル・無断キャンセルだけの顧客や完了の記録漏れでも個人情報が残り続けないよう、予約の終了と登録日時も基準に含める（SR-06、CR-04） | 1 トランザクションで対象を `FOR UPDATE` し、`name, name_kana, phone_e164, phone_display, line_user_id, instagram_user_id` を NULL、`phone_hash = HMAC(phone_e164)`、`anonymized_at = now()`、その顧客の予約の `note`・`owner_note`・`cancel_token_hash` と `cancel_reason` の自由記述（固定値 `deleted`・`anonymized` は残す）を NULL、その顧客の `consents` の `ip_hash`・`user_agent` を NULL。`audit_log` は 1 実行 1 行（`actor = system`、`customer.anonymize`、`entity_id = 'retention'`、`diff.count`） | 予約の日時・メニュー・状態・金額、`no_show_count` 等の統計、`consents` の事実 | FR-S-09 |
| 顧客（削除依頼） | 管理者が S-A-11 で `anonymizeCustomer`（電話＋折り返しで本人確認後、7 日以内。電話がある顧客は下 4 桁の一致が必須） | 同上（予約の自由記述・トークンハッシュ、同意の `ip_hash`・`user_agent` を含む）＋`audit_log`（`customer.anonymize`、`diff.cancelledFutureBookings`）。未来の有効予約は先に `cancelled_by_owner`（`cancel_reason = 'anonymized'`、トークン NULL） | 同上 | FR-A-14, AT-30 |
| 予約の備考 | 顧客匿名化と同時 | `bookings.note`、`owner_note`、`cancel_reason` の自由記述（`deleted`・`anonymized` 以外）を NULL（自由記述に個人情報が混入しうるため。CR-20） | — | 10.3 |
| キャンセルトークンのハッシュ | 顧客キャンセル後も保持し（同じリンクの再送に「キャンセル済み」で冪等に答えるため。トークンで閲覧・操作できるのは `confirmed` の予約のみ）、管理者キャンセル・削除・顧客匿名化で NULL | `cancel_token_hash` を NULL | — | FR-S-06, CR-09 |
| 同意記録の IP・UA | `accepted_at < now() - interval '1 year'`（保存期間ジョブの匿名化の後のハウスキーピング） | `ip_hash`, `user_agent` を NULL | 同意の種類・版・日時 | 10.3 |
| `rate_limits` | `window_start < now() - interval '2 days'`（同上） | DELETE | — | FR-S-04 |
| `notification_log` | `created_at` が 1 年超（同上） | DELETE | — | NFR-OP-02 |
| `auth_verification` | `expires_at` から 1 日超（同上） | DELETE | — | FR-A-01 |
| ソフトデリート | 5 秒 Undo 経過後もそのまま保持（履歴） | 予約: `deleted_at` を持つ行は一覧から除外。ブロック: 同 | — | FR-A-04 |
| バックアップ | 30 世代で自動消滅 | 匿名化後も最大 30 日はバックアップに残る旨をプライバシーポリシーに記載 | — | FR-S-08 |

匿名化は 1 トランザクションで行い、`customers_anonymized_clean` CHECK により部分的な匿名化をコミットできないようにする。ハウスキーピングは `features/notifications/retention.ts` の `runHousekeeping()` が保存期間ジョブ（`runRetention()`）の匿名化の後に実行し、失敗しても匿名化の結果には影響させない（ログは `errorFields()` の項目のみ）。v0.4 までは日次サマリーの送信後に実行していたが、サマリーの失敗で飛ばされうるため移した（SR-15）。

---

## 9. Phase 2 / 3 の拡張

| フェーズ | 追加 | Phase 1 で用意済みの拡張点 |
|---|---|---|
| 複数席（将来） | `resources(id, name)` テーブル、UI | `bookings.resource_id`・`time_blocks.resource_id`、EXCLUDE が `resource_id WITH =` を含む |
| Phase 2 チャット | `chat_threads(id, customer_id, channel, external_thread_id, access_token_hash, last_message_at)`、`chat_messages(id bigint, thread_id, sender, body, read_at, created_at)` | `customers.line_user_id`・`instagram_user_id`（UNIQUE, NULL） |
| Phase 2 顧客通知 | `notification_log.channel` に `line` / `email` を追加、`template` に `reminder` | `notification_log` の構造 |
| Phase 3 カルテ | `karte_records(id, customer_id, booking_id, visited_at, menu_id, body jsonb, created_at)`、`karte_photos(id, karte_id, object_key, consent_id)`。要配慮情報は別テーブル・別同意 | `consents.kind` に `health_notes`/`photo_karte`/`photo_sns` |
| 意図的重複（OI-11 は「Phase 1 は許容しない」に決定済み。クライアントが掛け持ちを求めた場合のみ） | `bookings.overlap_allowed boolean` を追加し、EXCLUDE を `WHERE (status IN (…) AND NOT overlap_allowed)` で張り直す | 制約は 0002 の 1 文で再作成可能 |
