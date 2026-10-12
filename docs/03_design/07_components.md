# 07 コンポーネント設計・デザイントークン・メッセージ名前空間

## 文書情報

| 項目 | 内容 |
|---|---|
| 文書 ID | DES-07 |
| 版 | v0.4 |
| 日付 | 2026-10-12 |
| 変更履歴 | v0.4（2026-10-12）: 要件定義書 v0.6 の反映。`MenuCard` に情報表示の `variant="info"`（S-C-01、リンクなし・フォーカスなし）を追加し `MenuSummary` は 9 件すべてを表示、`BookCta` の文言を「予約する / Book」に固定し `menuSlug` を廃止（OI-25）、`MenuStep` の固定 CTA はメニュー選択後に表示、`MonthCalendar` の `selectedDate` 既定 = 今日（OI-24）、`InstagramLink` のアカウント確定（`@neuer.kento`、OI-23）と DM リンク `https://ig.me/m/neuer.kento`。v0.3（2026-10-12）: 要件定義書 v0.5 の反映。`WeekStrip` を廃止し `MonthCalendar`＋`DayCell`（月グリッド、ロービング tabindex）に置換（F2）、`PhoneFallback`・`phoneHref` を廃止し `InstagramLink` を追加（F3）、トップの `Hero`（写真のみ）・`AccessSection`（受付時間を統合）・`LanguagesNote` を明記（F1）、6 章の名前空間を更新。v0.2（2026-10-10）: 要件定義書 v0.4 の反映。`ShareCopyButton`、`SlotList` の × 行（非活性の `SlotRow`）、`SelectionSummary`（S-C-02b）、`OtpFallbackForm`、ブロックのプリセット変更、ステップ順序の固定 |
| 関連要件 | FR-C-01〜16, FR-A-02〜18, NFR-PF-01, NFR-PF-02, NFR-EN-03〜07, AT-09, AT-10, AT-24, AT-25 |
| 関連文書 | `02_screens.md`（画面ごとの使用コンポーネント）、`docs/05_design_comps/`（デザインガイド。トークン値の正本はデザインガイド確定後にそちら） |

---

## 1. 方針

| # | 方針 | 内容 |
|---|---|---|
| C-01 | Server Component が既定 | `"use client"` は操作が必要な葉に限定。境界の props はシリアライズ可能な DTO のみ |
| C-02 | UI プリミティブは `components/ui`、機能部品は `features/*/components` | プリミティブはドメインを知らない。機能部品は feature 外から import しない（ページで合成） |
| C-03 | ネイティブ要素優先 | ラジオ・チェック・`<dialog>`・`<input type="time">` を使い、ARIA は不足分のみ。JS 前でも基本操作が可能 |
| C-04 | 状態の置き場所 | 予約下書き: `BookingDraftProvider`（React state＋`sessionStorage`）。管理のサーバー状態: TanStack Query はポーリング用途のみ、他は RSC＋`refresh()` |
| C-05 | トークン経由のスタイル | 色・余白・角丸・モーションは CSS 変数（5 章）のみ参照。生の色コードをコンポーネントに書かない |
| C-06 | バンドル予算 | 公開ページ First Load JS ≤ 150 kB、予約フォーム ≤ 200 kB（NFR-PF-02）。日付処理はサーバー側で整形し、クライアントに `temporal-polyfill` を極力持ち込まない |

---

## 2. UI プリミティブ（`src/components/ui`）

