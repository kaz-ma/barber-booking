# ADR-0006: 管理者 1 名の認証は Better Auth＋パスキーとし、永続 Cookie の 30 日ローリングセッションにする

## 文書情報

| 項目 | 内容 |
|---|---|
| ID | ADR-0006 |
| 版 | v0.1 |
| 日付 | 2026-10-10 |
| ステータス | Accepted（フォールバック方式は OI-12 で確定） |
| 決定者 | 開発者 |
| 関連要件 | FR-A-01, FR-A-09, FR-A-16, NFR-SC-01, NFR-SC-02, NFR-SC-10, AT-13, AT-17, AT-19, AT-27, OI-12 |

## コンテキスト

- 管理 PWA の利用者は長田様 1 名。iPhone のホーム画面アプリ（standalone）から使い、施術の合間に素早く開きたい。
- iOS のホーム画面アプリは Safari と別ストレージで、セッション Cookie（有効期限なし）がランダムにリセットされる回帰（WebKit 272325）が 2026-10 時点で未修正。永続 Cookie では再現しない。
- WCAG 3.3.8（認証で記憶・転記を要求しない）を満たしたい。
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
| A. Better Auth＋`passkey()`（＋`magicLink()` またはリカバリーコード） | 安定版プラグイン（SimpleWebAuthn） | サーバー側 `session` テーブル、Cookie 設定可 | ライブラリのみ（自前 DB） | 採用 |
| B. Auth.js v5 | experimental | JWT／DB | ライブラリ | beta |
| C. Clerk | 可 | 7 日固定（Hobby） | SaaS 追加 | 1 名のために SaaS を増やす理由が薄い |
| D. 自前（`iron-session`＋`@simplewebauthn`） | 可 | 自前 | ライブラリ | 実装・保守コスト |

## 決定

**A を採用する。**

- Drizzle アダプタ、テーブル名は `auth_user`・`auth_session`・`auth_account`・`auth_verification`・`auth_passkey`（予約語 `user` を避ける）。
- サインアップ無効。初回管理者は `scripts/seed.ts` で作成し、初回ログイン後にパスキーを登録（予備端末にも 2 本目を推奨）。
- フォールバック: マジックリンク（Resend、管理者メール宛のみ）を既定案、不採用ならリカバリーコード（一度だけ表示、ハッシュ保存）【要確認: OI-12】。
- セッション: 30 日、利用ごとに延長（`updateAge` 1 日）。Cookie は `__Host-` 接頭辞・`HttpOnly; Secure; SameSite=Lax; Path=/`・**`Max-Age` 必須**。
- オンボーディング: 「ホーム画面に追加 → アイコン起動 → アプリ内でログイン」（Safari でログインしてから追加しない）。
- 認可: proxy.ts は Cookie の有無のみ（楽観）。全 Server Action・管理 Route Handler で `requireAdmin()` を最初に実行。
- 端末管理: `auth_session` の UA・最終利用で端末一覧、「この端末以外をログアウト」で他セッションと紐づく Push 購読を削除。
- パスキーの `rpID` は `SITE_URL` のホスト名。

## 結果

良い点:

- Face ID で数秒でログインでき、パスワード管理が不要。WCAG 3.3.8 を自然に満たす。
- 永続 Cookie により iOS のセッションリセットを回避できる。
- 追加 SaaS なしで端末一覧・失効を実装できる。

悪い点:

- パスキーは RP ID（ホスト名）に紐づくため、独自ドメイン移行時に再登録が必要（ADR-0001）。移行時はフォールバックでログインする。
- パスキーを登録した端末をすべて失った場合の復旧はフォールバック方式に依存する（OI-12 の決定が重要）。
- 30 日ローリングは利便性優先。端末紛失時は別端末から他端末ログアウトを行う運用を手順書に記載する。

## 関連

- 統合レポート『管理者 1 名の認証は Better Auth + パスキー、キャンセルトークンは 256 bit をハッシュ保存する』『iOS のプッシュは…』
- `05_pwa_push_admin.md` Q7、`09_gap_push_notifications.md` §2.5
- 08_security.md 4 章
