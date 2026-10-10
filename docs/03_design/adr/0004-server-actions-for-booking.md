# ADR-0004: 予約の書き込みは Server Actions で行い、公開 REST API は作らない

## 文書情報

| 項目 | 内容 |
|---|---|
| ID | ADR-0004 |
| 版 | v0.1 |
| 日付 | 2026-10-10 |
| ステータス | Accepted |
| 決定者 | 開発者 |
| 関連要件 | FR-C-10, FR-C-12, FR-A-04〜08, NFR-SC-02, NFR-SC-03, FR-S-12, AT-27 |

## コンテキスト

- 予約確定・キャンセル・管理操作の書き込み経路を決める必要がある。利用者はブラウザのみで、外部連携（パートナー API、ネイティブアプリ）は Phase 1 にない。
- Next.js 16 の Server Actions は POST のみで呼ばれ、Origin と Host を照合して不一致なら中断する。`useActionState` でフォーム状態と戻り値を扱え、JS 無効時もフォーム送信として動く。一方、export されたアクションは直接 POST で到達可能なため、各アクション内で認証・認可・検証が必要。
- Vercel Cron、ICS ダウンロード、Better Auth、Service Worker からの呼び出しは HTTP エンドポイントが必要。

## 決定ドライバー

1. 攻撃面を最小にする（公開 API を持たない）。
2. フォームの段階的強化と、検証エラーのロケール別表示を少ないコードで実現する。
3. 型を共有し、クライアントとサーバーで同じ Zod スキーマを使う。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| A. Server Actions（書き込み）＋RSC（読み取り）＋最小限の Route Handler | Origin 照合が既定、`useActionState`、型共有、1 往復で UI 更新 | アクションの直接 POST を前提に毎回検証が必要。GET 用途に向かない |
| B. Route Handler による REST API | 外部クライアントに開ける、キャッシュ制御が明示的 | CSRF・Origin 検査・エラー形式を自前で実装、公開面が増える |
| C. tRPC 等 | 型安全 | 依存追加、App Router との二重の仕組み |

## 決定

**A を採用する。**

- 書き込み: すべて Server Action（`features/*/actions.ts`、薄く保ち `service.ts` に委譲）。公開は `createBooking` と `cancelBooking` のみ。
- 読み取り: ページの Server Component が DAL を直接呼ぶ（`getAvailability` は Suspense 配下で非キャッシュ）。
- Route Handler は次に限定: `/api/ics/[token]`（ファイル応答）、`/api/cron/*`（Vercel Cron）、`/api/auth/*`（Better Auth）、`/api/admin/inbox-count`・`overlaps`・`customers/suggest`（クライアントからの GET。ポーリング・デバウンス・中断が必要なため）、`/api/admin/push/rotate`（Service Worker から呼ぶため）。
- 各アクションのパイプライン（08_security.md 3 章）: 公開は Zod → ハニーポット → レート制限 → Turnstile → トランザクション、管理は `requireAdmin` → Zod → トランザクション。
- 期待されるエラーは判別可能ユニオン（`ActionResult`）で返し、`throw` は予期しない例外だけ。
- キャンセルリンクの GET は副作用を持たず、実行はページ上の Server Action（リンクプレビューによる誤キャンセルを防ぐ）。

## 結果

良い点:

- 公開 HTTP API がなく、CSRF 対策が Next.js 既定に乗る。
- フォームと検証スキーマ・エラー文言が 1 か所にまとまる。

悪い点:

- Server Action は直列に処理されるため、ポーリングや検索のような読み取りには使わない（Route Handler GET を使う）。
- 将来 LINE Webhook やネイティブアプリが必要になったら Route Handler を追加する（その時点で認証方式を別途 ADR 化）。

## 代替案の評価

- B: 外部クライアントがない Phase 1 では、公開面と自前実装が増えるだけ。
- C: 2 言語の小規模アプリで依存を増やす理由が薄い。

## 関連

- 統合レポート『Server Action で予約を書き、空き枠は "use cache" せず Suspense 配下で読む』『セキュリティは「安価な検証を先に」…』
- 06_api.md、08_security.md 3 章
