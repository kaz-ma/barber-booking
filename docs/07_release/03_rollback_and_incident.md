# 03 ロールバック・障害対応手順

## 文書情報

| 項目 | 内容 |
|---|---|
| 文書 ID | REL-003 |
| 版 | v0.1 |
| 日付 | 2026-10-12 |
| 対象 | 開発者（§1〜§3、§5）、開発者とクライアント（§4 障害時の初動） |
| 関連要件 | NFR-AV-01, NFR-AV-04, NFR-AV-05, NFR-OP-02, NFR-OP-03, NFR-SC-10, FR-S-07, FR-S-08, FR-A-11, AT-19 |
| 関連設計 | DES-08 §10・§12、ADR-0001, ADR-0003, ADR-0007 |

表記: 【クライアント】= クライアントの判断・作業が要る事項。【要実機確認】= ダッシュボード・実機でしか確かめられない事項。SQL は Neon コンソールの SQL Editor（`main` ブランチ）で実行する。読み取りの SQL だけを使い、更新が必要なときは手順に明記したものに限る。

---

## 1. アプリのロールバック（Vercel）

### 1.1 Hobby の制約（ギャップノート #7）

- Instant Rollback で戻せるのは**直前の本番デプロイ 1 件だけ**（Pro は本番に割り当てられたことのある全デプロイ）。
- ロールバックは再ビルドしない。戻した先のデプロイは、**そのデプロイを作ったときの環境変数**で動く（環境変数の誤設定はロールバックでは直らない → 修正して Redeploy）。
- ロールバック後は**本番ドメインの自動割当がオフ**になる。そのまま `main` に push しても本番に出ない。解除するまで覚えておく。

### 1.2 手順

| 状況 | 手順 |
|---|---|
| 直前のデプロイで壊れた | 1. Vercel → Deployments → 1 つ前の Production デプロイの「…」→ **Instant Rollback**（またはプロジェクトトップの Instant Rollback）→ 確認。2. 本番 URL で症状が消えたことを確認。3. 原因を修正し `staging` で確認後 `main` にマージ。4. 新しいデプロイを **Promote to Production**（または「Undo Rollback」）して自動割当を戻す【要実機確認: ボタン名】 |
| 2 つ以上前に戻したい | Hobby では Instant Rollback できない。1. `git revert <壊れたコミット>` を `main` に push（推奨。履歴が残る）。2. 急ぐ場合は Deployments → 戻したい時点の Production デプロイ →「…」→ **Redeploy**（同じコミットを現在の環境変数で再ビルド）【要実機確認: Hobby での可否】 |
| 環境変数の誤り | Settings → Environment Variables を修正 → 最新デプロイを Redeploy（Build Cache なし） |
| ビルドが失敗し続ける | 本番は前のデプロイのまま動いている（失敗したデプロイは割り当てられない）。急ぎでなければ通常の修正で対応 |

### 1.3 DB スキーマとの関係

アプリを 1 つ前に戻しても DB は戻らない。だからマイグレーションは**追加的**（列・テーブル・インデックスの追加、NULL 許可の列）に限り、1 つ前のアプリが新しいスキーマでも動くようにする。列の削除・型変更・NOT NULL 化は、それを使わないアプリを先に出した**次のリリース**で行う（expand → contract）。

---

## 2. DB マイグレーションのロールバック方針

| 方針 | 内容 |
|---|---|
| 前進修正（forward-fix） | Drizzle のマイグレーションに down はない。誤ったマイグレーションは、打ち消す新しいマイグレーションを `npm run db:generate`（または `npx drizzle-kit generate --custom --name=<name>`）で作り、`npm run db:migrate` で適用する |
| 禁止 | `drizzle-kit push`、`drizzle.__drizzle_migrations` の手編集、`bookings_no_overlap` の DROP・弱体化（AGENTS.md 規則 1） |
| 事前の備え | 本番に適用する前に Actions → Backup を手動実行してダンプを取る。staging で同じマイグレーションを先に適用する |
| データを壊した | §3 の復旧へ |

---

## 3. データの復旧

### 3.1 判断表

