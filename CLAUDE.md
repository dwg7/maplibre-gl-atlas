# @dwg7/maplibre-gl-atlas

## 1. これは何か

MapLibre GL JS用の`map.addControl()`スタイルのコントロール。ブラウザ自身の
`window.print()`ネイティブ印刷パイプラインを駆動し、CSS named `@page`ルールで
複数の地図「シート」からなる印刷用atlasを組み立てる。[dwg7/zukaku](https://github.com/dwg7/zukaku)の
「Print in Browser」機能([zukaku ADR 0007](https://github.com/dwg7/zukaku/blob/main/adr/0007-client-side-print-mode.md)、
[ADR 0009](https://github.com/dwg7/zukaku/blob/main/adr/0009-overview-zoom-level-shift.md))から
切り出した独立ライブラリ。

**差別化点**: 既存のMapLibre印刷プラグイン(`@watergis/maplibre-gl-export`、
`opengeos/maplibre-gl-components`)は「今のビュー1枚をjsPDFでファイル化する」
設計。このライブラリは「複数シート・向き混在・索引シートを持つatlasを、
ブラウザ自身の印刷ジョブとして組み立てる」ことに特化する。詳細は
[adr/0001](adr/0001-window-print-not-jspdf.md)参照。

## 2. スコープ(v1、現在形)

### 含む

- named `@page`印刷パイプライン(`strategy-mixed`/`strategy-rotate`、
  `isLikelyWindows()`によるプラットフォーム判定)——`src/strategy.ts`
- オフスクリーン・スナップショット技法(bounds/center+zoom→MapLibreインスタンス
  構築→`idle`待ち→`canvas.toDataURL()`→cleanup)——`src/snapshot.ts`
- `renderScale`ズームレベルシフト(索引/概要シートを詳細シートと同じLODで
  描く)——`src/render-scale.ts`
- ヘッダー/フッター/マージン/図郭線のレイアウト、`pageSize`(既定A4)・
  `margin`(既定15mm)としてパラメータ化——`src/layout.ts`
- `decorate(map)`フック——シートごとの装飾描画をコントロール外から注入する
  唯一の口。コントロール自身は装飾の中身(グリッド・ラベル等)を一切知らない。
- `AtlasSheet.role?: "detail" | "index"`——純粋な注釈。**コントロールの
  処理はこの値で分岐しない**。呼び出し側の可読性のためだけに存在する。
- `terrain`オプション(既定`false`→`map.setTerrain(null)`)——
  [dwg7/zukaku ADR 0004](https://github.com/dwg7/zukaku/blob/main/adr/0004-terrain-and-fill-extrusion-policy.md)の
  ポリシーを継承。
- `bearing`(完全サポート、正射影の画面内回転)、`pitch`(APIとしては残すが、
  透視投影による縮尺不整合を警告する——README参照)。
- 組み込みトリガーボタン(`showButton`、既定true)。
- `review()`——印刷前に「どこを・何枚」を確認・調整できる対話的ステップ。
  組み込みボタンの既定の入口(`confirm`、既定true)。`sheets`と`decorate`と
  同じく、`AtlasSheet`の既存フィールド(`bounds`/`headerLeft`/`headerRight`/
  `role`/`orientation`)だけで構成し、グリッド概念を持ち込まない——
  `print()`/`prepare()`自体は変更せず、プログラム的な呼び出しには確認が
  割り込まない([adr/0002](adr/0002-print-review-step.md))。

### 恒久的に除外する(このライブラリが将来も持たない)

- **グリッド(行列)の演算**——セルのbbox算出、A1/B2形式のラベル導出、
  行数×列数からのページ数計算。これらは呼び出し側(dwg7/zukakuの
  `computePages()`)の責務であり、このライブラリは「シートの配列」を
  受け取るだけで、行・列という概念そのものを知らない。
- **グリッド矩形・ラベルの実際の描画**——`decorate`フック経由で呼び出し側が
  実装する(dwg7/zukakuの`addOverviewGridLayers()`が実例)。
- **jsPDFベースの単一ビューPDF/PNGエクスポート**——既存プラグインの領分。
  このライブラリの存在理由そのものと矛盾するため、将来も追加しない。
- **N-up面付け**(複数atlasを1枚の物理シートに配置)。

### 先送り(v1では未対応、将来検討の余地あり)

- Reactラッパー(需要が実証されてから)。
- ライフサイクルフックの`Evented`ミックスイン形式(v1はコールバック形式)。

## 3. 設計原則

- **`sheets`と`decorate`が唯一の拡張点**。呼び出し側がatlas固有のロジック
  (グリッド計算・装飾描画)を注入する経路はこの2つだけであり、それ以外の
  形でzukaku固有(またはその他呼び出し側固有)の知識がこのライブラリに
  漏れ込むことを禁じる。
- **`role`は注釈であって分岐条件ではない**。「detail/indexという語彙を
  API に持ち込む」ことと「コントロールがそれに応じて挙動を変える」ことは
  独立の決定であり、v1では前者のみ採用する(DECISIONS.md D4参照)。
- **対話的な確認(`review()`)も`AtlasSheet`の既存フィールドだけで実現する**。
  「どこを・何枚刷るか」を見せる機能であっても、グリッド・行列という概念を
  新たに持ち込まない——`bounds`/`headerLeft`/`headerRight`/`role`/
  `orientation`という、`sheets`が元々返す情報の範囲内で完結させる
  (DECISIONS.md D6、adr/0002参照)。
- **ポート元のバグ修正を退行させない**。オフスクリーンステージングの
  `position:fixed;opacity:0`(`left:-99999px`にしない)、`object-fit:contain`
  (`fill`にしない)は、いずれもdwg7/zukakuで実機バグとして踏んだ末の修正
  ([issue #4](https://github.com/dwg7/zukaku/issues/4)、
  [issue #7](https://github.com/dwg7/zukaku/issues/7))。安易にリファクタ
  しない。

## 4. 姉妹プロジェクトとの関係

- [dwg7/zukaku](https://github.com/dwg7/zukaku) — このライブラリの切り出し元。
  zukaku自身がこのライブラリを消費する移行はzukaku側の別PR(3PR計画、
  [zukaku#8](https://github.com/dwg7/zukaku/issues/8))であり、このリポジトリの
  スコープではない。`docs/index.html`(対話的印刷パス)の移行は
  [zukaku ADR 0012](https://github.com/dwg7/zukaku/blob/main/adr/0012-consume-maplibre-gl-atlas-library.md)で
  完了済み。`scripts/render/`(Playwright/GitHub Actions経路)の移行は
  [zukaku ADR 0013](https://github.com/dwg7/zukaku/blob/main/adr/0013-playwright-pipeline-atlascontrol-migration.md)で
  提案中(未承認)。
- [dwg7/cafebabe](https://github.com/dwg7/cafebabe) — 「WebGLキャンバスは
  印刷パイプラインに直接含められない」等、複数プロジェクトに横断する一般則
  はcafebabe側に残す。このリポジトリのADRには「その一般則をどう実装で
  回避したか」だけを書く。

## 5. 作業分担

- Claude Code: 実装・テスト・ADR起草・ドキュメント整備。
- 人間(fujimura.hidenori@gmail.com): 実ブラウザでの印刷検証(macOS/Windows
  Chromium系)、npm公開の実行(`NPM_TOKEN`が必要なため)、スコープ変更の
  最終承認。

## 6. 現在のステータス

詳細は[HANDOVER.md](HANDOVER.md)参照。v1完成・実機デバッグ済み、npm未公開
(ビルド成果物をzukaku側に手動vendor)。zukaku側の`docs/index.html`は
これを実際に消費している(zukaku ADR 0012)——`scripts/render/`側は提案
段階(zukaku ADR 0013、未承認)。
