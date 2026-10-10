# 09 ギャップ検証: 競合予約UI（Hot Pepper Beauty / RESERVA）・料金・デザイン一次資料

調査日: 2026-10-10（JST 19:10〜19:45 に取得。以下「取得日」はすべて 2026-10-10）
方法: curl（Chrome UA）＋ Playwright（iPhone UA 390×844 @2x、または Chrome UA 390px/1280px）。到達不能だったホストは各項目に明記。スクリーンショットは `docs/research/reference/` に保存（README 末尾「追加取得（ギャップ検証）」参照）。
対象ノート: 01_visual_design.md / 02_booking_ux.md / 03_market_competitors.md の Gaps、および reports/美容師予約サイト制作ナレッジ.md「調査ギャップ」表の「Hot Pepper Beauty / 競合」「デザイン」行。

---

## 0. サマリー表

判定の凡例: **確認** = 以前の記載が一次資料で裏付けられた / **訂正** = 一次資料と食い違い、本ノートの値に置き換える / **補強** = 以前「未確認・推定」だったものを一次資料で確定 / **未確認** = 今回も一次資料に到達できず

| # | 項目 | 以前の記載 | 一次資料での確認結果 | 判定 | 出典URL・取得日 |
|---|---|---|---|---|---|
| A-1 | HPB 予約ステップ構成 | 「クーポン/メニュー → スタイリスト指名 → 日時 → ログイン/会員情報 → 確認」(推測) | 画面上のステップ表示は3段「クーポン・メニューを選ぶ → 日時を指定する → 予約手続きへ」。スタイリスト指名は「日時を指定する」画面の上部（チップ UI）で日時グリッドと同一画面。日時の◎をタップすると Recruit ID ログイン（point.recruit.co.jp）に遷移し、未ログインでは先に進めない | 補強（指名の位置を訂正） | https://beauty.hotpepper.jp/CSP/bt/reserve/?storeId=H000670004 ／ https://beauty.hotpepper.jp/doc/guide/reserve.html 取得日 2026-10-10 |
| A-2 | HPB 記号の公式定義 | ◎=予約可（サロンブログからの間接確認）、○/△の有無は不明 | 公式ご利用ガイド「予約状況マークの見方」: **◎ 即時予約可（予約手続完了時点で確定）／○ 仮予約可（サロンの返事で確定）／× 予約できません**。△は存在しない。予約画面の凡例は「◎：予約できます。／TEL：直前のため、お電話でお問い合わせください。／◎TEL（灰色）：ご指定のクーポンでは予約できません。」。加えて「－」（営業時間外枠）と列全体の縦書き「休」（定休日）を観測 | 補強 | https://beauty.hotpepper.jp/doc/guide/reserve.html ／ 予約画面 salonSchedule 取得日 2026-10-10 |
| A-3 | HPB 当日・直前の扱い | 「30分後から選択可」（and-us 記事、二次） | 画面・ガイドに「何分前まで」の明記なし。19:19 JST の観測で当日列は過去枠が×、**19:00 枠が「TEL」、19:30 枠が「×」**（2店舗で同様）。直前枠は×ではなく TEL（電話誘導）に置換される。「ポイント対象外」注記つきで「電話番号を表示」リンクを凡例直下に配置 | 補強（締切の分数は未確認のまま） | 予約画面 storeId=H000749506 / H000189906 取得日 2026-10-10 19:19 JST |
| A-4 | HPB 料金・所要時間の表示 | 未確認 | クーポン一覧は価格のみ（「¥23,800→¥16,500」のように定価併記はタイトル内）、**所要時間は一覧に出ない**。選択後に「施術時間合計（目安）：2時間」「指名料 ―／¥550」をまとめパネルに表示。ガイドに「施術時間はあくまで目安」 | 補強 | 同上 |
| A-5 | HPB 掲載料 | 非公開・問い合わせ制（freee 記事） | 公式掲載案内 FAQ「掲載費はいくらですか？ ご希望のエリアやプランによって異なります。詳しくはお問い合わせください。」「個人でも契約ができますか？ はい。可能です。」 | 確認 | https://beauty.hotpepper.jp/doc/keisai/keisai.html 取得日 2026-10-10 |
| A-6 | サロンボードのリマインド/通知仕様 | 未取得 | salonboard.com はプロキシで到達不能（502 upstream request failed / DNS 不可）。HPB 掲載案内ページにはサロンボードの機能として「24時間ネット予約」「予約一元管理」「レジ・会計」「顧客管理」「PC・iPad・スマホ対応」のみ記載。利用者向けヘルプに「予約確認メールが届きません」というFAQが存在（確認メールはある）。リマインド配信の有無は公式ページでは確認できず | 未確認 | https://beauty.hotpepper.jp/doc/keisai/keisai.html ／ https://recruit-help.jp/hpb/s/article/000003386 取得日 2026-10-10 |
| B-1 | RESERVA（glockhairservice）のステップ | 「担当者 → サブカテゴリ → セグメント → メニュー → 日時（別ページ）」（スクリプトからの推定） | Chrome UA の Playwright で初期画面は取得可（担当者セレクトに「小川 悠登 / Yuto Ogawa … 指名なし / Any Stylist」の日英併記）。担当者を選ぶと Ajax `/glockhairservice/resource/sub_category/get` が **Cloudflare チャレンジで 403** になり、以降は取得不能。公式サンプル `hairsalonsample` でもメニューの「予約する」→ `/reserve?mode=service_staff` が 403 | 未確認（ブロック） | https://reserva.be/glockhairservice ／ https://reserva.be/hairsalonsample 取得日 2026-10-10 |
| B-2 | RESERVA のメニュー表示・カレンダー UI | 「メニュー → 月カレンダー → 時間スロット」(推測) | 公式サンプル `hairsalonsample` のトップ: 曜日別営業時間 → カテゴリタブ（カット/ネイル/アイラッシュ）→ メニューカード「カット＆カラー ￥11,800～ 120分［予約する］」「カットのみ ￥5,500～ 60分」と**価格と所要時間を並記**。イベント型サンプルの予約ページには「予約締切：6時間前まで」と締切を明記。カレンダー記号は取得できず | 一部補強（記号は未確認） | https://reserva.be/hairsalonsample ／ https://reserva.be/plantationsample/reserve?mode=service_staff… 取得日 2026-10-10 |
| C-1 | RESERVA 料金 | Free 50件/月・顧客250、ブルー 3,850円（年払）等（atsoho/imitsu） | 公式料金ページで一致: フリー 0円・月50件・顧客250件・機能43、ブルー 年払3,850円/月（月払5,500円）・200件・1,000件・機能44、シルバー 6,600円（8,800円）・500件、ゴールド 13,200円（17,600円）・1,000件、エンタープライズ 23,100円（30,800円）・2,000件・電話サポート、スイート 46,200円（61,600円）・4,000件。LINE連携 3,300円/月、カード決済手数料4.9%、クーポン発行330円/枚 | 確認 | https://biz.reserva.be/price/ 取得日 2026-10-10 |
| C-2 | STORES予約 料金 | フリー 50件、スモール 9,790円（年契約・通常12,980円）、チーム 19,690円（通常77,000円と記載）・5,000件 | 公式: フリー 0円・月50件・公開2、スモール 年契約9,790円/月（複数月契約12,980円）・200件・公開10、チーム 年契約19,690円（複数月22,880円）・**300件**・公開10・スタッフ3、ビジネス 年契約28,600円（複数月31,790円）・2,000件・公開50・スタッフ20、エンタープライズ 年契約66,000円（複数月77,000円）・5,000件。超過は50件ごと1,078円、事前カード決済手数料はフリー5.2%〜／有料3.3%〜 | 訂正（チームは300件・複数月22,880円。77,000円/5,000件はエンタープライズ） | https://stores.fun/reserve/pricing 取得日 2026-10-10 |
| C-3 | minimo 手数料 | 「手数料0〜660円、発生条件は未確認」 | 公式: 初期費用0円・月額0円、**来店時のみ**手数料。施術料金0円→110円、1〜2,200円→440円、2,201〜6,600円→660円、**6,601円以上→880円**（税込）。サロン都合キャンセルは手数料が発生 | 訂正（上限は880円） | https://minimodel.jp/info 取得日 2026-10-10 |
| C-4 | かんざし 料金 | 未取得 | kanzashi.cynd.co.jp / kanzashi.jp はプロキシで到達不能（502）。CYND のプロダクトページは BeautyMerit のみ掲載 | 未確認 | https://www.cynd.co.jp/product/ 取得日 2026-10-10 |
| C-5 | リザービア 料金 | 未取得 | rsvia.co.jp に料金ページなし（/price/ /plan/ とも404）。トップにも金額の記載なく「資料請求」導線のみ（導入7,500店以上） | 未確認（非公開・資料請求制と判断） | https://rsvia.co.jp/ 取得日 2026-10-10 |
| D-1 | M3 カラーコントラスト | 到達不能 | 公式: 「Large text (at 14 pt bold/18 pt regular and up) and graphics — At least 3:1」「Small text — At least 4.5:1」「Disabled states do not need to meet contrast requirements」「button containers … 3:1 between their container color and the color of their background」 | 補強 | https://m3.material.io/foundations/designing/color-contrast 取得日 2026-10-10 |
| D-2 | ダークテーマ #121212 / 15.8:1 / 脱彩度 | 記憶ベースのため不採用 | **M2** 公式ページ（「Material 2 is no longer maintained」バナー付）に「The recommended dark theme surface color is #121212」「Dark surfaces and 100% white body text have a contrast level of at least 15.8:1」「Primary colors are desaturated so they pass … at least 4.5:1」。M3 には専用のダークテーマページはなく、Color roles ページで「surface container roles, shown in light and dark theme」として扱う | 補強（出典は M2、M3 は未記載と明記） | https://m2.material.io/design/color/dark-theme.html ／ https://m3.material.io/styles/color/roles 取得日 2026-10-10 |
| D-3 | M3 モーション easing/duration | MDC-Android リポジトリ値 | 公式トークンページと一致（standard `cubic-bezier(0.2,0,0,1)`、emphasized-decelerate `(0.05,0.7,0.1,1)`、emphasized-accelerate `(0.3,0,0.8,0.15)`、short1–4 50/100/150/200ms … extra-long4 1000ms）。「Applying」ページの推奨ペア: Emphasized 500ms（画面内）/ Emphasized decelerate 400ms（入場）/ Emphasized accelerate 200ms（退場）/ Standard 300ms / Standard decelerate 250ms / Standard accelerate 200ms。注記「In the expressive update … uses springs … easing and duration system … is no longer maintained」 | 確認（＋Expressive 注記を追加） | https://m3.material.io/styles/motion/easing-and-duration/tokens-specs ／ …/applying-easing-and-duration 取得日 2026-10-10 |
| D-4 | NN/g 進捗インジケータの定量 | 見つからず | 「looped indicator for delays of 2–9 seconds and a percent-done indicator for delays of 10 seconds or more」、UNL の実験で進捗バーを見た群は「willing to wait on average 3 times longer」 | 補強 | https://www.nngroup.com/articles/progress-indicators/ 取得日 2026-10-10 |
| D-5 | NN/g フォーム設計の定量 | ガイドラインのみ | Seckler らの CHI 論文引用「78% one-try submissions in forms compliant with usability guidelines versus only 42%」。単一カラム、ラベルはフィールド直上（モバイル）、任意項目は1〜2個まで。日付入力: カレンダーピッカーは「within less than a year」の日付向き、選択肢が「more than 10 dates」ならリストは不向き、常に手入力も許可。エラーは「Aim for Inline Validation Whenever Possible」。※ `/articles/date-picker/` は404（存在しない）で正しくは `/articles/date-input/` | 補強 | https://www.nngroup.com/articles/web-form-design/ ／ …/date-input/ ／ …/errors-forms-design-guidelines/ 取得日 2026-10-10 |
| D-6 | Hoober サムゾーン | 未取得（URL 未検証） | 原典は UXmatters 2013-02（Smashing ではない）。「1,333 observations … 780 were touching the screen」「one handed—49% / cradled—36% / two handed—15%」。Smashing「The Thumb Zone: Designing For Mobile Users」（2016-09, S. Ingram）は Hoober 49% と Clark「75% of interactions are thumb-driven」を引用した二次記事 | 補強 | https://www.uxmatters.com/mt/archives/2013/02/how-do-users-really-hold-mobile-devices.php ／ https://www.smashingmagazine.com/2016/09/the-thumb-zone-designing-for-mobile-users/ 取得日 2026-10-10 |
| D-7 | Practical Typography | 記憶ベースのため不採用 | 原典: 「line length 45–90 characters or 2–3 alphabets」「line spacing 120–145% of the point size」「On the web, the optimal size is 15–25 pixels」 | 確認（採用可） | https://practicaltypography.com/line-length.html ／ line-spacing.html ／ point-size.html 取得日 2026-10-10 |
| D-8 | デジタル庁 行間・字間 | 未取得 | 公式タイポグラフィ（2026-08-05 更新）: フォントは Noto Sans JP、本文行高は「少なくとも1.5倍」、行高トークン 100/120/130/140/150/160/170/175%（160%「一般的な本文」、170/175%「心理的負荷の軽減」）。本文 Standard の letter-spacing は「0、1%（0.01em）、2%（0.02em）」、フォントサイズは「基本的に16 CSS px以上」 | 補強（以前の推定 0.04em より小さい） | https://design.digital.go.jp/dads/foundations/typography/ 取得日 2026-10-10 |
| D-9 | Google Fonts Noto Sans JP の分割数と palt | 未確認 | css2（wght@100..900, v57）は **@font-face 124 個 = 日本語系 120 スライス（無名）＋ cyrillic / vietnamese / latin-ext / latin**。ひらがな・カタカナを含むスライス（#119）の GPOS に `halt, kern, palt, vert, vhal, vkrn, vpal`、漢字スライス（#114 例）に `kern, palt, vpal` を確認 → **Google 配信の可変フォントでも `font-feature-settings: "palt"` は有効**（latin スライスには palt なし＝欧文には影響しない） | 補強 | https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@100..900&display=swap 取得日 2026-10-10（fontTools 4.66 で検査） |
| E-1 | Instagram @neuer.kento | 未取得 | Chrome UA の Playwright で **HTTP 429** → `/accounts/login/?next=/neuer.kento/` へリダイレクト（ログイン壁）。規定どおり1回で中止 | 未確認（アクセス不可） | https://www.instagram.com/neuer.kento/ 取得日 2026-10-10 |

