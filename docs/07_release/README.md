# 07_release — 公開・運用文書

予約サイト（`/ja` `/en`）と管理 PWA（`/admin`）を Vercel Hobby＋Neon Free で公開し、運用・引継ぎするための文書一式。設計（`docs/03_design/`）と要件定義書 15 章の受入基準を前提にする。

## 文書一覧

| ID | 文書 | 内容 | 読む人 | 使う時期 |
|---|---|---|---|---|
| REL-001 | [01_deploy_guide.md](01_deploy_guide.md) | 公開手順書。アカウント・秘密値の準備、Vercel / Neon / Turnstile / Resend の設定、環境変数一覧、マイグレーションと seed、Cron・WAF・Deployment Protection、staging、バックアップと復元、独自ドメイン移行、Pro / Cloudflare 移行、Hobby 規約の警告時の手順 | 開発者 | M5 前（staging）、M7（公開）、移行時 |
| REL-002 | [02_prelaunch_checklist.md](02_prelaunch_checklist.md) | 公開前チェックリスト（確認方法・担当・結果欄、Go/No-Go 判定） | 開発者・クライアント | M6〜M7 |
| REL-003 | [03_rollback_and_incident.md](03_rollback_and_incident.md) | ロールバック（Hobby は直前 1 件）、DB の前進修正と復旧、障害対応ランブック（サイト停止・通知不達・二重予約の疑い・Neon / Vercel の上限・端末紛失） | 開発者（§4 はクライアントも） | 障害時、M7 前のリハーサル |
| REL-004 | [04_operations_manual.md](04_operations_manual.md) | 運用マニュアル（店主向け）。毎日の流れ、DM 予約の登録、ブロック、休業・メニュー変更、通知トラブル、お客様の見え方、キャンセル・無断の扱い、個人情報の依頼、月次確認、やってはいけない操作、アカウント一覧 | クライアント | M8 のレクチャー以降 |
| REL-005 | [05_acceptance_test_plan.md](05_acceptance_test_plan.md) | 受入テスト計画。AT-01〜AT-31 を自動テスト・E2E・実機手順に対応づけ、M5 / M6 の結果記録表 | 開発者・クライアント | M5〜M6 |

## 関連ファイル（リポジトリ）

| ファイル | 役割 | 関連 |
|---|---|---|
| `.github/workflows/backup.yml` | 日次 `pg_dump --format=custom` → age（または gpg）で暗号化 → Actions アーティファクト 30 日保持。手動実行可 | FR-S-08, NFR-OP-01, REL-001 §9 |
| `renovate.json` | 依存更新（週 1 回、`minimumReleaseAge` 7 日、devDependencies の patch/minor は自動マージ、Actions は SHA 固定、exact version 維持） | NFR-OP-04, NFR-SC-08 |
| `vercel.json` | Cron 2 本（日次サマリー 21 時台、保存期間ジョブ 3 時台。Hobby は ±59 分） | FR-A-12, FR-S-09 |
| `.env.example` / `src/lib/env.ts` | 環境変数の一覧と検証（欠けるとビルド失敗） | DES-00 §4, REL-001 §6 |

## 表記

- 【クライアント】: クライアントから受け取る・決めてもらう事項（価格、名義、文面の承認、端末など）。
- 【要実機確認】: ダッシュボード・実機でしか確かめられない事項。初回作業時に結果を本文へ書き戻し、変更履歴に記録する。
- Vercel / Neon の制限値は `docs/research/research_notes/美容師予約サイト制作ナレッジ/09_gap_infra_tooling.md`（2026-10-10 に公式ページで確認）を根拠にする。値が変わっていたら同ノートと本書を更新する。

## 今後追加する文書

- 運用マニュアル英語版（NFR-OP-05、M8 まで）、スクリーンショット（【画像】の箇所）。
- 運用設計書・保守契約案（計画書 7 章の成果物。保守契約の範囲が決まり次第）。
