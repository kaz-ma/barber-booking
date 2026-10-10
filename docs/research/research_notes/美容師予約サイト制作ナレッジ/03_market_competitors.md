# 03 市場・競合分析：日本の美容室/バーバー向け予約システムと電子カルテ（2026年10月時点）

> 調査メモの前提
> - 本環境では WebFetch と curl による直接取得がほぼ全ホストで遮断（CONNECT 403 / 接続不可）だったため、WebSearch の検索結果スニペットと要約を一次情報源として整理した。各社公式の料金ページ本文は直接確認できていない箇所があり、該当箇所には「要公式確認」と明記する。
> - 調査途中で本ターンの WebSearch 上限に達したため、「大阪のメンズブリーチ相場」「美容センサス2025/2026年の男性ネット予約率」「かんざし/リザービアの料金」「サロンボードのリマインド機能」「大阪のバイリンガルバーバー公式サイト実例」は未取得（Gaps 参照）。追加検索はフォローアップで可能。
> - 料金は記載時点の第三者比較サイトまたは公式告知の引用。契約前に必ず公式ページで再確認すること。

---

## KQ1. 国内主要サロン予約プラットフォーム/ツールの比較（対象・料金・機能・強み弱み・モバイルUI）

### Takeaway
日本のサロン予約市場は「集客ポータル型（Hot Pepper Beauty／minimo）」「汎用予約SaaS型（RESERVA／STORES予約／Square予約）」「サロン業務特化型（SalonAnswer／Beauty Merit／LiME／かんざし）」「LINE 起点（LINE公式アカウント／LINEビューティープラス）」に分かれ、個人・一人サロンが使える実質無料枠は minimo・RESERVA Free・STORES予約 Free・Square予約 Free・LiME 無料プラン・LINE コミュニケーションプランの6つ。ただし無料枠はいずれも「月50件予約」「カルテ5枚/人」「月200通」などの上限や、ブランド表示・集客ポータル依存・決済手数料（3.6〜4.9%）という制約を持つ。

### Cited Findings