| 状況 | 方法 | 失うもの |
|---|---|---|
| 誤操作・破損が**6 時間以内** | Neon コンソール → Branches → `main` → **Restore**（Instant restore。Free は 6 時間・変更履歴 1 GB まで: ギャップノート #13）で直前の時点に戻す。接続文字列は変わらない【要実機確認: 画面と所要時間】 | 指定時刻以降の書き込み |
| 6 時間より前、または Neon 側の障害 | 日次ダンプから戻す（§3.2） | 最後のダンプ以降（最大 24 時間 = RPO） |
| 1 件だけ誤って変更・削除 | 管理 PWA の「取り消す」（5 秒以内）。過ぎていたら `audit_log` で元の値を確認し、管理 PWA から入れ直す | なし |

### 3.2 ダンプからの本番復旧（目標 4 時間）

1. **受付を止める**: Instagram で告知（§4.1）。Vercel → Firewall → カスタムルール（Hobby は 3 本まで無料）で Request Path が正規表現 `^/(ja|en)/book` に一致するものを **Deny**、Publish。管理 PWA の操作も止めてもらう【クライアント】。
2. **現状を保存**: Actions → Backup を手動実行（壊れた状態の記録。調査用）。
3. **ダンプを取得・復号**: REL-001 §9.2 の手順 1〜2。
4. **一時ブランチで検証**: Neon で空のブランチ（または新しい DB）を作り、REL-001 §9.2 の手順 3〜4 で復元して件数・制約を確認する。
5. **本番に復元**（直結 URL。`--single-transaction` なので失敗すれば何も変わらない）:
   ```bash
   read -rs PROD_DB_URL
   pg_restore --clean --if-exists --no-owner --no-privileges --exit-on-error --single-transaction \
     -d "$PROD_DB_URL" barber.dump
   ```
   ローカルでは検証済み（2026-10-12、PostgreSQL 16）。Neon 上での `--clean`（拡張の DROP を含む）は【要実機確認】。権限エラーになる場合は、Neon で新しいブランチに復元してそれを既定ブランチにし、Vercel の `DATABASE_URL`・`DATABASE_URL_UNPOOLED` をそのブランチの値に差し替えて Redeploy する。
6. **確認**: `02_prelaunch_checklist.md` B1・B2、`SELECT status, count(*) FROM bookings GROUP BY 1;`、管理 PWA の今日・週の表示。
7. **再デプロイ**: メニュー等のキャッシュを作り直すため最新デプロイを Redeploy。
8. **受付再開**: Firewall の Deny ルールを無効化。Instagram で再開を告知。
9. **差分の回収**: ダンプ時刻〜停止時刻に入った予約は失われている。クライアントの通知履歴（iPhone の通知センター）と Instagram DM から洗い出し、手動予約で入れ直す。お客様の確認 URL は再発行になる（以前の URL は無効）。

---

## 4. 障害対応ランブック

### 4.0 初動（共通）

1. 何が起きているかを 1 行で書く（例「予約確定でエラー」「通知が来ない」）。
2. 影響の大きさ: **重大** = 予約できない・二重予約・通知不達・個人情報漏えい（要件定義書 15.1）→ すぐ開発者へ連絡。それ以外 → 当日中。
3. 状況確認（開発者）: Vercel → Deployments（直前のデプロイ）／Logs（**保持 1 時間**。すぐ見る）／Usage、Neon → Monitoring、各社ステータスページ（Vercel / Neon / Cloudflare / GitHub）。
4. 記録: 発生時刻（JST）、症状、対応、復旧時刻を残し、復旧後にクライアントへ報告する。

### 4.1 サイトが表示されない・予約できない

| 手順 | 担当 |
|---|---|
| 1. Instagram のストーリーズ（とプロフィール）で告知する（下の文面） | ク |
| 2. 予約は Instagram DM で受ける。管理 PWA が開ければ、DM の予約を手動予約で登録して二重予約を防ぐ（REL-004 §3）。管理 PWA も開けなければメモに控え、復旧後に登録する | ク |
| 3. 原因を切り分ける: 直前のデプロイ → §1 でロールバック／Neon 停止・上限 → §4.4／Vercel の使用量上限・規約停止 → §4.5・REL-001 §11.2 | 開 |
| 4. 復旧後、テスト予約 1 件（REL-002 K1〜K3 の短縮版）→ 告知を更新 | 開・ク |

告知文（クライアントの端末に保存しておく）:

```
【ご予約について】
現在、予約サイトが一時的にご利用いただけません。
ご予約・ご変更・キャンセルは Instagram の DM（@neuer.kento）で承ります。
ご迷惑をおかけして申し訳ありません。復旧しましたらお知らせします。

[Booking notice]
Our booking site is temporarily unavailable.
Please message us on Instagram (@neuer.kento) to book, change or cancel.
We apologise for the inconvenience and will post an update once it is back.
```

