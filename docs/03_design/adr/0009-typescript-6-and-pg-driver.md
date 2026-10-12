# ADR-0009: TypeScript 6 と pg ドライバの採用（設計からの変更）

## 文書情報

| 項目 | 内容 |
|---|---|
| ID | ADR-0009 |
| 版 | v0.2 |
| 日付 | 2026-10-12 |
| ステータス | Accepted |
| 変更履歴 | v0.2（2026-10-12）: レビュー修正の反映。Node の下限を `>=22.13.0` に引き上げ（v0.1 の「悪い点」で保留した事項を決定）、E2E を CI に組み込み（Playwright 1.56.1 を CI で一時導入）、CI の Postgres サービスコンテナを digest で固定。v0.1（2026-10-12）: 初版（実装との同期で、要件定義書・設計書の想定と異なるツールチェーンを記録） |
| 決定者 | 開発者 |
| 関連要件 | NFR-EN-01, NFR-EN-02, NFR-OP-04, NFR-OP-07, NFR-SC-08, PRE-07, CON-08 |

## コンテキスト

- 要件定義書 NFR-EN-02 は技術スタックを「Next.js 16.x、React 19、**TypeScript 7**、…、Vitest 5、**Playwright 1.64**、Biome 2.5、ESLint 10」、NFR-EN-01 は「Node 24 LTS」としていた（統合レポート『バージョンと構成は 2026 年 10 月の実測値で固定する』）。設計書 v0.3 は品質ゲートを `tsc --noEmit`（TS 7）、`engines.node: ">=24 <25"`（08_security.md 11 章）、`domain/time.ts` を `temporal-polyfill` で実装する前提にしていた。
- DB ドライバは ADR-0002・04_data_model.md DZ-05 で `pg`（node-postgres）の Pool に決めていたが、調査ノート（`09_gap_hosting_alternatives.md`）は Vercel・Cloudflare での `@neondatabase/serverless`（HTTP）も候補に挙げていた。
- 実装着手時（2026-10-12）に次が分かった。
  - Lint は `eslint-config-next` 16.4.0 が依存する `typescript-eslint` 8.x（`@typescript-eslint/parser` 8.71.2 など）を使う。その peer 範囲は `typescript >=4.8.4 <6.1.0` で、TypeScript 7.0.2 は範囲外になる（`eslint-config-next` 自身も開発時は TypeScript 6.0.2 を使っている）。
  - リポジトリは `save-exact`・`engine-strict`・`npm ci`（AGENTS.md 規則 8）で運用し、peer の不一致を `--legacy-peer-deps` などで黙らせない方針である。
  - 開発に使うコンテナの Node は 22（22.22）で、本番（Vercel）と CI は Node 24 を使える。依存の `engines` の下限は Vite 8 が `^20.19.0 || >=22.12.0`、Vitest 5 が `^22.12.0 || ^24.0.0 || >=26.0.0`、Next.js 16.4 が `>=20.9.0`。
  - 予約確定は 1 接続上の対話的トランザクション（advisory lock → 再検証 → INSERT）を必要とし、ローカル開発はネイティブの Postgres クラスタ（`scripts/db-local.sh`）で行う。

## 決定ドライバー

1. `npm ci`・`engine-strict`・exact version の運用を崩さずに、型検査と型情報付きの lint（Next の推奨ルール＋境界ルール）を CI で回せること。
2. 開発環境（Node 22）と本番・CI（Node 24）の両方で同じ手順が動くこと。
3. DB ドライバを 1 つにして、ローカル・テスト・本番で同じトランザクション意味論を保つこと（AGENTS.md 規則 1 の並行性モデル）。
4. 依存を増やさないこと（サプライチェーンの面を小さく保つ。NFR-SC-08）。

## 検討した選択肢

| 観点 | 採用 | 退けた案 |
|---|---|---|
| TypeScript | **6.0.3**（`tsc --noEmit`、`next typegen` と組み合わせ） | 7.0（Go 実装）: `typescript-eslint` の peer 範囲外で、`npm ci` が依存解決で失敗するか、`--legacy-peer-deps` で警告を握りつぶすことになる。Next の `experimental.useTypeScriptCli` で型検査だけ 7 にする案も、lint 側は 6 系が必要で 2 系統の管理になる |
| Node | `engines.node: ">=22.13.0"`（v0.1 は `>=22.12.0`。ESLint 10 の `engines` に合わせ v0.2 で引き上げ）、`.nvmrc` は `24`（CI の `setup-node` は `node-version-file: .nvmrc`） | `">=24 <25"`: 開発コンテナ（Node 22）で `engine-strict` によりインストールできない |
| DB ドライバ | **`pg` 8.x の Pool のみ**（`drizzle-orm/node-postgres`、`@vercel/functions` の `attachDatabasePool`） | `@neondatabase/serverless`（HTTP `neon()`）: 対話的トランザクションに使えず、ローカルのネイティブ Postgres とも挙動が異なる。読み取りだけ HTTP にする併用案は、ドライバ 2 つ・接続設定 2 系統になる |
| DOM テスト環境 | **happy-dom**（Vitest の `dom` プロジェクト） | jsdom: 機能は十分だが重い。Testing Library の範囲では happy-dom で足りる |
| E2E | **Playwright ライブラリを直接使うスクリプト**（`test/e2e/run.mjs`。DB 作成 → `next build` → `next start` → シナリオ）。Playwright は環境のもの（`PLAYWRIGHT_MODULE` で差し替え）を使い、依存に加えない。CI でも `npm install --no-save --ignore-scripts playwright@1.56.1` で一時導入して同じスクリプトを実行する（v0.2） | `@playwright/test` を devDependencies に追加: 依存とブラウザの取得・管理が増える。CI に組み込んだ v0.2 でも、ライブラリの一時導入で足りるため採らない |
| 日時処理 | `Intl.DateTimeFormat`（IANA 名 `Asia/Tokyo`）と `YYYY-MM-DD` 文字列の暦計算（`domain/time.ts`・`domain/jst-format.ts`） | `temporal-polyfill`: 必要な処理（JST の暦日・月・オフセット取得）が `Intl` で足り、クライアントに持ち込む量も減る |

