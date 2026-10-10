# 06. コード品質・テスト・アクセシビリティ・パフォーマンス・セキュリティ（Next.js + TypeScript 小規模本番アプリ向けエンジニアリング標準）

> 調査日: 2026-10-10。対象: バイリンガル(JP/EN)の理容室予約サイト + 管理PWA、Next.js App Router + Postgres、Vercel 配備、開発者1名 + AI 支援で長期保守。
> 調査環境の制約: WebFetch 不可・一般 Web ホスト（nextjs.org, vercel.com, owasp.org, web.dev, ppc.go.jp, biomejs.dev 等）はプロキシで遮断されたため、**一次資料は GitHub 上の公式リポジトリ（raw.githubusercontent.com）と npm レジストリから取得**した。引用 URL は原則として公開ドキュメントの正規 URL を記載し、内容は対応する GitHub ソース（例: `vercel/next.js/docs/`, `OWASP/Top10`, `OWASP/CheatSheetSeries`, `w3c/wcag`, `mdn/content`）で確認した。Web 検索は途中で予算上限に達したため、Vercel WAF や個人情報保護法の最新改正など一部は「Gaps」に明記した。

## 0. 推奨ツールと現行バージョン（2026-10-10 時点 `npm view <pkg> version` 実測）

### Takeaway
2026年10月時点の最新安定版は Next.js 16.4 / React 19.3 / TypeScript 7.0（Go ネイティブ版）/ Zod 4.6 / Vitest 5.0 / ESLint 10.12 / Biome 2.5 / Playwright 1.64 / Drizzle 0.45 / Prisma 7.10（8.0 は RC）。Node.js は 24 が Active LTS（22 は Maintenance）。

