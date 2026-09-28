# 開拓ボードゲーム — 設計案（フェーズ1）

> ステータス：**承認済み・フェーズ1実装済み**（8章の確認事項はすべて提案どおりで了承）。
> ルールの正は `docs/SPEC.md`。この文書は「どう作るか」だけを扱う。

---

## 1. フォルダ・ファイル構成

リポジトリ直下に `kaitaku-board-game/` を作り、その中で独立した Vite プロジェクトにする（既存の配当アプリとは依存を共有しない）。

```
kaitaku-board-game/
├─ docs/
│  ├─ SPEC.md                ルール仕様（受領したもの）
│  └─ DESIGN.md              この文書
├─ index.html
├─ package.json              vite / react / typescript / vitest
├─ tsconfig.json             strict: true
├─ vite.config.ts            Vitest 設定も同居
└─ src/
   ├─ logic/                 ★ 純粋なゲームロジック（React・DOM・Math.random 禁止）
   │  ├─ index.ts            公開API（applyAction, createGame, viewFor, selectors）
   │  ├─ types.ts            GameState / Action / Phase などの型
   │  ├─ constants.ts        建設コスト・駒上限・山札構成・銀行初期枚数
   │  ├─ rng.ts              Rng 型、シード付き乱数（テスト用）、shuffle
   │  ├─ board/
   │  │  ├─ topology.ts      座標系・頂点/辺ID・隣接表（静的・事前計算）
   │  │  └─ generate.ts      ランダム盤面生成（6/8隣接禁止）＋固定の初心者盤面
   │  ├─ createGame.ts       初期状態の生成（盤面・山札シャッフル・スタート手番決定）
   │  ├─ applyAction.ts      アクションの振り分け（入口）
   │  ├─ actions/            アクション種別ごとの処理
   │  │  ├─ setup.ts         初期配置（スネーク順）
   │  │  ├─ dice.ts          サイコロ・資源産出・資源不足ルール
   │  │  ├─ robber.ts        7の捨て札・盗賊移動・略奪
   │  │  ├─ build.ts         道・開拓地・都市・発展カード購入
   │  │  ├─ trade.ts         プレイヤー間交易・海上交易
   │  │  ├─ devCards.ts      騎士・街道建設・収穫・独占
   │  │  └─ turn.ts          手番終了・手番開始
   │  ├─ rules/              判定ロジック（UIのハイライトにも再利用）
   │  │  ├─ placement.ts     距離ルール・道の接続・置ける場所の列挙
   │  │  ├─ longestRoad.ts   最長交易路（DFS）と保持者の更新
   │  │  ├─ largestArmy.ts   最大騎士力
   │  │  ├─ ports.ts         各プレイヤーの交換レート
   │  │  └─ victory.ts       点数計算・勝利判定
   │  ├─ view.ts             viewFor(state, viewer)：非公開情報の伏せ字化
   │  ├─ testing.ts          テスト用の補助関数
   │  └─ **/*.test.ts        Vitest（ロジックと同じ場所に置く）
   └─ ui/
      ├─ main.tsx
      ├─ App.tsx             画面切替（開始画面 / 対戦）
      ├─ StartScreen.tsx     人数・名前・盤面の選択、続きから
      ├─ GameScreen.tsx      対戦画面。applyAction を呼ぶ（乱数はここで Math.random を渡す）
      ├─ HandoffScreen.tsx   「端末を渡してください」画面
      ├─ storage.ts          localStorage への自動保存・再開
      ├─ labels.ts           日本語名・絵文字・ログ文言
      ├─ board/              BoardSvg（タイル・数字・港・道・建物・盗賊・タップ対象）、描画座標
      ├─ panels/             PlayerList, Hand, LogPanel
      ├─ dialogs/            Trade/Respond, BankTrade, Discard, DevCard, Steal, Menu, GameOver
      └─ styles.css
```

**ロジック層の約束ごと**

- `src/logic/` は外部パッケージにも `src/ui/` にも依存しない。`window` / `document` / `localStorage` / `Math.random` / `Date.now` を使わない（lint ルールで機械的に禁止する）。
- 状態はすべて**素のJSON**（配列・オブジェクト・数値・文字列のみ。Map/Set/クラスは使わない）。そのまま localStorage や Supabase の jsonb に保存できる。
- ロジック内の import は `./foo.ts` のように拡張子付きで書く（`allowImportingTsExtensions`）。フェーズ2で Deno ベースの Supabase Edge Function から同じファイルを読み込めるようにするため。

---

## 2. 座標系

### 2.1 タイル（六角形）

- **尖り上（pointy-top）** の六角形で、アキシャル座標 `(q, r)`。盤面は横に 3-4-5-4-3 枚並ぶ形になる。
- 盤面は `max(|q|, |r|, |q+r|) ≤ 2` を満たす 19 マス。
- 隣接方向：東 `(+1,0)`、西 `(-1,0)`、北東 `(+1,-1)`、北西 `(0,-1)`、南東 `(0,+1)`、南西 `(-1,+1)`。

