# 01 公開手順書

## 文書情報

| 項目 | 内容 |
|---|---|
| 文書 ID | REL-001 |
| 版 | v0.1 |
| 日付 | 2026-10-12 |
| 対象 | 開発者（公開作業・環境移行の担当） |
| 関連要件 | FR-S-04, FR-S-05, FR-S-08, FR-S-09, FR-S-10, FR-S-13, NFR-AV-04, NFR-AV-05, NFR-MG-01, NFR-SC-09, AT-28, AT-29 |
| 関連設計 | DES-00 §2.2・§4、DES-08 §6.2・§10・§12、ADR-0001, ADR-0002, ADR-0003, ADR-0006 |
| 根拠 | `docs/research/research_notes/美容師予約サイト制作ナレッジ/09_gap_infra_tooling.md`（以下「ギャップノート」。2026-10-10 に公式ページで確認した値） |

表記: 【クライアント】= クライアントから受け取る・決めてもらう事項。【要実機確認】= ダッシュボード・実機でしか確かめられない事項。初回作業時に結果を本書へ書き戻す。

---

## 1. 全体の流れ

| 段階 | 作業 | 章 | 目安 |
|---|---|---|---|
| 0 | アカウントと秘密値を用意する | §2 | 半日（クライアント待ちを除く） |
| 1 | Vercel プロジェクトを作る（初回ビルドは失敗してよい） | §3 | 15 分 |
| 2 | Neon を Marketplace から追加する | §4 | 15 分 |
| 3 | DB にマイグレーションと初期データを入れる | §5 | 15 分 |
| 4 | 環境変数を設定して再デプロイする | §6 | 30 分 |
| 5 | Cron・Turnstile・WAF・保護設定を確認する | §7 | 30 分 |
| 6 | staging を用意する（M5 前に済ませる） | §8 | 30 分 |
| 7 | バックアップを有効にし、復元を 1 回試す | §9 | 1 時間 |
| 8 | 公開前チェックリストを完了して Go/No-Go | `02_prelaunch_checklist.md` | — |
| 後日 | 独自ドメイン移行／Pro・Cloudflare 移行 | §10・§11 | 各 1〜3 時間 |

**順序の理由**: `npm run build` はメニュー・営業時間・設定を DB から読んで静的シェルに焼き込む（DES-00 §3.2）。DB が空のままビルドすると失敗するため、マイグレーションと初期データ投入（§5）を環境変数の最終設定・再デプロイ（§6）より先に行う。

---

## 2. 前提（アカウントと秘密値）

### 2.1 アカウント

名義は運用マニュアル（REL-004 §12 アカウント一覧）と揃える。名義・請求先は OI-15 / Q-12 で確定する【クライアント】。

| # | サービス | プラン | 用途 | 準備すること |
|---|---|---|---|---|
| 1 | GitHub | Free | ソース、CI、日次バックアップ | リポジトリ（**非公開**を推奨。公開だとバックアップのアーティファクトを置けない: §9）。Actions 有効 |
| 2 | Vercel | Hobby | ホスティング、Cron、WAF | GitHub 連携でサインアップ。Hobby は規約上「非商用の個人利用」限定で、本案件は規約リスクを了承済み（計画書 A-08、R-03、ADR-0001） |
| 3 | Neon | Free（Vercel Marketplace 経由） | Postgres | Vercel から作成するため個別のサインアップは不要。請求は Vercel 側で管理される |
| 4 | Cloudflare | Free | Turnstile | ウィジェットを 1 つ作る（§7.2）。Free は 20 ウィジェット・1 ウィジェット 10 ホスト名まで |
| 5 | Resend | Free（3,000 通/月） | 管理者ログインの 6 桁コード送信 | 送信元ドメインの認証（§2.3） |
| 6 | Instagram | — | 顧客の連絡先（`@neuer.kento`） | 障害時の告知にも使う【クライアント】 |
| 7 | ドメイン登録事業者 | — | 独自ドメイン（後日） | Phase 1 は `*.vercel.app` で公開し、時期は未定【クライアント】 |
| 8 | Sentry | Developer | エラー監視（FR-S-11） | **未実装（後続スライス）**。`SENTRY_DSN` は現状任意 |

### 2.2 秘密値の生成

ローカルの端末で生成し、パスワードマネージャに保存してから Vercel / GitHub に貼る。リポジトリ・チャット・メールには書かない。

