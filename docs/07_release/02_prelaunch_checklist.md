# 02 公開前チェックリスト

## 文書情報

| 項目 | 内容 |
|---|---|
| 文書 ID | REL-002 |
| 版 | v0.1 |
| 日付 | 2026-10-12 |
| 使い方 | M6（検収合格）後、M7（公開 Go/No-Go）までに上から実施する。結果欄に「済 / 日付 / 実施者」または「NG → 対応」を書く。重大項目（★）が 1 つでも NG なら公開しない |
| 関連 | REL-001（公開手順書）、REL-005（受入テスト計画）、要件定義書 15 章、DES-08 |

表記: 担当 = 開 (開発者) / ク (クライアント) / 両。【クライアント】= クライアントから受け取る・決めてもらう事項。【要実機確認】= 実機・ダッシュボードでのみ確認できる事項。`<SITE>` は本番の `SITE_URL`（例 `https://neuer-barber.vercel.app`）。

---

## A. ビルドと CI

| # | 項目 | 確認方法 | 担当 | 結果 |
|---|---|---|---|---|
| A1 ★ | `main` の CI が緑 | GitHub → Actions → CI（`npm audit --omit=dev --audit-level=high`、typecheck、lint、`npm test`、build） | 開 | |
| A2 | E2E が通る | ローカルで `node test/e2e/run.mjs`（6 シナリオすべて pass） | 開 | |
| A3 ★ | 本番デプロイが Ready、ビルドログに env 検証エラー・警告なし | Vercel → Deployments → 最新の Production → Build Logs | 開 | |
| A4 | Next.js が 16.4.x の最新パッチ（2026-10-14 のセキュリティ更新を含む） | `npm view next@16.4 version` と `package.json` を比較 | 開 | |
| A5 | Node.js 24.x でビルドされている | Build Logs 冒頭の Node バージョン | 開 | |

## B. データベース

| # | 項目 | 確認方法 | 担当 | 結果 |
|---|---|---|---|---|
| B1 ★ | マイグレーション 4 本が適用済み | Neon SQL Editor（`main`）: `SELECT id, created_at FROM drizzle.__drizzle_migrations ORDER BY id;` → 4 行（0000〜0003） | 開 | |
| B2 ★ | 排他制約 `bookings_no_overlap` が存在する | 下の SQL 1 → 1 行、定義に `EXCLUDE USING gist (resource_id WITH =, during WITH &&) WHERE (status = ANY …confirmed, arrived, in_progress…)`。`psql` なら `\d bookings` の Indexes 欄に `"bookings_no_overlap" EXCLUDE USING gist …` | 開 | |
| B3 | 拡張 `btree_gist`・`pg_trgm` | `SELECT extname, extversion FROM pg_extension WHERE extname IN ('btree_gist','pg_trgm');` → 2 行 | 開 | |
| B4 | 半開区間 CHECK とトリガ | 下の SQL 2 → `bookings_during_half_open` と `bookings_updated_at` など 4 トリガ | 開 | |
| B5 | `drizzle-kit push` を使っていない | 作業記録で確認（使った場合は B2 が消えていないか再確認） | 開 | |

```sql
-- SQL 1: 排他制約
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'bookings'::regclass AND contype = 'x';

-- SQL 2: CHECK とトリガ
SELECT conname FROM pg_constraint WHERE conrelid = 'bookings'::regclass AND conname = 'bookings_during_half_open';
SELECT tgname FROM pg_trigger WHERE NOT tgisinternal ORDER BY tgname;
```

## C. 初期データ（seed）と店舗情報