### Cited Findings
- `npm view` 実測値（2026-10-10）: next 16.4.0 / react 19.3.0 / typescript 7.0.2 / zod 4.6.5 / drizzle-orm 0.45.4 / drizzle-kit 0.31.11 / @prisma/client 7.10.0 / prisma 8.0.0-rc.22 / @t3-oss/env-nextjs 0.13.11 / vitest 5.0.3 / @testing-library/react 16.3.3 / @playwright/test 1.64.0 / eslint 10.12.0 / typescript-eslint 8.71.1 / @biomejs/biome 2.5.15 / prettier 3.9.9 / husky 9.1.7 / lint-staged 17.6.0 / lefthook 2.2.1 / @commitlint/cli 21.2.3 / @upstash/ratelimit 2.2.0 / @upstash/redis 1.39.0 / @marsidev/react-turnstile 1.6.1 / date-fns 4.4.0 / dayjs 1.11.23 / luxon 3.7.2 / temporal-polyfill 1.0.5 / @js-temporal/polyfill 0.5.1 / next-intl 4.14.9 / @axe-core/playwright 4.13.0 / react-hook-form 7.89.0 / @hookform/resolvers 5.9.1 / better-auth 1.7.7 / @auth/core 0.41.3 / msw 3.0.3 / knip 6.41.0 / happy-dom 20.14.6 / jsdom 30.1.2 / tailwindcss 4.3.3 — [npm registry](https://www.npmjs.com/)（`npm view` 出力）
- リリース日（`npm view <pkg> time`）: next 16.4.0 = 2026-10-06、typescript 7.0.2 = 2026-07-08（6.0.2 = 2026-03-23）、vitest 5.0.0 = 2026-09-03、eslint 10.12.0 = 2026-10-02、prisma 7.10.0 = 2026-08-25、drizzle-orm 0.45.4 = 2026-10-08、date-fns 4.4.0 = 2026-05-29、temporal-polyfill 1.0.1 = 2026-06-19、@playwright/test 1.64.0 = 2026-10-07 — [npm registry](https://www.npmjs.com/)
- TypeScript 7 は Go によるネイティブ移植（"native port"）として完了。旧ステージングリポジトリ typescript-go は「TypeScript 7.0 リリースのための移植プロセスは完了」「7.0 RC 以降はコマンド名が `tsc`」と記載 — [microsoft/typescript-go README](https://github.com/microsoft/typescript-go)
- Next.js 16 の最低要件: Node.js 20.9+（18 は非対応）、TypeScript 5.1+。`next dev`/`next build` は Turbopack がデフォルト（Webpack は `--webpack` でオプトアウト）。同期的 `params`/`searchParams`/`cookies()`/`headers()` アクセスは完全撤廃（async のみ） — [Next.js: Upgrading to Version 16](https://nextjs.org/docs/app/guides/upgrading/version-16)
- Next.js のサポートブラウザ: Chrome 111+ / Edge 111+ / Firefox 111+ / Safari 16.4+ — [Next.js: Supported Browsers](https://nextjs.org/docs/architecture/supported-browsers)
- Node.js リリース表: 22.x = Maintenance LTS（EOL 2027-04-30）、24.x = Active LTS（Maintenance 開始 2026-10-20、EOL 2028-04-30）、26.x = Current（LTS 開始 2026-10-28） — [nodejs/Release](https://github.com/nodejs/Release)
- ESLint 10 は Node.js 20.19+/22.13+/24+ のみサポート、旧 `.eslintrc` 形式は完全非対応、`eslint:recommended` に `no-unassigned-vars`/`no-useless-assignment`/`preserve-caught-error` を追加。`@eslint/v9-to-v10-*` codemod あり — [ESLint: Migrate to v10.0.0](https://eslint.org/docs/latest/use/migrate-to-10.0.0)
- Vitest は Vite >= 6.4.0 かつ Node >= 22.12.0 を要求 — [Vitest: Getting Started](https://vitest.dev/guide/)
- Prisma 8 は RC（README 記載: 「8.0.0 final は 4〜8 週間以内」「Node.js 24 以上が前提」「TypeScript による書き直し、拡張可能・AI エージェント向け」）。Prisma 7 は `v7` ブランチで引き続きサポート — [prisma/prisma README](https://github.com/prisma/prisma)

### Inferences
- 新規プロジェクトは Node 24 LTS + Next 16.x + TS 7 + Zod 4 + Vitest 5 + ESLint 10 (flat config) で開始し、`engines` と `.nvmrc`/`.node-version` で固定するのが安全。
- Prisma は 7→8 の大規模移行期にあるため、1人保守の予約システムでは移行コストの小さい Drizzle（Postgres の排他制約・範囲型をそのまま扱える）を推す根拠になる（後述）。

### Gaps
- 各パッケージの「現在のリリース日」は npm の `time` から確認できたが、変更内容（changelog）は GitHub Releases ページが取得不可のため未確認。

---

## 1. クリーンコード原則（TypeScript/React/App Router）

### Takeaway
Next.js 公式は「プロジェクト構成に非意見的」だが、ルートグループ `(group)`・プライベートフォルダ `_folder`・`src/` を提供しており、bulletproof-react 流の `features/` 分割（機能間 import 禁止、バレルファイル回避）と組み合わせるのが 2026 年の定番。サーバー/クライアント境界は「`"use client"` はモジュールグラフの境界」「props はシリアライズ可能」「`server-only` で環境汚染を防ぐ」「Context は children を受け取る Client Provider で」「エラーバウンダリは Client Component」という公式ルールに従う。

### Cited Findings
**フォルダ構成**
- Next.js は「プロジェクトファイルの整理と同居（colocate）について非意見的（unopinionated）」で、整理のための機能として route groups `(group)`、private folders `_folder`（`app/blog/_components/Post.tsx` は「ルーティング対象外、UI ユーティリティの安全な置き場」）、`src` フォルダを提供 — [Next.js: Project structure and organization](https://nextjs.org/docs/app/getting-started/project-structure)
- 特殊ファイル（layout/page/loading/not-found/error/global-error/route/template/default）は階層順に入れ子で描画される — 同上
- bulletproof-react: `src/{app,assets,components,config,features,hooks,lib,stores,testing,types,utils}` 構成。「スケーラビリティと保守のため、ほとんどのコードを `features` 内に整理」「各 feature は `api/assets/components/hooks/stores/types/utils` を必要なものだけ持つ」「以前はバレルファイルを推奨していたが、Vite のツリーシェイキングに問題を起こすため、直接 import を推奨」「feature 間の import は避け、アプリ層で合成する。ESLint `import/no-restricted-paths` で禁止できる」 — [bulletproof-react: Project Structure](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md)
- Next.js のバンドル最適化ガイドは `optimizePackageImports` やバレルファイルの影響を扱い、Turbopack 統合の `next analyze`（Bundle Analyzer、v16.1+）でモジュールグラフを検査できる — [Next.js: Package Bundling](https://nextjs.org/docs/app/guides/package-bundling)

**サーバー/クライアント境界**
- `"use client"` は「サーバーとクライアントのモジュールグラフの境界」を宣言する。境界内で import されるモジュールはすべてクライアントバンドルに含まれる。Client Component に渡す props は「React によってシリアライズ可能でなければならない」 — [Next.js: Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- Client Component は「サーバーでもブラウザでも実行される」（表: Server Component = server Yes / browser No、Client Component = Yes / Yes）。「Server Component は秘密情報やサーバー専用データを直接読めるため、Client Component に何を渡すかを意図的に決めること」。`<details>`、Server Function を `action` に渡した `<form>`、`<video controls>` などブラウザ標準の挙動なら Client Component は不要。「時間とともに変化するブラウザ状態（制御された input、ライブフィルタ、ドラッグハンドル）」が必要なときだけ Client Component にする — [Next.js: The Server and Client Boundary](https://nextjs.org/docs/app/guides/server-and-client-boundary)
- React Context は Server Component では使えない。`children` を受け取る Client Component の Provider を作り、ルートレイアウト（Server Component）で描画する。サーバーで取得したデータを Context 経由で `use()` で読む方法もある — [Next.js: Server and Client Components > Context providers](https://nextjs.org/docs/app/getting-started/server-and-client-components#context-providers)
- サードパーティのクライアント専用コンポーネントは自前の `"use client"` ラッパーで包む — 同上 #third-party-components
- 環境汚染防止: `import 'server-only'` をサーバー専用モジュールに付けるとクライアントから import した時点でビルドエラー。`client-only` も存在。Next.js は内部でこれらを処理するため npm パッケージの中身は使われない（lint の都合で install してもよい）。`noUncheckedSideEffectImports` 向けの型宣言も Next.js が提供 — 同上 #preventing-environment-poisoning
- Server Component からデータを Client Component にストリーミングするには、Server Component で開始した Promise を props で渡し、Client で `use()` で読む（Suspense がフォールバックを表示） — [Next.js: Server and Client Boundary > How data enters the tree](https://nextjs.org/docs/app/guides/server-and-client-boundary)

**エラーバウンダリ**
- `error.js` はルートセグメントと子を React Error Boundary で包む（`'use client'` 必須）。`loading.js`/`not-found.js`/`page.js`/子 `layout.js` を包むが同階層の `layout.js` は包まない。本番では Server Component 由来のエラーは「汎用メッセージ + `error.digest`」になり、digest でサーバーログと突合する。`retry()`（再フェッチして再描画）と `reset()` がある。ルートレイアウトのエラーは `global-error.jsx` で扱い、これは独自の `<html>`/`<body>` を定義しグローバル CSS を含まない — [Next.js: error.js](https://nextjs.org/docs/app/api-reference/file-conventions/error)
- 期待されるエラー（フォームのバリデーション失敗など）は `throw` せず「戻り値としてモデル化」し `useActionState` で表示する。`<p aria-live="polite">{state.message}</p>` の例 — [Next.js: Error Handling](https://nextjs.org/docs/app/getting-started/error-handling)

**型付き環境変数**
- `@t3-oss/env-nextjs` は `createEnv({ server, client, runtimeEnv })` で Zod（または Standard Schema 対応の任意バリデータ）によりビルド時に検証。`runtimeEnv` は Next.js のバンドル都合で strict（全キーを明示的に分割代入）。「サーバー変数のスキーマもクライアントに同梱されるため、変数名自体が機密ならファイルを server/client に分割」。Next.js 16+ では `next.config.ts` 冒頭で `import "./app/env"` するだけでビルド時検証（<16 は jiti が必要）。ESM-only、TypeScript 5.0+ 必須 — [t3-env: Next.js](https://env.t3.gg/docs/nextjs)
- Next.js: 「`NEXT_PUBLIC_` 接頭辞の変数のみブラウザに公開される（ビルド時にインライン化）」「`.env*` は `.gitignore` に入れる」「`NODE_ENV=test` では `.env.local` は読み込まれない（テストの再現性のため）」 — [Next.js: Environment Variables](https://nextjs.org/docs/app/guides/environment-variables)
- 「秘密鍵は環境変数に置くが、`process.env` にアクセスするのは Data Access Layer だけにする」 — [Next.js: Data Security](https://nextjs.org/docs/app/guides/data-security)

**型安全なルーティング・TS 設定**
- `next typegen`/`next dev`/`next build` が `PageProps<'/blog/[slug]'>`・`LayoutProps`・`RouteContext` のグローバル型ヘルパーを生成。`typedRoutes: true` で `Link` の `href` が型検査される。`experimental.useTypeScriptCli` で TypeScript 7 の CLI 型チェッカーを使う設定がある — [Next.js: TypeScript](https://nextjs.org/docs/app/api-reference/config/typescript)

**AI 支援開発との関係（構成に影響）**
- Next.js 16.2+ は `node_modules/next/dist/docs/` にバージョン一致のドキュメントを同梱し、16.3+ では `next dev` が `AGENTS.md` に管理ブロック（"This is NOT the Next.js you know ... Read the relevant guide in node_modules/next/dist/docs/"）を自動生成。Vercel の評価では「同梱ドキュメント参照で 100% パス、Skill ベースは最大 79%」 — [Next.js: AI Coding Agents](https://nextjs.org/docs/app/guides/ai-agents)

### Inferences
- 本プロジェクト向け推奨構成（公式ルール + bulletproof-react を App Router に適用）:
  ```
  src/
    app/                      # ルーティング専用。page/layout は薄く、features を合成
      (public)/[locale]/...   # 予約サイト（route group で URL を変えず分割）
      (admin)/admin/...       # 管理 PWA
      api/...                 # Route Handlers（Webhook 等）
    features/
      booking/                # 予約: actions.ts('use server'), schema.ts(zod), queries.ts('server-only'), components/, __tests__/
      availability/           # 空き枠ロジック(純粋関数) + contract tests
      customers/              # 顧客台帳（PII）
    components/ui/            # 汎用 UI（shadcn/ui 等）
    lib/                      # db.ts, auth.ts, env.ts, i18n.ts, rate-limit.ts
    data/ or features/*/queries.ts   # Data Access Layer（server-only）
  ```
- 命名: ファイルは kebab-case、React コンポーネントは PascalCase、Server Action は動詞 + `Action` 接尾辞（公式例 `deletePostAction`）、DAL 関数は `getXxxDTO`。関数は「1 画面 1 責務」程度の小ささを目標にし、`"use server"` ファイルは DAL に委譲して薄く保つ（公式推奨）。
- prop drilling 回避: まず Server Component での合成（children/slot パターン）と `cache()` 済み DAL の再呼び出し（公式: 「値を渡さずキャッシュ済みの値を読み直す」）を優先し、Context は Client の UI 状態（テーマ、ステップフォームの進行）に限定する。
- 機能間 import の禁止は ESLint `import/no-restricted-paths` か Biome の `noRestrictedImports`、または `dependency-cruiser` で機械的に担保する。

### Gaps
- Zenn/Qiita の「Next.js ディレクトリ構成 2025/2026」記事は Web 検索結果に要約しか現れず、本文は取得不能（zenn.dev 遮断）。日本語コミュニティの具体的な構成案は未確認。
- Kent C. Dodds「Colocation」、Josh Comeau、Matt Pocock のブログ記事は取得不能（kentcdodds.com リポジトリ上のパスも 404）。本節の「原則」は公式ドキュメントと bulletproof-react に基づく。

---

## 2. バリデーションと型安全性（Zod 共有スキーマ、Drizzle vs Prisma、Branded 型）

### Takeaway
Zod 4 を「フォーム（react-hook-form + @hookform/resolvers）とサーバーアクション」で共有し、Server Action は常に `safeParse` → 失敗は戻り値で返す。ORM は Postgres の排他制約（`EXCLUDE USING GIST`）や `tstzrange` をそのまま書ける Drizzle が予約ドメインと相性が良く、Prisma は 7→8 移行期（8 は RC、Node 24 必須）。ID は Zod の `.brand()` で名義型化する。

### Cited Findings
**Zod 4**
- Zod 4 の変更: `.email()` など文字列フォーマットは `z.email()`/`z.url()` のトップレベル関数に移行（旧メソッドは非推奨）、`.flatten()`/`.format()` は非推奨で `z.treeifyError()` を使う、`invalid_type_error`/`required_error`/`errorMap` は削除され `error` パラメータに統一、`.strict()`/`.passthrough()`/`.merge()`/`z.nativeEnum()` 非推奨、`.int()` は安全整数のみ — [Zod 4 Changelog](https://zod.dev/v4/changelog)
- 文字列フォーマット: `z.e164()`（E.164 電話番号）、`z.iso.date()`（YYYY-MM-DD）、`z.iso.time()`（HH:MM[:SS]）、`z.iso.datetime()`（デフォルトではオフセット不可、`{ offset: true }`/`{ local: true }`/`precision` 指定可） — [Zod API](https://zod.dev/api)
- Branded types: 「TypeScript の型システムは構造的。名義型（nominal typing）をシミュレートするには branded types（opaque types）を使う」 — [Zod API > Branded types](https://zod.dev/api#branded-types)
- ロケール: 「国際化のため Zod は組み込みロケールを提供。通常の `zod` は `en` を自動ロード、Zod Mini はロケールを読み込まず全て `Invalid input`」。`z.config(ja())` で日本語化。`ja.ts` は「文字」「要素」「バイト」等の単位を定義 — [Zod: Error customization](https://zod.dev/error-customization) / [zod/src/v4/locales/ja.ts](https://github.com/colinhacks/zod/blob/main/packages/zod/src/v4/locales/ja.ts)
- Next.js 公式フォームガイド: クライアント側は `required`/`type="email"` 等の HTML 属性、サーバー側は Zod/Valibot で `schema.safeParse(...)`、失敗時は `{ errors: validatedFields.error.flatten().fieldErrors }` を返す（※この公式例は Zod 3 API。Zod 4 では `z.treeifyError`/`z.flattenError` を使う）。`useActionState` を使うと Server Action のシグネチャは `(prevState, formData)` になる — [Next.js: Forms](https://nextjs.org/docs/app/guides/forms)
- 「`bind` で追加引数を渡せる（Server/Client 両対応、プログレッシブエンハンスメント対応）。hidden input で渡す方法もあるが値は HTML に平文で出る」 — 同上
- react-hook-form は「非制御コンポーネントとネイティブ HTML input を採用」し、shadcn/ui 等の制御コンポーネントは `Controller` で統合。`@hookform/resolvers` 経由で Zod スキーマを接続 — [React Hook Form: Get Started](https://react-hook-form.com/get-started)
- OWASP 入力検証: 「構文（型・形式）と意味（例: 予約は有効な日付で終了日が開始日より後）の両方を検証」「許可リスト方式。アポストロフィの遮断は正当な氏名を拒否するだけで DB クエリを安全にしない」「自由形式 Unicode テキストは文字エンコーディングを統一し不正な入力を拒否、氏名や自由記述では正当な句読点・文字体系を保持」「長さ上限を設け、バックトラッキングの多い正規表現を避ける」 — [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)

**Drizzle vs Prisma（2026）**
- Drizzle: 「約7.4kB min+gzip、依存 0、ツリーシェイク可能」「serverless-ready by design（Node/Bun/Deno/Cloudflare Workers/Edge/ブラウザ）」「SQL ライクかつリレーショナルの両クエリ API」、Drizzle Kit が「SQL マイグレーションファイル生成または DB へ直接 push」、Drizzle Studio あり — [drizzle-orm README (npm)](https://www.npmjs.com/package/drizzle-orm) / [Drizzle: Overview](https://orm.drizzle.team/docs/overview)
- Biome には `drizzle` ドメイン（`drizzle-orm >= 0.9.0` を検出すると `noDrizzleDeleteWithoutWhere` が recommended で有効化） — [Biome: Domains](https://biomejs.dev/linter/domains/)
- Prisma: 「Prisma 8 は RC。Node.js 24 以上。`npm create prisma` / `npx prisma orm init` が `prisma.config.ts` と `src/prisma/` を生成し、`.claude/skills/<skill>/SKILL.md` 等のエージェント用スキルをインストール」「Prisma 8 は最小コアで、Postgres サポート自体も公開 SPI 上の拡張」 — [prisma/prisma README](https://github.com/prisma/prisma)
- 第三者比較（検索結果、要検証）: 「Prisma 7 は Rust クエリエンジンを TypeScript/WASM に置き換え、バンドルが約 14MB → 約 1.6MB、ネイティブ Edge 対応」「Drizzle は依然小さい（約 7KB）」「サーバー/コンテナ上の通常アプリでは性能差はごくわずか」「Prisma は Studio/Accelerate などツール群が広い」「PkgPulse の『PlanetScale が Drizzle コアチームを 2026 年 3 月に買収』は裏付けなし」 — [Bytebase: Drizzle vs Prisma](https://www.bytebase.com/blog/drizzle-vs-prisma/); [Makerkit: Drizzle vs Prisma 2026](https://makerkit.dev/blog/tutorials/drizzle-vs-prisma); [Techsy: What Prisma 7 changes](https://techsy.io/blog/prisma-vs-drizzle-orm)
- Postgres の範囲型 + 排他制約で二重予約を DB レベルで防止: `CREATE TABLE room_reservation (room text, during tsrange, EXCLUDE USING GIST (room WITH =, during WITH &&));` → 重複 INSERT は `ERROR: conflicting key value violates exclusion constraint` — [PostgreSQL: Range Types > Constraints on Ranges](https://www.postgresql.org/docs/current/rangetypes.html#RANGETYPES-CONSTRAINT)
- `=` 演算子をスカラー列（整数/uuid/text）に GiST で使うには `btree_gist` 拡張が必要（例: `EXCLUDE USING GIST (cage WITH =, animal WITH <>)`） — [PostgreSQL: btree_gist](https://www.postgresql.org/docs/current/btree-gist.html)
- SERIALIZABLE 分離レベルを使うアプリは「直列化失敗（SQLSTATE 40001）でトランザクションを再試行する準備が必要」 — [PostgreSQL: Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html)

### Inferences
- **採用案: Drizzle + `postgres`（porsager）または Neon/Supabase ドライバ**。理由: (1) 予約ドメインは `tstzrange` と排他制約で DB 制約を正とするのが最も単純で、Drizzle は生 SQL マイグレーションで素直に書ける（Prisma schema では `EXCLUDE` を表現できず手書き SQL マイグレーションになる）、(2) Prisma は 8 への大改訂中で 1 人保守の学習コストが読めない、(3) Vercel Functions のコールドスタートに対しバンドルが小さい。Prisma を選ぶなら 7 系に固定し 8 GA 後に判断。
- 共有スキーマの型安全パターン:
  ```ts
  // features/booking/schema.ts  (shared: form + server action)
  import { z } from "zod";
  export const BookingId = z.uuid().brand<"BookingId">();
  export type BookingId = z.infer<typeof BookingId>;
  export const createBookingSchema = z.object({
    serviceId: z.uuid().brand<"ServiceId">(),
    startsAt: z.iso.datetime({ offset: true }),
    name: z.string().trim().min(1).max(50),
    phone: z.e164(),                 // normalize "090-xxxx" -> "+8190xxxx" before parse
    locale: z.enum(["ja", "en"]),
    website: z.literal("").optional(), // honeypot: must stay empty
  });
  export type CreateBookingInput = z.infer<typeof createBookingSchema>;
  ```
  ```ts
  // features/booking/actions.ts
  "use server";
  import "server-only";
  export async function createBookingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const parsed = createBookingSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { status: "invalid", errors: z.flattenError(parsed.error).fieldErrors };
    // rate limit -> turnstile verify -> DAL (auth/ownership inside) -> revalidatePath
  }
  ```
- Server Action の戻り値は判別可能ユニオン（`status: "ok" | "invalid" | "conflict" | "rate_limited"`）にし、二重予約は DB の排他制約違反（SQLSTATE 23P01）を捕捉して `"conflict"` に変換する。
- 日本の電話番号は入力時にハイフン/全角を正規化（NFKC）してから `z.e164()` で検証する。表示用には元の国内形式を保持。

### Gaps
- Drizzle 公式ドキュメント（orm.drizzle.team）のマイグレーション・排他制約ページは GitHub ミラーのパスを特定できず未取得（Drizzle のスキーマ DSL に `EXCLUDE` 制約の直接表現があるかは未確認。生 SQL マイグレーションでの定義は可能）。
- Prisma 7 のアップグレードガイド本文は取得不能（prisma/docs のパスが変更されている模様）。

---

## 3. テスト戦略（Vitest + Testing Library / Playwright / 契約テスト / CI）

### Takeaway
「ユーザーの使い方に似たテストほど信頼できる」（Testing Library）を軸に、(a) 空き枠計算・料金・日付境界などの純粋ロジックは Vitest の高速ユニット/契約テスト、(b) フォーム UI は RTL + user-event、(c) 予約フロー・二重予約の競合・管理画面は Playwright E2E（Chromium のみ、trace on-first-retry）に絞る。async Server Component は Vitest 非対応なので E2E で担保。GitHub Actions はパブリックリポジトリなら無料、プライベートはプラン別無料枠。

### Cited Findings
- Next.js 公式: 「async Server Components は React エコシステムで新しく、Vitest は現在サポートしない。同期 Server/Client Component のユニットテストは可能だが、async コンポーネントは E2E を推奨」。セットアップは `vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom vite-tsconfig-paths`、`vitest.config.mts` に `environment: 'jsdom'` — [Next.js: Vitest](https://nextjs.org/docs/app/guides/testing/vitest)
- Vitest は `happy-dom` または `jsdom` をサポート（別途インストール）。カバレッジは `v8`（デフォルト）と `istanbul`。`*.test-d.ts` で `expectTypeOf` による型テスト。`vi.mock` はファイル先頭に巻き上げられる — [Vitest: Features](https://vitest.dev/guide/features) / [Coverage](https://vitest.dev/guide/coverage) / [Testing Types](https://vitest.dev/guide/testing-types) / [Mocking](https://vitest.dev/guide/mocking)
- Testing Library の指針: 「テストがソフトウェアの使われ方に似ているほど、与えてくれる確信は大きい」。RTL 16 以降は `@testing-library/dom` を別途インストール — [React Testing Library README](https://github.com/testing-library/react-testing-library)
- user-event: 「ユーザーと同じやり方でイベントを発火する」 — [user-event README](https://github.com/testing-library/user-event)
- Playwright ベストプラクティス: 「ユーザーに見える振る舞いをテスト」「各テストは完全に分離（独自の storage/cookie/データ）」「サードパーティ依存をテストしない」「`getByRole` などユーザー向け属性のロケータを使い XPath/CSS を避ける」「web-first assertion（`toBeVisible()` 等）で自動待機」「CI の失敗はビデオ/スクショではなく trace viewer。trace は『最初のリトライ時』に設定（常時 on は重い）」「CI では Chromium のみインストール（`npx playwright install --with-deps chromium`）」「`--shard=x/y` で分割」 — [Playwright: Best Practices](https://playwright.dev/docs/best-practices) / [Sharding](https://playwright.dev/docs/test-sharding)
- Playwright 公式 GitHub Actions ワークフロー: `actions/checkout@v6` → `actions/setup-node@v6`（`lts/*`）→ `npm ci` → `npx playwright install --with-deps` → `npx playwright test` → `actions/upload-artifact@v4`（`playwright-report/`、`retention-days: 30`、`if: ${{ !cancelled() }}`） — [Playwright: Setting up CI](https://playwright.dev/docs/ci-intro)
- `@axe-core/playwright`: `new AxeBuilder({ page }).analyze()` で axe を全フレームに注入して解析。`include/exclude/withTags` でスコープ指定。バージョンは axe-core の major.minor に追従 — [@axe-core/playwright README](https://github.com/dequelabs/axe-core-npm/blob/develop/packages/playwright/README.md)
- Lighthouse CI: `lhci autorun` で URL ごとに Lighthouse を 3 回実行、`assertions` で `categories:performance: ["warn", {"minScore": 0.9}]`、`categories:accessibility: ["error", {"minScore": 1}]` のように閾値を eslint 風に指定。`--preset=lighthouse:recommended`、`budgetsFile`（budgets.json）対応。`temporary-public-storage` は公開 URL になる点に注意 — [Lighthouse CI: Getting Started](https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/getting-started.md) / [Configuration](https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md)
- GitHub Actions 課金: 「GitHub ホストの標準ランナーを使うパブリックリポジトリとセルフホストランナーは無料」「プライベートリポジトリはアカウントのプランに応じた無料分数・ストレージ枠。分数は請求サイクルごとにリセット」「Actions キャッシュはリポジトリあたり 10 GB の別枠」 — [GitHub Docs: GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
- GitHub Actions セキュリティ: 「書き込み権限を持つ全ユーザーはリポジトリの全シークレットを読める」「`GITHUB_TOKEN` の権限は最小化」「`pull_request_target` は不要なら使わない」「環境シークレットには必須レビューアを設定できる」「シークレットを構造化データ（JSON 等）にしない（マスクが効かない）」「定期的にシークレットをローテーション」 — [GitHub Docs: Secure use reference](https://docs.github.com/en/actions/reference/security/secure-use)
- Vercel: Next.js の `next build` では `typescript.ignoreBuildErrors` が型チェックをスキップする（通常はビルド時に `tsc` が走る） — [Next.js: TypeScript](https://nextjs.org/docs/app/api-reference/config/typescript)
- Next.js `instrumentation.ts` の `register()` はサーバー起動時に 1 回呼ばれ、監視/ログツールの統合点になる — [Next.js: Instrumentation](https://nextjs.org/docs/app/guides/instrumentation)
- Next.js には `next-dev-loop` Skill と `/_next/mcp` MCP エンドポイント（Next 16+）があり、エージェントが「ルート・サーバーログ・コンパイルエラー」を取得し、`agent-browser` CLI で DOM/コンソール/ネットワーク/Web Vitals を検証できる — [Next.js: MCP Server](https://nextjs.org/docs/app/guides/mcp)

### Inferences
- **テストピラミッド（本プロジェクト）**
  | 層 | 対象 | ツール | 目安 |
  |---|---|---|---|
  | 契約/ユニット | `features/availability`（営業時間・休日・施術時間・バッファ・JST/UTC 境界・DST なし確認）、料金計算、Zod スキーマ、電話番号正規化 | Vitest（`environment: node`）、テーブル駆動 + `vi.useFakeTimers`/`setSystemTime` | 最多。ms 単位 |
  | コンポーネント | ステップフォームのバリデーション表示・フォーカス移動・aria-live | Vitest + jsdom/happy-dom + RTL + user-event + jest-dom | 主要フォームのみ |
  | 統合（DB） | DAL + 排他制約（Postgres コンテナ or Neon ブランチ） | Vitest + 実 DB（`docker compose` or GitHub Actions `services: postgres`） | 予約作成/キャンセル/再スケジュール |
  | E2E | 予約完走（JA/EN）、二重予約の競合（2 ブラウザコンテキストで同時送信→片方が conflict）、管理 PWA の当日一覧、a11y スモーク（axe） | Playwright（Chromium、`trace: 'on-first-retry'`、`retries: 2` on CI） | 5〜10 本 |
- **テストしないもの**: Next.js/React 自体の挙動、サードパーティ（Turnstile, Upstash）の実呼び出し（MSW/フェイクで置換）、見た目のピクセル一致（Visual regression は後回し）。
- 二重予約の競合テストは「E2E で同時 2 リクエスト」と「DB 統合テストで `Promise.all` の 2 INSERT が片方だけ成功（23P01）」の 2 層で担保し、ロジック側はリトライ/ユーザー向けメッセージを検証する。
- CI 構成（GitHub Actions 無料枠内）: `lint` → `typecheck` → `unit`（並列）→ `e2e`（Vercel Preview URL に対して、または `next build && next start` に対して）。Vercel の Preview Deployment は PR ごとに自動生成されるため、Playwright の `baseURL` に Preview URL を渡す構成が一般的（Vercel 側ドキュメントは本調査で取得不可、Gaps 参照）。

### Gaps
- Vercel Preview Deployments の公式ドキュメント（デプロイ完了イベントの取得、`vercel` CLI での URL 取得、Deployment Protection のバイパストークン）は取得不能。
- GitHub Actions の無料分数の具体値（Free プランのプライベートリポジトリ分数など）は docs のリユーザブル変数で定義されており本文からは数値を確認できなかった。
- Kent C. Dodds「Testing Trophy」「Write tests. Not too many. Mostly integration.」は原典取得不能。

---

## 4. ツーリング（ESLint flat config / typescript-eslint / Prettier vs Biome / Git hooks / Conventional Commits / Renovate）

### Takeaway
2026 年の選択肢は「Biome 2.5 一本（format + lint + import 整理、Prettier 互換 ~97%）」か「ESLint 10 flat config + typescript-eslint 型付き lint + Prettier」。プラグイン依存（jsx-a11y、testing-library、eslint-plugin-next）があるなら ESLint を残すハイブリッドが現実的。Git hooks は husky + lint-staged か lefthook、コミットは Conventional Commits + commitlint、リリースは release-please、依存更新は Renovate `config:recommended`（devDependencies の automerge）。

### Cited Findings
- ESLint flat config: ファイル名は `eslint.config.{js,mjs,cjs,ts,mts,cts}`（`.ts` は追加設定が必要）。`import { defineConfig } from "eslint/config"` で定義 — [ESLint: Configuration Files](https://eslint.org/docs/latest/use/configure/configuration-files)
- typescript-eslint 推奨構成: 型チェックなしなら `tseslint.configs.recommended` + `stylistic`、型チェックありなら `recommendedTypeChecked` + `stylisticTypeChecked`（`parserOptions.projectService: true`, `tsconfigRootDir`）。「開発者の多くが TypeScript に慣れているなら `strict`/`strict-type-checked` に置き換えを検討」。型付きルールは「遅いがはるかに強力」 — [typescript-eslint: Shared Configurations](https://typescript-eslint.io/users/configs) / [Typed Linting](https://typescript-eslint.io/getting-started/typed-linting)
- eslint-plugin-jsx-a11y は flat config 用に `jsxA11y.flatConfigs.recommended`/`strict` を提供 — [eslint-plugin-jsx-a11y README](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y)
- Next.js は `eslint-plugin-jsx-a11y` を統合 ESLint 体験に同梱（aria-props, role-has-required-aria-props 等） — [Next.js: Accessibility](https://nextjs.org/docs/architecture/accessibility)
- eslint-plugin-security: flat config `pluginSecurity.configs.recommended`。`detect-eval-with-expression`、`detect-child-process`、`detect-bidi-characters`（Trojan Source 検出）等 — [eslint-plugin-security README](https://github.com/eslint-community/eslint-plugin-security)
- Biome 2: GritQL ベースの Linter プラグイン（`.grit` ファイルを `plugins` に指定、診断と `=>` によるリライト提案）。依存関係検出でドメイン（`react`, `next`, `drizzle`, `test` 等）の推奨ルールを自動有効化 — [Biome: Linter Plugins](https://biomejs.dev/linter/plugins/) / [Domains](https://biomejs.dev/linter/domains/)
- 第三者比較（2026、ブログ）: 「Biome は ESLint の 10〜25 倍高速」「Prettier テストスイートの約 97% をパス」「ESLint プラグイン（eslint-plugin-react-hooks, jest, testing-library, storybook）は使えないため、最小 ESLint を残すハイブリッドを推奨する記事が複数」 — [reintech: Biome vs ESLint 2026](https://reintech.io/blog/typescript-biome-vs-eslint-linting-formatting-comparison-2026); [codercops](https://blog.codercops.com/blog/biome-javascript-linter-formatter-2026); [stacknotice](https://stacknotice.com/blog/biome-vs-eslint-prettier-guide-2026)
- husky: `npx husky init` が `.husky/pre-commit` と `prepare` スクリプトを作成。`HUSKY=0` でグローバル無効化。lint-staged と組み合わせる — [husky: Get started](https://typicode.github.io/husky/get-started.html)
- lint-staged: ステージ済みファイルのみにタスク実行（例 `{ "*.js": "eslint" }`）。実行前に `git stash` でバックアップ — [lint-staged README](https://github.com/lint-staged/lint-staged)
- lefthook: Go 製・依存なし単一バイナリ、並列実行、`{staged_files}` 等のファイルリスト、`lefthook.yml` — [lefthook README](https://github.com/evilmartians/lefthook)
- Conventional Commits 1.0.0: `fix:` = PATCH、`feat:` = MINOR、`BREAKING CHANGE:` フッタまたは `!` = MAJOR。他の type は `@commitlint/config-conventional` に準拠可 — [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)
- commitlint: `@commitlint/cli` + `@commitlint/config-conventional`、husky の `commit-msg` フックで実行 — [commitlint README](https://github.com/conventional-changelog/commitlint)
- release-please: Conventional Commits を解析して Release PR を維持し、マージ時に CHANGELOG 更新・タグ付け・GitHub Release 作成。「squash-merge を強く推奨」 — [release-please README](https://github.com/googleapis/release-please)
- Renovate: オンボーディング PR は `config:recommended` を提案（モノレポのグループ化などの既定）。「オンボーディング PR をマージするまで一切変更しない」。automerge は「必須テストのパス後」「devDependencies でうまく機能（Jest など）」「変更履歴を読みたい更新は automerge 無効のまま」。スケジュールは `schedule:nonOfficeHours` 等のプリセット — [Renovate: Installing and onboarding](https://docs.renovatebot.com/getting-started/installing-onboarding/) / [Config presets](https://docs.renovatebot.com/config-presets/) / [Automerge](https://docs.renovatebot.com/key-concepts/automerge/)
- OWASP npm セキュリティ: 「`npm ci` でロックファイルを強制」「`.npmrc` に `ignore-scripts=true`（ライフサイクルスクリプト無効化）」「2FA 有効化」「CI/publisher トークンの制限・スコープ・ローテーション」「`npm audit`」 — [OWASP NPM Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/NPM_Security_Cheat_Sheet.html)
- knip: 「未使用の依存・エクスポート・ファイルを検出し修正」 — [knip README](https://github.com/webpro-nl/knip)
- AGENTS.md: 「コーディングエージェントのための README。予測可能な専用の場所」というオープン形式 — [agents.md](https://agents.md/)

### Inferences
- **推奨セット（1 人 + AI）**: Biome 2.5（formatter + 基本 lint + import ソート、`domains: { react, next, drizzle, test }`）+ 最小 ESLint 10（`eslint-config-next` の core-web-vitals と `jsx-a11y`、`eslint-plugin-testing-library`、typescript-eslint の `recommendedTypeChecked` のうち Biome が持たない型情報ルール数個）。CI では `biome ci` + `eslint` + `tsc --noEmit` を並列。
- pre-commit は lefthook（並列・Go バイナリで AI エージェントの高速ループにも向く）か husky + lint-staged。`commit-msg` で commitlint。CHANGELOG は release-please で自動化（squash-merge 運用）。
- Renovate 設定例: `extends: ["config:recommended", "schedule:weekends", ":semanticCommits"]`、`packageRules`: devDependencies の minor/patch は automerge、`next`/`react`/ORM は手動、`minimumReleaseAge: "3 days"`（サプライチェーン攻撃の初動回避。設定名は公式オプション一覧で要確認）。
- `.npmrc` に `ignore-scripts=true` と `save-exact=true`、`engine-strict=true`。

### Gaps
- Biome 公式の「Prettier との差分」ページは GitHub ミラーで 404（パス変更）。97% 互換の数値は第三者ブログ由来。
- Prettier 3.9 自体の変更点、Biome 2.5 の型認識 lint（type-aware）の現状は一次情報を取得できず未確認。

---

## 5. アクセシビリティ（WCAG 2.2 AA、フォーム/カレンダー、日本語固有、自動チェック、ステップフォームのフォーカス管理）

### Takeaway
WCAG 2.2 で追加された AA 基準のうち予約フォームに直結するのは 2.4.11 Focus Not Obscured、2.5.7 Dragging Movements、2.5.8 Target Size (24×24 CSS px)、3.2.6 Consistent Help、3.3.7 Redundant Entry、3.3.8 Accessible Authentication（CAPTCHA/パスワードの認知テスト禁止）。日本語では `<html lang="ja">`/部分 `lang`、`<ruby>` によるふりがな、`autocomplete`/`inputmode` の正しい指定が要点。自動チェックは axe（Playwright 統合）+ Lighthouse CI の accessibility を `minScore: 1` で、手動は Tab 順・スクリーンリーダー読み上げ・aria-live を確認する。

### Cited Findings
**WCAG 2.2 新規・関連基準（Understanding 文書より）**
- 2.5.8 Target Size (Minimum) AA: 「ターゲットは最低 24×24 CSS ピクセル」。例外: Spacing（24px 径の円が隣接ターゲットと交差しない）、Equivalent、Inline、User agent control、Essential。「ズーム倍率とは無関係（ズームで満たすことはできない）」。20×20 のターゲットでも 4px の間隔があれば spacing 例外でパス、間隔ゼロは不合格 — [Understanding SC 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- 2.4.11 Focus Not Obscured (Minimum) AA: 「フォーカスを受けた要素が少なくとも部分的に見えること」。sticky header/footer、非モーダルダイアログ、Cookie バナーが完全に覆うと不合格。対策はバナーをモーダルにする、scroll padding を使う — [Understanding SC 2.4.11](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)
- 3.3.7 Redundant Entry A: 「同じプロセス内で同じ情報を二度求めない」。ブラウザの autocomplete では不十分で、サイト側が自動入力または選択可能にする。「PII を一時保存する場合はデータ保護を確保」 — [Understanding SC 3.3.7](https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html)
- 3.3.8 Accessible Authentication (Minimum) AA: 「ログインに解く・記憶する・書き写すことを要求しない」。パスワード入力はブラウザ/パスワードマネージャの自動入力を許可すれば可（1.3.5 Input Purpose を満たす）。CAPTCHA を認証に使う場合は認知機能テストでない方法が必要。「広告ブロッカー検出時やログイン失敗後にのみ出る CAPTCHA も対象」 — [Understanding SC 3.3.8](https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html)
- 2.5.7 Dragging Movements AA: 「ドラッグ操作には単一ポインタの代替（クリック/タップ）が必要」。スライダーはトラック上のタップで値を設定できるようにする。テキスト入力も代替として許容 — [Understanding SC 2.5.7](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html)
- 3.2.6 Consistent Help A: 「複数ページにあるヘルプは同じ場所に置く」 — [Understanding SC 3.2.6](https://www.w3.org/WAI/WCAG22/Understanding/consistent-help.html)
- 2.4.13 Focus Appearance（AAA）: フォーカスインジケータは「2 CSS px 太さの周囲線と同等以上の面積」「3:1 のコントラスト」 — [Understanding SC 2.4.13](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html)
- 既存の重要基準: 3.3.1 Error Identification（「エラーの存在と内容を説明的に通知」）、3.3.2 Labels or Instructions（「入力に何を入れるかを示す」）、3.1.2 Language of Parts（「他言語の語句は `lang` 属性で示す」）、4.1.3 Status Messages（「フォーカスを奪わない状態変化を支援技術に通知」） — [3.3.1](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html) / [3.3.2](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html) / [3.1.2](https://www.w3.org/WAI/WCAG22/Understanding/language-of-parts.html) / [4.1.3](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)

**日本語固有**
- `lang` グローバル属性は BCP 47 言語タグを 1 つ持ち、「主な目的はスクリーンリーダー等の支援技術が正しい発音を呼び出せるようにすること」 — [MDN: lang](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/lang)
- `<ruby>` は「東アジア文字の発音表示に通常使われる小さな注釈」。`<rt>` と `<rp>`（非対応ブラウザ向け括弧）を併用: `<ruby>明日<rp>(</rp><rt>Ashita</rt><rp>)</rp></ruby>` — [MDN: ruby](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/ruby)
- `autocomplete` のトークン例: `given-name`, `family-name`, `email`, `tel` 等 — [MDN: autocomplete](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/autocomplete)
- `inputmode` は「ブラウザが適切な仮想キーボードを表示できるようにする」（`tel`, `numeric` など） — [MDN: inputmode](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inputmode)
- Next.js のルートアナウンサーは `document.title` → `<h1>` → URL パス名の順にページ名を探して読み上げる。「各ページに一意で説明的なタイトルを」 — [Next.js: Accessibility](https://nextjs.org/docs/architecture/accessibility)
- Next.js 公式フォーム例は `<label htmlFor>` と `<p aria-live="polite">` でエラーを通知し、`pending` 中は `<button disabled={pending}>` — [Next.js: Forms](https://nextjs.org/docs/app/guides/forms)

**自動チェック**
- `@axe-core/playwright`（上記 3 節）。Lighthouse CI の `categories:accessibility` を `["error", {"minScore": 1}]` で CI ゲート化できる — [Lighthouse CI: Configuration](https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md)
- ESLint `jsx-a11y` を Next.js が同梱（上記）。

### Inferences
- **予約フォーム/カレンダー チェックリスト（WCAG 2.2 AA）**
  - 日付セル・時間スロットのボタンは最低 24×24 CSS px（推奨 44×44）、スロット間に 4px 以上の間隔。
  - カレンダーはキーボード操作（矢印で日移動、Enter で選択）に加え、ドラッグ選択を使わない（2.5.7）。
  - 固定ヘッダー/CTA バーがフォーカス要素を隠さないよう `scroll-padding-top/bottom` を設定（2.4.11）。
  - ステップフォーム: 次ステップ表示時にそのステップの見出し（`tabIndex={-1}`）へ `focus()` を移し、`aria-live="polite"` のリージョンで「ステップ 2/3」を通知。前ステップで入力した氏名/電話は再入力させず確認画面に自動表示（3.3.7）。
  - エラーはフィールドごとに `aria-describedby` でメッセージを関連付け、`aria-invalid="true"`、送信失敗時はエラーサマリーへフォーカス（3.3.1/3.3.3）。
  - 管理 PWA のログインはパスワードマネージャ自動入力を阻害しない（`autocomplete="username"/"current-password"`）。Passkey/マジックリンクなら 3.3.8 を自然に満たす。
  - 公開フォームの bot 対策は Turnstile のような非対話型を使い、画像選択 CAPTCHA を避ける（3.3.8 の趣旨）。
  - `<html lang="ja">`／`lang="en"` をロケールごとに切替、固有名詞の英語表記や英語ページ内の日本語店名には `<span lang="ja">`。
  - ふりがなが必要な箇所（店名・スタッフ名）は `<ruby>`。ふりがな入力欄は `autocomplete` 標準トークンがないため `name="kana"` + `inputmode="kana"` 相当は存在しない点に注意（`inputmode="text"`、プレースホルダで全角カナ指定）。
  - 電話番号は `type="tel" inputmode="tel" autocomplete="tel"`。
  - 色だけで空き/満枠を表現しない（1.4.1）。コントラスト 4.5:1（テキスト）/3:1（UI 部品）。
- 自動チェックは「E2E で主要 3 画面に axe（`withTags(['wcag2a','wcag2aa','wcag22aa'])`）」+「Lighthouse CI accessibility 100」+「Biome/ESLint jsx-a11y」。それでも検出できない読み上げ順序・フォーカス管理は手動（VoiceOver + Safari、NVDA + Chrome）で確認する。

### Gaps
- JIS X 8341-3:2016（WCAG 2.0 相当）やウェブアクセシビリティ基盤委員会（WAIC）の資料は取得不能。日本の民間事業者には 2024 年の改正障害者差別解消法で「合理的配慮の提供」が義務化されたとされるが、本調査では一次資料を確認できなかった。
- WCAG 2.2 の新規基準一覧ページ（`new-features-in-wcag-2-2`）は 404 で、本節は個別 Understanding 文書に基づく。

---

## 6. パフォーマンス（Core Web Vitals 2026、日本語フォント、画像、バンドル予算、日付ライブラリ）

### Takeaway
CWV の閾値は変更なし（LCP 2.5s / INP 200ms / CLS 0.1、75 パーセンタイル）。日本語フォントは `next/font/google` の Noto Sans JP（variable、`display: 'swap'`、`adjustFontFallback`）をセルフホストし、`subsets` では日本語サブセットを指定できない（Google Fonts 側の unicode-range 分割に依存）ため、プリロード対象は `latin` のみにし本文は `font-display: swap` で段階表示する。日付処理は Temporal が Stage 4・Chrome 144/Firefox 139/Node 26 で出荷済みだが Safari 未対応のため、2026 年時点は `temporal-polyfill`（19.5kB）か `date-fns` v4 + `@date-fns/tz` を選ぶ。

### Cited Findings
**Core Web Vitals**
- `web-vitals` ライブラリの閾値定数: `CLSThresholds = [0.1, 0.25]`、`INPThresholds = [200, 500]`、`LCPThresholds = [2500, 4000]` — [GoogleChrome/web-vitals README](https://github.com/GoogleChrome/web-vitals#rating-thresholds)
- 2026 年の第三者まとめも「LCP 2.5s / INP 200ms / CLS 0.1、Poor は 4.0s/500ms/0.25、CrUX の 28 日間 75 パーセンタイル」で一致。一部ブログの「LCP 2.0s へ厳格化」「INP 150ms」は公式ソースなし（未検証） — [studiomeyer: Core Web Vitals 2026](https://studiomeyer.io/en/blog/core-web-vitals-2026); [BMAD+ CWV reference](https://cdn.jsdelivr.net/npm/bmad-plus@0.9.0/src/bmad-plus/packs/pack-seo/ref/cwv-thresholds.md)
- Next.js `useReportWebVitals`（`next/web-vitals`、Client Component）で TTFB/FCP/LCP/INP/CLS を分析サービスへ送信。「コールバック参照を変えない（重複送信防止）」 — [Next.js: useReportWebVitals](https://nextjs.org/docs/app/api-reference/functions/use-report-web-vitals)
- 本番チェックリスト: Server Components はクライアント JS に影響しない／ルート単位のコード分割／`<Link>` のプリフェッチ／`cookies`・`searchParams` 等のリクエスト時 API はルート全体を動的レンダリングにする／Lighthouse は「シミュレーションなのでフィールドデータと併用」／バンドル分析ツール（Import Cost, Package Phobia, Bundle Phobia, bundlejs） — [Next.js: Production Checklist](https://nextjs.org/docs/app/guides/production-checklist)
- `connection()` は「`cookies`/`headers` を使わないがリクエストごとに異なる出力（`new Date()` など）が必要なとき」にプリレンダリングを止める。`after()` はレスポンス完了後にログ/分析などの副作用を実行 — [Next.js: connection](https://nextjs.org/docs/app/api-reference/functions/connection) / [after](https://nextjs.org/docs/app/api-reference/functions/after)

**フォント**
- `next/font` は「任意のフォントファイルをビルトインでセルフホスト」「レイアウトシフトなし」「Google Fonts でもブラウザから Google へのリクエストは発生しない」「variable font を推奨」 — [Next.js: Font Optimization](https://nextjs.org/docs/app/getting-started/fonts)
- API: `display` のデフォルトは `'swap'`、`preload` デフォルト `true`、`adjustFontFallback` は Google フォントでデフォルト `true`（CLS 削減のための自動フォールバック）、`subsets` に指定したサブセットのみ `<link rel="preload">` が注入される — [Next.js: Font API](https://nextjs.org/docs/app/api-reference/components/font)
- `next/font/google` のフォントデータ（`font-data.json`）: `Noto Sans JP` = weights 100〜900 + `variable`、axes `wght`、**subsets は `cyrillic, latin, latin-ext, vietnamese` のみ（`japanese` サブセットは存在しない）**。`Noto Serif JP`、`Zen Kaku Gothic New`、`M PLUS 1p`、`BIZ UDPGothic`、`IBM Plex Sans JP` も同様に日本語サブセット名を持たない — [vercel/next.js packages/font/src/google/font-data.json](https://github.com/vercel/next.js/blob/canary/packages/font/src/google/font-data.json)

**画像**
- `<Image>` は「デバイスごとのサイズ最適化と WebP 等のモダン形式」「レイアウトシフト防止」「ビューポート進入時の遅延読み込み + blur プレースホルダ」。`sizes` を省略すると `100vw` 前提で不要に大きい画像を取得する。`fill` 時は `sizes` 必須。外部画像は `remotePatterns` に登録 — [Next.js: Image Optimization](https://nextjs.org/docs/app/getting-started/images) / [Image API](https://nextjs.org/docs/app/api-reference/components/image)

**バンドル**
- `next analyze`（Turbopack 統合、v16.1+）でサーバー/クライアントモジュールを import 追跡付きで検査。Webpack 用には `@next/bundle-analyzer` — [Next.js: Package Bundling](https://nextjs.org/docs/app/guides/package-bundling)
- `next/dynamic`（`React.lazy` + Suspense）、`{ ssr: false }` でクライアント専用遅延読込。Server Components は自動コード分割 — [Next.js: Lazy Loading](https://nextjs.org/docs/app/guides/lazy-loading)
- `@next/third-parties`（GoogleTagManager/GoogleAnalytics/GoogleMapsEmbed/YouTubeEmbed）は読み込み最適化済み — [Next.js: Third Party Libraries](https://nextjs.org/docs/app/guides/third-party-libraries)

**日付ライブラリ（2026）**
- Temporal は TC39 Stage 4。出荷状況: Firefox 139（2025-05-27）、Chrome 144（2026-01-13）、Node 26（2026-05-05）、Safari（JavaScriptCore）は未出荷（バグトラッカーのみ） — [tc39/proposal-temporal README](https://github.com/tc39/proposal-temporal)
- `temporal-polyfill`: 「19.5 kB、スペック準拠。ネイティブがあればそれを使う `temporal-polyfill/global`、ツリーシェイク可能な fns API あり」。`@js-temporal/polyfill`（参照実装、0.5.1 は 2025-03 が最終） — [temporal-polyfill README (npm)](https://www.npmjs.com/package/temporal-polyfill)
- Day.js: 「2kB、Moment.js 互換 API、immutable、i18n」 — [dayjs README](https://www.npmjs.com/package/dayjs)
- date-fns v4 は `@date-fns/tz` の `TZDate` と `tz` ヘルパでタイムゾーン対応（検索結果要約）。第三者ガイド「Temporal はほとんどの用途で Moment/date-fns を置き換えるが、相対時間やロケール表示は `Intl` が必要」「Safari 向けにポリフィル」 — [PkgPulse: Temporal 2026](https://www.pkgpulse.com/guides/temporal-api-replace-momentjs-date-fns-2026); [LogRocket: Moment to Temporal](https://dev.to/logrocket/master-javascript-date-and-time-from-momentjs-to-temporal-5h0l)

### Inferences
- **パフォーマンス予算（中価格帯スマホ想定）**: 公開ページのクライアント JS（First Load JS）150 kB gzip 以下、予約フォームルートでも 200 kB 以下、LCP 要素（ヒーロー画像 or 店名見出し）は `priority` 画像か `next/font` 済みテキスト、CLS 0.05 以下、INP 200ms 以下（カレンダー描画は Server Component + 最小 Client）。Lighthouse CI の `budgets.json` と `categories:performance minScore 0.9` で CI ゲート。
- **日本語フォント方針**: (1) `next/font/google` の `Noto_Sans_JP({ weight: 'variable', subsets: ['latin'], display: 'swap', preload: true })` を root layout に設定（`subsets` は `latin` のみ有効。日本語グリフは Google Fonts の unicode-range 分割 CSS により必要な範囲だけ遅延取得される）。(2) 日本語フォントはファイルが大きいので LCP テキストは `display: 'swap'` でシステムフォント（Hiragino/Noto CJK on Android）から切替え、`adjustFontFallback` で CLS を抑える。(3) ロゴや見出しのみ独自フォントなら `next/font/local` でサブセット済み woff2 を同梱（pyftsubset/`subset-font` で JIS 第1水準 + 使用文字に限定）。(4) ウェイトは variable 1 本に絞る。
- **日付ライブラリ**: サーバー側（Node 24 では Temporal ネイティブ無し）とクライアント（Safari 無し）の両方で `temporal-polyfill` を使い、`Temporal.ZonedDateTime` + `Asia/Tokyo` で営業時間・枠計算を実装するのが長期的に最も安全（将来ポリフィルを外すだけ）。保守的に行くなら `date-fns` v4 + `@date-fns/tz`（ツリーシェイク可、日本語ロケールあり）。`dayjs`（プラグイン式で TZ が弱い）と `luxon`（サイズ大）は本用途では推奨しない。表示には `Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo' })` を使い、DB は `timestamptz`（UTC）で保存、API 境界は ISO 8601 オフセット付き文字列（`z.iso.datetime({ offset: true })`）に統一する。
- 管理 PWA の当日一覧は `connection()`（または動的ルート）で常にリクエスト時レンダリングし、公開ページの空き枠は短い `revalidate` またはクライアント側の `use()` ストリーミングで表示する。

### Gaps
- web.dev の CWV/フォント最適化（`size-adjust`、`unicode-range`、日本語サブセッティング）記事と MDN の `@font-face` ページは取得不能（web.dev 遮断、mdn/content のパスが変更）。日本語フォントサブセット化の定量効果は未確認。
- `@date-fns/tz` の公式 README は未取得（検索要約のみ）。

---

## 7. セキュリティ（OWASP Top 10:2025、Server Action、レート制限、Bot 対策、Cookie/CSP、シークレット、PII 最小化、個人情報保護法）

### Takeaway
Next.js 公式の原則は「Server Action は直接 POST できる公開エンドポイント。各アクション内で認証・認可・入力検証を再実施し、DB アクセスは `server-only` の Data Access Layer に集約、戻り値は UI が必要な最小限」。CSRF は POST 限定 + Origin/Host 比較 + SameSite Cookie で既定保護、CSP は Proxy で nonce 生成（動的レンダリング必須）。レート制限は `@upstash/ratelimit`（HTTP ベース、Vercel 向け）、Bot 対策は Turnstile（サーバー側 siteverify 必須、トークン 5 分・単回）+ ハニーポット。OWASP Top 10:2025 は A01 アクセス制御、A02 設定不備、A03 サプライチェーンが上位。個人情報保護法は 2022 年改正で 5,000 件以下の小規模事業者除外が撤廃済み（2025 年改正の内容は本調査で未確認）。

### Cited Findings
**OWASP Top 10:2025（2025-11-06 公開、第 8 版）**
- 順位: A01 アクセス制御の不備 / A02 セキュリティ設定の不備（5 位→2 位）/ A03 ソフトウェアサプライチェーンの不備（新・旧 A06 拡張）/ A04 暗号化の不備 / A05 インジェクション / A06 安全性を欠いた設計 / A07 認証の不備 / A08 ソフトウェアまたはデータの完全性の不備 / A09 セキュリティログとアラートの不備 / A10 例外的な状況への不適切な対応（新） — [OWASP Top 10:2025 日本語](https://owasp.org/Top10/2025/ja/)
- A01 対策: 「デフォルトで拒否」「アクセス制御の仕組みは一度だけ実装し再利用」「レコード所有権をモデルで強制」「レート制限」「ログアウト後のセッション無効化」「アクセス制御の失敗をログし繰り返しはアラート」 — [A01:2025](https://owasp.org/Top10/2025/ja/A01_2025-Broken_Access_Control/)
- A02 対策: 「開発/QA/本番を同一設定にし認証情報のみ変える」「不要な機能の削除」「セキュリティヘッダーの送信」「設定の自動検証」「静的キーを埋め込まずプラットフォームの ID 連携を使う」 — [A02:2025](https://owasp.org/Top10/2025/ja/A02_2025-Security_Misconfiguration/)
- A03 対策: 「直接・推移的依存の追跡」「未使用依存の削除」「CVE/NVD/OSV の継続監視」「署名済みパッケージ」「CI/CD・IDE の更新」 — [A03:2025](https://owasp.org/Top10/2025/ja/A03_2025-Software_Supply_Chain_Failures/)
- A07 対策: 「MFA」「初期資格情報を残さない」「漏洩パスワードリスト照合」「NIST 800-63b 準拠（定期ローテ強制禁止）」「登録/復旧/API で成否にかかわらず共通メッセージ（列挙防止）」「ログイン試行の制限」「高エントロピーのセッション ID をセキュア Cookie に」 — [A07:2025](https://owasp.org/Top10/2025/ja/A07_2025-Authentication_Failures/)
- A09 対策: 「ログイン・アクセス制御・入力検証の失敗を記録」「Append-only の監査証跡」「Fail closed」「アラート基準とプレイブック」 — [A09:2025](https://owasp.org/Top10/2025/ja/A09_2025-Security_Logging_and_Alerting_Failures/)

**Next.js Server Action / データセキュリティ（公式）**
- 「Server Action は export されると直接 POST で到達可能。UI から呼ばれていなくても外部から呼べる」。組み込み保護: 暗号化された非決定的 Action ID（最大 14 日キャッシュ、ビルドで再生成）、未使用アクションのデッドコード除去。「それでも各アクション内で認証・認可を検証せよ」 — [Next.js: Data Security > Mutating Data](https://nextjs.org/docs/app/guides/data-security#mutating-data)
- 「ページレベルの認証チェックはその中の Server Action には及ばない。アクション内で `auth()` を再実行」「認証だけでなく認可（このユーザーがこのリソースに対して権限を持つか）を確認し IDOR を防ぐ」「DAL を `server-only` にし `"use server"` は薄く」「戻り値は DB レコード全体でなく `{ success: true }` のような最小限」「高コスト操作（メール送信、DB 書き込み）にはレート制限」 — 同上
- CSRF: 「Server Action は POST のみ。SameSite Cookie が既定の現代ブラウザではほとんどの CSRF を防ぐ」「さらに Origin ヘッダーと Host（または X-Forwarded-Host）を比較し、不一致なら中断」。リバースプロキシ構成では `serverActions.allowedOrigins` を設定 — 同上 #allowed-origins-advanced
- クロージャ変数は暗号化されてクライアントに送られる（ビルドごとの鍵）。「暗号化だけに頼って機密値を守ることは推奨しない」 — 同上 #closures-and-encryption
- 「レンダリング中に副作用（Cookie 削除、DB 更新）を起こさない。Next.js はレンダー中の Cookie 設定や再検証を明示的に禁止」 — 同上 #avoiding-side-effects-during-rendering
- 監査観点: 「DAL の分離（DB パッケージと env が DAL 外で import されていないか）」「`"use client"` の props が私的データを期待していないか」「`"use server"` で引数検証・再認可・所有権確認・戻り値フィルタが行われているか」「`[param]` フォルダはユーザー入力」 — 同上 #auditing
- `serverActions.bodySizeLimit` のデフォルトは 1MB（過大ボディによる資源消費/DDoS 防止） — [Next.js: serverActions](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions)
- Proxy（旧 middleware、16 で改名）: 「matcher の変更や Server Function の移動で Proxy のカバレッジが黙って外れることがある。Proxy だけに頼らず各 Server Function 内で認証・認可を検証」。Proxy は Node.js ランタイムがデフォルト — [Next.js: proxy.js](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)
- React Taint API（`experimental.taint: true`、`experimental_taintObjectReference`/`taintUniqueValue`）で機密オブジェクトのクライアント流出をビルド時に防ぐ「追加の防御層」 — [Next.js: Data Security > Tainting](https://nextjs.org/docs/app/guides/data-security#tainting)
- 第三者（検索結果）: Next.js 16.0.4 で RCE CVE-2025-66478 修正、16.2.6 は 13 件のセキュリティアドバイザリを含む（Makerkit ブログ。GitHub Security Advisories で要確認） — [Makerkit: Next.js Security](https://makerkit.dev/blog/md/tutorials/nextjs-security); [Makerkit: Secure Server Actions](https://makerkit.dev/blog/md/tutorials/secure-nextjs-server-actions)
- `next upgrade --agent` と `agentUpgrade` オプションは `next dev`/`next build` でセキュリティアップグレードのリマインダーを表示 — [Next.js: AI Coding Agents](https://nextjs.org/docs/app/guides/ai-agents)

**CSP / セキュリティヘッダー / Cookie**
- Next.js CSP: Proxy で `crypto.randomUUID()` から nonce を生成し `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`、`style-src 'self' 'nonce-${nonce}'`、`object-src 'none'`、`base-uri 'self'`、`form-action 'self'`、`frame-ancestors 'none'`、`upgrade-insecure-requests`。「nonce を使うには動的レンダリングが必須」「開発時のみ `'unsafe-eval'` が必要」。matcher で `_next/static`、`_next/image`、`favicon.ico`、prefetch を除外 — [Next.js: Content Security Policy](https://nextjs.org/docs/app/guides/content-security-policy)
- `next.config` の `headers()` で設定するセキュリティヘッダー例: `Strict-Transport-Security`、`X-Frame-Options`（「CSP の `frame-ancestors` に置き換えられた」）、`Permissions-Policy`、`X-Content-Type-Options: nosniff`、`Referrer-Policy`、`X-DNS-Prefetch-Control` — [Next.js: headers](https://nextjs.org/docs/app/api-reference/config/next-config-js/headers)
- OWASP ヘッダー推奨値: `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`、`X-Content-Type-Options: nosniff`、`Referrer-Policy: strict-origin-when-cross-origin`、`X-Frame-Options: DENY`（CSP `frame-ancestors` 優先）、`X-XSS-Protection: 0`、`X-Powered-By` は削除 — [OWASP HTTP Headers Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html)
- OWASP CSP: `Content-Security-Policy-Report-Only` で非強制ポリシーを並行配信し `report-to` で違反を収集できる — [OWASP CSP Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)
- OWASP セッション管理: セッション ID は「64 ビット以上のエントロピー」「CSPRNG」、Cookie は `Secure`・`HttpOnly`・`SameSite`（`Strict` はクロスサイト全排除、`Lax` はトップレベル GET のみ許可）。トークン（API キー等）は 128 ビット以上、推奨 160 ビット以上 — [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- Next.js `cookies()` は Server Function / Route Handler でのみ `.set`/`.delete` 可能（ストリーミング開始後は設定不可）。オプションに `secure`/`httpOnly`/`sameSite` — [Next.js: cookies](https://nextjs.org/docs/app/api-reference/functions/cookies)
- `Set-Cookie` の `__Host-`/`__Secure-` 接頭辞、`SameSite=Lax` が一部ブラウザのデフォルト（「Lax デフォルト適用時は設定後 2 分以内の POST にも送られる緩和版」）、`Partitioned`（CHIPS） — [MDN: Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie)
- OWASP CSRF: 「モダンブラウザのみ対象なら Fetch Metadata（`Sec-Fetch-Site`）+ Origin 検証フォールバックで遮断可」「SameSite は防御層の一つ。ドメイン全体に Cookie を設定しない（サブドメイン共有の脆弱性）」「署名付き Double Submit Cookie はセッションに紐づける」 — [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- Next.js `redirect()` は Server Action 内では 303、それ以外は 307。`permanentRedirect` は 308 — [Next.js: Redirecting](https://nextjs.org/docs/app/guides/redirecting)

**レート制限 / Bot 対策**
- `@upstash/ratelimit`: 「唯一のコネクションレス（HTTP ベース）レート制限ライブラリ」で Vercel/Serverless/Edge 向け。`Ratelimit.slidingWindow(10, "10 s")`、識別子に userId/apiKey/IP、`prefix` で Redis 共有時の衝突回避、`analytics: true`。GA ステージ。テレメトリは `enableTelemetry: false` または `UPSTASH_DISABLE_TELEMETRY` で無効化 — [@upstash/ratelimit README](https://github.com/upstash/ratelimit-js)
- Next.js BFF ガイド: 「コードベースのチェックに加え、ホストが提供するレート制限機能も有効化」。Route Handler で `checkRateLimit(request)` → 429 — [Next.js: Backend for Frontend > Rate limiting](https://nextjs.org/docs/app/guides/backend-for-frontend#rate-limiting)
- Cloudflare Turnstile: 「クライアント側ウィジェットだけではフォームを保護しない。必ず Siteverify API（`POST https://challenges.cloudflare.com/turnstile/v0/siteverify`、`secret` + `response` + 任意 `remoteip`/`idempotency_key`）で検証」「トークンは 300 秒有効・単回使用（再利用は `timeout-or-duplicate`）・最大 2048 文字」「期限切れ時は `turnstile.reset()` で再発行」 — [Cloudflare Turnstile: Validate the token](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- OWASP DoS: 「安価な検証を先に、高コストの検証を後に」「CPU 集約的処理を避ける」「リクエストサイズ制限」 — [OWASP DoS Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html)
- OWASP 認証: 「ログイン/リセット/登録で成否に関わらず汎用メッセージ（ユーザー列挙防止）」「パスワード最大長は 64 文字以上」「セキュリティ質問は使わない（ASVS 6.4.2）」 — [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- OWASP パスワード保存: 「Argon2id（最低 19 MiB メモリ、反復 2、並列 1）」「scrypt（2^17）」「bcrypt は work factor 10 以上・72 バイト制限」「PBKDF2-HMAC-SHA256 600,000 回以上（FIPS）」 — [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- OWASP IDOR: 「アクセスするオブジェクトごとにアクセス制御。複雑な識別子（GUID）は多層防御であって代替ではない」「列挙可能な数値 ID はランダムな識別子に置換」 — [OWASP IDOR Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html)

**エラー処理 / ログ / シークレット / PII**
- OWASP エラー処理: 「例外が利用者に表示されると技術スタック（バージョン等）が漏れる。グローバルエラーハンドラで汎用応答を返し、詳細はログへ」 — [OWASP Error Handling Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html)
- OWASP ロギング: 「when/where/who/what を記録」「除外すべきデータ: セッション ID（必要ならハッシュ）、アクセストークン、機微な個人情報・一部の PII、パスワード」「失敗した認証試行は資格情報攻撃の早期指標」「法的に許されないデータは記録しない（同意なき収集等）」 — [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- OWASP シークレット管理: 「最小権限」「静的シークレットの自動ローテーション」「エンジニアは全シークレットにアクセスできるべきでない」 — [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- OWASP ユーザープライバシー: 「通信と保存の暗号化」「HSTS」「リモートセッション無効化」「誠実さと透明性」 — [OWASP User Privacy Protection Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/User_Privacy_Protection_Cheat_Sheet.html)
- Next.js DAL の例は「`canSeePhoneNumber(viewer, team)` のようなプライバシールールで電話番号の可視性を決め、DTO は必要なフィールドだけ返す（W3C API Minimization 参照）」 — [Next.js: Data Security > Data Access Layer](https://nextjs.org/docs/app/guides/data-security#data-access-layer)
- GitHub Actions: 書き込み権限者は全シークレット閲覧可／`GITHUB_TOKEN` 最小権限／環境シークレットに必須レビュー／定期ローテーション（上記 3 節） — [GitHub Docs: Secure use reference](https://docs.github.com/en/actions/reference/security/secure-use)
- Anthropic の claude-code リポジトリの CLAUDE.md は、Claude を呼ぶ GitHub Actions ジョブに「egress ファイアウォール付きランナー」「ネットワーク許可リスト（`mode: enforce`）」「`--permission-mode auto`」「`permissions:` ブロックの最小化」「トークンや環境変数をログに出さない」を要求 — [anthropics/claude-code CLAUDE.md](https://github.com/anthropics/claude-code/blob/main/CLAUDE.md)

**個人情報保護法（APPI）**
- 検索結果要約（第三者）: 2020 年改正（2022 年 4 月施行）で「取り扱う本人の数が 5,000 以下の事業者を除外する規定が撤廃され、小規模事業者にも法が適用」「安全管理措置の公表（本人が知り得る状態に置く）と個人関連情報への対応がプライバシーポリシーの新たな記載事項」「中小事業者の 4 割が改正内容を知らない」 — [BUSINESS LAWYERS: 個人情報保護法](https://www.businesslawyers.jp/practices/285); [解決ジャーナル: 改正個人情報保護法](https://www.kaiketsu-j.com/compliance/2797)
- 「個人情報保護法は 3 年ごとに見直しが入ることが決まっている」。2025 年の改正法成立・施行の有無は検索結果からは裏付けられなかった — [Trend Micro Expert View 2025-02-12](https://trendmicro.com/ja_jp/jp-security/25/b/expertview-20250212-01.html)

### Inferences
- **Server Action テンプレート（順序が重要・安価→高価）**:
  1. `bodySizeLimit` は既定 1MB のまま（画像アップロードは Route Handler + 署名付き URL に分離）。
  2. Zod `safeParse`（構文 + 意味: 営業時間内か、過去でないか、スロット整合）。
  3. ハニーポット（`website` フィールドが空でなければ成功を装って破棄）。
  4. `@upstash/ratelimit`（IP + 電話番号ハッシュの 2 キー、例: IP 5 回/10 分、電話 3 件/日）。
  5. Turnstile siteverify（`remoteip` と `idempotency_key` 付き、5 分以内）。
  6. DAL（`server-only`）内で認証/認可（公開予約は認証なしだが「予約の所有」は予約 ID + 電話下 4 桁などで照合）→ トランザクション → 排他制約違反を `conflict` に変換。
  7. 戻り値は `{ status, bookingId }` のみ。`after()` で通知メール/ログ。
- **管理 PWA の認証**: 1〜2 名の運用なら Passkey（WebAuthn）またはマジックリンク + TOTP の MFA を better-auth（1.7）等で実装し、セッション Cookie は `__Host-` 接頭辞、`HttpOnly; Secure; SameSite=Lax; Path=/`、アイドル 12 時間/絶対 7 日程度。ログイン失敗はレート制限 + 汎用メッセージ。管理操作は Proxy の matcher に頼らず各 Server Action で `requireAdmin()`。
- **ヘッダー方針**: `next.config.ts` の `headers()` に HSTS（`max-age=63072000; includeSubDomains; preload`）、`X-Content-Type-Options: nosniff`、`Referrer-Policy: strict-origin-when-cross-origin`、`Permissions-Policy: camera=(), microphone=(), geolocation=()`。CSP は公開サイトが静的/ISR 中心なら nonce 方式（動的化が必要）ではなく、まず `Content-Security-Policy-Report-Only` でハッシュ/`strict-dynamic` を検証してから強制に切替。Turnstile（`challenges.cloudflare.com`）と分析スクリプトの許可を忘れない。
- **PII 最小化・保持**:
  - 収集項目は氏名（表示用）、電話（本人確認・連絡）、任意でメール、要望欄。生年月日・住所は取らない。
  - 予約データは来店後 1 年で氏名/電話をハッシュ化または削除するバッチ（Vercel Cron）を設け、顧客台帳機能を作る際に「保存期間・目的・削除依頼窓口」を明記。
  - ログには電話番号を書かない（ハッシュ末尾 4 桁）、`error.digest` でサーバーログと突合。
  - DB は保存時暗号化のあるマネージド Postgres、バックアップの保持期間も明記。
- **プライバシーポリシー記載事項（2022 年施行法ベース・推定）**: 事業者名/住所/代表者、利用目的（予約管理・連絡・顧客台帳）、取得項目、第三者提供の有無、委託先（ホスティング Vercel、DB、メール送信、Turnstile/Cloudflare 等の外部送信）、安全管理措置の概要（アクセス制御・暗号化・保持期間）、保有個人データの開示・訂正・削除請求窓口、Cookie/アクセス解析の利用、問い合わせ先。外国にある第三者（米国事業者のクラウド）への提供/委託に関する情報提供も 2022 年改正で強化されたとされるが一次資料未確認。
- **サプライチェーン（A03）**: `npm ci` + `ignore-scripts=true` + lockfile コミット + Renovate `minimumReleaseAge` + GitHub Dependabot alerts/`npm audit` を CI に、Actions は SHA ピン留め、`permissions: contents: read` を既定。

### Gaps
- **Vercel WAF / Firewall / Bot Protection / Rate Limiting の料金・Hobby プラン可用性**は公式ドキュメントが取得不能で未確認。Next.js 公式は「ホストのレート制限機能も有効化せよ」とのみ述べる。
- **個人情報保護法の 2025〜2026 年改正**（課徴金・団体訴訟・同意規制の見直し等が議論されていたが法案提出の有無）と**個人情報保護委員会ガイドライン（通則編）の最新版**は ppc.go.jp 遮断 + 検索予算切れで未確認。プライバシーポリシーの必須記載事項は 2022 年施行法に基づく第三者記事の要約のみ。
- Next.js のセキュリティアドバイザリ（CVE-2025-66478 等）の一次情報（GitHub Security Advisories）は未取得。
- `@upstash/ratelimit` の Upstash Redis 無料枠（コマンド数/日）は Upstash ドキュメント遮断のため未確認。
- Cloudflare Turnstile の無料枠（ウィジェット数/リクエスト数）は未確認。

---

## 8. ドキュメント実践（README、ADR、CLAUDE.md/AGENTS.md、オーナー向けランブック）

### Takeaway
ADR は Nygard 形式（Title/Status/Context/Decision/Consequences）を `docs/decisions/NNNN-*.md` に不変で積み上げる。AI 支援開発では `AGENTS.md`（オープン形式、Next.js 16.3+ が同梱ドキュメントへの管理ブロックを自動追記）を正とし `CLAUDE.md` から参照、内容は「短く事実ベース」「証拠なしに API の存在を主張しない」「最小変更」「テスト必須」「生成物の扱い」など Biome/Next.js/Anthropic の実例に倣う。

### Cited Findings
- ADR: 「重要なアーキテクチャ上の決定を、その文脈と結果とともに記録する文書」。テンプレートは Nygard 版、MADR 版、arc42 版など多数。adr-tools は `adr new`/`adr new -s 9`（supersede）で連番ファイルを管理 — [architecture-decision-record](https://github.com/joelparkerhenderson/architecture-decision-record) / [adr-tools](https://github.com/npryce/adr-tools)
- AGENTS.md: 「コーディングエージェントを導くためのシンプルなオープン形式」「エージェント向け README」 — [agents.md](https://agents.md/)
- Next.js 16.3+: `next dev` がエージェント検出時に `AGENTS.md` の管理ブロック（マーカー間のみ更新、他は保持）を生成し `node_modules/next/dist/docs/` を参照させる。`create-next-app` も生成。「Framework の知識は同梱ドキュメントから、Skill は複数ステップのワークフロー用」。`llms.txt`/`llms-full.txt` と `.md` URL で Markdown 版ドキュメントを提供 — [Next.js: AI Coding Agents](https://nextjs.org/docs/app/guides/ai-agents)
- Biome の AGENTS.md: 「応答は短く事実に基づき技術的に」「ソース・コメント・コミット・PR に絵文字を使わない」「Biome の関数や挙動の存在を、ファイルと行・ソース抜粋・再現コマンドなしに主張しない」「証拠がなければそう述べる」「広範な変更前にファイルを全部読む」「要求された挙動を満たす最小の変更」「コード変更にはテスト。バグ修正は修正なしで失敗するケース必須」「最も狭いテストから実行」「ユーザー向け変更には changeset」「最終レビューは新しいサブエージェントで、疑わしい欠陥や期待結果を与えずに」 — [biomejs/biome AGENTS.md](https://github.com/biomejs/biome/blob/main/AGENTS.md)
- Next.js の AGENTS.md: モノレポ構造、エントリポイント、「編集前にルートから対象ディレクトリまでの README を全て読む」、ビルド/テストコマンド、ウォッチモードの既定ルール — [vercel/next.js AGENTS.md](https://github.com/vercel/next.js/blob/canary/AGENTS.md)
- Anthropic claude-code の CLAUDE.md: GitHub Actions のハードニング要件（上記 7 節）、「ワークフローの `permissions:` を最小化、トークンや環境変数をログに出さない」 — [anthropics/claude-code CLAUDE.md](https://github.com/anthropics/claude-code/blob/main/CLAUDE.md)
- Prisma 8 は `prisma-8.md` プライマーをプロジェクト直下に、`.claude/skills/<skill>/SKILL.md`・`.cursor/skills/`・`.agents/skills/` にワークフロー別 SKILL.md をインストールする — [prisma/prisma README](https://github.com/prisma/prisma)
- Next.js `experimental.agentFeedback` は匿名化したフィードバック候補をエージェントが報告する実験機能（Telemetry 有効時のみ、CI では動かない） — [Next.js: AI Coding Agents](https://nextjs.org/docs/app/guides/ai-agents#automatic-agent-feedback)

### Inferences
- **ドキュメント構成案**
  ```
  README.md            # 何を・誰のために・起動 3 手順・環境変数一覧(リンク)・デプロイ・主要コマンド
  AGENTS.md            # 正本。構成/規約/コマンド/禁止事項/Next.js 管理ブロック(自動)
  CLAUDE.md            # "@AGENTS.md" を参照 + Claude 固有(許可ツール、レビュー手順)
  docs/decisions/      # ADR (0001-use-drizzle.md, 0002-temporal-polyfill.md, 0003-turnstile.md ...)
  docs/runbooks/       # オーナー向け: 予約の手動変更、休業日設定、障害時連絡、バックアップ復元、鍵ローテーション
  docs/security.md     # 脅威モデル(予約スパム・二重予約・PII 漏洩)、ヘッダー、保持期間
  docs/privacy-policy-ja.md / -en.md
  ```
- AGENTS.md に書くべき事項（Biome/Next.js 実例から抽出）: スタック/バージョン、ディレクトリ規約と「features 間 import 禁止」、「Server Action には必ず認可 + Zod」、「`process.env` は `lib/env.ts` 経由のみ」、実行コマンド（`pnpm check`, `pnpm test`, `pnpm e2e`）、「バグ修正には再現テスト」、「`node_modules/next/dist/docs/` を先に読む」、絵文字禁止、コミット規約（Conventional Commits）、秘密情報を出力しない。
- ADR の最初の 5 本: ORM 選定（Drizzle）、日付ライブラリ（Temporal polyfill）、認証方式（Passkey/マジックリンク）、Bot 対策（Turnstile + honeypot + Upstash）、i18n ルーティング（`/[locale]` + next-intl）。
- オーナー向けランブックは「スクリーンショット付き・5 分以内・英日併記」で、Vercel ダッシュボードの環境変数更新と DB バックアップ復元を含める。

### Gaps
- Anthropic 公式の CLAUDE.md ベストプラクティス（docs.claude.com）と「Claude Code memory」ドキュメントは取得不能。本節の CLAUDE.md 指針は Anthropic/Next.js/Biome リポジトリの実物ファイルからの推定。
- Vercel ブログ「AGENTS.md outperforms skills」の本文は未取得（Next.js ドキュメントの引用のみ）。

---

## 付録 A. 採用チェックリスト（要約）

- [ ] Node 24 LTS / Next 16.x / TS 7 / Zod 4 / Vitest 5 / ESLint 10 flat / Biome 2.5 / Playwright 1.64 を `package.json` の `engines` と exact version で固定、`.npmrc`: `ignore-scripts=true`, `save-exact=true`
- [ ] `src/{app,features,components/ui,lib}`、`features/*` 間 import 禁止、バレルファイル禁止
- [ ] `lib/env.ts`（t3-env + zod）、`next.config.ts` で import してビルド時検証、`process.env` 直接参照禁止
- [ ] Server Action: `safeParse` → honeypot → rate limit → Turnstile → DAL（`server-only`、認可/所有権）→ 最小戻り値
- [ ] DB: `timestamptz`、`btree_gist` + `EXCLUDE USING GIST (staff_id WITH =, during WITH &&)`、23P01 を conflict に変換
- [ ] テスト: 空き枠ロジックの契約テスト（Vitest）、フォームの RTL、予約/二重予約/管理の Playwright（Chromium、trace on-first-retry、axe）
- [ ] CI: biome ci + eslint + tsc + vitest + playwright、Actions は SHA ピン・`permissions: contents: read`
- [ ] a11y: 24×24px ターゲット、scroll-padding、ステップ遷移時のフォーカス移動 + aria-live、`lang` 切替、`autocomplete`/`inputmode`、Lighthouse a11y 100
- [ ] perf: `next/font/google` Noto Sans JP variable + swap、`<Image sizes>`、First Load JS 予算、`useReportWebVitals`、Lighthouse CI perf ≥ 0.9
- [ ] security headers: HSTS/nosniff/Referrer-Policy/Permissions-Policy、CSP は Report-Only → 強制、Cookie は `__Host-` + HttpOnly + Secure + SameSite=Lax
- [ ] PII: 最小項目、保持期間と削除バッチ、ログに電話番号を出さない、プライバシーポリシー JA/EN、委託先一覧
- [ ] docs: README / AGENTS.md（+CLAUDE.md）/ ADR / runbooks、Conventional Commits + release-please、Renovate `config:recommended`