| 値 | 生成コマンド | 備考 |
|---|---|---|
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` | 44 文字。Production と Preview で別の値にする。漏えい時だけ変える（全セッション失効） |
| `CRON_SECRET` | `openssl rand -base64 32` | Vercel Cron が `Authorization: Bearer <値>` を付けて呼ぶ。年 1 回ローテーション可 |
| `PII_HASH_SECRET` | `openssl rand -base64 32` | IP・電話番号の HMAC 鍵。**原則変えない**（変えるとレート制限・電話ハッシュの突合ができなくなる） |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | `npx web-push generate-vapid-keys`（リポジトリ内で実行すると依存の `web-push` 3.6.7 が使われる） | 出力の Public Key / Private Key。**一度決めたら変えない**（変えると全端末の通知購読が無効になる）。Production と Preview で別の鍵ペアにする |
| バックアップ暗号鍵 | `age-keygen -o neuer-backup-key.txt`（`age` は `brew install age` / `apt install age`） | 表示される公開鍵 `age1…` を GitHub の `BACKUP_AGE_RECIPIENT` に登録。秘密鍵ファイルはオフラインで 2 部（開発者・クライアント）保管【クライアント】。代替は `BACKUP_PASSPHRASE`（§9.1） |

### 2.3 Resend（管理者ログインのコード送信）

本番では `RESEND_API_KEY` が**実質必須**。初回ログインは「メールのコードでログイン」で行い、その後に端末へパスキーを登録する設計のため（`scripts/seed-admin.ts`、ADR-0006）。未設定の本番ではコードが届かず、ログに `admin_otp.delivery_unconfigured` が出るだけになる。

| 方式 | 手順 | 制約 |
|---|---|---|
| A. 送信元ドメインを認証（推奨） | Resend → Domains → Add Domain → 表示された SPF（TXT）・DKIM（TXT/CNAME）・（任意）DMARC をドメインの DNS に追加 → Verified になったら API Keys → Create（権限 Sending access） | 認証できるドメインが必要（独自ドメイン取得後、または開発者のドメイン）。`*.vercel.app` は認証できない |
| B. 独自ドメイン取得前のつなぎ | Resend アカウントを `ADMIN_EMAIL` と同じアドレスで作り、`RESEND_FROM` を `予約管理 <onboarding@resend.dev>` にする | `onboarding@resend.dev` はアカウント所有者のアドレス宛にしか届かない【要実機確認】。独自ドメイン取得後に A へ切り替える |

`RESEND_FROM` の形式: `予約管理 <login@example.jp>`（表示名＋認証済みドメインのアドレス）。

---

## 3. Vercel プロジェクトの作成

1. Vercel ダッシュボード → **Add New… → Project** → GitHub リポジトリを Import。
2. 設定:

| 項目 | 値 |
|---|---|
| Framework Preset | Next.js（自動検出） |
| Root Directory | `./`（リポジトリ直下） |
| Build Command / Install Command / Output | 既定のまま（`npm run build` / `npm ci` 相当 / `.next`） |
| Node.js Version | **24.x**（Settings → Build and Deployment）。`.nvmrc` は `24`、`package.json` の `engines.node` は `>=22.13.0` |
| Production Branch | `main` |
| Function Region | Neon と同じ地域にそろえる（§4 の結果に合わせ、Singapore なら `sin1`）【要実機確認: Hobby で変更できるか】 |

3. **Deploy** を押す。環境変数がないため初回ビルドは `src/lib/env.ts` の検証で失敗するが、プロジェクトが作られればよい。
4. 発行された本番 URL（例 `https://neuer-barber.vercel.app`）を控える。これが Phase 1 の `SITE_URL` になる。プロジェクト名で URL が決まるため、名前は公開前に決めておく【クライアント: 表示名の希望】。

---

## 4. Neon の追加（Vercel Marketplace）

1. Vercel プロジェクト → **Storage**（または Integrations → Marketplace）→ **Neon** → Create / Install。
2. プラン **Free** を選ぶ（ギャップノート #14: Marketplace 経由でも「Plans starting at $0」）。
3. **Region**: 一覧に Tokyo（AWS `ap-northeast-1`）があればそれを、なければ **Singapore（AWS `ap-southeast-1`）** を選ぶ。執筆時点の知識では Neon の AWS リージョンに Tokyo は含まれていない【要実機確認: 選択画面の一覧】。DES-00 §3.1 は「関数 `hnd1`＋Neon `aws-ap-northeast-1`」を前提にしているため、Tokyo が無い場合は関数リージョンを `sin1` にそろえ（1 リクエストで複数回 DB を往復するため、関数は DB の近くに置く方が速い）、設計変更として DES-00 の変更履歴に記録する。
4. Postgres のバージョン: 既定（執筆時点 17）のままでよい。`.github/workflows/backup.yml` の `PG_MAJOR` をこれに合わせる【要実機確認】。
5. 接続する環境: **Production と Preview** にチェック（Development は不要）。Preview デプロイごとの自動ブランチ作成の選択肢が出た場合は**オフ**にする（§8 で `staging` ブランチを手動で作り、Preview はそこへ向ける。自動ブランチは本番ブランチの複製なので、公開後は顧客の個人情報をコピーしてしまう）【要実機確認: 選択肢の有無と名称】。
6. 注入された環境変数を確認する（Settings → Environment Variables）。`DATABASE_URL`（`-pooler` を含むプール接続）と `DATABASE_URL_UNPOOLED`（直結）があればよい。名前が異なる場合（`POSTGRES_URL` など）は、同じ値で `DATABASE_URL` / `DATABASE_URL_UNPOOLED` を追加する。
7. Neon コンソール（Vercel の Storage 画面から開ける）で、拡張が使えることを確認: SQL Editor で `SELECT name, default_version FROM pg_available_extensions WHERE name IN ('btree_gist','pg_trgm');` が 2 行返る（ギャップノート #18）。