**市場全体・比較記事**
- it-trend.jp は 2026年4月時点の情報に基づく美容室向け予約システム16選を公開。選定軸として「ホットペッパービューティーなど集客サイトとの連携」「初期費用・月額費用・従量課金などの料金体系の透明性」「スタッフが使いやすい操作性」「サポート体制」を挙げる — [it-trend.jp](https://it-trend.jp/reservation/article/409-5092)
- ミツモアの比較記事では「既存の予約システムは月額3万円以上かかる」という声が紹介され、製品間の費用差が大きい — [meetsmore.com](https://meetsmore.com/product-services/beauty-salon-reservation)
- 「美歴」（スパイラル株式会社）は個人向け Personal プラン月額8,800円・初期費用0円〜、スタッフ2名以上向け Team プラン月額15,400円・初期費用44,000円〜 — [it-trend.jp](https://it-trend.jp/reservation/article/409-5092)
- 個人経営なら無料プランや低月額のサービスを検討する価値がある。Square は余計な費用がかからない分かりやすい料金体系だが「時間予約制の店舗や複数スタッフのサロンには向きにくい」という指摘もある — [it-trend.jp](https://it-trend.jp/reservation/article/409-5092)

**Hot Pepper Beauty／サロンボード（リクルート）**
- 2025年12月時点でホットペッパービューティーは無料掲載不可、月額固定の掲載料が発生。無料プランがあるのは飲食店向けホットペッパーグルメのみ — [atsoho.com](https://atsoho.com/blog/hot-pepper-listing-fees-expensive)
- 掲載料の金額は非公開で、公式FAQでは「ご希望のエリアやプランによって異なります」とされ、問い合わせが必要 — [freee.co.jp](https://www.freee.co.jp/personal-business/guide/articles/1907/)
- 予約ごとの手数料は2%とする解説があり、「掲載料（固定費）と予約手数料（2%）を考慮したうえで価格設計が必要」 — [squareup.com townsquare](https://squareup.com/jp/ja/townsquare/the-publication-fee-of-hot-pepper-beauty)
- 『サロンボード』自体の利用料は無料だが、ホットペッパービューティーへの掲載が前提。ネット予約の受付・反映を自動で行い、電話予約や来店客は手入力で一元管理。顧客管理（カルテ）は顧客情報・来店履歴・メモを登録でき、Excel からの一括登録や重複顧客の統合に対応 — [recatch.jp](https://recatch.jp/blog/salonboard-usage/)
- サロンボードのカルテ機能は掲載サロンであれば利用できるが、単体では契約できない — [tada-reserve.jp](https://tada-reserve.jp/blog/medical-record-2/)
- サロンボードには PC 版管理画面とスマホアプリがあり使い分ける運用 — [recatch.jp](https://recatch.jp/blog/salonboard-usage/)
- 他ポータルの参考価格：ビューティーパークはミニプラン3,300円税込、スタンダード11,000円税込（HPB とは別サービス） — [freee.co.jp](https://www.freee.co.jp/personal-business/guide/articles/1907/)

**minimo（MIXI）**
- 運営は株式会社MIXI。店舗単位ではなく施術者個人単位で掲載する形式で、利用者はスタッフ個人の口コミやプロフィールを見て予約。スマホアプリから短時間で掲載可能 — [App Store](https://apps.apple.com/jp/app/id719858778); [appbank.net](https://www.appbank.net/app-rank/matching/hairdresser)
- 第三者サイトの記述では、minimo の登録・掲載費用は初期費用0円・月額0円・手数料0〜660円（税込）。手数料の発生条件や現在も同額かは未確認（要公式確認） — [shopowner-support.net](https://www.shopowner-support.net/?p=34329)
- 店舗向けには、スタッフ個人の minimo 予約内容やスケジュールを店舗の PC で確認できる管理ツールがある — [wwdjapan.com](https://www.wwdjapan.com/?p=172047)
- 2026年に「minimo」と「Nailie Beauty」が「施術者個人が選ばれる予約体験」を広げる共同プロジェクトを開始 — [zaikei.co.jp](https://www.zaikei.co.jp/releases/3467891/)
- 利用者視点：カットモデル募集で0円枠があり、見習い美容師が技術習得のために担当することが多い。アプリ限定価格・ポイント還元がある — [libecity](https://library.libecity.com/articles/01JYY4SQP3016W5WRQKC4Q8B7X); [App Store](https://apps.apple.com/jp/app/id719858778)

**RESERVA（コントロールテクノロジー）**
- 無料プランは月50件予約・登録顧客250件まで、サポートはメールのみ — [saas.imitsu.jp](https://saas.imitsu.jp/cate-reservation/service/2735/price)
- 有料は5段階。年払い月額（税込）でブルー3,850円、シルバー6,600円、ゴールド13,200円、エンタープライズ23,100円、スイート46,200円（月払いはそれぞれ高い）。機能数はフリー43・ブルー44・シルバー54・ゴールド82・エンタープライズ110・スイート116（imitsu ではフリー44/ブルー45と1つずつ差異あり） — [atsoho.com](https://atsoho.com/blog/compare-reserva); [saas.imitsu.jp](https://saas.imitsu.jp/cate-reservation/service/2735/price)
- ブルーは月200件予約・顧客1,000件まで — [saas.imitsu.jp](https://saas.imitsu.jp/cate-reservation/service/2735/price)
- 初期費用・サポート費用は全プラン0円。電話サポートはエンタープライズ以上。月額以外に LINE 連携（月額3,300円）、クーポン発行（1件330円）、オンライン決済手数料（決済額の4.9%）が別途 — [atsoho.com](https://atsoho.com/blog/compare-reserva)
- 50業種以上に対応する SaaS 型予約システムで、予約ページ専用 URL の自動生成機能がある — [it-trend.jp](https://it-trend.jp/reservation/23674)
- 注意：atsoho の比較記事は「2026年9月2日時点の公式ページ」に基づくと記載しているが、本調査日（2026年10月10日）と整合する一方、検索要約では日付の不整合が指摘されたため要公式確認 — [atsoho.com](https://atsoho.com/blog/compare-reserva)

**STORES予約（旧 Coubic／STORES 株式会社）**
- フリー：無料、月間予約50件、予約ページ公開数2。スモール：月額9,790円（税込・年契約、通常12,980円）、月200件、公開ページ10。チーム：月額19,690円（税込・年契約、通常77,000円と記載）、月5,000件、公開ページ100。最低利用期間3ヶ月 — [saas.imitsu.jp](https://saas.imitsu.jp/cate-reservation/service/2711/price); [atsoho.com](https://atsoho.com/blog/compare-stores)
- 2020年に Coubic の予約システムが「STORES 予約」としてリブランドされた — [internet.watch.impress.co.jp](https://internet.watch.impress.co.jp/docs/news/643856.html); [paymentnavi.com](https://paymentnavi.com/?p=99790)
- 公式ドメインが stores.jp から stores.fun へ移行しており、料金は移行後の公式ページで確認するよう勧められている — [atsoho.com](https://atsoho.com/apps/p/stores)
- Instagram の「今すぐ予約」ボタン連携先として、サロン・美容室向けに Square予約、STORES予約、Reservia が挙げられている — [biz.moneyforward.com](https://biz.moneyforward.com/restaurant/basic/3205/)

**Square予約（Square Japan）**
- 月額プランはフリー・プラス・プレミアムの3つで、料金は店舗ごと。フリーは無料で決済手数料のみ。プラス3,000円/店舗、プレミアム8,000円/店舗（別途決済手数料） — [squareup.com FAQ](https://squareup.com/jp/ja/appointments/faq); [saas.imitsu.jp](https://saas.imitsu.jp/cate-reservation/service/3526/price)
- 決済手数料：対面2.5%〜、手入力の非対面カード決済3.75%、Square オンラインビジネスで作成したサイトでのカード決済3.6% — [squareup.com](https://squareup.com/jp/ja/townsquare/appointment-system-pricing)
- 無断キャンセル対策：前払いポリシーにカード情報の保存を含めると、ポリシー違反のキャンセル時にそのカードへ請求可能。手数料方式は「予約ごと一律」「サービスごと一律」「サービス料金に対する割合」の3種 — [squareup.com help](https://squareup.com/help/jp/ja/article/5493-set-a-custom-cancellation-policy-with-square-appointments)
- 美容業向けソリューションページあり — [squareup.com/jp/ja/solutions/beauty](https://squareup.com/jp/ja/solutions/beauty)

**SalonAnswer（サロンアンサー）／Beauty Merit（ビューティーメリット）／エステアンサー**
- サロンアンサー：基本費用月額9,800円（税抜）〜、初期費用130,000円（税抜）。2026年7月時点の公式サイト情報とされる。月額には安心サポートパック2,000円が含まれ、未加入だとサポートはメールのみ。「理美容サロン専門プラン月額10,780円〜（税込）」という古い掲載もあり時期で差 — [b-merit.jp](https://www.b-merit.jp/magazine/salonanswerguide/); [register-pos-navi.com](https://www.register-pos-navi.com/list/salonanswer.html)
- サロンアンサーのオプション：LINE ミニアプリ月額6,800円（税抜）、ネット予約月額5,000円〜（税抜）。注意事項メモや施術前後の写真撮影・保存も可能 — [aiony.jp](https://aiony.jp/column/about-salonanswer/); [orend.jp](https://orend.jp/service/page/01jr01f1gsfwjkjate497tnm3y)
- サロンアンサーは POS 起点、ビューティーメリットは予約・顧客接点起点の設計 — [b-merit.jp](https://www.b-merit.jp/magazine/salonanswerguide/)
- ビューティーメリット：初期導入費用100,000円（税別）、月額20,000円〜（税別）。POS 連携には連携初期費用20,000円・連携月額3,000円が別途。初期費用半額キャンペーンは2022年3月31日申込分で終了 — [ex.salonanswer.com](https://ex.salonanswer.com/information/beautymerit-campaign/); [ex.salonanswer.com LP](https://ex.salonanswer.com/lp/beautymerit2402/)
- ビューティーメリットは美容サロン・化粧品販売店向け予約システムで、在庫管理・予約受付・顧客情報管理・売上分析・カルテのデータ化に対応。料金プランは規模に応じて複数 — [meetsmore.com](https://meetsmore.com/products/beauty-merit)
- エステアンサー：月額14,800円〜（税抜）、初期費用130,000円（税抜）。ビューティーメリットはオプション扱い — [esthe.salonanswer.com](https://esthe.salonanswer.com/price/)

**かんざし（KANZASHI／CYND 株式会社サインド 4256）**
- 「さまざまなサイトから入る予約を取りまとめる予約一元管理サービス KANZASHI（かんざし）」。決算資料では「サービス利用料として月額費用（サブスクリプションモデル）を受領」 — [www2.jpx.co.jp 決算資料](https://www2.jpx.co.jp/disc/42560/140120250624598594.pdf); [speakerdeck CYND](https://speakerdeck.com/cynd/shi-ye-ji-hua-ji-bicheng-chang-ke-neng-xing-niguan-surushi-xiang-2026nian-6yue-25ri)
- 具体的な月額・初期費用は検索結果に含まれず（Gaps）。

**LINE公式アカウント／LINEビューティープラス（LINEヤフー）**
- LINE公式アカウントの料金は3プラン（月額税別）：コミュニケーションプラン無料（200通）、ライトプラン5,000円（5,000通、超過時の追加配信不可）、スタンダードプラン15,000円（30,000通、超過分は従量課金） — [ligla.jp](https://ligla.jp/blog/line-official/messagenumber/); [lycbiz.com](https://www.lycbiz.com/jp/column/line-official-account/technique/20200204/?o=JP3144)
- 美容室が LINE で予約を受ける方法は「LINE チャット」と「LINE ミニアプリ」の2系統（2025年8月公開のLINEヤフー記事） — [lycbiz.com](https://www.lycbiz.com/jp/column/line-official-account/marketing/salon-reservation/?o=JP3144/)
- 「LINEビューティープラス」はヘアサロン特化で2026年6月（予定）提供開始。LINE 上で予約受付でき予約手数料0円、LINE 以外からの予約も管理画面で一元管理、予約時点と24時間前の自動リマインド、カウンセリングシート・カルテ作成・共有、顧客情報一元管理、メッセージ配信に対応。決済端末・POS 連携は2027年春頃予定。利用料金割引等のキャンペーンあり（金額は未確認） — [lycorp.co.jp プレスリリース](https://www.lycorp.co.jp/ja/news/release/020112/); [LINE Beauty Plus 資料PDF](https://go.lycbiz.com/rs/265-EZN-548/images/line-beauty-plus.pdf)
- LiME は LINE ミニアプリのパッケージとして掲載されており、初期費用20,000円〜・月額9,240円〜 — [lycbiz.com LiME パッケージ](https://www.lycbiz.com/jp/service/line-mini-app/package/lime)

**LiME（LiME Salon／LiME 株式会社）**
- 予約・電子カルテ・会計を一つにまとめたクラウド型 CRM。Web 予約や問診内容がカルテに自動反映 — [meetsmore.com](https://meetsmore.com/products/lime)
- 無料プランで予約表・写真付き顧客管理・当月の売上レポートが利用可。顧客管理は無制限だがカルテは1人あたり5枚まで。有料は店舗契約プラン9,240円〜（従業員数で変動）。POS レジ・カード決済も備える — [saas.imitsu.jp](https://saas.imitsu.jp/cate-crm/service/4634/price); [limehair.jp](https://limehair.jp/salon/)
- 2026年3月時点の比較記事では月額「要問い合わせ」とされ、掲載時期で情報が異なる — [strate.biz](https://strate.biz/?p=69955)

**Fresha／Booksy（海外勢）**
- Fresha は以前の「定額無料」モデルを廃止し段階的サブスクリプションへ。ソロ事業者月額19.95ドル、チームは予約担当者1人あたり月額14.95ドル。マーケットプレイス経由の新規顧客予約には20%の手数料（1件あたり最低6ドル） — [pabau.com](https://pabau.com/blog/fresha-vs-booksy/); [medium.com The True Cost of Fresha](https://medium.com/@asbaines/the-true-cost-of-fresha-276d6856bcc0)
- Booksy はスタッフごとの月額課金で Standard プランが1ユーザー月額29.99ドル。大規模な消費者向け美容マーケットプレイスへのアクセスが強み — [calendesk.com](https://calendesk.com/compare/booksy-vs-fresha); [pabau.com](https://pabau.com/blog/fresha-vs-booksy/)
- 両社の日本語対応・日本展開・日本の決済手段対応は検索結果から確認できず（Gaps）。

**その他の国内サービス（参考）**
- freee 予約：フリーランス美容師（面貸し利用）を主な対象に挙げ、「SNS を触るような直感的な操作」で予約確認・顧客管理が完結、予約前後の準備時間確保や予約枠のクローズ設定の機能を訴求（販売側の説明） — [freee.co.jp/reservation/industry/nail-hair](https://www.freee.co.jp/reservation/industry/nail-hair/)
- タダリザーブ：月額無料で使える予約管理システムとして自社ブログで訴求 — [tada-reserve.jp](https://tada-reserve.jp/blog/medical-record-2/)
- 電子カルテ特化製品として KaruteKun（カルテくん）、BeKARTE（ビカルテ、電子契約も）が存在 — [karutekun.com](https://karutekun.com/); [be-salo.com](https://www.be-salo.com/besalo/function/karte/)

### Inferences
- 一人バーバーの月間予約件数は、週5〜6日営業・1日6〜8名として月150〜200件程度と見込まれるため、RESERVA Free（月50件）・STORES予約 Free（月50件）の無料枠は確実に超過し、最低でも RESERVA ブルー（3,850円/月・月200件）または STORES スモール（9,790円/月）が必要になる。「SaaS でも無料では済まない」が「なぜ自作か」の根拠になる。
- Hot Pepper Beauty は掲載料非公開かつ固定費＋2%手数料で、若年男性向け一人サロンの単価（後述4,000〜5,000円帯）に対し固定費負担が重い。一方で「ネット予約できた」が初回来店時の重視ポイントとして伸びている（KQ2参照）ため、ポータルに載せなくても「自前のネット予約」を持つことが集客要件になる。
- SalonAnswer/Beauty Merit は初期10〜13万円・月額1〜2万円で複数スタッフ店舗向け設計。一人サロンには過剰。
- 海外勢（Fresha/Booksy）は日本語・日本の決済（PayPay 等）対応が確認できず、2026年時点の大阪一人サロンの第一候補にはならない。
- モバイル UI パターン（本調査で直接画面を確認できなかったため推測）：Hot Pepper Beauty は「クーポン/メニュー選択 → スタイリスト指名 → 日時カレンダー（週表示の○×グリッド）→ ログイン/会員情報 → 確認」の縦ステップ構成、RESERVA は「メニュー → 日付（月カレンダー）→ 時間スロット → 顧客情報 → 確認」のウィザード型で予約ページ専用 URL をプロフィールリンクに貼る運用が多い。この UI 描写は一次情報未確認のため、デザイン提案前に実機で検証すること。

### Gaps
- Hot Pepper Beauty の掲載料の実額（エリア・プラン別）：非公開のため不明。大阪市内のメンズサロン向け最低プランの相場は営業問い合わせが必要。
- minimo の出品者側手数料の正確な条件（1件660円が成約手数料か、いつ発生するか）：公式ページを取得できず未確認。
- かんざしの料金・リザービア（Reservia）の料金と機能：検索上限により未取得。
- サロンボード／HPB のリマインド・無断キャンセル対策機能の有無：未取得。
- Fresha/Booksy の日本語 UI・日本決済対応状況：未確認。
- 各サービスのモバイル予約画面の実パターン（スクリーンショット）：フェッチ遮断により未確認。

---

## KQ2. フリーランス／面貸し／シェアサロン美容師の予約運用（Instagram DM・LINE・link-in-bio）と課題

### Takeaway
面貸し・フリーランス美容師は「集客やトラブル対応を一人で担う」立場にあり、Instagram DM 予約は手軽だが「予約の見落とし」「ダブルブッキング」「返信漏れによる機会損失」というリスクが国内外の解説で一致して指摘されている。対策は「DM で毎回やり取りさせない明確なルール＋予約リンクへの誘導」「Instagram プロアカウント＋提携予約サービス（Square予約/STORES予約/Reservia）の『今すぐ予約』ボタン」の2系統。

### Cited Findings
- 面貸し美容師は「マイペースで働けるが、集客やトラブルは一人で対応」する点が特徴 — [gentosha-go.com](https://gentosha-go.com/articles/-/28298)
- DM で直接予約を受ける方法は「システム連携が不要で手軽に始められますが、予約の見落としやダブルブッキングといった管理上のリスクが伴います」。Instagram の「今すぐ予約」ボタンを使うにはプロアカウントに切り替え提携予約サービスに登録が必要で、サロン・美容室向けには Square予約、STORES予約、Reservia が挙げられている（2026年4月1日更新） — [biz.moneyforward.com](https://biz.moneyforward.com/restaurant/basic/3205/)
- DM での予約やダブルブッキング、返信漏れが機会損失につながると指摘。DM 運用ルール・テンプレート、LINE やメールとの役割分担が論点 — [lifestyle.assist-all.co.jp](https://lifestyle.assist-all.co.jp/instagram-dm-complete-guide-sending-safety-tips-business/)
- 予約問い合わせへの返信遅れで来店につながらないケースが中小事業者の SNS 運用でよくある課題。対策としてプロアカウントのビジネスチャットで定型文・自動応答・ラベル分けを使い対応を仕組み化 — [yoshikazunomori.com](https://yoshikazunomori.com/blog/digitalmarketing/instagram-business-chat/)
- 美容師の Instagram 集客では「予約までの流れはプロフィールで決まる」とされ、「メニュー詳細はハイライトへ」と添えることが信頼感向上に役立つ — [yoshikazunomori.com](https://yoshikazunomori.com/?p=8876); [yoshikazunomori.com 美容師向け](https://yoshikazunomori.com/blog/digitalmarketing/instagram-customer-attraction-hairdresser/)
- 海外サロン向け記事：DM 予約では依頼がメッセージリクエストに埋もれる・返信を忘れる・ダブルブッキングが起きる。予約リンクを使うと日時管理や境界線の設定がしやすい — [home.bby.site](https://home.bby.site/blog/dm-to-book)
- 顧客に毎回 DM させない明確なルールを設け、自分で予約してもらうよう慣れさせることを推奨。予約リンクがあると境界線を設けやすい — [styleseat.com](https://styleseat.com/blog/get-salon-clients-to-stop-dming-you)
- DM 返信は数時間以内を目安にしつつ、常に即応する必要はない — [twentypro.co.uk](https://twentypro.co.uk/blogs/news/tech-tips-dms-to-bookings-how-to-turn-enquiries-into-paying-clients)
- DM から予約ツールへ誘導する仕組みとして、予約フォームのリンクを DM で送る方法や DM 内で予約を完結させる自動化が紹介されている — [interakt.shop](https://www.interakt.shop/instagram-automation/appointment-management/)
- freee 予約はフリーランス美容師（面貸し利用）向けに「予約前後の準備時間確保」「予約枠のクローズ設定」を機能として訴求 — [freee.co.jp](https://www.freee.co.jp/reservation/industry/nail-hair/)
- 面貸しマッチング「AIR SALON」は2016年に「美容業界版 Airbnb」として紹介された（現在の運営状況は未確認） — [thebridge.jp](https://thebridge.jp/2016/06/air-salon)
- minimo は施術者個人単位で掲載・予約されるため、面貸し/フリーランスの集客チャネルとして機能（KQ1 参照） — [appbank.net](https://www.appbank.net/app-rank/matching/hairdresser)

### Inferences
- クライアント（Instagram DM 運用の一人バーバー）の現状の痛点は、上記の「見落とし・ダブルブッキング・返信漏れ・施術中に返信できない」にそのまま該当する。管理 PWA への Push 通知は「施術中でも新規予約に気づける」「返信漏れを構造的に防ぐ」という価値に直結する。
- Instagram の「今すぐ予約」ボタンは提携サービス限定のため、自作サイトでは「プロフィールのリンク欄＋ハイライト『予約方法』＋DM 自動応答で予約 URL を返す」導線が現実解。Instagram の DM 自動応答（ビジネスチャット）と組み合わせる要件を仕様に含めるべき。
- 若年男性客は LINE よりも Instagram で美容師をフォローしている前提（クライアントの現状運用から）なので、LINE 公式アカウントは「リマインド通知チャネル」として第二優先、まずは SMS/メール/Web Push のリマインドで足りる可能性が高い。

### Gaps
- 日本のフリーランス美容師の予約手段別利用率（Instagram DM / LINE / 予約サイト）のアンケート・定量データ：見つからず。
- 「インスタ DM 予約をやめて予約サイトに切り替えた」日本語の具体的な体験談：検索では未発見。
- lit.link 等の link-in-bio ツールの美容師利用実態：検索結果に情報なし。

---

## KQ3. 美容室向け電子カルテ（記録項目・製品・個人情報保護法上の考慮）

### Takeaway
美容室カルテの標準項目は「基本情報（氏名・連絡先）」「髪質・体質・アレルギー・ライフスタイル」「施術履歴（来店時の髪の状態、仕上がり、使用薬剤・配合・放置時間、パーマ設定）」「写真・動画（施術前後）」「カウンセリング内容・要望・会話メモ」。個人情報保護法は2022年施行の改正以降、個人事業主を含む全事業者に適用され、顔写真は個人情報、体調・アレルギー・既往歴は要配慮個人情報に当たり得るため、取得時の利用目的明示と明確な同意、アクセス権限・暗号化等の安全管理措置が必要。

### Cited Findings

**記録項目**
- 基本情報：氏名・連絡先に加え、髪質・体質・ライフスタイル・アレルギーの有無。「来店時の髪の状態・どんなヘアスタイルに仕上げたか・使った薬剤や置いた時間など、施術した内容を記録しておくことも大事」 — [jobvr.co.jp](https://jobvr.co.jp/beautysalon-record/)
- 使用薬剤・スタイリング剤のほか、カラーの配合履歴やパーマ設定を残すサロンが増えている — [b-merit.jp 美容室カルテ運用](https://www.b-merit.jp/magazine/hairsalonchartoperationitemdesign/)
- 電子カルテでは動画や写真も併せて保存でき、仕上がりや施術前後の画像を来店時の参照や説明に使える — [rsvia.co.jp](https://rsvia.co.jp/column/customer_management_for_hair_salon/)
- 好み・要望・会話内容を残し次回提案に活かす運用が一般的 — [digi-mado.jp](https://digi-mado.jp/article/70947/)
- LiME は Web 予約や問診内容がカルテに自動反映される — [meetsmore.com](https://meetsmore.com/products/lime)
- SalonAnswer は注意事項メモと施術前後の写真撮影・そのまま保存に対応 — [aiony.jp](https://aiony.jp/column/about-salonanswer/)
- LINEビューティープラスはカウンセリングシートとカルテの作成・共有に対応 — [LINE Beauty Plus 資料](https://go.lycbiz.com/rs/265-EZN-548/images/line-beauty-plus.pdf)

**製品**
- 美容室・サロン向け電子カルテ14選（2025年版）の比較記事が複数存在（aspicjapan、aiony） — [aspicjapan.org](https://www.aspicjapan.org/asu/article/30929); [aiony.jp](https://aiony.jp/column/bionly_karte/)
- 個人サロン向け電子カルテ5選（リザービア運営コラム） — [rsvia.co.jp](https://rsvia.co.jp/column/private_salon_karte/)
- 無料ありの顧客カルテツール5選（2025年9月） — [linestep.jp](https://linestep.jp/2025/09/27/electronic-karute/)
- サロンボード：顧客情報・来店履歴・メモ。HPB 掲載が前提で単体契約不可 — [tada-reserve.jp](https://tada-reserve.jp/blog/medical-record-2/)
- LiME：無料でカルテ1人5枚まで、写真付き顧客管理 — [saas.imitsu.jp](https://saas.imitsu.jp/cate-crm/service/4634/price)
- KaruteKun（カルテくん）：美容室・サロン向け電子カルテアプリ — [karutekun.com](https://karutekun.com/)
- BeKARTE（ビカルテ）：電子カルテ＋電子契約（同意書の電子化） — [be-salo.com](https://www.be-salo.com/besalo/function/karte/)
- 美歴：個人向け月額8,800円（KQ1 参照） — [it-trend.jp](https://it-trend.jp/reservation/article/409-5092)

**個人情報保護法・プライバシー**
- 改正法の施行により「法人に限定されず、営利・非営利の別は問われないため、個人事業主や NPO・自治会等の非営利組織であっても、個人情報保護法を守らなければなりません」 — [j-net21.smrj.go.jp](https://j-net21.smrj.go.jp/qa/org/Q1276.html)
- 改正前は事業に活用する個人情報が5,000人分以下の事業者は義務対象外だったが、改正後は個人事業主や非営利組織を含めて対象 — [businesslawyers.jp](https://www.businesslawyers.jp/practices/790)
- 個人情報保護委員会の中小企業向け資料では、個人情報の例として「氏名」「生年月日と氏名の組合せ」「顔写真」等が挙げられる。取得時に「何の目的で利用されるかご本人に伝わっていますか？」、保管時に「取得した個人情報を安全に管理していますか？」というチェック項目 — [sangyo-rodo.metro.tokyo.lg.jp（PPC 資料転載）](https://www.sangyo-rodo.metro.tokyo.lg.jp/chushou/news/kojinjouhou.pdf)
- 顔写真や顔認証データを体系的に構成して個人情報データベース等を構築した場合、これに含まれる個人情報は個人データに該当し、第三者提供には本人同意が必要 — [businesslawyers.jp](https://www.businesslawyers.jp/practices/790)
- ガイドラインは安全管理措置について「中小規模事業者における特例的な対応」を定めている（手法例示） — [j-net21.smrj.go.jp](https://j-net21.smrj.go.jp/solution/qa/governance/Q1276.html)
- 個人情報保護委員会「通則編」ガイドラインは令和8年（2026年）6月一部改正・令和8年6月14日施行版が最新 — [ppc.go.jp 通則編 PDF](https://www.ppc.go.jp/files/pdf/temp260614_guidelines01.pdf)
- 体調・アレルギー・既往歴は要配慮個人情報に当たる場合があり、取得時の同意は明確に取る必要がある。利用目的の明示、保管期間、アクセス権の削除ルールなど運用ルール整備が求められる。スタッフごとの閲覧・編集権限分離、SSL 暗号化などセキュリティ面の確認も重要。写真を扱う場合は撮影への同意を取る運用も検討 — [digi-mado.jp](https://digi-mado.jp/article/70947/); [blog.hypersoft.co.jp](https://blog.hypersoft.co.jp/electronic-medical-record/)
- 美容師の守秘義務と個人情報保護の基本・違反事例の解説（美容師向けメディア） — [salowin.jp](https://salowin.jp/note/archives/4427)

### Inferences
- 自作カルテのデータモデル推奨：`customer`（氏名/カナ/電話/メール/Instagram ID/言語/初回来店日/来店回数/NG事項）、`visit`（日時/メニュー/担当/金額/所要時間）、`treatment`（薬剤名・配合比・放置時間・パーマロッド径・アイロン温度・ブリーチ回数）、`photo`（before/after、撮影同意フラグ、顧客向け共有可否）、`counseling`（要望・参考画像・次回提案）、`consent`（利用目的同意日時・写真利用同意・SNS 掲載同意）。
- アレルギー・頭皮トラブル欄は要配慮個人情報になり得るため、「任意入力」「取得目的を入力欄の近くに明記」「本人同意のチェック」を UI に組み込む。写真は Vercel Blob/S3 等に保存し署名 URL＋有効期限で配信、顧客本人以外に共有しない設計が安全管理措置として妥当（推測）。
- 一人サロンでは「スタッフ別権限」は不要だが、将来の面貸し仲間への拡張に備え、`role`（owner/stylist/assistant）をスキーマに残す価値はある。
- プライバシーポリシーには「利用目的（予約管理・施術記録・連絡・リマインド）」「保管期間」「第三者提供なし」「委託先（Vercel/Supabase/Resend 等の SaaS 名）」「開示・削除請求の窓口」を明記する必要がある（法の一般要件からの推測）。

### Gaps
- 個人情報保護委員会の公式 Q&A における「美容室の施術写真」「アレルギー情報」の要配慮該当性の明文：ppc.go.jp を直接取得できず未確認。弁護士等への確認を推奨。
- かんざし・リザービア・Beauty Merit の電子カルテ画面の実項目（フィールド名）：未取得。
- 美容室カルテの法定保存義務（美容師法上の保存義務は無いと思われるが未確認）。

---

## KQ4. インバウンド／外国人客への対応（英語対応・期待・大阪のバイリンガル事例）

### Takeaway
大阪では訪日客の外国語口コミのうち英語が最多で、「スタッフとのコミュニケーション不可」「多言語表示の少なさ」「キャッシュレス（カード）決済」が訪日客の困りごととして繰り返し報告されている。大阪の英語対応バーバーの実例（HIRO GINZA 難波、Seven Mens Hair、Noriko's Private Space）は「英語対応可」「希望スタイルの写真提示歓迎」「電話番号のみ」が多く、英語でのオンライン予約導線を持つ店は検索結果では確認できなかった。東京の Assort Hair のように「スタッフごとの英語レベル表示＋オンライン予約フォーム」が参考モデル。

### Cited Findings
- 大阪のホテル・旅館の口コミにおける外国語比率は50.4%で、外国語内訳では英語が最多（2026年4月調査） — [honichi.com](https://honichi.com/news/2026/04/09/202604_inboundranking_hotel_osaka/)
- 大阪市内では多言語表示や無料 Wi-Fi の整備が進んでいる — [honichi.com 難波](https://honichi.com/news/2019/03/04/inboundxosaka/)
- 大阪府の国家戦略特区提案資料（2017年）：「ヘアデザイン」はその技術や日本流の「おもてなし」に対してアジア圏を中心に外国人に人気 — [chisou.go.jp](https://www.chisou.go.jp/tiiki/kokusentoc_wg/h29/teian/20171031_shiryou_t_1.pdf)
- HPB アカデミー調査（2015年）：美容室・エステ・ネイルなど美容サロンに訪日外国人が来店し始めており、理由は「おもてなし」「技術力」「清潔感」 — [hba.beauty.hotpepper.jp RLS_Binbound](https://hba.beauty.hotpepper.jp/wp/wp-content/uploads/2015/12/RLS_Binbound.pdf)
- HIRO GINZA BARBER SHOP 難波（なんばスカイオ内）：英語対応あり、「希望の髪型の写真を見せてもらうのは常に歓迎」、個室あり — [hiroginza.com](https://www.hiroginza.com/salon/osaka2/blog/32311/)
- Seven Mens Hair and Grooming（西心斎橋）：「日本語スキルがなくても来られるので英語話者に非常に人気」。掲載は電話番号（06-6212-7677）のみで予約リンクなし — [bestsalonreport.jp](https://www.bestsalonreport.jp/en/press/8122/)
- Noriko's Private Space（心斎橋、al lleno 内）：日本語に不安のある外国人向けサービス — [en.japantravel.com](https://en.japantravel.com/osaka/norikos-private-space/6898)
- 大阪の英語対応ヘアサロン11選 — [bestsalonreport.jp](https://www.bestsalonreport.jp/en/press/6876/)
- 東京 Assort Hair：スタッフ一覧で各スタイリストの英語流暢度を表示し、オンライン予約フォームで予約する流れ。予約が埋まるため希望スタイルの参考写真持参を推奨 — [toyokeizai.net](https://toyokeizai.net/articles/print-tbt/153453)
- 訪日外国人は決済手段として現金が主流で、旅行中に困ったこととして公共交通、その他決済手段、クレジット/デビットカード利用が挙がる（財務省広報2024年11月） — [mof.go.jp](https://www.mof.go.jp/public_relations/finance/202411/202411m.pdf)
- 日本のキャッシュレス決済比率は2023年に39%で諸外国より低い — [jri.co.jp](https://www.jri.co.jp/page.jsp?id=108628)
- 観光庁の過去調査：2016〜2017年度は「施設スタッフとのコミュニケーションがとれない」が旅行中に困ったことの最多 — [kyokanko.or.jp cashless_survey_2019](https://www.kyokanko.or.jp/wp/wp-content/uploads/cashless_survey_2019.pdf)
- 訪日外国人の多くが多言語表示の少なさ・わかりにくさを感じている — [alsok.co.jp](https://www.alsok.co.jp/info/corporate/inbound_support/)
- PayPay のインバウンド向けキャッシュレスガイド（海外 QR 決済対応の訴求） — [paypay.ne.jp](https://paypay.ne.jp/store-media/multi-payment/inbound-cashless-guide/)

### Inferences
- 自作サイトの差別化ポイント：`/en` ルートで英語メニュー・料金・所要時間・キャンセルポリシー・アクセス（Google Maps 埋め込み＋最寄駅出口）を提供し、予約フォームに「参考写真アップロード」「言語選択（日本語/English）」「来日中の滞在ホテル任意」などを設けると、上記の「写真提示歓迎」「コミュニケーション不安」に直接応えられる。
- 外国人客は電話予約を嫌う傾向（言語障壁）があるため、英語で完結するオンライン予約は大阪バーバー市場で希少価値がある（上記実例が電話のみであることからの推測）。
- カード/タッチ決済・海外 QR（Alipay/WeChat Pay 等 PayPay 経由）への対応状況をサイトに明記することが、訪日客の困りごと（カード不可）に対する安心材料になる。
- Google ビジネスプロフィールの予約リンクに自作サイトの `/en/book` を設定し、英語レビュー獲得導線を作る（推測・一般的な SEO 実務）。

### Gaps
- 観光庁「訪日外国人消費動向調査」2025年版の困りごと・決済の数値：未取得。
- 大阪のバーバーで英語オンライン予約を提供している公式サイトの具体例：検索上限により未発見。
- 訪日客の理美容利用率・単価データ（HPB アカデミー 2015年以降の更新版）：未確認。

---

## KQ5. ベンチマーク：大阪メンズバーバーのメニュー価格と施術時間

### Takeaway
大阪のメンズカットは3,850〜4,800円帯（シャンプー無し短時間メニューで3,850円、眉カット付きで4,500〜5,800円、フェード＋シェービングで5,000円）、カット込みパーマ（ツイスト/波巻き/スパイラル）は新規クーポンで7,980〜12,800円。美容センサス2024年上期の男性1回あたり利用金額は4,708円。施術時間の公開情報は乏しく、カット40〜60分、カラー60分、カット＋パーマ90〜120分という店舗メニュー表記が確認できた程度で、ブリーチ・ダブルカラーの分数は未取得。

### Cited Findings

**カット料金（大阪）**
- HPB 掲載店：初回向けメンズカット4,400円、シャンプー無し30分メニュー3,850円、眉カット付き5,800円 — [beauty.hotpepper.jp slnH000550607](https://beauty.hotpepper.jp/slnH000550607/coupon/)
- リレーションメンズヘアー：メンズカット4,000円、眉カット付き4,500円、フェードカット＋シェービング5,000円、ヘッドスパ＋シェービング付き6,800円。期間限定でカット＋パーマ15,500円クーポンも。所在地が大阪かは要確認 — [beauty.hotpepper.jp slnH000319621](https://beauty.hotpepper.jp/slnH000319621/blog/PN298.html)
- ヒロ銀座バーバーショップ大阪本店（梅田）：カット単価4,796円〜。口コミに眉カラー・脱色（ブリーチ）の投稿あり — [beauty.rakuten.co.jp](https://beauty.rakuten.co.jp/s3000052214/kutikomi/)
- 池田市の店：シャンプー無しメンズカット1,790円（2024年口コミ、現行価格とは異なる可能性） — [map.yahoo.co.jp](https://map.yahoo.co.jp/v3/place/4LPTw-wWu0U)

**パーマ料金（大阪・カット込み・新規クーポン）**
- WW.. men's salon 大阪西梅田：メンズカット＋ツイストスパイラル8,480円、メンズカット＋波巻きパーマ9,480円（19時以降条件）、ツイストパーマ カット込み7,980円（新規限定） — [beauty.hotpepper.jp slnH000502567](https://beauty.hotpepper.jp/slnH000502567/style/)
- BLEUNIR 心斎橋：メンズカット＋ツイストスパイラルパーマ11,000円（新規限定） — [beauty.hotpepper.jp slnH000745425](https://beauty.hotpepper.jp/slnH000745425/style/L256106907.html)
- men's salon Gaudi 梅田茶屋町店：ツイスト or 波巻き or スパイラルパーマ＋メンズカット12,800円（男性限定、HPB 提示条件） — [beauty.hotpepper.jp slnH000499535](https://beauty.hotpepper.jp/slnH000499535/style/L213912818.html)

**市場・単価データ（美容センサス）**
- 2024年上期：美容室市場規模1兆3,543億円でほぼ横ばい、男性の1回あたり利用金額4,708円。男性は「カラー」「パーマ」「トリートメント」の利用率が前年から2ポイント以上増加 — [hba.beauty.hotpepper.jp census_hair_20240625](https://hba.beauty.hotpepper.jp/wp/wp-content/uploads/2024/06/census_hair_20240625.pdf)
- 2023年上期：男性のパーマ利用率は前年比+1.1ポイントの13.7% — [hba.beauty.hotpepper.jp A_census_hair_20230622](https://hba.beauty.hotpepper.jp/wp/wp-content/uploads/2023/06/A_census_hair_20230622.pdf)
- 2026年上期発表：美容室市場規模1兆3,063億円（前年比-5.9%）。利用率と年間利用回数の減少が要因で、物価高による節約意識が背景。理容室だけは前年を下回らなかった — [prtimes.jp](https://prtimes.jp/main/html/rd/p/000003210.000011414.html)
- 女性のネット予約率は2025年上期で59.2%、20代では75.8%と年々増加（美容センサス2025年上期の引用） — [crex-data.com](https://www.crex-data.com/industry/education/beauty-salon/customer-acquisition)
- 2018年上期：ネット予約者率が男女ともに大きく伸び約4割に — [hba.beauty.hotpepper.jp A_hair_census_201806](https://hba.beauty.hotpepper.jp/wp/wp-content/uploads/2018/06/A_hair_census_201806.pdf)
- 2014年上期：初回来店時に重視したポイントとして「ネット予約ができた」が1年前と比較して最も上昇 — [hba.beauty.hotpepper.jp A_hair_sensus2014](https://hba.beauty.hotpepper.jp/wp/wp-content/uploads/2014/05/A_hair_sensus2014_0513_2.pdf)
- 2024年調査から人口統計比率に合わせたウェイトバック集計に変更され、2021〜2023年データも再集計 — [hba.beauty.hotpepper.jp census_rela_data](https://hba.beauty.hotpepper.jp/wp/wp-content/uploads/2025/06/census_rela_data_20260626-2.pdf)

**施術時間**
- デザインカットコース施術時間目安60分（カット・シャンプー・頭&肩もみ・眉カット・顔そり・セット含む）、デザインカットショートコース40分（男性専用メニューではない） — [ekiten.jp](https://www.ekiten.jp/shop_2907762/menu/)
- カラーの施術時間60分と記載する店舗あり — [beauty.hotpepper.jp slnH000690949](https://beauty.hotpepper.jp/slnH000690949/style/L282804313.html)
- ブルーモスク TOKYO：初回男性「メンズヘアカット＋メンズヘアカラー＋メンズパーマ」120分、カット＋パーマの新規限定メニューは90分 — [beauty.rakuten.co.jp s5000016317](https://beauty.rakuten.co.jp/s5000016317/tk23/)
- ダブルカラーはブリーチで脱色後にカラーをする2段階施術。発色にはブリーチ1回が目安、シルバー系では2回が目安とされ、回数が増えるほど時間も長くなる — [smartlog.jp](https://smartlog.jp/333227); [biteki.com](https://www.biteki.com/490971/)

### Inferences
- クライアントの価格表サニティチェック基準（大阪・若年男性向け一人バーバー）：カット4,000〜5,000円、カット＋パーマ8,000〜12,000円が市場レンジ。フリーランス（面貸し）で固定費が小さい点、ポータル手数料を払わない点を踏まえ、カット4,500円前後・カット＋パーマ9,000〜11,000円に置くと「大阪のメンズサロン新規クーポン価格と同等か若干上」で妥当。これより大幅に安いなら「DM 運用による取りこぼし」が収益を圧迫している可能性を指摘できる。
- 予約システムの所要時間マスタ（デフォルト値案・業界一般の目安であり本調査で一次確認できたのは一部）：カット 45〜60分、カット＋カラー 90〜120分、カット＋パーマ 90〜120分、カット＋ブリーチ（1回）＋カラー 150〜180分、ブリーチ2回 180〜240分、リタッチ 60〜90分、アイロンパーマ/濡れパン 90〜120分、ブレイズ（編み込み）は本数で大きく変動（2〜5時間）。管理画面でメニューごとに「所要時間」「バッファ（前後の準備時間）」を編集可能にする要件が必須。
- 市場全体が縮小（-5.9%）しつつ理容室は持ちこたえており、男性のカラー・パーマ利用は伸びているため、「メンズ×デザインパーマ・ブリーチ」を中心とする一人バーバーの高単価化戦略は市場トレンドに合致。

### Gaps
- 大阪のメンズブリーチ・ダブルカラー単体価格：検索上限により未取得（HPB で「梅田/心斎橋 メンズ ブリーチ」を追加調査推奨）。
- メンズのブリーチ・濡れパン・アイロンパーマ・ブレイズの標準所要時間：公開情報が乏しく未取得。クライアントの実績値をヒアリングして設定するのが確実。
- 美容センサス2025・2026年上期の「男性」ネット予約率と理容室利用金額：PDF を直接取得できず未確認。

---

## KQ6. 参考にすべき予約サイト・UI パターン（RESERVA／Hot Pepper Beauty／海外バーバー）

### Takeaway
海外の優良バーバーサイトに共通する設計は「全ページに予約ボタンを常設」「外部サービスへリダイレクトせずサイト内（モーダル/埋め込み）で予約完結」「時間枠を選ぶ前に価格と所要時間を表示」「モバイルファースト」「若年層向けはダーク基調」の5点。国内では Heritage Barbershop 型の「価格・所要時間を先に見せる透明な予約フロー」が、HPB のクーポン依存型フローへの差別化になる。

### Cited Findings
- Birds Barbershop（オースティン）：Book Now ボタンがポップアップを開き、訪問者はページを離れない。2006年の開業以来毎年 Austin Chronicle のベストバーバーに選出 — [thesalonbusiness.com](https://thesalonbusiness.com/barbershop-website-designs/)
- Heritage Barbershop（ポートランド）：「時間枠を選ぶ前に価格と所要時間が表示される」最も透明な予約フローと評価。9名のバーバーを名前で掲載し、個別スケジュールと支払い方法の希望を明示 — [nanoglobals.com](https://nanoglobals.com/barbershop-websites/)
- Huckle The Barber（ロンドン）：Shopify 製サイト＋Phorest の予約ソフト — [nanoglobals.com](https://nanoglobals.com/barbershop-websites/)
- Ilya Barbershop（NY）：シンプルな配色とクリーンなデザインでプレミアムバーバーの世界観を伝える — [ueni.com](https://ueni.com/blog/barber-websites/)
- Pall Mall Barbers：各店舗の没入感ある画像付き Locations セクションで最寄店舗を探しやすい — [sliderrevolution.com](https://www.sliderrevolution.com/design/barbershop-websites/)
- 100店舗超のレビュー結論：予約導線は全ページの最上部に置きサイト内で完結させるべき。レビュー対象の約80%が Squarespace を利用 — [nanoglobals.com](https://nanoglobals.com/barbershop-websites/)
- 外部プラットフォームへのリダイレクトではなく、サイトにきれいに埋め込める予約システムを選ぶよう助言 — [cyberoptik.net](https://cyberoptik.net/blog/best-barber-shop-websites)
- バーバーサイトのトラフィックの70%超がモバイルという主張（出典不記載） — [mycodelesswebsite.com](https://mycodelesswebsite.com/barber-website/)
- ダーク背景は若年層向けのモダン・アップスケールなバーバーに、ライト背景はクリーンで伝統的な印象に向く — [booknetic.com](https://www.booknetic.com/blog/barbershop-website-templates)
- 予約ツールの人気はレビューにより異なる：Square Appointments・Booksy・Schedulicity が主流とする記事と、Boulevard が最多で Squire・Square Appointments が続くとする記事がある — [blog.hubspot.com](https://blog.hubspot.com/website/barbershop-websites); [nanoglobals.com](https://nanoglobals.com/barbershop-websites/)
- RESERVA は予約ページ専用 URL を自動生成する機能を持つ SaaS 型予約システム — [it-trend.jp](https://it-trend.jp/reservation/23674)
- Zarla のバーバー向けロゴ/デザインインスピレーション集 — [zarla.com](https://www.zarla.com/inspiration/barber)
- 英国美容業界：キャンセル通知期限は24〜48時間前が典型。ポリシーはオンラインと店舗の両方で明確に見られる状態に — [scratchmagazine.co.uk](https://www.scratchmagazine.co.uk/feature/prevent-handle-no-shows-cancellations-beauty-business-advice); [zenoti.com](https://www.zenoti.com/thecheckin/salon-cancellation-policies)

**無断キャンセル対策（要件の参考）**
- 対策としてキャンセル料回収ができる予約システムの採用・事前決済の導入が挙げられる — [squareup.com how-to-deal-with-no-shows](https://squareup.com/jp/ja/townsquare/how-to-deal-with-no-shows)
- キャンセルポリシーは期限と料金を数字で明記し「なるべく早く」のような曖昧表現は避ける。事前決済がない場合は請求方法（メール/住所宛に請求書送付）を明記 — [squareup.com how-to-write-a-cancellation-policy](https://squareup.com/jp/ja/townsquare/how-to-write-a-cancellation-policy)
- 美容サロンの例：前日までの連絡は無料・当日キャンセルは施術料金の50%。別例：施術3日前0時から50%、前日0時から100% — [freee.co.jp cancellation-policy](https://www.freee.co.jp/kb/kb-reservation-management/cancellation-policy/); [jicoo.com 事例](https://www.jicoo.com/t/Moodtune/e/ueno120or150/cancel_policy)
- キャンセル料は消費者契約法に基づき基本ルールを設定する必要がある — [financial-field.com](https://financial-field.com/living/entry-349935)
- LINEビューティープラスは予約時点と24時間前の自動リマインドを標準搭載（競合の標準機能水準） — [LINE Beauty Plus 資料](https://go.lycbiz.com/rs/265-EZN-548/images/line-beauty-plus.pdf)

### Inferences
- 推奨する予約フロー（モバイル）：①メニュー選択（価格・所要時間・写真を同時表示、複数選択で合計時間自動計算）→ ②日付（月カレンダー、空き有無を○△×で表示）→ ③時間スロット（所要時間＋バッファを考慮した開始時刻のみ列挙）→ ④顧客情報（氏名・電話・Instagram ID・言語、参考写真任意、初回/再来）→ ⑤確認＋キャンセルポリシー同意 → ⑥完了画面（Google カレンダー追加、LINE/メールで確認通知）。Heritage 型の「価格と時間を先に見せる」原則を踏襲し、HPB の「クーポン探し」ストレスを排除する。
- 管理 PWA の最小要件：新規予約/変更/キャンセルの Web Push、日別タイムライン、空き枠ブロック（面貸しの枠・休憩）、メニューごとの所要時間・バッファ編集、リマインド自動送信（24時間前）、無断キャンセル履歴フラグ（2回以上で事前決済必須にするなどの段階運用）。
- 無断キャンセル対策は初期フェーズでは「ポリシー明記＋リマインド＋キャンセル履歴フラグ」で十分で、事前決済（Stripe）は Phase 2 以降。消費者契約法上、平均的損害を超えるキャンセル料は無効となり得るため、料率設定はクライアントと相談。
- 「なぜ SaaS でなく自作か」の論点整理：(1) SaaS 無料枠は月50件で確実に超過し有料化（RESERVA 3,850円〜/STORES 9,790円〜）、(2) 英語 UI・参考写真添付・Instagram 導線・Web Push など一人バーバー固有の要件は SaaS で満たしにくい、(3) HPB は掲載料非公開＋2%で価格競争に巻き込まれクーポン依存になる、(4) 顧客データ・カルテ・写真を自社管理でき将来のチャット/カルテ拡張が自由、(5) 一方で SaaS の強み（決済・リマインド・カルテの即時利用、運用保守不要）は自作ではコストとして発生するため、保守費の提示が必要。

### Gaps
- glock hair service の RESERVA 予約ページ：検索で該当サロンを特定できず、ステップ構成は未確認。クライアントから URL を受領して実機確認するのが確実。
- Hot Pepper Beauty のネット予約画面の現行ステップ構成（2026年）：フェッチ遮断により未確認。
- 国内の独立系バーバーで「自作予約サイト」を持つ優良事例：検索では未発見。日本語の Web デザインギャラリー（例：SANKOU!、MUUUUU.ORG）で「barber」「理容室」を検索する追加調査を推奨。
