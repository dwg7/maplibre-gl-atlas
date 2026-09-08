# Handover

`@dwg7/maplibre-gl-atlas`の現在の状態。次にこれを引き継ぐ人(人間でもAIでも)向け。

## 現状(2026-09-08時点) — v1スキャフォールド完了、npm未公開

[dwg7/zukaku#8](https://github.com/dwg7/zukaku/issues/8)への対応として、
zukakuの「Print in Browser」機能(zukaku ADR 0007/0009)から、汎用的な
MapLibre GL JSコントロールとして切り出した。この移行計画3PR中の**PR 1
(本リポジトリの構築)のみ完了**——zukaku側(PR 2: `docs/index.html`の移行、
PR 3: `scripts/render/page.html`の移行)はまだ着手していない。

- スコープ・設計原則は[CLAUDE.md](CLAUDE.md)参照。
- API設計・命名の経緯は[DECISIONS.md](DECISIONS.md)・[adr/0001](adr/0001-window-print-not-jspdf.md)・
  [adr/0002](adr/0002-print-review-step.md)参照。
- `src/`構成: `index.ts`(`AtlasControl`本体)・`strategy.ts`(印刷戦略・
  `@page`生成)・`layout.ts`(マージン・ヘッダー/フッターCSS生成)・
  `render-scale.ts`(ズームレベルシフト)・`snapshot.ts`(オフスクリーン
  スナップショット)・`review.ts`(印刷前の確認・調整パネル、2026-09-08
  追加)・`types.ts`(公開型)。
- テスト: `tests/strategy.test.ts`・`tests/layout.test.ts`・
  `tests/render-scale.test.ts`・`tests/review.test.ts`(Vitest)。
  `snapshot.ts`(実際のMapLibreインスタンス構築)はvitest/jsdomではWebGL
  コンテキストが無いため単体テスト対象外——計画(§6)通り、実ブラウザ/
  Playwrightでの検証にゆだねる。`review.ts`は地図操作をモック
  (`ReviewMapLike`)で代替しているため、パネルのロジック自体は
  Vitestで検証できている。
- サンプル: [examples/basic/index.html](examples/basic/index.html)
  (ビルド不要、`https://demotiles.maplibre.org/style.json`を使うためAPI
  キー不要。詳細シート3枚+索引シート1枚)。
- CI: `.github/workflows/ci.yml`(lint+test)、
  `.github/workflows/release.yml`(バージョンタグでnpm publish——
  **`NPM_TOKEN`シークレットは未設定**、実行しても失敗する。人間が設定
  してから初回リリースすること)。
- ライブデモ: [docs/index.html](docs/index.html)——GitHub Pagesで公開
  (2026-09-08、`docs/`をリポジトリのルートとして設定)。npm未公開のため
  `docs/vendor/maplibre-gl-atlas.js`に`npm run build`の出力を手動で
  コピーして参照している(`examples/basic/index.html`とは違いunpkg経由
  ではない)。npm公開後はunpkg importに切り替え、`docs/vendor/`は削除
  すること。

## 2026-09-08: 実バグ1件発見・修正——`setProjection()`の呼び出しタイミング

このGitHub Pagesデモをブラウザで実際にクリックして検証した際に発見。
`snapshot.ts`で`pageMap.setProjection({type:"mercator"})`をmapコンストラクタ
直後に同期呼び出ししていたが、maplibre-gl v6の`Style.setProjection()`は
内部で`_checkLoaded()`を呼び、スタイルがロード完了する前に呼ぶと
`Error: Style is not done loading.`を投げる。`map.on("load", ...)`
ハンドラの中(`setTerrain(null)`と同じタイミング)に移動して修正した。
`src/snapshot.ts`の関数doc冒頭のバグ一覧に4件目として追記済み。
Playwrightだけでは検出できなかった類のバグ(コンストラクタ直後の同期呼び出しは
静的解析だけでは見逃しやすい)——**実際にブラウザでクリックして検証する
ことの価値を、このリポジトリ自身の開発中に再確認した**格好になった。

## 2026-09-08: 実バグ2件目——スケールバーの幅が`renderScale`で補正されていない

**これはdwg7/zukaku自身に現存するバグでもある**(この移植で新たに混入した
ものではない)。hfuさんの「スケールバーの挙動がおかしい気がする」という
指摘を受けてコードを再確認して発見した。

`ScaleControl`が計算するバーの`width`(px)は、そのコントロールが実際に
アタッチされているオフスクリーンキャンバスの大きさを基準にしている。
`renderScale`(索引/概要シート用にオフスクリーンコンテナを`x`・`y`倍に
拡大する技法、ADR 0009)適用時、地図の**画像**は`object-fit:contain`で
印刷時の箱サイズまで縮小されるが、スケールバーの`<div>`は`outerHTML`で
抽出してそのまま埋め込むだけなので、この縮小を受けない。結果、索引/概要
シートのスケールバーは実際の縮尺よりはるかに広い幅で印字される。

グリッドラベルは同種の問題に対して`labelScale`という補正を持っている
(issue #5)が、スケールバーには同等の補正が一度も実装されていなかった
——`docs/index.html`・`scripts/render/page.html`とも該当箇所を確認し、
補正ロジックが無いことを確認済み。

**このリポジトリでの修正**: `snapshot.ts`で、スケールバー要素を抽出する際
`sheet.renderScale`が設定されていれば`Math.max(renderScale.x, renderScale.y)`
で幅を割って補正する(`labelScale`と同じ係数)。実際の値で検証済み: 修正前は
索引シートで`93.8px`("50km"表示、実測`km/px`比が詳細シートの約3倍ズレ)、
修正後`31.3px`(独立に計算した概算——180mm幅の印刷枠に約1128km分の地理的
範囲を収めることから逆算した`km/px`比とほぼ一致)。

**zukaku側への示唆**: 同じロジックがzukaku本体にも存在するため、`renderScale`
が適用されるすべての概要/索引ページ(=非自明なグリッドを持つほぼ全アトラス)
で、現在も同じ不具合が起きている可能性が高い。zukaku側への修正・issue化は
このリポジトリのスコープ外なので、hfuさんの判断を仰ぐ。

**検証環境の注意**: このデモをClaude Codeのブラウザプレビューペインで検証した際、
ペインが「表示されていない」状態(`document.hidden === true`)だと
`requestAnimationFrame`がスロットルされ、MapLibreの内部レンダーループが
進まず`load`イベントが数秒〜十数秒遅延する現象に遭遇した(cafebabeの
`maplibre-gl-js-output-testing.md`にある「非表示ペインでコンテナが0x0に
なりうる」と同系統だが、今回はコンテナサイズではなくrAFスロットリングが
原因)。実際のユーザー操作(タブがフォアグラウンドの状態でボタンを押す)
では発生しない、検証ツール特有の現象。

## 2026-09-08: `review()`(印刷前の確認・調整ステップ)を追加

「印刷ボタンを押したら即座に全ページ印刷」では実用にならない、という指摘
(どの範囲をどう印刷するかはユーザーが決めたい)を受けて追加。設計の詳細は
[adr/0002](adr/0002-print-review-step.md)参照。組み込みボタンは既定で
`review()`(チェックボックス付きの一覧パネル+`bounds`を持つシートを
ライブ地図上にハイライト)を開くようになった。`print()`/`prepare()`自体は
無変更——`AtlasControlOptions.confirm: false`でボタンを従来通りの直接印刷に
戻せる。

**テスト方法論の追記**: Claude Browserプレビューペインで実機検証中、
1つのタブで大量のデバッグ用MapLibreインスタンス(`import("maplibre-gl")`
経由の使い捨てmap等)を`.remove()`せずに作り続けた結果、そのタブの
WebGLコンテキストが枯渇し、以後そのタブで新規に作る`AtlasControl`の
オフスクリーンmapが`load`イベントを一切発火しなくなる(ハングしたように
見える)現象に遭遇した。ライブラリのバグではなく、**同一タブでの
使い捨てデバッグ用map作成は`.remove()`を徹底するか、こまめに新しいタブに
切り替える**べき、という検証時の教訓。実際、新しいタブで同じ操作をやり直すと
即座に正常完走した。

## 次にやること

1. **実ブラウザでの手動検証**(macOS Chromium系・Windows Edge/Chrome、
   計画§6の最低ライン)。`examples/basic/index.html`および
   [docs/index.html](docs/index.html)のライブデモを使う。Claude Browserの
   プレビューペインでのクリックスルー検証は完了(setProjection修正・
   スケールバー修正・`review()`の一覧表示/チェックボックス調整/確認/
   キャンセルの一通りの動作を確認済み)が、macOS/Windowsの実機・実ブラウザ
   での確認はまだ行っていない。
2. **zukaku側PR 2**: `docs/index.html`(対話的印刷パス)をこのライブラリの
   消費に切り替える。`computePages()`はそのまま残し、
   `sheets: () => [...]`に変換、索引シートに`role:"index"`・
   `decorate: (map) => addOverviewGridLayers(map, spec.grid, labelScale)`を
   渡す。`showButton:false`で既存の自前ボタンを維持。
3. **zukaku側PR 3**: `scripts/render/page.html`(Playwright経路)の移行。
   `AtlasControl.prepare()`を使う(`print()`ではなく——`window.print()`は
   呼ばれず、Playwright側の`page.pdf()`が実際のトリガーになるため)。
4. `NPM_TOKEN`を設定し、`v0.1.0`タグを打って初回npm公開(人間の作業、
   CLAUDE.md 5節)。

## 未検討のまま進めた判断(実装時のデフォルト選択)

計画ドキュメント§8の要検討事項のうち、実装をブロックしないため以下の
デフォルトで進めた。人間の最終承認はまだ得ていない:

- リポジトリ名: `dwg7/maplibre-gl-atlas`(計画の推奨案どおり)。
- `role`フィールド: 追加した(注釈のみ、処理分岐なし)。
- `pageSize`/`margin`の一般化: v1に含めた(`src/layout.ts`)。
- ライセンス: ~~MIT~~ → **CC0に変更済み(2026-09-08、DECISIONS.md D5)**。
  zukaku本体と同一のCC0テキストで統一した。
- ライフサイクルフック: 単純コールバック形式(`Evented`ミックスインではない)。
- 3PR分割: 提案通り3分割の前提でPR 1のみ実施。
- `docs/index.html`からの読み込み方法(ESM CDN import vs ビルド導入):
  このリポジトリのスコープ外——zukaku側PR 2着手時に判断。
- bearing対応のzukaku側`computePages()`一般化: 着手していない、
  完全に別issueとして扱う前提のまま。
- `review()`パネルの見た目・配置(固定位置、`top-right`寄り)・
  `center`+`zoom`のみのシートを地図上にハイライトしない、という判断
  ([adr/0002](adr/0002-print-review-step.md)参照)は実装時の判断。
  パネルの見た目そのものは人間による実機レビューをまだ受けていない。

## 既知の制約・注意点

- `#maplibre-gl-atlas-print-root`はDOM上で単一のIDを前提にしている
  ——同一ページに複数の`AtlasControl`インスタンスを同時に使う場合、
  print-rootを共有する設計になっている点に注意(通常は1インスタンスのみを
  想定)。
- ブラウザ互換性はChromium系のみ実用的(README参照)。Firefox/Safariでの
  `@page`制約はdwg7/zukaku ADR 0007の実機調査を継承しているだけで、
  このリポジトリ独自の再検証はしていない。