---

## 5. マイグレーションと初期データ

**原則**: スキーマ変更は `npm run db:migrate`（`drizzle-kit migrate`）だけで行う。`drizzle-kit push` は手書きの排他制約 `bookings_no_overlap`（`drizzle/0002_constraints.sql`）を無視するため**使わない**（AGENTS.md 規則 1、ADR-0003）。ビルド時に自動マイグレーションはしない。

### 5.1 本番 DB へのマイグレーション（ローカルの端末から）

```bash
# リポジトリ直下。接続文字列は Neon コンソール > Connection details の「Direct connection」（-pooler なし、sslmode=require）
npm ci
read -rs PROD_DB_URL   # 貼り付けて Enter（画面とシェル履歴に残さない）
DATABASE_URL="$PROD_DB_URL" DATABASE_URL_UNPOOLED="$PROD_DB_URL" npm run db:migrate
```

- `scripts/load-env.ts` は既に設定済みの環境変数を上書きしないため、上のように渡せば `.env.local`（ローカル DB）より優先される。`DATABASE_URL` と `DATABASE_URL_UNPOOLED` の**両方**を渡す（`.env.local` に空の `DATABASE_URL_UNPOOLED=` があると、片方だけでは空文字が使われる）。
- 適用されるのは `0000_extensions`（`btree_gist`, `pg_trgm`）→ `0001_init` → `0002_constraints`（排他制約・トリガ）→ `0003_auth` → `0004_consent_ip_hash`（同意記録の IP を HMAC 化）の 5 本。確認は `02_prelaunch_checklist.md` B 群の SQL で行う。
- 将来のマイグレーションも同じ手順で、**アプリのデプロイより先に**適用する。マイグレーションは追加的（列追加・テーブル追加）に保ち、1 つ前のデプロイでも動くようにする（ロールバック方針: `03_rollback_and_incident.md` §2）。

### 5.2 初期データ（メニュー・営業時間・設定）

```bash
DATABASE_URL="$PROD_DB_URL" DATABASE_URL_UNPOOLED="$PROD_DB_URL" ADMIN_EMAIL="owner@example.jp" npm run db:seed
```

- 9 メニュー（**非公開・価格 0 円**）、営業時間（月曜定休、他は 18:00–24:00）、設定（30 分刻み、締切 60 分前、60 日先まで、セルフキャンセル 2 時間前、日次サマリー 21 時）が入る。既存の行は上書きしない（何度実行しても安全）。
- **本番では `--activate-menus` を付けない。** このフラグは全 9 メニューを価格に関係なく一括で公開にするローカル開発用。価格 0 円のメニューが予約可能になる事故を防ぐため、価格が確定（OI-01【クライアント】）したら、管理 PWA の「設定 > メニュー」でメニューごとに価格・所要時間を入れてから「顧客サイトに公開」スイッチをオンにする。全メニューの価格が入った後でなければフラグは使わない。
- 営業時間・締切（OI-02, OI-03, OI-06）が確定値と違う場合も、管理 PWA の「設定 > 営業時間」で直す（再 seed では変わらない）。

### 5.3 管理者ユーザー

```bash
DATABASE_URL="$PROD_DB_URL" DATABASE_URL_UNPOOLED="$PROD_DB_URL" ADMIN_EMAIL="owner@example.jp" npm run db:seed-admin
unset PROD_DB_URL
```

- `ADMIN_EMAIL` はクライアントが普段 iPhone で読むメールアドレス【クライアント】。Vercel の `ADMIN_EMAIL` と同じ値にする（`requireAdmin()` はこのアドレスだけを受け付ける）。
- サインアップは無効のため、管理者が存在する方法はこのスクリプトだけ。`admin user already exists` は正常。
- 初回ログイン（クライアントの iPhone）: ホーム画面に追加 → アイコンから起動 → 「メールのコードでログイン」→ 6 桁コード → 「この端末に Face ID（パスキー）を登録する」→「設定 > 通知」で通知をオン（REL-004 §1）。

---

## 6. 環境変数

Vercel → Settings → Environment Variables。値は `src/lib/env.ts`（`src/lib/env-schema.ts`）で検証される。ビルド自体は秘密なしでも通るが、**本番・Preview の実行時に必須値が 1 つでも欠けるとページがエラーになる**（fail closed。中途半端な状態で動かさない）。`NEXT_PUBLIC_` の変数は使わない（公開値もサーバーから props で渡す）。

