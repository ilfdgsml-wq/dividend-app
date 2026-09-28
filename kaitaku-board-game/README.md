# 開拓ボードゲーム（仮）

六角形の盤面で資源を集めて開拓する、2〜4人用のボードゲームです。
フェーズ1として、1台の端末を回して遊ぶ「ホットシート」版を実装しています。

- ルール仕様：[docs/SPEC.md](docs/SPEC.md)
- 設計（座標系・ID・データ構造）：[docs/DESIGN.md](docs/DESIGN.md)

## 動かし方

```bash
cd kaitaku-board-game
npm install
npm run dev        # 開発サーバー（http://localhost:5173）
npm test           # ロジックのユニットテスト（Vitest）
npm run lint       # ESLint
npm run build      # 型チェック＋本番ビルド（dist/）
```

スマホで試すときは `npm run dev -- --host` で起動し、同じネットワークの端末から表示されたURLを開きます。

## 遊び方（画面）

- 盤面の**光っている場所**をタップ → 下の確認ボタン（または同じ場所をもう一度タップ）で確定します。
- 手番交代時・7で手札を捨てるとき・交易の返答時には「端末を渡してください」画面が出て、その人の手札だけを表示します（メニューからオフにできます）。
- 進行中のゲームはブラウザに自動保存され、再読み込みしても「続きから遊ぶ」で再開できます。

## フォルダ構成

```
src/
  logic/   ゲームロジック（純粋関数。React・DOM・Math.random を使わない）
    applyAction.ts   唯一の入口：applyAction(state, action, playerId, rng) => { state, error }
    createGame.ts    初期状態の生成
    board/           盤面トポロジー（頂点54・辺72）と盤面生成
    actions/         操作ごとの処理（初期配置・サイコロ・盗賊・建設・交易・発展カード・手番）
    rules/           判定（距離ルール・最長交易路・最大騎士力・港・勝利判定）
    view.ts          viewFor：他人の手札などを伏せた状態（フェーズ2でサーバーから配る形）
    *.test.ts        ユニットテスト
  ui/      React の画面（盤面SVG・パネル・ダイアログ）
```

ロジック層は ESLint で `window` / `document` / `localStorage` / `Math.random` / `Date.now` / React の使用を禁止しており、フェーズ2でサーバー（Supabase Edge Function）からそのまま使えるようにしています。

## Vercel へのデプロイ

リポジトリを Vercel にインポートし、**Root Directory を `kaitaku-board-game`** に設定します（Framework Preset は Vite、ビルドコマンド・出力先は既定のままで動きます）。
