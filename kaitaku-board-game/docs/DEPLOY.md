# オンライン対戦のデプロイ手順（Claude 用）

この手順は、**Supabase コネクタ（MCP）が使える Claude のセッション**が実行する。
ユーザーにやってもらうのは「コネクタの接続」「Vercel の Import」「main へのマージの了承」だけにする。
作業ブランチは `claude/settlers-board-game-ycz907`（このブランチの内容をもとに進める）。

## 前提

- サーバー処理は Supabase Edge Function `game`（`supabase/functions/game/index.ts`。`npm run build:edge` で生成済み・コミット済み）。
- データベースは `supabase/schema.sql`。ブラウザからは一切アクセスできず、Edge Function がサーバー用の鍵で読み書きする。
- プレイヤーはログインしない（ブラウザごとの秘密のキーの SHA-256 をユーザーIDにする）。**Supabase の匿名ログインの設定は不要**。
- フロント（Vercel）に必要なのは公開してよい2つの値だけで、`kaitaku-board-game/.env.production` に書いてコミットする。Vercel の環境変数は不要。

## 手順

1. **組織の確認**：`list_organizations`。複数あればユーザーにどれを使うか聞く。
2. **プロジェクト作成**：
   - `get_cost`（type: `project`）→ 費用をユーザーに伝えて了承をもらう（無料枠なら $0）→ `confirm_cost`
   - `create_project`：name `kaitaku-board-game`、region `ap-northeast-1`（東京）
   - `get_project` で status が `ACTIVE_HEALTHY` になるまで待つ（数分かかる）
3. **テーブル作成**：`apply_migration`（name `kaitaku_schema`、query は `supabase/schema.sql` の全文）。
   `list_tables` で `rooms` `room_players` `game_states` `player_views` があることを確認。
4. **関数のデプロイ**：まず `npm run build:edge` で作り直し、差分がなければそのまま使う。
   `deploy_edge_function`：name `game`、entrypoint `index.ts`、**verify_jwt: false**（ログインを使わないため）、
   files は `supabase/functions/game/index.ts` の1ファイル。
5. **接続先の値**：`get_project_url` と `get_publishable_keys`（新しい publishable key。なければ legacy の anon key）。
   `kaitaku-board-game/.env.production` を作ってコミットする：

   ```
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

   （anon key しかない場合は `VITE_SUPABASE_ANON_KEY=...`。どちらも公開前提の値なのでコミットしてよい。Secret key は絶対に書かない）
6. **確認**：`get_advisors`（type `security`）で重大な指摘がないか見る。テーブルは RLS 有効・ポリシーなし（= ブラウザから不可）が意図どおり。
7. **ビルドとテスト**：`npm ci && npm run build && npm test` が通ること。プッシュする。
8. **main へのマージ**：Vercel の本番は main から作られるので、PR を作り、ユーザーの了承を得てマージする。
9. **ユーザーに Vercel の Import を案内**：
   - vercel.com に GitHub でログイン → **Add New → Project** → `dividend-app` を Import
   - **Root Directory** を `kaitaku-board-game` にして **Deploy**（環境変数の入力は不要）
10. **動作確認**：ユーザーに本番URLで「部屋を作る」を試してもらい、うまくいかなければ `get_logs`（service `edge-function`）で原因を見る。
    環境のネットワーク設定で `*.supabase.co` が許可されていれば、Claude から curl で関数を直接試せる：

    ```bash
    curl -s -X POST https://<ref>.supabase.co/functions/v1/game \
      -H "apikey: <publishable key>" -H "x-player-key: $(openssl rand -hex 32)" \
      -H "Content-Type: application/json" -d '{"op":"create","name":"テスト"}'
    ```

## うまくいかないとき

- 関数が 401 / 403 を返す：`verify_jwt` が true になっていないか確認（false でデプロイし直す）。
- 関数が 500「サーバーの設定が足りません」：関数に `SUPABASE_URL` とサーバー用の鍵（`SUPABASE_SERVICE_ROLE_KEY` または `SUPABASE_SECRET_KEYS`）が渡っていない。Supabase が自動で渡すので、通常は起きない。
- 画面が自動で更新されない：Realtime の Broadcast が届いていない。約10秒ごとの読み直しでも追いつくので遊べるが、`get_logs`（service `realtime`）を確認する。
- 無料プランは使わないと一時停止される。止まっていたら管理画面で **Restore**（MCP の `restore_project` でも可）。
