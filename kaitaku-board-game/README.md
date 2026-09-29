# 開拓ボードゲーム（仮）

六角形の盤面で資源を集めて開拓する、2〜4人用のボードゲームです。

- **オンライン対戦**：部屋を作ってURLを友達に送ると、それぞれのスマホから参加できます（Vercel + Supabase）。
- **ホットシート**：1台の端末を順番に回して遊べます（サーバー不要）。

関連ドキュメント：ルール仕様 [docs/SPEC.md](docs/SPEC.md)／設計 [docs/DESIGN.md](docs/DESIGN.md)／デプロイ手順 [docs/DEPLOY.md](docs/DEPLOY.md)

## オンライン対戦を公開する

Supabase の作業（プロジェクト作成・テーブル作成・サーバー関数のデプロイ）は、Supabase コネクタを使って Claude が行います（手順は [docs/DEPLOY.md](docs/DEPLOY.md)）。
人がやるのは次の3つだけです。

1. claude.ai の **設定 → コネクタ** で **Supabase** を接続する（Supabase のアカウントがなければその場で作れます）。
2. Claude が main にマージしたら、[vercel.com](https://vercel.com) に GitHub でログインし、**Add New → Project** でこのリポジトリを Import、
   **Root Directory** を `kaitaku-board-game` にして **Deploy**（環境変数の入力は不要）。
3. 表示された `https://〇〇.vercel.app` を友達に送る。

- 秘密の鍵はどこにも入力しません。サーバー用の鍵は Supabase の中だけで使われ、ブラウザ用の公開してよい値だけを `.env.production` に書いています。
- Supabase の無料プランは、しばらく使わないとプロジェクトが一時停止されます。遊ぶ前に管理画面で確認し、止まっていたら **Restore** してください。
- 同じブラウザで開き直せば同じ席に戻れます（ブラウザごとの秘密のキーで本人を見分けています）。ブラウザのデータを消すと別人扱いになります。

## 開発

```bash
cd kaitaku-board-game
npm install
npm run dev         # 開発サーバー（.env.production の Supabase につながる）
npm run dev:mock    # オンライン対戦を Supabase なしで試す（サーバーは開発サーバー内のメモリ上）
npm test            # ユニットテスト（ロジック・サーバー処理）
npm run lint        # ESLint
npm run build       # 型チェック＋本番ビルド（dist/）＋サーバー関数（supabase/functions/game/index.ts）
npm run build:edge  # サーバー関数だけ作り直す
```

- `dev:mock` では、別のブラウザ（またはシークレットウィンドウ）で同じURLを開くと別の人として参加できます。
- **サーバーのコード（`server/`）やゲームロジックを変えたら `npm run build:edge` を実行し、`supabase/functions/game/index.ts` もコミットして、Edge Function をデプロイし直してください**（Supabase コネクタの `deploy_edge_function`、または `supabase functions deploy game --no-verify-jwt`）。

## しくみ

```
ブラウザ ──操作・読み込み──▶ Supabase Edge Function「game」──▶ applyAction で検証 ──▶ Postgres に保存
   ▲                                                                         │
   └──── Realtime Broadcast（room:部屋コード）で「変わった」とだけ通知 ◀────┘
```

- すべての操作はサーバーで `applyAction` を通して検証し、乱数（サイコロ・略奪・山札）もサーバーで作ります。
- 完全な状態（山札・全員の手札）は `game_states`、各プレイヤーから見た状態（他人の手札は伏せ字）は `player_views` に保存します。
  どちらもブラウザからは読めず、関数が本人の分だけを返します。
- 通知には中身を載せないので、部屋コードを知っていても他人の手札は見えません。

## フォルダ構成

```
src/
  logic/     ゲームロジック（純粋関数。React・DOM・Math.random を使わない）
    applyAction.ts   唯一の入口：applyAction(state, action, playerId, rng) => { state, error }
    view.ts          viewFor：他人の手札などを伏せた「本人から見た状態」
  online/    オンライン対戦の通信（Supabase / 開発用の模擬サーバー）
  ui/        React の画面（GameScreen はホットシートとオンラインで共通）
server/      サーバー処理（handler.ts）と保存先（Supabase / メモリ）、Edge Function の入口（edge.ts）
supabase/schema.sql              テーブルと権限の設定
supabase/functions/game/index.ts Edge Function（npm run build:edge で生成）
```
