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
  - **一次資料検証ノート（2026-10-10、ネットワーク開放後に公式ページ・法令API・WebKit Bugzilla・npm を直接照合）**
    - `09_gap_infra_tooling.md` … Vercel（Hobby 商用不可、Pro 価格、関数・cron・ログ・WAF・Deployment Protection）、Neon/Supabase 無料枠、Next.js 16.4、Drizzle/Prisma の EXCLUDE、Serwist、web-push、各ツールの無料枠と最新版
    - `09_gap_push_notifications.md` … iOS/Safari Web Push の要件、Declarative Web Push 出荷版の JSON 形式、WebKit Bugzilla の未解決バグ、BCD 突合、LINE/Resend/SMS の料金
    - `09_gap_competitors_design.md` … Hot Pepper Beauty の実機フロー・記号定義・直前枠、RESERVA サンプル、RESERVA/STORES/minimo の公式料金、M3・NN/g・デジタル庁・Practical Typography の原典
    - `09_gap_legal_process_ux.md` … 個人情報保護法（改正時期、公表事項、外国クラウド、令和8年改正）、美容師法、特商法、消費者契約法9条、ベイジ/LIG/Goodpatch、保守相場、Chrome ふりがな自動入力、リマインドの対照研究
    - `09_gap_hosting_alternatives.md` … Vercel Pro / Cloudflare Workers / Netlify / Cloud Run / Render / VPS / Deno / Railway の商用可否・Next.js 16 対応・価格・リージョンの比較と推奨
- `reference/` … 店舗HP・参考予約サイトから取得した一次資料（ロゴ、スクリーンショット、料金表、配色）。2026-10-10 の検証で追加: Hot Pepper Beauty 予約フローのモバイル実機スクリーンショット（`hpb_salon_top_mobile.jpg`、`hpb_step1_coupon_mobile.jpg`、`hpb_step2_top_mobile.jpg`、`hpb_step2_calendar_mobile.jpg`、`hpb_step2_legend_mobile.jpg`、`hpb_step2_full_tel_cuffia.jpg`、`hpb_step2_full_tel_sunflat.jpg`、`hpb_step3_login_mobile.jpg`）、RESERVA の料金ページ・予約ページ（`reserva_biz_price_desktop.jpg`、`reserva_glock_mobile_step0.jpg`、`reserva_glock_mobile_desktopua_step0.jpg`、`reserva_sample_plantation_mobile.jpg`、`reserva_sample_plantation_step1_mobile.jpg`）

## 調査上の制約と検証状況

初回調査時（01〜08 ノート）はネットワーク制限により多くの公式サイト（Vercel、個人情報保護委員会、Hot Pepper Beauty 等）の本文を直接取得できず、GitHub上の公式リポジトリ・npmレジストリ・検索結果の要約に依拠した部分があった。その後ネットワークを開放し、2026-10-10 に 5 本の検証ノート（`09_gap_*`）で原典を直接照合して、確認済み・訂正・未解決を判定した。主な訂正は「Vercel Hobby は商用利用不可（本番は Pro）」「Declarative Web Push の出荷版は `web_push: 8030` 形式で Content-Type 要件なし」「HPB の記号は ◎○× で △ なし」「5,000 件以下事業者の除外撤廃は 2017 年施行の平成 27 年改正」で、統合レポート・計画書・要件定義書（いずれも v0.2）に反映済み。なお残る未解決項目（HPB の締切分数、RESERVA の日時画面、サロンボードのリマインド仕様、iOS 26.x の前面通知・`app_badge` 位置・`navigate` 挙動の実機検証、PPC のアレルギー情報の見解、特商法の適用など）は統合レポート巻末の「調査ギャップの検証結果」の未解決表にまとめている。