| コンポーネント | 種別 | 主な props | 備考・a11y |
|---|---|---|---|
| `Button` | Server 可 | `variant: 'primary'\|'secondary'\|'ghost'\|'danger'`, `size: 'md'\|'lg'`, `asChild?`, `pending?` | 高さ md 44 / lg 52 px。`pending` で `aria-busy`・スピナー（1 秒超のみ表示） |
| `LinkButton` | Server | `href`, `variant`, `prefetch?` | `next/link` ラッパー |
| `Field` | Server | `id`, `label`, `hint?`, `error?`, `required?`, `children` | ラベル・ヒント・エラーを `aria-describedby` で結線。必須は「必須」テキスト |
| `TextInput` / `TextArea` | Client | `name`, `type`, `inputMode`, `autoComplete`, `maxLength?`, `counter?` | 16 px 以上。`counter` で残り文字数（`aria-live="polite"`） |
| `RadioGroup` / `RadioCard` | Client | `name`, `options: { value, label, description? }[]`, `value`, `onChange` | `<fieldset>`＋`<legend>`。カードは `<label>` 内に `<input type="radio">` |
| `Checkbox` | Client | `name`, `label: ReactNode`, `checked`, `error?` | タップ領域 44 px |
| `Select` | Client | `name`, `options`, `value` | ネイティブ `<select>` |
| `Combobox` | Client | `label`, `fetcher(q)`, `onSelect(item)`, `renderItem` | WAI-ARIA combobox パターン |
| `Dialog` | Client | `open`, `onClose`, `title`, `initialFocusRef?` | `<dialog>`＋`showModal()`。閉じたらトリガーへフォーカス返却 |
| `Sheet` | Client | `open`, `onClose`, `title`, `snap?: 'half'\|'full'` | ボトムシート。入場 400 ms emphasized-decelerate／退場 200 ms emphasized-accelerate、reduced-motion でフェードのみ |
| `Toast` / `useToast` | Client | `message`, `action?: { label, onAction }`, `duration=5000` | `role="status"`。Undo 付きは表示中にフォーカスを奪わない。下部固定 UI と重ならない位置 |
| `Badge` | Server | `tone: 'neutral'\|'accent'\|'warning'`, `children` | 件数は「未確認 2 件」と文字で表す |
| `Skeleton` | Server | `width`, `height`, `rounded?` | 高さ固定で CLS 0 |
| `ErrorSummary` | Client | `errors: { fieldId, message }[]` | `role="alert"`、表示時にフォーカス、各エラーへのリンク |
| `VisuallyHidden` / `LiveRegion` | Server/Client | `children`, `politeness` | 段階遷移の通知に使用 |
| `CopyButton` | Client | `value`, `label`, `copiedLabel` | Clipboard API、失敗時は選択状態にする。結果を `aria-live` で通知 |
| `ShareCopyButton` | Client | `url`, `title`, `text?`, `label`（「共有・コピー」/ "Share or copy"）, `copiedLabel` | `navigator.share` があれば `{ title, text, url }` で共有シートを開く。未対応、または `AbortError` 以外で失敗したら `CopyButton` と同じ処理でクリップボードにコピーし `aria-live` で「コピーしました」。ユーザー操作内でのみ呼ぶ。完了画面のキャンセルリンク用（FR-C-11、CW-15） |
| `StickyCta` | Client | `children` | `padding-bottom: max(16px, env(safe-area-inset-bottom))`、ページ側で `scroll-padding-bottom` を設定 |
| `Icon` | Server | `name`, `label?` | インライン SVG。意味を持つ場合のみ `label`（それ以外は `aria-hidden`） |

---

## 3. 顧客サイトの機能コンポーネント

