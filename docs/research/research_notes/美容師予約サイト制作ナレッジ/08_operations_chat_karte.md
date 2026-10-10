# 08. 運用フロー・顧客チャット・電子カルテ（運用ポリシーと将来フェーズの設計土台）

調査日: 2026-10-10 / 対象: 大阪のひとり美容師（即時確定予約・管理PWA＋プッシュ通知・決済なし・アカウントなし＝電話番号＋トークン付きキャンセルリンク）

> **調査環境の制約（重要）**: 本セッションではWebFetchが使えず、curlによる直接取得も組織のネットワークポリシーで全ホスト403（lycbiz.com, developers.line.biz, developers.facebook.com, supabase.com, ably.com, pusher.com, getstream.io, cloudflare.com, vercel.com, ppc.go.jp, jicoo.com, freee.co.jp, holidays-jp.github.io, cao.go.jp, plausible.io, umami.is すべて拒否）。そのため本ノートの事実はすべて **WebSearch の検索結果要約（スニペット）** に基づく。一次資料の本文を精読できていない箇所は「要確認」と明記した。また調査途中でセッションのWebSearch上限に達したため、未調査の問いは各節の Gaps に残した。

---

## Q1. 日々の運用フロー（手動予約・時間ブロック・遅刻・無断キャンセル・リマインド・飛び込み・オーバーブッキング・休業日と祝日）

### Takeaway
日本の美容サロンのキャンセルポリシー相場は「前日まで無料（または30%）／当日50%／無断100%」が定番だが、決済なし・少額の実務では**請求より予防（リマインド＋明示同意＋常習者の制限）**が主戦略になる。リマインドは「2日前の夜＋前日午前」の二段構えが業界ツールの標準例。祝日は内閣府CSV由来のライブラリ（npm `@holiday-jp/holiday_jp` 等）で判定し、店の定休日・臨時休業は別テーブルで上書きする。

### Cited Findings

