# 07 コンポーネント設計・デザイントークン・メッセージ名前空間

## 文書情報

| 項目 | 内容 |
|---|---|
| 文書 ID | DES-07 |
| 版 | v0.6 |
| 日付 | 2026-10-12 |
| 変更履歴 | v0.6（2026-10-12）: レビュー修正の反映。`BookingActions` に「直前の状態に戻す」、`HoursSettings` の日次サマリー時刻を表示のみに、`MenusSettings` の最終開始プレビューを枠刻みに揃える（03_screen_specs.md 11 章）。v0.5（2026-10-12）: 実装との同期。2〜4 章の部品名・置き場所・props を実装に合わせ、設計名との対応を備考に記載（管理部品は `features/admin/components` に集約、予約下書きは `draft.ts`、TanStack Query は不使用）。5 章はトークン値の正本が `tokens.css`（DG-001）に移ったことと実装の `--danger`、5.3 を `globals.css` の `@theme inline` に合わせる。6 章の名前空間（`docs`・`tokusho` を追加、`admin`・`push` は messages に置かない）。v0.4（2026-10-12）: 要件定義書 v0.6 の反映。`MenuCard` に情報表示の `variant="info"`（S-C-01、リンクなし・フォーカスなし）を追加し `MenuSummary` は 9 件すべてを表示、`BookCta` の文言を「予約する / Book」に固定し `menuSlug` を廃止（OI-25）、`MenuStep` の固定 CTA はメニュー選択後に表示、`MonthCalendar` の `selectedDate` 既定 = 今日（OI-24）、`InstagramLink` のアカウント確定（`@neuer.kento`、OI-23）と DM リンク `https://ig.me/m/neuer.kento`。v0.3（2026-10-12）: 要件定義書 v0.5 の反映。`WeekStrip` を廃止し `MonthCalendar`＋`DayCell`（月グリッド、ロービング tabindex）に置換（F2）、`PhoneFallback`・`phoneHref` を廃止し `InstagramLink` を追加（F3）、トップの `Hero`（写真のみ）・`AccessSection`（受付時間を統合）・`LanguagesNote` を明記（F1）、6 章の名前空間を更新。v0.2（2026-10-10）: 要件定義書 v0.4 の反映。`ShareCopyButton`、`SlotList` の × 行（非活性の `SlotRow`）、`SelectionSummary`（S-C-02b）、`OtpFallbackForm`、ブロックのプリセット変更、ステップ順序の固定 |
| 関連要件 | FR-C-01〜16, FR-A-02〜18, NFR-PF-01, NFR-PF-02, NFR-EN-03〜07, AT-09, AT-10, AT-24, AT-25 |
| 関連文書 | `02_screens.md`（画面ごとの使用コンポーネント）、`docs/05_design_comps/`（デザインガイド。トークン値の正本はデザインガイド確定後にそちら） |

---

## 1. 方針

| # | 方針 | 内容 |
|---|---|---|
| C-01 | Server Component が既定 | `"use client"` は操作が必要な葉に限定。境界の props はシリアライズ可能な DTO のみ |
| C-02 | UI プリミティブは `components/ui`、機能部品は `features/*/components` | プリミティブはドメインを知らない。機能部品は feature 外から import しない（ページで合成）。顧客サイトのページ専用部品は `app/(public)/_components` |
| C-03 | ネイティブ要素優先 | ラジオ・チェック・`<dialog>`・`<input type="time">` を使い、ARIA は不足分のみ。JS 前でも基本操作が可能 |
| C-04 | 状態の置き場所 | 予約下書き: `features/booking/draft.ts`（`sessionStorage`＋`useSyncExternalStore`。Context は使わない）。管理のサーバー状態: RSC＋Server Action 内の `refresh()`、未確認件数のポーリングは `InboxProvider`（TanStack Query は使わない） |
| C-05 | トークン経由のスタイル | 色・余白・角丸・モーションは CSS 変数（5 章）のみ参照。生の色コードをコンポーネントに書かない |
| C-06 | バンドル予算 | 公開ページ First Load JS ≤ 150 kB、予約フォーム ≤ 200 kB（NFR-PF-02。計測の CI ゲートは未導入）。日付処理はサーバー側で整形し、クライアントは `Intl` のみ（日付ライブラリ・`temporal-polyfill` は使わない） |

---

## 2. UI プリミティブ（`src/components/ui`）

実装名と設計名（v0.4 まで）が異なるものは備考に設計名を書く。