| コンポーネント | 置き場所 | 境界 | 主な props / 状態 | 使用画面 | 関連 FR |
|---|---|---|---|---|---|
| `SiteHeader` | `features/booking/components`（共通レイアウトは `app/(public)` で合成） | Server（`LocaleSwitcher` のみ Client） | `locale`, `showBookCta?`（予約 CTA を内包。電話リンクは持たない） | 全画面 | FR-C-13, 14 |
| `LocaleSwitcher` | 同上 | Client | `currentLocale`, `alternateHref` | 全画面 | FR-C-13 |
| `BookCta` | 同上 | Server | `locale`。文言は「予約する / Book」固定、遷移先は `/{locale}/book`（予約の唯一の入口、OI-25）。`menuSlug` は持たない（トップから `?menu=` や `/book/time` へは飛ばさない）。「空き時間を見て予約する」は `MenuStep` の固定 CTA 専用で、この部品では使わない | S-C-01（ヘッダーと本文）, 10 | FR-C-01, 14 |
| `InstagramLink` | 同上 | Server | `variant: 'inline'\|'button'`, `locale`, `context?: 'header'\|'footer'\|'done'\|'pastDeadline'\|'restricted'\|'error'`。URL・アカウント名は `config/shop.ts` の `instagram`（`@neuer.kento`。OI-23 決定済み）から取得。問い合わせ（DM）の文脈は `https://ig.me/m/{account}`、施術写真を見る文脈（トップ）は `https://www.instagram.com/{account}/` を新規タブ（`target="_blank" rel="noopener noreferrer"`）で開き、ラベル「Instagram の DM でお問い合わせ / Message us on Instagram」（文脈別の前置き文は `contact` 名前空間）。v0.2 の `PhoneFallback`・`phoneHref` を置き換え、顧客向けに `tel:` を出す部品は持たない | S-C-01, 02, 03, 04, 05, 06, 10、`SiteFooter` | FR-C-11, 12, 16 |
| `Hero` | 同上 | Server | `image`（`next/image`、`priority`、`alt`）。写真のみでキャッチコピー・リード文のテキストブロックは持たない（F1） | S-C-01 | FR-C-14 |
| `AccessSection` | 同上 | Server | `shop`（店名・住所・最寄り駅・地図 URL）, `hoursLines: string[]`（「受付時間 18:00–24:00 ／ 定休 月曜」「予約締切 ご来店の 60 分前まで」の 2〜3 行。`getBusinessCalendar()`・`getPublicSettings()` から生成）。単独の受付時間カード（v0.2 の `HoursSection`）は持たない | S-C-01 | FR-C-14 |
| `LanguagesNote` | 同上 | Server | `locale`。「日本語 / English」 | S-C-01 | FR-C-14 |
| `MenuSummary` / `MenuCard` | 同上 | Server（`variant="select"` の `MenuCard` は `RadioCard` を内包するため Client） | `menu: MenuDTO`, `variant: 'select'\|'info'`, `selected?`, `occupation?`。**`select`**（S-C-02）: `<label>`＋ラジオ、一般・学生の両価格・所要時間・一言説明を併記。**`info`**（S-C-01、v0.4）: 情報表示の `<article>`。名称 JA/EN・一般価格・所要時間、一言説明は `description_*` があるときだけ 1 行。リンク・ボタン・`tabindex`・hover を持たない（予約の入口は `BookCta`）。`MenuSummary` は公開メニュー 9 件すべてを `sort_order` 順に `info` で並べる（「全 9 メニュー」への導線は持たない） | S-C-01, 02 | FR-C-02, 04, 14 |
| `BookingDraftProvider` | `features/booking/components` | Client（`/book/layout.tsx`） | 状態: `{ menuSlug, startsAt, name, nameKana, occupation, phone, note, submissionNonce, updatedAt }`。`sessionStorage` 同期、30 分無操作で破棄 | S-C-02, 03, 02b, 04 | FR-C-01 |
| `BookingStepper` | 同上 | Server | `current: 1..4`（1 メニュー / 2 日時 / 3 お客様情報 / 4 確認）, `locale` | S-C-02, 03, 02b, 04 | FR-C-01 |
| `MenuStep` | 同上 | Client | メニューのラジオグループ（`MenuCard variant="select"`）と固定 CTA「空き時間を見て予約する / See available times」（メニュー選択後にだけ表示。この文言を使う CTA はこれだけ） | S-C-02 | FR-C-01, 02 |
| `SelectionSummary` | 同上 | Client（下書きを読む） | `menu`, `startsAt`, `price`（職業に応じて再計算）, `editMenuHref`, `editTimeHref`。お客様情報の上部に置くコンパクトな 2 行要約 | S-C-02b | FR-C-01, 04 |
| `BookingForm` | 同上 | Client | `menus: MenuDTO[]`, `locale`。段階は `name → occupation → phone` で固定（OI-19 決定済み）。`history.state` と `?step=` を管理、`popstate` で段階復元 | S-C-02b | FR-C-01, AT-09 |
| `NameStep` / `KanaField` / `OccupationStep` / `PhoneStep`（＋`NoteField`） | 同上 | Client | 各段階の値・エラー・`onComplete`。`KanaField` は `locale === 'ja'` のときのみ描画。`OccupationStep` はラジオ選択で `onComplete`。`NoteField` は `PhoneStep` 内の「＋ご要望を追加（任意）」で開く | S-C-02b | FR-C-03〜06 |
| `StepSummary` | 同上 | Client | `label`, `value`, `onEdit` | S-C-02b | FR-C-01 |
| `MonthCalendar` | `features/availability/components` | Server（グリッド描画。各 ◎ の日は `<Link>`）＋キーボード操作の小さな Client ラッパー（`useRovingGrid`） | `month: 'YYYY-MM'`, `days: MonthDayDTO[]`（`getMonthAvailability` の戻り値）, `selectedDate?`（`date` 未指定の初期表示は `today`。今日が × でも今日を選択し、時間枠リストは空きなしの表示。OI-24 決定済み）, `today`, `prevMonthHref?`, `nextMonthHref?`, `menuSlug`, `locale`。見出し「‹ 2026年11月 ›」（‹ › は 44×44 のリンク、範囲外は `aria-disabled`）、曜日行（月曜始まり 7 列）、週ごとの行（5〜6 行、月外は空セル）。`<table role="grid" aria-labelledby>`＋`<th scope="col" abbr>`。キーボード: ロービング tabindex（Tab 停止点は選択日、未選択なら最初の ◎ の日）、← → は前後の ◎ の日、↑ ↓ は 7 日前後（◎ でなければ同方向に週単位で探索）、Home / End は月内の最初・最後の ◎ の日、PageUp / PageDown は前月・翌月、Enter / Space で選択（03_screen_specs.md 2.6）。v0.2 の `WeekStrip`（横スクロールの週ストリップ）を置き換え | S-C-03 | FR-C-07, 08 |
| `DayCell`（顧客） | 同上 | Server | `date`, `status: 'available'\|'full'\|'deadline'\|'closed'\|'out_of_range'`, `closedReason?: 'regular'\|'override'`, `isToday`, `selected`, `tabIndex: 0\|-1\|undefined`。`role="gridcell"`。`available` のみ内側に `<Link href="?date=…">`（`aria-selected`・ロービング tabindex）。`full`（満席）・`deadline`（締切）・`closed`（定休 / 休業）は日付＋×＋理由ラベルの非活性セル、`out_of_range`（過去日・61 日以降）は日付のみの薄い非活性セルで、いずれもリンクにせず `tabindex` を付けない。今日は枠線＋`aria-current="date"`、選択日は `--accent` の塗り。`aria-label` は「11月5日 木曜日 満席」形式。セル幅 1/7・高さ 56 px。管理の `DayCell`（4 章、`WeekGrid` 用）とは別部品 | S-C-03 | FR-C-07 |
| `MonthCalendarSkeleton` | 同上 | Server | 曜日行＋6 行 × 7 列の固定高（CLS 0） | S-C-03 | NFR-AV-02 |
| `SlotList` / `SlotButton` / `SlotRow` | 同上 | Client（`SlotButton` の選択で下書き更新して遷移） | `slots: { startsAt, status }[]`（ISO+09:00）, `durationMin`, `locale`, `selectedStartsAt?`。**全候補時刻を行として描画**し、`available` は `SlotButton`（タップ → 150 ms の選択表示 → 次段へ）、`full`・`deadline` は `SlotRow`（× と理由ラベル。ボタン・リンクにせず `tabindex` なし）。`selectedStartsAt` があるとき（戻ってきたとき）だけ `StickyCta`「この日時で進む」 | S-C-03 | FR-C-07, 08 |
| `SlotListSkeleton` | 同上 | Server | — | S-C-03 | NFR-AV-02 |
| `SlotLegend` / `DeadlineNotice` | 同上 | Server | `leadTimeMin`（v0.2 の `PhoneFallback`「本日の残り枠はお電話で」は廃止。F3） | S-C-03 | FR-C-07 |
| `CheckAnswers` | `features/booking/components` | Client（下書きを読む） | `rows: { key, label, value, editHref }[]` | S-C-04 | FR-C-09 |
| `PolicyDigest` / `ConsentCheckbox` | 同上 | Server / Client | `policyVersion`, `locale` | S-C-04 | FR-C-09, 15 |
| `TurnstileWidget` | 同上 | Client | `siteKey`（props で受け取る）, `onToken`, `onExpire` | S-C-04 | FR-S-05 |
| `Honeypot` | 同上 | Server | — | S-C-04 | FR-S-05 |
| `ConfirmBookingForm` | 同上 | Client | `useActionState(createBooking)` | S-C-04 | FR-C-10 |
| `DoneCard` | 同上 | Server（`CopyButton`・`ShareCopyButton` のみ Client） | `booking: BookingByTokenDTO`, `cancelUrl`, `icsUrl`, `shop`（店名・住所・地図 URL。OI-09 決定済み）。予約番号は `CopyButton`、キャンセルリンクは `ShareCopyButton`＋「カレンダーの予定からもキャンセルできます」 | S-C-05 | FR-C-11 |
| `AddToCalendar` | 同上 | Server | `icsUrl`, `googleUrl?` | S-C-05 | FR-C-11 |
| `CancelPanel` | 同上 | Client | `token`, `deadline`, `canCancel`。締切後は「Instagram の DM でご連絡ください」＋`InstagramLink`（`variant="button"`） | S-C-06 | FR-C-12, 16 |
| `PolicyArticle` / `TokushohoTable` | `app/(public)/[locale]/policy` 近傍 | Server | `locale` | S-C-08, 09 | FR-C-15 |

