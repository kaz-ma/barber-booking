# 02. オンライン予約フローのUI/UXベストプラクティス（モバイル・JP/EN・一人営業バーバー向け）

調査日: 2026-10-10
対象プロジェクト前提: モバイルファースト、JP/EN二言語、段階開示型フォーム（メニュー9種 → 氏名+ふりがな → 職業(学生/社会人) → 電話 → 備考）→ Hot Pepper Beauty型の空き枠カレンダー（30分刻み、18:00–24:00、全メニュー60分）→ 即時確定 → 完了画面 → キャンセルリンク。決済なし・メールなし。

調査方法メモ: 本環境では任意ホストへの直接フェッチ（curl）がネットワークポリシーで拒否（CONNECT 403）されたため、各一次ソースは検索結果に含まれる本文抜粋ベースで確認した。抜粋で裏取りできなかった数値・詳細は「Gaps」に明記している。

---

## KQ1. 段階開示 / ステップ式フォーム（accordion・one thing per page・会話型）: 単一ページより優位な条件、進捗表示、戻って編集、キーボード/inputmode、バリデーションタイミング、エラー文

### Takeaway
「1画面1問」はGOV.UKが既定の出発点とする実証済みパターンで、低確信ユーザー・モバイル・エラー処理・分岐に強い。一方Baymardは「形式（1ページ/accordion/複数ページ）より、何をどう聞くかの方が重要」と結論づけており、本件の5項目程度の短いフォームでは、段階開示は「迷わせない・一度に1つの判断」を担保する手段として使い、完了済み項目は要約として残し、いつでも戻って編集できる設計にするのが要点。バリデーションは「フィールド離脱後（blur）に初めて表示、修正したら即消す」が各機関で一致している。

### Cited Findings

