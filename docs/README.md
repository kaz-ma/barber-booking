# docs/ — プロジェクト文書

Neuer Barber 長田健豊 様向け「予約サイト（JP/EN）＋管理 PWA」制作プロジェクトの文書一式。工程順にフォルダを分け、各文書は Markdown（図は Mermaid）で管理する。

## フォルダ構成

| フォルダ | 内容 | 状態 | 主な文書 |
|---|---|---|---|
| `research/` | 工程 2 の調査資料。統合レポート、領域別調査ノート（8 本）、店舗 HP・参考予約サイトから取得した一次資料 | 作成済み | `research/README.md`、`research/reports/美容師予約サイト制作ナレッジ.md`、`research/reference/README.md` |
| `01_plan/` | プロジェクト計画書。目的・KPI・スコープ・体制・工程（ガント）・成果物・リスク・コミュニケーション・変更管理・費用・第 2 回打ち合わせアジェンダ | ドラフト v0.1 | `01_plan/project_plan.md`。今後 `pricing.md`（価格表）、`open_issues.md`（確認事項リスト）、`change_requests.md`、`minutes/`（議事録）を追加予定 |
| `02_requirements/` | 要件定義書。背景・用語・スコープ（MoSCoW）・ペルソナとユースケース・業務フロー・機能要件（FR-C / FR-A / FR-S）・画面一覧・非機能要件（IPA 6 大項目）・データ要件・外部連携・法務・未決事項・受入基準 | ドラフト v0.1 | `02_requirements/requirements.md`。今後 `legal/`（プライバシーポリシー・キャンセルポリシー JA/EN）を追加予定 |
| `03_design/` | 設計書一式。構成図、サイトマップ、画面一覧、画面遷移図、画面仕様、ER 図、状態遷移図、API 一覧（Server Action / Route Handler）、コンポーネント一覧、セキュリティ設計、ADR | 予定（WF 承認まで） | `00_overview.md` 〜 `09_security.md`、`adr/0001-*.md` |
| `04_wireframes/` | ワイヤーフレーム（グレースケール 390×844 の HTML 原本と書き出し画像、コンタクトシート、共通キット `wf.css`、描画・検証スクリプト `tools/`）。顧客サイト 8 ファイル 27 状態、管理 PWA 10 ファイル 39 状態 | WF v0.1（M3 承認待ち） | `04_wireframes/README.md`、`customer_flow.md`（WF-C）、`admin_flow.md`（WF-A）、`screens/` |
| `05_design_comps/` | デザイン提案書（スタイルタイル 2〜3 案）、ベースデザイン 3 画面、全画面カンプ、管理 PWA 主要画面、デザインガイド（トークン・タイポグラフィ・カラー・モーション） | 予定（第 2 回打ち合わせ〜） | — |
| `06_test/` | 評価レポート（WF の認知的ウォークスルー＋簡易ヒューリスティック評価を作成済み。5 秒テスト・カンプのヒューリスティック評価・ユーザビリティテストを追加予定）。テスト仕様書・結果、Lighthouse / axe レポート、不具合一覧は実装〜検収で追加 | 評価 EVAL-001 v0.1。テスト仕様は予定（実装〜検収） | `06_test/README.md`、`evaluation/cognitive_walkthrough_wf.md` |
| `07_release/` | 公開手順書（環境変数一覧・バックアップ復元・独自ドメイン／Pro 移行を含む）、公開前チェックリスト、ロールバック・障害対応手順、運用マニュアル（店主向け、日本語版）、受入テスト計画（AT-01〜31）。運用設計書・保守契約案・運用マニュアル英語版は追加予定。関連: `.github/workflows/backup.yml`、`renovate.json` | REL-001〜005 v0.1（2026-10-12） | `07_release/README.md`、`01_deploy_guide.md`、`02_prelaunch_checklist.md`、`03_rollback_and_incident.md`、`04_operations_manual.md`、`05_acceptance_test_plan.md` |

## 読む順序

1. `research/reports/美容師予約サイト制作ナレッジ.md` — 判断の根拠（デザイン・技術・運用の採用案と退けた案）
2. `01_plan/project_plan.md` — 目的、スコープ、工程、未決事項
3. `02_requirements/requirements.md` — 機能・非機能・データ・法務の要件と受入基準
4. 以降は工程順に `03_design/` → `04_wireframes/` → `05_design_comps/` → `06_test/` → `07_release/`

## 表記ルール

- 【要確認】: クライアントとの打ち合わせで確認・確定する事項。確定したら本文を更新し、変更履歴に記録する。
- ID 体系: 計画書の KPI-xx / R-xx（リスク）/ Q-xx（打ち合わせ確認事項）、要件定義書の FR-C-xx（顧客）/ FR-A-xx（管理）/ FR-S-xx（システム）/ NFR-xx-xx（非機能）/ S-C-xx・S-A-xx（画面）/ OI-xx（未決事項）/ AT-xx（受入基準）。設計書・テスト仕様書はこれらの ID を参照してトレーサビリティを保つ。
- 根拠の明示: 調査結果に基づく要件には「根拠: 統合レポート『節名』」または「研究ノート NN」を付記する。
- 価格・営業時間などクライアント固有の数値は、確定するまで仮置きと参考値（店舗 HP）を区別して記載する。