---

## 4. 管理 PWA の機能コンポーネント

| コンポーネント | 置き場所 | 境界 | 主な props / 状態 | 使用画面 | 関連 FR |
|---|---|---|---|---|---|
| `AdminShell` | `features/admin-calendar/components` | Server（`BottomTabs` の現在タブ判定のみ Client） | `children` | S-A-02〜11 | FR-A-02 |
| `AdminHeader` | 同上 | Server＋`InboxBadge`（Client） | `title`, `date?`, `prevHref?`, `nextHref?` | S-A-02, 03 | FR-A-02 |
| `InboxBadge` | 同上 | Client | TanStack Query `useQuery(['inbox-count'], …, { refetchInterval: 20000, refetchIntervalInBackground: false })`。変化で `router.refresh()`、`setAppBadge` | 全画面 | FR-A-11 |
| `BottomTabs` | 同上 | Client | `active: 'today'\|'week'\|'inbox'\|'settings'` | 全画面 | FR-A-02 |
| `Timeline` | 同上 | Server（描画）＋`NowLine`（Client） | `date`, `openMin`, `closeMin`, `items: (BookingCardDTO\|BlockCardDTO)[]`、15 分グリッド | S-A-02 | FR-A-02 |
| `BookingCard` | 同上 | Server（`tel:` はリンク） | `id, start, end, name, nameKana, menuName, source, status, hasNote, phoneHref?, unacknowledged` | S-A-02, 07 | FR-A-02 |
| `BlockCard` | `features/blocks/components` | Client（削除・Undo） | `id, start, end, kind, label` | S-A-02 | FR-A-06 |
| `Fab` / `QuickActionSheet` | `features/admin-calendar/components` | Client | プリセット: `now60`, `now120`, `untilClose`、「手動予約」「期間指定」。開いた時点で各プリセットの重なりを取得し行に表示（種別「休憩として」等も）。重なりのないプリセットは `createTimeBlock` を直接呼び、顧客サイトへの影響を添えた Undo トースト | S-A-02 | FR-A-05, 06 |
| `WeekGrid` / `DayCell`（管理） | 同上 | Server | `days: { date, bookingCount, freeSlots, closed, hasBlocks }[]` | S-A-03 | FR-A-03 |
| `BookingDetail` / `StatusActions` | 同上 | Server / Client | `booking: BookingDetailDTO`、許可遷移のみボタン表示（`domain/booking-status.ts`） | S-A-04 | FR-A-04 |
| `ConfirmUrlPanel` | 同上 | Client | `bookingId`, `reissue()` | S-A-04, 05 | FR-A-05 |
| `ManualBookingForm` | 同上 | Client | 下書きを `sessionStorage['bb.draft.manual']` に保存。`OverlapAlert` を内包 | S-A-05 | FR-A-05, 10 |
| `OverlapAlert` | 同上（ブロックでも使用するため `components/ui` に昇格可） | Client | `overlaps: OverlapDTO[]`, `mode: 'blocking'\|'warning'`。手動予約は `blocking`（「時間を変更」のみ、上書き保存なし。OI-11）、ブロックは `warning`（「それでもブロック」可） | S-A-05, 06 | FR-A-05, 06 |
| `BlockForm` | `features/blocks/components` | Client | 下書き `sessionStorage['bb.draft.block']` | S-A-06 | FR-A-06 |
| `InboxList` | `features/admin-calendar/components` | Server＋行の既読化は Client | `items: { id, kind: 'created'\|'cancelled', start, name, menuName, createdAt }[]` | S-A-07 | FR-A-11 |
| `WeeklyHoursEditor` / `OverrideList` / `SlotRulesForm` | `features/settings/components` | Client | 曜日 7 行、オーバーライド一覧、枠ルール | S-A-08 | FR-A-07 |
| `MenuList` / `MenuEditSheet` | 同上 | Client | 並べ替えは上下ボタン（ドラッグ不要、WCAG 2.5.7） | S-A-09 | FR-A-08 |
| `PushOnboarding` / `PushStatusCard` / `TestPushPanel` / `ResubscribeBanner` | `features/notifications/components` | Client | `vapidPublicKey`（props）、状態機械（03_screen_specs.md 9.1） | S-A-02, 10 | FR-A-09 |
| `DeviceList` / `LogoutOthersButton` | `features/auth/components` | Server / Client | `sessions`, `subscriptions` | S-A-10 | FR-A-16 |
| `PasskeyLoginButton` / `OtpFallbackForm` | `features/auth/components` | Client | `next?`。`OtpFallbackForm` は「確認コードを送る」（`requestAdminOtp`）と 1 欄のコード入力（`inputmode="numeric"`、`autocomplete="one-time-code"`、6 桁で `verifyAdminOtp`）。マジックリンクの UI は持たない（OI-12） | S-A-01 | FR-A-01 |
| `InstallGuide` / `StandaloneGate` | `features/notifications/components` | Client | `platform`（UA 推定）、`beforeinstallprompt` を保持 | S-A-01, 12 | FR-A-09, 15 |
| `OfflineBanner`（Should） | `features/admin-calendar/components` | Client | `navigator.onLine`＋最終取得時刻 | S-A-02 | FR-A-17 |
| `BackButton` | `components/ui` | Client | `fallbackHref='/admin'`。`history.length` が 1 なら fallback | S-A-04〜11 | FR-A-04 |
| `CustomerSearch` / `CustomerDetail` / `AnonymizeDialog` / `MergeDialog`（Should） | `features/customers/components` | Client | — | S-A-11 | FR-A-13, 14 |

