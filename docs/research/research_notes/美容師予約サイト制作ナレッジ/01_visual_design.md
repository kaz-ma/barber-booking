# 01. ビジュアルデザイン基礎と応用（モバイルファースト・日英バイリンガル理容室予約サイト向け）

対象プロジェクト: Neuer Barber（大阪・長田健豊）向け予約サイト。ブランド要素 = クラフト紙ベージュのテクスチャ背景 / バーガンディ #7c0000 / チャコール #191919 / Lato + Noto Sans JP / ヴィンテージ調バーバーポール＆ヒゲのロゴ。Next.js + Vercel。

調査環境の注記: 本セッションでは WebFetch が使えず、ネットワークポリシーにより到達できたホストは `raw.githubusercontent.com`（W3C・Tailwind・Next.js・Flutter・Material・Google Fonts の公式リポジトリ）と `developer.apple.com`（HIG）のみ。Material Design 3 サイト、Smashing、NNgroup、Zenn/Qiita/note などは直接取得できなかったため、それらは WebSearch の結果要約（原文未取得）として「※検索要約」と明示して引用する。WebSearch も途中で上限に達したため、後半のトピック（Hoober のサムゾーン研究、Practical Typography 原典、2025–26 年バーバー・トレンド記事等）は取得できず Gaps に記載した。

---

## 1. タイポグラフィ（タイプスケール、日本語/欧文の行間・字間、和欧混植、モバイル最小サイズ、フォント読み込み）

### Takeaway
日本語本文は欧文より広い行間（Web では 1.6〜1.8 相当）を取り、和欧混植では欧文を Lato/Inter 等のプロポーショナル欧文で先に指定し Noto Sans JP をフォールバックに置く。`next/font/google` の Noto Sans JP には preload 可能な `japanese` サブセットが存在しないため、`subsets: ['latin']`＋`display: 'swap'`で欧文だけ preload し、日本語スライスは Google Fonts の unicode-range 分割に任せる（または自前サブセット化して `next/font/local`）。本文 16px、最小 12px 程度（iOS HIG の最小 11pt を下限の根拠に）を守る。

### Cited Findings

