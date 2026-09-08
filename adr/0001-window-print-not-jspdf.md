# ADR 0001: `window.print()` を使う(jsPDFは使わない)、atlas(複数シート)を第一級概念にする

- ステータス: 採用・実装済み
- 日付: 2026-09-08

## コンテキスト

MapLibre GL JS向けの「地図を印刷/PDF化する」プラグインは既に存在する
([`@watergis/maplibre-gl-export`](https://www.npmjs.com/package/@watergis/maplibre-gl-export)、
[`opengeos/maplibre-gl-components`](https://github.com/opengeos/maplibre-gl-components)の
PrintControl)。いずれも設計は同じ形をしている:「今画面に表示されているビュー1枚を
canvasとして撮り、jsPDFでPDFファイルを組み立ててダウンロードさせる」。

このプラグイン(`@dwg7/maplibre-gl-atlas`)は、姉妹プロジェクト
[dwg7/zukaku](https://github.com/dwg7/zukaku)の「Print in Browser」機能
([zukaku ADR 0007](https://github.com/dwg7/zukaku/blob/main/adr/0007-client-side-print-mode.md))を
切り出したものである。zukakuが検証した技術的知見の核心は次の一文に要約できる:
**Playwrightの`page.pdf()`は独自の印刷エンジンを持たず、Chromiumのネイティブ印刷
パイプラインを外部から叩いているだけであり、同じCSSの`@page`制御は通常の
`window.print()`でも効く**。この知見をライブラリとして再利用可能な形にする際、
「何を切り出すか」の選び方には2通りありえた。

## 決定

**`window.print()` + CSS named `@page`ルールを使い、単一ビューではなく
「複数シートからなるatlas」を第一級の概念としてAPIの前面に出す。**

jsPDF系の既存プラグインとは、次の2点で明確に異なる設計を選ぶ:

1. **PDF生成の主体がブラウザ自身**: jsPDFはCanvas画像をPDFフォーマットへ
   自前で再エンコードする(フォント埋め込み・ページサイズ計算をライブラリが
   担う)。このプラグインはCSSの`@page`とHTMLの構造を組み立てるだけで、実際の
   PDF化(またはプリンタへの送信)はブラウザのネイティブ印刷パイプラインに
   委ねる。zukaku自身がPlaywright経由で確認した「WebGLキャンバスは印刷
   パイプラインに直接含められない、`canvas.toDataURL()`でのラスタ画像化が
   必須」という制約は、両方の経路(Playwright/`page.pdf()`と実ブラウザの
   `window.print()`)に共通する一般則であり、実装の詳細はこのリポジトリの
   ADR群に残すが、一般則そのものの由来は`dwg7/cafebabe`に集約する。
2. **単位が「ビュー」ではなく「atlas(複数シート)」**: 既存プラグインは
   「今の画面を1枚」が最大の単位であり、複数ページ・向き混在・索引ページと
   いった概念を持たない。このプラグインの`AtlasControl`/`AtlasSheet`という
   命名(`PrintControl`/`PrintPageSpec`という以前の設計案から変更、詳細は
   `DECISIONS.md`)は、「刷りたいのは1枚のスクリーンショットではなく、
   複数シートを束ねた一冊のatlasである」という認識をAPIの語彙そのものに
   反映している。`sheets: () => AtlasSheet[]`が唯一のエントリーポイントで
   あり、行・列といったグリッド構造はライブラリの外(呼び出し側)に完全に
   残す——このライブラリが知っているのは「シートの配列」だけである。

複数シート・向き混在を1つの印刷ジョブとして安定に扱うための2戦略切り替え
(`strategy-mixed`/`strategy-rotate`、Windows印刷ドライバの既知の不具合を
回避する`isLikelyWindows()`)は、dwg7/zukakuのADR 0007で実機のバグ報告
(dwg7/zukaku issue #2)を踏まえて確立された設計をそのまま移植した
(`src/strategy.ts`)。同様に、索引/概要シートを詳細シートと同じズーム
レベル(LOD)で描くための`renderScale`ズームレベルシフト技法は
zukaku ADR 0009の移植である(`src/render-scale.ts`)。

## 根拠

- 複数ページ・向き混在・概要インデックスページを持つ「atlas」の組み立ては、
  既存のjsPDF系プラグインが手を出していない領域そのものであり、
  差別化点として明確。単一ビューのPDF化が必要なユーザーには、既存プラグイン
  (`@watergis/maplibre-gl-export`等)を素直に薦められる——競合するのではなく
  棲み分ける。
- ブラウザネイティブの印刷パイプラインを使うことで、フォント埋め込み・
  用紙サイズ処理・PDF生成そのものをjsPDFのようなJSライブラリで再実装する
  必要がなくなる(バンドルサイズ・保守コストの両面で有利)。
- 代償として、この方式はChromium系ブラウザに強く依存する(下記
  互換性節、およびREADME参照)。「PDFファイルとしてダウンロードされる
  成果物」ではなく「印刷ジョブ」が最終出力になるため、Node.js側で
  完全headlessにPDFバイト列を得たい用途には向かない(その場合は
  Playwrightで`page.pdf({preferCSSPageSize: true})`を呼ぶ`prepare()`を
  使う——zukaku自身のPlaywright経路が実例)。

## ブラウザ互換性

zukaku ADR 0007の実機調査をそのまま引き継ぐ。**このライブラリは実質
Chromium系ブラウザ専用と見なすべき**:

| ブラウザ | `@page`のsize/margin | named pagesでの向き混在 |
|---|---|---|
| Chromium系(Chrome/Edge/Braveなど) | 安定 | 動作確認済み(zukaku ADR 0007) |
| Firefox | 印刷プレビューには反映されるが、実際に保存されるPDFには反映されない既知の不具合([mdn/browser-compat-data#22946](https://github.com/mdn/browser-compat-data/issues/22946)) | 実質使用不可 |
| Safari | プレビュー・保存とも`@page`のsize/marginが反映されない。iPadOSでは実験的機能を有効にしてもmarginすら読まれない | 使用不可 |

## 影響

- リポジトリ名・npmパッケージ名の両方に`atlas`を含める(`dwg7/maplibre-gl-atlas`
  / `@dwg7/maplibre-gl-atlas`)。命名の経緯は`DECISIONS.md`参照。
- `AtlasControl`/`AtlasSheet`というAPI(`src/types.ts`)、`role?: "detail" |
  "index"`という純粋な注釈フィールドの追加を含む。
- グリッド計算(行列・ラベル導出)、jsPDFベースの単一ビューエクスポート、
  N-up面付けは恒久的にスコープ外(`CLAUDE.md`参照)。

## 参考

- [dwg7/zukaku ADR 0007](https://github.com/dwg7/zukaku/blob/main/adr/0007-client-side-print-mode.md) — この決定の直接の起源
- [dwg7/zukaku ADR 0009](https://github.com/dwg7/zukaku/blob/main/adr/0009-overview-zoom-level-shift.md) — `renderScale`ズームレベルシフト技法の起源
- [dwg7/zukaku ADR 0004](https://github.com/dwg7/zukaku/blob/main/adr/0004-terrain-and-fill-extrusion-policy.md) — terrain無効化・透視投影回避の起源
- [dwg7/zukaku#8](https://github.com/dwg7/zukaku/issues/8) — この切り出し自体の発端issue
- [`@watergis/maplibre-gl-export`](https://www.npmjs.com/package/@watergis/maplibre-gl-export)
- [`opengeos/maplibre-gl-components`](https://github.com/opengeos/maplibre-gl-components)
- [`opengeos/maplibre-gl-plugin-template`](https://github.com/opengeos/maplibre-gl-plugin-template) — このリポジトリの土台にした雛形