---

## 5. デザイントークン（CSS 変数 3 層）

`src/styles/globals.css` に定義する。トークン名は用途名で付け、色名（`--green` 等）は第 2 層以降で使わない。値は統合レポートの採用値で、最終値はデザインガイド（`docs/05_design_comps/`）で確定する。

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
| `--danger` / `--on-danger` | `#a4262c`（仮）/ `#ffffff` | `#f19a9e`（仮）/ `var(--ink-10)` | 破壊的操作（キャンセル）。えんじと区別する |
| `--status-open` | `var(--blue-35)` | `#7fbde3`（仮） | 空きあり ◎ |
| `--status-few` | `var(--amber-60)` | 同左 | 予備（Phase 1 未使用） |
| `--status-full` | `var(--gray-60)` | `var(--ink-70)` | 満席 × |
| `--status-closed` | `var(--gray-60)` | `var(--ink-70)` | 定休・休業 × |
| `--overlap` | `#b3261e`（仮） | `#f2b8b5`（仮） | 重なり警告 |
| `--block-hatch` | `var(--paper-90)` | `var(--ink-25)` | ブロックの斜線 |
| `--space-gutter` | `16px`（≤640）/ `24px`（≥768） | 同左 | 左右余白 |
| `--target-min` | `44px` | 同左 | タップ領域 |
| `--radius-sm` / `--radius-md` / `--radius-lg` | `6px` / `10px` / `16px` | 同左 | 角丸 |