---

## A. Hot Pepper Beauty（HPB）実機確認

### A-0 対象と取得条件
- 対象サロン（大阪・天王寺／阿倍野のメンズ／バーバー、HPB「大阪市阿倍野区で人気の理容室・理髪店」一覧（/genre/gkw069/pre27/city11900000/）から選択）
  - `slnH000670004` barber shop 刈部倶楽舞 天王寺店（即時予約）— 主要な歩行対象
  - `H000749506` CUFFIA MEN'S FADE CAMPO 天王寺（平日 11:00〜21:00・土日祝 10:00〜20:00）— 当日「TEL」枠の観測
  - `H000189906` BARBER SHOP Sun FLat（平日 10:00〜19:30）— 「平日限定」クーポンでの灰色◎と「休」列の観測
- Playwright: iPhone UA、390×844、DPR 2、timezone Asia/Tokyo。取得時刻 2026-10-10（土）19:14〜19:20 JST。
- スクリーンショット: `hpb_salon_top_mobile.jpg`, `hpb_step1_coupon_mobile.jpg`, `hpb_step2_top_mobile.jpg`, `hpb_step2_calendar_mobile.jpg`, `hpb_step2_legend_mobile.jpg`, `hpb_step2_full_tel_cuffia.jpg`, `hpb_step2_full_tel_sunflat.jpg`, `hpb_step3_login_mobile.jpg`