**段階開示・one thing per page の根拠**
- GOV.UK Design System「Question pages」: 1ページ1問にすると「ユーザーが何を求められているか理解し、その問いと回答に集中できる」。legend/labelをページ見出しにしてスクリーンリーダー利用者が内容を一度だけ聞くようにする。Question pageには「back link・ページ見出し・continueボタン」が必須、進捗インジケータは「ユーザーリサーチで必要と分かった場合のみ」任意。「すべての質問について、なぜ聞くのかを把握し、本当に必要な情報だけ求める」 — [GOV.UK Design System: Question pages](https://design-system.service.gov.uk/patterns/question-pages/)
- GOV.UK Service Manual「Form structure」: まず「one thing per page」（1ページに1つの情報・判断・質問）から始め、ユーザーリサーチの結果でページを統合できる場合に統合する — [GOV.UK Service Manual: Form structure](https://www.gov.uk/service-manual/design/form-structure)
- GDS Design Notes (2015)「One thing per page」: 質問を別ページに分割する理由として、自信の低いユーザーにとって使いやすい、モバイルに適している、「エラー・分岐・ループ・進捗保存の扱いが容易」を挙げている — [GDS Design Notes: One thing per page](https://designnotes.blog.gov.uk/2015/07/03/one-thing-per-page/)
- MoJ（英法務省）デザインパターン「Multiple questions per page」はアーカイブ扱いで、「まず1ページ1問のガイダンスに従う」ことを求めている（複数問同居はリサーチで裏付けがある場合のみ） — [MoJ Design Patterns archive: question pages](https://design-patterns.service.justice.gov.uk/archive/question-pages)
- NN/g「Progressive Disclosure」: 段階開示は、初期表示を最重要の機能に絞り、必要になったときに追加情報を見せることで学習しやすさと誤り低減を両立させる手法として定義されている — [NN/g: Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)

**accordion / 複数ステップ / 1ページ の比較（Baymard）**
- Baymard: accordion型チェックアウトはベンチマークで従来型より「19.2%高い」ユーザビリティスコア。ただしベンチマーク内14サイトのaccordion型は最上位から最下位まで分布しており、形式自体がユーザビリティを保証しない — [Baymard: Accordion-Style Checkout](https://baymard.com/blog/accordion-style-checkout)
- Baymard: ユーザーはaccordionを「要約付きの複数ステップ」として扱う。accordionは独立した確認ステップを欠きがちなので、完了したステップは要約（サマリー）に折りたたんで表示することを推奨。単一URL実装ではブラウザの「戻る」でカートまで戻されてしまう問題がある — [Baymard: Accordion checkout usability](https://baymard.com/blog/accordion-checkout-usability)
- Baymard「One-page checkout」: ユーザーは「いくつかの簡単なガイドラインを守る限り」複数ステップ間の移動で問題をほとんど起こさなかった。1ページ型が複数ステップ型を大きく上回るA/Bテストも存在するが、「最適化されていない複数ステップ型と新規に最適化した1ページ型」の比較であることが多い。結論は「1ページ/accordion/複数ページのどれかより、顧客に何をどう求めるかの方が重要」 — [Baymard: One-page checkout](https://baymard.com/blog/one-page-checkout)
- A List Apart「Testing Accordion Forms」（Luke Wroblewski によるaccordionフォームの比較テスト）が参考文献として存在する（本文の数値は今回の抜粋では確認できず） — [A List Apart: Testing Accordion Forms](https://alistapart.com/article/testing-accordion-forms/)

**会話型（1問ずつ）フォームの完了率（ベンダー由来・要注意）**
- Typeform 2024 Data Report（260万フォーム/5.68億件）を引用した記事: 1問ずつ形式の平均完了率47.3%、業界平均21.5%。ただし母集団が異なる比較で、Typeformは当該製品のベンダー — [TinyCommand: Conversational vs Traditional Forms](https://tinycommand.com/blogs/conversational-forms-vs-traditional-forms-which-is-better-for-your-business)
- 同種のベンダー記事群: 「5項目未満の短いフォームでは従来型が同等かそれ以上」「ユーザーが事前に全体像を見たい場合は従来型の方が離脱が少ない」という留保が複数で述べられている — [SureForms](https://sureforms.com/wordpress-tutorials/conversational-forms-vs-traditional-forms/); [Jotform](https://www.jotform.com/blog/conversational-form-design/)
- 「マルチステップは単一ページより完了率25.4%高い（65万件超の送信分析）」というベンダー分析が引用されているが、一次ソースへのリンクが確認できず — [FormFlux](https://formflux.io/blog/form-completion-rates-guide)

**進捗表示・戻る導線（NN/g等）**
- NN/g「Wizards」: 各ステップにラベルを付け現在地を明示する（複雑なプロセスでは特に）。完了済みステップを可視化しないと「余分な記憶・判断負荷」になる。明示的な「戻る」リンクまたはクリック可能な進捗バーで、入力を失わずに戻れるようにする。「Next/Previous」のような汎用ラベルは情報の手がかり（information scent）が弱く、次ステップ名を示すラベルが望ましい — [NN/g: Wizards](https://www.nngroup.com/articles/wizards/)
- NN/g「User Control and Freedom」（ヒューリスティック#3）: ユーザーが誤操作から抜け出せる「非常口」（戻る・取り消し）を常に用意する — [NN/g: User Control and Freedom](https://www.nngroup.com/articles/user-control-and-freedom/)
- Carbon Design System: 進捗インジケータは左→右、複数ステップがあることを示し、「前のステップに戻って入力を確認できる」ようにする。ラベルは1〜2語 — [Carbon: Progress indicator](https://v9.carbondesignsystem.com/components/progress-indicator/usage)
- Visa Design System「Wizard」: 長いフォームを「ステッパー＋フォーム部品＋ナビボタン」で短い段階に分割、ステッパーで現在地と残りを示す — [Visa Design: Wizard usage](https://design.visa.com/patterns/wizard/usage/)
- GOV.UK「Check answers」パターン: 送信前に全回答を一覧化し、各行から該当質問ページへ戻って修正できる — [GOV.UK: Check answers](https://design-system.service.gov.uk/patterns/check-answers/)

**バリデーションのタイミング**
- NN/g「10 Design Guidelines for Reporting Errors in Forms」: 可能ならインライン検証、ただし「ユーザーがそのフィールドを終えて次に移るまでエラーを表示しない」。エラーは該当フィールドの横に置き、サマリーのみに頼らない。色だけに頼らない。何が問題でどう直すかを書き、ユーザーを責めない。入力内容を保持する。同じエラーが1回の試行で3回以上出るならUIかメッセージの欠陥 — [NN/g: Errors in Forms](https://www.nngroup.com/articles/errors-forms-design-guidelines/)
- NN/g「Indicators, Validations, and Notifications」: リアルタイム検証が有効なのは、パスワード要件チェックリストのように即時フィードバックが利益になる場合に限る — [NN/g: Indicators, Validations, Notifications](https://www.nngroup.com/articles/indicators-validations-notifications/)
- Baymard「Inline Form Validation」: 早すぎる（premature）検証を避ける、修正されたらエラーを消す、「肯定的インライン検証（入力OKを示す）」を使う。ECベンチマークの32%のサイトはフィールド検証をまったく提供していない — [Baymard: Inline Form Validation](https://baymard.com/blog/inline-form-validation)
- A List Apart「Inline Validation in Web Forms」（Luke Wroblewski の実験）: 最良のインライン検証バリアントで「エラー22%減、完了時間42%減」、満足度も向上 — [A List Apart: Inline Validation in Web Forms](https://alistapart.com/article/inline-validation-in-web-forms/)
- 反証: UX Movement は参加者77名/90名の2研究を引き、「無効なフィールドを離れた直後にメッセージを出す即時検証」でユーザーの誤りが有意に増えたと主張（入力モードから修正モードへの切替が原因と説明） — [UX Movement: Why users make more errors with instant inline validation](https://uxmovement.medium.com/why-users-make-more-errors-with-instant-inline-validation-945aaf4c370a)

**エラー文の書き方（GOV.UK）**
- GOV.UK「Error message」: 何が起きたか・どう直すかを書く。「This field is required」「An error occurred」のような汎用文は禁止。空欄は「Enter your name」のような指示文、長すぎは「Name must be 35 characters or less」のような説明文。各メッセージに視覚的には隠した「Error:」接頭辞を付けスクリーンリーダーに読ませる。エラー時は「エラーサマリー＋各回答横のエラーメッセージ」の両方を必ず表示 — [GOV.UK: Error message](https://design-system.service.gov.uk/components/error-message/); [GOV.UK: Error summary](https://design-system.service.gov.uk/components/error-summary/)
- NN/g「Error Messages Scoring Rubric」: 可視性・コミュニケーション・効率の3軸12ガイドラインでエラー文を採点 — [NN/g: Error Messages Scoring Rubric](https://www.nngroup.com/articles/error-messages-scoring-rubric/)
- NN/g「Hostile Patterns in Error Messages」: ユーザーを責める／曖昧／専門用語のみ等の「敵対的パターン」を避ける — [NN/g: Hostile Error Messages](https://www.nngroup.com/articles/hostile-error-messages/)

**キーボード・inputmode（本KQでは概要、詳細はKQ3）**
- Baymard: モバイルでユーザーはフィールド間移動に苦労し、キーボードの「次へ/前へ」はほとんど使われず画面上のフィールドをタップする — [Baymard: Mobile checkout & form usability](https://baymard.com/blog/mobile-ecommerce-checkout-forms)
- Clearleft/Adactio: `type="text"` + `inputmode="numeric"` で数字キーパッドを出しつつ他文字も許容できる。`pattern="[0-9]*"` との併用で数字のみ。`enterkeyhint` はEnterキーのラベルだけを変える — [Clearleft: Three attributes for better web forms](https://clearleft.com/thinking/three-attributes-for-better-web-forms)

### Inferences
- 本件は入力項目が5グループ（メニュー、氏名+ふりがな、職業、電話、備考）と少ないため、「1ページ1問の完全分割（URL遷移）」より、要件どおり「同一ページ内で前項目の完了後に次項目を開示するaccordion的な段階開示」が妥当。ただしBaymardの指摘どおり、(a) 完了した項目は要約表示（例: 「カット ¥x / 60分」「山田 太郎（やまだ たろう）」）に畳んでタップで再編集可能、(b) ブラウザ「戻る」でフォーム全体を失わない（history.state等での段階管理、またはページ分割時は各段階を独立URLに）、を満たすこと。
- 進捗表示は、GOV.UKの「リサーチで必要と分かった場合のみ」とNN/gの「現在地と残りを示す」の折衷として、「1. メニュー → 2. お客様情報 → 3. 日時 → 4. 確認」程度の粗いステッパー（4段）を上部に置くのが安全。細かい項目単位（メニュー/氏名/ふりがな/職業/電話/備考）の進捗は数が変動する印象を与えるので出さない。
- バリデーションは「blur後にエラー表示、修正で即消去、送信時にサマリー＋該当箇所」の三層。電話番号など形式が確定するフィールドは入力完了（blur）後、メニュー等の選択肢は未選択のまま次に進もうとしたときのみ。段階開示では「次の項目が開かない＝エラーがある」ことが伝わりにくいので、エラーはフィールド直下に必ずテキストで出す。
- 二言語のエラー文は GOV.UK流の「指示文（Enter your phone number / 電話番号を入力してください）」＋「例（例: 09012345678）」で統一し、「必須です」単独は避ける。

### Gaps
- NN/gの進捗インジケータに関する定量データ（完了率への影響）は見つからなかった。
- 会話型・マルチステップの優位性を示す査読済み／中立の比較研究は見つからず、数値はすべてベンダー由来。
- A List Apart「Testing Accordion Forms」の具体的な結果数値は抜粋で確認できなかった。
- 「段階開示（同一ページ内で項目を順次表示）」そのものを単一ページ・複数ページと比較した測定データは見つからなかった。

---

## KQ2. カレンダー／時間枠ピッカー: 週ストリップ vs 月グリッド、Hot Pepper Beauty等の○/×/△、「空きのみ表示」、タイムゾーン、「今日」、リードタイム締切、所要時間表示

### Takeaway
Hot Pepper Beauty（HPB）は「メニュー選択 → 日付×時間の◎/×グリッド → 情報入力 → 確認」で、◎は「施術開始可能時刻」を意味し、当日予約は「30分後から選択可」という締切を持つ。Calendly/Cal.comは月表示＋選択日の枠リスト（Cal.comは週/カラム表示も選択可）で、「予約可能な枠だけを見せる」ことが共通原則。対面サービスではタイムゾーンを店舗に固定しつつ表示する（Calendly推奨）。Smashing Magazine は「1日付2タップ・時間枠込み5タップ」の予算と、空き/価格の視覚コーディングを提案している。

### Cited Findings

**Hot Pepper Beauty の実際のフロー・記号**
- HPBのネット予約手順: サロンページの「空席確認・予約する」→ メニュー/クーポン選択（「+メニューを追加して予約」で追加可）→ カレンダーで日付・時間帯の空き確認 → お客様情報入力 → 確認画面で確定 — [Infinity Mobius: ホットペッパービューティーとは](https://infinity-mobius.com/news/13713/)
- HPB掲載サロンのブログ（予約方法案内, 2026-01-21）: 「×」は満席、「◎」が予約可能な枠。「◎が付いている所なら何時からでもとれます！◎はスタート時間です！」（◎＝施術開始可能時刻を示す） — [マツゲノオメカシ ブログ（HPB）](https://beauty.hotpepper.jp/kr/slnH000558285/blog/bidA108567890.html)
- HPB掲載サロンのブログ「ネット予約の間違った取り方」(2018): 30分刻みの◎が施術時間分の連続した空きを意味しないケースがあり、施術時間が枠内に収まるかの確認が必要という注意喚起 — [アイコニックナゴヤ ブログ（HPB）](https://beauty.hotpepper.jp/slnH000263848/blog/bidA019690176.html)
- 当日予約の扱い: 「ホットペッパーでは30分後に予約欄の選択が可能になります」（＝最短リードタイム30分） — [and-us: 当日の即時予約](https://and-us.jp/5606/)
- HPBは「即時予約」（確定が即時）の特集ページと「今日と明日行けるサロン」特集を持つ — [HPB: ネットで即時予約できるサロン](https://beauty.hotpepper.jp/doc/special/sokujiyoyaku/); [HPB: 今日と明日行けるサロン](https://beauty.hotpepper.jp/doc/special/today/)
- HPBの予約変更・キャンセル操作、返還ルール、電話/LINE対応を解説したガイド（2025-07） — [assist-all: HPB予約変更・キャンセル完全ガイド](https://assist-all.co.jp/salon_reserve/column/20250703-6416/)

**日本の○△×記号の慣習（公共施設予約システムの凡例）**
- 三木市（兵庫）施設予約システム手引き: ○＝予約率50%未満、△＝50%以上100%未満、×＝満杯、◎＝抽選申込期間、－＝休館日/受付期間外 — [三木市 施設予約システム利用の手引き(PDF)](https://www.city.miki.lg.jp/uploaded/attachment/36382.pdf)
- 大津市の施設予約マニュアルでは×を受付期間外にも使うなど、記号の意味はシステムごとに異なる — [大津市 予約システムマニュアル(PDF)](https://www.city.otsu.lg.jp/material/files/group/110/manyupc.pdf)
- 教育系予約システムの利用ガイド: 日付ごとに色分け（空き多＝緑、半分未満＝オレンジ、「満員」「休」表示）。「日付をクリック → その日の予約可能な開始時間帯が一覧 → 入力フォーム」の2段構成 — [PLEX 予約システム利用ガイド(PDF)](https://plex.g-asuka.co.jp/wp-content/themes/kids-education-child/reservation-system-user-guide.pdf)
- STORES予約の公式ドキュメントで◎○△×の定義は見つからなかった（店舗側で凡例を確認する必要がある）。STORES予約の顧客向け操作マニュアルは存在 — [STORES予約 顧客向けマニュアル(PDF)](https://www.art-school.co.jp/cms/wp-content/uploads/2025/09/STORESmanual_browser.pdf)

**空き枠だけを見せる・月/週表示（Calendly, Cal.com, 他）**
- Calendly: 予約ページは「月単位表示のみで、週表示はない」（Community Manager回答, 2025-03）。一方2020年の公式ブログでは「7日間の“circle view”から月表示へ移行」と説明 — [Calendly Community: month vs weekly view](https://community.calendly.com/how-do-i-40/change-booking-page-view-from-month-to-weekly-view-embed-calendly-in-lightspeed-3564); [Calendly Blog: new scheduling page UI](https://calendly.com/blog/new-scheduling-page-ui)
- Calendly タイムゾーン: 招待者のタイムゾーンを自動検出しローカル時刻で表示、ページ上のドロップダウンで切替可。イベントタイプ単位でタイムゾーンを固定（lock）でき、「対面イベントでは固定を推奨」 — [Calendly Help: Time zones overview](https://calendly.com/help/time-zones-overview)
- Cal.com: Booker は MONTH_VIEW / WEEK_VIEW / COLUMN_VIEW の3レイアウト。週・カラム表示には他カレンダーを重ねる Overlay 機能。管理者が1つまたは複数を有効化し、複数なら予約者が切替可能 — [Cal.com Blog: multiple booking layouts](https://cal.com/blog/enhanced-flexibility-take-advantage-of-cal-com-s-multiple-booking-layouts); [Cal.com Docs: Booker atom](https://cal.com/docs/atoms/booker)
- Cal.com: Bookerは「最後に選択したタイムゾーンをlocalStorageに記憶」、`timezone` propで初期値指定可。タイムゾーン固定イベントではセレクタを非表示 — [Cal.com Docs: Booker atom](https://cal.com/docs/atoms/booker)
- Cal.com 最短通知（minimum notice）: 設定した時間内に開始する枠を非表示にする（例: 120分） — [Cal.com Docs: Minimum notice](https://cal.com/docs/core-features/event-types/minimum-notice)
- Octopus Pro: 最短通知ウィンドウ内に開始する枠は「非表示」にし、ウィンドウ経過後の枠だけを見せる — [Octopus Pro: Minimum notice time](https://help.octopuspro.com/customer-portal-notice-time)
- Dubsado: 「通知（notice）」は予約開始までの猶予、「バッファ」は各予約の前後の空き時間で、別設定 — [Dubsado: Scheduler intervals and buffers](https://help.dubsado.com/en/articles/15546572-scheduler-intervals-and-buffers)
- Convert Labs: Heads Up Time を24時間にすると当日予約不可、の例（最短通知＝当日予約スイッチとして機能） — [Convert Labs: Heads Up Time](https://help.convertlabs.io/en/settings/heads-up-time)
- SaaSUI: 予約ページは「所有者の全カレンダーを隠し、予約可能な枠だけを露出」し、数タップで自己完結できることが要点 — [SaaSUI: Calendar scheduling UX patterns](https://www.saasui.design/blog/saas-calendar-scheduling-ux-patterns)
- Jicoo: 予約カレンダーは月次・週次・カレンダー型などの表示バリエーションを持つ — [Jicoo: 予約システムのカレンダー](https://www.jicoo.com/magazine/blog/booking-system-calendar)

**Smashing Magazine の日時ピッカー設計指針**
- 「Designing The Perfect Date And Time Picker」(2017): タップ予算の目安＝単一日付2タップ、期間3タップ、時間枠込み5タップ。予約用途では「先に時間を聞き、該当枠のない日を隠すフィルタ」にする案。時間選択は複数候補を同時に選べる方がよい。カレンダー内で空き/非空きを分離し、色やドットで空きや価格段階を示す。Treatwell.nl は日付を横スワイプしつつ、横並びの時間枠（価格付き）が更新される。Booking.com は今日を既定にし過去日をブロック — [Smashing: Designing the perfect date and time picker](https://www.smashingmagazine.com/2017/07/designing-perfect-date-time-picker/)
- 「Designing Birthday Picker UX」(2021): 誕生日にはカレンダーでなく3つのラベル付きフィールド、任意の日付を既定にしない（＝用途に応じてピッカーを使い分ける） — [Smashing: Birthday picker](https://www.smashingmagazine.com/2021/05/frustrating-design-patterns-birthday-picker/)

### Inferences
- 本件（1人営業・18:00–24:00・30分刻み・全60分）は1日あたり最大12枠（18:00〜23:30開始、ただし24:00終業なら最終開始23:00で11枠）しかないため、**「週ストリップ（横スクロール7日）＋選択日の時間枠ボタン縦リスト」**がモバイルでは最も少タップ（日1タップ＋時間1タップ＝Smashingの5タップ予算内）。月グリッドは「空きのある日を探す」用途に二次的に用意すれば足りる。
- HPB利用者の慣れを活かすなら、日付×時間の◎/×グリッド（横＝日付、縦＝時刻）も有力。ただし60分固定なら「◎の連続性問題」（HPBサロンブログの注意点）は発生しない＝◎＝「この時刻から60分確保可能」を保証できることが差別化点。凡例（◎=予約できます / ×=予約できません）を必ずグリッド直上に置く。
- 「空きのみ表示」の実装: 最短リードタイム（例: 開始30〜60分前で締切、HPB同様の30分も可）を過ぎた枠・既予約枠は「非表示」か「×で表示」のどちらかに統一。全枠×の日は日付自体をグレーアウト＋「満席」ラベル。
- タイムゾーン: 対面サービスなのでCalendly推奨どおり店舗TZ（Asia/Tokyo, JST/UTC+9）に固定し、EN表示では各時刻の近くに「JST」を明示。海外ユーザー向けに端末TZへの変換はしない（混乱を招く）。
- 「今日」: 当日分は、締切を過ぎた枠を除いて表示。週ストリップ初期位置は今日、過去日は非活性。
- 24:00表記: 日本の営業時間表記では「24:00」が一般的だが、英語話者には「0:00/12 AM」の方が自然。時間枠は「23:00–24:00」の形で開始・終了を併記し、所要時間「60 min」をメニュー要約と枠選択画面の両方に出す（根拠はSmashingの「所要/価格をカレンダー内に併記」指針に基づく推定）。

### Gaps
- HPB公式の○/◎/△/×の定義文書は見つからず、掲載サロンブログや解説記事からの間接的確認のみ（記号の意味は店舗設定・時期で変わる可能性）。
- 週ストリップ vs 月グリッドの定量比較（完了率・タスク時間）は見つからなかった。
- 24:00 vs 0:00 表記のUX研究は検索予算切れで未調査。
- RESERVA・STORES予約・Square Appointments・Fresha・Booksy の予約画面の具体的UI仕様（記号・表示形式）は信頼できる一次情報が見つからなかった（比較記事は競合ベンダー発）。

---

## KQ3. 日本語ユーザー向けフォーム項目のベストプラクティス（氏名+ふりがな、カタカナ/ひらがな、autokana、電話番号、input type / autocomplete）と英語話者への見せ方

### Takeaway
2026年4月からChromeがふりがな欄の保存・自動入力に対応し、判定は「autocomplete属性（最重視）＋ラベル文言＋name属性」のヒューリスティック。ふりがなはカタカナ強制の必然性は薄く、スマホでは「ひらがな」受付が入力負荷が低いという国内意見が複数ある。電話番号は `type="tel"`＋`autocomplete="tel"` で単一フィールド、ハイフン有無を両方受け付けて正規化し、iOSの電話キーパッドで入力できない記号を要求しない。英語話者にはふりがな欄を非表示（または任意）にする設計が合理的。

### Cited Findings

**ふりがな自動入力（ブラウザ標準）**
- Chrome Developers Blog（2026-04-15公開）: Chromeの自動入力が日本語のふりがな（phonetic name）対応を改善し、漢字氏名とふりがなの両方を自動入力可能に。フィールド判定は「autocomplete属性・フィールドのラベル・name属性」の3シグナルに基づくヒューリスティックで、「HTML標準にふりがな用の標準値がない」ため。autocomplete属性が最も重く、「標準外のautocomplete値を使うとヒューリスティックにフォールバックせず自動入力が効かなくなる」 — [Chrome Developers: Improved Japanese phonetic name support in Chrome autofill (ja)](https://developer.chrome.com/blog/japanese-phonetic-name-autofill?hl=ja); [(en)](https://developer.chrome.com/blog/japanese-phonetic-name-autofill)
- Google Japan Blog: Chromeがふりがなの自動保存と入力に対応 — [Google Japan Blog: Chromeがふりがなの自動保存と入力に対応](https://blog.google/intl/ja-jp/feed/google-chrome-autofill-kana/)
- Classmethod による検証記事（Chromeふりがな自動入力を試した） — [Classmethod: Chromeの自動入力 ふりがな対応を試してみた](https://dev.classmethod.jp/articles/chrome-japanese-phonetic-name-autofill/)

**ふりがな自動入力（JSライブラリ）**
- Web担当者Forum (2015)「住所・フリガナは自動入力すべし」: 氏名からフリガナ欄に自動入力する `jquery.autoKana.js`、郵便番号→住所の `YubinBango.js` を紹介 — [Web担: 住所・フリガナは自動入力すべし](https://webtan.impress.co.jp/e/2015/09/11/17007)
- jquery.autoKana.js の設置手順解説 — [arts-factory: autokana設置方法](https://arts-factory.net/autokana/)
- EFOツール（エフトラ）の「ふりがな自動入力」: ひらがな/カタカナを選んで自動入力可。注意点として「漢字を実際の読みと違う読みで変換した場合そのままフリガナ欄に反映される」「英字や記号は出力されない」 — [f-tra EFO: ふりがな自動入力](https://f-tra.com/ja/efo/feature/feature_detail11.html)

**カタカナ vs ひらがな**
- note（うしをい）: 氏名の振仮名欄で「カタカナ」を求めるのは紙申込書の名残で、読みが分かれば十分という主張 — [note: 入力フォームの振仮名を「カタカナ」にさせる必要はないと思う](https://note.com/ushiwoi/n/n00d65b50619a)
- アテンド（新潟の制作会社）: カタカナは直線的で手書きしやすい利点はあるが「スマートフォンではカタカナ変換は難しい」ため、読みさえ伝われば「ひらがな」を使うことを提案 — [アテンド: メールフォームのカナ入力欄について](https://www.attend.jp/desine_170317)
- 「どちらが正しいか」を定めた公的基準は検索範囲では見つからなかった（上記は制作会社・個人の見解）。

**氏名フィールドの設計（GOV.UK）**
- GOV.UK「Names」: 可能な限り「フルネーム1フィールド」。1フィールドは最も広い種類の名前に対応できるが、名前の部分を確実に抽出できない。分割する場合は "First name" / "Last name" とラベルし、対応する autocomplete 値を設定。空欄エラーは「Enter your full name」 — [GOV.UK: Names](https://design-system.service.gov.uk/patterns/names/)

**電話番号**
- GOV.UK「Phone numbers」: ユーザーが普段使う形式をそのまま受け付ける。「余分なスペース・ハイフン・ダッシュ・括弧を許容し、国番号・市外局番にも対応」。エラー文は例示の有無で変える（例なし→「電話番号を入力してください、例: ...」、例あり→「正しい形式で入力してください」） — [GOV.UK: Phone numbers](https://design-system.service.gov.uk/patterns/phone-numbers/)
- ONS版: 「未入力」と「形式誤り」を分け、未入力は「Enter [必要な種類の電話番号]」、誤りは有効な例を示す — [ONS Design System: Phone numbers](https://service-manual.ons.gov.uk/design-system/patterns/phone-numbers)
- Baymard Touch Keyboard Cheat Sheet: 「iOSの電話キーパッドでは括弧やダッシュなどの特殊文字が入力できないため、電話番号にそれらの文字を必須にしてはならない」。メール欄はautocorrect/auto-capitalizeをオフ、氏名・住所欄はautocorrectをオフ — [Baymard: Touch keyboard types cheat sheet](https://baymard.com/labs/touch-keyboard-types)
- Baymard: 1つの入力実体（電話番号など）を複数フィールドに分割すると摩擦が増える（フィールド間でキーボードが閉じて入力が中断した例） — [Baymard: Avoid splitting single input entities](https://baymard.com/blog/mobile-form-usability-single-input-fields)
- Baymard (2015, 48サイト): 54%のサイトが電話・郵便番号・カード番号のいずれかで最適化されたタッチキーボードを呼び出せていない。2013年比で改善はわずか9% — [Baymard: Touch keyboard implementations](https://baymard.com/blog/mobile-touch-keyboards)
- Zenn: ハイフン入り入力を許すと、見た目が似た記号（‐ ‑ ‒ など）が混在する問題が出る。似た記号をすべて列挙してハイフンに統一する正規化処理が必要。DBにハイフンなしで保持し表示時に整形する運用の煩雑さにも言及 — [Zenn: 電話番号のハイフン問題](https://zenn.dev/koakuma_ageha/articles/6d87178b738308)
- Zenn: 片方の形式しか受け付けないとエラーになりストレスを与えるため、ハイフンの有無を許容して正規化する（自動ハイフン区切りの入力補助の実装例） — [Zenn: 電話番号 入力補助](https://zenn.dev/benjuwan/articles/350b6ca8fdb18c)
- `type="tel"` 自体はほぼバリデーションしない（国ごとに形式が異なるためブラウザ側判定は困難、WHATWG議論）。厳密な検査は `pattern` 属性や `setCustomValidity()` で行う — [WHATWG archive: input type=tel validation](https://lists.whatwg.org/pipermail/whatwg-whatwg.org/2009-July/063507.html)
- `type="tel"` に `autocomplete="tel-national"` を付けるとHTMLバリデータが警告する（`tel` を使う） — [Rocket Validator: tel-national on input](https://rocketvalidator.com/html-validation/bad-value-tel-national-for-attribute-autocomplete-on-element-input-the-autofill-field-name-tel-national-is-not-allowed-in-this-context)

**input type / autocomplete / ラベル一般（web.dev, Google）**
- web.dev「Sign-in form best practices」: 各入力に `<label for>` を付け、プレースホルダをラベル代わりにしない（入力を始めるとラベルが消えて何の欄か忘れる）。ラベルは入力の上に置くとモバイル/デスクトップで一貫。`type="email"` でメール向けキーボード＋基本検証、`type="tel"` で電話キーパッド、`inputmode="numeric"` はPINなどに最適。`name`/`id` はデプロイ間で安定させる。ページ全体を1つの `<form>` で包まない — [web.dev: Sign-in form best practices](https://web.dev/articles/sign-in-form-best-practices)
- web.dev「Autofill」「Help users avoid re-entering data」: autocomplete属性で再入力を回避 — [web.dev: Autofill](https://web.dev/learn/forms/autofill); [web.dev: auto](https://web.dev/learn/forms/auto)
- web.dev「SMS OTP form」: OTPは `type="text" inputmode="numeric" autocomplete="one-time-code"` — [web.dev: SMS OTP form](https://web.dev/articles/sms-otp-form)
- Clearleft: 郵便番号・プロモコード・PINなどで `type="number"` は不適切（スピンボタン、先頭0の除去、ハイフン拒否）。`inputmode="numeric"`＋`pattern` を使う — [Clearleft: Three attributes](https://clearleft.com/thinking/three-attributes-for-better-web-forms)
- Baymard: タッチ入力は遅く誤りやすいので「技術的に可能な限り自動検出・自動補完」する — [Baymard: Mobile checkout usability](https://baymard.com/blog/mobile-checkout)

### Inferences
- 推奨マークアップ（JP）:
  - 氏名: `<input name="name" autocomplete="name" autocapitalize="off" autocorrect="off" enterkeyhint="next">`（1フィールド、GOV.UK準拠。姓名分割が業務上不要なら分けない）
  - ふりがな: ラベルを「ふりがな」（ひらがな受付、カタカナ入力も正規化して受理）とし、`name="name-kana"`、ラベル文言に「ふりがな」を含める。Chromeの判定が「autocomplete・ラベル・name」の3シグナルなので、標準外のautocomplete値を**付けない**（付けると自動入力が無効化される）。補助として autokana系の自動生成を入れる場合は「自動入力された読みが誤っていることがある」前提で編集可能＆英字名では無効化。
  - 電話: `<input type="tel" autocomplete="tel" inputmode="tel" enterkeyhint="next">` 単一フィールド。ハイフン・スペース・全角数字・類似ダッシュを正規化後、日本の携帯/固定（10〜11桁）を検証。エラー文は「電話番号を入力してください（例: 09012345678）」。
  - 備考: `<textarea>` は任意、文字数上限を明示（GOV.UKの「〜文字以内」エラー文パターン）。
- 英語UI: ふりがなは日本語の読み確認のための項目なので、EN表示時は非表示または「Furigana (optional, for Japanese names)」として任意化。氏名は "Full name"、電話は "Phone number (Japanese mobile preferred; include country code if overseas)" とし、GOV.UK同様に国番号付き入力も受け付けて正規化。
- 職業（学生/社会人）はラジオ2択。GOV.UKの「なぜ聞くのかを把握する」原則に従い、学割などの理由をラベル横に一言添える（例: 「学生料金の判定に使用」）。

### Gaps
- Chromeがふりがな欄として認識する具体的なラベル文言・name値の一覧（カタカナ判定の有無など）は本文抜粋で確認できず（ブログに記載がある模様だが抜粋に含まれなかった）。
- ひらがな/カタカナどちらが完了率・誤入力率に有利かの測定データは見つからなかった。
- 日本の電話番号正規表現の権威ある仕様（総務省の番号帯など）は本調査の範囲外。

---

## KQ4. 確認・完了画面: 表示すべき情報、「カレンダーに追加」(ICS)、キャンセルリンクUX、スクリーンショット向けレイアウト（メール送信なし前提）

### Takeaway
メール控えがない本件では、完了画面が「唯一の予約証憑」になる。確認画面（GOV.UK「Check answers」）で全内容を一覧し各行から修正できるようにし、完了画面には予約番号・日時・メニュー・所要時間・店舗情報・キャンセルリンク・カレンダー追加（Google/Apple(ICS)/Outlook）を1画面に収める。ICSはリンク/ボタンとして確認画面に置くのが一般的パターンで、Cal.comはGoogle/Office/Outlook/ICSの4種リンクを返す。

### Cited Findings
- GOV.UK「Check answers」: 送信前に回答を一覧表示し、各行の「Change」リンクから該当ページへ戻って修正できる — [GOV.UK: Check answers](https://design-system.service.gov.uk/patterns/check-answers/)
- Web担当者Forum（EFO連載）: 確認ページ→完了ページで「送信が済んだと誤解させない・ためらわせない」工夫が必要。送信ボタンは最適な大きさ＋「次のアクションを示す文言」で離脱を減らす — [Web担: エントリーフォーム最適化](https://webtan.impress.co.jp/corner/8348)
- Cal.com API: 予約の「add to calendar links」として Google Calendar / Microsoft Office / Outlook / ダウンロード用ICS の個別リンクを返す — [Cal.com API: Get add-to-calendar links](https://cal.com/docs/api-reference/v2/bookings/get-add-to-calendar-links-for-a-booking.md)
- Timify: 予約フォーム送信直後に「add booking to my calendar」のダウンロードボタンを表示。ICSの説明文内のハイパーリンクはインポート時にプレーンテキストになるため、URLを完全な形で書く必要がある — [Timify: ICS file customisation](https://www.timify.com/en/support/6086959-ics-file-customisation/)
- Salesforce Scheduler実装例: 確認画面に「Add to Calendar」グラフィック＋Google/Outlook/Office 365のテキストリンクを配置 — [UnofficialSF: Generating an ICS file after appointment save](https://unofficialsf.com/generating-an-ics-file-after-service-appointment-save-in-salesforce-scheduler-flows/)
- Constant Contact コミュニティ: ICSリンクは「登録後の確認ページ」と「自動確認メール」の両方に置くパターン — [Constant Contact Community](https://community.constantcontact.com/t5/Questions-Discussions/Linking-event-dates-to-calendar/m-p/428045)
- JAL×OpenTableのレストラン予約: 確認画面に「印刷・変更・取消」ボタンを配置し、完了メールで内容を確認させる流れ — [JAL: OpenTable レストラン予約について](https://www.jal.co.jp/restaurant/opentable/about.html)
- Impress Watch: ユーザーはオンラインチケットや申込の確認画面を「後で見返すため」にスクリーンショットで保存する利用シーンがある — [Impress Watch: スクリーンショットを活用しよう](https://www.watch.impress.co.jp/aquosphone/2013/09/130910.html)
- Adalo テンプレート解説: 購入/予約確定を明確に伝える「成功状態（congrats）画面」を用意することを推奨 — [Adalo: Congrats screen](https://help.adalo.com/ja/feature-templates/browse-purchase-and-manage-classes/congrats-screen)
- NN/g「Confirmation Dialogs Can Prevent User Errors」: 取り消しにくい操作の前の確認ダイアログは誤操作防止に有効（ただし乱用は慣れによる無視を招く） — [NN/g: Confirmation dialog](https://www.nngroup.com/articles/confirmation-dialog/)

### Inferences
- **確認画面（送信前）**: 「メニュー名・料金・所要時間 / 日時（曜日付き、JST明記） / 氏名(ふりがな) / 職業 / 電話 / 備考」を Check answers 形式で表示し、各行に「変更」。キャンセルポリシー（締切時刻・無断キャンセル時の扱い）をここで必ず再掲し、確定ボタン文言は「この内容で予約を確定する / Confirm booking」。
- **完了画面（メール無し前提のスクショ最適化）**: 
  - 画面上部に大きく「予約が確定しました ✓」と、1画面（スマホ縦）に収まるカード: 予約番号、日付（曜日）、開始–終了時刻、メニュー、料金、店名・住所（地図リンク）、担当者名。
  - 「この画面をスクリーンショットで保存してください（確認メールは送信されません）」の明示的な案内文（JP/EN）。
  - 「カレンダーに追加」: ICSダウンロード（iOS/Apple Calendar対応）＋Googleカレンダー用URL。ICSの `DESCRIPTION` にはキャンセルURLを完全なURL文字列で入れる（Timifyの指摘どおりリンク化されない前提）。`LOCATION` に住所、`SUMMARY` に「〇〇 Barber: カット」。
  - 「予約をキャンセル / Cancel booking」リンク（トークン付きURL）を目立つが誤タップしにくい位置に。キャンセル画面では確認ステップ（NN/g）を挟む。
  - 予約番号・キャンセルURLは「コピー」ボタン付きにしてメモアプリ等へ保存できるようにする（根拠は上記の「後で見返すために保存する」行動からの推定）。
- 折りたたみ・アコーディオン・カルーセルなど、スクショで情報が欠ける部品は完了画面では使わない。

### Gaps
- 「スクリーンショット前提の完了画面」の設計ガイドラインやユーザビリティ測定は見つからなかった（上記は一般的な完了画面パターン＋行動観察からの推定）。
- 「カレンダーに追加」ボタンの利用率・コンバージョン影響の測定データは見つからなかった。

---

## KQ5. キャンセル・変更フローのUXと無断キャンセル（no-show）対策

### Takeaway
サロン業界の報告では、SMSリマインドで無断キャンセルが約40〜70%減（ベンダー/自己申告ベース）とされ、「数日前のリマインドはキャンセルを早め、枠の再販を可能にする」。日本では「予約を忘れた経験がある人18.8%」「美容院は予約忘れが多い業態」という調査があり、弁護士はキャンセルポリシーの明文化を勧める一方、店側は「感じが悪い」と思われることを懸念してキャンセル料を設定しないケースも多い。キャンセルリンクはトークン付きURL（マジックリンク型）で、失効・取り消し可能なステートフル設計が推奨される。

### Cited Findings

**無断キャンセルの実態（日本）**
- LINEステップ: 「予約忘れの経験がある人が18.8%、約5人に1人」、美容院は予約忘れが多い業態。リマインド・事前確認・キャンセルしやすい導線の設計が来店率向上策として挙げられる — [linestep: 予約キャンセルを減らす](https://linestep.jp/2024/01/16/booking-cancel/)
- 弁護士ドットコム: キャンセル料の目安をまとめた「キャンセルポリシー」を作成・提示しておけば「見ていなかった」という主張に反論しやすい。キャンセル料を設定していない店舗も多く、「感じが悪い」と思われることを懸念。無断キャンセル回収代行の依頼件数は2019年12月から約3年半で約1万件以上、美容系が多い — [弁護士ドットコム: 無断キャンセル](https://www.bengo4.com/c_18/n_16198/)
- Square（日本）: 無断キャンセルは確保したスタッフ時間・座席の損失＝他の客へ提供する機会と売上の損失。対策として名前と電話番号の確認徹底、キャンセル料を回収できる予約システムや事前決済の導入を紹介 — [Square: ノーショー対策](https://squareup.com/jp/ja/townsquare/how-to-deal-with-no-shows)
- HPBでは「無断キャンセルがある」会員は一部機能が制限される（会員情報変更不可など）旨が解約手順記事で引用されている — [atsoho: HPB解約](https://atsoho.com/blog/hot-pepper-beauty-cancellation)
- ホットペッパービューティーアカデミーの調査（市場規模・顧客満足調査2023）にはキャンセル率の統計は含まれていない。「来店前の『予約』対応が他店との差別化要因になりそう」とのコメントあり — [HPBアカデミー 美容サロン顧客満足調査2023 (PDF)](https://hba.beauty.hotpepper.jp/wp/wp-content/uploads/2023/09/20230907_PR2.pdf)

**リマインドの効果（海外・ベンダー/自己申告）**
- Kapow（SMSベンダー）事例: 英国の美容サロンHoneysは導入前「予約の最大30%が未消化」、SMSリマインド導入後95%減と主張 — [Kapow: Honeys case study](https://www.kapow.co.uk/download.html?id=1537)
- TextMagic/Textmarketer事例 (2010): 英国の Headrush Hair Salon がSMS導入後 no-show 約70%減（自己申告） — [Textmarketer: SMS reminders reduce no-shows by 70%](https://ops.textmarketer.co.uk/?p=2284); [Mobile Marketing Magazine](https://mobilemarketingmagazine.com/sms-reminders-reduce-no-shows-by-70/)
- Salon Business UK: 数日前のリマインドで no-show が「平均60%」減り、キャンセルが早まるため枠を埋め直す時間ができる — [Salon Business UK](https://www.salonbusiness.co.uk/?p=34226)
- アグリゲータ統計（出典が不統一で信頼性低）: 「24〜48時間前のリマインドで29%減」「SMSリマインドの開封率98%」など — [SchedulingKit: appointment reminder statistics](https://schedulingkit.com/statistics/appointment-reminder-statistics); [SchedulingKit: no-show statistics](https://schedulingkit.com/statistics/no-show-statistics)

**キャンセル/変更リンクの仕組み（マジックリンク型）**
- Keeper Security: マジックリンクはサーバーがトークン埋め込みリンクを生成し、開いた際にサーバーが検証する仕組み。メールアカウント奪取で突破されるリスク — [Keeper Security: マジックリンクとは](https://www.keepersecurity.com/blog/ja/2024/03/07/magic-links-what-they-are-and-how-they-work/)
- マジックリンク解説: ステートフル方式は発行済トークンを「取り消し可能」だがデータストアが必要。トークンは一回限り・検証後即無効化、クエリパラメータがログやリファラに残らないよう処理する — [tatsuya.website: マジックリンク](https://tatsuya.website/ja/magic-links/); [everplay: マジックリンク認証ガイド](https://everplay.jp/column/30857)
- 予約の状態によって変更・キャンセル可否が変わる（例: 承認済み以降はキャンセル不可という条件設定の開発例） — [GitHub issue: 自分の予約一覧と申請中キャンセル](https://github.com/yuki24-4c4/agile-practices2026-B/issues/8)
- 予約管理システムには「予約変更・キャンセル可否」の設定項目があり、ルールを管理画面で設定する前提 — [yoyakulab: 予約用URL案内の流れ](https://yoyakulab.net/investigation/issuance_of_reservation-url/)

**Calendly/Cal.com の関連仕様**
- Cal.com: 最短通知期間内の枠は非表示（予約側）。キャンセル/変更用リンクはAPIで取得可能（「add to calendar」と同様に予約単位で発行） — [Cal.com Docs: Minimum notice](https://cal.com/docs/core-features/event-types/minimum-notice)

### Inferences
- **キャンセルリンク設計**: 完了画面（＋ICSのDESCRIPTION）に `/cancel/<推測不能なトークン>` を載せる。トークンはDBに保存（ステートフル）して、予約が完了/キャンセル済みなら即失効させる。リンクを開いたら「予約内容の再表示 → 『この予約をキャンセルする』ボタン → 確認ダイアログ → キャンセル完了画面」の3段。変更は「キャンセル後に再予約」導線で十分（1人営業・60分固定のため）。
- **キャンセル締切**: キャンセルポリシー（例: 「前日まで無料、当日キャンセル・無断キャンセルは次回予約をお断りする場合があります」）を確認画面と完了画面に再掲。締切後はリンクから「電話でご連絡ください（tel:リンク）」に切り替える。
- **メール/SMSなし**の制約下では自動リマインドが打てないので、(1) 完了画面の「カレンダーに追加」を強く推し、ICSに `VALARM`（前日・1時間前）を含める、(2) 店主がGoogleカレンダー等で前日に手動連絡できるよう、管理側に「電話番号へのtelリンク付き当日/翌日一覧」を用意する、(3) 将来的にLINE公式アカウント/SMSによる前日リマインド導入を検討する、のが現実的。
- 無断キャンセル抑止として「氏名＋ふりがな＋電話番号」を必須にすること自体が、Squareの「名前と電話番号の確認徹底」に合致する。

### Gaps
- 日本の美容室における無断キャンセル率・直前キャンセル率の統計は見つからなかった。
- リマインドの効果はすべてベンダー/自己申告で、対照群のある研究は見つからなかった。
- キャンセルリンクを開いた後のUX（確認画面の有無、期限切れ時の案内）に関するガイドラインは見つからなかった（上記は推定）。
- HPBのキャンセル期限・ペナルティ運用の一次情報は未確認（assist-all記事は抜粋のみ）。

---

## KQ6. 信頼とコンバージョン: 安心させるコピー、料金表示、所要時間、ポリシーの置き場所、離脱低減

### Takeaway
Baymardの2024調査では平均チェックアウトは5.1ステップ・11.3フィールドで「ステップ数より総フィールド数が重要」。国内EFO記事では「項目を4→3に減らしてCVR約50%向上（HubSpot事例）」「入力が長すぎて断念18%・エラーで断念15%」「スマホ最適化で申込率6.9%改善」などが引用される（多くは二次情報）。予約LPの指針は「必須項目最小化・タイムゾーン明示・空き枠の可視化・不要な個人情報を求めない」。信頼コピーは「料金・所要時間・ポリシーをメニュー選択時点と確認画面の両方で見せる」ことが基本。

### Cited Findings
- Baymard (2024-06): 平均チェックアウトフローは5.1ステップ・11.3フィールド。「総フィールド数がステップ数より重要」 — [Baymard: Average checkout flow form fields](https://baymard.com/blog/checkout-flow-average-form-fields)
- Baymard「Checkout Flow UX Optimization」ガイド（ステップ/フィールド削減の総論） — [Baymard: Checkout flow UX](https://baymard.com/blog/checkout-flow-ux-optimization)
- Baymardの数値を引用する二次ソース: 「2025年 チェックアウト放棄率46.1%」「必須アカウント作成が理由26%」等（Baymard本体で未確認） — [EasyApps: checkout abandonment statistics 2026](https://easyappsecom.com/guides/shopify-checkout-abandonment-statistics-2026); [Crazy Egg: form statistics](https://www.crazyegg.com/blog/form-statistics/)
- Unicorn Platform（予約LP）: 必要な入力項目を最小限に、タイムゾーンを明示、空き枠を見えるように表示、入力エラーを分かりやすく、最初の段階で不要な個人情報を求めない — [Unicorn Platform: Booking landing page examples 2026](https://unicornplatform.com/blog/best-booking-landing-page-examples/)
- Pedowitz Group: 入力の手間や認知負荷が増えると信頼が下がり完了率が落ちる — [Pedowitz Group: Poor form UX](https://www.pedowitzgroup.com/poor-form-ux-destroy-conversion-opportunities?hsLang=en)
- RA Labs: 大規模リニューアルよりA/Bテスト・ファネル分析・ユーザビリティテストによる小さな継続改善が効果的 — [RA Labs: Booking UX best practices](https://ralabs.org/blog/booking-ux-best-practices/)
- NN/g「Few Guesses, More Success: 4 Principles to Reduce Cognitive Load in Forms」（フォームの認知負荷低減4原則） — [NN/g: 4 principles to reduce cognitive load](https://www.nngroup.com/articles/4-principles-reduce-cognitive-load/)
- NN/g「Website Forms Usability: Top 10 Recommendations」 — [NN/g: Web form design](https://www.nngroup.com/articles/web-form-design/)
- 国内EFO: ほぼ問題なく入力できるフォームの離脱率は1%未満が目安、高ければフォーム/項目に問題 — [Gyro-n: フォーム分析事例](https://www.gyro-n.com/column/efo-form-analytics-01/)
- 国内EFO: 「一般的にフォームの離脱率は60〜80%ともいわれる」（出典不明） — [LandingHub: フォーム離脱率](https://www.landinghub.net/columns/form-abandonmentrate)
- 国内EFO: 「HubSpotの調査で項目を4→3に減らしCVR約50%向上」（二次引用） — [cone: 入力フォーム最適化5ステップ](https://cone-c-slide.com/see-sla/blog/input-form-optimization/)
- 国内EFO: 「入力が長すぎて購入断念18%、入力中エラーで断念15%」（二次引用） — [UNION: EFOの6ポイント](https://union-company.jp/media/efo-entry-form-optimization/)
- 国内EFO: スマホ向け改善で申込率6.9%改善の事例、タップしやすい入力欄サイズ・余白・数字キーボード・tel型入力 — [SINAP: スマホEFO](https://sinap.jp/blog/smartphone-efo-start-form-optimization)
- Web担（EFO連載）: フォーム完了だけにこだわらず、電話やチャット窓口を併用して全体の予約率を上げる — [Web担: EFO連載](https://webtan.impress.co.jp/corner/8348)
- Smashing: カレンダー内に空きと価格段階を併記（Treatwellは時間枠に価格を表示） — [Smashing: Date and time picker](https://www.smashingmagazine.com/2017/07/designing-perfect-date-time-picker/)
- HPB: 「即時予約」（リクエストではなくその場で確定）を特集ページで訴求 — [HPB: 即時予約](https://beauty.hotpepper.jp/doc/special/sokujiyoyaku/)

### Inferences
- 本件の必須フィールド数は「メニュー(1)・氏名(1)・ふりがな(1)・職業(1)・電話(1)・日時(2: 日・時)」＝7（備考は任意）で、Baymardの平均11.3を下回り、最適化された範囲（二次情報で7〜8フィールド）に収まる。これ以上増やさない。
- メニュー選択カードに「料金・所要時間(60分)・一言説明」を併記し、選択後の要約にも残す。時間枠ボタンには「18:00–19:00」の開始–終了表記で所要時間を体感させる。
- 「即時確定（リクエスト制ではない）」「確認メールは送られない代わりに完了画面で確定」「キャンセルはこのリンクから」を、HPB利用者の期待（即時予約）に合わせて短いコピーで明示する。
- ポリシー（キャンセル・遅刻・学割条件など）は、(1) メニュー選択画面の下部に折りたたみ、(2) 確認画面の確定ボタン直上に要点1〜2行、(3) 完了画面に再掲、の3箇所。長文は別ページへ。
- 電話予約の代替導線（tel:リンク）をヘッダー/フッターに常設し、フォームで詰まった人を逃がさない（Web担の指摘）。

### Gaps
- Baymard本体の「モバイル限定のフィールド数・放棄率」データは見つからなかった。
- 国内EFOの数値はツールベンダー発で一次ソース（HubSpot等）に辿れていない。
- 「料金/所要時間の表示位置がコンバージョンに与える影響」の測定研究は見つからなかった。

---

## KQ7. フォームと日付ピッカーのアクセシビリティ（WCAG 2.2、ARIAのgrid/combobox/radiogroup）と多言語UX（言語切替の配置、自動検出）

### Takeaway
WCAG 2.2で追加された 2.5.8 Target Size (24×24 CSS px, AA)、2.4.11 Focus Not Obscured (AA)、3.3.7 Redundant Entry (A) が予約フォームに直接関係する。日付グリッドはAPGの「Dialog(Modal)＋grid（table要素にrole=grid, roving tabindex）」、時間枠は「radiogroup＋arrowキー移動」が定石。言語切替はヘッダー/フッターに常設し、ブラウザ言語で初期値を決めつつ手動上書き可・自動リダイレクトはしない（Smashing）、2言語なら相手言語名をネイティブ表記で出す（USWDS）。

### Cited Findings

**WCAG 2.2**
- W3C「What's New in WCAG 2.2」: 2.5.8 Target Size (Minimum, AA) — ターゲットは最低24×24 CSS px。例外: 間隔（24px円が他ターゲットと重ならない）、同等の代替、インライン、ユーザーエージェント既定、必須の場合。2.4.11 Focus Not Obscured (Minimum, AA) — フォーカス中の部品が作者のコンテンツ（固定ヘッダー/フッター、Cookieバナー等）で完全に隠れない。2.4.12 (Enhanced) はAAA。3.3.7 Redundant Entry (A) — 同一プロセス内で同じ情報を再入力させない（自動入力または選択可能にする）。3.3.8 Accessible Authentication (AA) — [W3C: What's New in WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/)
- Deque: 2.2の各基準の要約（番号付けの参照先として） — [Deque University: WCAG 2.2](https://dequeuniversity.com/resources/wcag-2.2)
- TetraLogical: 2.4.11は初期位置に適用され、ユーザーが自ら動かして隠した場合は不適合にならない — [TetraLogical: What's new in WCAG 2.2](https://tetralogical.com/blog/2023/10/05/whats-new-wcag-2.2)

**ARIA APG: 日付ピッカー / grid**
- APG「Date Picker Dialog」例: 日付入力＋「Choose Date」ボタンで Dialog (Modal) パターンのピッカーを開く。カレンダーはボタンのグリッド。`role="grid"` を `table` 要素に置くことで row/columnheader/gridcell の明示が不要。Tab順に入るセルは1つだけ（roving tabindex）。初期フォーカスは入力が空/無効なら今日、有効なら入力値の日。Escで閉じてボタンへフォーカス復帰、Tab/Shift+Tabはダイアログ内で循環 — [W3C APG: Date Picker Dialog example](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/)
- APG「Date Picker Combobox」例: comboboxにフォーカスし Down Arrow / Alt+Down でピッカーを開く変種 — [W3C APG: Date Picker Combobox example](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-datepicker/)
- APG「Grid」パターン: 矢印キー・Home・Endでセル間移動、Ctrl+Home/Endで先頭/末尾セル。データグリッドでは行端で止まる、レイアウトグリッドでは次行へ折り返し可 — [W3C APG: Grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/)
- APG「Developing a Keyboard Interface」: roving tabindex＝コンテナは非フォーカス、1要素だけ `tabindex="0"`、残りは `-1`。移動時に前要素を-1、次要素を0にして `focus()`。この方式はブラウザが新フォーカス要素をスクロールして表示する（aria-activedescendant はしない） — [W3C APG: Keyboard interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)
- APG「Date Picker Spin Button」例: 日・月・年の3つのspinbuttonをグループ化して1つの日付として扱う — [W3C APG: Datepicker spinbuttons](https://w3.org/WAI/ARIA/apg/patterns/spinbutton/examples/datepicker-spinbuttons)
- APG の例は「説明用であり本番用ではない」と明記 — [W3C APG: Date Picker Dialog example](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/)

**時間枠（radiogroup）**
- APG「Radio Group (roving tabindex)」例: グループ全体で1つのタブストップ、矢印キーでフォーカスと選択が同時に移動、Home/Endで先頭/末尾 — [W3C APG: Radio group example](https://www.w3.org/WAI/ARIA/apg/patterns/radio/examples/radio/)
- MDN `radio` role: `aria-checked`、矢印キーで隣接ラジオへフォーカスと選択を移動 — [MDN: ARIA radio role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/radio_role)
- Bonobolabs/time-picker（React）: `ul/li` に `radiogroup`/`radio` ロールと `aria-checked`。ラベルから先頭ゼロを除き、スクリーンリーダーが「zero three」でなく「three」と読むようにする — [GitHub: Bonobolabs/time-picker](https://github.com/Bonobolabs/time-picker)
- 予約UIのa11yバグ報告例: 日ごとの時間枠ボタンに選択状態（radio semantics か `aria-pressed`）とフォーカスリングがなく、各日をラベル付きグループで囲むべきという指摘 — [GitHub issue: nomadcoders/clipper #42](https://github.com/nomadcoders/clipper/issues/42)
- web.dev「Forms」(Learn Accessibility): フォームのラベル・エラー関連付けの基本 — [web.dev: Learn Accessibility - Forms](https://web.dev/learn/accessibility/forms)

**多言語UX（言語切替）**
- Smashing Magazine「Designing A Perfect Language Selector UX」(2022): 自動リダイレクトは助けより苛立ちを生むことが多い（BMWはリダイレクトしない、Audiはリダイレクトしつつ国変更可）。言語名はネイティブ表記、国旗は国を表し言語を表さないため曖昧 — [Smashing: Designing a better language selector](https://smashingmagazine.com/2022/05/designing-better-language-selector)
- USWDS「Select a language: Two languages」パターン: 2言語サイトでは、もう一方の言語名をその言語で表記したリンク/ボタンを置く — [USWDS: Select a language (two languages)](https://designsystem.digital.gov/patterns/select-a-language/two-languages/)
- 言語セレクタ指針（ベンダー/ブログ）: ヘッダーまたはフッターに常設し深いメニューに隠さない、モバイルでは親指の届く下部も有効。ブラウザ/端末言語で初期値を決めるが手動上書きを残し、Cookie/localStorageで記憶。旅行者やVPN利用者では検出が誤る — [Linguise: Language selector best practices](https://www.linguise.com/blog/guide/best-practices-designing-language-selector/); [Centus: Language selector guide](https://centus.com/blog/language-selector-guide); [uxdesign.cc: How not to design language selection](https://uxdesign.cc/how-not-to-design-language-selection-a-ux-study-1631ab3911f7); [Translingo: UX best practices for language selectors](https://translingo.featurebase.app/help/articles/5390127-ux-best-practices-for-language-selectors)
- hreflang・ARIAラベル・タッチターゲット・JSなしフォールバックをSEO/a11y要件として挙げる — [Linguise](https://www.linguise.com/blog/guide/best-practices-designing-language-selector/)

### Inferences
- **日付の週ストリップ/月グリッド**: `role="grid"`（table要素）＋roving tabindex、過去日・満席日は `aria-disabled="true"` かつ `tabindex="-1"` に加えてテキスト/記号（×・満席）で状態を示す（色のみ禁止）。選択日は `aria-selected="true"`。各セルの accessible name は「10月12日(日) 空きあり / Sun, Oct 12, available」のように状態を含める。
- **時間枠**: ネイティブ `<input type="radio">` を `fieldset/legend`（「開始時刻を選択 / Choose a start time」）で囲み、CSSでボタン風に見せるのが最もa11y負債が少ない。満席枠は `disabled` にするか非表示。ラベルは「18:00–19:00」。
- **タップターゲット**: 時間枠ボタン・日付セルは最低44×44 px（WCAG 2.5.8の24pxは下限、モバイルでは余裕を）。固定フッターの「次へ」ボタンがフォーカス中の入力を隠さないよう `scroll-padding-bottom` を設定（2.4.11）。
- **再入力禁止（3.3.7）**: 段階開示で戻っても入力値を保持、確認画面→修正→確認で再入力させない。
- **言語切替**: ヘッダー右上に「EN / 日本語」（相手言語名をネイティブ表記、国旗なし）。初期値は `Accept-Language`/`navigator.language` で、選択はlocalStorage/Cookieに保存、`<html lang>` と `hreflang` を切替。自動リダイレクトは行わず、英語話者向けにトップで "English available" のバナーを出す程度に留める。
- 日本語UIの数字入力はIMEが全角になりがちなので、電話欄は `inputmode="tel"` で数字キーパッドを出しつつ、全角数字も受理・正規化する（Baymard/Zennの「受け付けて正規化」方針）。

### Gaps
- APGに「時間枠リスト＋日付グリッド」を統合した公式パターンは存在せず、組み合わせは実装者判断。
- WCAG 2.2の日付ピッカー固有の適合事例・テスト結果は見つからなかった。
- 言語切替の配置に関する定量（クリック率・発見率）データは見つからなかった。
- USWDSの2言語パターンの詳細本文は抜粋で確認できず。

---

## KQ8. 定量的知見（Baymard・NN/g・Google等）: フォーム長・項目数・モバイルのエラー率

### Takeaway
信頼できる一次数値は限られる。Baymard: 平均11.3フィールド/5.1ステップ（2024）、accordion型は19.2%高スコア、2015年時点で54%のサイトがタッチキーボード最適化に失敗、32%がフィールド検証なし。A List Apart実験: 最良のインライン検証でエラー22%減・完了時間42%減。NN/g: 同一エラー3回以上はUI欠陥のサイン。Typeformの「1問ずつ47.3% vs 21.5%」やHubSpotの「4→3項目でCVR50%向上」はベンダー/二次情報として扱う。

### Cited Findings
- 平均チェックアウト: 5.1ステップ・11.3フィールド（Baymard, 2024-06）。「総フィールド数がステップ数より重要」 — [Baymard](https://baymard.com/blog/checkout-flow-average-form-fields)
- accordion型チェックアウトは従来型より19.2%高いベンチマークスコア（14サイト、ばらつき大） — [Baymard](https://baymard.com/blog/accordion-style-checkout)
- 2015年ベンチマーク48サイト中54%が電話/郵便番号/カードのいずれかで最適化キーボードを出せていない。2013年比の改善はわずか9% — [Baymard](https://baymard.com/blog/mobile-touch-keyboards)
- ECベンチマークの32%のサイトがフィールド検証をまったく提供していない — [Baymard: Inline form validation](https://baymard.com/blog/inline-form-validation)
- 最良のインライン検証バリアントで「エラー22%減」「完了時間42%減」、成功率・満足度も向上（Wroblewski実験） — [A List Apart](https://alistapart.com/article/inline-validation-in-web-forms/)
- 反証: 77名/90名の2研究で、無効なフィールドを離れた直後の即時エラー表示でエラーが有意に増加 — [UX Movement](https://uxmovement.medium.com/why-users-make-more-errors-with-instant-inline-validation-945aaf4c370a)
- NN/g: 同じエラーが1回の試行で3回以上発生するならインターフェースかメッセージを直すべきサイン — [NN/g](https://www.nngroup.com/articles/errors-forms-design-guidelines/)
- Typeform 2024 Data Report（260万フォーム、5.68億送信）: 1問ずつ形式の完了率47.3% vs 業界平均21.5%（ベンダー、母集団非同一） — [TinyCommand](https://tinycommand.com/blogs/conversational-forms-vs-traditional-forms-which-is-better-for-your-business)
- 「マルチステップは単一ページより完了率25.4%高い（65万件超）」（ベンダー分析、一次ソース未確認） — [FormFlux](https://formflux.io/blog/form-completion-rates-guide)
- 「HubSpot調査: 項目4→3でCVR約50%向上」（二次引用） — [cone](https://cone-c-slide.com/see-sla/blog/input-form-optimization/)
- 「入力が長すぎて断念18%、エラーで断念15%」（二次引用） — [UNION](https://union-company.jp/media/efo-entry-form-optimization/)
- 「スマホ向けフォーム改善で申込率6.9%改善」（EFOベンダー事例） — [SINAP](https://sinap.jp/blog/smartphone-efo-start-form-optimization)
- 「良好なフォームの離脱率は1%未満が目安」（EFOツールのログ分析） — [Gyro-n](https://www.gyro-n.com/column/efo-form-analytics-01/)
- 「予約忘れ経験18.8%」（国内調査、調査主体は抜粋で未確認） — [linestep](https://linestep.jp/2024/01/16/booking-cancel/)
- SMSリマインドによる no-show 減少: 約70%（Headrush, 2010自己申告）/ 95%（Honeys, ベンダー事例）/ 平均60%（Salon Business UK） — [Textmarketer](https://ops.textmarketer.co.uk/?p=2284); [Kapow](https://www.kapow.co.uk/download.html?id=1537); [Salon Business UK](https://www.salonbusiness.co.uk/?p=34226)
- チェックアウト放棄率46.1%（2025, Baymard帰属の二次情報）、必須アカウント作成が理由26% — [EasyApps](https://easyappsecom.com/guides/shopify-checkout-abandonment-statistics-2026)
- 一般的なカート放棄率約70%（50研究の集計、二次情報） — [Grazitti](https://grazitti.com/blog/what-you-can-learn-from-these-frightening-cart-abandonment-statistics)

### Inferences
- 本件のKPI設計: 「フォーム到達→完了」の離脱率をGA4イベント（form_start / form_submit）で段階別に計測し、Gyro-nの「1%未満」を理想値、EFO一般論の「60〜80%」を警戒線として、項目別離脱率（どの項目で止まるか）を見る。
- 定量的根拠が最も強いのは「インライン検証（blur後）」「最適化キーボード」「フィールド数削減」「完了済みステップの要約表示」の4点で、ここに実装工数を優先配分する。

### Gaps
- Baymardのモバイル固有のフィールド数・放棄率・エラー率の一次データは見つからなかった。
- NN/gの定量データ（完了率・エラー率）は本調査では見つからず、ガイドライン（定性的）のみ。
- Googleによるフォーム長・エラー率の公開研究は見つからなかった（web.devはガイドラインのみ）。
- 検索予算切れにより、Chromeふりがな自動入力の判定ルール詳細、HPBのキャンセル規定、24:00表記、NN/g認知負荷4原則の本文、Smashing言語セレクタ本文の追加確認ができなかった。
