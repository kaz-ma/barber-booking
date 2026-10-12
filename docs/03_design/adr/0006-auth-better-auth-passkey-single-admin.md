# ADR-0006: 管理者 1 名の認証は Better Auth＋パスキーとし、永続 Cookie の 30 日ローリングセッションにする

## 文書情報

| 項目 | 内容 |
|---|---|
| ID | ADR-0006 |
| 版 | v0.3 |
| 日付 | 2026-10-12 |
| ステータス | Accepted（2026-10-10 改訂: フォールバックをアプリ内ワンタイムコードに確定。OI-12 決定済み） |
| 変更履歴 | v0.3（2026-10-12）: 実装との同期（決定は変更なし）。Cookie 名を `__Host-bb.*`（HTTP のローカルは `bb.*`）に、ワンタイムコードは Server Action からのみ扱い emailOTP の HTTP エンドポイントは無効化、配信は Resend の HTTP API を直接呼ぶ、管理者は `scripts/seed-admin.ts` で作成、ログイン試行制限の DB 保存（`auth_rate_limit`）、他端末ログアウトの実装を「決定」に追記。v0.2（2026-10-10）: フォールバックの既定案だったマジックリンクを不採用とし、アプリ内で入力する 6 桁コードに確定（WF 評価 EVAL-001 論点 4、要件定義書 v0.4 FR-A-01）。配信経路のみ【要確認: OI-21】 |
| 決定者 | 開発者 |
| 関連要件 | FR-A-01, FR-A-09, FR-A-16, NFR-SC-01, NFR-SC-02, NFR-SC-10, AT-13, AT-17, AT-19, AT-27, OI-12, OI-21 |

## コンテキスト

- 管理 PWA の利用者は長田様 1 名。iPhone のホーム画面アプリ（standalone）から使い、施術の合間に素早く開きたい。
- iOS のホーム画面アプリは Safari と別ストレージで、セッション Cookie（有効期限なし）がランダムにリセットされる回帰（WebKit 272325）が 2026-10 時点で未修正。永続 Cookie では再現しない。
- WCAG 3.3.8（認証で記憶・転記を要求しない）を満たしたい。
- iOS のホーム画面アプリは Safari とストレージ（Cookie を含む）が分かれている。メール内のリンクは Safari（または既定のブラウザ）で開くため、マジックリンクでログインするとセッションが Safari 側にでき、PWA はログインしないままになる（WF 評価 EVAL-001 論点 4、2026-10-10 追記）。
- Auth.js v5 は beta のままで WebAuthn は experimental、README は新規に Better Auth を推奨している。

## 決定ドライバー

1. Face ID でワンタップログインできること。
2. アプリを閉じて再度開いてもログインが維持されること。
3. パスワードを持たない（漏えい・使い回しの心配がない）。
4. 端末一覧と「この端末以外をログアウト」を実現できること。
5. 追加 SaaS を増やさないこと。

## 検討した選択肢

| 選択肢 | パスキー | セッション | 依存 | 評価 |
|---|---|---|---|---|
| A. Better Auth＋`passkey()`（＋フォールバック: v0.1 は `magicLink()` またはリカバリーコード、v0.2 で `emailOTP()` のアプリ内コード入力に確定） | 安定版プラグイン（SimpleWebAuthn） | サーバー側 `session` テーブル、Cookie 設定可 | ライブラリのみ（自前 DB） | 採用 |
| B. Auth.js v5 | experimental | JWT／DB | ライブラリ | beta |
| C. Clerk | 可 | 7 日固定（Hobby） | SaaS 追加 | 1 名のために SaaS を増やす理由が薄い |
| D. 自前（`iron-session`＋`@simplewebauthn`） | 可 | 自前 | ライブラリ | 実装・保守コスト |

## 決定

**A を採用する。**