## 決定

- **TypeScript は 6.0 系（6.0.3）**を使う。`npm run typecheck` は `next typegen && tsc --noEmit`。TypeScript 7 への移行は、`typescript-eslint`（`eslint-config-next`）が 7 を peer 範囲に含めた時点で、Renovate の major 更新（Dependency Dashboard で承認）として行う。
- **Node は `engines.node: ">=22.13.0"`、本番・CI は `.nvmrc` の 24 LTS**。`engine-strict` は維持する（v0.2 で下限を 22.12.0 から引き上げ）。
- **DB ドライバは `pg`（node-postgres）の Pool だけ**を使う（ADR-0002・DZ-05 の再確認）。Neon は pooled 接続文字列（`-pooler`）、ローカルはネイティブのクラスタ、テストは `TEST_DATABASE_URL`。接続ごとに `TimeZone=UTC` を指定する（DZ-02）。`@neondatabase/serverless` は使わない（ホスティングを Cloudflare に移す場合も、まず Hyperdrive 経由の `pg` を検討する）。
- **DOM テストは happy-dom**、**E2E は `test/e2e/run.mjs`**（v0.2 で CI に組み込み: build の後に専用 DB・`NODE_ENV=production` の `next start`・Turnstile の siteverify スタブで実行し、失敗時はスクリーンショットを保存）、**日時処理は `Intl` のみ**とする。
- CI の Postgres サービスコンテナは `postgres:16@sha256:…`（multi-arch index の digest）で固定し、Renovate が更新する（v0.2）。
- 要件定義書 NFR-EN-01/02 との差分は 00_overview.md 7.1 の G-10 に記録する（要件定義書は v0.7 で本 ADR に合わせて更新済み）。

## 結果

良い点:

- `npm ci`・`engine-strict`・exact version の運用のまま、型検査・lint・テスト・ビルドが CI（Node 24）と開発環境（Node 22）の両方で通る。
- ドライバが 1 つで、ローカル・テスト・本番のトランザクションの意味論（READ COMMITTED＋advisory lock＋EXCLUDE）が一致する。
- 依存が少ない（`temporal-polyfill`・`@neondatabase/serverless`・`@playwright/test` を持たない）。

悪い点:

- TypeScript 7 の型検査の速さは得られない（現規模では問題にならない）。
- v0.1 の下限 22.12.0 は ESLint 10.12 の `engines`（`^20.19.0 || ^22.13.0 || >=24`）より低く、Node 22.12.x では `engine-strict` によりインストールが失敗した。v0.2 で `>=22.13.0` に上げて解消した。
- E2E は v0.2 で CI に入ったが、axe・Lighthouse は未導入（AT-25 などの自動確認は一部残る）。Playwright は依存ではないため、CI で使う版（1.56.1）はワークフローで管理する。
- サーバーレスで Pool を使うため、接続数は Neon の pooler（PgBouncer）と `attachDatabasePool`、`max: 5`・`idleTimeoutMillis: 10000` で抑える必要がある（ADR-0002 の監視項目のまま）。

## 代替案の評価

- TypeScript 7＋`--legacy-peer-deps`: peer 不一致を恒常的に許すことになり、ほかの依存の不一致も見逃す。採らない。
- ESLint の型情報付きルールを外して TypeScript 7 にする: Next の推奨ルールと境界ルールの一部を失う。採らない。
- Node 24 のみ（`">=24"`）: 開発コンテナの更新が必要。本番・CI はすでに 24 なので、開発環境を 24 に揃えた時点で下限を上げてよい。

## 関連

- ADR-0002（Neon、ドライバ `pg`）、ADR-0003（並行性モデル）、ADR-0005（日付ライブラリに `temporal-polyfill` を挙げていた部分を本 ADR の「日時は `Intl` のみ」で置き換える）、AGENTS.md「Stack」・規則 1・規則 8
- 00_overview.md 3.1・6 章・7.1（G-10）、04_data_model.md 7 章（DZ-02・DZ-05）、08_security.md 11 章
- 要件定義書 NFR-EN-01・NFR-EN-02、調査ノート `06_code_quality_security.md`・`09_gap_hosting_alternatives.md`