「Preview（staging）」は Vercel の Preview 環境で **Git ブランチ `staging` を指定**して登録する値（§8）。PR ごとの Preview には「Preview（全体）」の値が使われる。

| 変数 | 必須（本番 / Preview） | 取得元 | Production の値 | Preview（staging）の値 | 注意 |
|---|---|---|---|---|---|
| `SITE_URL` | 必須 / 必須 | §3 で控えた URL | `https://<project>.vercel.app`（独自ドメイン移行後は `https://www.<domain>`） | staging の固定 URL（§8.1） | **最終的な公開オリジンを末尾スラッシュなしで**。完了・キャンセル URL、ICS、通知の遷移先、パスキーの rpID、Turnstile のホスト名照合に使う。違うとログイン・予約確定が失敗する |
| `DATABASE_URL` | 必須 / 必須 | Neon 連携で自動注入 | Neon `main` のプール接続（`-pooler`） | Neon `staging` ブランチのプール接続 | ビルド時にも読む（メニュー等を焼き込む） |
| `DATABASE_URL_UNPOOLED` | 任意 / 任意 | Neon 連携で自動注入 | Neon `main` の直結 | Neon `staging` の直結 | マイグレーション・`pg_dump` 用。アプリは使わない |
| `BETTER_AUTH_SECRET` | 必須 / 必須 | §2.2 | 生成値 A | 生成値 B（本番と別） | 32 文字以上 |
| `ADMIN_EMAIL` | 必須 / 必須 | 【クライアント】 | 管理者のメールアドレス | 同じでよい | 未設定だと誰も管理画面に入れない |
| `RESEND_API_KEY` | 必須 / 必須 | Resend → API Keys | Sending access のキー | staging で OTP を試すなら同じキー | 未設定の本番では 6 桁コードが届かない（§2.3） |
| `RESEND_FROM` | 必須 / 必須 | §2.3 | `予約管理 <login@<認証済みドメイン>>`（ドメイン認証前は `予約管理 <onboarding@resend.dev>`） | 同左 | `onboarding@resend.dev` は Resend アカウント所有者のアドレス宛にしか届かない |
| `VAPID_PUBLIC_KEY` | 必須 / 必須 | §2.2 | 鍵ペア A の公開鍵 | 鍵ペア B の公開鍵 | 変更禁止（購読が全部無効になる） |
| `VAPID_PRIVATE_KEY` | 必須 / 必須 | §2.2 | 鍵ペア A の秘密鍵 | 鍵ペア B の秘密鍵 | Sensitive にする |
| `VAPID_SUBJECT` | 必須 / 必須 | 【クライアント/開発者】連絡先 | `mailto:<連絡先>` | 同左 | `mailto:` か `https://` で始める。Safari は `https://localhost` を拒否 |
| `CRON_SECRET` | 必須 / 必須 | §2.2 | 生成値 | 別の生成値 | Cron は本番デプロイでしか動かない |
| `TURNSTILE_SITE_KEY` | 必須 / 必須 | Cloudflare（§7.2） | 本番ウィジェットのサイトキー | 同じウィジェット（ホスト名に staging を追加）または staging 用ウィジェット | テスト用ダミーキーは使わない（siteverify が返すホスト名が `SITE_URL` と一致しないため確定が失敗する） |
| `TURNSTILE_SECRET_KEY` | 必須 / 必須 | Cloudflare | 同ウィジェットのシークレット | 同左 | Sensitive |
| `PII_HASH_SECRET` | 必須 / 必須 | §2.2 | 生成値 | 別の生成値 | 変更しない |
| `DEMO_MODE` | 任意 / 任意 | — | 正式公開前のデモ期間だけ `1` | 同左 | 全顧客ページに「テスト公開中」の帯を出し、検索エンジンに登録しない（noindex）。ビルド時に読むので変更後は再デプロイ。**正式公開時に削除** |
| `SENTRY_DSN` | 任意 / 任意 | Sentry（未実装） | — | — | 監視スライス実装時に設定 |
| `SENTRY_CSP_REPORT_URI` | 任意 / 任意 | Sentry → Security Headers | — | — | 設定すると CSP に `report-uri` が付く |
| `TEST_DATABASE_URL` | 設定しない | — | — | — | ローカル・CI のテスト専用 |
| `SKIP_ENV_VALIDATION` | **設定しない** | — | — | — | 設定すると欠落を検出できなくなる |
| `VERCEL_ENV` / `VERCEL_URL` / `VERCEL_PROJECT_PRODUCTION_URL` | 自動 | Vercel のシステム変数 | — | — | `SITE_URL` 未設定時のフォールバックだが、本番・Preview では `SITE_URL` が必須 |

設定後:

1. Deployments → 最新のデプロイ → **Redeploy**（Use existing Build Cache はオフ）。
2. ビルドログに env 検証エラーがなく、`/ja` が表示されることを確認する。
3. 秘密値の一覧（どこに何を入れたか。値そのものは書かない）を REL-004 §12 に記録する。

