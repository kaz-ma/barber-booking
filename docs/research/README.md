# リサーチ（工程2）

2026-10-10 実施。計画書・要件定義書・設計書・ワイヤーフレーム・デザインカンプ作成の根拠となる知識体系。

## 構成

- `reports/美容師予約サイト制作ナレッジ.md` … **統合レポート**。8領域の調査を突き合わせた結論と、デザイン・技術・運用の「採用案 vs 退けた案」判断表。次工程ではまずこれを読む
- `research_notes/美容師予約サイト制作ナレッジ/` … 領域別の調査ノート（各節 Takeaway / Cited Findings / Inferences / Gaps 構成、出典URL付き）
  - `01_visual_design.md` … タイポグラフィ、カラー（コントラスト実測値）、スペーシング、トークン、モーション、バーバー系の表現
  - `02_booking_ux.md` … 段階開示フォーム、カレンダー/時間枠、日本語入力項目、確認・完了画面、キャンセル、アクセシビリティ、多言語
  - `03_market_competitors.md` … 国内予約SaaSの料金・機能、フリーランス美容師の予約運用、電子カルテ製品、インバウンド、料金相場、参考サイト
  - `04_tech_architecture.md` … Next.js 16、DB選定（Neon/Supabase）、排他制約による二重予約防止、空き計算SQL、next-intl、認証、キャンセルトークン、データモデル、独自ドメイン移行
  - `05_pwa_push_admin.md` … iOS/Android の Web Push 要件と既知の問題、Service Worker 実装、通知の信頼性対策、Vercel 制約、管理画面UX
  - `06_code_quality_security.md` … ディレクトリ構成、型安全、テスト戦略、ツール、WCAG 2.2、Core Web Vitals、OWASP/Server Action セキュリティ、個人情報保護法
  - `07_production_process.md` … Web制作工程、要件定義書/設計書の目次、WF・カンプの進め方、評価手法、見積・工程、クライアント合意、公開・運用
  - `08_operations_chat_karte.md` … キャンセル/無断キャンセル対策、祝日、顧客識別、通知戦略、チャット（LINE/Instagram/自前）、電子カルテ、分析
- `reference/` … 店舗HP・参考予約サイトから取得した一次資料（ロゴ、スクリーンショット、料金表、配色）

## 調査上の制約

この環境ではネットワーク制限により多くの公式サイト（Vercel、個人情報保護委員会、Hot Pepper Beauty 等）の本文を直接取得できず、GitHub上の公式リポジトリ・npmレジストリ・検索結果の要約に依拠した部分がある。統合レポート巻末の「調査ギャップ」表に、第2回打ち合わせ前に原典確認すべき項目をまとめている。
