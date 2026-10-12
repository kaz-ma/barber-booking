# ADR 一覧（Architecture Decision Records）

## 文書情報

| 項目 | 内容 |
|---|---|
| ID | DES-ADR |
| 版 | v0.4 |
| 日付 | 2026-10-12 |
| 変更履歴 | v0.4（2026-10-12）: レビュー修正の反映。ADR-0008 を Accepted（実装済み）に、ADR-0009 を Node `>=22.13.0`・CI の E2E・Postgres の digest 固定に、ADR-0005 の日付ライブラリを ADR-0009 への参照に、ADR-0003 のマイグレーションを 5 本に更新。v0.3（2026-10-12）: 実装との同期。ADR-0009（TypeScript 6 と pg ドライバ）を追加、ADR-0003・0006・0007 に実装の詳細を追記（決定は変更なし）。v0.2（2026-10-10）: ADR-0006 の改訂（フォールバック確定）を反映。OI-11・OI-12・OI-19 の決定に伴い「今後 ADR 化する候補」を更新 |
| 関連要件 | PRE-07（統合レポートの判断表を既定とし、変更は ADR に記録する）、CON-08 |

## 書式

MADR を簡略化した次の見出しで、1 決定 1 ファイル（`NNNN-kebab-case-title.md`）とする: 文書情報（ID・版・日付・ステータス・決定者・関連要件）／コンテキスト／決定ドライバー／検討した選択肢／決定／結果（良い点・悪い点）／代替案の評価／関連。

ステータス: `Proposed`（提案中）→ `Accepted`（採用）→ `Superseded by ADR-NNNN`（置換）／`Deprecated`（廃止）。決定を変える場合は既存 ADR を書き換えず、新しい ADR を追加して旧 ADR のステータスを更新する。

## 一覧

| ID | タイトル | ステータス | 主な関連要件 |
|---|---|---|---|
| [ADR-0001](0001-hosting-vercel-hobby-with-migration-path.md) | Phase 1 は Vercel Hobby、Pro／Cloudflare へ環境変数と DNS だけで移れる設計 | Accepted | PRE-08, CON-02, FR-S-10, OI-18 |
| [ADR-0002](0002-database-neon-over-supabase.md) | DB は Neon Free、Supabase は代替 | Accepted | FR-S-01, NFR-MG-02 |
| [ADR-0003](0003-exclusion-constraint-via-raw-sql-migration.md) | 排他制約は Drizzle の手書き SQL マイグレーションで定義（実装は手書き 3 本＋生成 2 本の 5 本） | Accepted（2026-10-12 追記） | FR-S-01, CON-06 |
| [ADR-0004](0004-server-actions-for-booking.md) | 書き込みは Server Actions、公開 REST API は作らない | Accepted | FR-C-10, NFR-SC-02 |
| [ADR-0005](0005-i18n-always-prefixed-asia-tokyo.md) | next-intl 常時接頭辞（/ja・/en）、Asia/Tokyo 固定（日時処理は ADR-0009 の `Intl` のみ） | Accepted（2026-10-12 追記） | FR-C-13, NFR-EN-07 |
| [ADR-0006](0006-auth-better-auth-passkey-single-admin.md) | Better Auth＋パスキー、永続 Cookie 30 日ローリング（`__Host-bb.*`）、フォールバックはアプリ内ワンタイムコード（Server Action のみ、Resend HTTP API） | Accepted（2026-10-10 改訂: OI-12 決定済み、2026-10-12 追記） | FR-A-01, NFR-SC-01 |
| [ADR-0007](0007-web-push-best-effort-declarative-payload.md) | Web Push は best-effort＋ポーリング＋日次サマリー、Declarative 形式（氏名なし、`app_badge` は両位置） | Accepted（2026-10-12 追記） | FR-A-09〜12, FR-S-03 |
| [ADR-0008](0008-no-customer-snapshot-in-bookings.md) | 予約行に顧客スナップショットを持たない | Accepted（2026-10-12、実装済み） | 10.1, 10.3 |
| [ADR-0009](0009-typescript-6-and-pg-driver.md) | TypeScript 6 と pg ドライバの採用（設計からの変更）。Node `>=22.13`（本番・CI は 24）、happy-dom、E2E はスクリプト（CI で実行）、CI の Postgres は digest 固定、日時は `Intl` のみ | Accepted（2026-10-12 追記） | NFR-EN-01, NFR-EN-02, NFR-SC-08 |

## 今後 ADR 化する候補

| 候補 | 契機 |
|---|---|
| 手動予約の意図的重複の許容（`overlap_allowed`） | OI-11 は「Phase 1 は許容しない」に決定済み（2026-10-10）。クライアントが掛け持ちの運用を求めた場合に起票 |
| ホスティング移行（Pro または Cloudflare） | Hobby の警告・停止、同梱量 80% 到達、有償化（ADR-0001 を Superseded に） |
| オフライン表示のための Serwist 導入 | FR-A-17（Should）の実装判断 |
| Phase 2 の通知チャネル（LINE／メール） | Phase 2 合意 |