### 2.2 頂点を整数で表す「格子座標」

角の座標に √3 が出てこないよう、単位を次のように取る：

- 横の単位 = タイル半径 × √3/2、縦の単位 = タイル半径 × 1/2

すると

- タイル中心：`(x, y) = (2q + r, 3r)`
- 6つの角（中心からの差分）：北 `(0,-2)`、北東 `(1,-1)`、南東 `(1,1)`、南 `(0,2)`、南西 `(-1,1)`、北西 `(-1,-1)`

となり、**すべての角が整数座標**になる。隣り合うタイルが共有する角は同じ整数座標になるので、文字列キー `"x,y"` で重複を取り除くだけで頂点の一覧ができる（丸め誤差の心配がない）。
描画時は `px = x·√3/2·R`, `py = y·R/2` で SVG 座標に変換する。

この方法で計算して、**頂点 54・辺 72・海岸の辺 30** になることを確認済み（テストでも固定する）。

---

## 3. ID設計

盤面の形は毎ゲーム同じなので、**トポロジー（位置関係）は静的な定数**としてモジュール読み込み時に一度だけ計算し、ゲーム状態には入れない。状態に入るのは「どのタイルが何か」「どこに誰の駒があるか」だけ。

| 対象 | 型 | 範囲 | 採番ルール（決定的） |
|---|---|---|---|
| タイル | `HexId = number` | 0–18 | 上の行から、各行は左から |
| 頂点（交差点） | `VertexId = number` | 0–53 | 格子座標 `(y, x)` の昇順（上→下、左→右） |
| 辺 | `EdgeId = number` | 0–71 | 両端の中点 `(y, x)` の昇順 |
| プレイヤー | `PlayerId = number` | 0–3 | 席順（手番順）。オンライン時はこの外側でユーザーIDと対応付け |

数値IDにしたのは、状態を配列で持てて（`buildings[vertexId]` / `roads[edgeId]`）、JSON が小さく、比較も速いため。どの環境でも同じ番号になるよう、座標から決定的に採番する。

### 3.1 事前計算する隣接表（`topology.ts`）

```ts
interface HexInfo {
  id: HexId; q: number; r: number;
  center: { x: number; y: number };   // 格子座標
  vertices: VertexId[];               // 6個（北から時計回り）
  edges: EdgeId[];                    // 6個
  neighbors: HexId[];                 // 盤面内の隣接タイル（6/8判定用）
}
interface VertexInfo {
  id: VertexId; x: number; y: number;
  hexes: HexId[];                     // 接するタイル 1〜3枚
  neighbors: VertexId[];              // 隣接頂点 2〜3個（距離ルール用）
  edges: EdgeId[];                    // 接する辺 2〜3本
}
interface EdgeInfo {
  id: EdgeId;
  vertices: [VertexId, VertexId];
  hexes: HexId[];                     // 1枚なら海岸の辺
  neighbors: EdgeId[];                // 端点を共有する辺
}
interface Topology {
  hexes: HexInfo[]; vertices: VertexInfo[]; edges: EdgeInfo[];
  coastalEdges: EdgeId[];             // 海岸の辺30本（時計回り）
  portEdges: EdgeId[];                // 港の位置9か所（固定）
}
export const TOPOLOGY: Topology;
```

### 3.2 港の位置

海岸の辺30本を時計回りに並べ、`3,3,4,3,3,4,3,3,4` 本おきに9本選んで港の位置に固定する（港同士が交差点を共有しない）。ランダム盤面では、この9か所に港の種類（汎用3:1 ×4、資源別2:1 ×5）をシャッフルして割り当てる。

---

## 4. ゲーム状態（`GameState`）

