# ADR-0005: i18n は next-intl 4 の常時ロケール接頭辞（/ja・/en）とし、タイムゾーンは Asia/Tokyo に固定する

## 文書情報

| 項目 | 内容 |
|---|---|
| ID | ADR-0005 |
| 版 | v0.2 |
| 日付 | 2026-10-12 |
| ステータス | Accepted |
| 変更履歴 | v0.2（2026-10-12）: レビュー修正の反映。日付ライブラリ（`temporal-polyfill`）の採用を ADR-0009 の決定（`Intl` と IANA 名 `Asia/Tokyo` のみ）への参照に置き換え（i18n・タイムゾーンの決定は変更なし）。v0.1（2026-10-10）: 初版 |
| 決定者 | 開発者 |
| 関連要件 | FR-C-03, FR-C-07, FR-C-08, FR-C-13, NFR-EN-05, NFR-EN-07, US-02, AT-02 |

## コンテキスト

- 顧客サイトは日本語と英語。訪日客は JST で日時を誤解しないことが重要で、端末のタイムゾーンは日本以外でありうる。
- 完了画面のキャンセル URL を顧客が保存し、後日開く。URL から言語が一意に決まる必要がある。
- 管理 PWA は日本語のみ（管理者 1 名）。
- Next.js 16 では `middleware.ts` が `proxy.ts` に改名され Node ランタイム固定。next-intl 4.14 は Next.js 16 に対応し、`proxy.ts` の `createMiddleware(routing)` でロケール交渉と hreflang を扱う。

## 決定ドライバー

1. URL が言語を一意に表す（QR・Instagram・キャンセル URL の固定）。
2. ユーザーの選んだ言語を勝手に変えない（自動リダイレクトしない）。
3. 日時の計算と表示が端末に依存しない。
4. 2 言語・小規模での導入コスト。

## 検討した選択肢

| 観点 | 採用 | 退けた案 |
|---|---|---|
| ライブラリ | next-intl 4 | paraglide（Next.js アダプタが deprecated、ルーティングを自前で組む）、next-i18next（Pages Router 時代の設計） |
| 接頭辞 | `localePrefix: 'always'` | `as-needed`（既定ロケールで接頭辞が消え、絶対 URL 生成にロケール判定が絡む）、サブドメイン（DNS・証明書が増える） |
| 検出 | パス → Cookie → Accept-Language → `ja`。`/` のみ 307 | 接頭辞付き URL の自動リダイレクト（ユーザーの選択を上書き） |
| タイムゾーン | `Asia/Tokyo` 固定（IANA 名）、DB は `timestamptz`、フォームは `+09:00` 付き ISO | 端末 TZ での表示（訪日客が予約時刻を誤解）、固定オフセット `+09:00` のハードコード |
| 日付処理 | ライブラリを使わず `Intl.DateTimeFormat`（IANA 名 `Asia/Tokyo`）と `YYYY-MM-DD` 文字列の暦計算（`domain/time.ts`・`domain/jst-format.ts`）。ADR-0009 で決定 | `temporal-polyfill`（v0.1 の採用案。ADR-0009 で置き換え）、dayjs（TZ が弱い）、luxon（サイズ大）、`date-fns`＋`@date-fns/tz` |

## 決定

- `defineRouting({ locales: ['ja','en'], defaultLocale: 'ja', localePrefix: 'always', localeDetection: true })`。`/admin` は proxy.ts で next-intl を通さず `<html lang="ja">` 固定。
- `getRequestConfig` で `timeZone: 'Asia/Tokyo'` と日時フォーマット（`slotDate`、`slotTime` は en のみ 12 時間制）を定義し、サーバー・クライアントで同じ整形にする。
- `/en` の S-C-03〜06 に「All times are Japan Standard Time (JST)」を表示し、時刻に `JST` を付す。24:00 は ja「24:00」、en「12:00 AM (midnight)」【要確認: OI-02】。
- ふりがな欄は `/ja` のみ描画（`/en` は非表示【要確認: OI-13】）。DB 列は共通。
- サーバーは Zod `z.iso.datetime({ offset: true })` で受け、`Asia/Tokyo` として解釈し、リードタイム・上限・営業時間を再検証する。
- 空き計算 SQL は `AT TIME ZONE 'Asia/Tokyo'` で JST の暦日と分から `timestamptz` を作る（04_data_model.md 6 章）。

## 結果

良い点:

- URL・表示・計算のすべてで言語とタイムゾーンが一意になり、海外端末でも同じ時刻を示す。
- キャンセル URL がそのページのロケールで固定される。

悪い点:

- 全 URL に接頭辞が付く（短縮性は下がる）。`/` へのアクセスは 1 回リダイレクトが入る。
- `en.json` の欠落が日本語混在につながるため、CI でキー差分を検査する必要がある。
- 日時処理は ADR-0009 のとおり `Intl`（IANA 名 `Asia/Tokyo`）のみで、ポリフィルをクライアントに持ち込まない（v0.1 の Temporal ポリフィル約 20 kB の懸念は解消）。整形は主にサーバーで行う。

## 関連

- 統合レポート『i18n は next-intl 4、localePrefix: 'always'、timeZone: 'Asia/Tokyo' で固定する』『空き計算は「JST で候補生成 → UTC の tstzrange → && で除外」…』
- 01_sitemap.md 4 章、07_components.md 6 章
- ADR-0009（日時処理は `Intl` のみ。本 ADR の日付ライブラリの選択を置き換え）