- Better Auth 1.7.7＋`@better-auth/passkey` 1.7.7。Drizzle アダプタ（アプリと同じ `pg` Pool）、テーブル名は `auth_user`・`auth_session`・`auth_account`・`auth_verification`・`auth_passkey`（予約語 `user` を避ける）に、`rateLimit.storage: 'database'` 用の `auth_rate_limit` を加える（`drizzle/0003_auth.sql`、追加のみ）。アダプタは JS キーで対応付けるため、`auth-schema.ts` のプロパティ名は Better Auth のフィールド名に合わせる（例 `credentialID`）。
- サインアップ無効。管理者は `scripts/seed-admin.ts`（`npm run db:seed-admin`、`ADMIN_EMAIL` から 1 行）で作成し、初回ログイン（フォールバック）後に S-A-10 でパスキーを登録（予備端末にも 2 本目を推奨）。`ADMIN_EMAIL` を設定した環境では `requireAdmin()` がセッションのメールとも照合する。
- フォールバック（2026-10-10 改訂）: **アプリ内で入力する 6 桁のワンタイムコード**（Better Auth `emailOTP()`、`otpLength: 6`、`disableSignUp: true`。入力欄は 1 欄・`inputmode="numeric"`・`autocomplete="one-time-code"`）。ログインが PWA 内で完結し、Safari にセッションができる問題を避けられる。v0.1 の既定案だったマジックリンクは上記の理由で**採らない**。コードの配信経路は Resend による管理者メール宛を既定とし、メールを使わない場合は事前発行のリカバリーコード（一度だけ表示、ハッシュ保存）をアプリ内で入力する【要確認: OI-21】。アクションは 06_api.md 3.0（`requestAdminOtpAction`・`verifyAdminOtpAction`）。
  - 実装（2026-10-12）: コードは 6 桁・10 分・5 回で失効、`storeOTP: 'hashed'`。emailOTP の HTTP エンドポイントは `disabledPaths` で**すべて無効**にし、コードの送信・照合は上記 2 つの Server Action（宛先は `ADMIN_EMAIL` に固定、独自のレート制限 `otp:ip` 3 回/10 分・`login:ip` 10 回/10 分・`login:acct` 20 回/時）からサーバー API でのみ行う。セッション Cookie は `nextCookies()` で Server Action から設定する。
  - 配信は Resend の HTTP API（`POST https://api.resend.com/emails`）を `fetch` で直接呼ぶ（SDK を依存に加えない。差出人 `RESEND_FROM`）。`RESEND_API_KEY` 未設定時は開発環境に限りコードをサーバーログに表示し、本番・preview ではエラーログのみ（コードは出さない）。
- セッション: 30 日、利用ごとに延長（`updateAge` 1 日。PWA は起動時・可視化時に `getSession()` を呼ぶ）。Cookie は HTTPS では Better Auth の全 Cookie を **`__Host-bb.*`**（セッションは `__Host-bb.session_token`）とし、`HttpOnly; Secure; SameSite=Lax; Path=/`・Domain なし・**`Max-Age` 必須**。HTTP のローカル開発は `__Host-` が `Secure` を要するため `bb.*`。Better Auth 既定の `__Secure-` を重ねないよう `useSecureCookies: false`＋`cookiePrefix` で明示する（`lib/auth-cookie.ts`）。
- ログイン試行制限: Better Auth の `rateLimit`（本番のみ、DB 保存＝`auth_rate_limit`。サーバーレスのコールドスタートでも残る。パスキー認証は 10 回/10 分）。
- オンボーディング: 「ホーム画面に追加 → アイコン起動 → アプリ内でログイン」（Safari でログインしてから追加しない）。
- 認可: proxy.ts は Cookie の有無のみ（楽観）。全 Server Action・管理 Route Handler で `requireAdmin()` を最初に実行。
- 端末管理: `auth_session` の UA・最終利用で端末一覧、「この端末以外をログアウト」で他セッションと紐づく Push 購読を削除し、同じトランザクションで他の `auth_session` 行を削除する。
- パスキーの `rpID` は `SITE_URL` のホスト名。

## 結果

良い点:

- Face ID で数秒でログインでき、パスワード管理が不要。WCAG 3.3.8 を自然に満たす。
- 永続 Cookie により iOS のセッションリセットを回避できる。
- 追加 SaaS なしで端末一覧・失効を実装できる。

悪い点:

- パスキーは RP ID（ホスト名）に紐づくため、独自ドメイン移行時に再登録が必要（ADR-0001）。移行時はフォールバックでログインする。
- パスキーを登録した端末をすべて失った場合の復旧はフォールバック（アプリ内コード）に依存する。メール受信手段を失うと復旧できないため、OI-21 でリカバリーコードを併用するかを決める。
- ワンタイムコードは転記を伴う。`autocomplete="one-time-code"` による自動入力・貼り付けで負担を下げるが、パスキーより手順は多い（主経路はパスキーのまま）。
- 30 日ローリングは利便性優先。端末紛失時は別端末から他端末ログアウトを行う運用を手順書に記載する。

## 関連

- 統合レポート『管理者 1 名の認証は Better Auth + パスキー、キャンセルトークンは 256 bit をハッシュ保存する』『iOS のプッシュは…』
- `05_pwa_push_admin.md` Q7、`09_gap_push_notifications.md` §2.5
- 08_security.md 4 章