```ts
type Resource = 'wood' | 'brick' | 'sheep' | 'wheat' | 'ore';
type Terrain  = 'forest' | 'hills' | 'pasture' | 'fields' | 'mountains' | 'desert';
type ResourceCounts = Record<Resource, number>;
type DevCardType = 'knight' | 'roadBuilding' | 'yearOfPlenty' | 'monopoly' | 'victoryPoint';

interface Tile { terrain: Terrain; number: number | null }        // 砂漠は null
interface Port { edge: EdgeId; kind: Resource | 'any' }            // any = 3:1
interface Building { owner: PlayerId; kind: 'settlement' | 'city' }

interface PlayerState {
  name: string;
  color: string;
  resources: ResourceCounts;                                       // 非公開（枚数のみ公開）
  devCards: { type: DevCardType; boughtTurn: number }[];           // 非公開（枚数のみ公開）
  knightsPlayed: number;                                           // 公開
}

interface GameState {
  tiles: Tile[];                        // HexId で引く（19）
  ports: Port[];                        // 9
  robber: HexId;
  buildings: (Building | null)[];       // VertexId で引く（54）
  roads: (PlayerId | null)[];           // EdgeId で引く（72）

  players: PlayerState[];               // PlayerId で引く（2〜4）
  bank: ResourceCounts;                 // 初期値 各19
  devDeck: DevCardType[];               // 作成時にシャッフル済み。末尾が山札の一番上（非公開）

  turn: number;                         // 通算手番数（「買った手番には使えない」の判定用）
  currentPlayer: PlayerId;
  phase: Phase;
  devCardPlayedThisTurn: boolean;
  lastRoll: [number, number] | null;

  longestRoad: { holder: PlayerId | null; lengths: number[] };
  largestArmy: { holder: PlayerId | null };
  trade: TradeOffer | null;             // 手番プレイヤーの交易提案

  winner: PlayerId | null;
  log: LogEntry[];                      // 構造化イベント（表示文言はUI側で作る）
}
```

- 駒の残り数は持たず、盤面から数える（`5 − 自分の開拓地数` など）。都市化で開拓地が1つ戻る仕様が自然に表現でき、状態の食い違いが起きない。
- ログは `{ kind: 'steal', from, to, resource, visibleTo: [from, to] }` のように**誰に見せてよいか**を持たせる（奪われた資源の種類は当事者だけが見られる）。

### 4.1 フェーズ（判別共用体）

```ts
type Phase =
  | { type: 'setup'; round: 1 | 2; step: 'settlement' | 'road'; order: PlayerId[]; index: number; lastSettlement: VertexId | null }
  | { type: 'preRoll' }                                        // 発展カード使用 or サイコロ
  | { type: 'discard'; pending: Partial<Record<PlayerId, number>> }   // 捨てる残り枚数（全員同時・順不同）
  | { type: 'moveRobber'; resume: 'preRoll' | 'main' }         // 7 または 騎士
  | { type: 'steal'; candidates: PlayerId[]; resume: 'preRoll' | 'main' }
  | { type: 'main' }                                           // 交易・建設（何度でも）
  | { type: 'roadBuilding'; remaining: number; resume: 'preRoll' | 'main' }
  | { type: 'gameOver' };
```

`resume` は、サイコロの前に騎士・街道建設を使ったとき、処理後に「サイコロ前」へ戻るために持つ。

### 4.2 アクション

```ts
type Action =
  | { type: 'placeSetupSettlement'; vertex: VertexId }
  | { type: 'placeSetupRoad'; edge: EdgeId }
  | { type: 'rollDice' }
  | { type: 'discard'; resources: ResourceCounts }
  | { type: 'moveRobber'; hex: HexId }                         // 対象が1人なら略奪まで自動
  | { type: 'steal'; target: PlayerId }
  | { type: 'buildRoad'; edge: EdgeId }
  | { type: 'buildSettlement'; vertex: VertexId }
  | { type: 'buildCity'; vertex: VertexId }
  | { type: 'buyDevCard' }
  | { type: 'playKnight' }
  | { type: 'playRoadBuilding' }
  | { type: 'placeFreeRoad'; edge: EdgeId }                    // 街道建設中
  | { type: 'playYearOfPlenty'; resources: [Resource, Resource] }
  | { type: 'playMonopoly'; resource: Resource }
  | { type: 'bankTrade'; give: ResourceCounts; get: ResourceCounts }   // 複数口まとめて可
  | { type: 'proposeTrade'; give: ResourceCounts; get: ResourceCounts } // 手番プレイヤー
  | { type: 'respondTrade'; accept: boolean }                  // 他プレイヤー
  | { type: 'counterTrade'; give: ResourceCounts; get: ResourceCounts } // 他プレイヤーの対案
  | { type: 'confirmTrade'; partner: PlayerId }                // 手番プレイヤーが相手を選んで成立
  | { type: 'cancelTrade' }
  | { type: 'endTurn' };
```

---

## 5. 公開API

```ts
type Rng = () => number;   // [0, 1) を返す関数

function createGame(config: { players: { name: string; color: string }[]; board: 'random' | 'beginner' }, rng: Rng): GameState;

function applyAction(state: GameState, action: Action, playerId: PlayerId, rng: Rng):
  { state: GameState; error: string | null };

function viewFor(state: GameState, viewer: PlayerId | null): PlayerView; // 他人の手札・山札を伏せる
// UI 向けセレクタ（ロジックと同じ判定を使う）
function legalSettlementVertices(state, playerId, requireRoad): VertexId[];
function legalRoadEdges(state, playerId, setupVertex?): EdgeId[];
function legalCityVertices(state, playerId): VertexId[];
function tradeRates(state, playerId): Record<Resource, number>;   // 2 / 3 / 4
function victoryPoints(state, playerId, includeHidden): number;
function devCardError(state, playerId, type): string | null;      // 使えない理由
```

