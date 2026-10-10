# ADR-0002: データベースは Neon Postgres Free を採用し、Supabase は代替に留める

## 文書情報

| 項目 | 内容 |
|---|---|
| ID | ADR-0002 |
| 版 | v0.1 |
| 日付 | 2026-10-10 |
| ステータス | Accepted |
| 決定者 | 開発者 |
| 関連要件 | FR-S-01, FR-S-02, FR-S-08, FR-S-13, NFR-AV-02, NFR-MG-02, NFR-PF-06, CON-03, 11 章 |

## コンテキスト

- 二重予約防止に `tstzrange`＋`EXCLUDE USING gist`（`btree_gist`）が必要で、素の PostgreSQL であることが前提（ADR-0003）。
- 無人運用（オーナーは DB を触らない）で、休業期間に DB が止まると予約サイトが落ちる。
- Vercel Postgres は終了し Neon へ移行済み。Vercel Marketplace から Neon を入れると `DATABASE_URL` が自動注入され、Preview ごとに DB ブランチが作られる。

## 決定ドライバー

1. `btree_gist`・排他制約が使えること。
2. 一定期間アクセスがなくても停止（pause）しないこと。
3. 無料枠で数年分の予約データが収まること。
4. Preview／staging の DB 分離が容易なこと。
5. 将来の移行（`pg_dump`/`pg_restore`）が容易なこと。

## 検討した選択肢

| 選択肢 | 無料枠 | 停止 | 排他制約 | バックアップ | 付帯機能 |
|---|---|---|---|---|---|
| A. Neon Free（Marketplace） | 100 CU-h/月、1 GB/プロジェクト | 5 分で scale to zero（再開数百 ms）、pause なし | 可 | スケジュールなし、履歴 6 時間 | Preview ブランチ |
| B. Supabase Free | DB 500 MB | 1 週間無通信で pause（警告メール、1 年以内に Resume 可） | 可 | 自動なし | Realtime、Auth、Storage |
| C. Turso | — | — | 不可（SQLite） | — | — |
| D. PlanetScale | 無料枠なし | — | 不可（MySQL） | — | — |

## 決定

**A（Neon Free、Vercel Marketplace 経由、リージョン `aws-ap-northeast-1`）を採用する。**

- アプリは `DATABASE_URL`（プール接続）、マイグレーションとバックアップは `DATABASE_URL_UNPOOLED` を使う。
- ドライバは `pg`（node-postgres）の Pool。対話的トランザクション（advisory lock → 再検証 → INSERT）を 1 接続で行うため HTTP ドライバは使わない。
- 冷起動（数百 ms）は `<Suspense>` のスケルトンで吸収する（NFR-AV-02）。
- バックアップは GitHub Actions の日次 `pg_dump`（08_security.md 10 章）で補う。
- Supabase 固有機能は使わず、DB アクセスは `src/lib/db` に閉じる（NFR-MG-02）。

## 結果

良い点:

- pause がなく無人運用に強い。排他制約が使える。Preview ごとの DB 分離が自動。
- 素の Postgres＋SQL マイグレーションのため、Supabase や他の Postgres へ `pg_dump`/`pg_restore` で移れる。

悪い点・受容するリスク:

- スケジュールバックアップがない（GitHub Actions で代替）。
- 管理 PWA の可視時ポーリングがコンピュートを起こし続ける。1 日 10 時間可視で約 75 CU-h と見積もり、100 CU-h に対して余裕は小さい。非表示時は停止し、月次で使用量を確認する。超過時は Neon Launch（従量）へ。
- Realtime がないため、管理画面の更新はポーリング（20 秒）で行う（ADR-0007）。

## 代替案の評価

- B（Supabase）: Realtime・Storage は Phase 2/3 で魅力だが、pause と 500 MB が Phase 1 の無人運用に不利。顧客チャットを早期に出す決定をした場合のみ移行を再検討する（Pro $25/月で pause 解消）。
- C・D: 排他制約が使えず要件を満たさない。

## 関連

- 統合レポート『DB は Neon Free を Vercel Marketplace から入れ、Supabase はチャットを早期化する場合の代替にする』
- `09_gap_infra_tooling.md` §3.1–3.2
- 04_data_model.md 7 章（DZ-05）