| コンポーネント | 種別 | 主な props | 備考・a11y |
|---|---|---|---|
| `Button` / `LinkButton` / `ExternalButton`（＋`buttonClass()`） | Server 可 | `variant: 'primary'\|'secondary'\|'ghost'\|'danger'\|'danger-fill'`, `size: 'md'\|'sm'`, `block?`, `icon?`, `trailingIcon?` | 高さ primary 56 / secondary 48 / `sm`・ghost 44 px。無効は `aria-disabled`（フォーカス可、押すと理由を表示）で薄くしない。`LinkButton` は next-intl の `Link`、`ExternalButton` は新規タブ＋`rel="noopener noreferrer"`。ラベルは動詞（HE-04） |
| `Card` | Server | `as?`（要素を差し替え）, `className` | 無地のカード面＋淡い罫＋接地影。紙テクスチャには載せない |
| `FieldWrapper` / `FieldError` | Server | `id`, `label`, `tag?: { text, optional? }`, `help?`, `error?`, `errorPrefix`, `children(aria)` | 設計名 `Field`。ヘルプは欄の上、エラーは欄の直下。`aria-describedby` はエラー→ヘルプの順、エラー文の前に視覚的に隠した「エラー: 」。色だけに頼らない（2px 枠＋「!」） |
| `TextInput` / `TextArea` | Server（ネイティブ要素の props） | `name`, `type`, `inputMode`, `autoComplete`, `maxLength` … | 高さ 48 px、文字 16 px（iOS のズーム回避）。残り文字数の表示は呼び出し側 |
| `RadioGroup` | Client から使う | `name`, `value`, `options: { value, label }[]`, `onChange`, `labelledBy`, `describedBy?`, `invalid?` | `<label>` 内のネイティブラジオ（JS 前でも操作可）。選択は点＋2px 枠＋太字（えんじは使わない） |
| `Checkbox` | Server | `name`, `label`, `checked`, … | ラベル全体がターゲット（56 px 以上。同意欄） |
| `Sheet`（`dialog.tsx`） | Client | `open`, `onClose`, `titleId`, `descriptionId?`, `initialFocus?` | 設計名 `Dialog`・`Sheet`。`<dialog>`＋`showModal()`（フォーカス閉じ込め・背景 inert・Esc）。閉じたらトリガーへフォーカス返却 |
| `Toast` | Client | `message`, `duration=5000` | `role="status"`、フォーカスを奪わない。管理 PWA は Undo 付きの別実装（4 章 `ToastProvider`） |
| `CopyButton` / `ShareCopyButton` | Client | `value` または `url`・`title`・`text?`、`label`, `copiedLabel`, `liveMessage` | Clipboard API。失敗時は選択状態にする。「コピーしました ✓」を 2 秒（幅固定）、`aria-live` で通知。`ShareCopyButton` は `navigator.share` があれば共有シート、未対応または `AbortError` 以外の失敗でコピー（FR-C-11、CW-15） |
| `Stepper` | Server | `steps`, `current`, `label`, `doneSuffix` | `<ol>`、完了＝輪＋✓、現在＝塗り＋`aria-current="step"`。アクセント色は使わない |
| `SiteHeader` / `FlowHeader` / `MiniHeader` | Server（`LocaleSwitch` のみ Client） | `showBookCta?` / `back` / — | トップ・ポリシー・404 は `SiteHeader`（エンブレム＋「予約する」）、予約ステップは `FlowHeader`（←・「ご予約」・EN・Instagram）、完了・キャンセルは `MiniHeader`。電話リンクは持たない |
| `Footer` | Server | `showInstagram?` | 設計名 `SiteFooter`。Instagram DM・ポリシー 3 行（プライバシー・キャンセルポリシー・特商法表記）・© |
| `InstagramLink` | Server | `variant: 'header'\|'footer'\|'done'\|'button'\|'plain'\|'primary'\|'profile'\|'inline'` | 顧客の唯一の連絡手段（FR-C-16）。問い合わせは DM（`https://ig.me/m/{account}`）、`profile` はプロフィール。常に新規タブ。URL・アカウントは `config/shop.ts`（`@neuer.kento`） |
| `LocaleSwitch` | Client | — | 設計名 `LocaleSwitcher`。同じページの他ロケール URL（クエリを保持、`prefetch={false}`）。動的ルートでは `<Suspense>` 内で解決 |
| `BackLink` | Server | `href`, `label` | 44×44 の「←」。ラベルは行き先を言う |
| `FocusOnMount` | Client | `targetId` | 表示後に一度だけ見出し（`tabIndex={-1}`）へフォーカス |
| `Icon` | Server | `name` | インライン SVG（24 グリッド）。常に装飾扱い（`aria-hidden`）で、意味は隣の文字で伝える |