- **乱数は第4引数で渡す**（仕様の `applyAction(state, action, playerId)` に `rng` を足した形）。フェーズ1ではUI側で `Math.random` を渡し、テストではシード付き乱数や固定列を渡す。フェーズ2ではサーバーが `crypto` 由来の乱数を渡す。
- 不正な操作は **元の state をそのまま返し、`error` に日本語の理由**（例：「距離ルールにより置けません」）を入れる。
- 内部では `structuredClone` で複製してから変更するので、呼び出し側から見れば引数の state は決して書き換わらない。
- 勝利判定は、手番プレイヤーに関わる操作の直後と手番開始時に実行する。

---

## 6. 主要ロジックの方針

| 項目 | 方針 |
|---|---|
| 距離ルール | `VertexInfo.neighbors` のすべてが空いていること |
| 道の接続 | 端点のどちらかに自分の建物がある、または「他人の建物がない端点」で自分の道とつながる |
| 資源産出 | 資源ごとに全員の受取合計を出し、銀行が足りなければ、受取人が1人ならその人に残り全部・複数なら誰にも渡さない |
| 7 | 8枚以上の全員に `floor(n/2)` を割り当て → 全員が捨て終わったら盗賊移動（今と同じタイルは不可）→ 略奪 |
| 最長交易路 | プレイヤーごとに全頂点を起点に DFS（同じ辺は2度通らない。他人の建物がある頂点は「そこで止まる」＝通り抜け不可）。道・開拓地を建てるたびに全員分を再計算し、SPEC 11章の特例どおりに保持者を更新 |
| 最大騎士力 | 3枚以上、かつ保持者より**多い**ときだけ移る |
| 発展カード | `boughtTurn === turn` のカードは使用不可。勝利点カードは使用操作なしで常に点数に数える |
| 6/8の隣接禁止 | 数字チップをシャッフルして配置 → 6/8 が隣接していたら引き直し（上限回数を超えたら入れ替えで解消） |

### テスト（Vitest）で必ず押さえるもの

- 盤面：頂点54・辺72・海岸30、各頂点の接するタイル数、6/8が隣接しない（多数のシードで確認）
- **距離ルール**：隣接頂点に自分／他人の建物があると置けない、初期配置でも適用
- **最長交易路**：一直線、分岐、ループ、他人の開拓地による分断、同率時の保持者維持、同率複数で持ち主なし、5本未満で持ち主なし
- **7の処理**：7枚は捨てない、8枚→4枚、9枚→4枚、全員捨て終わるまで進めない、盗賊を同じタイルに置けない、対象1人なら自動略奪、対象0枚なら何も得ない
- **資源不足時の配布**：足りる／複数人で足りない（誰ももらえない）／1人だけなら残り全部／他の資源に影響しない
- そのほか：スネーク順、2つ目の開拓地の初期資源、海上交易のレート、買った手番の発展カード使用不可、1手番1枚、他人の手番中は勝利しない

---

## 7. UI（スマホ前提）の方針

- 盤面は SVG（`viewBox` で画面幅にフィット）。地形は色＋絵文字（🌲森 🧱丘陵 🐑牧草地 🌾畑 ⛰️山地 🏜️砂漠）、数字チップは出目と点（6/8は赤）。
- 建設ボタンを押すと**置ける場所だけ**を大きめの丸／太線で表示し、それをタップして確定（誤タップ防止に、選択 → 「ここに建てる」ボタンの2段階にする）。
- 画面構成（縦長）：上に全員の状況（点数・手札枚数・発展カード枚数・騎士数・特別カード）、中央に盤面、下に自分の手札とアクションボタン。交易・捨て札・発展カードはボトムシートのダイアログ。
- **ホットシートの目隠し**：手番交代時と、7で複数人が捨てるとき・交易相手が承認するときに「○○さんに端末を渡してください」画面をはさみ、その人の手札だけを表示する（設定でオフにもできる）。
- **自動保存**：localStorage に保存し、リロードしても続きから再開できる。

---

## 8. 確認したい点

1. **フォルダ**：このリポジトリ（dividend-app）直下の `kaitaku-board-game/` で進めてよいか。Vercel では「Root Directory」にこのフォルダを指定してデプロイする形になる。
2. **人数**：SPEC 2章は「3〜4人」、指示文は「2〜4人」。**2〜4人対応（2人のときも同じルール）**にする予定。
3. **勝利点カードの公開**：手番中に合計10点以上になったら**自動で公開して勝利**にする（「公開」ボタンは設けない）。
4. **ホットシートの目隠し画面**と**自動保存**を入れてよいか（上記7章）。
