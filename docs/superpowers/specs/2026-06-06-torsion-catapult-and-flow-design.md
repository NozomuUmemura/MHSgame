# トーション投石機への刷新 & ゲームフロー変更 設計

日付: 2026-06-06

## 目的
1. カタパルトの見た目を刷新（メカ風 → ねじりばね＝トーション式オナガー）
2. ストーリーモードを廃止
3. 投石終了後、自動でドッジに移行せず「自分との闘いに挑むか」のポップアップを出す
4. `tenshi.m4a` の音量を2倍にする

## 1. 投石機: トーション式オナガー

`drawCatapult` とその専用ヘルパ（`drawMechaWheel` / `drawMechaStrut` / `drawMechaPiston` /
`drawDiagPlank`）を木製オナガー用の描画に置き換える。`drawCatapultFlag` は機能（風向き表示）を
保ちつつ木製ペナントに再スタイル。

維持する仕組み:
- ピボット `(pivotX, pivotY)` を中心に `ctx.rotate(-ang)`（`ang = angleDeg`）でアームを傾ける
- AIM中はアーム先端にボールを描画（`drawPixelBall(tip, 0, ...)`）
- 発射リコイル（`lastFireTime` 基準、`since<220ms` で後方キック）

新ビジュアル要素:
- 重い木枠の台座（横長の木箱）＋左右の車輪
- 中央のねじり縄バネ束（横ドラム）。縄の巻きを明暗の縦縞で表現。アームの回転軸＝このドラム
- ドラムを支える左右のAフレーム/側板
- 投擲アーム（木の梁）＋先端のスリング/バケット（ボール受け）
- 配色: 木 `#6b4a2b`系 / 鉄 `#5a5a60`系 / 縄 `#c9a86a`系。発光は最小限

物理・当たり判定・`LAUNCHER` 座標は変更しない（見た目のみ）。

## 2. ストーリーモード廃止
- `index.html`: タイトルの `#btn-story` ボタンを削除。`#btn-free` のラベルを「GAME START」に変更
- `script.js`:
  - `storyMode` 変数と全参照を除去（`btn-story` リスナー、`finishDialogue` の自動ドッジ移行、
    `showDodgeResult` の「STORY CLEAR」プレフィックス、`mhsc_story_clear` 保存）
  - キーボードSpace開始時の `storyMode=false` も不要に
- タイトルの `#btn-dodge`（アンロック後表示）は残す

## 3. 投石後ポップアップ
- `index.html`: 結果画面 `#result-summary` 内（または専用オーバーレイ）に確認ポップアップを追加
  - 文言「自分との闘いに挑む？」＋ ボタン `はい` / `いいえ`
- `script.js`:
  - `finishDialogue` 後、`#result-summary` 表示時にポップアップを表示
  - `はい` → `startDodgeGame()`
  - `いいえ` → ポップアップを閉じる（RETRY / TITLE が見える状態）
  - 毎ゲーム後に表示

## 4. tenshi.m4a 音量2倍
- `switchScreen(STATE.DODGE)` の `playFileBgm('tenshi.m4a', 0.5)` を `1.0` に変更
  （HTML5 audio の volume 上限は 1.0 = 0.5 の2倍）
- 1.0でも小さい場合は WebAudio のゲインノード経由で 1.0 超に増幅する案に切替可能（今回は 1.0）

## 影響範囲
- `script.js`: 描画（drawCatapult 周辺）/ フロー（finishDialogue, showResult, startGame 系）/ 音量
- `index.html`: タイトルボタン、結果画面ポップアップ
- 物理・スコア・ドッジ戦闘ロジックは不変