再開時: 「予約サイトが復旧しました。引き続きサイトからご予約いただけます。/ Our booking site is back. You can book online again.」

### 4.2 通知が届かない

| 確認 | 手順 |
|---|---|
| 1. 予約自体は入っているか | 管理 PWA を開く → 受信箱。アプリを開いていれば 20 秒以内に表示される（通知は補助。NFR-AV-03） |
| 2. 端末の設定 | iPhone「設定」→「通知」→「予約管理」→「通知を許可」オン、集中モードで止められていないか（REL-004 §6） |
| 3. テスト通知 | 管理 PWA「設定 > 通知 > テスト通知を送る」→ 結果が「201 送信済み」で届かない →「届かない」→「**購読を作り直す**」→ もう一度テスト（iOS の既知の不具合: サーバーは成功でも届かないことがある） |
| 4. 購読がない | 「通知を受け取る端末」に「この端末」がない →「通知をオンにする」。ホーム画面のアイコンから開いているか（Safari のタブでは通知を受けられない） |
| 5. 送信履歴（開発者） | 下の SQL。`status = 'expired'`（404/410）は購読が失効して削除済み → 端末で通知をオンにし直す。`failed` が続く → `http_status` と `error` を確認 |
| 6. 全端末で一斉に届かない（開発者） | `VAPID_*` が変更されていないか（変えると全購読が無効: DES-08 §12）。変えてしまった場合は元の値に戻して Redeploy。戻せなければ全端末で通知をオンにし直す |
| 7. 日次サマリーだけ来ない | Vercel → Cron Jobs の実行履歴。Hobby は 21:00〜21:59 のどこかで実行（±59 分）。同じ JST 日に手動実行していると定時分は送られない |

```sql
-- 直近の通知送信結果（個人情報は含まれない）
SELECT created_at AT TIME ZONE 'Asia/Tokyo' AS jst, template, status, http_status, error
FROM notification_log ORDER BY id DESC LIMIT 20;

-- 購読の状態
SELECT platform, last_seen_at AT TIME ZONE 'Asia/Tokyo' AS last_seen,
       last_success_at AT TIME ZONE 'Asia/Tokyo' AS last_success, fail_count
FROM push_subscriptions ORDER BY created_at;
```

### 4.3 二重予約の疑い

DB の排他制約 `bookings_no_overlap` により、有効な状態（確定・来店・施術中）の予約が同じ時間に 2 件入ることはない（FR-S-01、ADR-0003）。疑いがあるときは次の順に確かめる。

1. **制約が存在するか**（最優先）: `02_prelaunch_checklist.md` の SQL 1。存在しなければ重大障害（誰かが `drizzle-kit push` 等で消した）→ すぐ `drizzle/0002_constraints.sql` の該当文で作り直し、作れない（重なりが既にある）場合は手順 2 の結果をクライアントと確認してから片方をキャンセルする。
2. **重なっている有効予約があるか**:
   ```sql
   SELECT a.public_code AS a_code, b.public_code AS b_code,
          lower(a.during) AT TIME ZONE 'Asia/Tokyo' AS a_start, upper(a.during) AT TIME ZONE 'Asia/Tokyo' AS a_end,
          lower(b.during) AT TIME ZONE 'Asia/Tokyo' AS b_start, upper(b.during) AT TIME ZONE 'Asia/Tokyo' AS b_end,
          a.source AS a_source, b.source AS b_source
   FROM bookings a
   JOIN bookings b ON a.resource_id = b.resource_id AND a.id < b.id AND a.during && b.during
   WHERE a.status IN ('confirmed','arrived','in_progress')
     AND b.status IN ('confirmed','arrived','in_progress');
   ```
   0 行なら DB 上の二重予約はない。よくある原因は次のとおり:
   - DM で受けた予約を管理 PWA に**登録していなかった**（web の予約と重なった）。
   - 「ブロック」は予約を消さない（ブロックの前からあった予約は残る）。
   - お客様キャンセル・管理者キャンセルの後に「取り消す」で戻した（枠が別の予約で埋まっていれば戻せない設計）。
3. **予約の履歴を追う**（予約番号 8 桁から）:
   ```sql
   SELECT created_at AT TIME ZONE 'Asia/Tokyo' AS jst, actor, action, diff
   FROM audit_log
   WHERE entity_type = 'booking'
     AND entity_id = (SELECT id::text FROM bookings WHERE public_code = 'XXXXXXXX')
   ORDER BY created_at;
   ```
   `actor` は `owner`（管理 PWA）/ `customer:<id>`（お客様）/ `system`。`diff` には状態・時刻・メニューなどだけが入り、氏名・電話番号は入らない。
