# 07 コンポーネント設計・デザイントークン・メッセージ名前空間

## 文書情報

| 項目 | 内容 |
|---|---|
| 文書 ID | DES-07 |
| 版 | v0.1 |
| 日付 | 2026-10-10 |
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
| `StickyCta` | Client | `children` | `padding-bottom: max(16px, env(safe-area-inset-bottom))`、ページ側で `scroll-padding-bottom` を設定 |
| `Icon` | Server | `name`, `label?` | インライン SVG。意味を持つ場合のみ `label`（それ以外は `aria-hidden`） |

---

## 3. 顧客サイトの機能コンポーネント

| コンポーネント | 置き場所 | 境界 | 主な props / 状態 | 使用画面 | 関連 FR |
|---|---|---|---|---|---|
| `SiteHeader` | `features/booking/components`（共通レイアウトは `app/(public)` で合成） | Server（`LocaleSwitcher` のみ Client） | `locale`, `phoneHref` | 全画面 | FR-C-13, 16 |
| `LocaleSwitcher` | 同上 | Client | `currentLocale`, `alternateHref` | 全画面 | FR-C-13 |
| `BookCta` | 同上 | Server | `locale`, `menuSlug?` | S-C-01, 10 | FR-C-14 |
| `MenuSummary` / `MenuCard` | 同上 | Server（`MenuCard` は `RadioCard` を内包するため Client） | `menu: MenuDTO`, `selected?`, `occupation?` | S-C-01, 02 | FR-C-02, 04 |
| `BookingDraftProvider` | `features/booking/components` | Client（`/book/layout.tsx`） | 状態: `{ menuSlug, name, nameKana, occupation, phone, note, startsAt, submissionNonce, updatedAt }`。`sessionStorage` 同期、30 分無操作で破棄 | S-C-02〜04 | FR-C-01 |
| `BookingStepper` | 同上 | Server | `current: 1..4`, `locale` | S-C-02〜04 | FR-C-01 |
| `BookingForm` | 同上 | Client | `menus: MenuDTO[]`, `locale`, `sequence: Step[]`。`history.state` と `?step=` を管理、`popstate` で段階復元 | S-C-02 | FR-C-01, AT-09 |
| `MenuStep` / `NameStep` / `KanaField` / `OccupationStep` / `PhoneStep` / `NoteStep` | 同上 | Client | 各段階の値・エラー・`onComplete`。`KanaField` は `locale === 'ja'` のときのみ描画 | S-C-02 | FR-C-02〜06 |
| `StepSummary` | 同上 | Client | `label`, `value`, `onEdit` | S-C-02 | FR-C-01 |
| `WeekStrip` | `features/availability/components` | Server（各日は `<Link>`。スクロール位置保持の小さな Client ラッパー） | `days: DayDTO[]`, `selectedDate`, `menuSlug`, `locale` | S-C-03 | FR-C-07 |
| `DayCell` | 同上 | Server | `date`, `status: 'available'\|'full'\|'closed'`, `selected` | S-C-03 | FR-C-07 |
| `SlotList` / `SlotButton` | 同上 | Client（選択で下書き更新して遷移） | `slots: string[]`（ISO+09:00）, `durationMin`, `locale` | S-C-03 | FR-C-07, 08 |
| `SlotListSkeleton` | 同上 | Server | — | S-C-03 | NFR-AV-02 |
| `SlotLegend` / `DeadlineNotice` / `PhoneFallback` | 同上 | Server | `leadTimeMin`, `phoneHref` | S-C-03, 06 | FR-C-07, 16 |
| `CheckAnswers` | `features/booking/components` | Client（下書きを読む） | `rows: { key, label, value, editHref }[]` | S-C-04 | FR-C-09 |
| `PolicyDigest` / `ConsentCheckbox` | 同上 | Server / Client | `policyVersion`, `locale` | S-C-04 | FR-C-09, 15 |
| `TurnstileWidget` | 同上 | Client | `siteKey`（props で受け取る）, `onToken`, `onExpire` | S-C-04 | FR-S-05 |
| `Honeypot` | 同上 | Server | — | S-C-04 | FR-S-05 |
| `ConfirmBookingForm` | 同上 | Client | `useActionState(createBooking)` | S-C-04 | FR-C-10 |
| `DoneCard` | 同上 | Server（`CopyButton` のみ Client） | `booking: BookingByTokenDTO`, `cancelUrl`, `icsUrl`, `shop` | S-C-05 | FR-C-11 |
| `AddToCalendar` | 同上 | Server | `icsUrl`, `googleUrl?` | S-C-05 | FR-C-11 |
| `CancelPanel` | 同上 | Client | `token`, `deadline`, `canCancel` | S-C-06 | FR-C-12 |
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
| `Fab` / `QuickActionSheet` | `features/admin-calendar/components` | Client | プリセット: `now30`, `now60`, `allDay`、「手動予約」「期間指定」。プリセットは `createTimeBlock` を直接呼び Undo トースト | S-A-02 | FR-A-05, 06 |
| `WeekGrid` / `DayCell`（管理） | 同上 | Server | `days: { date, bookingCount, freeSlots, closed, hasBlocks }[]` | S-A-03 | FR-A-03 |
| `BookingDetail` / `StatusActions` | 同上 | Server / Client | `booking: BookingDetailDTO`、許可遷移のみボタン表示（`domain/booking-status.ts`） | S-A-04 | FR-A-04 |
| `ConfirmUrlPanel` | 同上 | Client | `bookingId`, `reissue()` | S-A-04, 05 | FR-A-05 |
| `ManualBookingForm` | 同上 | Client | 下書きを `sessionStorage['bb.draft.manual']` に保存。`OverlapAlert` を内包 | S-A-05 | FR-A-05, 10 |
| `OverlapAlert` | 同上（ブロックでも使用するため `components/ui` に昇格可） | Client | `overlaps: OverlapDTO[]`, `mode: 'blocking'\|'warning'` | S-A-05, 06 | FR-A-05, 06 |
| `BlockForm` | `features/blocks/components` | Client | 下書き `sessionStorage['bb.draft.block']` | S-A-06 | FR-A-06 |
| `InboxList` | `features/admin-calendar/components` | Server＋行の既読化は Client | `items: { id, kind: 'created'\|'cancelled', start, name, menuName, createdAt }[]` | S-A-07 | FR-A-11 |
| `WeeklyHoursEditor` / `OverrideList` / `SlotRulesForm` | `features/settings/components` | Client | 曜日 7 行、オーバーライド一覧、枠ルール | S-A-08 | FR-A-07 |
| `MenuList` / `MenuEditSheet` | 同上 | Client | 並べ替えは上下ボタン（ドラッグ不要、WCAG 2.5.7） | S-A-09 | FR-A-08 |
| `PushOnboarding` / `PushStatusCard` / `TestPushPanel` / `ResubscribeBanner` | `features/notifications/components` | Client | `vapidPublicKey`（props）、状態機械（03_screen_specs.md 9.1） | S-A-02, 10 | FR-A-09 |
| `DeviceList` / `LogoutOthersButton` | `features/auth/components` | Server / Client | `sessions`, `subscriptions` | S-A-10 | FR-A-16 |
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
| `nav` | ヘッダー・フッター、言語切替ラベル（「EN」/「日本語」）、電話 | `SiteHeader` | FR-C-13, 16 |
| `home` | ヒーロー、受付時間、アクセス、対応言語・決済【要確認: OI-14】 | S-C-01 | FR-C-14 |
| `menu` | メニュー見出し、学生価格・所要時間の表記 | S-C-01, 02 | FR-C-02 |
| `booking.steps` | ステッパー（「1. メニューを選ぶ」…）、段階見出し、`aria-live` 文言 | S-C-02〜04 | FR-C-01 |
| `booking.form` | ラベル・ヒント・プレースホルダ（ふりがなは ja のみ） | S-C-02 | FR-C-03〜06 |
| `booking.errors` | Zod・サーバーエラー文（03_screen_specs.md 1.3、06_api.md 5 章） | S-C-02〜04 | AT-06 |
| `availability` | 凡例、締切、満席・定休、空なし、電話案内、JST 注記 | S-C-03 | FR-C-07 |
| `confirm` | 確認見出し、同意文、ポリシー要点、確定ボタン | S-C-04 | FR-C-09 |
| `done` | 完了見出し、スクリーンショット案内、カード項目、カレンダー追加 | S-C-05 | FR-C-11 |
| `cancel` | キャンセル各状態の文言、ダイアログ | S-C-06 | FR-C-12 |
| `ics` | ICS の `SUMMARY`・`DESCRIPTION` テンプレート | S-C-07 | FR-C-11 |
| `policy` / `privacy` | 見出し・本文（本文は MDX にする場合は対象外） | S-C-08, 09 | FR-C-15 |
| `errors` | 404・500・429 | S-C-10 | FR-C-16 |
| `admin` | 管理 PWA の全文言（`ja.json` のみ。`getTranslations({ locale: 'ja', namespace: 'admin' })`） | S-A-01〜12 | FR-A-* |
| `push` | 通知タイトル・本文テンプレート（ja のみ。管理者向け） | `features/notifications` | FR-A-10, 12 |

規約: キーは `camelCase`、ICU MessageFormat（複数形・`{count}`）を使う。`en.json` に存在しないキーは CI（`next-intl` の型生成＋キー差分チェック）で失敗させ、「`/en` に日本語が混在しない」（FR-C-13）を担保する。