設計にあって実装で独立部品にしなかったもの: `Select`・`Badge`・`Skeleton`・`VisuallyHidden`／`LiveRegion`（各所で CSS クラス・要素を直接使う）、`Combobox`（`ManualBookingForm` 内に WAI-ARIA combobox を実装）、`ErrorSummary`（`ConfirmForm`・`BookingInfoForm` 内）、`StickyCta`（CSS クラス `.sticky-cta`）。

---

## 3. 顧客サイトの機能コンポーネント

| コンポーネント | 置き場所 | 境界 | 主な props / 状態 | 使用画面 | 関連 FR |
|---|---|---|---|---|---|
| `Hero` | `app/(public)/_components` | Server | `config/shop.ts` の `heroPhoto`（未設定の間は CSS のプレースホルダー、設定後は `next/image` の `priority`）。写真のみでキャッチコピーを持たない（F1） | S-C-01 | FR-C-14 |
| `AccessSection` | 同上 | Server | `hours: HoursSummary`（`domain/hours.ts` の `summarizeHours(getWeeklyHours())`）, `leadTimeMin`。店名・住所 2 行・徒歩・受付時間 2 行・「地図を開く」。単独の受付時間カードは持たない | S-C-01 | FR-C-14 |
| `JsonLd` | 同上 | Server | `data`（`<` を `\u003c` にエスケープ）。トップの `HairSalon`（`telephone` なし） | S-C-01 | FR-C-14 |
| `DocPage` | 同上 | Server | 見出し・版・目次・H2 節・表。本文は messages（`privacy`・`policy`・`docs`） | S-C-08, 09 | FR-C-15 |
| `MenuInfoCard` | `features/booking/components` | Server | `menu: MenuCatalogItem`。設計の `MenuCard variant="info"`（`<article>`、リンク・フォーカス・hover なし。非公開メニューも「¥—」で表示）。トップはこれを 9 件並べる（設計の `MenuSummary` はページ内に直接） | S-C-01 | FR-C-02, 14 |
| （「予約する」CTA・対応言語） | `app/(public)/[locale]/page.tsx` | Server | 設計の `BookCta`・`LanguagesNote` は独立部品にせず、`LinkButton href="/book"`（「予約する / Book」、OI-25）と見出し＋本文で直接描画 | S-C-01, 10 | FR-C-01, 14 |
| `MenuStep` | `features/booking/components` | Client | `menus: MenuStepItem[]`。設計の `MenuCard variant="select"`（ラジオカード、一般・学生の両価格・所要時間）と固定 CTA「空き時間を見て予約する / See available times」（選択後のみ表示）を内包。選択は `?menu=` と下書きに保存 | S-C-02 | FR-C-01, 02 |
| `Yen` / `yenText` | 同上 | Server | `amount`, `unsetSr`。0 は未確定（OI-01）として「¥—」と読み上げ用ラベル | S-C-01〜05 | FR-C-02 |
| `BookingStepper` / `StepAnnouncer` | 同上 | Server | `current: 'menu'\|'time'\|'info'\|'confirm'`（1 メニュー / 2 日時 / 3 お客様情報 / 4 確認）。`StepAnnouncer` は「ステップ 3/4: お客様情報」を `aria-live` で通知 | S-C-02, 03, 02b, 04 | FR-C-01 |
| （予約下書き） | `features/booking/draft.ts` | Client（フック） | 設計の `BookingDraftProvider` は Context にせず、`sessionStorage`（`bb.bookingDraft.v1`）の下書きを `useDraft()`（`useSyncExternalStore`）・`saveDraft`・`updateDraft`・`clearDraft` で読み書きする。項目 `{ menuSlug, startsAt, name, nameKana, occupation, phone, note }`、30 分無操作で破棄。`submissionNonce` は別キーで保持 | S-C-02〜04, 02b | FR-C-01 |
| `MonthCalendar` / `MonthCalendarSkeleton` | `features/availability/components` | Client（各 ◎ の日は `<Link>`） | `month`, `days: DayDTO[]`（`getMonthAvailability`）, `prevMonth?`, `nextMonth?`, `today`, `selectedDate: string \| null`（初期は今日。月送り後は `null`。OI-24）, `menuSlug`, `keep?`（`return=confirm` 等を各リンクに保持）。`<table role="grid">`、月曜始まり、日セル（設計の `DayCell`）は内部で描画。◎ の日だけがリンク（ロービング tabindex）、× と期間外はフォーカスしないセル。キーボード: ← → は前後の ◎ の日、↑ ↓ は 7 日前後（◎ でなければ週単位で探索）、Home / End、PageUp / PageDown、Enter / Space（03_screen_specs.md 2.6）。スケルトンは固定高（CLS 0） | S-C-03 | FR-C-07, 08 |
| `SlotList` / `slotHref` | 同上 | Client | `slots: { startsAt, status }[]`（JST ISO）, `menuSlug`, `durationMin`, `selectedStartsAt?`, `keep?`。全候補を行で描画し、◎ は 56 px のリンク（タップ → 150 ms の選択表示 → 次段）、×（満席・締切）は理由付きの 48 px の `<li>`（ボタン・リンク・tabindex なし）。設計の `SlotButton`・`SlotRow` は内部要素 | S-C-03 | FR-C-07, 08 |
| `SlotsFocus` | 同上 | Client | `date`。日を選び直したとき時間枠の見出しへフォーカス（初回は除く） | S-C-03 | FR-C-07 |
| （凡例・締切・固定バー） | `book/time/page.tsx` | Server | 設計の `SlotLegend`・`DeadlineNotice`・`StickyCta`「この日時で進む」はページ内で直接描画 | S-C-03 | FR-C-07 |
| `SelectionSummary` | `features/booking/components` | Client | `menu`, `startsAt`, `occupation`。メニュー（職業に応じて再計算した価格）と日時の 2 行＋各「変更」 | S-C-02b | FR-C-01, 04 |
| `BookingInfoForm` | 同上 | Client | `menus`。設計の `BookingForm`・`NameStep`／`KanaField`（ja のみ）／`OccupationStep`／`PhoneStep`（＋備考）・`StepSummary` を 1 部品にまとめた。段階は `name → occupation → phone` 固定、各段は `pushState`＋`?step=`、完了した段は 1 行の要約＋「変更」に畳む（FR-C-01）。検証は `validate.ts`（共有 Zod） | S-C-02b | FR-C-01, 03〜06, AT-09 |
| `DraftBackLink` | 同上 | Client | `to: 'time'\|'info'`, `label`。下書きを保ったまま前の段へ | S-C-02b, 04 | FR-C-01 |
| `ConfirmForm` | 同上 | Client | `menus`, `turnstileSiteKey?`, `cancelDeadlineMin`。`useActionState(createBooking)`。設計の `ConfirmBookingForm`・`CheckAnswers`・`PolicyDigest`・`ConsentCheckbox`・`Honeypot`・`ErrorSummary` を内包。`ok` で `router.replace(doneUrl)`＋下書き破棄、`slot_taken` で `/book/time?…&taken=1` へ | S-C-04 | FR-C-09, 10, 15 |
| `TurnstileWidget` | 同上 | Client | `siteKey`（props で受け取る）, `locale`, `onToken`, `resetOn?`（失敗後に新しいトークンを取得）。`action: 'create_booking'`、`appearance: 'interaction-only'`、期限切れで `reset()` | S-C-04 | FR-S-05 |
| （完了カード・カレンダー追加） | `book/done/[token]/page.tsx` | Server（`CopyButton`・`ShareCopyButton` のみ Client） | 設計の `DoneCard`・`AddToCalendar` はページ内で直接描画。スタンプ「予約確定 CONFIRMED」＋見出し「ご予約を承りました」、予約番号は `CopyButton`、キャンセルリンクは `ShareCopyButton`＋「カレンダーの予定からもキャンセルできます」、`.ics` は `/api/ics/{token}` | S-C-05 | FR-C-11 |
| `CancelFlow` / `CancelBookingCard`・`BookingWhen`・`BookingPrice`・`bookingSummary` | `features/booking/components` | Client / Server | `CancelFlow`: `token`, `locale`, `summary`, `publicCode`, `deadlineLabel`, `card`, `pastDeadline`, `notFound`。設計の `CancelPanel`＋`ConfirmDialog`（`<dialog>` のボトムシート、初期フォーカスは「予約を残す」、`cancelBooking` は「予約を取り消す」だけが送る）。締切後は「Instagram の DM でご連絡ください」＋`InstagramLink variant="primary"` | S-C-06 | FR-C-12, 16 |

