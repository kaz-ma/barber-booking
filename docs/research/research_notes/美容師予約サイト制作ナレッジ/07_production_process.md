# 07. Web制作の標準プロセスと成果物ドキュメント（計画書〜運用まで）

> 調査日: 2026-10-10 / 調査環境の制約: 本セッションでは直接のページ取得（curl/WebFetch）が組織ポリシーにより github.com / raw.githubusercontent.com 以外ほぼ全て遮断（HTTP 403）されたため、日本語Web記事（ベイジ、LIG、Vercel docs、NN/g 等）は WebSearch の結果要約・抜粋に基づく。GitHub 上の一次資料（Lighthouse CI、axe-core、ADR、Front-End Checklist）は全文取得済み。途中で WebSearch の回数上限にも達したため、未調査事項は各節の「Gaps」に明記した。
>
> 対象案件: フリーランス開発者が美容師（個人サロン）向けに「予約サイト＋管理PWA」を受託。2回目の打ち合わせで価格表とデザイン案を提示予定。後続フェーズに顧客チャット・電子カルテ。

---

## KQ1. 日本のWeb制作標準ワークフロー（企画→要件定義→設計→デザイン→実装→テスト→公開→運用）と各フェーズの成果物

### Takeaway
日本の制作会社（ベイジ、LIG）は共通して「戦略/企画 → 要件定義 → 設計（サイトマップ・ワイヤーフレーム）→ デザイン（ベースデザイン1案で方向合意→展開）→ 実装 → テスト（10〜15日程度）→ 公開 → 運用」という直線的工程を採り、各工程末にクライアント合意（レビュー）を置く。成果物は「要件定義書／サイトマップ／ワイヤーフレーム／デザインカンプ／テスト結果／運用設計書」が定番で、要件定義で決めた内容は後工程で変えにくいため、合意形成を最重視している。

### Cited Findings