**キャンセルポリシー（相場・文言・法的注意）**
- 美容サロンの業種別相場として「当日キャンセルまたは当日の日時変更で施術料金の50%、無断キャンセルで100%」が標準的 — [tol magazine キャンセルポリシー例文集](https://tol-app.jp/columns/915)
- 「美容室・サロンでは施術料金の50%、人気店や高単価メニューでは100%が一般的。まず50%から始めて無断キャンセルの発生状況を見て調整」 — [STORES 美容室のキャンセル料の相場](https://stores.fun/magazine/articles/beauty-salon-cancellation-fee)
- 段階式の例文: 「3日前〜前日まで：予約料金の30%／当日：50%／無断キャンセル：100%」 — [kalonade サロンの当日キャンセルポリシー例文集](https://service.kalonade.com/blog/salon-last-minute-cancellation-policy-template)
- freeeの美容サロン例: 「前日までの連絡は無料、当日キャンセルは施術料金の50%」 — [freee キャンセルポリシーとは](https://www.freee.co.jp/kb/kb-reservation-management/cancellation-policy/)
- 遅刻の記載例: 「連絡なく15分以上遅れた場合は無断キャンセルとさせていただく場合がございます」「遅れて来店した場合は施術時間を短縮することがある」「15分以上遅れる場合はお電話ください」と連絡手段も明示すべき — [tol magazine](https://tol-app.jp/columns/915); [kalonade](https://service.kalonade.com/blog/salon-last-minute-cancellation-policy-template)（検索要約で両記事が該当。どちらの文言か個別確認要）
- 予約成立時点で契約が成立しており、無断キャンセルは債務不履行と判断されうる — [Square 無断キャンセルへの対処](https://squareup.com/jp/ja/townsquare/how-to-deal-with-no-shows)
- 消費者契約法9条により、規約に書いても「事業者に生じる平均的な損害」を超えるキャンセル料は無効になりうる。予約画面での同意取得が有効 — [Jicoo 無断キャンセル・キャンセルポリシーテンプレート（2026年8月）](https://www.jicoo.com/magazine/blog/reservation-no-show-cancellation-policy-template)
- キャンセル料は「料金分以下」になる（料金以上の請求は困難）、ポリシーは明確に提示する必要がある — [jobvr 美容院のキャンセル料](https://jobvr.co.jp/beauty-salon-cancel/)
- 前日キャンセル30%を相場として挙げる解説 — [assist-all キャンセルポリシーの書き方](https://assist-all.co.jp/salon_reserve/column/20250809-7545/)
- 無断キャンセル対策として事前決済＋キャンセルポリシーを推す記事（決済ありの選択肢の参考） — [rsvia 無断キャンセル対策](https://rsvia.co.jp/column/cancellation_policy/); [payn 美容サロン向けキャンセルポリシー](https://payn.io/articles/beauty-salon-cancellation-guide)

**無断キャンセル率・リマインド効果（数値の信頼性に注意）**
- 業界全体の無断キャンセル率を示す公的・学術的な統計は検索で見つからず。見つかった数値はいずれもベンダー発: 「リマインドで無断キャンセル率を60%改善」（調査方法・対象数の記載なし） — [Beauty Merit 無断キャンセル対策](https://www.b-merit.jp/magazine/noshow/); 「LINE自動リマインドで体感で半減」 — [miyabi-ai](https://www.miyabi-ai.jp/articles/beauty-salon-cancel); 「段階的キャンセル料導入後にキャンセル率11%」（導入前の数値なし） — [haward-joyman](https://haward-joyman.com/beauty/%E3%83%89%E3%82%BF%E3%82%AD%E3%83%A3%E3%83%B3%E3%83%BB%E7%84%A1%E6%96%AD%E3%82%AD%E3%83%A3%E3%83%B3%E3%82%BB%E3%83%AB%E3%82%9250%EF%BC%85%E6%B8%9B%E3%82%89%E3%81%99%E4%BA%88%E9%98%B2%E7%AD%96/)
- リマインドの主効果は「うっかり忘れの防止」と「事前連絡による代替予約の確保」 — [Beauty Merit](https://www.b-merit.jp/magazine/noshow/)
- リマインド送信は前日または当日朝が推奨 — [beautygarage 美容室のキャンセル対策完全ガイド](https://kaigyo.beautygarage.jp/archives/15906)
- ホットペッパービューティーアカデミーの公開調査には無断キャンセル率の調査は見当たらなかった（公開テーマは美容師の離職理由など） — [HBA PR 2024-04-25](https://hba.beauty.hotpepper.jp/wp/wp-content/uploads/2024/04/PR_20240425.pdf)

**リマインドのタイミング・文面**
- 美容室向けLINE運用ガイドの例: 「予約日の2日前の夜20時に『明後日のご予約のご確認』を自動送信、前日の午前10時に最終リマインド」 — [aurant LINE公式アカウント 美容室活用](https://aurant-technologies.com/blog/line-official-account-for-beauty-salon/)
- 利用者の声: 「一ヶ月前など時間が空く場合は、前日と一週間前に通知があるととても助かる」 — [linestep](https://linestep.jp/?p=25200)
- リマインド文は簡単なあいさつから始める、「リマインド」という語自体が高圧的に響く場合があるので避ける — [Square リマインドメールとは](https://squareup.com/jp/ja/townsquare/what-is-a-reminder-email)
- 配信の送りすぎ（高頻度のセール案内）はブロック率を上げる — [ligla リマインド配信](https://ligla.jp/blog/delivery/reminder/)

**ダブルブッキング・バッファ**
- 予約導線が増えるほど手作業管理ではダブルブッキングや共有漏れが起きやすく、一元管理システムが対策 — [Square 予約システム導入](https://squareup.com/jp/ja/townsquare/how-to-introduce-reservation-system)
- バッファ時間＝予約と予約の間の片付け・準備・移動・休憩の余裕。「各予約の前／各予約の後／その日の最初の予約の前」に分単位で設定できるツールがある — [Sesami バッファ時間](https://help.sesami.co/ja/yu-yue/availability/buffer-times)
- 空き枠計算にバッファを自動で組み込み、15分バッファなら各予約の所要時間に15分を加算して空きを判定 — [Pabau buffer time](https://support.pabau.com/en/pabau2/how-to-set-up-and-use-buffer-time-between-bookings)
- 空き状況が実態と合わないと二重予約・顧客の不満・運用非効率につながる — [Acuity avoid double booking](https://acuityscheduling.com/learn/avoid-double-booking-appointments)

**祝日カレンダー**
- `@holiday-jp/holiday_jp`: MIT、TypeScript対応、`between()` 関数、特定年のみ読み込むimportパスあり — [yarnpkg @holiday-jp/holiday_jp](https://classic.yarnpkg.com/en/package/@holiday-jp/holiday_jp)
- `holiday-jp-dayjs`: 上記のラッパー。原本がタイムゾーンの影響を受けるため常に Asia/Tokyo で判定する（代わりに特定年のみ読み込みは不可） — [holiday-jp-dayjs README](https://cdn.jsdelivr.net/npm/holiday-jp-dayjs@0.1.2/README.md)
- `holidays-jp`（別パッケージ）: `isHoliday` とCLI — [holidays-jp README](https://cdn.jsdelivr.net/npm/holidays-jp@2.0.61/README.md)
- Holidays JP API（GitHub Pages）: `https://holidays-jp.github.io/api/v1/date.json` をブラウザから取得する例 — [Zenn](https://zenn.dev/c_hero/articles/99b90e4205e54b)（内閣府CSVが直接の元データかは未確認）
- 内閣府「国民の祝日」CSV（syukujitsu.csv）が多くのツールの元データ。例: Rust `holidays_jp` はGitHub Actionsで週1回自動更新 — [crates holidays_jp](https://rust-digger.code-maven.com/crates/holidays_jp); Python `python-shukujitsu` — [PyPI](https://pypi.org/project/python-shukujitsu/)
- 商用API（Calendarific）はAPIとCSVの両方で提供 — [Calendarific JP 2026](https://calendarific.com/holidays/2026/JP)

### Inferences（運用ポリシー案）
- **決済なしでの無断キャンセル対策の現実解**: 請求は法的にも実務的にもコストが高いので、(1) 予約時にポリシーへのチェック同意（同意日時・文言バージョンを保存）、(2) 2段階リマインド（2日前20時、前日10時）＋キャンセルリンク同梱、(3) 顧客ごとの `no_show_count` を記録し、2回目以降は「電話確認必須」「ネット予約停止（要電話）」のフラグで運用、(4) 当日キャンセル・無断は「次回ご予約時に前回分の50%を頂戴することがあります」程度の**裁量条項**にとどめ、消費者契約法9条の「平均的損害」を意識して100%固定を避ける、の組み合わせが妥当。
- **遅刻ルール案**: 連絡なし15分で「遅刻扱い（施術内容短縮または変更）」、30分で「無断キャンセル扱い（枠解放）」。予約確認画面と前日リマインドの両方に記載。管理PWAには「遅刻連絡あり」トグルと「来店待ち→来店→施術中→完了／no_show」の状態遷移を持たせる。
- **手動予約（電話・店頭・Instagram DM経由）**: 管理PWAに `source`（web / phone / walk_in / instagram / line）付きのクイック作成フォーム。電話番号未取得でもOK（`customer_id` NULL許容、名前だけ）にし、後から電話番号で既存顧客にリンクできる設計にする。DM予約を受けたら**必ずシステムに入力してからDMに返信**を運用ルールにし、DMには確認用URL（予約詳細＋キャンセルリンク）を貼る。これが「DM見落とし・二重予約」の直接的な解決策。
- **時間ブロック**: `blocks`（休憩、臨時休業、私用、定期ブロック）テーブルを予約と同じ区間演算で扱い、空き枠計算は `bookings ∪ blocks` を除外。繰り返し（毎週火曜定休、毎日12:00–13:00休憩）は RRULE 風の `recurrence` 列か、単純に `weekly_rules` テーブル＋`date_overrides` テーブルの2層にする（ひとり店なら後者で十分）。
- **バッファ**: メニューごとの `duration_min` に加え `buffer_after_min`（片付け・次の準備、既定10分）を持ち、空き判定時は `duration + buffer` で占有。カラー等は「放置時間中に別客のカットを挟む」運用（いわゆる掛け持ち）をフェーズ1では**許さない**（即時確定×ひとり運営でオーバーブッキングを安全に扱うのは難しい）。必要なら将来 `allow_overlap_during_processing` フラグで検討。
- **飛び込み（walk-in）**: 「予約優先、空きがあれば受付」。管理PWAで「今すぐ枠に walk_in を作成」ボタン（`source='walk_in'`, 電話番号任意）。将来のカルテ連携のために名前＋電話を聞く導線を UI 上で促す。
- **休業日**: `closed_dates`（臨時休業・年末年始）と `weekly_schedule`（定休日・営業時間）。祝日は自動で休みにはせず「祝日表示のみ」＋オーナーが祝日営業をデフォルト設定で選べるようにする（美容室は祝日営業が一般的なため、祝日=休業と決め打ちしない）。祝日データはサーバ側で `@holiday-jp/holiday_jp` を使い、必ず `Asia/Tokyo` で日付を切る（UTC深夜のズレ対策。上記 holiday-jp-dayjs の指摘）。
- **当日キャンセルの受付締切**: キャンセルリンクは「予約開始の N 時間前（例: 2時間前）まで自己キャンセル可」、それ以降は「電話でご連絡ください」と表示し、管理側で `cancelled_late` として記録（統計に使う）。

**ポリシー文例（草案・決済なし前提。弁護士確認推奨）**
```
【ご予約のキャンセル・変更について】
・ご予約の変更・キャンセルは、予約確認メッセージ内のリンクまたはお電話にて、
  前日までにご連絡ください。
・当日のキャンセル・無断キャンセルが続いた場合、次回以降のご予約をお電話のみでの
  受付とさせていただくことがあります。
・ご連絡なく15分以上遅れた場合、施術内容を短縮・変更させていただくことがあります。
  30分を過ぎた場合はキャンセル扱いとなることがあります。
・体調不良など、やむを得ない事情の場合はお気軽にご連絡ください。
```

### Gaps
- 日本の美容室における無断キャンセル率の信頼できる統計（HBA等）は見つからなかった。Beauty Merit の「60%改善」などは方法論不明。
- Jicoo／Square／NEC の業種別文例本文は取得できず（403）。文例の正確な引用は不可。
- 経産省の無断キャンセル対策レポート（飲食業向け）は検索上限で未確認。
- 内閣府CSVの正確なURL（www8.cao.go.jp/chosei/shukujitsu/gaiyou.html）は取得できず、内容未確認。

---

## Q2. アカウントなしの顧客識別（電話番号キー・表記ゆれ・重複マージ・同意文言・保存期間・APPI対応）

### Takeaway
顧客キーは **E.164 正規化済み電話番号**（`+8190...`）に統一し、入力時に libphonenumber 系で検証する。個人情報保護法上、保存期間の法定上限はないが「利用する必要がなくなったら遅滞なく消去する努力義務（22条）」と本人の「利用停止・消去請求権」があるため、**明文の保存ルール（例: 最終来店から3年で匿名化）＋削除依頼フロー**を最初から持つ。アレルギー等の健康関連情報は「要配慮個人情報（病歴）」に該当しうるため、カルテ導入時は**取得時に明示同意**を取る設計が安全。

### Cited Findings

**電話番号の正規化**
- libphonenumber-js は Google libphonenumber の軽量なJS/TS実装。`parsePhoneNumberFromString(phone, countryCode)` → `.isValid()` の利用パターン — [docsearch libphonenumber-js](https://docsearch.algolia.com/mcp/docs/repo/catamphetamine/libphonenumber-js)
- E.164 は国番号＋国内番号（先頭のトランク「0」を落とす）。東京の例 `+81312345678` — [phone-check.app E.164 guide](https://phone-check.app/blog/e164-phone-number-format-international-normalization-validation)
- Go移植版の例: `"090-6135-4467"` を `JP` で正規化 → `819061354467` — [pkg.go.dev dongri/phonenumber](https://fr.github.com/dongri/phonenumber)

**個人情報保護法（APPI）の要点**
- 個人データを利用する必要がなくなったときは遅滞なく消去するよう努めなければならない（現行22条、旧19条/29条の番号変更あり） — [BUSINESS LAWYERS](https://www.businesslawyers.jp/practices/617); [J-Net21 2022-12-23](https://j-net21.smrj.go.jp/law/20221223.html)
- 2022年施行の改正で、本人は「利用する必要がなくなった場合」等にも利用停止・消去を請求できるようになった（請求権であり努力義務ではない） — [J-Net21](https://j-net21.smrj.go.jp/law/20221223.html)
- 法律は一律の保存期間を定めていない。6か月以内に消去する短期保存データも「保有個人データ」に含まれ、開示・利用停止等の対象になる — [厚労省資料 PDF](https://www.mhlw.go.jp/content/10904750/000863621.pdf); [J-Net21](https://j-net21.smrj.go.jp/law/20221223.html)
- 開示請求の手数料例: ある事業者は「開示請求1件につき法に基づき800円」を定額小為替で徴収（条番号は旧法33条。現行法では38条相当。要確認） — [AIST 手数料 PDF](https://WWW.aist.go.jp/Portals/0/resource_images/aist_j/comp-info/pip/Personalinformation_fee.pdf)
- 「中小規模事業者」＝従業員100人以下の個人情報取扱事業者のうち、5,000人超の個人情報を扱う者・委託で個人データを扱う者を除くもの — [高知市資料 PDF](https://www.city.kochi.kochi.jp/uploaded/attachment/128482.pdf); [BUSINESS LAWYERS 287](https://www.businesslawyers.jp/practices/287)
- 個人情報保護委員会の中小企業向け安全管理措置参考資料（令和4年4月）: 「会社の規模、業種、組織体制、個人情報の種類等によって行うべき安全対策は異なる」 — [wic-net PDF](https://www.wic-net.com/material/static/00018329/00018329.pdf)
- 委員会の令和6年11月実態調査（従業員100人以下対象）: 安全管理措置の取組が十分でない事業者が多く、漏えい等報告の義務化を知らない事業者が多数派 — [wic-net PDF](https://www.wic-net.com/material/static/00018329/00018329.pdf)
- 要配慮個人情報（法2条3項）: 人種、信条、社会的身分、**病歴**、犯罪の経歴など — [keiyaku-watch 要配慮個人情報とは](https://keiyaku-watch.jp/media/hourei/youhairyokojinjyoho/); [BUSINESS LAWYERS 271](https://www.businesslawyers.jp/practices/271)
- 該当範囲は法2条3項・施行令2条各号・施行規則5条各号・通則編ガイドライン2-3に整理 — [個人情報保護委員会 通則編ガイドライン](https://www.ppc.go.jp/personalinfo/legal/guidelines_tsusoku/); [PPC FAQ 要配慮個人情報](https://www.ppc.go.jp/all_faq_index/faq4-q011/)
- 要配慮個人情報はオプトアウト方式の第三者提供が認められず、本人の事前同意が必須 — [HRpro](https://www.hrpro.co.jp/series_detail.php?t_no=3773)
- アレルギー情報が「病歴」に該当するかを直接述べた公的資料は検索では見つからず（検索結果は学校給食の様式ばかり） — [検索結果: businesslawyers 271](https://www.businesslawyers.jp/practices/271)

**写真・肖像権の同意**
- 施術写真の同意書に入れる項目: 撮影日・場所、本人の氏名と連絡先、掲載媒体、掲載期間、利用範囲（SNSのみか広告・印刷物への転用まで）、撤回の方法。書面またはデジタル記録が必須 — [atsoho ビフォーアフター撮影](https://atsoho.com/blog/salon-before-after-photo-shoot-cost)
- SNS掲載承諾書はアカウント運用者と被写体との間で締結する書面 — [マネーフォワード 契約書](https://biz.moneyforward.com/contract/basic/17759/)
- 肖像権＝自分の容姿を無断で撮影・公表されない権利。本人が用途と公開方法を理解して同意していれば侵害にならない — [0120.co.jp](https://0120.co.jp/blog/video-87/)

### Inferences（設計案）
- **正規化ルール**: 入力は全角→半角、ハイフン・空白除去、先頭 `0` を `+81` に変換、libphonenumber-js で `isValid()`（JP）を通す。保存は `phone_e164`（UNIQUE）と `phone_display`（`090-1234-5678`）の2列。固定電話（06-...）も `+816...` で受ける。
- **表記ゆれ・タイポ対策**: (1) 入力時に2回入力ではなく「確認画面で大きく表示」、(2) 管理PWAの新規予約時に `phone_e164` 完全一致で既存顧客を即時サジェスト、(3) 名前（かな正規化: NFKC＋カタカナ→ひらがな）での部分一致サジェストを併用、(4) 無効番号は予約不可にするが、オーナーの手動入力は `phone_unverified=true` で許容。
- **重複マージ**: `customers.merged_into_customer_id` を持ち、マージ時は bookings/karte/messages の `customer_id` を付け替え、旧レコードは `status='merged'` で残す（監査ログに `merge` イベント）。アカウントがないため**本人確認はSMS/電話での口頭確認**に頼る。カスタマー向けの自己情報表示は、電話番号＋予約トークンの範囲で「その予約の内容」だけに限定し、全履歴は出さない（なりすまし防止）。
- **同意文言（予約フォーム下部、必須チェック）**:
  ```
  ご入力いただいた氏名・電話番号は、ご予約の管理・確認連絡・リマインド送信・
  施術の記録（カルテ）のために利用し、第三者には提供しません。
  詳細は「プライバシーポリシー」をご確認ください。
  □ 上記およびキャンセルポリシーに同意します
  ```
  `consents` テーブルに `policy_version`, `accepted_at`, `ip/ua` を保存。将来のカルテ（健康関連）・写真用途は**別チェック**（兼用しない）。
- **保存期間ポリシー案（明文化して掲載）**: 予約・来店記録は「最終来店から3年」で個人識別情報を匿名化（電話番号ハッシュ化、名前削除、統計用の集計は保持）。削除依頼は「電話番号＋本人確認の折り返し電話」で受け、7日以内に対応。法定期限はないが「遅滞なく」が原則。
- **開示請求への備え**: 顧客ごとに JSON エクスポート（予約・カルテ・同意履歴）を1クリックで出せる管理機能を用意すると、開示・削除依頼のコストが下がる。手数料は小規模店では徴収しない方が実務的。
- **アレルギー等の扱い**: 「薬剤でかぶれた経験」「妊娠中」「皮膚疾患」は病歴に当たりうる。カルテでは (a) 項目名を「施術上の注意（かぶれ・しみる等）」と業務目的に限定した表現にし、(b) 取得時に「施術の安全のために記録します」と目的を明示して同意チェック、(c) 第三者提供はしない、(d) 暗号化カラム or 行レベルで `sensitive=true` を付けてエクスポート・ログから除外、を徹底。

### Gaps
- アレルギー／皮膚トラブル歴が要配慮個人情報に該当するかの公式見解（PPC Q&A 本文）は未確認。保守的に「該当しうる」として設計する。
- 開示請求の法定の回答期限（「2週間」という定説は裏付けなし。法は「遅滞なく」）。現行法の条番号（開示33条、手数料38条、利用停止35条）は要e-Gov確認。
- 「はじめての個人情報保護法」（PPC中小規模事業者向け資料）の本文は未取得。
- 顧客情報の保存期間の業界慣行（「最終来店からN年」）を示す一次資料は未発見。上記3年は推奨値であって根拠値ではない。

---

## Q3. プッシュ以外を含む通知戦略（イベント・JP/ENテンプレ・静音時間）

### Takeaway
オーナー向けはPWAプッシュ＋日次ダイジェスト、顧客向けは決済なし・アカウントなしのため**SMSかLINEのどちらか**になる。LINE公式アカウントはコミュニケーションプラン0円・月200通まで無料（2026年時点）、応答（Reply）は通数にカウントされないので、「顧客がLINEで来た会話に返す」限り無料で回る。静音時間は 21:00–08:00 を既定にし、リマインドは「2日前20時／前日10時」の慣行に合わせる。

### Cited Findings
- LINE公式アカウント料金（2026年）: コミュニケーション 0円・200通/月・超過不可／ライト 5,000円・5,000通／スタンダード 15,000円・30,000通・超過は従量 — [ligla プラン](https://ligla.jp/blog/line-official/plan/); [aurant 2026料金](https://aurant-technologies.com/blog/line-official-pricing-plan-2026/)
- 通数カウント対象はプッシュ・マルチキャスト・ブロードキャスト・ナローキャストの4系統。**応答メッセージ（Reply API）はカウントされない**。カウントは「送信リクエスト数×送信対象人数」、1リクエストに最大5メッセージ — [LINE Developers Messaging APIの料金](https://developers.line.biz/ja/docs/messaging-api/pricing/); [LINE Developers 通数カウント方法（2026-05-28）](https://developers.line.biz/ja/tips/2026/05/28/how-to-count-messages/); [issoh](https://www.issoh.co.jp/column/details/3302/)
- 無料枠を超えるとエラーレスポンスが返りメッセージは送信されない — [LINE Developers 料金](https://developers.line.biz/ja/docs/messaging-api/pricing/)
- 2026年10月1日に追加メッセージ料金を改定（日本のみ）: 月20万通まで1通3円、20万通超は1通2.5円（税別）。同じ通数設定でも上限額が改定前より高くなる可能性 — [LINEヤフー for Business お知らせ 2026-10-01](https://www.lycbiz.com/jp/news/line-official-account/20261001/); [同 2026-02-16 告知](https://www.lycbiz.com/jp/news/line-official-account/20260216/)
- リマインド時刻の業界例（2日前20時・前日10時）、「リマインド」という語を避ける、あいさつから始める — Q1参照（[aurant](https://aurant-technologies.com/blog/line-official-account-for-beauty-salon/), [Square](https://squareup.com/jp/ja/townsquare/what-is-a-reminder-email)）
- 送りすぎはブロック率を上げる — [ligla](https://ligla.jp/blog/delivery/reminder/)

### Inferences（通知マトリクス案）

| イベント | オーナー（PWAプッシュ） | 顧客（SMS/LINE/メール） | 備考 |
|---|---|---|---|
| 新規予約（web） | 即時 | 即時確認（予約内容＋キャンセルリンク） | 静音時間でも顧客確認は送る（本人起点） |
| 手動予約（phone/walk_in/IG） | なし（自分が入力） | 電話番号ありなら確認を送る | DM予約の「証跡」になる |
| 顧客キャンセル | 即時（高優先） | キャンセル完了通知 | 空いた枠の案内は将来 |
| 顧客変更（日時） | 即時 | 変更確認 | 変更＝キャンセル＋再予約として履歴保持 |
| オーナー側キャンセル/変更 | — | 即時＋謝罪文面 | 理由テンプレ（体調不良・臨時休業） |
| リマインド | — | 2日前20:00、前日10:00 | 片方だけならば前日10:00 |
| 来店後サンクス | — | 翌日10:00（任意、オプトイン） | 次回提案はカルテ連携後 |
| 日次ダイジェスト | 前日21:00 or 当日07:30 | — | 明日の予約一覧・空き・未確認DM件数 |
| 無断キャンセル記録 | — | なし（自動では送らない） | 手動で丁寧に連絡する運用 |

- **静音時間**: 顧客向け自動送信は 08:00–21:00 JST のみ。範囲外にスケジュールされたリマインドは翌 08:00 に繰り延べ。オーナー向けプッシュは本人設定（既定: 22:00–08:00 はまとめて朝に通知、ただし「当日予約の新規・キャンセル」は例外で即時）。
- **チャネル選択**: フェーズ1は SMS（送信コストはキャリア/ベンダー次第、未調査）か、LINE友だち追加を予約完了画面で促す二段構え。LINEは「顧客起点の会話に返す（Reply）」が無料、こちらからの予約確認やリマインドは「プッシュ」で月200通の枠を消費（1人1予約あたり確認1＋リマインド2＝3通 → 月約65予約分）。ひとり店の月間予約数が 100〜150 件ならコミュニケーションプランでは**足りない**可能性が高く、ライトプラン5,000円または「リマインドは1通に絞る」等の運用判断が必要。

**テンプレ（草案）**

```
[JP] 予約確認
{{shop_name}}です。ご予約ありがとうございます。
日時：{{date}}（{{weekday}}）{{time}}〜
メニュー：{{menu}}（約{{duration}}分）
変更・キャンセルはこちら：{{cancel_url}}
（前日までにお願いします）

[EN] Booking confirmed
Thank you for booking with {{shop_name}}.
Date: {{date}} ({{weekday}}) {{time}}
Service: {{menu}} (approx. {{duration}} min)
Change or cancel: {{cancel_url}} (by the day before, please)

[JP] 前日リマインド
{{shop_name}}です。明日{{time}}〜のご予約をお待ちしております。
ご都合が変わった場合はこちらから：{{cancel_url}}
当日のご連絡はお電話（{{phone}}）でお願いします。

[EN] Reminder
Hi from {{shop_name}} — see you tomorrow at {{time}}.
Need to change plans? {{cancel_url}}
For same-day changes, please call {{phone}}.

[JP] キャンセル完了
{{date}} {{time}}〜のご予約をキャンセルしました。
またのご利用をお待ちしております。

[JP] オーナー都合の変更
{{shop_name}}です。大変申し訳ありません。{{reason}}のため、
{{date}} {{time}}〜のご予約をお受けできなくなりました。
再予約はこちら：{{rebook_url}}

[JP] オーナー向けプッシュ
新規予約：{{date}} {{time}} {{customer_name}}様（{{menu}}）
キャンセル：{{date}} {{time}} {{customer_name}}様 ※当日
明日の予定：{{count}}件（{{first_time}}〜{{last_time}}）
```

### Gaps
- SMS送信コスト（Twilio/Vonage/国内事業者の日本向け単価 2026）は未調査。
- LINE公式アカウントの公式料金ページ本文（lycbiz.com）は403で未取得。数字はligla/aurantの二次情報だが両者一致。
- Web Push の夜間配信に関するベストプラクティスの一次資料は検索上限で未確認。

---

## Q4. 顧客チャット（フェーズ2）: 自前チャット vs LINE vs Instagram

### Takeaway
ひとり美容師には **LINE公式アカウント＋Messaging API を「主チャネル」、自前チャット（Supabase Realtime＋Postgres）を「予約に紐づく軽量メッセージ」として併設**するのが現実的。Instagram Messaging API は自アカウント限定なら Standard Access でアプリ審査不要だが、24時間返信ウィンドウ等の制約があり、DMを**システムに取り込んで既読管理する用途**に限定するのがよい。自前チャット用のRealtime基盤はSupabase無料枠（2M msgs/月、ピーク200接続）で十分。

### Cited Findings

**自前チャット基盤の無料枠（2026年）**
- Supabase Free: Realtime 200万メッセージ/月、ピーク接続200。Pro/Team: 500万メッセージ（超過 $2.50/百万）、ピーク接続500（超過 $10/1,000） — [Supabase billing docs](https://supabase.com/docs/guides/platform/billing-on-supabase); [Realtime Peak Connections](https://supabase.com/docs/guides/platform/manage-your-usage/realtime-peak-connections)
- Supabase Realtime limits: Free 200同時接続・100 msg/秒、Pro 500同時接続・500 msg/秒 — [Supabase Realtime Limits](https://supabase.com/docs/guides/realtime/limits)
- Supabase Free 全体: DB 500MB、ファイル 1GB、帯域 5GB/月、MAU 50,000、無料プロジェクト2つ、7日間アクセスなしで一時停止 — [automationatlas free tier](https://automationatlas.io/answers/supabase-free-tier-limits-2026/); [jetadmin 2026 guide](https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/)（第三者情報）
- Ably Free: 200同時接続、500 msg/秒、600万メッセージ/月、日次上限なし。Standard $29/月 — [Ably vs Pusher pricing](https://ably.com/compare/ably-vs-pusher/pricing); [toolradar Ably](https://toolradar.com/tools/ably/pricing)
- Pusher Sandbox（無料）: 20万メッセージ/日、100同時接続。Startup $49/月 — [agentdeals Pusher](https://agentdeals.dev/vendor/pusher); [toolradar Pusher](https://toolradar.com/tools/pusher/pricing)
- Stream Chat: Build（無料）1,000 MAU・ピーク100接続・コミュニティサポート、次が Start $499/月 — [frontdeskreview Stream Chat](https://frontdeskreview.com/software/chat-api/stream-chat/); Maker Account: チーム5人未満・月商 $10k 未満なら無料、Chat 2,000 MAU/月、ハードリミット、カード不要、申請で30日トライアル→承認でMaker化 — [getstream.io pricing](https://getstream.io/pricing); [Stream Maker Account blog](https://getstream.io/blog/maker-account/)

**LINE（Messaging API）**
- 料金・通数カウント・Reply無料・2026年10月改定 — Q3参照（[LINE Developers 料金](https://developers.line.biz/ja/docs/messaging-api/pricing/), [lycbiz 2026-10-01](https://www.lycbiz.com/jp/news/line-official-account/20261001/)）
- LiME のように LINEミニアプリとしてサロン向け予約・カルテ・写真共有を提供する例がある — [LINEヤフー for Business LiME](https://www.lycbiz.com/jp/service/line-mini-app/package/lime)

**Instagram Messaging API**
- Standard Access は既定のアクセスレベルで、「自分のInstagramプロフェッショナルアカウント、または自分が管理するアカウントのみを扱うアプリ」なら Standard Access で足りる。他人のアカウントを扱うなら Advanced Access＝アプリ審査＋ビジネス認証が必要 — [Meta Instagram Platform overview](https://developers.facebook.com/docs/instagram-platform/overview); [Instagram-only API overview](https://developers.secure.facebook.com/docs/instagram/instagram-only-api/overview)
- アプリ審査の事前チェック: Facebookページがプロフェッショナルアカウントに接続されていること、Webhookを正しく処理しSend APIで送受信できること、独自受信箱なら Conversation API でスレッド取得できること — [Meta App Review for Instagram messaging](https://developers.facebook.com/docs/messenger-platform/instagram/app-review)
- 必要権限は `instagram_business_manage_messages`、Human Agent 機能。権限がないと messages エンドポイントが権限エラー — [Meta App Review](https://developers.facebook.com/documentation/business-messaging/instagram-messaging/app-review)
- 顧客の最終メッセージから24時間の標準返信ウィンドウ。Human Agent タグで7日に延長（人間の返信専用、プロモ不可）。7日経過後は顧客が再度送るまで送信不可 — [inro 24-hour window](https://www.inro.social/glossary/24-hour-messaging-window); [KeyCRM response timeframes](https://help.keycrm.app/en/communications-sms-email-instagram-telegram-viber-marketplace-chats-telephony/response-timeframes-on-facebook-and-instagram)
- ベンダー記事の「フォロワー1,000人以上が必要」はMeta公式で確認できず（未検証） — [Unipile](https://www.unipile.com/instagram-api-guide/)
- 一部ベンダーは「2026年4月27日以降Metaがupdateタグを拒否」と主張（単一情報源、要確認） — [inro](https://www.inro.social/glossary/24-hour-messaging-window)

### Inferences（推奨アプローチ）
- **推奨構成（ひとり美容師）**:
  1. **LINE公式アカウント**を顧客対応の主窓口にする（顧客側にアプリ導入不要、既読・通知・写真がネイティブ、Replyは無料）。予約完了画面とリマインドに友だち追加導線。Messaging API の Webhook で受信メッセージを自前DBの `messages` に**ミラー保存**し、管理PWAの統合受信箱から返信（Reply token は使用期限が短いので、遅延返信はPushになり通数を消費する点に注意）。
  2. **Instagram DM**は Standard Access で自アカウントの Webhook を受け、受信箱に取り込む＋「予約リンクを返す」定型返信に限定。24h/7日の制約があるため**リマインドやこちら起点の連絡には使わない**。
  3. **自前チャット（Supabase Realtime）**は「予約ページ内の軽いやり取り（"少し遅れます" "前回と同じで"）」用。アカウントがないため、認証は**予約トークン（キャンセルリンクと同じ署名付きトークン）**でスレッドにアクセスさせる。顧客側は匿名の Realtime Broadcast＋RLS付きの `messages` テーブル（サーバ経由INSERT）で十分。
- **スレッド単位**: `conversations` は **顧客単位（customer_id）を正**とし、各メッセージに任意で `booking_id` を付ける（予約ごとにスレッドが分かれると文脈が途切れる。逆に顧客単位なら「前回のやりとり」が見える）。アカウントなしの顧客が自前チャットを使う場合はトークンで予約→顧客を解決。
- **既読**: オーナー側 `read_at` のみ厳密に持つ（顧客側既読はLINE/IG側が持つ）。未読件数はダイジェストとバッジに使う。
- **新着プッシュ**: 顧客→オーナー: 即時PWAプッシュ（静音設定に従う）。オーナー→顧客: チャネルごとに（LINE Push／IG Send API／自前はSMS通知なしでページ内のみ）。
- **モデレーション／濫用**: ひとり店なので自動モデレーションは不要。レート制限（トークンあたり 20通/時）、本文長制限、添付は画像のみ・5MB以下、ブロックフラグ（`customers.blocked_at`）で受信拒否。
- **保持期間**: メッセージは**最終やりとりから2年**で本文削除（メタデータは統計用に保持）、画像は1年。LINE側の履歴はLINE側ポリシーに従うため自前ミラーの保持を明示。
- **Ably/Pusher/Stream**: ひとり店の規模では Supabase 無料枠で足りるため採用理由が薄い。Streamは UI SDK が魅力だが Build→Start が $499 の崖。Maker Account は月商$10k未満の条件を満たすかどうかが境界（美容室の月商はしばしば超える）。

```sql
-- Phase 2: messaging tables (sketch)
create table conversations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  channel text not null check (channel in ('inapp','line','instagram','sms')),
  external_thread_id text,                 -- LINE userId / IG conversation id
  last_message_at timestamptz,
  owner_unread_count int not null default 0,
  created_at timestamptz not null default now(),
  unique (customer_id, channel)
);
create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id),
  booking_id uuid references bookings(id),
  direction text not null check (direction in ('inbound','outbound')),
  body text,
  attachments jsonb not null default '[]',
  external_message_id text,
  sent_at timestamptz not null default now(),
  owner_read_at timestamptz,
  deleted_at timestamptz
);
create index on messages (conversation_id, sent_at desc);
```

### Gaps
- Instagram API with Instagram Login（Facebookページ不要の新方式）でのメッセージング要件は検索上限で未確認。上記 App Review ドキュメントは「Facebookページ接続」を前提にした旧来のMessenger Platform経由の記述。
- Supabase Realtime の Broadcast/Postgres Changes の推奨パターン（private channel の RLS認可）は未確認。
- Ably/Pusher/Stream の公式料金ページ本文は403で未取得。数値は比較サイト（2026年6月時点）由来。

---

## Q5. 電子カルテ（フェーズ3）: 項目・写真・検索・オフライン・エクスポート・法務

### Takeaway
国内サロン向けカルテ製品（美歴、LiME、顧客カルテ+POS、Salona、Lメンバーズカード）に共通する項目は「基本情報／来店履歴／施術内容／使用薬剤／写真／次回提案／同意書・問診」で、**項目を店ごとに自由設定できる**ことが売り。写真は**クライアント側で圧縮＋Canvas再エンコード（EXIF除去）**してから保存し、ストレージは Cloudflare R2（10GB無料・エグレス無料）が最有力、Supabase Storage（1GB無料・画像変換は無料枠外）は小規模なら許容。美容室は医療機関ではないので診療録の法定保存義務はないが、健康関連項目は要配慮個人情報として扱う。

### Cited Findings

**標準項目（製品から抽出）**
- 一般的なカルテ記載: 来店日、担当者、施術内容、使用薬剤、次回の来店目安・施術案。美歴（美容室・マツエク・ネイル向け電子カルテ） — [meetsmore 美歴](https://meetsmore.com/product-services/electronic-karte/media/167720)
- 美歴はサロンワークステーション／for Business／美歴の3製品で顧客情報・予約・会計を一元化、ホットペッパー（サロンボード）等の予約も一元管理 — [ASPIC 美歴](https://www.aspicjapan.org/asu/service/36431)
- 「顧客カルテ+POS&予約管理」: 施術内容、来店履歴、写真、同意書を顧客ごとに記録。カルテ項目は「基本項目（前回の入力値が自動で入る）」と「通常の項目」の2種類 — [mwm.ai 顧客カルテ+POS](https://mwm.ai/apps/pos/843977256)
- Salona: 施術記録、カルテ写真、手書きスケッチを顧客ごとに保存、デジタル問診票・同意書対応 — [ITreview Salona](https://www.itreview.jp/products/salona/profile)
- Lメンバーズカード（LINEミニアプリ）: 予約・チェックイン・会計をトリガーに来店ごとにカルテを自動生成、施術写真の添付対応、質問項目は店舗ごとに設計・回答形式6種類 — [PR TIMES](https://prtimes.jp/main/html/rd/p/000000129.000052385.html)
- LiME: 無料プランで予約表・写真付き顧客管理・当月売上レポート、電子カルテ・問診票の項目は自由設定、LINEでヘアスタイル写真・ヘアケアを共有、連携先に HOT PEPPER Beauty / minimo / Rakuten BEAUTY / Google — [it-trend LiME](https://it-trend.jp/reservation/23136); [imitsu LiME](https://saas.imitsu.jp/cate-crm/service/4634); [lycbiz LiME](https://www.lycbiz.com/jp/service/line-mini-app/package/lime)
- 顧客管理アプリの代表機能として「施術履歴・写真管理（過去の施術内容や画像を保存・確認）」「来店ごとの施術写真」「項目自由設定＋テキスト／手書きメモ」 — [imitsu 顧客管理](https://saas.imitsu.jp/cate-crm/article/l-2594)
- 低価格帯サロンでは時短優先でカルテを書かないことが多い — [internshipguide](https://internshipguide.jp/columns/agentView/990)
- 「放置時間」を独立項目として定めた標準様式は検索で見つからず（薬剤量・配合比と並んで記録されるのが通例と推測） — [検索結果](https://meetsmore.com/product-services/electronic-karte/media/167720)

**写真ストレージ（2026年無料枠）**
- Cloudflare R2 Standard 無料枠: ストレージ 10GB-月、Class A 100万リクエスト/月、Class B 1,000万/月。超過 $0.015/GB-月、Class A $4.50/百万、Class B $0.36/百万。**エグレス無料**。Infrequent Access には無料枠なし — [Cloudflare R2 pricing（公式）](https://developers.cloudflare.com/r2/pricing)
- Supabase Storage Free: 1GB（超過不可）、エグレス 5GB。画像変換（Image Transformations）は無料プランに含まれず、有料は「変換元画像1,000枚単位」で課金（変換回数ではなく元画像数） — [Supabase Storage pricing docs](https://supabase.com/docs/guides/storage/pricing); [Supabase Image Transformations usage](https://supabase.com/docs/guides/platform/manage-your-usage/storage-image-transformations)
- Vercel Blob Hobby: ストレージ 1GB/月、Blobデータ転送 10GB、Simple操作 1万／Advanced操作 2千、超過は課金されず上限で停止、Blobストア100個まで — [Vercel Blob usage and pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing)

**画像圧縮・EXIF**
- Canvasに描画してJPEGに再エンコードすると、ピクセルのみがデコードされ**EXIFブロックのない新規ファイル**になる — [orthogonal.info Canvas compression](https://orthogonal.info/how-browser-image-compression-actually-works-canvas-api-toblob-and-why-your-jpegs-shrink/)
- `browser-image-compression` は `preserveExif`（既定 false）と `exifOrientation` オプション、Web Worker対応 — [browser-image-compression docs](https://docsearch.algolia.com/mcp/docs/repo/donaldcwl/browser-image-compression)
- EXIF除去で orientation タグも消え、縦写真が横向きになる罠。`createImageBitmap` は既定でEXIF回転を無視するため `imageOrientation: 'from-image'` を渡す — [orthogonal.info EXIF](https://orthogonal.info/your-photos-are-broadcasting-your-home-address-how-exif-metadata-works-and-how-to-strip-it/); [freetoolonline](https://freetoolonline.com/guides/image-compression-and-exif-metadata-what-gets-stripped.html)
- compressorjs は orientation を読み取って回転補正してから描画、必要なら元EXIFを再挿入 — [openapps compressorjs](https://openapps.pro/packages/compressorjs)

**写真同意・肖像権** — Q2参照（[atsoho](https://atsoho.com/blog/salon-before-after-photo-shoot-cost), [マネーフォワード](https://biz.moneyforward.com/contract/basic/17759/)）。

**法務** — 要配慮個人情報（病歴）、第三者提供同意必須 — Q2参照。

### Inferences（設計案）

**フィールド定義（`karte_entries` ＝来店1回につき1件）**
| 区分 | 項目 | 型・備考 |
|---|---|---|
| 基本情報（customers側） | 氏名／かな／電話／生年月日（任意）／性別（任意）／髪質・太さ・量・くせ／頭皮状態／普段のスタイリング／職業・ライフスタイルメモ | 前回値を自動引き継ぎ（「基本項目」パターン） |
| 注意事項（customers側, sensitive） | かぶれ・しみた経験、パッチテスト結果と日付、妊娠・授乳中、皮膚疾患・通院中、禁忌薬剤 | `sensitive=true`、取得時同意、エクスポート除外可 |
| 来店（karte_entries） | 来店日時、担当、予約との紐付け、メニュー、料金、来店経路 | `booking_id` FK（walk-inはNULL） |
| 施術内容 | カット（長さ・レイヤー・前髪・バリカン番手）、カラー、パーマ、トリートメント、シェービング等の自由記述＋構造化タグ | `treatments jsonb[]` |
| 薬剤・配合 | 薬剤名、メーカー、レベル／色番、配合比（例: 6:4）、OX濃度、使用量(g)、**放置時間(min)**、加温有無、根元／中間／毛先の塗り分け | `chemicals jsonb` 配列で1剤ごと |
| 仕上がり | before / after 写真（複数）、スタイル名、使用スタイリング剤 | `karte_photos` |
| 次回提案 | 推奨来店間隔（週）、次回メニュー案、ホームケア提案 | `next_visit_weeks`, `next_proposal` |
| 内部メモ | 会話メモ、好み、NG（顧客に見せない） | `private_note` |

- **放置時間の入力UX**: 薬剤行ごとに「塗布開始」「放置開始」「流し」のタイムスタンプボタン（ワンタップ）→自動で分を算出。施術中に片手で押せるよう大きなボタン。
- **写真**: クライアントで `browser-image-compression`（長辺1600px、JPEG品質0.8、`preserveExif:false`）→ orientation 補正済みの Canvas 再エンコード → 署名付きURLでR2へ直接PUT。サムネは Workers で生成するか、アップロード時に2サイズ（1600/400）をクライアントで作る（Supabase無料枠の画像変換が使えない前提）。`karte_photos(kind: before|after|detail, taken_at, storage_key, width, height, sha256)`。容量試算: 1来店あたり2〜4枚×約300KB＝約1MB → 月150来店で 150MB/月、R2 10GBで約5年。
- **写真同意**: `photo_consents(customer_id, scope: karte_only|sns|ads, accepted_at, revoked_at)`。既定は **karte_only**（店内記録専用）。SNS掲載は別途チェックと撤回導線。顔が写らない構図を推奨するガイダンスをUIに。
- **検索・タイムライン**: 顧客詳細＝縦タイムライン（来店ごとのカード: 日付・メニュー・after写真サムネ・薬剤要約・次回提案）。検索は `customers` の氏名かな・電話末尾4桁、`karte_entries` の全文検索（Postgres `pg_trgm` or `tsvector` に日本語は弱いので、`chemicals` のタグとメニューを構造化してフィルタ）。
- **オフライン記録**: PWA＋IndexedDB にドラフトを保存し、オンライン復帰時に同期。競合はひとり運用なので「最後の保存が勝つ」で十分。写真は端末キューに置き、Wi-Fi復帰時にアップロード。
- **エクスポート／バックアップ**: 顧客単位の JSON＋写真ZIP、全体は日次で DB ダンプ＋R2バケットの別アカウント複製。「サービス終了時に全データを持ち出せる」ことをプライバシーポリシーに書く。
- **法務整理**: 美容室はカルテの法定保存義務なし（医師法24条の5年保存は医療機関のみ。本調査では一次資料未取得のため一般知識として記載）。健康関連項目は要配慮個人情報として**取得時同意＋目的限定＋第三者提供なし**。保存期間は Q2 の「最終来店から3年で匿名化」に合わせ、写真は本人の削除依頼で即時削除。

```sql
-- Phase 3: karte tables (sketch)
create table karte_entries (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  booking_id uuid references bookings(id),
  visited_at timestamptz not null,
  menu_summary text,
  treatments jsonb not null default '[]',   -- [{type:'cut', notes:'...', tags:[...]}]
  chemicals jsonb not null default '[]',    -- [{name, brand, level, ratio, ox, grams, process_min, heat}]
  next_visit_weeks int,
  next_proposal text,
  private_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create table karte_photos (
  id uuid primary key default gen_random_uuid(),
  karte_entry_id uuid not null references karte_entries(id),
  kind text not null check (kind in ('before','after','detail')),
  storage_key text not null,                -- r2 object key, exif-stripped
  width int, height int, bytes int, sha256 text,
  taken_at timestamptz,
  deleted_at timestamptz
);
create table customer_health_notes (        -- sensitive: 要配慮個人情報になりうる
  customer_id uuid primary key references customers(id),
  notes text,                                -- かぶれ・しみた経験、禁忌など
  patch_test_result text, patch_test_at date,
  consent_id uuid references consents(id),  -- 取得時同意を必須に
  updated_at timestamptz not null default now()
);
```

### Gaps
- Salon Board（ホットペッパー）自体のカルテ項目仕様、Kanzashi（かんざし）の情報は検索で得られず。
- 「放置時間」「配合比」の記録様式の一次資料（薬剤メーカーの施術記録シート等）は未調査。
- Supabase Storage のファイルサイズ上限（無料50MBという第三者情報）は公式未確認。
- 美容所に関する保存義務の有無（美容師法・条例）の一次資料は未確認。

---

## Q6. いま決めるべきデータモデル（フェーズ1）と後から足すもの

### Takeaway
フェーズ1で **`customers`（phone_e164 一意・ソフトデリート・マージ先参照）、`bookings`（customer_id FK・source・status 遷移・no_show）、`consents`、`audit_log`** を入れておけば、チャット（`conversations/messages`）とカルテ（`karte_entries/karte_photos/customer_health_notes`）は FK を足すだけで接続できる。予約を電話番号の文字列で持たず、必ず `customers` 行を作る（即時作成・匿名可）のが最重要。

### Cited Findings
- 電話番号正規化（E.164、libphonenumber-js） — Q2参照
- APPI: 消去努力義務・利用停止/消去請求・開示対応 — Q2参照（[J-Net21](https://j-net21.smrj.go.jp/law/20221223.html)）
- 要配慮個人情報は事前同意必須・オプトアウト不可 — [HRpro](https://www.hrpro.co.jp/series_detail.php?t_no=3773)
- バッファを所要時間に加算して空きを判定 — [Pabau](https://support.pabau.com/en/pabau2/how-to-set-up-and-use-buffer-time-between-bookings)

### Inferences（スキーマ草案）

```sql
-- Phase 1 core
create table customers (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text unique,                      -- '+819012345678'; NULL allowed for walk-in w/o phone
  phone_unverified boolean not null default false,
  name text not null,
  name_kana text,                              -- NFKC + hiragana normalized for search
  line_user_id text unique,                    -- phase 2
  instagram_user_id text unique,               -- phase 2
  no_show_count int not null default 0,
  late_cancel_count int not null default 0,
  booking_restriction text check (booking_restriction in ('none','phone_only','blocked')) default 'none',
  blocked_at timestamptz,
  merged_into_customer_id uuid references customers(id),
  last_visit_at timestamptz,
  anonymized_at timestamptz,                   -- retention policy applied
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  menu_id uuid not null references menus(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,                -- includes buffer_after
  status text not null check (status in
    ('confirmed','arrived','in_progress','completed','cancelled_by_customer',
     'cancelled_by_owner','cancelled_late','no_show')),
  source text not null check (source in ('web','phone','walk_in','instagram','line','manual')),
  cancel_token_hash text not null,             -- store hash, not raw token
  late_minutes int,
  cancel_reason text,
  owner_note text,
  consent_id uuid references consents(id),     -- policy accepted at booking time
  rescheduled_from_booking_id uuid references bookings(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
-- prevent double booking at DB level (needs btree_gist)
alter table bookings add constraint bookings_no_overlap
  exclude using gist (tstzrange(starts_at, ends_at) with &&)
  where (status in ('confirmed','arrived','in_progress') and deleted_at is null);

create table blocks (                          -- breaks, holidays, private time
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null, ends_at timestamptz not null,
  kind text not null check (kind in ('break','closed','private','holiday')),
  label text, created_at timestamptz not null default now(), deleted_at timestamptz
);

create table consents (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  kind text not null check (kind in ('booking_policy','privacy','health_notes','photo_karte','photo_sns','marketing')),
  policy_version text not null,
  accepted_at timestamptz not null default now(),
  revoked_at timestamptz,
  ip inet, user_agent text
);

create table audit_log (
  id bigserial primary key,
  actor text not null,                          -- 'owner' | 'customer:<booking_id>' | 'system'
  action text not null,                         -- 'booking.create', 'booking.cancel', 'customer.merge', 'karte.view', 'export', ...
  entity_type text not null, entity_id uuid,
  diff jsonb,                                   -- before/after (exclude sensitive columns)
  created_at timestamptz not null default now()
);

create table notification_log (
  id bigserial primary key,
  booking_id uuid references bookings(id),
  channel text not null check (channel in ('push','sms','line','email','instagram')),
  template text not null, scheduled_for timestamptz, sent_at timestamptz,
  status text not null, provider_message_id text, error text
);
```

- **ソフトデリートの方針**: `deleted_at` は「オーナーの誤操作からの復旧」用。APPIの消去請求には `anonymized_at` を立てて識別子（phone, name, kana, line/ig id, notes, photos）を**実際に消す**（ソフトデリートで残すのは不可）。統計用に `bookings` の日時・メニュー・ステータスのみ保持。
- **キャンセルトークン**: DBにはハッシュのみ。リンクは `/b/{booking_id}?t={token}`。トークンに有効期限（予約終了時刻＋24h）。
- **後から足すもの**: フェーズ2＝`conversations/messages`（Q4）、`customers.line_user_id/instagram_user_id` は今から NULL 列で用意。フェーズ3＝`karte_entries/karte_photos/customer_health_notes`（Q5）と `consents.kind` の拡張、`audit_log` に `karte.view` を記録（閲覧ログは安全管理措置の説明材料）。
- **保持ジョブ**: 日次クーロンで `last_visit_at < now() - interval '3 years'` かつ未来予約なしの顧客を匿名化、`messages.body` は2年、`karte_photos` は匿名化と同時に削除。

### Gaps
- Supabase（想定DB）での `btree_gist` 拡張の可用性は未確認（一般には利用可能）。
- RLS設計（顧客はトークン経由でAPI越しにのみアクセス、オーナーは認証済み）は本調査の範囲外。

---

## Q7. オーナーが価値を感じるアナリティクス（KPIとプライバシー配慮型ツール）

### Takeaway
業務KPI（週次予約数・再来率・無断キャンセル率・メニュー構成・平均客単価・空き枠率）は**自前DBからSQLで出す**のが最も正確で、Webアクセス解析は Vercel Web Analytics（Hobby 月5万イベント無料）か Umami Cloud（Hobby無料）で十分。Plausibleは無料枠なし（約$9/月〜、セルフホストは無料）。

### Cited Findings
- Vercel Web Analytics Hobby: 月50,000イベント込み、超過課金なし（上限超過で3日間の猶予後に収集停止、最大7日待ち）、レポート期間1か月、カスタムイベントはPro — [Vercel Analytics limits and pricing](https://vercel.com/docs/analytics/limits-and-pricing); [Vercel Hobby plan](https://vercel.com/docs/plans/hobby)
- Plausible: 無料プランなし（30日トライアル）、Starter ≈ $9/月で月1万PVまで、セルフホスト無料。上位プラン価格は情報源間で不一致（Growth $14〜19、Business $19〜39） — [seline Plausible pricing](https://seline.com/blog/plausible-analytics-pricing); [toolradar Plausible](https://toolradar.com/tools/plausible)
- Umami Cloud: Hobby プランは完全無料（公式FAQ）。上限は情報源で不一致（10Kイベント／100Kイベント・1〜3サイト・6か月保持）。各PV＝1イベント、保存するイベントデータの各プロパティも1イベントとして計上 — [Umami Cloud FAQ](https://docs.umami.is/docs/cloud/faq); [cloudzy Umami review](https://cloudzy.com/blog/umami-review/); [comparetiers Umami](https://comparetiers.com/tools/umami)
- 美容室の年間利用回数は減少傾向で、予約の取りこぼしが起きやすい背景 — [like.salon](https://www.like.salon/column/yoyaku-reminder-cancel-taisaku/)

### Inferences（KPI定義案・SQLで算出）
- **週次予約数／売上見込み**: `bookings` を `starts_at` 週で集計、`status in (completed)` を実績、`confirmed` を見込みに。
- **再来率**: 初回来店月のコホートで「90日以内に2回目来店した割合」。`customers.last_visit_at` と `karte_entries/bookings(completed)` から算出。
- **無断キャンセル率**: `no_show / (completed + no_show + cancelled_late)`。`cancelled_by_customer`（前日まで）は分母から除くか別指標に。
- **メニュー構成**: `menu_id` 別の件数・売上比。カラー比率の変化は薬剤在庫にも効く。
- **空き枠率**: 営業時間（`weekly_schedule - blocks`）に対する `bookings` 占有分の比率を日別で。
- **経路別**: `source` 別の件数と無断キャンセル率（Instagram経由が高ければDM運用を見直す根拠になる）。
- **Web解析**: 予約フローのファネル（メニュー選択→日時→入力→完了）は、Vercel Hobbyではカスタムイベント不可なので**ページ遷移で代替**（各ステップを別URLにする）。Umami Cloud はカスタムイベントが無料枠内で使える可能性があるが上限が不確か。個人を識別しないため同意バナーは不要というのが両ツールの主張（法的評価は別途）。
- **ダッシュボード**: 管理PWAの「今週」カード（予約数・売上見込み・空き枠・未読・直近の無断キャンセル）＋月次ページ。グラフは最小限（週次棒グラフ、メニュー構成円グラフ）。

### Gaps
- 美容室のリピート率・来店頻度のベンチマーク（HBA美容センサス等）は検索上限で未確認。
- Umami Cloud Hobby の正確な上限（イベント数・サイト数・保持期間）は公式ページ未取得で確定できず。

---

## 付録: 参照URL一覧（本ノートで引用したもの）

- キャンセルポリシー: https://tol-app.jp/columns/915 / https://stores.fun/magazine/articles/beauty-salon-cancellation-fee / https://service.kalonade.com/blog/salon-last-minute-cancellation-policy-template / https://www.freee.co.jp/kb/kb-reservation-management/cancellation-policy/ / https://www.jicoo.com/magazine/blog/reservation-no-show-cancellation-policy-template / https://squareup.com/jp/ja/townsquare/how-to-deal-with-no-shows / https://jobvr.co.jp/beauty-salon-cancel/ / https://assist-all.co.jp/salon_reserve/column/20250809-7545/
- 無断キャンセル対策・リマインド: https://www.b-merit.jp/magazine/noshow/ / https://kaigyo.beautygarage.jp/archives/15906 / https://www.miyabi-ai.jp/articles/beauty-salon-cancel / https://aurant-technologies.com/blog/line-official-account-for-beauty-salon/ / https://linestep.jp/?p=25200 / https://squareup.com/jp/ja/townsquare/what-is-a-reminder-email / https://ligla.jp/blog/delivery/reminder/
- バッファ・二重予約: https://help.sesami.co/ja/yu-yue/availability/buffer-times / https://support.pabau.com/en/pabau2/how-to-set-up-and-use-buffer-time-between-bookings / https://squareup.com/jp/ja/townsquare/how-to-introduce-reservation-system
- 祝日: https://classic.yarnpkg.com/en/package/@holiday-jp/holiday_jp / https://cdn.jsdelivr.net/npm/holiday-jp-dayjs@0.1.2/README.md / https://cdn.jsdelivr.net/npm/holidays-jp@2.0.61/README.md / https://zenn.dev/c_hero/articles/99b90e4205e54b / https://pypi.org/project/python-shukujitsu/
- 電話番号: https://docsearch.algolia.com/mcp/docs/repo/catamphetamine/libphonenumber-js / https://phone-check.app/blog/e164-phone-number-format-international-normalization-validation
- 個人情報保護法: https://j-net21.smrj.go.jp/law/20221223.html / https://www.businesslawyers.jp/practices/617 / https://www.businesslawyers.jp/practices/271 / https://www.businesslawyers.jp/practices/287 / https://keiyaku-watch.jp/media/hourei/youhairyokojinjyoho/ / https://www.ppc.go.jp/personalinfo/legal/guidelines_tsusoku/ / https://www.ppc.go.jp/all_faq_index/faq4-q011/ / https://www.wic-net.com/material/static/00018329/00018329.pdf / https://www.mhlw.go.jp/content/10904750/000863621.pdf / https://www.hrpro.co.jp/series_detail.php?t_no=3773
- 写真同意: https://atsoho.com/blog/salon-before-after-photo-shoot-cost / https://biz.moneyforward.com/contract/basic/17759/ / https://0120.co.jp/blog/video-87/
- LINE: https://developers.line.biz/ja/docs/messaging-api/pricing/ / https://developers.line.biz/ja/tips/2026/05/28/how-to-count-messages/ / https://www.lycbiz.com/jp/news/line-official-account/20261001/ / https://ligla.jp/blog/line-official/plan/ / https://aurant-technologies.com/blog/line-official-pricing-plan-2026/
- Instagram: https://developers.facebook.com/docs/instagram-platform/overview / https://developers.secure.facebook.com/docs/instagram/instagram-only-api/overview / https://developers.facebook.com/docs/messenger-platform/instagram/app-review / https://www.inro.social/glossary/24-hour-messaging-window
- Realtime/Chat: https://supabase.com/docs/guides/platform/billing-on-supabase / https://supabase.com/docs/guides/realtime/limits / https://ably.com/compare/ably-vs-pusher/pricing / https://toolradar.com/tools/pusher/pricing / https://getstream.io/pricing / https://getstream.io/blog/maker-account/
- Storage: https://developers.cloudflare.com/r2/pricing / https://supabase.com/docs/guides/storage/pricing / https://vercel.com/docs/vercel-blob/usage-and-pricing
- 画像: https://orthogonal.info/how-browser-image-compression-actually-works-canvas-api-toblob-and-why-your-jpegs-shrink/ / https://docsearch.algolia.com/mcp/docs/repo/donaldcwl/browser-image-compression
- カルテ製品: https://meetsmore.com/product-services/electronic-karte/media/167720 / https://www.aspicjapan.org/asu/service/36431 / https://mwm.ai/apps/pos/843977256 / https://www.itreview.jp/products/salona/profile / https://prtimes.jp/main/html/rd/p/000000129.000052385.html / https://it-trend.jp/reservation/23136 / https://www.lycbiz.com/jp/service/line-mini-app/package/lime
- アナリティクス: https://vercel.com/docs/analytics/limits-and-pricing / https://seline.com/blog/plausible-analytics-pricing / https://docs.umami.is/docs/cloud/faq