---

## 4. 管理 PWA の機能コンポーネント

管理 PWA の部品はすべて `features/admin/components`（v0.4 までの `admin-calendar`・`blocks`・`settings`・`notifications`・`auth`・`customers` の各 feature は 1 つの `features/admin` にまとめた）。文言は `features/admin/strings.ts`（ja 固定）。

| コンポーネント | 境界 | 主な props / 状態 | 使用画面 | 関連 FR |
|---|---|---|---|---|
| `ToastProvider` / `useToast` | Client | 1 件ずつ表示。`undo` 付きは 5 秒のカウントダウンリング、`role="status"`。設計の `Toast`（Undo） | S-A-02〜11 | FR-A-04, 06 |
| `InboxProvider` / `useInbox` | Client | `initialCount`, `initialLatest`。`/api/admin/inbox-count` を起動・可視化時と可視中 20 秒ごとに取得（非表示で停止）、`latestChangeAt` の変化で `router.refresh()`、増加時にトースト、`setAppBadge`。設計の `InboxBadge` のポーリング部分（TanStack Query は使わない） | 全画面 | FR-A-11 |
| `PushProvider` / `usePush` | Client | `vapidPublicKey`（props）。状態 `checking`・`unsupported`・`not-standalone`・`unsubscribed`・`subscribed`・`blocked`・`no-key`。起動・可視化時に SW 登録 → `getSubscription()` → `touchPushSubscription`（未知なら再登録） | 全画面 | FR-A-09 |
| `AdminBoot` | Client | iPhone の Safari タブなら `/admin/install`（「閲覧だけ」を除く）、起動時のセッション更新（`getSession()`、1 時間に 1 回まで）、SW の `NAVIGATE` メッセージで `router.push` | 全画面 | FR-A-01, 10 |
| `TabBar` / `InboxButton` | Client | 設計の `BottomTabs`（今日・週・受信箱・設定。全画面タスクでは隠す）と `InboxBadge` の表示部分（ヘッダーの「未確認 n」） | S-A-02〜11 | FR-A-02, 11 |
| `TodayView` / `ResubscribeBanner` | Client | 今日ビューのクライアント部分（`Timeline`、FAB＋`QuickSheet`、オフライン表示）、push 未購読のバナー。日付送り・ヘッダーはページ（設計の `AdminHeader`） | S-A-02 | FR-A-02, 09 |
| `Timeline` | Client | 15 分＝1 行（28 px）、営業時間（時間外の予約があれば広げる）、予約カード（56 px 以上、別の 44 px の `tel:` ボタン）、斜線のブロック、空き区間（`aria-hidden`。同じ操作は FAB にもある）、現在線。時系列の `<ol>`。設計の `BookingCard`・`BlockCard`・`NowLine` は内部要素 | S-A-02 | FR-A-02, 06 |
| `QuickSheet` | Client | 設計の `Fab`／`QuickActionSheet`。手動予約、プリセット「今から 1 時間 / 2 時間 / 今日はここまで」「期間を指定」。開いた時点で各行の重なりを取得し、範囲・保存する種別・顧客サイトへの影響を表示。重なりのない行は 2 タップで保存、重なりがあれば「それでも…」（`force`）。空き区間のタップで同じシートをその時刻から開く | S-A-02 | FR-A-05, 06, AT-21 |
| `BlockRangeForm` | Client | 設計の `BlockForm`。種別（既定 `closed`）・開始・終了（5 分刻み、最大 60 日）・ラベル。有効予約と重なれば一覧を出し「それでもブロック」で保存 | S-A-06 | FR-A-06 |
| `ManualBookingForm` | Client | `menus`, `initialDate`, `initialStart`。下書きは `sessionStorage['bb.draft.manual']`。顧客サジェスト（WAI-ARIA combobox、250 ms デバウンス）、空き開始時刻のチップ（`free-starts`）、重なりの事前確認（300 ms デバウンス）。重なり中の操作は「時間を変更」のみ（OI-11）。保存後は確認 URL のコピー（設計の `CustomerCombobox`・`OverlapAlert`・`SavedSheet` を内包） | S-A-05 | FR-A-05, 10 |
| `BookingActions` | Client | 予約詳細の操作: 来店 → 施術開始 → 完了と「直前の状態に戻す」（`stepBackBookingStatusAction`）、3 種のキャンセル結果（即時実行＋5 秒 Undo トースト）、確認 URL の発行・再発行とコピー、店主メモ。表示時に既読化。設計の `StatusActions`・`ConfirmUrlPanel`・`OwnerNoteField`（予約内容と履歴はページで描画＝設計の `BookingDetail`・`AuditTrail`） | S-A-04 | FR-A-04, 05, 11 |
| `InboxList` | Client | `unread`, `read`, `nowIso`。未確認を先に、「すべて確認済みにする」＋Undo | S-A-07 | FR-A-10, 11 |
| `HoursSettings` | Client | 設計の `WeeklyHoursEditor`・`OverrideList`・`SlotRulesForm`。曜日テンプレートと枠ルールを 1 回で保存、オーバーライドは個別に追加・削除。日次サマリーの時刻は読み取り専用の行（Hobby では変更不可） | S-A-08 | FR-A-07, AT-22 |
| `MenusSettings` | Client | 設計の `MenuList`・`MenuEditSheet`。公開スイッチ、上下ボタンの並べ替え（WCAG 2.5.7）、編集シート（「最終開始」のプレビュー。代表的な営業時間と `slot_step_min` から `domain/hours.ts#lastStartMin` で枠刻みに揃えて計算） | S-A-09 | FR-A-08, AT-22 |
| `NotificationsPanel` | Client | 設計の `PushOnboarding`・`PushStatusCard`・`TestPushPanel`・`DeviceList`・`LogoutOthersButton`。通知をオンにする → テスト通知 → 届いた / 届かない（作り直し）、端末一覧、この端末以外をログアウト、パスキーの追加、ログアウト | S-A-10 | FR-A-09, 12, 16 |
| `SettingsNav` / `SettingsHeader` | Server | 設定のセグメント（営業時間・メニュー・通知・顧客） | S-A-08〜11 | FR-A-07 |
| `LoginPanel` | Client | 設計の `PasskeyLoginButton`・`OtpFallbackForm`。主はパスキー、フォールバックは「確認コードを送る」（`requestAdminOtpAction`）と 1 欄のコード入力（`inputmode="numeric"`、`autocomplete="one-time-code"`、6 桁で `verifyAdminOtpAction`）。マジックリンクの UI は持たない | S-A-01 | FR-A-01 |
| `InstallGuide` | Client | 設計の `InstallGuide`・`StandaloneGate`。iOS は 3 手順の図解、Android Chrome は `beforeinstallprompt` を保持してボタン 1 つ。「閲覧だけ」を選べる | S-A-12 | FR-A-09, 15 |
| `CustomerActions` | Client | 設計の `CustomerDetail` の操作部分（予約制限・JSON エクスポート・匿名化ダイアログ）。一覧・検索はページで描画（設計の `CustomerSearch`）。`MergeDialog` は未実装（Should） | S-A-11 | FR-A-13, 14 |
| `Sheet` / `Icon` | Client / Server | 管理用のボトムシート（`<dialog>`）とアイコンセット（ライト・ダークのトークンに追従） | 全画面 | — |

