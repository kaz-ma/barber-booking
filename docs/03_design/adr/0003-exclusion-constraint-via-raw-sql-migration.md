# ADR-0003: 二重予約防止の排他制約は Drizzle の手書き SQL マイグレーションで定義する

## 文書情報

| 項目 | 内容 |
|---|---|
| ID | ADR-0003 |
| 版 | v0.3 |
| 日付 | 2026-10-12 |
| ステータス | Accepted |
| 変更履歴 | v0.3（2026-10-12）: レビュー修正の反映。手書きの `0004_consent_ip_hash.sql` を追加し計 5 本（手書き 3 本＋生成 2 本）に（決定は変更なし）。v0.2（2026-10-12）: 実装との同期（決定は変更なし）。マイグレーションの実際の構成（手書き 2 本＋生成 2 本の 4 本）、`23P01` が通常経路ではなく最後の防衛線であること、DB 統合テストの所在を「決定」に追記。v0.1（2026-10-10）: 初版 |
| 決定者 | 開発者 |
| 関連要件 | FR-S-01, FR-C-10, FR-A-05, FR-A-06, CON-06, AT-03, KPI-02 |

## コンテキスト

- 1 席の予約で「同じ時間帯に有効な予約が 2 件存在しない」ことを、アプリのチェックではなく DB で保証したい（KPI-02: 二重予約 0 件）。
- PostgreSQL の範囲型には UNIQUE より排他制約が適切で、`EXCLUDE USING gist (resource_id WITH =, during WITH &&)` に `btree_gist` を組み合わせると席単位の重なりを禁止できる。`WHERE` 句で有効状態に限定できる。
- ORM は Drizzle を採用している（Prisma 8 は RC で大改訂中、バンドルも大きい）。Drizzle の Indexes & Constraints に `EXCLUDE` はなく、関連 Issue（#2813、#3388、範囲型 #2700）は open のまま。Prisma も `Unsupported("tstzrange")`＋マイグレーション編集が必要で、どちらも DSL では表現できない。

## 決定ドライバー

1. 同時送信でも二重予約が物理的に起きないこと（READ COMMITTED のまま）。
2. 開始時刻だけの UNIQUE では所要時間が可変になったとき防げない（18:00–19:30 と 19:00）。
3. スキーマの型安全（Drizzle）と、DSL 外の制約の共存。

## 検討した選択肢

| 選択肢 | 保証 | 実装 |
|---|---|---|
| A. `EXCLUDE USING gist` を手書き SQL マイグレーションで追加 | DB が保証（`23P01`） | `drizzle-kit generate --custom` に手書き |
| B. 開始時刻の UNIQUE | 所要時間可変で破綻 | DSL で可能 |
| C. `SELECT … FOR UPDATE` で確認してから INSERT | 新規行の競合に効かない | アプリ |
| D. SERIALIZABLE＋再試行 | 保証されるが `40001` の再試行ループが必要 | アプリ |
| E. アプリ側の重なりチェックのみ（Cal.com 型） | 競合で破綻しうる | アプリ |

## 決定

**A を採用する。**

```sql
-- drizzle/0002_constraints.sql（drizzle-kit generate --custom --name=constraints）
ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (resource_id WITH =, during WITH &&)
  WHERE (status IN ('confirmed', 'arrived', 'in_progress'));
```

- マイグレーションは次の 5 本で、`drizzle/meta/_journal.json` の順に `drizzle-kit migrate` が適用する（2026-10-12 時点）。手書き（custom）と生成を分け、生成側に手書きの SQL を混ぜない。
  - `0000_extensions.sql`（custom、手書き）: `btree_gist`・`pg_trgm`。表より先に作る。
  - `0001_init.sql`（`drizzle-kit generate`、`src/lib/db/schema.ts`・`auth-schema.ts` から）: ENUM・全テーブル・CHECK・通常インデックス・部分 UNIQUE。
  - `0002_constraints.sql`（custom、手書き）: `bookings_no_overlap`、相互参照の DEFERRABLE FK、`updated_at` トリガー。
  - `0003_auth.sql`（`drizzle-kit generate`）: Better Auth 1.7.7 との突き合わせで生じた追加分（索引 5 本と `auth_rate_limit`）。**追加のみ**で、0000〜0002 は書き換えない。
  - `0004_consent_ip_hash.sql`（custom、手書き）: `consents.ip`（inet）を `ip_hash`（HMAC の text）に改名・型変更し CHECK を追加（AGENTS.md 規則 5、SR-15）。既存の生 IP は SQL で HMAC に変換できないため破棄（公開前のデータのみ）。
- `tstzrange` 列は Drizzle の `customType` で宣言し（04_data_model.md 7 章）、半開区間 `[)` の CHECK と冪等性キーの部分 UNIQUE は DSL（`check()`、`uniqueIndex().where()`）で書く。
- 時間ブロック（`time_blocks`）は別テーブルで排他制約の外にあるため、予約・ブロック作成の両トランザクションで `pg_advisory_xact_lock(hashtext('calendar'), resource_id)` を取り、ロック下で相互の重なりを確認する（05_state_and_flows.md 2・4 章）。
- アプリは `23P01` を制約名で判別し `conflict: slot_taken`（顧客）／`conflict: overlap`（管理）／`conflict: undo_blocked`（Undo）に写像する。実装では advisory lock 下の再検証（顧客は空き計算 SQL、管理は重なり検索）で先に同じ結果を返すため、`23P01` が返るのはロックを経ない書き込みとの競合に限られる（最後の防衛線）。

運用ルール: `drizzle-kit push` を禁止し `migrate` のみ使う。DSL で書けない SQL を足すときは `npx drizzle-kit generate --custom --name=<name>` で新しい手書きファイルを作る。DB 統合テストで `pg_constraint` に `bookings_no_overlap` が存在すること（`features/availability/availability.db.test.ts`）と、`Promise.all` の同時 INSERT で片方が `23P01` になること・同時送信で 1 件だけ成功すること（`features/booking/booking.db.test.ts`）を検証する。

## 結果

良い点:

- アプリのバグや競合があっても二重予約は DB で拒否される。分離レベルは READ COMMITTED のままでよい。
- `resource_id` により将来の複数席に DDL 変更なしで対応できる。
- キャンセル済み行は `WHERE` で対象外になり、同じ枠を再予約できる。

悪い点:

- スキーマの一部が Drizzle のスナップショット外にあり、`push` が使えない。
- 意図的な重複（OI-11）を許す場合は制約の張り直し（`overlap_allowed` 列の追加）が必要。
- ブロックとの相互排他は DB 制約ではなく advisory lock に依存する（厳密化するなら `calendar_items` への統合）。

## 代替案の評価

- B・C・E: 競合または所要時間可変で二重予約を防げない。
- D: 保証は得られるが、1 席規模に対して再試行ループの複雑さが見合わない。
- `bookings` と `time_blocks` を `calendar_items(kind, during)` に統合し 1 本の排他制約で守る案: 厳密だが、手動予約がブロック内に入る運用（05 章 4 の「警告のみ」）と相性が悪いため Phase 1 は採らない。

## 関連

- 統合レポート『二重予約は EXCLUDE USING gist … で最終防衛する』『バリデーションは Zod 4 を共有し、ORM は Drizzle で EXCLUDE を生 SQL に書く』
- `09_gap_infra_tooling.md` §3.4、§4-5
- 04_data_model.md 3・7 章
