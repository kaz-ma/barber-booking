# ADR-0003: 二重予約防止の排他制約は Drizzle の手書き SQL マイグレーションで定義する

## 文書情報

| 項目 | 内容 |
|---|---|
| ID | ADR-0003 |
| 版 | v0.1 |
| 日付 | 2026-10-10 |
| ステータス | Accepted |
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

- `btree_gist` は `drizzle/0000_extensions.sql`（custom）で先に作成する。
- `tstzrange` 列は Drizzle の `customType` で宣言し（04_data_model.md 7 章）、半開区間 `[)` の CHECK と冪等性キーの部分 UNIQUE は DSL（`check()`、`uniqueIndex().where()`）で書く。
- 時間ブロック（`time_blocks`）は別テーブルで排他制約の外にあるため、予約・ブロック作成の両トランザクションで `pg_advisory_xact_lock(hashtext('calendar'), resource_id)` を取り、ロック下で相互の重なりを確認する（05_state_and_flows.md 2・4 章）。
- アプリは `23P01` を制約名で判別し `conflict: slot_taken`（顧客）／`conflict: overlap`（管理）に写像する。

運用ルール: `drizzle-kit push` を禁止し `migrate` のみ使う。DB 統合テストで `pg_constraint` に `bookings_no_overlap` が存在することと、`Promise.all` の同時 INSERT で片方が `23P01` になることを検証する。

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