設計の `OfflineBanner`（Should、FR-A-17）は `TodayView` 内のオフライン表示（`navigator.onLine`＋時刻）として実装し、独立部品にしていない。`BackButton` は各ページのヘッダーの「←」リンク（戻り先を固定）で代替した。

---

## 5. デザイントークン（CSS 変数 3 層）

**v0.5 注記**: トークン値の正本はデザインガイド DG-001（`docs/05_design_comps/design_guide.md` §2、`docs/05_design_comps/tokens.css`）に移った。実装は `src/styles/tokens.css`（その写し）で第 1・第 2 層を定義し、`src/styles/globals.css` が第 3 層（Tailwind 接続）と、tokens.css に無い `--danger`・`--danger-pressed`（展開カンプ T-01）を定義する。5.1・5.2 の表は v0.2 時点の設計値の記録で、DG-001 §2.4 で置き換えた値（`--ring`・`--border`・`--surface`・`--status-*`・角丸・テクスチャ）は DG-001 を正とする。

トークン名は用途名で付け、色名（`--green` 等）は第 2 層以降で使わない。

### 5.1 第 1 層: プリミティブ（`:root`、生の値）

| 分類 | トークン | 値 | 用途メモ |
|---|---|---|---|
| えんじ | `--burgundy-95` / `--burgundy-80` / `--burgundy-70` / `--burgundy-40` / `--burgundy-20` | `#fbe9e9` / `#e8a3a3` / `#d9777b` / `#7c0000` / `#450000` | 40 = ライトのアクセント、70 = ダークのアクセント |
| 紙（ベージュ） | `--paper-99` / `--paper-98` / `--paper-95` / `--paper-90` / `--paper-80` | `#fbf7ef`（仮）/ `#f4ecdd` / `#e9dcc3` / `#d9c6a0` / `#c9b99a` | 98 = 背景 |
| インク | `--ink-10` / `--ink-15` / `--ink-25` / `--ink-35` / `--ink-70` | `#191919` / `#211f1d`（仮）/ `#3a3632` / `#5c5046` / `#b8b0a4` | 数字は明度の目安。10 = 本文・ダーク背景、15 = ダーク面、25 = ダーク罫線、35 = ミュート文字、70 = ダークのミュート文字 |
| 状態 | `--blue-35` / `--gray-60` / `--amber-60` | `#0f5f8f` / `#8a8580`（仮）/ `#e69f00` | 空きあり / 満席・休業 / 予備（残りわずか、未使用） |
| テクスチャ | `--paper-texture` | `url(/textures/kraft.webp)` | 輝度差 ±3〜5%、`mix-blend-mode: multiply` |
| フォント | `--font-lato` / `--font-noto-sans-jp` | `next/font` が注入 | Lato 400/700、Noto Sans JP variable（latin のみ preload） |
| モーション | `--duration-short2` / `--duration-short3` / `--duration-short4` / `--duration-medium2` / `--duration-medium4` | `100ms` / `150ms` / `200ms` / `300ms` / `400ms` | M3 準拠 |
| イージング | `--ease-standard` / `--ease-emph-decel` / `--ease-emph-accel` | `cubic-bezier(0.2,0,0,1)` / `cubic-bezier(0.05,0.7,0.1,1)` / `cubic-bezier(0.3,0,0.8,0.15)` | — |