| # | 項目 | 確認方法 | 担当 | 結果 |
|---|---|---|---|---|
| C1 ★ | 全メニューの価格・学生価格・所要時間・バッファが確定値 | 管理 PWA「設定 > メニュー」で 9 件を確認。価格表（`01_plan/pricing.md`）と照合【クライアント: OI-01・OI-07 の回答】 | 両 | |
| C2 ★ | 価格 0 円のメニューが公開されていない | `SELECT slug, price_jpy, is_active FROM menus ORDER BY sort_order;` で `is_active = true` かつ `price_jpy = 0` の行がない | 開 | |
| C3 | 営業時間・定休日・締切・先行予約上限・セルフキャンセル締切が確定値 | 「設定 > 営業時間」のプレビュー文と、トップのアクセス欄（受付時間・定休・予約締切）【クライアント: OI-02/03/06】 | 両 | |
| C4 | 年末年始など既知の臨時休業が登録済み | 「設定 > 営業時間 > 臨時休業・時間変更」【クライアント】 | ク | |
| C5 | 管理者ユーザーが 1 件だけ | `SELECT email FROM auth_user;` → `ADMIN_EMAIL` の 1 行 | 開 | |
| C6 ★ | テスト用の予約・顧客が本番 DB に残っていない（公開直後テストの分を除く） | `SELECT count(*) FROM bookings; SELECT count(*) FROM customers;` | 開 | |
| C7 | Instagram アカウント `@neuer.kento` が正しく、DM が受け取れる | トップ・完了画面・キャンセル締切後・フッターのリンクを実機でタップ → DM 画面が開く（`https://ig.me/m/neuer.kento`）【クライアント: OI-23 確定済みの再確認】 | 両 | |
| C8 | Google マップのリンクが店舗の位置を指す | トップのアクセス欄・完了画面の地図リンクを実機で開く（`src/config/shop.ts` の `mapUrl`）。ビル名・階まで正しいか【クライアント】 | 両 | |
| C9 | ヒーロー写真・ロゴが本番素材 | トップを目視。仮の CSS プレースホルダのままでないか（`shop.heroPhoto`）【クライアント: 写真の受領】 | 両 | |
| C10 | 英語表記（店名・担当者名・住所）が確定値 | `/en` を目視【クライアント: OI-08】 | 両 | |

## D. 環境変数

| # | 項目 | 確認方法 | 担当 | 結果 |
|---|---|---|---|---|
| D1 ★ | REL-001 §6 の必須変数が Production に全部ある | Vercel → Settings → Environment Variables を表と照合（A3 のビルド成功でも検出されるが、`RESEND_API_KEY`・`ADMIN_EMAIL` は任意扱いのため目視） | 開 | |
| D2 ★ | `SITE_URL` が公開オリジンと完全一致、末尾スラッシュなし | 完了画面のキャンセル URL・ICS の URL のホストが `<SITE>` | 開 | |
| D3 | Production と Preview で秘密値が別 | `BETTER_AUTH_SECRET`・`VAPID_*`・`CRON_SECRET`・`PII_HASH_SECRET` | 開 | |
| D4 | `SKIP_ENV_VALIDATION` が設定されていない | 同上 | 開 | |
| D5 | 秘密値の保管場所が運用マニュアルのアカウント一覧に記載済み | REL-004 §12 | 開 | |

## E. セキュリティヘッダーと CSP