---

## 7. 公開前の基盤設定

### 7.1 Cron（日次サマリー・保存期間ジョブ）

| ジョブ | `vercel.json` | JST | Hobby の実行時刻 |
|---|---|---|---|
| `/api/cron/daily-digest` | `0 12 * * *`（UTC） | 21:00 | 21:00〜21:59 のどこか（±59 分、ギャップノート #6） |
| `/api/cron/retention` | `0 18 * * *`（UTC） | 03:00 | 03:00〜03:59 のどこか |

1. Settings → **Cron Jobs** に 2 本が表示され、Enabled であることを確認する。
2. 各ジョブの **Run** で手動実行し、Logs に 200 が出ることを確認する（日次サマリーは JST 1 日 1 回までしか送らないため、手動実行するとその日の定時分は送られない。公開前日に試すとよい）。
3. 認証の確認（ローカルから）: `curl -s -o /dev/null -w '%{http_code}\n' https://<SITE>/api/cron/daily-digest` が **401**（Bearer なしは拒否）。
4. Hobby では毎時以上の頻度の式はデプロイ自体が失敗する。`vercel.json` に 1 日 1 回より多い式を足さない。

### 7.2 Turnstile

1. Cloudflare ダッシュボード → Turnstile → **Add widget**。名前 `neuer-barber`、Widget Mode **Managed**。
2. Hostnames: `<project>.vercel.app`（本番）と staging の固定ホスト名（§8.1）。独自ドメイン移行時に `www.<domain>` と apex を追加する（Free は 1 ウィジェット 10 ホスト名まで）。
3. サイトキーとシークレットを §6 の 2 変数に設定する。
4. アプリは siteverify の `hostname` が `SITE_URL` のホストと一致し、`action` が `create_booking` のときだけ通す（DES-08 §7）。PR ごとの Preview は URL が毎回変わるため予約確定は Turnstile で失敗する（PR Preview は表示確認用。予約の通し確認は staging で行う）。

### 7.3 Vercel WAF（Hobby はレート制限ルール 1 本）

Hobby の WAF Rate Limiting はプロジェクトあたり 1 ルール・固定窓 10 秒〜10 分・キーは IP/JA4（ギャップノート #9 §2.8）。アプリ側のレート制限（Postgres `rate_limits`: 予約 IP 5 回/10 分、電話 3 件/日、キャンセル URL IP 10 回/分）が本体で、WAF はその手前で大量アクセスを落とす粗い前段（FR-S-04、DES-08 §6.2）。

Firewall → **Configure → New Rule**:

| 項目 | 設定 |
|---|---|
| Name | `booking-abuse-coarse` |
| If | Request Path **matches regex** `^/(ja\|en)/(cancel/\|book/confirm)` **OR** Request Path **starts with** `/api/ics/` **OR** Request Path **starts with** `/api/availability` （`/api/availability` は空き計算 SQL を毎回実行しキャッシュしないため対象に含める。SR-04、ADR-0010） |
| Then | **Rate Limit**、Fixed Window **60 秒**、Key **IP**、Limit **30** リクエスト |
| Action | **Too Many Requests（429）**、60 秒 |

- `book/confirm` は予約確定の Server Action（POST）が送られるページ。GET も数えるが、30 回/分は正常な操作を妨げない。より厳密にする場合は条件に Method = POST を加える。
- 保存後 **Publish**。ルールの動作確認は `02_prelaunch_checklist.md` F 群（`for i in $(seq 1 35)` で 429 が返るか）。
- Pro 移行後は 40 ルールまで使えるため、キャンセル（10/分）と確定（5/10 分）を分け、`/admin/login` を追加する。
- 予備として Hobby でも使えるカスタムルール（計 3 本）・IP ブロック（3 件）は障害時の受付停止に使う（`03_rollback_and_incident.md` §3）。

### 7.4 Deployment Protection

1. Settings → **Deployment Protection** → **Vercel Authentication** をオン、範囲 **Standard Protection**（本番ドメイン以外の全デプロイを保護。全プランで利用可）。
2. CI から保護された Preview に E2E を流す場合は **Protection Bypass for Automation** を有効にし、生成された秘密を GitHub Secrets `VERCEL_AUTOMATION_BYPASS_SECRET` に登録、リクエストに `x-vercel-protection-bypass` ヘッダを付ける（FR-S-13。現状の CI はローカルビルドに対して E2E を回しており未使用）。
3. **注意（実機テスト）**: クライアントの iPhone で staging の管理 PWA を試すとき、ホーム画面アプリは Safari と Cookie を共有しないため、Vercel Authentication のログインが PWA に引き継がれず開けない可能性が高い【要実機確認】。その場合は検収期間（M5〜M6）だけ staging のドメインを **Deployment Protection Exceptions** に入れて保護を外す（Hobby でも利用可: ギャップノート #8）。staging には架空データしか入れないこと、`X-Robots-Tag: noindex` が付くこと（本番以外は `next.config.ts` が付与）を前提とする。検収後に例外を外す。

