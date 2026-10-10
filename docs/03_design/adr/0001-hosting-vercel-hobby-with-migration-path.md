# ADR-0001: Phase 1 のホスティングは Vercel Hobby とし、Pro／Cloudflare へ環境変数と DNS だけで移れる設計にする

## 文書情報

| 項目 | 内容 |
|---|---|
| ID | ADR-0001 |
| 版 | v0.1 |
| 日付 | 2026-10-10 |
| ステータス | Accepted（計画書 v0.3 A-08 で決定済み） |
| 決定者 | 開発者、長田健豊 様 |
| 関連要件 | PRE-05, PRE-08, CON-02, NFR-EN-01, NFR-MG-01, NFR-AV-05, NFR-PF-06, FR-A-12, FR-S-04, FR-S-10, FR-S-13, OI-18 |

## コンテキスト

- 予約サイトは Next.js 16.4（`proxy.ts`、Cache Components、Server Actions、`after()`）と Node `crypto` を使う Web Push 送信を前提とする。
- Vercel Hobby は Fair Use Guidelines で「non-commercial personal use only」とされ、営業中のサービス予約サイトは商用に当たりうる（規約リスク）。要件定義書 PRE-08 は Pro 前提だが、計画書 v0.3 で「本案件は無償制作であり、規約リスクを開発者・クライアントが了承のうえ Phase 1 本番を Hobby で運用する。警告・停止時は Pro または Cloudflare Workers Paid へ移行する」と決定した。
- Hobby の制約: Cron は 1 日 1 回・±59 分、WAF Rate Limiting は 1 ルール、ランタイムログ 1 時間、Instant Rollback は直前 1 件、同梱量超過時は機能が 30 日停止。

## 決定ドライバー

1. 月額固定費ゼロ（無償案件）。
2. Next.js 16 の機能を互換性リスクなしで使えること。
3. 規約上の警告・停止が起きた場合に、数時間以内に別プランへ移れること。
4. ドメイン移行（`*.vercel.app` → 独自ドメイン）でコード変更が要らないこと。

## 検討した選択肢

| 選択肢 | 月額 | 互換性 | 規約 | 運用 |
|---|---|---|---|---|
| A. Vercel Hobby（Phase 1）＋移行経路を設計に組み込む | 0 円 | 最良 | リスクあり（了承済み） | 最簡 |
| B. Vercel Pro（hnd1） | 約 $20 | 最良 | 問題なし | 最簡 |
| C. Cloudflare Workers Paid＋`@opennextjs/cloudflare` | $5 | `proxy.ts` は experimental、web-push・Images・Neon 接続に検証要 | 問題なし | DNS 移管・事前検証 1 日 |
| D. Google Cloud Run | 従量（小） | 高い | 問題なし | Dockerfile・IAM・Scheduler・独自ドメインの手間 |

## 決定

**選択肢 A を採用する。** 設計は Hobby の制約を「最小公約数」として全 Must を成立させ、移行は次の作業だけで完了するようにする。

| 移行作業 | Pro へ | Cloudflare へ |
|---|---|---|
| アプリコード | 変更なし | 変更なし（事前検証で問題が出た箇所のみアダプタ設定） |
| 環境変数 | 同じ値を設定 | 同じ値を `wrangler secret` に設定 |
| DB | 変更なし（Neon） | 変更なし（Neon。接続は Hyperdrive またはプール接続） |
| Cron | `vercel.json` のまま（毎分精度になり 21:00 ちょうど） | Cron Triggers に同じ 2 本を登録 |
| WAF | ルールを分割（最大 40） | Cloudflare WAF に同等ルール |
| ドメイン | 変更なし、または `SITE_URL`＋DNS | DNS を Cloudflare へ、`SITE_URL` 更新 |

設計上の担保:

- 絶対 URL はサーバー専用 `SITE_URL` から `absoluteUrl()` で生成し、DB にドメインを保存しない（FR-S-10）。
- 日次処理は 1 日 1 回で成立する設計（日次サマリー 21 時台、保存期間ジョブ 3 時台）。
- レート制限の本体はアプリ側（Postgres）で、WAF は粗い前段（Hobby 1 ルール）。
- バックアップは GitHub Actions（ホスティング非依存）。監査ログは DB（ログ保持 1 時間に依存しない）。
- 関数リージョンは `hnd1`、Neon は `aws-ap-northeast-1`。

## 結果

良い点:

- 固定費 0 円で Next.js 16 の全機能を使える。
- 移行時にアプリの改修が不要で、障害時の切替が手順書化できる。

悪い点・受容するリスク:

- 規約に基づく警告・停止の可能性（T-19）。停止から移行完了まで数時間、予約を電話受付に切り替える。
- 日次サマリーは 21:00〜21:59 の不定時刻（FR-A-12 の ±1 分は Pro 移行後に満たす。00_overview.md G-02）。
- ロールバックは直前 1 件のみ、ランタイムログ 1 時間（Sentry と `audit_log` で補う）。
- 同梱量（Function Invocations 1M、Active CPU 4 時間など）を超えると 30 日停止するため、月次で使用量を確認し 80% で Pro 移行を判断する。
- ドメイン移行時、管理 PWA は新オリジンで「ホーム画面に追加」・パスキー登録・通知購読をやり直す必要がある（Web Push 購読と WebAuthn はオリジン単位）。

## 代替案の評価

- B（Pro）: 技術的には最善だが、無償案件で月額の負担者がいない。有償案件では最初から B を使う（計画書 A-08）。
- C（Cloudflare）: 安価だが `proxy.ts` 対応が experimental、web-push の `nodejs_compat` 動作・Images binding・DNS 移管の事前検証が必要。Hobby 停止時の移行先候補として残す。
- D（Cloud Run）: 互換性は高いが 1 人運用の負荷が規模に見合わない。

## 関連

- 計画書 A-08, C-01, R-03, Q-14、要件定義書 OI-18
- 統合レポート『ホスティングは Vercel Pro（東京）を第一候補、Cloudflare Workers Paid を代替にする』
- `09_gap_infra_tooling.md` §2、`09_gap_hosting_alternatives.md`
- 00_overview.md 2.2・4 章、08_security.md 6.2・T-13・T-19