### A-1 ステップ構成（画面の実表示）
画面上部のステップ表示（`ol.reserveStepList`、原文どおり）:
1. 「クーポン・メニューを選ぶ」（アイコン: クーポン）
2. 「日時を指定する」（アイコン: カレンダー＋時計）
3. 「予約手続きへ」（アイコンなし）

実際の遷移:
- サロンページ → ボタン「空席確認・予約する」（`hpb_salon_top_mobile.jpg`）
- Step1 `/CSP/bt/reserve/?storeId=…`: 見出し「クーポン・メニューを選択してください」、セグメントタブ「すべて／初来店時クーポン／2回目以降クーポン／メニュー」、「メニューで絞り込む」、件数「クーポン 61件 メニュー 27件」、並び替え「おすすめ順／安い順／高い順」、注記「※ロング料金なし ※価格は税込表示です。」。各カードは左に「新規／全員」の縦帯、カテゴリタグ（カット・パーマ…）、タイトル（定価→割引は「¥23,800→¥16,500」のようにタイトル文字列内）、価格（赤字）、写真、「このクーポンの詳細」、「その他条件：初回・新規限定…」、ボタン「メニューを追加」（アウトライン）と「このクーポンで予約」（塗り）。**一覧には所要時間の表示なし**（`hpb_step1_coupon_mobile.jpg`）。
- Step2 `/CSP/bt/reserve/afterCoupon?storeId=…&couponId=…`: 上部に折りたたみ「選択済クーポン・メニュー」（クーポン名・価格・「指名料 ―」・「施術時間合計（目安）：2時間」）→ 見出し「スタイリストを指名」（横スクロールのチップ、既定「✓指名なし」、選ぶと「指名料：¥550」と紹介文が展開）→ 見出し「日時を選択」→ 週グリッド（`hpb_step2_top_mobile.jpg`, `hpb_step2_calendar_mobile.jpg`）。
- Step3: ◎（`afterSchedule?storeId=…&rsvRequestDate1=20261011&rsvRequestTime1=1200`）をタップすると `point.recruit.co.jp/member/OIDCLogin/…` の Recruit ID ログインへ遷移（`hpb_step3_login_mobile.jpg`）。未ログインでは要望入力・確認画面に進めない。
- 公式ガイド（reserve.html）の流れ: 「空席確認・予約する」→「このクーポンで予約」/「メニューを追加して予約」→「選択されたメニューに対しての空き時間が出てきます」→ 要望入力（「希望のヘアスタイル写真（なりたいイメージ）を添付することができます」）→「予約内容確認」→「予約を確定する」。