---

## 8. staging 環境（`staging` ブランチ → Preview ＋ Neon ブランチ）

| 環境 | Git | URL | DB | 保護 |
|---|---|---|---|---|
| production | `main` | `<project>.vercel.app`（後日独自ドメイン） | Neon `main` | なし |
| staging | `staging` | 固定の Preview URL | Neon `staging` | Vercel Authentication（検収中は §7.4 の例外） |
| PR Preview | PR ごと | 自動生成 | Neon `staging`（共有） | Vercel Authentication |

### 8.1 作成手順

1. `staging` ブランチを `main` から作成して push する（開発者の端末で。CI は `main` と `staging` の push で動く）。
2. Vercel が `staging` の Preview をビルドする。固定 URL は `https://<project>-git-staging-<team>.vercel.app` の形式（Deployments → 該当デプロイ → Domains で確認）。任意で Settings → Domains に `<project>-staging.vercel.app` を追加し Git Branch `staging` に割り当てると覚えやすい【要実機確認: Hobby で可能か】。
3. Neon コンソール → Branches → **Create branch**: 名前 `staging`、親 `main`。**公開前（本番に顧客データが入る前）に作る**。公開後に親から作り直す・「Reset from parent」をすると本番の個人情報が staging に複製されるため行わない。公開後に作り直す場合は空のブランチ（schema only）を作り、§5 の手順でマイグレーションと seed を流す。
4. `staging` ブランチの接続文字列（プール・直結）を、Vercel の環境変数に **Preview / Git Branch = `staging`** で登録する（`DATABASE_URL`, `DATABASE_URL_UNPOOLED`）。Neon 連携が Preview 全体に注入した値より、ブランチ指定の値が優先される【要実機確認】。PR Preview も staging DB を使うよう、Preview（全体）の `DATABASE_URL` も `staging` の値にする。
5. §6 の Preview（staging）列の値を登録する（`SITE_URL` は手順 2 の固定 URL）。
6. staging DB に §5 と同じ手順でマイグレーションと seed を流す。staging は検収用に `npm run db:seed -- --activate-menus` で全メニューを公開してよい（架空の価格で可）。
7. staging でも管理者ユーザーを `db:seed-admin` で作り、検収用に Turnstile のホスト名へ staging を追加する（§7.2）。
8. 確認: staging で予約しても本番 DB の `bookings` が増えない（FR-S-13 の受入基準）。

### 8.2 リリースの流れ

1. 作業ブランチ → PR（CI 緑・Preview で表示確認）→ `staging` にマージ → staging で動作確認。
2. マイグレーションがある場合は、§5.1 の手順で**本番 DB に先に適用**する（追加的な変更に限る）。
3. `staging` → `main` の PR をマージ → 本番デプロイ（自動）。
4. 公開直後テスト（`02_prelaunch_checklist.md` M 群の短縮版: 予約 1 件 → 通知 → 管理 PWA で確認 → キャンセル）。

---

## 9. バックアップと復元

### 9.1 日次バックアップの有効化（`.github/workflows/backup.yml`）

| 項目 | 内容 |
|---|---|
| 実行 | 毎日 18:17 UTC（03:17 JST）＋手動実行（Actions → Backup → Run workflow） |
| 取得 | `pg_dump --format=custom --no-owner --no-privileges`。クライアントは PGDG の `postgresql-client-${PG_MAJOR}`（既定 17）。Neon のサーバー版より古いとジョブが失敗して知らせる |
| 検査 | `pg_restore --list` で読めること、`bookings_no_overlap` が含まれることを確認 |
| 暗号化 | `BACKUP_AGE_RECIPIENT`（age 公開鍵、推奨: CI は復号できない）、なければ `BACKUP_PASSPHRASE`（`gpg --symmetric` AES256） |
| 保存 | Actions アーティファクト `db-backup-<UTC 時刻>`、保持 30 日（= 30 世代）＋ SHA-256 |
| 公開リポジトリ | ジョブが失敗する（公開リポジトリのアーティファクトは GitHub にログインした誰でも取得できるため。08_security.md §10） |
| 費用 | 非公開リポジトリは Actions 月 2,000 分・アーティファクト保存 500 MB の無料枠内（1 回数分・数 MB 想定）【要実機確認: 初回の所要時間とサイズ】 |

設定手順:

1. Neon の SQL Editor（`main` ブランチ）で読み取り専用ロールを作る（DES-08 T-07）:
   ```sql
   CREATE ROLE backup_ro WITH LOGIN PASSWORD '<openssl rand -base64 32 の値>';
   GRANT pg_read_all_data TO backup_ro;
   ```
   【要実機確認: Neon で `pg_read_all_data` を付与できるか。できない場合は Neon コンソールで作るロールに `GRANT USAGE ON SCHEMA public, drizzle` と `GRANT SELECT ON ALL TABLES/SEQUENCES` を付ける】