| # | 項目 | 確認方法 | 担当 | 結果 |
|---|---|---|---|---|
| E1 ★ | 共通ヘッダー（NFR-SC-06） | `curl -sI <SITE>/ja` に `strict-transport-security: max-age=63072000; includeSubDomains; preload`、`x-content-type-options: nosniff`、`referrer-policy: strict-origin-when-cross-origin`、`x-frame-options: DENY`、`permissions-policy: camera=(), microphone=(), geolocation=()`、`cross-origin-opener-policy: same-origin` があり、`x-powered-by` がない | 開 | |
| E2 | 本番に `x-robots-tag: noindex` が付いていない（staging には付く） | `curl -sI <SITE>/ja \| grep -i x-robots` → 出力なし。staging は `noindex` | 開 | |
| E3 | トークン付きページのヘッダー | `curl -sI <SITE>/ja/cancel/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`（43 文字のダミー）に `referrer-policy: no-referrer`、`x-robots-tag: noindex, nofollow`、`cache-control: private, no-store` | 開 | |
| E4 | `/admin` は nonce 付きの強制 CSP、公開ページは Report-Only | `curl -sI <SITE>/admin/login \| grep -i content-security` → `content-security-policy:`（`nonce-` を含む）。`/ja` → `content-security-policy-report-only:` | 開 | |
| E5 | CSP Report-Only の違反を 1 週間確認 | staging と本番で主要画面（トップ、予約 4 ステップ、完了、キャンセル、ポリシー）を開き、ブラウザの DevTools Console に CSP 違反がないこと。`SENTRY_CSP_REPORT_URI` 設定時は Sentry の Security 画面 | 開 | |
| E6 | CSP を強制に切り替える（E5 が 1 週間クリーンになってから。公開後でもよい） | `next.config.ts` のヘッダー名を `Content-Security-Policy` に変え `upgrade-insecure-requests` を追加 → staging で E5 を再確認 → 本番へ（AT-26） | 開 | |
| E7 | 管理 Server Action・Cron が未認証で拒否される | `curl -s -o /dev/null -w '%{http_code}' <SITE>/api/cron/daily-digest` → 401。`curl -s -o /dev/null -w '%{http_code}' <SITE>/api/admin/inbox-count` → 401（AT-27） | 開 | |

## F. 濫用対策

| # | 項目 | 確認方法 | 担当 | 結果 |
|---|---|---|---|---|
| F1 | Turnstile のホスト名に本番が登録済み | Cloudflare → Turnstile → ウィジェット → Hostnames | 開 | |
| F2 | WAF ルール `booking-abuse-coarse` が Published | Vercel → Firewall。`for i in $(seq 1 35); do curl -s -o /dev/null -w '%{http_code} ' <SITE>/ja/cancel/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA; done` で 429 が返る（アプリ側の 10 回/分で先に 429 になる。どちらの 429 かは Firewall の Traffic で確認） | 開 | |
| F3 | Vercel Authentication が Preview に有効、本番は公開 | シークレットウィンドウで staging URL → Vercel のログイン画面。本番 URL → そのまま表示 | 開 | |
| F4 | 検収用に外した Deployment Protection Exception を元に戻した | Settings → Deployment Protection | 開 | |

## G. SEO・共有

| # | 項目 | 確認方法 | 担当 | 結果 |
|---|---|---|---|---|
| G1 | `robots.txt` | `curl -s <SITE>/robots.txt` → `Disallow: /admin` と `Disallow: /api/`、`Sitemap: <SITE>/sitemap.xml`（トークン付きページ・予約途中は robots ではなく `X-Robots-Tag` で除外: E3） | 開 | |
| G2 | `sitemap.xml` | `curl -s <SITE>/sitemap.xml` → `/ja`・`/en` それぞれのトップ・`/book`・`/privacy`・`/policy`・`/tokusho`（計 10 URL）が `<SITE>` の絶対 URL で並び、`xhtml:link hreflang` が ja / en / x-default | 開 | |
| G3 | hreflang・canonical | `curl -s <SITE>/ja \| grep -E 'hreflang\|canonical'` → `ja`・`en`・`x-default` | 開 | |
| G4 | 構造化データ（`HairSalon`、`telephone` なし） | Google リッチリザルト テストに `<SITE>/ja` を入力 | 開 | |
| G5 | OGP・favicon・ホーム画面アイコン | LINE / Instagram DM に URL を貼ってプレビューを確認。タブのアイコン | 両 | |
| G6 | 404 が日本語・英語で出てトップへ戻れる | `<SITE>/ja/xxx`、`<SITE>/en/xxx` | 開 | |
| G7 | Search Console 登録とサイトマップ送信（公開当日） | Search Console → URL プレフィックス `<SITE>` → 所有権確認 → サイトマップ送信【クライアント: Google アカウント】 | 両 | |

## H. 性能・アクセシビリティ