（仮）はレポートに値の記載がなく、デザインガイドで確定する値。

### 5.2 第 2 層: セマンティック（`:root` と `[data-theme=dark]`）

| トークン | ライト（顧客・管理） | ダーク（管理のみ） | 用途 |
|---|---|---|---|
| `--bg` | `var(--paper-98)` | `var(--ink-10)` | ページ背景 |
| `--surface` | `#ffffff` | `var(--ink-15)` | カード・入力欄（無地） |
| `--fg` | `var(--ink-10)` | `var(--paper-98)` | 本文 |
| `--fg-muted` | `var(--ink-35)` | `var(--ink-70)` | 補足 |
| `--accent` | `var(--burgundy-40)` | `var(--burgundy-70)` | CTA・選択中（3 用途限定） |
| `--on-accent` | `var(--paper-98)` | `var(--ink-10)` | CTA 上の文字 |
| `--border` | `var(--paper-80)` | `var(--ink-25)` | 罫線 |
| `--ring` | `var(--burgundy-40)` | `var(--burgundy-70)` | フォーカスリング（2 px＋オフセット 2 px） |
| `--danger` / `--danger-pressed` | **`#a33b0b` / `#862f08`**（実装値、`globals.css`。錆色 19°、紙の上 5.61:1・カード上 6.17:1） | `#f19a9e` / `#f5b3b6`（暫定、管理のダークパレット確定まで） | 破壊的操作（キャンセル・取り消し）。えんじと区別する。v0.4 の `--on-danger` は定義しない（`.btn-danger-fill` の文字は `--on-accent`） |
| `--status-open` | `var(--blue-35)` | `#7fbde3`（仮） | 空きあり ◎ |
| `--status-few` | `var(--amber-60)` | 同左 | 予備（Phase 1 未使用） |
| `--status-full` | `var(--gray-60)` | `var(--ink-70)` | 満席 × |
| `--status-closed` | `var(--gray-60)` | `var(--ink-70)` | 定休・休業 × |
| `--overlap` | `#b3261e`（仮） | `#f2b8b5`（仮） | 重なり警告 |
| `--block-hatch` | `var(--paper-90)` | `var(--ink-25)` | ブロックの斜線 |
| `--space-gutter` | `16px`（≤640）/ `24px`（≥768） | 同左 | 左右余白 |
| `--target-min` | `44px` | 同左 | タップ領域 |
| `--radius-sm` / `--radius-md` / `--radius-lg` | `6px` / `10px` / `16px` | 同左 | 角丸 |