2. 接続文字列 `postgresql://backup_ro:<pw>@<直結ホスト>/neondb?sslmode=require`（`-pooler` なし）を用意する。
3. GitHub → Settings → **Environments → New environment** `backup`。Deployment branches を `main` のみに制限する。**Required reviewers は付けない**（付けると毎日の定時実行が承認待ちで止まる。DES-08 §10 の「必須レビュー付き」はこの理由で採らない）。
4. `backup` 環境の Secrets に `PROD_DATABASE_URL`（手順 2）と `BACKUP_AGE_RECIPIENT`（§2.2 の `age1…`）を登録する。
5. Actions → Backup → **Run workflow** で 1 回実行し、緑になり `db-backup-…` アーティファクトができることを確認する。
6. 失敗時は GitHub の通知メールが届く。リポジトリ所有者の通知設定で Actions の失敗通知をオンにしておく。

### 9.2 復元手順（RTO 4 時間・RPO 24 時間、NFR-AV-04）

**リハーサル**（公開前 1 回、以後月 1 回、AT-28）は、本番の個人情報を staging に複製しないため、**ローカルのクラスタまたは一時的な Neon ブランチ**に復元し、確認後に削除する。

```bash
# 1. アーティファクトを取得（GitHub の Actions 画面からダウンロードして展開してもよい）
gh run list --workflow backup.yml --limit 3
gh run download <run-id> --dir restore
cd "$(dirname "$(find restore -name '*.sha256' | head -n 1)")"
sha256sum -c ./*.sha256

# 2. 復号
age --decrypt -i /path/to/neuer-backup-key.txt -o barber.dump barber-*.dump.age
#   （パスフレーズ方式の場合）gpg --decrypt --output barber.dump barber-*.dump.gpg

# 3. 復元先を用意して復元（例: ローカルのクラスタ。Neon なら一時ブランチ・空 DB の直結 URL）
npm run db:start
psql "$(bash scripts/db-local.sh url | sed 's#/barber_dev$#/postgres#')" -c 'CREATE DATABASE restore_check'
pg_restore --no-owner --no-privileges --exit-on-error --single-transaction \
  -d "$(bash scripts/db-local.sh url | sed 's#/barber_dev$#/restore_check#')" barber.dump

# 4. 確認（件数・制約・マイグレーション履歴）
psql "<復元先 URL>" -c "SELECT conname FROM pg_constraint WHERE conrelid = 'bookings'::regclass AND contype = 'x'" \
  -c "SELECT count(*) FROM drizzle.__drizzle_migrations" \
  -c "SELECT status, count(*) FROM bookings GROUP BY 1 ORDER BY 1"

# 5. 後片付け（個人情報を残さない）
psql "<postgres DB の URL>" -c 'DROP DATABASE restore_check'
rm -f barber.dump
```

- `pg_restore` のバージョンはダンプを作った `pg_dump` 以上にする（ローカルが 16 でダンプが 17 なら PGDG から 17 を入れる）。
- 2026-10-12 にローカル（PostgreSQL 16）で、ワークフローと同じスクリプトで作ったダンプの暗号化・復号・空 DB への復元・`--clean --if-exists` での上書き復元が通ることを確認済み。Neon 上での復元（拡張の DROP/CREATE 権限）は【要実機確認】。
- **本番の復旧**（データ破損・誤操作）は `03_rollback_and_incident.md` §3 の判断表に従う。直近 6 時間以内なら Neon の Instant restore（Free: 6 時間・1 GB まで）を優先し、それより前ならこのダンプから戻す。
- 結果（日付・所要時間・件数）は `05_acceptance_test_plan.md` の AT-28 欄と REL-004 §10 の月次記録に残す。

---

## 10. 独自ドメインへの移行（後日）

コード変更は不要で、`SITE_URL` と DNS・リダイレクトだけで完了する設計（FR-S-10, NFR-MG-01, AT-29）。ただし **パスキーと Push 購読はオリジン（ドメイン）単位**のため、管理 PWA は新ドメインで登録し直す。

