# Handover

`@dwg7/maplibre-gl-atlas`の現在の状態。次にこれを引き継ぐ人(人間でもAIでも)向け。

## 現状(2026-09-08時点) — v1スキャフォールド完了、npm未公開

[dwg7/zukaku#8](https://github.com/dwg7/zukaku/issues/8)への対応として、
zukakuの「Print in Browser」機能(zukaku ADR 0007/0009)から、汎用的な
MapLibre GL JSコントロールとして切り出した。この移行計画3PR中の**PR 1
(本リポジトリの構築)のみ完了**——zukaku側(PR 2: `docs/index.html`の移行、
PR 3: `scripts/render/page.html`の移行)はまだ着手していない。

- スコープ・設計原則は[CLAUDE.md](CLAUDE.md)参照。
- API設計・命名の経緯は[DECISIONS.md](DECISIONS.md)・[adr/0001](adr/0001-window-print-not-jspdf.md)参照。
- `src/`構成: `index.ts`(`AtlasControl`本体)・`strategy.ts`(印刷戦略・
  `@page`生成)・`layout.ts`(マージン・ヘッダー/フッターCSS生成)・
  `render-scale.ts`(ズームレベルシフト)・`snapshot.ts`(オフスクリーン
  スナップショット)・`types.ts`(公開型)。
- テスト: `tests/strategy.test.ts`・`tests/layout.test.ts`・
  `tests/render-scale.test.ts`(Vitest、ブラウザ不要な純粋関数のみ)。
  `snapshot.ts`(実際のMapLibreインスタンス構築)はvitest/jsdomではWebGL
  コンテキストが無いため単体テスト対象外——計画(§6)通り、実ブラウザ/
  Playwrightでの検証にゆだねる。
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

**検証環境の注意**: このデモをClaude Codeのブラウザプレビューペインで検証した際、
ペインが「表示されていない」状態(`document.hidden === true`)だと
`requestAnimationFrame`がスロットルされ、MapLibreの内部レンダーループが
進まず`load`イベントが数秒〜十数秒遅延する現象に遭遇した(cafebabeの
`maplibre-gl-js-output-testing.md`にある「非表示ペインでコンテナが0x0に
なりうる」と同系統だが、今回はコンテナサイズではなくrAFスロットリングが
原因)。実際のユーザー操作(タブがフォアグラウンドの状態でボタンを押す)
では発生しない、検証ツール特有の現象。

## 次にやること

1. **実ブラウザでの手動検証**(macOS Chromium系・Windows Edge/Chrome、
   計画§6の最低ライン)。`examples/basic/index.html`および
   [docs/index.html](docs/index.html)のライブデモを使う。Claude Browserの
   プレビューペインでのクリックスルー検証は完了(上記のsetProjection修正が
   これで見つかった)が、macOS/Windowsの実機・実ブラウザでの確認は
   まだ行っていない。
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

## 既知の制約・注意点

- `#maplibre-gl-atlas-print-root`はDOM上で単一のIDを前提にしている
  ——同一ページに複数の`AtlasControl`インスタンスを同時に使う場合、
  print-rootを共有する設計になっている点に注意(通常は1インスタンスのみを
  想定)。
- ブラウザ互換性はChromium系のみ実用的(README参照)。Firefox/Safariでの
  `@page`制約はdwg7/zukaku ADR 0007の実機調査を継承しているだけで、
  このリポジトリ独自の再検証はしていない。