| # | 項目 | 確認方法 | 担当 | 結果 |
|---|---|---|---|---|
| H1 | Lighthouse（モバイル）: トップと `/ja/book` で performance ≥ 90、accessibility = 100、LCP ≤ 2.5 s、CLS ≤ 0.1（AT-24） | Chrome DevTools → Lighthouse（Mobile、シークレットウィンドウ）または PageSpeed Insights。CI には未組み込み（NFR-OP-07 の残課題） | 開 | |
| H2 | axe: 重大・深刻な違反 0（AT-25） | axe DevTools 拡張で トップ、予約 4 ステップ、完了、キャンセル、ポリシー、`/en` | 開 | |
| H3 | VoiceOver で予約を 1 件完了できる | iPhone の VoiceOver で `/ja` → 完了まで | 開 | |
| H4 | 冷起動時もエラーにならない | Neon が 5 分以上アイドルの後に `/ja/book/time?menu=…` を開く → スケルトン表示の後に枠が出る（NFR-AV-02） | 開 | |

## I. 法務・ポリシー

| # | 項目 | 確認方法 | 担当 | 結果 |
|---|---|---|---|---|
| I1 ★ | プライバシーポリシー（JA/EN）が確定文面 | `/ja/privacy`・`/en/privacy` を要件定義書 12.1 と照合。**外国にある第三者（米国のクラウド事業者: Vercel Inc.・Neon・Cloudflare, Inc.・Resend・Sentry（導入時））への提供と保存場所の明記**、利用目的、保存期間（最終来店から 3 年で匿名化）、開示・削除の窓口（Instagram DM）【クライアント: 文面の承認】 | 両 | |
| I2 ★ | キャンセルポリシーが確定文面 | `/ja/policy`・`/en/policy`。締切（既定: 開始 2 時間前）と管理画面の「セルフキャンセル締切」が一致、締切後は Instagram DM【クライアント: 要件定義書 12.2 の確定】 | 両 | |
| I3 ★ | 特定商取引法に基づく表記が確定文面 | `/ja/tokusho`。事業者名・所在地・電話番号は「請求があれば遅滞なく開示」方式（要件定義書 12.4 G3）【クライアント】 | 両 | |
| I4 | ポリシー改定時の版 | `src/config/shop.ts` の `POLICY_VERSION` が最終文面の日付（同意記録 `consents` に保存される） | 開 | |
| I5 | 顧客ページに電話番号・`tel:` リンクがない（OI-10） | `curl -s <SITE>/ja \| grep -c 'tel:'` → 0（`/en`・完了・キャンセル・ポリシーも） | 開 | |

## J. 時刻（JST）

| # | 項目 | 確認方法 | 担当 | 結果 |
|---|---|---|---|---|
| J1 ★ | 23:30 JST に当日の枠が正しい | 営業日の 23:30 JST（14:30 UTC）に `/ja/book/time` を開く → 月カレンダーの「今日」が JST の当日、締切（60 分前）以降の枠がなく、23:30 開始の枠（閉店をまたぐ）が出ない | 開 | |
| J2 ★ | 00:00 JST をまたいで日付が切り替わる | 00:00〜00:30 JST（15:00〜15:30 UTC、UTC ではまだ前日）に開く → 「今日」が翌日に移り、前日が過去日として非活性 | 開 | |
| J3 | 09:00 JST（UTC の日付境界）で枠がずれない | 09:00 前後に同じ日の枠一覧を比べ、同一 | 開 | |
| J4 | 24:00 終了の表示 | 23:00 開始・60 分の予約の完了画面・ICS が「23:00–24:00」（翌日 0:00 にならない）、ICS をカレンダーに取り込むと正しい時刻 | 開 | |
| J5 | `/en` は 12 時間表記で JST を明記 | `/en/book/time` | 開 | |

## K. 本番での通し確認（実機）