ダーク切替: `@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *))`（`globals.css`）。管理 PWA は `prefers-color-scheme` 追従を既定とし、設定で固定（FR-A-18、Could）。顧客サイトは Phase 1 はライトのみ。

### 5.3 第 3 層: Tailwind 接続（`@theme inline`）

```css
/* src/styles/globals.css（抜粋。@import "tailwindcss" と "./tokens.css" の後） */
@theme inline {
  --color-*: initial;                       /* 既定パレットを捨てる */
  --color-bg: var(--bg);
  --color-bg-card: var(--bg-card);
  --color-bg-sunken: var(--bg-sunken);
  --color-fg: var(--fg);
  --color-fg-muted: var(--fg-muted);
  --color-fg-subtle: var(--fg-subtle);
  --color-accent: var(--accent);
  --color-accent-pressed: var(--accent-pressed);
  --color-on-accent: var(--on-accent);
  --color-border: var(--border);
  --color-border-subtle: var(--border-subtle);
  --color-ring: var(--ring);
  --color-status-open: var(--status-open);
  --color-status-full: var(--status-full);
  --color-status-closed: var(--status-closed);
  --color-danger: var(--danger);
  --font-sans: var(--font-lato), var(--font-noto), system-ui, sans-serif;   /* next/font が --font-*-next を注入 */
  --font-num: var(--font-lato), system-ui, sans-serif;
  --spacing-target-min: var(--target-min);
  /* … */
}
```