### A-2 日時グリッドの仕様
- 構造: 横＝日付7列（ヘッダ「日時｜2026年10月｜10(土) 11(日) 12(祝) 13(火) …」。土曜ヘッダは水色、日・祝はピンク背景）、縦＝時刻30分刻み（例 10:00〜19:30、サロンごとに営業時間分）。ヘッダ直下にアンカー「▼午後(12:00-18:00)」「▼夜(18:00-)」。グリッド上下に「＜ 前の一週間」「次の一週間 ＞」ボタン（当週では「前の一週間」が無効色）。
- セル実装（HTML 原文）:
  - 予約可: `<td class="wCircle"><a href="…afterSchedule?…&rsvRequestTime1=1200">◎</a></td>` — 文字そのものが「◎」（画像ではない）、リンク色 `rgb(204,68,102)` ≒ #CC4466、16px、セル約46×36px
  - 不可: `<td class="close fs20 fgLGray"><span>×</span></td>` — 文字色 #999、背景 #EEE、20px
  - 直前: `td.fgOcher.telCell` に「TEL」（黄土色）
  - クーポン不適用: `td.wCircle.isDisabled`（灰色の◎）
  - 営業時間外: 「－」、定休日: 列全体が縦書き「休」
- 凡例（グリッド直下、原文どおり）:
  - 「◎：予約できます。」
  - 「TEL：直前のため、お電話でお問い合わせください。」
  - 「◎ TEL：ご指定のクーポンでは予約できません。」（灰色表示）
  - 続けてグレー帯に「電話番号を表示」リンクと赤字「※電話でのご予約はポイント対象外となります。ご注意ください。」、その下に「戻る」ボタン（`hpb_step2_legend_mobile.jpg`）
- 公式ガイド「予約状況マークの見方」（reserve.html）:
  - 「◎ 即時予約可。予約手続完了時点で予約が確定します。」
  - 「○ 仮予約可。予約手続後、サロンからお返事がマイページに表示され、登録メールアドレスに届きます。その内容をもって、予約が確定します。」（仮予約サロンでは「第2希望日時もご入力いただけます」）
  - 「× 予約できません。」
  - △ の定義は存在しない。今回予約画面まで開けた天王寺・阿倍野の理容室15店はすべて「即時」バッジ（サロン名左の赤いラベル「即時」）で、○ は観測されなかった。
- 当日・直前: 19:19 JST 時点の当日列で、CUFFIA（最終枠 20:30）は 10:00〜18:30 が×、**19:00 が TEL、19:30 が ×**、20:00〜 は「－」（土曜は 20:00 閉店）。Sun FLat でも 19:00 が TEL（平日限定クーポンのため灰色）。何分前が締切かの文言は画面・ガイド・ヘルプのいずれにも見当たらない。
- 所要時間は選択後の「施術時間合計（目安）」のみ。ヘルプに FAQ「ネット予約時に指定したメニューの施術（所要）時間は必ず表示通りなのでしょうか？」（article 000003388）があるが、本文は SPA で描画されず取得できなかった。

### A-3 モバイルレイアウトの所見
- 1カラム・全幅、余白16px、本文 12px（body、Helvetica）。アクセントはピンク系（◎ #CC4466、CTA 塗りボタン、見出し左の縦バー）。
- 予約フローのページはサロンページとは別テンプレート（ヘッダは HPB ロゴ＋パンくず「検索結果一覧 › サロン名 › サロン予約」、サロン名の左に「即時」ラベル）。下部固定 CTA は無く、グリッド内の◎そのものがタップ対象。
- 週グリッドは 7列×20行以上で縦に長く、全画面スクリーンショットは 390px 幅で約 1,900〜2,000px（`hpb_step2_full_tel_cuffia.jpg`）。

### A-4 掲載料・サロンボード（公式ページ）
- 掲載案内 https://beauty.hotpepper.jp/doc/keisai/keisai.html（取得日 2026-10-10）FAQ 原文:
  - 「掲載費はいくらですか？ ご希望のエリアやプランによって異なります。詳しくはお問い合わせください。」
  - 「個人でも契約ができますか？ はい。可能です。」
  - 「いつから掲載できますか？ 申込みをいただくタイミングによって異なります。」
  - 掲載規模: 「ヘアサロン 67,000店以上」「3席以下の店舗割合 ヘアサロン 約35%」（リクルート調べ 2026年4〜6月時点）、「年間ネット予約数 ヘアサロン 1.2億件以上」
- サロンボード（同ページ）: 「ネット予約の自動スケジューリング機能や、予約内容をレジに接続できる『サロンボード（SALON BOARD）』」「24時間ネット予約」「予約も一元管理」「レジ・会計」「顧客管理」「PC・iPad・スマホ対応」「年中無休のヘルプデスク」。リマインド／無断キャンセル対策機能への言及なし。
- salonboard.com は本環境から到達不能（curl: Empty reply / Playwright: 502 upstream request failed）。
- 利用者向けヘルプ（recruit-help.jp/hpb、Salesforce 製 SPA）: 記事一覧に「予約確認メールが届きません」(000003386)、「『無断キャンセルがある』と表示が出て、ネット予約ができない」(000003357)、「『無断キャンセル』により利用制限がかかった場合、解除はできますか」(000003292) が存在 → 予約確認メールは送られ、無断キャンセルは会員側の利用制限につながる。本文はヘッドレスで描画されず未取得。
- キャンセル（ご利用ガイド原文）: 「予約のキャンセルはマイページから行うことができます」「予約内容の変更をされたい場合は、サイト上でいったんキャンセルし、再度予約の取り直しください」「来店日当日、サロンが定めたキャンセル可能日を過ぎている場合は、マイページからキャンセルすることができません。その場合は、サロンまで直接ご連絡をお願いします」「キャンセル料は、予約時の合計金額（ポイント利用は適用されない）からサロンが設定したキャンセル規定に則り…徴収」。