1. ドメインを取得する【クライアント】（例 `neuer-barber.jp`。名義はクライアント推奨）。
2. Vercel → Settings → **Domains** → `www.<domain>` を追加（apex を追加すると `www` 追加も促される。`www` を主にし apex から `www` へリダイレクト: ギャップノート §2.9）。
3. ダッシュボードに表示された DNS レコードを登録事業者の DNS に設定する。値は**プロジェクトごとに異なる**（例: apex は A レコード、`www` は CNAME。ドキュメントの例示 `76.76.21.21` / `cname.vercel-dns-0.com` ではなく、画面に出た値を使う: ギャップノート #12）。Valid Configuration・証明書発行を待つ。
4. **`*.vercel.app` → 新ドメインのリダイレクトを手動で設定する**: Domains → `<project>.vercel.app` の **Edit → Redirect to** `www.<domain>`（308）。自動では行われない（ギャップノート #11）。過去に送ったキャンセル URL（`/ja/cancel/<token>`）はパスを保ったまま転送され、そのまま使える。
5. 環境変数 `SITE_URL`（Production）を `https://www.<domain>` に変更 → Redeploy。
6. Turnstile のホスト名に `www.<domain>` と apex を追加する（§7.2）。
7. Resend の送信元を新ドメインで認証し、`RESEND_FROM` を更新する（§2.3 方式 A）。
8. 管理 PWA の再登録（クライアントの iPhone）:
   1. 旧ドメインのホーム画面アイコンで「設定 > 通知」→ 登録端末の「削除」で旧購読を消す（または開発者が後で DB から削除）。
   2. 旧アイコンをホーム画面から削除する。
   3. Safari で `https://www.<domain>/admin` → ホーム画面に追加 → 起動 → メールのコードでログイン → パスキー登録 → 通知をオン → テスト通知。
9. Instagram のプロフィールリンク、Google ビジネスプロフィールの予約 URL を新ドメインに変更する【クライアント】。Search Console にドメインを登録しサイトマップ（`/sitemap.xml`）を送信する。
10. AT-29（既存予約のキャンセル URL が新ドメインで表示される）を確認する。
11. 注意: HSTS（`max-age=63072000; includeSubDomains; preload`）は新ドメインの**全サブドメイン**に HTTPS を強制する。同じドメインで HTTPS でないサブドメインを使う予定があれば事前に相談する。

---

## 11. Vercel Pro / Cloudflare への移行と、Hobby の商用利用で警告を受けたとき

### 11.1 移行先と作業（ADR-0001）

| 作業 | Vercel Pro（約 $20/月） | Cloudflare Workers Paid（$5/月） |
|---|---|---|
| アプリコード | 変更なし | 原則変更なし（`@opennextjs/cloudflare`。事前に 1 日の互換性検証: `proxy.ts`・web-push・Neon 接続・DNS） |
| 環境変数 | そのまま | 同じ値を `wrangler secret put` で設定 |
| DB | 変更なし（Neon） | 変更なし（プール接続または Hyperdrive） |
| Cron | `vercel.json` のまま（毎分精度。21:00 ちょうどに届く） | Cron Triggers に同じ 2 本を登録 |
| WAF | ルールを分割（最大 40） | Cloudflare WAF に同等ルール |
| ドメイン | 変更なし | DNS を Cloudflare へ。`SITE_URL` を更新、管理 PWA を再登録（§10.8） |
| 所要 | 数分（請求先の登録のみ） | 1〜2 日（検証込み） |

### 11.2 警告・停止を受けたときの手順

1. 予約サイトが止まっているかを確認する（本番 URL、Vercel のメール・ダッシュボードの通知）。
2. 止まっている場合は、すぐに Instagram で告知し DM 受付へ切り替える（告知文: `03_rollback_and_incident.md` §4.1）。管理 PWA が動いていれば DM の予約も手動予約で登録する。
3. クライアントに状況を伝え、**Vercel Pro へのアップグレード**（Settings → Billing → Upgrade。支払いはクライアントのカード【クライアント】）の可否を確認する。同じプロジェクトのまま有効になり、URL・環境変数・DB は変わらない。
4. アップグレード後: WAF ルールの分割（§7.3）、Spend Management の上限を低め（例 $30）に設定、計画書 12.2 と ADR-0001 の状態を更新する。
5. Pro にしない場合は Cloudflare への移行（§11.1）。完了まで DM 受付を続ける。
6. 停止期間中に DM で受けた予約が、再開後に管理 PWA にすべて登録されていることを確認する。

---

## 12. 公開当日の手順（M7）

1. `02_prelaunch_checklist.md` が全項目「済」で、未完了項目の扱いが合意済み。
2. `staging` → `main` をマージし、本番デプロイが Ready になる。
3. 公開直後テスト: クライアントの iPhone 以外の実機で本番予約 1 件 → クライアントの iPhone に通知 → 受信箱で確認 → 完了画面のキャンセルリンクでキャンセル → 通知 → 予約が「お客様キャンセル」になる。テスト予約は「入力ミスとして削除」ではなくキャンセル済みのまま残してよい（統計から除外したい場合は開発者が削除）。
4. Actions → Backup を手動実行し、公開時点のバックアップを作る。
5. Instagram のプロフィールリンクに予約サイトの URL を設定する【クライアント】。
6. 公開報告（日時・URL・確認結果）をクライアントに送り、公開後 2 週間の観察（REL-004 §10 の月次項目を週 1 回）を始める。

## 変更履歴

| 版 | 日付 | 内容 |
|---|---|---|
| v0.1 | 2026-10-12 | 初版 |