ユーティリティ例: `bg-bg text-fg`、`bg-accent text-on-accent`、`text-status-open`、`ring-ring`。本文 16 px・行間 1.7・letter-spacing 0〜0.02em、`palt` は見出しのみ（NFR-EN-06）。

---

## 6. i18n メッセージ名前空間（`messages/ja.json`・`messages/en.json`）

| 名前空間 | 内容 | 主な使用箇所 | 関連 |
|---|---|---|---|
| `common` | ボタン共通語（次へ・戻る・変更・閉じる・コピー・コピーしました）、通貨・時刻の補助語 | 全体 | FR-C-13 |
| `meta` | ページタイトル・説明（各ページ一意） | `generateMetadata` | NFR-EN-05 |
| `nav` | ヘッダー・フッター、言語切替ラベル（「EN」/「日本語」）、予約 CTA、Instagram リンクのラベル | `SiteHeader`、`SiteFooter` | FR-C-13, 16 |
| `contact` | Instagram DM 案内の前置き文（締切後「Instagram の DM でご連絡ください」、予約制限「ご予約は Instagram の DM で承ります」、エラー時、完了画面のお問い合わせ）。電話の文言は持たない | `InstagramLink` の各文脈 | FR-C-11, 12, 16, FR-A-13 |
| `home` | 写真の代替テキスト、メニュー見出し、予約 CTA「予約する / Book」、アクセス（受付時間・定休・予約締切の行）、対応言語、Instagram 見出し、決済【要確認: OI-14】 | S-C-01 | FR-C-14 |
| `menu` | メニュー見出し、学生価格・所要時間の表記 | S-C-01, 02 | FR-C-02 |
| `booking.steps` | ステッパー（「1. メニューを選ぶ → 2. 日時を選ぶ → 3. お客様情報 → 4. 確認」）、段階見出し、`aria-live` 文言、CTA「空き時間を見て予約する」 | S-C-02, 03, 02b, 04 | FR-C-01 |
| `booking.form` | ラベル・ヒント・プレースホルダ（ふりがなは ja のみ）、要約の「変更」 | S-C-02b | FR-C-03〜06 |
| `booking.errors` | Zod・サーバーエラー文（03_screen_specs.md 1.3、06_api.md 5 章） | S-C-02, 02b, 04 | AT-06 |
| `availability` | 凡例「◎ 予約できます ／ × 予約できません」、理由ラベル（定休・満席・締切・休業）、月見出し（ICU の日付書式）、曜日略称（月〜日）、「前の月 / 次の月」（‹ › の `aria-label`）、日セルの `aria-label` テンプレート、締切、空なし（日・月）、JST 注記、「この日時で進む」 | S-C-03 | FR-C-07 |
| `confirm` | 確認見出し、同意文、ポリシー要点、確定ボタン | S-C-04 | FR-C-09 |
| `done` | 完了見出し、スクリーンショット案内、カード項目（店名・住所）、カレンダー追加、「共有・コピー」、「カレンダーの予定からもキャンセルできます」 | S-C-05 | FR-C-11 |
| `cancel` | キャンセル各状態の文言、ダイアログ | S-C-06 | FR-C-12 |
| `ics` | ICS の `SUMMARY`・`DESCRIPTION` テンプレート | S-C-07 | FR-C-11 |
| `policy` / `privacy` | 見出し・本文 | S-C-08, 09 | FR-C-15 |
| `tokusho` | 特定商取引法に基づく表記の見出し・表の行（`{handle}`・`{hours}` を差し込む） | S-C-09（`/tokusho`） | FR-C-15 |
| `docs` | ポリシー系ページ共通の語（`toc` 目次・`toTop` ページの先頭へ・`version` 版） | S-C-08, 09 | FR-C-15 |
| `errors` | 404・500・429 | S-C-10 | FR-C-16 |

管理 PWA（ja 固定、next-intl の外）の文言は messages に置かず `features/admin/strings.ts` に、Push の通知文面は `lib/notify.ts`・`features/notifications/digest.ts` に、ログインコードのメール文面は `lib/auth-email.ts` に持つ（v0.4 の `admin`・`push` 名前空間は作らない）。

規約: キーは `camelCase`、ICU MessageFormat（複数形・`{count}`）を使う。`ja.json` と `en.json` のキー集合の一致は単体テスト（`src/lib/i18n/messages.test.ts`）で強制し、「`/en` に日本語が混在しない」（FR-C-13）は E2E（`test/e2e/run.mjs` の EN フロー）でも確認する。