---

## B. RESERVA 実機確認

### B-1 glockhairservice（クライアントが使っていた予約ページ）
- URL: https://reserva.be/glockhairservice（title「GLOCK HAIR SERVICE Reservation」、所在地「埼玉県川越市中原町2-4-3 1F」）。取得日 2026-10-10。
- 取得条件: Playwright Chromium、desktop Chrome 129 UA（390px 幅、`--disable-blink-features=AutomationControlled`、12秒待機）。HTML 自体は 200 で取得でき、Cloudflare の `cdn-cgi/challenge-platform` スクリプトも読み込まれた（`reserva_glock_mobile_desktopua_step0.jpg`）。
- 初期画面: ヘッダ（店名）／タブ「予約」「ログイン」／「About Us」／店舗写真／「担当者を選択してください」のセレクト1つ。選択肢（原文）: 「小川 悠登 / Yuto Ogawa」「氏家 理一郎 / Riichiro Ujiie」「平林 啓 / Kei Hirabayashi」「栗原 啓太 / Keita Kurihara」「指名なし / Any Stylist」— **担当者名を日英併記**している。
- 担当者を選択（jQuery `.select_menuCat` に change を発火）すると `GET /glockhairservice/resource/sub_category/get` が **403（Cloudflare「Just a moment…」）** で、サブカテゴリ以降は描画されない。再試行しても同じ。→ 担当者選択より先は取得不能（前回ノートと同じ結論、今回は desktop UA でも再現）。
- ページ内 JS `ReserveUrl` から判明したエンドポイント（構造の裏付け）: `/glockhairservice/menu/get`, `/glockhairservice/coupon/list`, `/glockhairservice/reserve`, `/glockhairservice/reserve/complete`, `/glockhairservice/cancel`, `/glockhairservice/changelanguage`, `/glockhairservice/creditcard/auth`, `/glockhairservice/login`。→ メニュー確定後は `/reserve`（別ページ）で日時・顧客情報、完了は `/reserve/complete`、言語切替・オンライン決済・会員ログインが存在する。

### B-2 公式サンプル・機能ページで補完したステップ
- `https://reserva.be/hairsalonsample`（ヘアサロン予約ページ（サンプル））: 「営業時間 月 11:00〜20:00 / 火 定休日 / … 土日祝 10:00〜18:00」→ カテゴリタブ「カット／ネイル／アイラッシュ」→ メニューカード「カット＆カラー ￥11,800～ 120分 ［予約する］」「カットのみ ￥5,500～ 60分 ［予約する］」。**メニュー一覧の段階で価格と所要時間を並記**。「予約する」→ `/hairsalonsample/reserve?mode=service_staff&search_evt_no=…` は 307 → 403（Cloudflare）で取得不能。
- `https://reserva.be/plantationsample`（イベント型サンプル、`reserva_sample_plantation_mobile.jpg`）: メニューカードに「〈季節〉いちご狩り 120分 ￥0～￥3,000（税抜） 先着順制 ［予約する］」。予約ページ（`reserva_sample_plantation_step1_mobile.jpg`）は「予約に関する注意事項 予約締切：6時間前まで」「予約人数 大人 ￥3,000 / 子供 ￥2,000 / 幼児 ￥0」「※予約可能数は、1～10です」、CTA「次へ」（人数未選択時はグレーの無効）。→ RESERVA は締切を「○時間前まで」と文で明示する。
- 機能一覧 https://lp.reserva.be/function/（取得日 2026-10-10）で確認できる関連機能（原文抜粋）:
  - 「空き状況表示 — 1つひとつのメニューを開いてチェックする必要が無くなり、空き状況を一括で把握することができます。」
  - 「予約受付開始・締切 — 予約を受け付けられる期間を…細かく設定できます。」
  - 「予約リマインドメール — 忘れていた予約を思い出されるため、直前キャンセル・無断キャンセルの防止…」
  - 「多言語表示 — 日本語がわからない海外客向けの予約サイトを作成できる」
  - 「予約カレンダーの外部埋め込み」「担当者シフト登録」「指名料設定」「キャンセル待ち」「LINE連携（予約確定やキャンセル、リマインド…をLINEに送信）」
- help.reserva.be は到達不能（ERR_TUNNEL_CONNECTION_FAILED）。**カレンダーの記号（◎○×等）と日時 UI の実表示は依然として未確認**。

---

## C. 料金（公式ページ）

### C-1 RESERVA（https://biz.reserva.be/price/、取得日 2026-10-10、原文の数値）
| プラン | 年払 円/月 | 月払 円/月 | 月間予約件数 | 登録顧客件数 | 機能数 | サポート |
|---|---|---|---|---|---|---|
| フリー | 0 | 0 | 50件 | 250件 | 43 | メール |
| ブルー | 3,850 | 5,500 | 200件 | 1,000件 | 44 | メール |
| シルバー | 6,600 | 8,800 | 500件 | 2,500件 | 54 | メール |
| ゴールド | 13,200 | 17,600 | 1,000件 | 5,000件 | 82 | メール |
| エンタープライズ | 23,100 | 30,800 | 2,000件 | 10,000件 | 110 | 電話・メール |
| スイート | 46,200 | 61,600 | 4,000件 | — | — | — |
「初期費用・サポート費用はどのプランでも0円」。オプション: LINE連携 ￥3,300（税込）/月（フリープラン〜、「予約の確認・リマインドをLINEに自動送信」）、オンラインカード決済手数料 4.9%、クーポン発行 ￥330/1クーポン。→ 以前のノート（atsoho/imitsu 経由）の数値はすべて一致。