ダーク切替: `@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *))`。管理 PWA は `prefers-color-scheme` 追従を既定とし、設定で固定（FR-A-18、Could）。顧客サイトは Phase 1 はライトのみ。

### 5.3 第 3 層: Tailwind 接続（`@theme inline`）

```css
@theme inline {
  --color-*: initial;                       /* 既定パレットを捨てる */
  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-fg: var(--fg);
  --color-fg-muted: var(--fg-muted);
  --color-accent: var(--accent);
  --color-on-accent: var(--on-accent);
  --color-border: var(--border);
  --color-ring: var(--ring);
  --color-danger: var(--danger);
  --color-status-open: var(--status-open);
  --color-status-full: var(--status-full);
  --color-status-closed: var(--status-closed);
  --color-overlap: var(--overlap);
  --font-sans: var(--font-lato), var(--font-noto-sans-jp), system-ui, sans-serif;
  --font-display: var(--font-lato);
  --text-base--line-height: 1.7;            /* 日本語本文（JLREQ） */
  --ease-standard: var(--ease-standard);
  --radius-md: var(--radius-md);
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
| `policy` / `privacy` | 見出し・本文（本文は MDX にする場合は対象外） | S-C-08, 09 | FR-C-15 |
| `errors` | 404・500・429 | S-C-10 | FR-C-16 |
| `admin` | 管理 PWA の全文言（`ja.json` のみ。`getTranslations({ locale: 'ja', namespace: 'admin' })`） | S-A-01〜12 | FR-A-* |
| `push` | 通知タイトル・本文テンプレート（ja のみ。管理者向け） | `features/notifications` | FR-A-10, 12 |

規約: キーは `camelCase`、ICU MessageFormat（複数形・`{count}`）を使う。`en.json` に存在しないキーは CI（`next-intl` の型生成＋キー差分チェック）で失敗させ、「`/en` に日本語が混在しない」（FR-C-13）を担保する。