**タイプスケールの既製値（参照できる一次情報）**
- Tailwind v4 デフォルトのテキストスケールと行間: xs 0.75rem(12px)/lh 1rem、sm 0.875rem(14px)/1.25rem、base 1rem(16px)/1.5rem、lg 1.125rem(18px)/1.75rem、xl 1.25rem(20px)/1.75rem、2xl 1.5rem(24px)/2rem、3xl 1.875rem(30px)/2.25rem、4xl 2.25rem(36px)/2.5rem、5xl 3rem(48px)/lh 1、6xl 3.75rem(60px)/1、7xl 4.5rem(72px)、8xl 6rem、9xl 8rem — [Tailwind CSS docs: font-size](https://tailwindcss.com/docs/font-size), [Tailwind CSS docs: theme (default theme)](https://tailwindcss.com/docs/theme)
- Material 3 のタイプロール既定値: Display L/M/S = 57/45/36sp Regular、Headline L/M/S = 32/28/24sp Regular、Title L = 22sp Regular、Title M/S = 16/14sp Medium、Body L/M/S = 16/14/12sp Regular、Label L/M/S = 14/12/11sp Medium。Emphasized 系は同サイズで Medium/Bold — [Material Components Android: Typography theming](https://github.com/material-components/material-components-android/blob/master/docs/theming/Typography.md)
- Apple HIG のプラットフォーム別デフォルト/最小文字サイズ: iOS/iPadOS 17pt / 11pt、macOS 13/10、visionOS 17/12、watchOS 16/12。細いウェイト（Ultralight, Thin, Light）は小さい文字で読みにくいので避け、Regular/Medium/Semibold/Bold を推奨 — [Apple HIG: Typography](https://developer.apple.com/design/human-interface-guidelines/typography)
- iOS Dynamic Type「Large（既定）」のテキストスタイル: Large Title 34/41(行送り)、Title1 28/34、Title2 22/28、Title3 20/25、Body 17/22、Callout 16/21、Subhead 15/20、Footnote 13/18（size/leading, pt）。3 行以上のテキストでは tight leading を避ける — [Apple HIG: Typography](https://developer.apple.com/design/human-interface-guidelines/typography)
- HIG はタイプフェイスの種類を最小限にすること、ウェイト・サイズ・色で階層を作ることを推奨 — [Apple HIG: Typography](https://developer.apple.com/design/human-interface-guidelines/typography)

**日本語組版の行間・字間・和欧混植（W3C JLREQ = 日本語組版処理の要件）**
- 行送り = 文字サイズ + 行間（行間 = 行送り − 文字サイズ）。欧文組版の行間は文字サイズの「三分アキ（1/3em）」またはそれ以下が多く、日本語組版の行間はそれより大きくなる（和文と欧文の文字設計の違いによる） — [W3C JLREQ (日本語組版処理の要件)](https://www.w3.org/TR/jlreq/)
- 横組の 1 行の行長は最大 40 字くらいが目安（縦組は 52 字）。これを超える場合は段組にして行長を短くするのが望ましい。行間は特別な場合を除き一定値を保つ — [W3C JLREQ](https://www.w3.org/TR/jlreq/)
- 和欧混植: 横組では原則としてプロポーショナルな欧字を用いる（全角モノスペース欧字は推奨されない）。平仮名・片仮名・漢字と欧字・アラビア数字の間の字間は「四分アキ（1/4em）」。欧文間隔（単語間スペース）は三分アキ（1/3em）を原則とする — [W3C JLREQ](https://www.w3.org/TR/jlreq/)
- 中点類（・）は前後を四分アキ、始め括弧類は前を二分アキ、終わり括弧類は後ろを二分アキにするのが原則 — [W3C JLREQ](https://www.w3.org/TR/jlreq/)
- 活字での本文サイズは一般に 9pt（≒3.2mm）、最低 8pt。欧文は 10〜12pt が一般的（文字設計の違いによる）※印刷の値であり Web の px とは別 — [W3C JLREQ](https://www.w3.org/TR/jlreq/)
- W3C i18n の資料では、日本語中の英数字の前後にごく小さな間隔を入れる慣行を紹介し、JLREQ では約 1/4em が提案されていると説明（※検索要約） — [W3C i18n: Managing inline spaces in Chinese & Japanese](https://w3c.github.io/i18n-drafts/articles/styling/inline-space.en.html)
- 日本語テキストは行間を 10〜15% ほど広げると良い、字形が正方形に近いため広めの行送りが読みやすさを助ける（※検索要約・二次情報） — [Word Connection: Why Japanese fonts matter](https://www.word-connection.com/post/why-japanese-fonts-matter)
- 欧文フォントでは約 120% から行間を調整し始めるのが目安だが、日本語組版では無意識に広めの行間を取りがち。最適値は書体や行長に左右されるため一律の数値では決められない（※検索要約） — [science.co.jp: What do you think of this typesetting?](https://www.science.co.jp/en/?p=27655)
- 日本語は全ての文字が H ハイトを埋めるため、同じ line-height でも行間が相対的に詰まって見える（※検索要約・Mozilla Connect への提案文） — [Mozilla Connect: line-height in Reader View should be localised](https://connect.mozilla.org/t5/ideas/the-line-height-in-the-reader-view-should-be-localised/idc-p/80127)
- WCAG 2.1 SC 1.4.12 Text Spacing は、ユーザーが行間 1.5 倍・段落後 2 倍・字間 0.12em・単語間 0.16em に上書きしても内容や機能が失われないことを要求（作者が常にその値にする義務ではない）。「日本語のように段落後スペースを使わない言語では段落間隔の変更は実際には行われにくい」「日本語への word-spacing 適用は効果がなかった」と明記。作者には各言語のローカルな可読性ガイダンス（JLREQ 等）に従うことを推奨 — [WCAG 2.2 Understanding: Text Spacing](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html)
- Noto Sans CJK JP はプロポーショナルメトリクス（`font-feature-settings: "palt"`）に対応している（Web 版 Noto Sans JP での挙動は検索要約からは確定できない）（※検索要約） — [ICS MEDIA: CSS font-feature-settings で日本語の字詰め](https://ics.media/en/entry/14087/)

**和欧フォントペアリング**
- Inter には和文グリフがないため、Inter を指定して日本語を入力すると（Figma 等では）Noto Sans JP に置き換わる。和文フォールバックを明示するのが安全（※検索要約） — [scrapbox: Figma のフォントを Inter にして日本語を書くと Noto Sans JP で表示される](https://scrapbox.io/cist-it/Figma%E3%81%AE%E3%83%95%E3%82%A9%E3%83%B3%E3%83%88%E3%82%92Inter%E3%81%AB%E3%81%97%E3%81%A6%E6%97%A5%E6%9C%AC%E8%AA%9E%E3%82%92%E6%9B%B8%E3%81%8F%E3%81%A8Noto_Sans_JP%E3%81%A7%E8%A1%A8%E7%A4%BA%E3%81%95%E3%82%8C%E3%82%8B)
- Noto Sans JP × Inter のペアリング例が海外フォント組み合わせサイトで紹介されている（※検索要約） — [maxibestof: Noto Sans JP + Inter pairing](https://maxibestof.one/typefaces/noto-sans-jp/pairing/inter)
- Google Fonts 上の Noto Sans JP は可変フォント（wght 100–900）で、サブセットは cyrillic / japanese / latin / latin-ext / vietnamese — [google/fonts: ofl/notosansjp/METADATA.pb](https://github.com/google/fonts/blob/main/ofl/notosansjp/METADATA.pb)
- Lato（Google Fonts 版）は静的フォントで Thin〜Black（100/300/400/700/900 がウェブ配信対象）＋イタリック、サブセットは latin / latin-ext のみ — [google/fonts: ofl/lato/METADATA.pb](https://github.com/google/fonts/blob/main/ofl/lato/METADATA.pb), [vercel/next.js font-data.json](https://github.com/vercel/next.js/blob/canary/packages/font/src/google/font-data.json)

**フォント読み込み戦略（next/font）**
- `next/font/google` の Google Fonts は自動的にサブセット化される。`preload`（既定 true）が有効なとき、どのサブセットを preload するかを `subsets` で指定しないと警告が出る。`display` の既定値は `'swap'`。`adjustFontFallback` は既定 true で、CLS 低減のための自動フォールバック（ascent/size-adjust 上書き）を生成する。可変フォントの利用を推奨 — [Next.js docs: Font Module](https://nextjs.org/docs/app/api-reference/components/font)
- preload の適用範囲: ルートレイアウトで呼べば全ルートで preload、個別ページで呼べばそのルートのみ — [Next.js docs: Font Module](https://nextjs.org/docs/app/api-reference/components/font)
- Next.js 内蔵の Google Fonts データでは **Noto Sans JP の preload 可能サブセットは `cyrillic, latin, latin-ext, vietnamese` のみで `japanese` が含まれない**（Noto Serif JP, Zen Kaku Gothic New も同様） — [vercel/next.js: packages/font/src/google/font-data.json](https://github.com/vercel/next.js/blob/canary/packages/font/src/google/font-data.json)
- ローダーは preload 可能サブセットが 0 のフォントでは自動的に preload を無効化し、preload 有効かつ `subsets` 未指定なら "Preload is enabled but no subsets were specified" エラー（利用可能サブセット一覧つき）を出す — [vercel/next.js: validate-google-font-function-call.ts](https://github.com/vercel/next.js/blob/canary/packages/font/src/google/validate-google-font-function-call.ts), [Next.js error: google-fonts-missing-subsets](https://nextjs.org/docs/messages/google-fonts-missing-subsets)
- 2023 年の Next.js 修正 PR で、CJK はグリフ数が多くフォントファミリーが 100 以上のファイルに分割されるため preload 候補から外された。CJK を使う場合は `preload: false` を指定する例が公式に示されている（※検索要約） — [Next.js error: google-fonts-missing-subsets](https://nextjs.org/docs/messages/google-fonts-missing-subsets)
- 日本語フォントは 1 ウェイトで数百 KB〜1MB 規模になりやすく、読み込み順やフォールバック次第で CLS 等の体験が大きく変わる（※検索要約） — [assist-all: Google Fonts 日本語の速度・SEO 最適化ガイド](https://lifestyle.assist-all.co.jp/google-fonts-japanese-speed-seo-optimization-guide/)
- Python FontTools で OTF のレイアウト情報（GPOS 等）を保ったまま WOFF2 化すると Noto Sans JP を 50% 以上削減できた。一方「サブセットフォントメーカー」で GPOS テーブルが失われ字間が崩れた事例あり（※検索要約） — [uhiyama-lab: Noto Sans JP フォントを 50% 軽量化（FontTools サブセット化）](https://uhiyama-lab.com/ja/blog/webdev/optimize-subset-fonttools/)
- WCAG 大文字判定: 1pt = 1.333px なので 14pt ≒ 18.5px、18pt ≒ 24px。太字 18.5px 以上または通常 24px 以上が「大きな文字」 — [WCAG Understanding: Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)

### Inferences
- **推奨タイプスケール（モバイル基準、Tailwind の既定値に揃える）**: Display 36/40（見出しヒーロー、Lato 700 または条件付きでディスプレイ書体）、H1 30/36、H2 24/32、H3 20/28、Body-L 18/28（日本語 line-height ≒1.55）、Body 16/26（日本語は `leading-[1.65]`〜`1.75` に上書き）、Small 14/22、Caption 12/18。Tailwind 既定の base 行間 1.5 は欧文基準なので、**日本語本文は 1.6〜1.8（`--text-base--line-height` を 1.7 に上書き）** とするのが JLREQ の「和文は欧文より行間を広く」と各二次情報（+10〜15%）に整合する。
- **字間**: 日本語本文は `letter-spacing: 0.02–0.05em` 程度（見出し 0.02em 前後、本文 0.04em 前後）が一般的実務値だが、一次情報での数値は未確認（Gaps 参照）。欧文大文字見出し（Lato uppercase のバーバー表記 "BOOK NOW" など）は `tracking-wide`（0.025em）〜`tracking-widest`（0.1em）でヴィンテージ看板らしさが出る。和文に palt を適用すると詰まり過ぎることがあるため、本文は無効・見出しのみ `font-feature-settings: "palt"` を検討。
- **和欧混植の font-family**: `--font-sans: var(--font-lato), var(--font-noto-sans-jp), system-ui, sans-serif` の順で、欧文・数字（料金・時刻）は Lato、和文は Noto Sans JP に自動で振り分ける。Lato は x-height が Noto Sans JP の欧文より小さめなので、混植行では Lato を 1.0、Noto を基準に `font-size-adjust` の検証をする（要実機確認）。Noto Sans JP のみに統一する選択肢もあり、その場合は数字の字形が平凡になるため、料金・時刻だけ Lato を当てる運用でも良い。
- **和欧間の四分アキ**は CSS の `text-autospace`（CSS Text 4）がまだ広く使えないため、実務では「英数字の前後に半角スペースを入れない／入れる」をコンテンツルールとして統一する（JLREQ 準拠なら入れないで 1/4em 相当の自動処理に期待するが、現状ブラウザは無処理のため、英数字前後に半角スペースを入れる方が見た目が安定する）。
- **next/font 設定案**: `Lato({ subsets:['latin'], weight:['400','700'], display:'swap', variable:'--font-lato' })` と `Noto_Sans_JP({ subsets:['latin'], weight:'variable' or ['400','500','700'], display:'swap', preload:false または subsets:['latin'] で欧文のみ preload, variable:'--font-noto-sans-jp' })`。Noto Sans JP の日本語グリフは Google Fonts が unicode-range で分割配信する多数のスライスを必要時のみ取得する形になる（font-data.json に japanese が無いことから推定）。初回描画の CLS を抑えるには `adjustFontFallback`（既定 true）を活かし、見出しの和文だけ `font-display: optional` 相当にする選択も検討。
- 完全自前配信（`next/font/local`）する場合は、FontTools（pyftsubset）で JIS 第 1・2 水準＋必要記号に絞り、`--layout-features='*'` で palt/kern を保持し WOFF2 化する。Vercel の CDN からセルフホストすることで Google Fonts へのサードパーティ接続も減る。
- 最小サイズ: 本文 16px、補助テキスト 14px、ラベル/キャプション 12px を下限（iOS HIG 最小 11pt ≒ 11px に 1px 余裕）。入力欄は iOS Safari の自動ズームを避けるため 16px 以上にする（経験則、要検証）。

### Gaps
- 日本語 Web 本文の具体的な letter-spacing / line-height 推奨値（例: 1.7 / 0.05em）を一次情報（Zenn/Qiita/デジタル庁デザインシステム等）で確認できなかった（ホストに到達不可、検索上限）。デジタル庁デザインシステムのリポジトリ（`digital-go-jp/design-system-example-components`）はトークン定義ファイルの場所が特定できず未取得。
- Google Fonts の Noto Sans JP が何スライスに分割されるか（「120 スライス」等）の公式数値は未確認。
- Web 版 Noto Sans JP（Google Fonts 配信版）で `palt` が有効かは未確認。
- Practical Typography（Butterick）の本文サイズ 15–25px / 行長 45–90 字 / 行間 120–145% という数値は原典に到達できず未確認（記憶ベースのため本ノートには採用しない）。
- Lato と Noto Sans JP の x-height・ベースライン整合の具体値は未調査（実機で検証が必要）。

---

## 2. カラー（ブランドパレット構築、WCAG コントラスト、ライト/ダーク、CTA アクセント、空き状況のセマンティックカラー）

### Takeaway
#7c0000（バーガンディ）はベージュ/白の上で 8〜11:1 と余裕で AA/AAA を満たし CTA に最適だが、#191919 の上では 1.55:1 しかなくダークテーマでは使えない。ダークテーマは Material 流に「アクセントを明るいトーン（例: #d9777b 系、5.8:1）に差し替え」「面は #191919 を最暗面にして階調で持ち上げる」設計が必要。空き状況は色だけに頼らず、記号・ラベル・パターンを併用し（WCAG 1.4.1）、色相は赤/緑対比を避けて Okabe–Ito 系の青/橙/緑を使う。

### Cited Findings

**WCAG の閾値（一次情報）**
- SC 1.4.3 Contrast (Minimum, AA): 通常テキスト 4.5:1、大きな文字（18pt≒24px 以上、または 14pt≒18.5px 以上の太字）3:1。値は丸めない（4.499:1 は不合格）。アンチエイリアスで細いフォントは実効コントラストが下がるため、太めのフォントや余裕のある配色が推奨。装飾テキストは除外 — [WCAG Understanding: Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- SC 1.4.11 Non-text Contrast (AA): UI コンポーネントの存在・操作に必要な視覚情報と、選択/フォーカス等の状態表示は隣接色に対して 3:1 以上。非アクティブ（disabled）コンポーネントには適用されない。ホバー色と通常色の差自体に 3:1 は要求されない（隣接しないため）が、チェックマークや矢印等の非テキスト指標は 3:1 が必要。細い線は実効コントラストが落ちるので避ける — [WCAG Understanding: Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
- SC 1.4.1 Use of Color (A): 色の違いだけで情報を伝えない。「必須項目は赤」「エラーは赤」等が典型例で、形状やテキストなど別の視覚手段を併用する。部分的な色覚の人、高齢者、モノクロ表示の利用者に影響 — [WCAG Understanding: Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)
- SC 2.4.13 Focus Appearance (AAA): フォーカス表示は最低でも「2 CSS px の実線の外周」相当の面積と 3:1 のコントラスト — [WCAG Understanding: Focus Appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html)
- SC 2.4.7 Focus Visible (AA): キーボードフォーカスに可視インジケータ必須。インジケータは非テキストなので 1.4.11 の 3:1 も適用 — [WCAG Understanding: Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html)
- AAA の 7:1（通常文字）/4.5:1（大文字）の値は二次情報の要約（※検索要約） — [UTMB: WCAG 2.2 list (AAA)](https://www.utmb.edu/accessibility/guidelines/wcag/wcag-list/-in-category/categories/a11y/level-aaa)

**Apple HIG のコントラスト・カラー方針**
- HIG は WCAG AA の値を基準に、17pt 以下 4.5:1、18pt 以上 3:1、太字 3:1 を要求。「Increase Contrast」設定時により高コントラストな配色を用意する。ダーク/ライト両方でコントラストを確認する — [Apple HIG: Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- カスタムカラーにはライト/ダーク両バリアントと、それぞれの高コントラスト版を用意する。色だけで区別・インタラクティブ性・重要情報を伝えない。明るい環境では色が暗く沈み、暗い環境では明るく飽和して見えるため、さまざまな照明条件でテストする。暗い背景に非常に明るいオブジェクト（特に点滅・動くもの）を置くのは避ける — [Apple HIG: Color](https://developer.apple.com/design/human-interface-guidelines/color)
- 主にモノクロームなコンテンツ/背景のアプリでは、ブランドカラーをアクセントカラーにするのが効果的 — [Apple HIG: Color](https://developer.apple.com/design/human-interface-guidelines/color)

**Material 3 のトーンベース配色とダークテーマ**
- M3 のカラーロールはトーナルパレットの「トーン」で定義される: Light では Primary = primary40、On Primary = white、Surface = neutral98、On Surface = neutral10；Dark では Primary = primary80、On Primary = primary20、Surface = neutral6、On Surface = neutral90。Surface Container は Light で neutral94、Dark で neutral12、Surface Container Highest は Light neutral90 / Dark neutral22 — [Material Components Android: Color theming](https://github.com/material-components/material-components-android/blob/master/docs/theming/Color.md)
- ダークテーマでは影が暗い背景とのコントラストを失い見えにくくなるため、高い elevation ほど面を「明るく、より色味を帯びさせる」（primary 色の半透明オーバーレイ）。M3 ではこれが「tonal surface colors（Surface Container 階層）」に置き換えられた。基準ダークテーマの背景/サーフェスはダークグレー — [Material Components Android: Dark theme](https://github.com/material-components/material-components-android/blob/master/docs/theming/Dark.md), [Color theming](https://github.com/material-components/material-components-android/blob/master/docs/theming/Color.md)
- Material Color Utilities は HCT（Hue, Chroma, Tone）色空間で、トーンのみが変わるトーナルパレットから Light/Dark・高コントラストに対応する動的配色を生成する — [material-foundation/material-color-utilities README](https://github.com/material-foundation/material-color-utilities)

**色覚多様性に安全なステータス表示**
- Okabe–Ito パレット（色覚多様性に配慮した 8 色）: `#E69F00`（橙）, `#56B4E9`（空色）, `#009E73`（青緑）, `#F0E442`（黄）, `#0072B2`（青）, `#D55E00`（朱）, `#CC79A7`（赤紫）, `#999999`（灰） — [clauswilke/colorblindr: palettes.R](https://github.com/clauswilke/colorblindr/blob/master/R/palettes.R)
- 予約カレンダーの凡例例: 緑 = 空きあり、赤 = 満席、斜線 = 予約不可（非色情報の併用）（※検索要約） — [Recranet: Legend provides additional clarity in search & book calendar](https://recranet.com/en/reservation-software/updates/legend-provides-additional-clarity-in-search-book-calendar)
- 赤/緑は最も一般的な色覚異常に該当するため、空き=緑/不可=赤は危険。青-橙、青-黄のペアが安全。色＋パターン（ストライプ、ドット）＋凡例を推奨（※検索要約） — [Accudemia feedback: clarify colors of appointment status](https://accudemia.userjot.com/board/p/clarify-colors-of-appointment-status), [Harness-engineering design-color-accessibility (skill page)](https://openskillindex.com/skills/intense-visions-harness-engineering-design-color-accessibility)
- 色覚モードのトグルは色相を変えるだけでなく非色キュー（記号）も有効にすべき（※検索要約） — [vp0: color blind mode toggle UI iOS](https://vp0.com/blogs/color-blind-mode-toggle-ui-ios)

**ブランド色のコントラスト実測（WCAG 2.x 相対輝度式で本調査が算出。ベージュは #f4ecdd / #e9dcc3 / #d9c6a0 を仮定）**
- #7c0000 on #ffffff = 11.31:1、on #f4ecdd = 9.63、on #e9dcc3 = 8.34、on #d9c6a0 = 6.75 → すべて AAA（7:1）または AA 以上
- #191919 on #f4ecdd = 14.98、on #e9dcc3 = 12.97、on #d9c6a0 = 10.50 → AAA
- #ffffff on #7c0000 = 11.31、#f4ecdd on #7c0000 = 9.63 → CTA ボタン（バーガンディ地に白/ベージュ文字）は AAA
- **#7c0000 on #191919 = 1.55:1** → ダーク面上のバーガンディ文字/アイコンは不合格（3:1 未満）。明るいトーンに差し替えると #c94c4c = 3.87（大文字・UI のみ可）、#d9777b = 5.76（AA）、#e38b8b = 6.98（ほぼ AAA）
- ダーク面上のミュートテキスト: #a0a0a0 on #191919 = 6.72、#b8b0a4（ベージュ寄りグレー）= 8.19。#2a2a2a on #191919 = 1.22（面の階調差としては弱いが、面同士の差に WCAG 要件はない）
- ライト面上のミュートテキスト: #5c5046 on #f4ecdd = 6.65、#6b5e52 = 5.34（AA）、#8a7b6c = 3.49（大文字/UI 境界線のみ）
- ステータス色 on #f4ecdd: Okabe–Ito 青 #0072b2 = 4.42（通常文字では AA 未達、UI/大文字は可）、青緑 #009e73 = 2.91（不可）、朱 #d55e00 = 3.29（UI 可）。濃くした緑 #1b6e3a = 5.36（AA）、暗い黄土 #8f6f00 = 4.03（UI 可）、灰 #999999 = 2.43（不可。無効表示は 1.4.11 の対象外なので disabled 用途なら許容）
  （算出式の出典: [WCAG Understanding: Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)）

### Inferences
- **パレット構造（HCT/トーン発想を #7c0000 に適用）**: brand-burgundy を 10 段のトーナルパレットに展開し（例: 95 #fbe9e9 / 90 #f5d0d0 / 80 #e8a3a3 / 70 #d9777b / 60 #c94c4c / 50 #a81f1f / 40 #7c0000(基準) / 30 #600000 / 20 #450000 / 10 #2b0000）、ライトは tone40 を primary、ダークは tone70–80 を primary にする（M3 の 40/80 ルールに準拠）。ニュートラルはクラフト紙寄りの暖色グレー系（ベージュ #f4ecdd〜#e9dcc3 を Surface、#191919 を On Surface）で統一し、純白・純黒は使わない（ヴィンテージ感と目の疲れ軽減）。
- **CTA の使い方**: バーガンディは「予約する」「空き時間」「選択中」の 3 用途に限定し、装飾に乱用しない（HIG「モノクロームなコンテンツにブランド色をアクセントに」）。CTA はバーガンディ地＋ベージュ文字（9.6:1）。セカンダリはチャコール枠線のゴースト。ホバー/プレスは tone30/20 に一段暗く。
- **ダークテーマ方針**: 背景 #191919（最暗面）、カードは #232120→#2b2926 と暖色寄りに持ち上げる（M3 Surface Container の階調に相当）。アクセントは #d9777b〜#e8a3a3 の「明るいバーガンディ」に差し替え、ベージュのクラフト紙テクスチャはダークでは「暗いクラフト紙」または「紙の繊維だけ低不透明度で重ねる」形に変える。ダークテーマは必須ではない（夜間に予約する若年男性客には有用だが、ブランド体験の核はベージュ×バーガンディのライト）。実装するなら `prefers-color-scheme` 追従＋手動トグルの 2 段。
- **空き状況のセマンティックカラー（色覚安全・3 状態）**: 空きあり = 青系 `#0f5f8f`（AA 4.5 超を目安に濃くした Okabe–Ito 青）＋「○」/「空」ラベル、残りわずか = 橙 `#b84a00`＋「△」、満席/受付終了 = 中立グレー＋取り消し線または斜線＋「×」/「満」。「閉店日」は背景を薄い灰に落とし日付を淡色化（disabled は 1.4.11 対象外）。赤/緑の対比は使わず、バーガンディ（ブランド色）は「選択中」の 1 用途に限定して、ステータス色と意味が衝突しないようにする。日本の予約サイトで馴染み深い ○△× 記号は、色覚と言語（英語話者にも図形で伝わる）の両方に効く。
- **コントラスト運用ルール**: 本文 ≥ 7:1 を目標（AAA）、補助テキスト ≥ 4.5:1、アイコン・枠線・フォーカスリング ≥ 3:1、フォーカスリングは 2px 実線＋オフセット（AAA 2.4.13 に準拠）。細い Lato Light は避け、Lato 400/700 と Noto Sans JP 400/500/700 に限定する。

### Gaps
- Material Design 3 公式サイト（m3.material.io）の「Designing color contrast」「Dark theme」ページは到達不能。M2 時代の「#121212 推奨」「15.8:1」「ダークではアクセントを脱彩度」の数値は記憶ベースのため採用せず。
- APCA（Accessible Perceptual Contrast Algorithm）の数値基準は未調査（HIG が WCAG と並列で言及していることのみ確認）。
- クラフト紙テクスチャのような「不均一な背景」上のテキストコントラスト測定法は WCAG の Understanding でも明確ではなく（画像背景の最暗/最明点で測るのが一般的実務）、一次情報は未取得。

---

## 3. スペーシング、グリッド、レイアウト（4/8pt、ブレークポイント、タッチターゲット、セーフエリア、サムゾーン）

### Takeaway
Tailwind v4 の `--spacing: 0.25rem`（4px ベース）に乗って 4/8pt のスケールを使い、ブレークポイントは sm 640 / md 768 / lg 1024 / xl 1280 の mobile-first。タッチターゲットは WCAG 2.2 AA の最小 24×24 CSS px を「絶対下限」、Apple HIG の 44×44pt を「標準」、重要 CTA は 48px 以上にし、`env(safe-area-inset-*)` で下部固定 CTA をホームインジケータから逃がす。

### Cited Findings
- Tailwind v4 の既定スペーシング基準は `--spacing: 0.25rem`（4px）で、`p-4` 等の数値ユーティリティはこの倍数。ブレークポイントは sm 40rem(640px) / md 48rem(768px) / lg 64rem(1024px) / xl 80rem(1280px) / 2xl 96rem(1536px)、`@media (width >= …)` の min-width（mobile-first）。コンテナ幅トークン: xs 20rem / sm 24rem / md 28rem / lg 32rem / xl 36rem / 2xl 42rem / 3xl 48rem — [Tailwind CSS docs: theme](https://tailwindcss.com/docs/theme), [Tailwind CSS docs: responsive design](https://tailwindcss.com/docs/responsive-design)
- 8pt グリッドは 8 の倍数でピクセルに丸めやすく、4pt バリアント（4, 8, 12, 16, 20, 24）をバッジやチップ等の小コンポーネントに使う（※検索要約・二次） — [Breakdance: The 8-point grid system](https://breakdance.com/the-8-point-grid-system-a-practical-guide/), [LS Graphics: Why 8pt grid](https://www.ls.graphics/ideas/why-8pt-grid-the-math-behind-clean-ui), [WordPress design: consistent spacing system proposal](https://make.wordpress.org/design/2019/10/31/proposal-a-consistent-spacing-system-for-wordpress/)
- Refactoring UI の要旨（二次要約）: 「余白が多すぎる」より「足りない」の方が気づきにくいので最初は多めに取る、目を細めて関連要素が一塊に見えるか確認する（squint test）、タイプスケールは計算式より手作りの値を選ぶ（※検索要約） — [claude-code-skills mirror: Refactoring UI tactical principles](https://cdn.jsdelivr.net/npm/claude-code-skills@0.5.0/data/skills/ux-ui-design-system/references/refactoring-ui.md)
- WCAG 2.2 SC 2.5.8 Target Size (Minimum, AA): ターゲットは 24×24 CSS px 以上。例外: 間隔（各ターゲット中心の 24px 円が他と交差しない）、同等機能の別コントロールがある、文中インライン、UA 既定コントロール（`<input type="date">` の日付グリッド等）、本質的（地図ピン等）。ズームに依存して満たすことはできない。重要なコントロールには AAA の 2.5.5 Target Size (Enhanced) を目指すことを推奨 — [WCAG Understanding: Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- Apple HIG: iOS/iPadOS のコントロールは既定 44×44pt、最小 28×28pt。「コントロール間の間隔はサイズと同じくらい重要」 — [Apple HIG: Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- Apple HIG: セーフエリアは Dynamic Island 等のハードウェアやツールバー/タブバーに覆われない領域で、これを尊重することが必須。レイアウトガイドは標準マージンとテキスト幅の最適化（可読性）に使う。Dynamic Type に備え、横並びの要素を縦積みに切り替える、行の高さを伸ばす等の対応をする — [Apple HIG: Layout](https://developer.apple.com/design/human-interface-guidelines/layout)
- CSS `env()` の `safe-area-inset-top/right/bottom/left` はノッチ等を避けるためのビューポートのセーフエリア値 — [CSS Environment Variables Module Level 1 (css-env-1)](https://drafts.csswg.org/css-env-1/#safe-area-insets)
- WCAG 2.1 SC 1.4.10 Reflow (AA): 横書きコンテンツは幅 320 CSS px で一方向スクロールのみで読めること（縦書きは高さ 256px）。カルーセルの各パネルも 320px に収まること — [WCAG Understanding: Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)
- WCAG 2.2 SC 2.4.11 Focus Not Obscured (Minimum, AA): sticky ヘッダー/フッター、Cookie バナー等がフォーカス要素を完全に隠してはならない。`scroll-padding` で回避可能 — [WCAG Understanding: Focus Not Obscured (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)
- 二次情報: Apple 44×44pt、Material 48×48dp（約 9–12mm）、Material はターゲット間 8dp 以上。W3C モバイル a11y wiki は「Apple の pt は Apple 固有の密度非依存単位で CSS では 1pt = 1px」と注記。ヒット領域は見た目のグリフではなくブラウザが反応する全領域（padding で拡張可）（※検索要約） — [OpenReplay: Improving tap targets](https://blog.openreplay.com/improving-tap-targets-mobile-ux/), [W3C Mobile A11y TF: Proposed SC Target Size](https://www.w3.org/WAI/GL/mobile-a11y-tf/wiki/Proposed_SC_Target_Size), [Design Systems Collective: field guide to WCAG, iOS, Android](https://www.designsystemscollective.com/a-designers-field-guide-to-wcag-ios-and-android-rules-31ba5d01d46a)
- サムゾーン: 片手操作向けに下部・中央寄りに主要操作を置く実務が多いが、検索で得られたのはブログの経験則（iOS 48×48pt、Android 56×56dp を狙う等）で一次研究は未取得（※検索要約） — [thisisglance: design for one-handed use](https://thisisglance.com/learning-centre/how-should-i-design-my-app-for-one-handed-use)

### Inferences
- **スペーシングトークン**: 4px 基準で 4/8/12/16/24/32/48/64/96 を主要段階とし、コンポーネント内（アイコンとラベル 8、入力欄 padding 12–16）、コンポーネント間 16–24、セクション間 48–64（モバイル）/ 96（デスクトップ）。画面の左右ガター 16px（≤640px）、20–24px（≥768px）、本文の最大幅は `max-w-prose`〜42rem（JLREQ の横組 40 字 × 16px ≒ 640px と整合）。
- **ブレークポイントの使い分け**: 予約フロー（カレンダー＋時間枠）は 320〜430px を主戦場とし、`md:`（768）で 2 カラム（左: カレンダー、右: 時間枠/サマリー）、`lg:`（1024）で店舗情報サイドバーを追加。320px で崩れないか（Reflow）を必ず確認。
- **タッチターゲットの階層**: 下限 24px（WCAG AA）、カレンダーの日付セルは 40–44px 正方（7 列 × 44 = 308px < 320px で収まる）、時間枠チップは高さ 44–48px・横幅は 2〜3 列グリッド、主要 CTA（「この時間で予約」）は高さ 48–56px・全幅・下部固定。隣接ターゲットは 8px 以上離す。
- **セーフエリア/固定 CTA**: `viewport-fit=cover` を指定し、下部固定バーは `padding-bottom: max(16px, env(safe-area-inset-bottom))`。固定バーがフォーカス要素を隠さないよう `scroll-padding-bottom` を固定バー高さ分設定（2.4.11 対応）。
- **サムゾーン設計（経験則）**: 画面下 1/3 に「次へ/予約する」、上部にはナビと情報のみ、破壊的操作（キャンセル）は親指の自然到達圏から外す。一次研究（Hoober 2013 等）は未取得のため、ここは慣習として扱う。

### Gaps
- Steven Hoober のサムゾーン研究（片手持ち 49% 等）は検索上限で未取得。URL も未検証のため記載しない。
- Material Design 3 公式の 48dp/8dp 間隔ガイドは到達不能で、二次情報のみ。
- Refactoring UI 原典（書籍）の 4pt/8pt 推奨は確認できず、「2026 年版で 4pt が既定になった」という主張（pravinkumar.co）は未検証。

---

## 4. 視覚的階層とゲシュタルト原則（フォームとカレンダーへの適用）

### Takeaway
HIG の「読む順（上→下、先頭側→末尾側）に重要度順で配置」「整列で関連性、インデントで従属」「余白・コンテナ・区切り線で群化」「段階的開示」が階層設計の核で、ゲシュタルトでは近接（ラベルとフィールドを一体化）、類同（同じ状態は同じ見た目）、共通領域（カード/グリッド）がフォームとカレンダーに直結する。

### Cited Findings
- 階層: 人は上から下、先頭側から末尾側の読む順で見るため、最重要項目を上部・先頭側に置く。整列は「関連している」と認識され、インデントは「従属している」と認識される。負の空間・コンテナ形状・区切り線で関連/非関連を示す。段階的開示（disclosure, メニュー, ネスト）で初期表示量を減らす。コントロールはコンテンツから視覚的に区別する — [Apple HIG: Layout](https://developer.apple.com/design/human-interface-guidelines/layout)
- タイポグラフィでの階層: ウェイト・サイズ・色で重要情報を強調し、文字サイズ変更時も相対的な階層を維持する。文字拡大時は重要コンテンツを優先し、タブ見出し等まで一律拡大しない — [Apple HIG: Typography](https://developer.apple.com/design/human-interface-guidelines/typography)
- 近接の原則: 近いものは関連して見える。フォームではラベルをフィールドの近くに置き単一要素として知覚させ、無関係なセクションは余白や区切り線で分ける（※検索要約） — [Think360: Proximity Principle](https://think360studio.com/blog/proximity-principle), [Bird: improve UX with Gestalt principles](https://bird.marketing/blog/digital-marketing/guide/ux-design-principles/improve-ux-gestalt-principles/), [uxdesign.cc: Using Gestalt principles in UX design](https://uxdesign.cc/using-gestalt-principles-in-ux-design-3fc64614d3ef)
- 日付入力は無効な書式を避けるためにデートピッカーを併用し、プレースホルダと有用なエラーメッセージで正しい形式へ誘導する（※検索要約） — [UX Planet: How to design a perfect date picker control](https://uxplanet.org/how-to-design-a-perfect-date-picker-control-7f47d1290c3a)
- レスポンシブサイトでは日付選択をフルスクリーンで再考する提案（※検索要約・2015 年） — [Yu Centrik: Think full screen — rethinking date selection](https://yucentrik.ca/en/blog/2015-12-14/think-full-screen-rethinking-date-selection-on-responsive-sites-2)
- WCAG: `<input type="date">` のような UA 既定コントロールは 2.5.8 のターゲットサイズ要件の例外（作者がサイズを変更していない限り） — [WCAG Understanding: Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- 「色だけで必須/エラーを示さない」例: 必須項目を赤文字＋アイコンで示す — [WCAG Understanding: Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)

### Inferences
- **予約フローの階層**: 1 画面 1 決定（メニュー → 日付 → 時間 → 情報入力 → 確認）。各画面のトップに「今どこか」のステップ表示（小さく）、中央に主要選択、下部固定に単一の主要 CTA。見出しは Lato 700 の英語＋Noto Sans JP の日本語を 2 段（または言語切替）で、サイズ差 1.5 倍以上をつける。
- **カレンダーへのゲシュタルト適用**: 共通領域（カードの中に月ヘッダ＋曜日行＋日付グリッド）、類同（選択可能日は同一スタイル、不可日は同一の淡色＋斜線）、近接（月送りボタンは月名の両脇に、グリッドから 16px 以上離す）、連続（週の 7 列を等幅で揃える）、図と地（選択中の日はバーガンディ塗り＋ベージュ文字で唯一の強いコントラスト）。時間枠は日付の直下に「同じカード内」で表示し、別カードに分けると関係性が切れる。
- **フォーム**: ラベルは上置き（左ラベルは日本語の長さ差と英語併記に弱い）、ラベル–入力の間隔 4–8px、フィールド間 16–24px、グループ間 32px。必須は「必須/Required」バッジ＋アイコン、エラーは赤＋アイコン＋文言（色のみ禁止）。
- **バイリンガルの階層**: 日英を常に同時表示すると情報密度が倍になり階層が崩れるため、言語トグル（`/ja` `/en` ルート）を基本とし、固有名詞（メニュー名）だけ併記する。

### Gaps
- カレンダーグリッドに近接原則を具体的に適用した一次ガイド（NNgroup や Carbon/Material の Date picker パターン）は到達不能で未確認。
- NNgroup のフォーム/カレンダー UX 記事は検索上限により未取得。

---

## 5. デザイントークン（CSS 変数 / Tailwind テーマ、ライトとダーク）

### Takeaway
Tailwind v4 では `@theme` のトークンがそのままユーティリティと CSS 変数になる。ダーク対応は「プリミティブ色を `:root`/`.dark` で定義 → セマンティック名を `@theme inline` で参照」の 2 層にし、`@custom-variant dark` でクラス/`data-theme` 切替にする。

### Cited Findings
- `@theme` で定義した変数（例 `--color-mint-500`）は対応ユーティリティ（`bg-mint-500`）を生成し、通常の CSS 変数としても出力されるため `var(--color-mint-500)` で参照できる。ユーティリティに紐付けない変数は `:root` に置く — [Tailwind CSS docs: theme](https://tailwindcss.com/docs/theme)
- 名前空間: `--color-*`（色）、`--font-*`（font-family）、`--text-*`（font-size、`--text-base--line-height` のように行間を併記可）、`--font-weight-*`、`--breakpoint-*`（バリアント）、`--spacing-*`、`--container-*` 等。`--color-*: initial` で既定パレットを全消去して独自パレットのみにできる。`--spacing: 4px` のように基準値を変えられる — [Tailwind CSS docs: theme](https://tailwindcss.com/docs/theme)
- `@theme inline { --font-sans: var(--font-inter); }` のように `inline` を付けると、ユーティリティは変数参照ではなく「値」を展開する。inline を使わないと CSS 変数の解決順の都合で予期しない値になることがある — [Tailwind CSS docs: theme](https://tailwindcss.com/docs/theme)
- ダークモードは既定で `prefers-color-scheme`。手動切替は `@custom-variant dark (&:where(.dark, .dark *));` または `@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));` で上書きし、`localStorage.theme` と `matchMedia('(prefers-color-scheme: dark)')` を組み合わせて `html` にクラス/属性を付ける — [Tailwind CSS docs: dark mode](https://tailwindcss.com/docs/dark-mode)
- コミュニティの実務知見（※検索要約）: 色値は `:root` と `.dark` に置き、`@theme inline` でセマンティック名（`--color-background` 等）に割り当てると `bg-background` が自動で切り替わり `dark:` バリアントが不要になる。`.dark { @theme {} }` のネストは v4 で不可。一方で「ダークで変わる色に `@theme inline` を使うな」とする解説もあり、これは「`@theme inline` の中で**リテラル値**を書くと固定される」という意味で、`var()` 参照を inline する分には問題ない — [skills.sh: oakoss tailwind](https://skills.sh/oakoss/agent-skills/tailwind), [sharedcontext: tailwind-v4-dark-mode](https://sharedcontext.ai/skills/external/lohnim/tailwind-v4-dark-mode), [skillselion: ia-tailwind-css](https://skillselion.com/skills/iliaal/whetstone/ia-tailwind-css)
- M3 のカラーロール（primary / on-primary / surface / on-surface / surface-container 階層 / outline 等）はライト/ダークでトーンが入れ替わる設計 — [Material Components Android: Color theming](https://github.com/material-components/material-components-android/blob/master/docs/theming/Color.md)
- Material のモーショントークンは easing 7 種＋duration 16 種のセマンティック・スロットとして提供される（詳細は §7） — [Material Components Android: Motion theming](https://github.com/material-components/material-components-android/blob/master/docs/theming/Motion.md)
- next/font は `variable: '--font-lato'` のように CSS 変数名を宣言でき、その変数を Tailwind の `--font-*` に接続できる — [Next.js docs: Font Module](https://nextjs.org/docs/app/api-reference/components/font)

### Inferences
- **推奨トークン構成（3 層）**
  1. プリミティブ（`:root` に生値）: `--burgundy-40: #7c0000` …、`--paper-98: #f4ecdd`、`--ink-10: #191919`、`--paper-texture: url(/textures/kraft.webp)`。
  2. セマンティック（`:root` と `[data-theme=dark]` で切替）: `--bg`, `--bg-elevated`, `--fg`, `--fg-muted`, `--accent`, `--on-accent`, `--border`, `--ring`, `--status-open`, `--status-few`, `--status-full`, `--status-closed`。
  3. Tailwind 接続（`@theme inline`）: `--color-bg: var(--bg)` … → `bg-bg`, `text-fg`, `bg-accent`。フォントは `--font-sans: var(--font-lato), var(--font-noto-sans-jp), sans-serif`、`--font-display: var(--font-lato)`。
- 例:
  ```css
  @import "tailwindcss";
  @custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));
  :root { --bg:#f4ecdd; --fg:#191919; --accent:#7c0000; --on-accent:#f4ecdd; --fg-muted:#5c5046; --border:#c9b99a; }
  [data-theme=dark] { --bg:#191919; --fg:#f4ecdd; --accent:#d9777b; --on-accent:#191919; --fg-muted:#b8b0a4; --border:#3a3632; }
  @theme inline {
    --color-*: initial; /* 既定パレットを捨てブランド専用に */
    --color-bg: var(--bg); --color-fg: var(--fg); --color-accent: var(--accent);
    --font-sans: var(--font-lato), var(--font-noto-sans-jp), system-ui, sans-serif;
    --text-base--line-height: 1.7;
    --breakpoint-sm: 40rem;
  }
  ```
- テーマ切替は `html[data-theme]` を SSR 前に決めるインラインスクリプト（FOUC 回避）＋`color-scheme: light dark` を宣言し、ネイティブ UI（デートピッカー、スクロールバー）も追従させる。
- トークン名は「用途」（`--status-open`）で付け、色名（`--green`）を避けると、色覚対応で色相を変えてもコードが変わらない。

### Gaps
- Tailwind 公式ドキュメントには「`:root` + `@theme inline` によるセマンティックダークトークン」のパターンそのものの記述は見つからず、コミュニティ知見のみ（挙動自体は `inline` の仕様説明から導ける）。
- Design Tokens Community Group（W3C DTCG）の JSON 形式は未調査。

---

## 6. バーバー／メンズグルーミングの美的トレンド（2024–2026）と優良サイトの特徴、プレミアムと安っぽさの分かれ目

### Takeaway
取得できた事例レビューは「予約導線をすべてのページ上部に置き、サイト内で完結させる」「暗色または落ち着いたエディトリアル調＋余白＋高品質写真」「料金の透明表示」「ヴィンテージ要素は控えめに」という共通項を示す。2025–26 年の体系的トレンド記事は取得できず、ここは一次資料不足。

### Cited Findings
- 100 以上のバーバーサイトをレビューした記事（2026）: 予約をすべてのページの最上部に置き、プロセス全体をサイト内で完結させる（代表例はポップアップ型で訪問者がページを離れない）。レビュー対象の約 80% が Squarespace、予約ツールは Boulevard が最多で Squire、Square Appointments が続く（※検索要約） — [NanoGlobals: Barbershop Websites — 20 Design Examples (2026)](https://nanoglobals.com/barbershop-websites/)
- Winterthur のバーバー「Barbury」の事例: ダークでエディトリアルな視覚言語、ゆとりあるタイポグラフィ、高品質なライフスタイル写真、豊富な余白、絞り込んだ配色、抑制されたナビ、わかりやすくパッケージ化された料金表（※検索要約） — [Sidora: Barbury — Premium Website for the Barbershop in Winterthur](https://www.sidora.ch/en/projects/barbury-premium-barbershop-website)
- 「ほとんどのバーバーサイトは同じに見える」と批判する制作者の投稿。2026 年の事例では汎用カレンダーではなく実際の営業時間を JS で強制し、WhatsApp に予約を流す設計、スローモーションの「シネマグラフ」でインタラクティブ性を出す事例（※検索要約） — [Contra: Most barbershop websites look exactly…](https://contra.com/p/3eU2cP2b-most-barbershop-websites-look-exactly), [Contra: Redesign of Villa Carlos Paz Barbershop Site](https://contra.com/community/2qUsiNWv-revolutionary-redesign-of-villa-carlos-paz)
- 優良事例集では「ヴィンテージ・バーバー文化とモダンなひねりの融合」「カットの種類ごとの明確な料金」が評価されている（※検索要約） — [CyberOptik: Best barber shop websites](https://cyberoptik.net/blog/best-barber-shop-websites)
- WordPress のバーバーテーマはヴィンテージ調のタイポグラフィとイメージを特徴とする（※検索要約） — [WordPress.org: Classic Barbershop theme](https://ibo.wordpress.org/themes/classic-barbershop/)
- 国内美容室サイト 15 選（2025 年 1 月更新）: 白基調シンプル＋大きなトップ画像、フルスクリーン動画など。「サイトの雰囲気が来店の決め手になる」（※検索要約） — [imitsu: 美容室のスタイリッシュな Web デザイン](https://imitsu.jp/matome/hp-design/2623271461528543)
- 理容室向け予約ページ要件（SimplyBook）: ブランド・サービス・料金・営業時間を明確に表示、既存サイトへのウィジェット埋め込み、SMS/メール自動通知で無断キャンセルを減らす（※検索要約） — [SimplyBook.me: Barber shop booking system](https://simplybook.me/ja/scheduling-system-for-hair-and-beauty-services/barber-shop-booking-system)
- Canva のバーバー向けテンプレートは黒×ゴールドのクラシック調が多い（※検索要約） — [Canva: 理容室テンプレート](https://www.canva.com/ja_jp/templates/s/riyoushitsu/)

### Inferences
- **プレミアムに見える条件（事例の共通項から）**: (1) 配色を 2〜3 色に絞る（ベージュ・バーガンディ・チャコールはまさにこれ）、(2) 大きな余白と大きめの見出し（Lato 700 uppercase をトラッキング広めで）、(3) 写真は統一トーン（§8）、(4) 料金とメニューを隠さず表形式で、(5) 予約 CTA が常に 1 タップ以内、(6) ヴィンテージ要素（ポール、ヒゲ、罫線飾り、スタンプ風ロゴ）は「1 画面 1 つ」程度に抑える。
- **安っぽく見える要因（逆から推定）**: テンプレ感のあるストック写真、黒×金のグラデーション、複数のディスプレイ書体混用、過剰なドロップシャドウ、外部予約サイトへ飛ばして世界観が切れる、料金非表示。
- **Neuer Barber の方向性**: 「クラシック・アメリカン × 現代的ミニマル」= 紙テクスチャとバーガンディで温度感、レイアウトはグリッドと余白で現代的に。ダーク一辺倒の海外バーバー調とは差別化できる（ベージュ基調のライトテーマは珍しい）。訪日客向けには英語トグルと国際的に通じる記号（○△×、時計アイコン）、Google マップ埋め込み、料金の税込表記を明示。
- 予約導線はヒーロー直下と下部固定の 2 箇所、全ページ共通。「スタイリスト 1 名」であることを強み（指名不要・担当固定）として UI 上で明示すると、海外客の不安（誰が切るのか）を減らせる。

### Gaps
- 2024–2026 年の「ネオバーバー／ミニマル」トレンドを体系化した記事（awwwards、siteinspire、Behance 等）は検索上限・ホスト制限で未取得。
- 日本国内のバーバー（理容室）専門サイトの優良事例の一次確認はできていない（imitsu は美容室中心）。
- 「プレミアム vs 安っぽい」を実証した調査（ユーザーテスト等）は見つからず、上記は事例の共通項からの推定。

---

## 7. マイクロインタラクションとモーション（持続時間、イージング、reduced-motion）

### Takeaway
Material 3 のトークンをそのまま採用するのが堅実: duration は short1–4 (50/100/150/200ms)、medium1–4 (250–400ms)、long1–4 (450–600ms)、extra-long (700–1000ms)；easing は standard `cubic-bezier(0.2,0,0,1)`、emphasized-decelerate `(0.05,0.7,0.1,1)`、emphasized-accelerate `(0.3,0,0.8,0.15)`。移動距離が大きいほど長く、頻繁な操作には動きを足さない（HIG）。`prefers-reduced-motion: reduce` では移動系を止め、短いフェードだけ残す。

### Cited Findings
- Material のモーションシステム（MDC Android、M3 準拠）: イージング 7 種 — standard `cubic-bezier(0.2, 0, 0, 1)`（画面内で始まり終わる実用的アニメーション）、standard-decelerate `(0, 0, 0, 1)`（入場）、standard-accelerate `(0.3, 0, 1, 1)`（退場）、emphasized（パス `M 0,0 C 0.05,0 0.133333,0.06 0.166666,0.4 C 0.208333,0.82 0.25,1 1,1`、M3 らしい強調アニメーション）、emphasized-decelerate `(0.05, 0.7, 0.1, 1)`、emphasized-accelerate `(0.3, 0, 0.8, 0.15)`、linear `(0, 0, 1, 1)` — [Material Components Android: Motion theming](https://github.com/material-components/material-components-android/blob/master/docs/theming/Motion.md)
- 持続時間 16 種: Short1 50ms / Short2 100 / Short3 150 / Short4 200 / Medium1 250 / Medium2 300 / Medium3 350 / Medium4 400 / Long1 450 / Long2 500 / Long3 550 / Long4 600 / ExtraLong1 700 / ExtraLong2 800 / ExtraLong3 900 / ExtraLong4 1000ms。「一般に、アニメーションの面積や移動距離が大きいほど duration を長くする」 — [Material Components Android: Motion theming](https://github.com/material-components/material-components-android/blob/master/docs/theming/Motion.md)
- Flutter の実装でも同値（`Durations.short1` = 50ms … `extralong4` = 1000ms、`Easing.standard` = Cubic(0.2,0,0,1)、`emphasizedDecelerate` = Cubic(0.05,0.7,0.1,1)、`emphasizedAccelerate` = Cubic(0.3,0,0.8,0.15)、legacy = Cubic(0.4,0,0.2,1)） — [flutter/flutter: material/motion.dart](https://github.com/flutter/flutter/blob/master/packages/flutter/lib/src/material/motion.dart)
- Apple HIG Motion: 目的のある動きだけを加え、動きを唯一の情報伝達手段にしない（ハプティクス/音等で補完）。フィードバック動作は短く正確に。頻繁に起こる UI 操作にはカスタムの動きを加えない。人がアニメーション完了を待たずに操作できる（キャンセル可能）ようにする — [Apple HIG: Motion](https://developer.apple.com/design/human-interface-guidelines/motion)
- Apple HIG Accessibility: 動きに敏感な人は「視差効果を減らす（Reduce Motion）」設定を使うため、それに応答する — [Apple HIG: Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- `@media (prefers-reduced-motion: reduce)` は、ユーザーが非本質的な動きを最小化するようシステムに要求しているかを検出する（値: `no-preference | reduce`） — [CSS Media Queries Level 5: prefers-reduced-motion](https://drafts.csswg.org/mediaqueries-5/#prefers-reduced-motion)
- WCAG 2.1 SC 2.3.3 Animation from Interactions (AAA): 操作に伴う非本質的アニメーション（パララックス等）は無効化できること。前庭障害の人にはめまい・吐き気・頭痛を引き起こしうる。対策は「不要なアニメーションを避ける」「オフにする操作を提供」「OS/UA の reduce motion 設定を利用」のいずれか — [WCAG Understanding: Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)
- 二次情報の実務値（※検索要約）: UI アニメーションは概ね 300ms 未満、150–180ms が大半の遷移の「中間域」; 別のエッセイでは操作確認 ~100ms、ホバー/フェード 150–200ms、展開/折りたたみ 250–300ms、ページ遷移/モーダル 300–400ms — [Funnel design guidelines: 7 animation principles](https://gunnel.funnel.io/18/01-guidelines/7_animation-principles), [Blake Crosley: Motion Grammar](https://blakecrosley.com/es/blog/motion-grammar-when-animation-earns-its-frames)
- NNgroup の応答時間記事を引用する W3C メーリングリスト投稿（二次）: 100ms は「即時」に感じられ、モーダルのような大きな変化には 200–300ms が適切（※検索要約） — [www-style archive (Bramus via GitHub, 2025-04)](https://lists.w3.org/Archives/Public/public-css-archive/2025Apr/0702.html)
- reduced-motion 時は `transition-duration: 100ms; transform: none` でフェードのみ残すコミュニティパターン（※検索要約） — [react.doctor: no-long-transition-duration](https://www.react.doctor/docs/rules/react-doctor/no-long-transition-duration)

### Inferences
- **予約サイトのモーション辞書**: ボタン押下フィードバック 100ms（short2）/ standard；ホバー・フォーカスリング 150ms（short3）；時間枠チップの選択トグル 150–200ms（short3–4）；ボトムシート/モーダル入場 300ms（medium2）emphasized-decelerate、退場 200ms（short4）emphasized-accelerate；月の切替（カレンダーの横スライド）250ms（medium1）standard；ステップ遷移 300–400ms；トースト表示 250ms。ページ全体のパララックスやスクロール連動アニメは不採用（2.3.3 と「頻繁な操作に動きを足さない」に従う）。
- **reduced-motion 実装**: Tailwind の `motion-safe:`/`motion-reduce:` バリアントで、`motion-reduce:transition-none` または `motion-reduce:duration-100` ＋ `motion-reduce:transform-none`、カレンダー月送りはスライドなしの即時置換（フェード 100ms のみ）。
- **バーバーらしい演出**は、ロゴのバーバーポール回転のような「動くブランド要素」をヒーローに 1 つだけ（ループ 4–6 秒、低コントラスト、reduced-motion で静止画に）。HIG「暗い背景で明るいものが動く」を避けるため、ダークテーマでは回転を止めるか輝度を下げる。
- Tailwind のトークン化: `@theme { --ease-standard: cubic-bezier(.2,0,0,1); --ease-emph-in: cubic-bezier(.05,.7,.1,1); --ease-emph-out: cubic-bezier(.3,0,.8,.15); }` で `ease-standard` 等のユーティリティを生成。

### Gaps
- M3 公式サイトの「Applying easing and duration」ページ（どのコンポーネントにどのトークンを割り当てるかの表）は到達不能。
- M3 Expressive（2025）で導入されたスプリング（物理ベース）モーションの公式仕様は未取得（検索要約に「springs defined by stiffness, damping」の言及のみ）。
- NNgroup の一次記事は未取得。

---

## 8. アイコンと画像（写真の処理、テクスチャ背景上のロゴ使用）

### Takeaway
取得できた一次情報は HIG（コントロールとコンテンツの区別、背景画像の扱い、P3/sRGB、Reduce Motion）と WCAG（非テキストコントラスト、画像内テキスト）に限られる。実務推奨は「写真は 1 つのトーン処理に統一（暖色・低彩度・コントラスト強め）」「ロゴは紙テクスチャ上でも 3:1 以上を確保できる単色版（バーガンディ or チャコール）を用意」「テクスチャは低コントラスト（輝度差 ±3〜5%）に抑えて文字コントラスト測定の最悪値で判定」。

### Cited Findings
- WCAG: 画像化されたテキスト（画像内に描画された文字）にもコントラスト要件が適用される（1.4.5 Images of Text 参照）。写真に偶然写った看板等の付随的テキストは対象外 — [WCAG Understanding: Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- WCAG 1.4.11: 意味を持つグラフィック（アイコン）は隣接色に対して 3:1 以上。細い線・形状は実効コントラストが落ちるので避ける — [WCAG Understanding: Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
- Apple HIG Layout: 全画面背景コンテンツはサイドバー/ツールバー/タブバーの下まで延長する。背景画像を拡大してコンポーネントが重要部分を覆う場合は、画像を反転・ぼかして延長する「background extension effect」を使える。コントロールはコンテンツと視覚的に区別する — [Apple HIG: Layout](https://developer.apple.com/design/human-interface-guidelines/layout)
- Apple HIG Color: 背景色は伝えたいことがあるときに使い、単なる視覚的装飾として使わない。P3 色は sRGB ディスプレイでも概ね問題ないが、非常に近い 2 色の区別やグラデーションのクリッピングが起こりうる。P3 画像は 16bit/ch の PNG で書き出す — [Apple HIG: Color](https://developer.apple.com/design/human-interface-guidelines/color)
- Apple HIG Typography: 細いウェイトのカスタムフォントは推奨サイズより大きくする。視認性テストで読みにくければ、サイズ拡大・コントラスト増・背景シェイプ追加で対処 — [Apple HIG: Typography](https://developer.apple.com/design/human-interface-guidelines/typography)
- Apple HIG Motion: 動きを唯一の情報伝達手段にしない。SF Symbols 5 以降はシンボル自体にアニメーションを適用可能（Web では該当なし、概念参考） — [Apple HIG: Motion](https://developer.apple.com/design/human-interface-guidelines/motion)
- 事例: 高品質なライフスタイル写真＋ダークでエディトリアルなトーンがプレミアム感に寄与（※検索要約） — [Sidora: Barbury](https://www.sidora.ch/en/projects/barbury-premium-barbershop-website)
- 事例: スローモーションの「シネマグラフ」でインタラクティブ性（※検索要約） — [Contra: Villa Carlos Paz Barbershop redesign](https://contra.com/community/2qUsiNWv-revolutionary-redesign-of-villa-carlos-paz)

### Inferences
- **写真の処理方針**: すべての店舗/施術写真に同一のカラーグレード（暖色寄りのハイライト、やや落とした彩度、黒を #191919 近辺に締める）を当て、ベージュ背景と馴染ませる。モノクロ＋バーガンディの「2 トーン（duotone）」処理はヴィンテージ感とパレット統一に有効だが、顔色が不自然になるため人物写真は控えめに。アスペクト比はカード 4:5（モバイル縦）とヒーロー 3:2/16:9 の 2 種に固定し、`next/image` で WebP/AVIF 配信、LCP 画像は `priority`。
- **ロゴ運用**: フルカラー版（バーガンディ＋チャコール）、単色バーガンディ版、単色チャコール版、ダーク用ベージュ版の 4 バリアントを SVG で用意。紙テクスチャ上では細い線（ヒゲの輪郭等）が埋もれるため、小サイズ（高さ 24–32px）用に線を太くした簡略版（ポールのみ等）を作る（HIG「細い線は避ける」、WCAG 1.4.11 の 3:1 に準拠）。ロゴ周囲のクリアスペースはロゴ高さの 1/2 以上。
- **テクスチャ背景**: クラフト紙テクスチャは輝度差を小さく（最明部と最暗部で ±3〜5%）、タイル（256–512px、WebP、`background-repeat`）＋ベースカラー #f4ecdd の上に `mix-blend-mode: multiply` で重ねる。文字コントラストは「テクスチャの最暗ピクセル vs 文字色」で測定し AA を満たす（#191919 の文字なら余裕 14.98:1、#5c5046 のミュート文字は 6.65 なので ±5% の暗部でも AA 維持見込み）。入力欄やカードは無地（テクスチャなし）にしてフォーム可読性を確保し、図と地の区別も作る。
- **アイコン**: 1 セットに統一（Lucide 等のストロークアイコン、ストローク 1.5–2px、サイズ 20/24px）。バーバー固有の記号（ハサミ、カミソリ、バーバーポール）はロゴと同じ線幅で描き起こす。ステータス記号（○△×）はアイコンではなくテキスト（スクリーンリーダー向けには `aria-label` で「空きあり/Available」）。
- **シネマグラフ/動画**: ヒーローに使うなら 5 秒以内ループ、音なし、`prefers-reduced-motion` で静止ポスターに置換、モバイル回線を考慮して 1MB 以下。

### Gaps
- 「テクスチャ背景上のロゴ使用」「写真トーン統一」に関する一次ガイド（ブランドガイドラインの標準的な作法、Smashing 等の写真処理記事）は到達不能で未取得。本節の推奨は HIG/WCAG の原則と事例の共通項からの推定。
- Lucide / Phosphor 等アイコンセットの公式仕様（ストローク幅、グリッド）は未確認。
- 不均一背景でのコントラスト測定法について WCAG の公式手法は未確認（実務では最悪値で判定）。
