# MHS Catapult — 機能追加設計書

**日付**: 2026-05-28  
**対象ファイル**: `index.html`, `style.css`, `script.js`  
**実装アプローチ**: 既存スタイル踏襲（1ファイル完結、Aプラン）

---

## 追加機能一覧

| # | 機能 | 概要 |
|---|------|------|
| 1 | サウンドエフェクト | Web Audio API で11種の効果音を合成 |
| 2 | BGM | Web Audio API で4種のBGMをループ再生 |
| 3 | ハイスコア保存 | LocalStorage にベストスコア・最高順位を記録 |
| 4 | 特殊ランダムイベント | ゲーム中にピンチ/ボーナスイベントをランダム発動 |
| 5 | スマホ対応（横向きのみ） | 縦向き時にオーバーレイ表示、タッチ操作を最適化 |

---

## セクション1: オーディオシステム（SFX + BGM）

### 構造

`script.js` の `SFX` オブジェクトと `playSfx()` 関数を廃止し、`AudioManager` オブジェクトで置き換える。

```
AudioManager
  ├── ctx: AudioContext（初回ユーザー操作時に遅延初期化）
  ├── bgmNode: 再生中BGMのノード参照（停止用）
  ├── play(name)     ← 旧 playSfx() の代替
  ├── playBgm(name)  ← BGM開始（既存BGMは自動停止）
  └── stopBgm()      ← BGM停止
```

### 初期化タイミング

`AudioContext` はブラウザの自動再生制限のため、最初のユーザー操作（クリック/タップ/キー）時に `AudioManager.init()` を呼んで生成する。

### 効果音（11種）の合成方針

| 名前 | 波形 | 内容 |
|------|------|------|
| `select` | square | 短いクリック音 |
| `start` | square×2 | 2音ファンファーレ |
| `fire` | sawtooth | 下降スウィープ（発射音） |
| `hit` | sine | 低音の短い衝撃音 |
| `miss` | triangle | 下降音（ションボリ） |
| `swish` | sine | 高めの短いチャイム |
| `bank` | square | 中音の跳ね音 |
| `green` | sine×2 | 明るい2重音 |
| `super` | sine×3 | 3音上昇ファンファーレ |
| `result` | sine | 短いメロディ（4音） |
| `talk` | square | タイプライター打鍵音（極短） |

### BGM（4種）の合成方針

| 名前 | 場面 | 内容 |
|------|------|------|
| `title` | タイトル画面 | ゆっくりした4小節ループ（square波） |
| `game` | ゲーム中 | テンポ速めの8小節ループ（square + triangle） |
| `result_good` | リザルト1〜3位 | 明るい2小節フレーズ |
| `result_bad` | リザルト4〜8位 | 落ち着いた2小節フレーズ |

BGMは画面遷移（`switchScreen()`）に合わせて自動切り替え。

### 既存コードへの影響

- `SFX` オブジェクト（行19〜24）を削除
- `playSfx()` 関数（行25〜28）を `AudioManager.play()` の呼び出しに変更
- `switchScreen()` に `AudioManager.playBgm()` の呼び出しを追加

---

## セクション2: ハイスコア保存

### 保存内容

| LocalStorageキー | 内容 | 初期値 |
|-----------------|------|--------|
| `mhsc_best_score` | 歴代最高スコア | 0 |
| `mhsc_best_rank` | 歴代最高順位（1〜8） | 9 |

### 表示場所

**タイトル画面**: `BEST  1234 pt  /  1ST PLACE` を表示。ベストスコアが0の場合は `- - -` と表示。

**リザルト画面**: 今回のスコアが更新した場合、ランキング表の上に `★ NEW RECORD!` を1行追加。

### 更新判定

`showResult()` 内でランキング確定後に判定・保存。スコアまたは順位のどちらかが改善した場合を「更新」とみなす。

### Storageオブジェクト

```
Storage
  ├── load()          ← LocalStorageから読み込み
  ├── save(score, rank) ← LocalStorageに書き込み
  └── isNewRecord(score, rank) ← 更新判定（bool）
```

### 既存コードへの影響

- `index.html`: タイトル画面の `.title-box` 内に `<p id="best-score-display">` を追加
- `script.js`: `Storage` オブジェクトを追加、`showResult()` に更新判定・表示ロジックを追加

---

## セクション3: 特殊ランダムイベント

### 発動条件

- 対象ショット: 2〜9投目（1投目・10投目は除外）
- 通常ショットの発動確率: **35%**
- 緑球ショット（3・6・9投目）の発動確率: **15%**（既存演出と重複を避ける）
- 1ゲームの最大発動数: **3回**

### イベント一覧

| ID | 種別 | 表示名 | 効果 |
|----|------|--------|------|
| `GUST` | ピンチ | GUST! | 風の強さを2倍に |
| `NARROW` | ピンチ | NARROW RIM! | ゴールゾーン幅を60%に縮小 |
| `FAST` | ピンチ | SPEED UP! | ゴール移動速度を1.8倍に（移動開始後のみ） |
| `DOUBLE` | ボーナス | 2x ZONE! | このショットのスコアを2倍 |
| `SLOW_WIND` | ボーナス | CALM! | 風の強さを0.3倍に |
| `BONUS_GREEN` | ボーナス | BONUS BALL! | このショットのボールを緑球に変更 |

### 通知UI

既存の `showMsg()` を流用。種別によって色を分ける。

- ピンチ系 → `warn`（青）
- ボーナス系 → `bonus`（緑）

表示タイミング: `setupShot()` 内で既存メッセージの後に1秒遅延で表示。

### 内部状態

```js
let currentEvent = null; // { id, kind } or null
let eventCountThisGame = 0;
```

`onBallSettled()` の末尾で `currentEvent = null` にリセット。

### 既存コードへの影響

- `currentEvent`, `eventCountThisGame` 変数を追加
- `setupShot()` にイベント抽選ロジックを追加
- `effectiveWindAccel()`: `GUST`/`SLOW_WIND` の倍率を適用
- `goalRect()`: `NARROW` でゾーン幅を縮小、`FAST` で移動速度係数を変更
- `onScored()`: `DOUBLE` でスコアを2倍
- `onBallSettled()`: イベントをリセット

---

## セクション4: スマホ対応（横向きのみ）

### 縦向き検知オーバーレイ

`index.html` に `div#rotate-overlay` を常時配置。CSS の `@media (orientation: portrait)` で表示/非表示を切り替える（JSは不要）。

表示内容:
```
（回転アイコン）
デバイスを
横向きに
してください
PLEASE ROTATE
```

### タッチ操作の調整

| 対象 | 変更内容 |
|------|---------|
| `.ctrl-btn` | `min-height: 44px` を追加（タップ領域確保） |
| `.ctrl-btn.fire` | `min-width: 96px` に拡大 |
| `.hud-bottom` | `padding: 12px` に拡大（指が当たりやすく） |

### 既存コードへの影響

- `index.html`: `#game-wrapper` の外側（`body` 直下）に `#rotate-overlay` を追加
- `style.css`: オーバーレイのスタイル、`@media (orientation: portrait)` での表示制御、タッチボタンの最小サイズ調整

---

## 変更ファイルサマリー

| ファイル | 変更内容 |
|---------|---------|
| `index.html` | ベストスコア表示要素、回転オーバーレイを追加 |
| `style.css` | 回転オーバーレイのスタイル、タッチボタン調整、portrait media query を追加 |
| `script.js` | AudioManager、Storage、イベントシステムを追加。既存のSFXスタブを置き換え |

追加行数の見込み: `script.js` +約350行、`style.css` +約40行、`index.html` +約15行