### C-2 STORES予約（https://stores.fun/reserve/pricing、取得日 2026-10-10）
| プラン | 年間契約 円/月（税込） | 複数月契約 円/月 | 月間予約件数 | 予約ページ公開数 | 登録スタッフ数 |
|---|---|---|---|---|---|
| フリー | 0 | 0 | 50 | 2 | — |
| スモール | 9,790 | 12,980 | 200 | 10 | — |
| チーム | 19,690 | 22,880 | 300 | 10 | 3 |
| ビジネス | 28,600 | 31,790 | 2,000 | 50 | 20 |
| エンタープライズ | 66,000 | 77,000 | 5,000 | 100 | 無制限 |
「初期費用は無料」「各有料プランの月間予約件数を超える場合、50件ごとに1,078円（税込）」「事前クレジットカード決済手数料は、フリープランの場合5.2%〜、スタンダードプラン加入の場合3.3%〜」「有料プランは『年契約』と『最短3ヶ月〜の複数月契約』」。→ 以前の「チーム 月5,000件・通常77,000円」はエンタープライズの値を誤って当てていたので訂正。

### C-3 minimo（https://minimodel.jp/info、取得日 2026-10-10、原文）
「ミニモは月額利用料0円、お客様が来店した際のみ手数料をいただきます。」
| 施術料金 | 手数料（税込） |
|---|---|
| 0円 | 110円 |
| 1〜2,200円 | 440円 |
| 2,201〜6,600円 | 660円 |
| 6,601円以上 | 880円 |
「初期費用 0円／月額料金 0円」「※1 サロン都合によるキャンセルは手数料がかかります。」店舗向け「サロンツール」は「初期費用・月額料金・手数料 0円」（ただし「ミニモ手数料はお客様（＝掲載スタッフ）のご負担」）。→ 一人バーバーの客単価 4,000〜10,000円帯では 1件 660〜880円＝売上の 7〜16%。

### C-4 かんざし／リザービア
- かんざし: `kanzashi.cynd.co.jp`, `kanzashi.jp`, `www.kanzashi.jp` いずれもプロキシ 502 で到達不能。CYND 社プロダクトページ（https://www.cynd.co.jp/product/）には BeautyMerit のみ（「契約店舗数10,000店舗を突破」2026-09-29 ニュース）。料金は未確認。
- リザービア（https://rsvia.co.jp/）: ナビは「機能一覧／サポート体制／業種・成功事例／予約画面デモ／資料請求（無料）」で料金ページは無く、`/price/` `/plan/` は 404。トップに金額表記なし（「7,500店以上の導入実績」）。→ 料金は非公開（資料請求制）。「予約画面デモ」（理容室・バーバー向け）は存在するので、必要なら次回フォローアップで実機確認する。

---

## D. デザイン一次資料

### D-1 Material Design 3（m3.material.io、取得日 2026-10-10、Playwright でレンダリング）
- Color contrast（/foundations/designing/color-contrast）原文: 「Large text (at 14 pt bold/18 pt regular and up) and graphics — At least 3:1 against the background」「Small text — At least 4.5:1 against the background」「Disabled states do not need to meet contrast requirements.」「Some non-text elements, such as button containers, should meet a contrast ratio of 3:1 between their container color and the color of their background.」「Standalone components, such as FABs, don't need to meet Material's minimum contrast of 3:1 … because of their prominence」
- Color roles（/styles/color/roles）: 「The five surface container roles, shown in light and dark theme」— M3 ではダークテーマ専用ページは無く、ロール（surface / surface-container-* / on-surface）を光・暗の両スキームに割り当てる構造。
- ダーク値の出典は **M2**（https://m2.material.io/design/color/dark-theme.html、ページ冒頭に「Material 2 is no longer maintained. Upgrade to Material 3」）原文: 「The recommended dark theme surface color is #121212.」「Contrast: Dark surfaces and 100% white body text have a contrast level of at least 15.8:1」「Desaturation: Primary colors are desaturated so they pass the Web Content Accessibility Guidelines' (WCAG) AA standard of at least 4.5:1 (when used with body text) at all elevation levels」「Use dark grey – rather than black – to express elevation」。
- Motion tokens（/styles/motion/easing-and-duration/tokens-specs）原文: Emphasized decelerate CSS `cubic-bezier(0.05, 0.7, 0.1, 1.0)`、Emphasized accelerate `cubic-bezier(0.3, 0.0, 0.8, 0.15)`、Emphasized（CSS は「N/A (Use Standard as a fallback)」）、Standard `cubic-bezier(0.2, 0.0, 0, 1.0)`、Standard decelerate `cubic-bezier(0, 0, 0, 1)`、Standard accelerate `cubic-bezier(0.3, 0, 1, 1)`。Duration: short1–4 = 50/100/150/200ms、medium1–4 = 250/300/350/400ms、long1–4 = 450/500/550/600ms、extra-long1–4 = 700/800/900/1000ms。例示: 「Selection controls have a short duration of 200ms with Standard easing」「A FAB expanding into a Sheet uses a 400ms duration with Emphasized easing」「A Card expanding to full screen uses a long 500ms duration」。
- Applying（…/applying-easing-and-duration）「Suggested easing and duration pairs」: Emphasized 500ms「Begin and end on screen」／Emphasized decelerate 400ms「Enter the screen」／Emphasized accelerate 200ms「Exit the screen」／Standard 300ms／Standard decelerate 250ms／Standard accelerate 200ms。「The Standard set is also a fallback for platforms that don't support Emphasized easing, like iOS and Web.」
- 両ページ冒頭の注記: 「In the expressive update, components and motion now use the motion physics system, which uses springs. Products should migrate to the new system. The easing and duration system … is no longer maintained.」→ 01 ノートの「M3 Expressive のスプリング仕様は未取得」は、公式に「easing/duration はメンテ終了・スプリングへ移行推奨」と明記されていることだけ確認（スプリングの数値仕様はトークンページには無い）。