**ベイジ（baigie）の公開ワークフロー**
- ベイジは自社のウェブ制作ワークフローを「2018年版（140タスク）」「2021年版（約100タスク）」として公開しており、採用ページ上では「戦略 → 情報設計 → ビジュアルデザイン → コンテンツ制作 → 開発 → テスト・公開 → 運用」の順で進めると説明。ワイヤーフレームは情報設計段階で作り、ビジュアルデザインは主要ページのテンプレートを中心に合意を取る — [ベイジのウェブ制作ワークフロー2021年版](https://baigie.me/officialblog/2021/08/31/baigie-workflow/)、[ベイジのweb制作ワークフロー2018](https://baigie.me/sogitani/2018/08/baigie-workflow/)、[仕事の進め方（採用）](https://recruit.baigie.me/work/workflow)、[ウェブ制作の仕事の進め方](https://baigie.me/workflow/website-workflow/)
- 要件定義書は開発フェーズに位置づけられ、「CMSの導入やフォームの開発等にあたり、システムの要件を整理するための【要件定義書】を作成」し、機能要件・外部サービス連携・データ移行・セキュリティ対策などを画面ごとに記載する — [6. 開発](https://baigie.me/workflow/website-workflow/development/)、[システム要件定義・設計](https://baigie.me/menu/planning/backend/)
- 戦略段階で粒度の粗い【ハイレベルサイトマップ】を作り設計の基礎情報にする。サイトマップは動線・キーワード・属性値などを含み、スケジュールや見積の根拠になる重要な仕様書として扱われる — [ベイジ ワークフロー2021](https://baigie.me/officialblog/2021/08/31/baigie-workflow/)
- 設計フェーズは「ウェブサイトの骨組みを決める」のが主目的で、ワイヤーフレームでは画面構造に加え「ページ内のコンテンツの大枠、具体的にはh2要素の文言まで定義」する — [4. 設計](https://baigie.me/workflow/application-workflow/basic-design/)、[ワークフロー2018](https://baigie.me/sogitani/2018/08/baigie-workflow/)
- デザインは「ベースデザイン」（サイト全体のトーンを決めるため最初に制作する案。主要2〜3画面）を1案に絞って顧客と方向性を決め、その後他画面へ展開し、デザインチェックを行う — [ワークフロー2018](https://baigie.me/sogitani/2018/08/baigie-workflow/)
- 開発はフロントエンド／サーバーサイドで分業せず一人のエンジニアが一貫して担当するのがベイジの特徴 — [6. 開発](https://baigie.me/workflow/website-workflow/development/)
- 「開発完了から公開まではテスト期間になります。通常は10〜15日程度となりますが、1カ月近くをテストに費やすこともあります」。テスト公開（テスト版サイトの公開）工程がある。公開直後にも軽微なテストを実施し、その後運用ミーティング。運用ルールは公開前に【運用設計書】として整理する例がある — [ワークフロー2021](https://baigie.me/officialblog/2021/08/31/baigie-workflow/)
- ベイジはBtoBサイト向け「標準ワイヤーフレーム」を無料配布している（テンプレートの参考になる） — [標準ワイヤーフレーム配布](https://baigie.me/officialblog/2020/12/17/btob_wireframe/)
- 業務システム（Webアプリ）向けには別途「業務システムUIデザインワークフロー（100タスク、2024年6月版）」を公開しており、「3. 要件定義」「4. 設計（4-4 主要画面設計）」という章立て — [業務システムUIデザインワークフロー](https://baigie.me/blog-ui/2021/10/26/baigie_uxui_workflow/)、[3. 要件定義](https://baigie.me/workflow/application-workflow/definition/)、[4-4. 主要画面設計](https://baigie.me/workflow/application-workflow/basic-design/main-screens-ia-design/)

**LIG の公開記事**
- LIGは「要件定義からリリース後までの9ステップ」として、要件定義 → ワイヤーフレーム → デザイン（トンマナ決定→トップ等）→ コーディング（HTML/CSS/JS）→ 納品前検証（要件どおり動くか、複数ブラウザ表示）→ インフラ・CMS設定 → 公開、の流れを説明 — [Webサイト制作の要件定義からリリース後の9ステップ](https://liginc.co.jp/584065)、[制作の流れ3ステップ](https://liginc.co.jp/477315)
- 「要件定義フェーズでは、ざっくりいうと『どんなページが必要か、どんな機能が必要か』」を決め、ここで決めたことは後から変えにくい — [要件定義で成否が決まる](https://liginc.co.jp/610584)
- 「LIGではワイヤーフレームが決まり、どんな機能が必要か明確になった段階でデザイン作成と並行して（機能開発が）進むことが多い」。CMS案件はバックエンド設計を要件定義段階から始めるべき（設計不足でコスト・期間・人的リソースを調達できない） — [CMSサイト制作のよくある誤解](https://liginc.co.jp/573974)
- 要件定義は「実現しないこと」も明文化する／要件定義書は一度で完成せずヒアリングと確認を繰り返して仕上げる／専門用語を避ける／想定で決めた要件は裏付けを取ってから確定する／要件の源になる現場担当者をミーティングに参加させる — [要件定義って何をやるの？](https://liginc.co.jp/625833)、[要件定義で心がける5つのポイント](https://liginc.co.jp/web/useful/160462)、[要件定義でハマりやすい3つの落とし穴](https://liginc.co.jp/578290)
- Web制作のトラブルは「制作範囲」「スケジュール」「金額」の認識違いから起きやすく、制作範囲は細かく区切り両社の役割を明確にし、コミュニケーション計画を事前に立て、クライアントの確認フロー（決裁者）を把握する — [トラブルを防ぐ5つのコツ](https://liginc.co.jp/web/useful/119019)
- 企画提案書は見出しを立てて話の流れを明確にし、担当者の先にいる決裁者を想定して書き、想定質問を事前に用意する — [企画提案書の作り方ガイドライン](https://liginc.co.jp/617682)
- ワイヤーフレーム作成の10のコツ記事あり（詳細は未取得） — [ワイヤーフレーム10のコツ](https://liginc.co.jp/558805)

**一般的な工程区分と成果物の定義**
- クラウドワークスは制作工程を「ヒアリング・企画」「設計・実装」「運用・評価」「公開・解析」に区分 — [crowdworks.jp](https://crowdworks.jp/times/know-how/8791/)
- 要件定義書とサイト設計書は別に作られ、要件定義で決めた条件を前提に設計書を作る。ワイヤーフレームは要素の抜け漏れや機能の過不足を見つけるために画面設計を可視化し、関係者間で完成像を事前共有するもの — [Web担当者Forum](https://webtan.impress.co.jp/u/2014/10/09/18411)、[Web担ビギナー](https://webtan.impress.co.jp/e/2021/06/30/40452)
- 要件定義書は制作前段階で機能・性能の要件を明確にする資料、画面仕様書はその要件を踏まえてサイトの仕様を詳細に定めるもの — [マネーフォワード 9028](https://biz.moneyforward.com/work-efficiency/basic/9028/)
- デザインカンプ＝色・フォント・画像を具体化した「完成見本」。ワイヤーフレーム → デザインカンプ → コーディング・開発の順 — [crexgroup](https://crexgroup.com/ja/development/?p=9410)、[xserver デザインカンプ](https://www.xserver.ne.jp/bizhp/homepage-design-comp/)

**Goodpatch**
- Goodpatchはプロトタイピングツール「Prott」を開発し、「各フェーズでプロトタイプを作成してユーザーテストを重ねればクオリティは上がる」という考え方を社内勉強会資料で示している（リサーチ工程の詳細はヒットせず） — [CSS Nite LP33 土屋氏資料](https://cssnite.jp/lp/lp33/followup/LP33-tsuchiya.pdf)、[THE BRIDGE Prott](https://thebridge.jp/2014/10/goodpatch-officially-launches-prott)

### Inferences
- 本案件（小規模・ソロ・2回のクライアント会議）向けに、上記を圧縮した標準フェーズと成果物対応表は次のとおり。

| フェーズ | 目的 | 主な成果物 | クライアント合意ポイント |
|---|---|---|---|
| 0. 企画・計画 | 目的・KPI・体制・予算枠・スケジュール枠の合意 | 計画書（企画提案書）、ハイレベルサイトマップ、市場・競合・参考サイト分析 | 第1回会議: 目的・範囲・概算 |
| 1. 要件定義 | 作るもの／作らないものの確定 | 要件定義書（機能/非機能/画面一覧/優先度）、価格表・見積書 | 第2回会議: 価格表＋デザイン方向案で合意、サイン |
| 2. 設計 | 骨組み確定 | サイトマップ、画面一覧、画面遷移図、ワイヤーフレーム、ER図、API一覧、状態遷移図 | WFレビュー（非同期でも可） |
| 3. デザイン | トーン確定→展開 | ベースデザイン（主要2〜3画面・1案に絞る）→全画面カンプ、デザインガイド | ベースデザイン承認→展開承認 |
| 4. 実装 | フロント＋予約バックエンド | コード、Storybook/コンポーネント一覧、テストコード | 中間デモ（ステージングURL） |
| 5. テスト | 要件どおりか検証 | テスト仕様書・結果、Lighthouse/axeレポート、不具合一覧 | 検収（受入テスト） |
| 6. 公開 | 本番化 | 公開手順書、公開前チェックリスト、ロールバック手順 | 公開承認（Go/No-Go） |
| 7. 運用・引継 | 自走化 | 運用マニュアル、運用設計書、保守契約、引継資料 | 公開後レビュー会 |

- ベイジの「デザインは1案に絞る」は、複数案提示で起きる「いいとこ取り」や判断遅延を避けるための実務知である一方、本案件で「デザイン提案を2〜3案」出すなら、**フル画面カンプ複数案ではなく「方向性（ムードボード／スタイルタイル）レベルで2〜3案 → 1案に絞ってベースデザイン」**という二段構えが、ベイジ流とクライアント要望の折衷になる（推論）。
- ベイジの「テスト10〜15日」は中規模コーポレートサイトの値であり、予約機能を含む本案件では機能テストが増えるため、同程度以上を見込むのが妥当（推論）。

### Gaps
- ベイジ・LIGの各記事本文は遮断により未取得。工程ごとのタスク粒度（140タスクの内訳）は原文参照が必要。
- Goodpatch公式の「デザインプロセス」ページは検索でヒットせず、プロセス内容は未確認。
- Web担当者Forum等の「サイトマップ／画面一覧」のExcel様式（列定義）は本セッションで確認できず（KQ3に筆者標準案を記載）。

---

## KQ2. 要件定義書（予約システム向け）の構成：機能/非機能要件・ユースケース・ユーザーストーリー・受け入れ基準・MoSCoW・MVP

### Takeaway
日本の要件定義書は「背景・目的／体制・スケジュール／サイト構成／機能要件／非機能要件／リリース要件」が定番骨格で、非機能はIPA非機能要求グレードの6大項目（可用性・性能拡張性・運用保守性・移行性・セキュリティ・システム環境）で網羅する。優先度はMoSCoW（MVP=Mustのみ）で切り、ユーザーストーリーと受け入れ基準で検収可能な粒度にする。

### Cited Findings

**要件定義書の目次（日本の定番）**
- Lancersの解説: 要件定義書には「背景・目的（制作の目的や範囲、全体像・概念図、用語の定義。対象ユーザーのペルソナも）」「プロジェクト体制・スケジュール」「サイト構成（サイトマップ、ページ構成・URL、対象OS・ブラウザ）」「リリース要件（公開の手順や日時）」を記載。要件定義シートのダウンロードあり — [Lancers 要件定義](https://www.lancers.jp/c/website/website-knowhow/13103/)
- hnaviは5W1H（Why=目的・背景、When=制作期間・公開予定日 等）での整理を推奨 — [hnavi](https://hnavi.co.jp/knowledge/blog/website-requirements-definition/)
- マネーフォワードはKPI/KGI設定、必要な人員・予算・ツールの検討を記載例として挙げる — [マネーフォワード 9063](https://biz.moneyforward.com/work-efficiency/basic/9063/)
- 弁護士事務所公開の要件定義書サンプルは「システム概要／業務要件／システム化の範囲」などを章立て — [komon-lawyer.jp 要件定義書サンプルPDF](https://komon-lawyer.jp/wp-content/uploads/2024/08/teigisyo.pdf)
- 要件定義は「関係者の共通認識づくり」と「ビジネス目的に沿っているかの検証」が目的 — [LIG 610584](https://liginc.co.jp/610584)

**機能要件 vs 非機能要件**
- 機能要件＝「ログイン機能や販売機能などのシステムに実装する機能そのもの」。非機能要件＝性能（応答速度）、キャパシティ、セキュリティ、運用など機能以外の性質 — [SHIFT ASIA](https://shiftasia.com/community/requirements_definition/amp/)、[ONES 非機能要件ガイド](https://ones.com/blog/ja/non-functional-requirements-guide)
- 予約系の機能要件例: 予約管理、患者（顧客）情報管理、請求書作成。非機能例: 24時間365日稼働、ページ読み込み時間、同時接続数、SSL暗号化 — [ONES 機能vs非機能](https://ones.com/blog/ja/functional-vs-nonfunctional-requirements)
- IPA「非機能要求グレード」は非機能要求を6大項目（可用性／性能・拡張性／運用・保守性／移行性／セキュリティ／システム環境・エコロジー）に分類し、大項目6・中項目35・小項目118・メトリクス238。重要92項目のグレード表、レベル0〜5（大きいほど難易度・コスト増）。利用は任意で、レベルを選べば要件定義できると誤解しやすいという注意あり。可用性は稼働率・復旧水準、運用保守性はバックアップ・運用監視、性能拡張性は業務処理量・ピーク増大率 — [@IT](https://atmarkit.itmedia.co.jp/ait/spv/1405/10/news001_4.html)、[issoh](https://www.issoh.co.jp/tech/details/17610/)、[マネーフォワード 4620](https://biz.moneyforward.com/erp/basic/4620/)、[Zenn 非機能要求グレードの歩き方](https://zenn.dev/nttdata_tech/articles/c16414c86883cb)
- 予約システム発注前の要件整理を業種別チェックリストで扱う記事（内容未取得） — [atsoho](https://atsoho.com/blog/reservation-system-requirements-checklist)

**MoSCoW / MVP / ユーザーストーリー**
- MoSCoWはMust/Should/Could/Won'tの4区分で、要件・ユーザーストーリー・受け入れ基準などアジャイルのあらゆる項目に適用可能。MVPは「Must」のみで構成するのが基本。ECのMVP例ではカタログ・カート・チェックアウト・決済がMust。タイムボックスと併用。4区分では粒度不足になることがあり、影響度×工数マトリクスやビジネス価値スコアと併用すると精度が上がる — [Pragmatic Coders](https://www.pragmaticcoders.com/?p=3880)、[airfocus](https://airfocus.com/glossary/what-is-moscow-prioritization/)、[Visual Paradigm](https://visual-paradigm.com/scrum/prioritize-backlog-with-moscow)、[ClickUp](https://clickup.com/ja/blog/132697/undefined)
- 「実現しないこと（Won't）」の明文化は後工程のズレを減らす — [LIG 625833](https://liginc.co.jp/625833)

### Inferences（本案件向け 要件定義書テンプレート案）
以下は上記出典の骨格を本案件に当てはめた筆者案（出典のない部分は推論）。

```
要件定義書（予約サイト＋管理PWA） v1.0
1. 文書管理（版数・日付・作成者・承認者・変更履歴）
2. 背景と目的
   2.1 現状の予約運用（電話/LINE/紙台帳）と課題
   2.2 ゴールとKPI（例: ネット予約比率、無断キャンセル率、予約受付工数/日）
   2.3 用語定義（メニュー、指名、枠、ブロック、来店、カルテ…）
3. ユーザーとユースケース
   3.1 ペルソナ（新規客／リピーター／オーナー兼スタイリスト）
   3.2 ユースケース一覧（UC-01 空き検索→予約、UC-02 予約変更・取消、UC-03 当日受付、UC-04 枠ブロック、UC-05 リマインド…）
   3.3 ユーザーストーリー＋受け入れ基準（Given/When/Then）
4. スコープ
   4.1 本フェーズで作るもの（MoSCoW表: Must/Should/Could/Won't）
   4.2 作らないもの（Won't: 顧客チャット・電子カルテは次フェーズ、決済は対象外 等）
   4.3 前提条件・制約（Vercel、スマホ中心、予算、公開日）
5. 機能要件（機能ID／機能名／概要／対象画面／優先度／備考）
   顧客側: メニュー閲覧、空き状況、予約作成、確認メール/LINE通知、変更・キャンセル、マイページ
   管理側（PWA）: 予約一覧（日/週）、手動予約、ブロック、営業時間・休業設定、メニュー/料金管理、顧客一覧、通知設定、インストール・ホーム画面追加
6. 非機能要件（IPA 6大項目で網羅）
   可用性（目標稼働率、障害時の代替手段=電話）／性能（LCP・INP目標、同時予約の排他制御）／運用保守（バックアップ、ログ、監視、更新手順）／移行性（既存顧客データの扱い）／セキュリティ（認証、個人情報の暗号化、HTTPS、権限）／環境（対応端末・ブラウザ、PWA要件）
7. データ要件（主要エンティティ、保持期間、個人情報区分）
8. 外部連携（メール送信、LINE、Googleカレンダー、地図 等）
9. 画面一覧（画面ID／画面名／URL／対象ユーザー／概要）※詳細は設計書
10. 法務・規約（利用規約、プライバシーポリシー、キャンセルポリシー、特商法表記要否）
11. 体制・役割分担・コミュニケーション計画（連絡手段、レビュー期限、決裁者）
12. スケジュール・マイルストーン・検収基準
13. リリース要件（公開日、ドメイン、DNS、ステージング→本番手順）
14. 未決事項・リスク一覧
```
- 受け入れ基準は検収の根拠になるため、各Must機能に最低1つ「客観的に合否判定できる文」を付ける（例:「予約確定後60秒以内に確認メールが届く」「同一枠への二重予約が発生しない」）。これはKQ7の検収条項と直結する（推論）。
- 非機能要件は小規模案件ではIPAの全238メトリクスを埋める必要はなく、6大項目それぞれに2〜5行の目標値を書く「軽量版」で十分（推論。IPAも利用は任意としている）。

### Gaps
- 予約システム特有の要件チェックリスト（atsoho）の本文は未取得。
- ユーザーストーリー／受け入れ基準（Given-When-Then）の一次出典は本セッションで検索できず（検索上限）。業界一般の慣行として記載。

---

## KQ3. 設計書（Webアプリ）: ER図・API一覧・状態遷移図・画面仕様・コンポーネント一覧と、ソロ開発向け軽量手法（ADR・Design Doc）

### Takeaway
画面遷移図・サイトマップ・画面仕様書（画面一覧）は日本の設計書の標準要素で、画面ID・画面名・遷移トリガー・処理内容を記す。ソロ開発ではこれらをMarkdown一式に圧縮し、技術判断はADR（Nygard形式またはMADR）でgit管理するのが軽量で追跡可能。

### Cited Findings
- 画面遷移図は「画面の存在、画面間の移動を起こす操作、画面同士の関係」を図にし、ディレクター・デザイナー・エンジニアの共通認識に使う。記載要素は画面名、遷移トリガー操作（例:「購入」ボタン）、画面間の関係。システムの骨格を定める初期段階で作成 — [crexgroup 画面遷移図](https://crexgroup.com/ja/development/project/screen-transition-diagram-guide/)
- サイトマップはサイト全体の構造図、ワイヤーフレームは1ページ（群）の設計図 — [Miro サイトマップ](https://miro.com/ja/diagramming/how-to-create-a-sitemap/)、[appmaster](https://appmaster.io/ja/blog/websaitonosaitomatsuputowaiyahuremunozuo-cheng-fang-fa-toha)
- 画面仕様書は「Webサイト全体のイメージを関係者で揃える文書」で、画面レイアウトには項目や表示方法に加え「ユーザーがどこをどう操作でき、操作によってどんな処理が起きるか」も書く — [マネーフォワード 9028](https://biz.moneyforward.com/work-efficiency/basic/9028/)
- 画面遷移図をVisio、画面遷移表をExcelで作る例（日立） — [Hitachi Cosminexus](https://itpfdoc.hitachi.co.jp/manuals/3020/30203M9100/EM910001.HTM)
- ベイジの業務システムワークフローでは「4. 設計」内に「4-4. 主要画面設計」がある — [4-4 主要画面設計](https://baigie.me/workflow/application-workflow/basic-design/main-screens-ia-design/)
- ADR（Architecture Decision Record）: 代表テンプレートは「Michael Nygard版（simple and popular）」「MADR（シンプル版と、選択肢と長短を重視した詳細版）」「Tyree & Akerman版（より精緻）」等。gitで `adr/` ディレクトリを切り1決定1ファイルで管理する手順が示されている。決定は「todoリスト」として製品todoと並行管理し、ADRは資金提供・開発・運用の関係者に伝達・受容される必要がある — [joelparkerhenderson/architecture-decision-record README](https://github.com/joelparkerhenderson/architecture-decision-record)（全文取得済み）

### Inferences（ソロ開発者向け 設計書セット案）
- 推奨構成（すべてMarkdown＋Mermaidでリポジトリ内 `docs/design/` に置く。出典に基づく要素＋筆者推論）:

```
docs/design/
  00_overview.md        システム構成図（Vercel / DB / メール / LINE）、技術選定サマリ
  01_sitemap.md         サイトマップ（公開側／管理側）＋URL設計
  02_screen_list.md     画面一覧: 画面ID | 画面名 | URL | 権限 | 主要機能 | 対応WF | 状態
  03_screen_flow.md     画面遷移図（Mermaid flowchart。トリガー＝ボタン名を矢印ラベルに）
  04_screen_spec/       画面仕様: 項目定義（入力制約・必須・初期値）、操作→処理、バリデーション、エラー文言、空状態
  05_er.md              ER図（Mermaid erDiagram）: customers, stylists, menus, slots/opening_hours, reservations, reservation_items, blocks, notifications, audit_logs
  06_state.md           状態遷移図: 予約（仮予約→確定→来店→完了／キャンセル／無断キャンセル）、枠（空き→仮押さえ→確定→ブロック）
  07_api.md             API一覧: メソッド | パス | 用途 | 認証 | リクエスト/レスポンス | エラー | 冪等性
  08_components.md      コンポーネント一覧（Atomic/機能単位、Props、状態、使用画面）
  09_security.md        認証・権限、個人情報の扱い、レート制限、監査ログ
  adr/                  ADR-0001 フレームワーク選定, 0002 DB/ホスティング, 0003 認証方式, 0004 通知手段, 0005 二重予約防止方式 …
```
- ADRはNygard形式（Title / Status / Context / Decision / Consequences）で1ページ、所要15分程度を上限にすると継続できる（推論。ADR READMEの「simple and popular」に基づく）。
- 予約ドメインで設計上必ず決めるべき事項（推論）: 枠の粒度（15/30分）、メニュー所要時間と枠の関係、同時予約の排他（DBユニーク制約／トランザクション）、キャンセル期限、タイムゾーン・祝日、スタッフ複数対応の要否、管理PWAのオフライン挙動。

### Gaps
- 画面一覧・API一覧のExcel列定義に関する日本語の一次テンプレートは未取得（上記列は慣行に基づく筆者案）。
- Google Design Docs等「軽量Design Doc」の一次資料は検索上限で未調査。

---

## KQ4. ワイヤーフレームとデザインカンプの実務: 忠実度・ツール・モバイルファースト・複数案提示・クライアントレビュー・スコープクリープ防止

### Takeaway
ワイヤーフレームは構造とレイアウトを優先する低忠実度の設計図、デザインカンプは色・フォント・画像を具体化した完成見本。クライアントレビューでは「色／フォントなど要素ごとの具体的な質問」で好みを引き出し、フィードバックは分散させず一箇所で収集、修正回数と前工程戻りのルールを契約で定める。

### Cited Findings
- ワイヤーフレーム＝「完成イメージを線と枠で表した設計図」で、色やタイポグラフィより構造とレイアウトを優先する低忠実度モック。デジタルWFは共有・反復が容易でプロトタイプへ変換可能 — [Miro ワイヤーフレームとは](https://miro.com/ja/wireframe/what-is-a-wireframe/)、[item.com](https://www.item.com/ja/tech-integration/software-development---design-wireframing)、[InfoQ](https://www.infoq.com/jp/articles/wireframes-start-development-projects/)
- ベイジはWFで「h2要素の文言まで定義」し、ベースデザインは「主要2〜3画面を制作し以降の画面へ展開」。デザインは1案に絞って方向性を決める — [baigie 2018](https://baigie.me/sogitani/2018/08/baigie-workflow/)
- デザインカンプは受注側が発注側とデザインをすり合わせるための完成見本で、「デザインカンプがないと、イメージの共有や意思疎通がうまくできません」 — [xserver](https://www.xserver.ne.jp/bizhp/homepage-design-comp/)
- フィードバックの引き出し方: 「特定の色やフォントに関する意見を求めることで、クライアントが好むスタイルを明確にすることができます」。提案前に競合調査を行いコンセプトとニーズの齟齬を確認 — [Hakky デザインカンプ](https://book.st-hakky.com/business/what-is-design-comp)、[Hakky Webデザインプロセス](https://book.st-hakky.com/business/effective-web-design-process)
- レビュー運用: 修正依頼がメールで分散しないよう、レビュー用スペースで意見を体系的に集め、根拠や主要決定事項を段階的に示す（UXPin） — [UXPin デザイン提案書](https://www.uxpin.com/studio/jp/?p=30424)
- クライアントデザインレビュー用のテンプレート例（Gamma） — [Gamma client design review](https://gamma.app/ja/templates/client-design-review-u4avhe6tkabmrgw)
- デザイン指示でディレクターが気をつけているポイント記事（LIG、本文未取得） — [LIG 610790](https://liginc.co.jp/610790)
- 修正回数の相場は2〜3回が目安（法的基準ではない）。上限超過分の料金、前工程（デザイン確定後のコーディング段階でのデザイン変更）に戻る修正は別見積とする旨を契約書に明記 — [atsoho 修正回数](https://atsoho.com/blog/shuseikaisu-designer)、[atsoho 品質保証](https://atsoho.com/blog/quality-assurance-in-freelance-work)
- Web制作業務委託約款の例: 修正を求めることができる上限回数は2回 — [lawinsider 納品検収条項](https://lawinsider.com/ja/clause/納品検収)

### Inferences（本案件の進め方案）
- 忠実度の段階: ①紙／FigJamの超低忠実度（情報の有無と順序）→ ②Figmaグレースケール中忠実度WF（390×844のモバイル基準フレーム＝iPhone 14/15系の論理解像度。本数値の一次出典は本セッション未取得）→ ③ベースデザイン（主要3画面: トップ／メニュー・空き検索／予約フォーム）→ ④全画面カンプ＋管理PWA主要画面。
- 第2回会議での「デザイン提案」は、**スタイルタイル／ムードボード形式で2〜3方向**（例: A「落ち着いた大人向けモノトーン」、B「明るいナチュラル」、C「ストリート」）＋各方向のトップ1画面のみ、という形が制作コストと意思決定のバランスがよい。選択後はベイジ流に1案へ収束し、以後の方向転換は変更要求扱いとする（推論）。
- レビュー会の進め方（推論＋上記出典）: 事前に「見てほしい観点リスト」（文言は未確定／写真はダミー等）を渡す → 会議では要素別に質問（色・フォント・写真の雰囲気・余白）→ コメントはFigmaコメントまたは1つのフォームに集約 → 48〜72時間のレビュー期限 → 議事録に「決定／保留／宿題」を記録。
- スコープクリープ防止: 要件定義書のWon't一覧、修正回数（例: WF 2回・ベースデザイン2回・展開1回）、前工程戻りは別見積、変更要求フォーム、の4点セットを価格表と同時に提示して合意する（出典: atsoho・lawinsiderの慣行＋推論）。

### Gaps
- Figmaのベストプラクティス、390×844などモバイルアートボードの根拠、スタイルタイル／ムードボードの一次資料（styletil.es 等）は検索上限とホスト遮断のため未取得。
- Penpotの実務評価は未調査。

---

## KQ5. 評価手法: ヒューリスティック評価（Nielsenの10原則）、認知的ウォークスルー、5秒テスト、3〜5人のユーザビリティテスト、デザインQA、Lighthouse/axeゲート

### Takeaway
NN/gの標準に従い、専門家3〜5人によるヒューリスティック評価（ソロなら時間を置いて自己評価＋知人1〜2名）、タスクベースの認知的ウォークスルー（4つの質問）、5人までの小規模な思考発話テストを複数回、という「ディスカウント・ユーザビリティ」の組合せが小規模案件に適合する。自動ゲートはLighthouse CI（`lighthouse:recommended`／`no-pwa`プリセット＋`error`レベル）とaxe-core（WCAG問題の平均57%を自動検出）で機械的に担保し、残りは手動チェックリストで補う。

### Cited Findings
- ユーザビリティテスト: Nielsenは「5人以内の小規模テストを、予算が許す限り何度も回す」のが最善とし、思考発話法と定性的調査を特徴とする。以前は3人を提案していたが、多くの組織で機能する妥協点として5人を推奨 — [NN/g Usability Testing w. 5 Users (video)](https://www.nngroup.com/videos/usability-testing-w-5-users-design-process/)、[NN/g Discount Usability: 20 Years](https://www.nngroup.com/articles/discount-usability-20-years/)
- ヒューリスティック評価の手順（NN/g）: Nielsenの10ヒューリスティクスを用い（領域固有のものを追加可）、評価者3〜5人が**独立に**同じUIを評価（個々人は問題を見落とすため）。初回チームはまずヒューリスティクスを読み理解する準備が必要。所見はスプレッドシート、ワークブック、スクリーンショット付きデジタルホワイトボードに記録 — [NN/g How to Conduct a Heuristic Evaluation](https://www.nngroup.com/articles/how-to-conduct-a-heuristic-evaluation/)、[NN/g Theory Behind Heuristic Evaluations](https://www.nngroup.com/articles/how-to-conduct-a-heuristic-evaluation/theory-heuristic-evaluations/)
- 日本語資料でも「3〜5人の専門家」で実施、1990年にNielsenとMolichが提示。参加者募集が不要なため数時間〜数日で実施可能だが、実使用に固有の問題を捉えられない／偽陽性の可能性という限界 — [UXPin ヒューリスティック評価](https://www.uxpin.com/studio/jp/?p=31111)、[issoh](https://www.issoh.co.jp/column/details/10598/)
- 10原則のうち検索結果で確認できた見出し: 「システムと実世界の一致」「ユーザーの制御と自由」「一貫性と標準」「エラー防止」「再認を再生より優先」「柔軟性と効率」「美的でミニマルなデザイン」（残り3つ＝「システム状態の可視性」「エラー認識・診断・回復の支援」「ヘルプとドキュメント」は一般に知られる内容だが本セッションの検索結果には含まれず） — [NN/g 10 Usability Heuristics course](https://www.nngroup.com/contents/self-paced-courses/10-usability-heuristics-from-theory-to-practice/)
- 認知的ウォークスルー（NN/g）: 新規ユーザー視点で学習容易性を評価するタスクベースの検査法。ユーザーは不要で比較的安価。1タスクずつステップを辿り、各ステップで「正しい効果を得ようとするか／正しい操作に気づくか／操作と効果を結びつけられるか／進捗が分かるか」の4問を問う。ワークショップ形式の進め方記事あり — [NN/g Cognitive Walkthroughs (video)](https://www.nngroup.com/videos/cognitive-walkthroughs/)、[NN/g Cognitive Walkthrough Workshop](https://www.nngroup.com/articles/cognitive-walkthrough-workshop/)
- 日本語: 認知的ウォークスルーは「分析者自身がユーザの振舞いをシミュレートしながら一連の質問に回答」し、実ユーザー不要で数日〜1〜2週間で結果を得られる — [issoh](https://www.issoh.co.jp/column/details/10598/)
- Lighthouse CI: GitHub Actions で `lhci autorun`（`@lhci/cli@0.15.x`）を回し、PRごとにレポート取得、アクセシビリティ・SEO・パフォーマンスの回帰を防止、スクリプト・画像の性能予算を設定、複数回実行で分散を低減。アサーションは監査IDごとに `off / warn / error` の3レベル（`error`は非ゼロ終了）、`minScore / maxLength / maxNumericValue` で閾値指定、`categories:<id>` でカテゴリスコアも検証可。プリセットは `lighthouse:all`（全監査満点、極めて困難）／`lighthouse:recommended`（性能以外は満点、メトリクスが90未満で警告。現実的な基準）／`lighthouse:no-pwa`（recommendedからPWA監査を除外）。`budgetsFile`（budget.json）も利用可。`assertMatrix` でURLパターン別の基準を設定可 — [Lighthouse CI README](https://github.com/GoogleChrome/lighthouse-ci)、[Lighthouse CI configuration.md](https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md)（全文取得済み）
- axe-core: WCAG 2.0/2.1/2.2 の A/AA/AAA ルールとベストプラクティスを持つアクセシビリティ検査エンジンで、「平均してWCAG問題の57%を自動検出」。判定不能なものは "incomplete" として返し手動確認を促す。VS Code の axe-linter、ブラウザ拡張の guided tests を推奨 — [axe-core README](https://github.com/dequelabs/axe-core)（全文取得済み）
- Front-End Checklist（Testing節）: 「CIで性能予算を強制（バンドルサイズ、Lighthouseスコア、Core Web Vitals）」「E2Eテスト（Playwright/Cypress）で主要ユーザージャーニー」「axe-core / jest-axe / Playwrightでアクセシビリティ自動テスト」「本番のリアルタイムエラー監視」「主要ブラウザ横断テスト」「実機・DevToolsエミュレーションでモバイル検証」「ビジュアルリグレッション」等を High/Medium 優先度付きで列挙 — [Front-End Checklist](https://github.com/thedaviddias/Front-End-Checklist)（全文取得済み）
- Goodpatchは「各フェーズでプロトタイプを作成してユーザーテストを重ねればクオリティは上がる」 — [CSS Nite LP33資料](https://cssnite.jp/lp/lp33/followup/LP33-tsuchiya.pdf)

### Inferences（本案件の中間レビュー／評価計画案）
| タイミング | 手法 | 実施者 | 所要 | アウトプット |
|---|---|---|---|---|
| WF完成時 | 認知的ウォークスルー（タスク: 新規客が「明日15時カット」を予約する／オーナーが枠をブロックする） | 開発者＋クライアント | 1〜2h | 各ステップの4問回答表、問題一覧 |
| ベースデザイン時 | 5秒テスト（トップを5秒見せ「何の店か・何ができるか」を回答） | 知人5名程度 | 30min | 第一印象メモ |
| 全画面カンプ時 | ヒューリスティック評価（10原則×各画面、重大度0〜4） | 開発者（日を置いて2回）＋可能なら外部1〜2名 | 2〜3h | 所見スプレッドシート |
| 実装中〜QA | Lighthouse CI（recommended or no-pwa, error レベル）、axe（Playwright統合）、手動チェックリスト（Front-End Checklist準拠） | CI | 毎PR | 自動レポート |
| 公開前 | ユーザビリティテスト（思考発話、3〜5名、実機スマホ、予約〜キャンセルまで） | 実際の顧客1〜2名＋知人 | 各20〜30min | 課題一覧（重大度付き）、修正判断 |

- 5秒テストの一次出典（Lyssna/UsabilityHub、NN/g）は検索上限で未取得。手法自体は広く知られるが、上表の実施要領は筆者案。
- ソロ開発でNN/gの「3〜5人の独立評価」を満たせない場合、時間を空けた複数回の自己評価＋クライアントの独立評価で代替し、限界を報告書に明記するのが誠実（推論）。

### Gaps
- Nielsenの10原則の全文（10項目）の一次ページ（nngroup.com/articles/ten-usability-heuristics/）は本セッションで取得・確認できていない。
- 5秒テスト、デザインQAチェックリスト（デザイナー→実装の差分確認）の一次資料は未調査。

---

## KQ6. 見積と工程管理: WBS、ファンクションポイント的概算、バッファ、マイルストーン（打ち合わせ2回）、ソロ向けガント vs カンバン

### Takeaway
日本のWeb制作見積は「ディレクション費／デザイン費（TOP・下層単価）／コーディング費（ページ単価 or 工数）／レスポンシブ対応費／開発費」の内訳が標準で、フリーランス直請けは10〜50万円帯が相場とされる。WBSは成果物→フェーズ（3〜6）→作業に分解してからガントに落とし、タスク単位で工数と依存を見積もる。バッファ計上方法に関する日本語の明示的出典は見つからなかった。

### Cited Findings
- 見積内訳: デザイン費（作り込み度、ページ数、オリジナルかテンプレか、アニメーション有無で変動。TOPと下層で単価が分かれる）、コーディング費（ページ単位または工数）、ディレクション費（人件費×稼働工数、または合計の一定割合）、レスポンシブ対応費を別項目にする会社もある。間接コスト（営業経費・オフィス賃料）が乗る — [xserver 見積](https://www.xserver.ne.jp/bizhp/web-site-production-estimate/)、[imitsu ディレクション費](https://imitsu.jp/cost/hp-design/direction-fee)、[crexgroup 見積価格](https://crexgroup.com/ja/marketing/content-seo/web-production-estimate-price/)
- 相場: フリーランス直接依頼10万〜50万円、小規模制作会社30万〜100万円、中〜大手コーポレートサイト100万円〜。TOPデザイン5万〜15万円、下層1ページ2万〜5万円の例（介護サイト事例）。代理店経由は20〜40%のマージン（根拠不明確） — [atsoho 費用相場](https://atsoho.com/blog/web-production-cost)、[atsoho 介護サイト費用](https://atsoho.com/blog/web-nursing-care-website-cost)
- WBS: 成果物を定義し、工程・成果物・担当などで3〜6フェーズに分け、作業単位まで分解。WBS→ガントチャートの順。タスクごとに所要時間を見積もり依存関係を整理してからスケジュール化。Web制作の分解例はサイトマップ／ワイヤーフレーム／画面デザイン／機能設計／コーディング — [Curythm WBS](https://curythm.com/blog/wbs-howto/)、[ONES WBS](https://ones.com/ja/blog/?p=22346)、[monosus WBS](https://www.monosus.co.jp/magazine/jq66vfuzaa1f00nzbmm3zaaf)、[マネーフォワード WBS](https://biz.moneyforward.com/work-efficiency/basic/9051/)、[monday.com WBS](https://monday.com/blog/ja/project-management-ja/what-is-wbs/)
- 工程表（ガント／バーチャート）は作業内容と期日を一覧化したもの — [マネーフォワード 工程表](https://biz.moneyforward.com/work-efficiency/basic/9063/)
- 見積の有効期限とスコープ変更の関係、追加費用トラブルは「要件定義の曖昧さ」と「契約書の不備」が主因 — [atsoho 見積有効期限](https://atsoho.com/blog/quote-validity-scope-change-relation)、[atsoho 追加費用トラブル](https://atsoho.com/blog/website-production-extra-fee-dispute)
- クライアントの確認フローを把握すると見積精度が上がる — [LIG 119019](https://liginc.co.jp/web/useful/119019)
- ベイジのテスト期間目安10〜15日 — [baigie 2021](https://baigie.me/officialblog/2021/08/31/baigie-workflow/)

### Inferences（本案件の見積・スケジュール案）
- 価格表（第2回会議用）の構成案（推論。内訳区分は上記出典に準拠）:
  - 基本パッケージ（Must）: 企画・要件定義／設計／デザイン（ベース＋展開）／フロント実装／予約バックエンド／テスト／公開／引継ぎ — 一式価格＋内訳
  - オプション（Should/Could）: LINE通知、Googleカレンダー同期、複数スタッフ、写真撮影、文章作成、ロゴ
  - 次フェーズ（Won't now）: 顧客チャット、電子カルテ — 概算レンジのみ
  - 月額: 保守・運用（ホスティング実費、監視、軽微修正○時間/月、規約改訂）
  - 条件: 修正回数、前工程戻りの扱い、検収期間、支払条件（着手金／中間／検収後）
- 概算工数の出し方（推論）: 画面一覧×画面種別単価（静的ページ／フォーム画面／一覧・詳細／カレンダーUI）＋API本数×単価＋横断作業（認証、通知、PWA、テスト、公開、ドキュメント）＋ディレクション（合計の15〜25%）＋バッファ。バッファの出典は見つからなかったため、本案件では「見積総工数の20〜30%を予備として明示し、使わなければ請求しない／前倒し公開」のように**可視化**する方針を推奨。
- マイルストーン案（打ち合わせ2回＋非同期レビュー）: M0 第1回会議（ヒアリング・目的合意）→ M1 計画書・競合分析・要件定義書ドラフト送付 → M2 第2回会議（価格表・デザイン方向案提示→合意・契約）→ M3 WF承認（非同期）→ M4 ベースデザイン承認 → M5 ステージング中間デモ → M6 受入テスト・検収 → M7 公開 → M8 公開後2週間レビュー＆引継ぎ。
- ソロ作業の管理: 対クライアントにはマイルストーン型ガント（週粒度）、自分の日次管理はカンバン（Todo/Doing/Review待ち/Done）＋「クライアント待ち」列を設け、待ち時間を可視化する（推論。ガントvsカンバンの比較出典は未取得）。

### Gaps
- バッファ率（例: 20%）の根拠資料は見つからず（検索結果にも「バッファに関する記述は見つからなかった」と明記）。
- 予約システム特有の開発費相場（美容室向け）は未調査。
- ファンクションポイント法の日本語解説は検索上限で未調査。

---

## KQ7. クライアントコミュニケーション: 議事録・確認事項リスト・価格表提示とサインオフ・検収基準・変更要求・契約／利用規約／プライバシーポリシー

### Takeaway
議事録は「基本情報／議題別の議論と結論／決定事項（主語・対象・数量を省略しない）／確認・保留事項／宿題（担当・期限）／次回予定」が標準構成。契約では納期・著作権・追加費用・検収（例: 納入から14日以内に合否通知、無通知は合格みなし）・修正回数（2〜3回）・変更管理（仕様変更は別見積）を定める。予約サイトではキャンセル料が消費者契約法9条の「平均的な損害」を超えると無効になるため、キャンセルポリシー設計が法務上の要点。

### Cited Findings
- 議事録の標準項目: 会議名・日時・場所・作成者、出席者/欠席者、議題ごとの議論内容と結論、決定事項（「誰が読んでも同じ意味に受け取れるよう、主語や対象、数量などを省略せずに書きましょう」）、未決事項・継続案件、宿題（担当者と完了期限）、次回予定 — [subanana 議事録テンプレ](https://subanana.com/ja/blog/議事録-作り方-テンプレート)、[Smartsheet 議事録テンプレPDF](https://jp.smartsheet.com/sites/default/files/2024-08/IC-Project-Management-Meeting-Minutes-1185607_WORD_JP.pdf)、[Laxis](https://www.laxis.com/ja/blog/meeting-minutes-template/)、[Notta](https://www.notta.ai/blog/minutes-template-guide)
- 検収条項の例（Web制作業務委託約款）: 「お申込者は本Webサイトの納入の日から14日以内に検収を行い、合否を当社に通知する」「期間内に不合格通知がなされない場合、検収に合格したものとみなす」「修正を求めることができる上限回数は、2回とする」 — [lawinsider 納品検収](https://lawinsider.com/ja/clause/納品検収)
- 検収とは納品物が発注内容どおりかを確認し正式に受け取る手続きで、契約内容との整合性や品質を保証し支払いを適正に行う目的 — [Adobe 検収書](https://www.adobe.com/jp/acrobat/roc/blog/inspection-document.html)、[バクラク 検収書](https://bakuraku.jp/knowledge/knowledge-invoice/inspection-document)
- 納品トラブル実例: 制作者は「サイト公開＝納品」と考えていたが、発注者が公開前レクチャーを求め、契約に書かれていなかったことが争点に — [CrowdWorks相談](https://crowdworks.jp/consultation/threads/17708)
- 契約書の確認項目: 納期、著作権、追加費用、検収、修正回数。要件追加・仕様変更は「変更管理プロセスに従い別途お見積もり」とする条項例。検収後の不具合対応期間（例: 検収後30日）を定める例 — [atsoho 契約チェックリスト](https://atsoho.com/blog/web-production-contract-checklist)、[atsoho 追加費用回避](https://atsoho.com/blog/web-avoid-extra-cost-trouble-guide)、[LegalOn ウェブサイト制作契約](https://www.legalontech.com/jp/media/website-development-agreement)
- 修正回数の相場2〜3回（目安。案件難易度や意思決定速度で調整） — [atsoho 修正回数](https://atsoho.com/blog/shuseikaisu-designer)
- 提案書は決裁者を想定して書き、想定質問を準備。クライアントの確認フローを把握 — [LIG 617682](https://liginc.co.jp/617682)、[LIG 119019](https://liginc.co.jp/web/useful/119019)
- キャンセルポリシー: 消費者契約法第9条第1項により、解除に伴い事業者に生ずる「平均的な損害の額」を超える違約金部分は無効。店舗ごとに基準を定めて明示し、予約ページにはキャンセル期限・遅刻時対応・指名料・施術時間の目安を分かりやすく記載 — [Square 無断キャンセル対策](https://squareup.com/jp/ja/townsquare/how-to-deal-with-no-shows)、[Square 予約システム導入](https://squareup.com/jp/ja/townsquare/how-to-introduce-reservation-system)、[Financial Field](https://financial-field.com/living/entry-349935)
- Front-End Checklist（Privacy節）: 個人データを収集するサイトはプライバシーポリシーを公開しフッターから目立つ形でリンク（High）、必要最小限のデータ収集、ユーザー向けデータ削除手段、非必須Cookieは事前同意（GDPR/CCPA等） — [Front-End Checklist](https://github.com/thedaviddias/Front-End-Checklist)

### Inferences（本案件のテンプレート案）
- **議事録テンプレ**（上記出典ベース）:
```
# 打ち合わせ議事録 #02（YYYY-MM-DD 00:00–00:00 / 場所 or オンライン）
出席: ○○様（オーナー）、△△（開発）  作成: △△  配布: 翌営業日まで
1. 目的（本日のゴール）
2. 議題と議論の要点（議題ごと）
3. 決定事項（主語・対象・数量を明記。例:「価格表プランBで進める。初期費用○円、月額○円」）
4. 確認事項・保留（誰が・いつまでに確認するか）
5. 宿題（担当／期限／内容）
6. 次回（日時・議題・持ち物）
※ 送付後3営業日以内に異議がなければ確定扱い（契約書と整合させる）
```
- **確認事項リスト（オープンイシュー表）**: ID／質問／背景／選択肢／影響（工数・費用・納期）／回答期限／回答／決定日。要件定義書14章と連動（推論）。
- **価格表提示とサインオフの流れ**（推論＋出典）: ①第2回会議で「要件定義書ドラフト＋価格表（基本/オプション/月額）＋デザイン方向2〜3案」を同時提示 → ②決裁者が同席か事前確認（LIG）→ ③会議内で方向性を1案に決定、価格プランを選択 → ④議事録＋見積書（有効期限付き）＋契約書（検収14日・修正回数・変更管理条項）を送付 → ⑤署名／着手金で正式開始。
- **変更要求（CR）フォーム**: CR番号／依頼日／依頼内容／理由／影響範囲（画面・機能）／追加工数・費用／納期影響／対応区分（無償: 軽微・誤記、有償: 仕様変更、次フェーズ送り）／承認者・承認日（推論。atsoho「変更管理プロセスに従い別途見積」に基づく）。
- **法務成果物セット**（推論＋出典）: 業務委託契約書（納期・著作権・検収・修正回数・追加費用・保守）、利用規約（予約サービスの利用条件、禁止事項、免責、準拠法）、プライバシーポリシー（取得項目: 氏名・電話・メール・予約履歴・来店履歴、利用目的、第三者提供、委託先=ホスティング/メール配信、開示請求窓口。個人情報保護法に基づく「利用目的の公表」「保有個人データに関する事項」が核になるが、個人情報保護委員会の一次資料は本セッション未取得）、キャンセルポリシー（消費者契約法9条の範囲内）、特定商取引法表記（オンライン決済を行う場合。本フェーズは決済対象外なら不要の可能性。要確認）。

### Gaps
- 個人情報保護委員会（PPC）の公式ガイドラインに基づくプライバシーポリシー必須記載事項は検索上限のため一次確認できず。
- 電子カルテ（後続フェーズ）の法規制（医療情報ではない「美容カルテ」の扱い）は未調査。
- 利用規約テンプレの一次資料（例: 経産省「電子商取引及び情報財取引等に関する準則」）は未調査。

---

## KQ8. 公開・運用: Vercelのステージングと本番、公開チェックリスト、ロールバック、監視、非技術者向け引継ぎ、保守契約

### Takeaway
Vercelでは「カスタム環境（Pro/Enterprise）」「ステージド本番デプロイ（全プラン）」「staging ブランチ＋固定ドメインのプレビュー運用（Hobby含む全プラン）」の3方式でステージングを作り、Instant Rollback は再ビルドなしで本番ドメインを過去デプロイに戻せる（Hobbyは直前1つのみ、ロールバック後は自動本番割当がオフになる点に注意）。公開前チェックはOGP・favicon・404・HTTPS/mixed content・フォーム送信・title/description・サイトマップ送信・GA4・リダイレクト・プライバシーポリシー・実機確認が定番。

### Cited Findings
- Vercel ステージング3方式: (1) カスタム環境（Pro/Enterprise）、(2) ステージド本番デプロイ（全プラン。本番構成でビルドを検証してから本番ドメインを割当）、(3) 永続的な staging ブランチ＋ドメインによるブランチベースのプレビュー運用（Hobby含む全プラン）。ステージド本番は本番環境変数を使うため、テストが本番サービス・本番データに到達するリスクがある — [Vercel KB: staging environment](https://vercel.com/kb/guide/set-up-a-staging-environment-on-vercel)
- プロモート: プレビューを本番にプロモートすると本番環境変数でフルリビルド。既にステージ済みデプロイのプロモートはリビルド不要で即時に本番ドメインが割り当たる — [Vercel Promoting Deployments](https://vercel.com/docs/deployments/promoting-a-deployment)
- Instant Rollback: 本番ドメインを以前のデプロイに再割当し、再ビルドしないため高速。環境変数は現在値のまま（変更しても反映されない）。Hobbyは直前の本番デプロイのみ、Pro/Enterpriseは過去に本番を配信した任意のデプロイを選択可。本番ドメインに割り当てられたことのないデプロイ（多くのプレビュー）は対象外。ロールバック後は本番ドメインの自動割当がオフになり、戻すには別デプロイをプロモートしてロールバックを解除する必要がある — [Vercel Instant Rollback](https://vercel.com/docs/instant-rollback)、[Vercel Rolling back a production deployment](https://vercel.com/docs/deployments/rollback-production-deployment)、[Vercel changelog](https://vercel.com/changelog/instant-rollback-is-now-available-to-revert-deployments)
- Rolling Releases（段階的リリース）やGit連携（GitHubプッシュで自動デプロイ）のドキュメントあり — [Vercel Rolling Releases](https://vercel.com/docs/rolling-releases)、[Vercel for GitHub](https://vercel.com/docs/git/vercel-for-github)
- 公開前チェック項目: 「お問い合わせボタンを押してもエラー」「SNSでシェアしたら画像が出ない」「タブのアイコンが空っぽ」が公開直後の典型的失敗。50項目のスプレッドシート付き日本語チェックリスト（2026年更新）あり — [リベシティ 公開前チェック](https://library.libecity.com/articles/01KQDKJQJMWPV1CB5SV6SZN7JT)、[リベシティ 2](https://library.libecity.com/articles/01HT294GV4G8VNSJSHN9HXCPBR)
- 英語25項目チェックリスト: OG画像1200×630以上・https・5MB未満、OGタイトル/ディスクリプション文字数、twitter:card、主要SNSでの表示検証、カスタム404（トップへのリンク）、全ページHTTPSとmixed contentの確認、ユニークなtitle（60文字未満）、XMLサイトマップをSearch Consoleへ送信、GA4、旧URLからの301、プライバシーポリシーのフッターリンク、複数ブラウザ・スマホ確認、Core Web Vitals — [bildirchingroup Pre-Launch Checklist](https://bildirchingroup.com/blog/pre-launch-website-checklist)、[dev.to verify before deploying](https://dev.to/alisamir/verify-these-aspects-before-deploying-your-website-5hmp)
- Front-End Checklist: Testing節に「本番のリアルタイムエラー監視を統合（High）」「主要ブラウザ横断（High）」「実機モバイル（High）」、SEO節に favicon・サイトマップ4XX・LocalBusiness構造化データ（美容室に該当）等 — [Front-End Checklist](https://github.com/thedaviddias/Front-End-Checklist)
- ベイジ: 公開直後にも軽微なテストを実施、その後運用ミーティング。公開前に運用上の基本ルール・実施タスクを定義した【運用設計書】を整理する例 — [baigie 2021](https://baigie.me/officialblog/2021/08/31/baigie-workflow/)
- 手順書は特定作業のステップごとの指示、マニュアルはより広範な背景・指示・ガイドライン。作成後はフィードバックによる改善と最新版への更新が重要 — [お名前.com マニュアル](https://www.onamae.com/business/article/65542)
- 納品＝公開と考えていた制作者が公開前レクチャーを求められた事例（レクチャー・引継ぎは契約に明記すべき） — [CrowdWorks相談](https://crowdworks.jp/consultation/threads/17708)

### Inferences（本案件の公開・運用ドキュメント案）
- **環境構成（推論、Vercel docs準拠）**: `main`→本番、`staging`→固定ドメイン（例 staging.example.com、Basic認証 or Vercel Authentication で保護）、PRごとのプレビュー。DBは本番とステージングを分離（ステージド本番デプロイは本番DBに触るため、受入テストはstagingブランチ方式が安全）。Hobbyプランだとロールバックが直前1件のみなので、本番運用はProを推奨するか、ロールバック制約を引継書に明記。
- **公開手順書（テンプレ）**:
```
0. 前提: 検収合格、ドメイン・DNS管理権限、メール送信ドメイン認証（SPF/DKIM）完了
1. 公開前チェックリスト実施（OGP/favicon/404/HTTPS/フォーム実送信/メール到達/title・description/サイトマップ/robots/GA4/構造化データ LocalBusiness/実機iOS・Android/Lighthouse・axe基準/規約・ポリシーリンク）
2. 本番環境変数の最終確認（通知先メール・LINEトークン・DB接続先）
3. データ投入（メニュー・料金・営業時間・休業日・スタッフ）と初期予約データの確認
4. staging で最終受入 → main へマージ → 本番デプロイ → ドメイン割当確認
5. 公開直後テスト（予約1件作成→通知→管理PWAで確認→キャンセル）
6. Search Console サイトマップ送信、Googleビジネスプロフィールの予約URL更新
7. ロールバック手順（Vercel Instant Rollback → 解除はプロモート）、連絡先、判断基準
8. 公開報告（議事録形式）と公開後2週間の観察項目
```
- **運用マニュアル（非技術者＝オーナー向け、推論）**: 日次（予約確認・当日来店処理）、随時（手動予約・ブロック・休業設定・メニュー変更）、月次（バックアップ確認・アクセス数確認）、困ったとき（表示されない／通知が来ない／二重予約の対処、連絡先・対応時間）、アカウント一覧（Vercel・DB・ドメイン・メール配信・LINE。パスワードは別管理）、費用一覧（ホスティング・ドメイン・メール配信の更新日）、やってはいけない操作。
- **保守契約（推論）**: 月額に含むもの（監視・依存更新・軽微修正○時間・規約改訂・Q&A対応）／含まないもの（新機能・デザイン変更=別見積）、対応時間（例 平日10–18時）、障害時の初動目標、契約期間・解約条件、ソースコードとアカウントの帰属（クライアント所有が望ましい）。
- **監視（推論、Front-End Checklist「リアルタイムエラー監視」に基づく）**: エラー監視（Sentry等）、アップタイム監視、Vercel Analytics／Speed Insights、通知失敗ログ、週次のLighthouse。

### Gaps
- Vercel の Observability／Monitoring 製品の現行仕様、および Hobby/Pro の2026年時点のプラン制限は、検索要約に「記事の鮮度が21〜1,248日とばらつく」とあるため、ダッシュボードで要再確認。
- 非技術者向け引継ぎ資料の日本語一次テンプレは見つからず（上記は筆者案）。
- 保守契約の月額相場（フリーランス）は検索上限で未調査。

---

## 付録A. 本案件向け「成果物ドキュメント一覧」とテンプレート見出し（統合）

| # | 文書 | 主な見出し（本ノート該当節） | 作成タイミング |
|---|---|---|---|
| 1 | 計画書（企画提案書） | 背景・目的・KPI／対象ユーザー／提供価値／スコープ概要／体制・役割／マイルストーン／概算予算レンジ／リスク／次のアクション（KQ1, KQ6, LIG提案書） | 第1回会議後 |
| 2 | 市場・参考・競合分析 | 競合3〜5店の予約導線比較（手順数・入力項目・キャンセル規定・通知）、ホットペッパー等プラットフォーム依存の課題、参考サイトのトーン分類（KQ4 Hakky「競合調査」） | 第2回会議前 |
| 3 | 要件定義書 | KQ2テンプレ（14章） | 第2回会議でドラフト合意 |
| 4 | 価格表・見積書・契約書 | 基本／オプション／月額／条件（修正回数・検収14日・変更管理）（KQ6, KQ7） | 第2回会議 |
| 5 | 設計書一式 | サイトマップ／画面一覧／画面遷移図／WF／ER／状態遷移／API／コンポーネント／ADR（KQ3） | WF承認〜実装前 |
| 6 | デザイン提案書 | 方向性2〜3案（スタイルタイル）→ベースデザイン→全画面カンプ、デザインガイド（KQ4） | 第2回会議〜 |
| 7 | 評価レポート | 認知的ウォークスルー結果／ヒューリスティック所見／ユーザビリティテスト結果（KQ5） | 各レビュー時 |
| 8 | テスト仕様書・結果 | 受け入れ基準と1:1対応のテストケース、ブラウザ・実機マトリクス、Lighthouse/axe結果、不具合一覧（KQ5） | 実装後〜検収 |
| 9 | 公開手順書 | KQ8テンプレ | 公開前 |
| 10 | 運用マニュアル／運用設計書／保守契約 | KQ8 | 公開〜引継ぎ |
| 11 | 議事録・確認事項リスト・変更要求 | KQ7テンプレ | 通年 |

## 付録B. 調査方法と信頼性の注記
- 本セッションではベイジ・LIG・Vercel・NN/g・atsoho 等の本文を直接取得できず、WebSearch の要約抜粋に依拠している。引用文（「」内）は検索結果の抜粋であり、原文と一致する可能性は高いが、文書作成時に原典で再確認することを推奨する。
- GitHub上の一次資料（Lighthouse CI、axe-core、ADR集、Front-End Checklist）は全文取得し、数値・仕様はそこから引用した。
- 「Inferences」節の表・テンプレートは出典の骨格を本案件に当てはめた筆者案であり、業界標準そのものではない。