| # | 項目 | 確認方法 | 担当 | 結果 |
|---|---|---|---|---|
| K1 ★ | 本番で予約 1 件を完了（実機・本物の電話番号） | 開発者の iPhone/Android で `/ja` → 予約 → 完了画面が 1 画面、ICS 追加、キャンセルリンクの共有 | 開 | |
| K2 ★ | 予約通知がクライアントの iPhone に 10 秒以内に届く | K1 の直後。受信箱の未確認 +1、アプリ起動で解消（AT-15） | 両 | |
| K3 ★ | キャンセルが通知され、枠が空きに戻る | K1 の完了画面のキャンセルリンク → キャンセル → 通知 → `/ja/book/time` で枠が ◎ に戻る | 両 | |
| K4 | `/en` で海外番号（`+44…`）の予約 | AT-02 の短縮版 | 開 | |

## L. 管理 PWA（クライアントの iPhone）

| # | 項目 | 確認方法 | 担当 | 結果 |
|---|---|---|---|---|
| L1 ★ | 本番ドメインでホーム画面に追加し、アイコンから standalone で起動 | REL-004 §1 の手順。URL バーがない（AT-12） | ク | |
| L2 ★ | メールのコードでログイン → パスキー登録 → 次回 Face ID でログイン | 6 桁コードが届く（Resend）。「設定 > 通知 > パスキー」に登録済み 1 件以上（AT-13） | ク | |
| L3 ★ | 通知をオン → テスト通知がアプリ閉・開・ロック画面で届く | 「設定 > 通知 > テスト通知を送る」→「届いた」（AT-14） | ク | |
| L4 | 予備の端末（あれば）にもパスキーを登録 | iPad など【クライアント】 | ク | |
| L5 | 日次サマリーが 21 時台に届く | 公開前日〜当日の 21:00〜21:59（AT-23） | ク | |

## M. 運用準備

| # | 項目 | 確認方法 | 担当 | 結果 |
|---|---|---|---|---|
| M1 ★ | バックアップワークフローが 1 回成功 | Actions → Backup → 手動実行 → 緑、`db-backup-…` アーティファクトあり（REL-001 §9.1） | 開 | |
| M2 ★ | 復元リハーサル 1 回（AT-28） | REL-001 §9.2。所要時間と件数を記録 | 開 | |
| M3 ★ | ロールバックのリハーサル | staging または本番で、無害な変更（文言 1 か所）をデプロイ → Deployments で 1 つ前に **Instant Rollback** → 表示が戻る → 「Undo Rollback」または次のデプロイを Promote して自動割当を戻す（REL-003 §1） | 開 | |
| M4 | 監視 | Vercel のメール通知（デプロイ失敗・使用量）をオン、GitHub Actions の失敗通知をオン。Sentry（FR-S-11）は未実装のため、公開後 2 週間は毎朝 Vercel の Logs（保持 1 時間）ではなく受信箱・`notification_log` を確認する運用で補う【監視スライスの実装時期を決める】 | 開 | |
| M5 | 外形監視（任意） | 無料の外形監視（Sentry Uptime など）で `<SITE>/ja` を 5 分間隔 | 開 | |
| M6 | 使用量の初期値を記録 | Vercel → Usage、Neon → Usage（CU-hours・Storage）。REL-004 §10 の表に公開日の値を記入 | 開 | |
| M7 | 運用マニュアルのレクチャー実施、アカウント一覧の名義確定 | REL-004 を使って 30〜60 分（AT-31）【クライアント: OI-15】 | 両 | |
| M8 | 障害時の告知文をクライアントの端末に保存 | REL-003 §4.1 の文面をメモアプリに保存 | ク | |
| M9 | Renovate の導入 | GitHub App「Renovate」をリポジトリにインストール → オンボーディング PR が `renovate.json` を認識（NFR-OP-04） | 開 | |

## Go/No-Go 判定

| 判定 | 条件 | 署名・日付 |
|---|---|---|
| Go | ★ がすべて済、その他の NG は公開後の対応期限が決まっている | 開発者: ／ クライアント: |
| No-Go | ★ に NG がある | 理由と再判定日: |

## 変更履歴

| 版 | 日付 | 内容 |
|---|---|---|
| v0.1 | 2026-10-12 | 初版 |