### D-2 NN/g（取得日 2026-10-10）
- Progress Indicators（/articles/progress-indicators/）: 「The main guideline is to use a looped indicator for delays of 2–9 seconds and a percent-done indicator for delays of 10 seconds or more.」「we don't recommend looped animation for actions that take longer than 10 seconds」。UNL の研究の引用: 「the people who saw the moving feedback bar experienced higher satisfaction and were willing to wait on average 3 times longer than those who did not see any progress indicators」。※ これは「待ち時間」の進捗であり、マルチステップフォームの「ステップ表示」が完了率に与える影響の定量は本記事に無い（この Gap は依然未解決）。
- Website Forms Usability: Top 10（/articles/web-form-design/）: 「78% one-try submissions in forms compliant with usability guidelines versus only 42% one-try submissions in forms violating them」（Seckler ら CHI）、「Every time you cut a field or question from a form, you increase its conversion rate」「Present fields in a single column layout」「Labels … immediately above the field for mobile」「Limit the form to only 1 or 2 optional fields」「Avoid drop-downs when there are only 2 or 3 options」。
- Date-Input Form Fields（/articles/date-input/）: 「Calendar pickers should be used for events close to the present time — within less than a year.」「we don't recommend this method [リスト] when there are more than 10 dates available」「We recommend that you allow users to type the date even if other input methods are available.」「Note the benefit of denoting the current date as "today"」。※ 以前想定した `/articles/date-picker/` は 404（NN/g 自身が「AI chat がURLを捏造することがある」と表示）。
- Error-Message Guidelines（/articles/errors-forms-design-guidelines/）: 「1. Aim for Inline Validation Whenever Possible」「show an actionable error message below or next to the problem field」。

### D-3 サムゾーン（Hoober）
- 原典: Steven Hoober, "How Do Users Really Hold Mobile Devices?", UXmatters, 2013-02（https://www.uxmatters.com/mt/archives/2013/02/how-do-users-really-hold-mobile-devices.php）。原文: 「For two months, ending on January 8, 2013, I—and a few other researchers—made 1,333 observations of people using mobile devices on the street … Of these people, 780 were touching the screen」「one handed—49% / cradled—36% / two handed—15%」「Even the least-used case, two-handed use, is large enough that you should consider it during design.」
- Smashing Magazine "The Thumb Zone: Designing For Mobile Users"（Samantha Ingram, 2016-09）は Hoober の 49% と Josh Clark の「75% of interactions are thumb-driven」を引用する二次記事。01 ノートの「Smashing = Hoober 原典」という想定は誤りで、Hoober の一次資料は UXmatters。

### D-4 Practical Typography（Butterick、取得日 2026-10-10）
- Line length: 「line length 45–90 characters or 2–3 alphabets」「Aim for an average line length of 45–90 characters, including spaces.」
- Line spacing: 「line spacing 120–145% of the point size」「For most text, the optimal line spacing is between 120% and 145% of the point size.」「CSS Use the line-height property, preferably without units」
- Point size: 「On the web, the optimal size is 15–25 pixels.」「For websites, I recommend body text of 15–25 pixels.」
→ 以前「記憶ベースのため不採用」としていた3値はすべて原典どおり。ただし欧文前提の値であり、和文の行間は D-5 のデジタル庁値（1.6〜1.75）を優先する。

### D-5 デジタル庁デザインシステム タイポグラフィ（https://design.digital.go.jp/dads/foundations/typography/、2026年8月5日更新）
- 「フォントはオープンソース…でWebフォントとしても利用可能な『Noto Sans JP』と等幅フォントの『Noto Sans Mono』を採用」
- 「読み物コンテンツにおける本文テキストの行ボックスの高さ（行高）はフォントサイズに対して少なくとも1.5倍を維持することを推奨」
- 行高トークン（原文の用途）: 100%（ボタン等ワンライン）／120%・130%（管理画面）／140%（見出し）／150%（本文の最低限度）／**160%（一般的なウェブサイトの本文）／170%／175%（心理的負荷の軽減を考慮した行間）**。「実際のCSSではnumber（単位なし数値）で実装」
- Standard テキスト: 「視認性、可読性の観点から、基本的にフォントサイズは16 CSS px以上」「文字間隔（letter-spacing）はフォントサイズの大小に応じて、0、1%（0.01em）、2%（0.02em）」。Display は letter-spacing 0、行高140%。例トークン: Std-16N-170, Std-16N-175, Std-17N-170, Std-18N-160。
→ 01 ノートの推定「本文 0.04em」は公的な一次値より大きい。本文は 0〜0.02em、行間 1.7 を基準にする。

### D-6 Google Fonts 配信の Noto Sans JP（取得日 2026-10-10）
- `https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@100..900&display=swap`（Chrome UA）: `@font-face` が **124 ブロック**＝無名の日本語スライス 120（`…dN.0.woff2`〜`…dN.119.woff2`、`font-weight: 100 900` の可変フォント、v57）＋ `/* cyrillic */ /* vietnamese */ /* latin-ext */ /* latin */` の4つ。static 400 指定（`family=Noto+Sans+JP`）でも同じ124分割。
- fontTools 4.66 で woff2 を検査: ひらがな U+3042・カタカナ U+30AB を含むスライス #119（400 glyph）の GPOS フィーチャーは `halt, kern, palt, vert, vhal, vkrn, vpal`、GSUB は `ccmp, locl, vert, vrt2`。漢字「愛」U+611B を含むスライス #114（69 glyph）は GPOS `kern, palt, vpal`。latin スライスは GPOS `kern` のみ（palt なし）。
- 結論: **Google Fonts 配信版でも `font-feature-settings: "palt"` は有効**（スライスごとに GPOS が保持されている）。欧文には palt が無いので Lato/英数には影響しない。`next/font/google` の preload サブセットに `japanese` が無い（01 ノート）点は変わらず、日本語は最大120スライスの遅延取得になる。