4. お客様への連絡（片方に別の時間を案内）は Instagram DM で行い、管理 PWA で「管理者キャンセル」または時間を変えた手動予約で整理する【クライアント】。

### 4.4 Neon（DB）の停止・上限

| 症状 | 原因と対応 |
|---|---|
| 最初の表示が数百 ms〜1 秒遅い | 正常。Free は 5 分無操作でスケール to ゼロ（無効化不可）。Suspense のスケルトンで吸収する設計 |
| 全ページでエラー、Neon Monitoring で compute が止まったまま | **月 100 CU-hours を使い切った**可能性。Neon → Usage を確認。対応: 1. §4.1 で DM 受付に切替。2. 有料（Launch: 従量 $0.106/CU-hour、最低料金なし）へ変更（Vercel の Marketplace 請求。支払いはクライアント【クライアント】）するか、翌月の枠リセットを待つ |
| 書き込みエラー（容量） | Storage 1 GB 上限。`audit_log`・`rate_limits`・`notification_log` の肥大を確認（rate_limits は日次 Cron で 2 日超を削除）。有料化か古いログの整理を検討 |
| Neon 全体の障害 | Neon のステータスページ。復旧待ち。長引く場合は日次ダンプから別の Postgres（別リージョンの Neon 等）へ復元して `DATABASE_URL` を差し替える（NFR-MG-02） |

### 4.5 Vercel の使用量上限・停止

| 症状 | 対応 |
|---|---|
| Vercel から使用量のメール（80% 等） | Usage で Function Invocations・Active CPU・Fast Data Transfer を確認。原因（ボット・ポーリングの暴走）を調べる。80% を超える月が続くなら Pro 移行を判断（ADR-0001） |
| 同梱量を超えて機能が止まった | Hobby は課金ではなく機能停止（最大 30 日）。§4.1 で DM 受付に切替 → Pro へアップグレード（REL-001 §11.2） |
| 商用利用の警告・停止 | REL-001 §11.2 |

### 4.6 端末（iPhone）をなくした

1. 別の端末（予備の iPad など、または新しい iPhone）で管理 PWA を開き、ログインする。パスキーは iCloud キーチェーンで同期されていれば新しい端末でも使える。使えなければ「メールのコードでログイン」。
2. 「設定 > 通知 >**この端末以外をログアウト**」を押す → ほかの端末のログインと通知の登録がすべて取り消される（AT-19）。
3. メールアカウント（6 桁コードの届く先）と Apple ID のパスワードを変更する【クライアント】。
4. 新しい端末で「この端末にパスキーを登録する」と「通知をオンにする」を行う。
5. パスキーを個別に削除する画面はない。紛失した端末のパスキーを無効にしたい場合は開発者が DB で削除する（`auth_passkey` の該当行。作業前にバックアップ）。全ログインを強制的に無効にする最終手段は `BETTER_AUTH_SECRET` の変更 → Redeploy（全セッションと取り消しトークンが無効になる: DES-08 §12）。
6. 端末を見つけた場合も、手順 2 の後は再ログインが必要。

### 4.7 個人情報の漏えいが疑われる

1. 影響範囲（何が・いつから・誰に）を特定する。秘密値の漏えいなら該当の値を再生成して Redeploy（DES-08 §12。`DATABASE_URL` は Neon でパスワード再生成）。
2. 個人情報保護法に基づく報告・本人通知の要否をクライアントと判断する（漏えい等の報告は個人情報保護委員会へ）【クライアント】。
3. 経緯と対応を記録し、再発防止策を変更履歴に残す。

---

## 5. 連絡体制

| 役割 | 担当 | 連絡手段 | 対応時間 |
|---|---|---|---|
| 一次窓口（お客様） | クライアント | Instagram DM | 営業時間 |
| 障害連絡（クライアント → 開発者） | 開発者 | 【クライアント/開発者 要確認: LINE・電話など】 | 【要確認: 保守契約で定める】 |
| ホスティング・DB の請求・プラン変更 | 【クライアント/開発者 要確認: OI-15】 | — | — |

## 変更履歴

| 版 | 日付 | 内容 |
|---|---|---|
| v0.1 | 2026-10-12 | 初版 |
