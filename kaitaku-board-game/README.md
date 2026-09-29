# 開拓ボードゲーム（仮）

六角形の盤面で資源を集めて開拓する、2〜4人用のボードゲームです。

- **オンライン対戦**：部屋を作ってURLを友達に送ると、それぞれのスマホから参加できます（Vercel + Supabase）。
- **ホットシート**：1台の端末を順番に回して遊べます（サーバー不要）。

関連ドキュメント：ルール仕様 [docs/SPEC.md](docs/SPEC.md)／設計 [docs/DESIGN.md](docs/DESIGN.md)

## オンライン対戦を公開する手順

### 1. Supabase（データの保存と同期）

1. [supabase.com](https://supabase.com) で **New project** を作る（リージョンは Northeast Asia (Tokyo) がおすすめ）。
2. **Authentication → Sign In / Providers** で **Allow anonymous sign-ins** をオンにして保存。
3. **SQL Editor** を開き、[`supabase/schema.sql`](supabase/schema.sql) の中身をすべて貼り付けて **Run**（何度実行しても大丈夫です）。
4. **Project Settings → API Keys** で次の3つを控える。
   - Project URL（`https://xxxx.supabase.co`）
   - **Publishable key**（`sb_publishable_…`）… ブラウザに渡してよい鍵
   - **Secret key**（`sb_secret_…`）… サーバー専用。**他人に見せない・リポジトリに書かない**

   ※ 古いプロジェクトで Legacy の `anon` / `service_role` キーしかない場合は、それぞれを Publishable / Secret の代わりに使えます。

### 2. Vercel（サイトの公開）

1. [vercel.com](https://vercel.com) に GitHub でログインし、**Add New → Project** でこのリポジトリを Import。
2. **Root Directory** を `kaitaku-board-game` にする（Framework Preset は Vite のまま）。
3. **Environment Variables** に次の3つを登録。

   | 名前 | 値 |
   |---|---|
   | `VITE_SUPABASE_URL` | Project URL |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable key |
   | `SUPABASE_SECRET_KEY` | Secret key |

4. **Deploy**。友達が開けるのは本番URL（`https://〇〇.vercel.app`）です。ブランチごとのプレビューURLは Vercel のログインが必要なので、
   本番にしたいブランチを main にマージするか、**Settings → Git → Production Branch** をそのブランチに変えてください。

環境変数を後から変えたときは、Vercel で **Redeploy** すると反映されます。

### 注意

- Supabase の無料プランは、しばらく使わないとプロジェクトが一時停止されます。遊ぶ前に管理画面で動いているか確認し、止まっていたら **Restore** してください。
- 同じブラウザで開き直せば、同じ席に戻れます（匿名ログインの情報をブラウザに保存しています）。ブラウザのデータを消すと別人扱いになります。

## 開発

```bash
cd kaitaku-board-game
npm install
npm run dev         # 開発サーバー（ホットシートのみ。オンラインは下の mock か vercel dev）
npm run dev:mock    # オンライン対戦を Supabase なしで試す（サーバーは開発サーバー内のメモリ上）
npm test            # ユニットテスト（ロジック・サーバー処理）
npm run lint        # ESLint
npm run build       # 型チェック＋本番ビルド（dist/）＋サーバー関数（api/game.js）
npm run build:api   # サーバー関数 api/game.js だけ作り直す
```

- `dev:mock` では、別のブラウザ（またはシークレットウィンドウ）で同じURLを開くと別の人として参加できます。
- 本物の Supabase につないで手元で試すときは、`.env.example` を `.env.local` にコピーして値を入れ、`vercel dev` で起動します。
- **サーバーのコード（`server/`）やゲームロジックを変えたら `npm run build:api` を実行し、`api/game.js` も一緒にコミットしてください。**
  Vercel は `api/game.js`（依存をすべて含んだ1ファイル）をそのまま関数として動かします。

## しくみ

```
ブラウザ ──操作──▶ /api/game（Vercel の関数）──▶ applyAction で検証 ──▶ Supabase に保存
   ▲                                                         │
   └──── Realtime で変更を通知・自分の見え方だけを読む ◀─────┘
```

- すべての操作はサーバーで `applyAction` を通して検証し、乱数（サイコロ・略奪・山札）もサーバーで作ります。
- 完全な状態（山札・全員の手札）は `game_states` に保存し、ブラウザからは読めません。
- 各プレイヤーには、他人の手札を伏せた「本人から見た状態」を `player_views` に保存し、RLS で本人だけが読めます。

## フォルダ構成

```
src/
  logic/     ゲームロジック（純粋関数。React・DOM・Math.random を使わない）
    applyAction.ts   唯一の入口：applyAction(state, action, playerId, rng) => { state, error }
    view.ts          viewFor：他人の手札などを伏せた「本人から見た状態」
  online/    オンライン対戦の通信（Supabase / 開発用の模擬サーバー）
  ui/        React の画面（GameScreen はホットシートとオンラインで共通）
server/      サーバー処理（handler.ts）と保存先（Supabase / メモリ）
api/game.js  Vercel の関数（npm run build:api で生成）
supabase/schema.sql  テーブル・RLS・リアルタイム配信の設定
```