---

## E. Instagram
- https://www.instagram.com/neuer.kento/ を Chrome UA の Playwright で1回取得: **HTTP 429** → `https://www.instagram.com/accounts/login/?next=%2Fneuer.kento%2F&is_from_rle` にリダイレクト（本文なし）。ログイン壁のため中止。プロフィール内容（投稿数・リンク・予約導線）は未取得。

---

## 設計判断への影響（ワイヤーフレームに反映する点）

1. **カレンダー記号**: HPB の公式定義は「◎ 即時予約可／○ 仮予約可／× 予約できません」。本サイトは即時確定のみなので **◎ と × の2値**に揃え、○（仮予約）と △ は使わない（HPB 利用者に「仮予約」と誤読される）。凡例はグリッド直下に「◎：予約できます（この時刻から施術開始）／×：予約できません」の2行で置く。◎は画像でなくテキスト（HPB も文字）で、色は 3:1 以上のアクセント、× は低コントラストの灰（HPB: #999 on #EEE）で「押せない」ことを伝える。
2. **直前枠の扱い**: HPB は締切後の枠を「×」ではなく「TEL：直前のため、お電話で…」に置き換え、電話番号リンクを凡例直下に置く。本サイトも「本日の残り枠は LINE/電話で」と**同じ位置（凡例直下）**に連絡導線を出す。締切時間は HPB では非表示だが、RESERVA のサンプルは「予約締切：6時間前まで」と明記しているので、本サイトは明記する（例: 「ご来店の60分前まで受付」）。
3. **ステップの順序とラベル**: HPB は「クーポン・メニューを選ぶ → 日時を指定する → 予約手続きへ」の3段で、**指名は日時画面の上部に同居**、ログインは日時選択後。本サイトはログイン不要なので「メニューを選ぶ → 日時を選ぶ → お客様情報 → 確認」の4段にし、ラベルは HPB に倣って「〜を選ぶ／〜を指定する」の動詞形で統一。スタッフが1人なので指名 UI は出さない。
4. **グリッド形式**: HPB は 7日×30分の週グリッド（横=日付、縦=時刻）＋「前の一週間／次の一週間」。60分固定メニューの本サイトでも、HPB 慣れを活かすならこの週グリッドが第一候補。土曜ヘッダを水色、日祝をピンクにする慣習、定休日は列ごと「休」で潰す表現、営業時間外は「－」で区別する表現もそのまま採用できる。「午後／夜」へのジャンプリンクは営業枠が 18:00〜24:00 の個人枠には不要。
5. **価格・所要時間**: HPB はメニュー一覧に所要時間を出さず、選択後に「施術時間合計（目安）」として出す。RESERVA は一覧で「￥5,500～ 60分」と並記。本サイトは RESERVA 式（一覧で価格＋所要時間、確認画面で合計）を採る。「価格は税込表示です」の注記と「目安」の但し書きを踏襲。
6. **担当者名の日英併記**: クライアントが使っていた RESERVA ページは「小川 悠登 / Yuto Ogawa」「指名なし / Any Stylist」と日英併記。本サイトの英語対応は言語切替よりも、まず**固有名詞・メニュー名の併記**で十分な場面が多い（切替 UI は補助）。
7. **タイポグラフィ**: 本文 16px 以上、行間 1.6〜1.75（デジタル庁の Std-16N-170 相当）、letter-spacing は 0〜0.02em（0.04em は過大）。欧文行長は 45〜90 字、欧文行間は 1.2〜1.45（Practical Typography）。Noto Sans JP の `palt` は Google 配信でも効くので、見出しのみ `font-feature-settings: "palt"` を有効化できる。
8. **コントラスト／ダーク**: M3 の 3:1（大文字・図形・ボタン容器）／4.5:1（小文字）を最低線にし、ダークは M2 由来の #121212 相当（本サイトはクラフト紙ベージュ基調のためダークは「将来の任意」）。無効状態はコントラスト要件外（M3）なので、× セルの薄灰は許容。
9. **モーション**: M3 公式ペア（入場 400ms emphasized-decelerate／退場 200ms emphasized-accelerate／小さなユーティリティ 200〜300ms standard）に合わせ、Web では emphasized の代わりに standard をフォールバックとする（公式注記）。
10. **フォーム**: NN/g に沿って単一カラム、ラベルは直上、任意項目は 1〜2 個、エラーはインライン、日付は「今日」を明示。進捗表示の効果の定量は未取得のままなので、ステップ表示は「ガイドライン準拠」として扱い KPI 根拠には使わない。
11. **料金比較の数値**: 「なぜ自作か」の比較は RESERVA 3,850円/月（年払）・STORES 9,790円/月（年契約）・minimo 1件 660〜880円（客単価 6,601円以上は 880円）で更新。STORES の「チーム 77,000円」は誤りだったので 22,880円（複数月）/19,690円（年契約）に差し替える。HPB は公式に「エリア・プランで異なる、要問合せ」で変わらず。

## 残ギャップ（次回）
- HPB の直前締切（何分前）: 公式記述なし。平日昼に同じ手順で当日列を再観測すれば TEL 枠の幅から推定できる。
- RESERVA の日時画面（記号・月/週表示）: Cloudflare で機械取得不可。クライアントの実機スクリーンショット、またはリザービア「予約画面デモ」（理容室向け）を実ブラウザで確認。
- サロンボードのリマインド仕様・かんざし料金: 本環境から到達不能のため、別ネットワークで salonboard.com / kanzashi.cynd.co.jp を確認。
- HPB ヘルプ記事本文（所要時間 FAQ 000003388、確認メール FAQ 000003386）: SPA のため実ブラウザで確認。
- Instagram プロフィール: ログイン壁。クライアントから画面共有で確認。
