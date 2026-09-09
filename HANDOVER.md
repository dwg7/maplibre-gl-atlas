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
  `tests/render-scale.test.ts`・`tests/review.test.ts`・`tests/index.test.ts`
  (Vitest、2026-09-09追加、`showButton`のonAdd挙動を検証)。
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

## 2026-09-08: デモを実際にブラウザで見たhfuさんから「何重にもおかしい」との指摘、grid UIをzukakuから移植して修正

`examples/basic/index.html`・`docs/index.html`が持っていたデモ用の
「1×3固定・手打ちのlng/lat矩形」は2つの問題があった:

1. **シート数を変えるコントロールが無い**——1行3列に固定されていた。
2. **紙のアスペクト比が実際のA4と一致していない**——手で選んだ経度・緯度の
   差分がA4の210:297という比率になる理由がそもそも無い。

「基本的にはzukakuのUIを踏襲してほしい」との指示を受け、
[dwg7/zukaku ADR 0005](https://github.com/dwg7/zukaku/blob/main/adr/0005-range-selection-ui-interaction-model.md)の
「画面中央固定グリッド+地図をパンして位置合わせ」というインタラクション
モデルと、`docs/index.html`の`renderGrid()`/`computePages()`をほぼそのまま
両デモに移植した:

- rows(m)/cols(n)の+/−ボタンとportrait/landscape切り替え(`#grid-panel`)。
- `#grid-overlay`——画面中心に`position:fixed`で固定表示するCSS Gridの
  プレビュー枠。セルのCSSアスペクト比自体をA4の`210/297`(または`297/210`)に
  固定しているため、**2の問題が構造的に解消される**——各セルの`bounds`は、
  この「最初からA4比率で描かれた画面矩形」を`map.unproject()`で地理座標に
  逆変換して求める(zukakuの`computePages()`と同じ手法)。手打ちの
  lng/lat差分に頼っていた旧実装とは違い、常に正しい紙面比率になる。
- 索引(index)シートのbbox・向き(アスペクト比から自動選択)・
  `renderScale: {x: cols, y: rows}`も、zukakuの計算式をそのまま踏襲。
- Save Paper(グリッドセルの個別除外)は移植していない——このリポジトリの
  `review()`(2026-09-08追加)が「印刷前にシートを個別に外せる」という
  同等の機能を、グリッド概念抜きで既に提供しているため、機能として重複する。
- スタイル/都市プリセットパネルは移植していない——ライブラリのデモとして
  必要なのは「グリッド数・向きを変えられること」であり、複数都市/複数
  スタイルの切り替えはzukakuというアプリケーション自体の機能であって、
  このライブラリの実証には不要と判断した。

**実機検証(Claude Browserプレビューペイン、2026-09-08)**: rows=1/cols=3/
portraitで生成した詳細シート(A1/A2/A3)の`<img>`の`naturalWidth/naturalHeight`
比が3枚とも`0.707`(=210/297)と正確に一致することを確認——アスペクト比の
根本原因が解消されたことを実測で確認済み。rows/cols変更・orientation
トグルでグリッドオーバーレイのCSSアスペクト比が追従することも確認。

**検証中の教訓(誤検知)**: 一部の試行で「印刷が固まった」ように見えたが、
実際にはtile取得のネットワーク遅延で数十秒かかっていただけだった
(`performance.getEntriesByType("resource")`でtile取得が継続していないか
確認するまで真偽が分からなかった)。デバッグ用の`console.log`を一時的に
`snapshot.ts`に追加して`load`/`decorate`/`idle`の発火順序を直接確認する形で
切り分けた(コミットには残していない)。

## 2026-09-09: プラグインコントロールとしての状態遷移(⓪/①/②)、`showButton:false`のバグ修正

hfuさんとの議論(「このコントロールを使うこと自体がMapLibre GL JSの使い方に
制約を課すか」)を経て、デモのグリッド編集UIを常時表示ではなく**状態遷移**
として整理した。設計の詳細は[adr/0002の追記(2026-09-09)](adr/0002-print-review-step.md)
参照。

- ⓪(アトラスモードの外・初期状態)⇄①(編集中、グリッド一式を表示)を
  右上のトグルボタン(`▦`/`✕`)が担当。②(印刷中)への遷移は①の中に
  現れる専用「Print」ボタンが担当し、`atlasControl.review()`を呼ぶ。
- 実装は`AtlasControl`を`showButton:false`で構築し、デモ側で独自の
  `IControl`(`AtlasModeToggle`)をトグルボタンとして追加する形——
  ライブラリのAPI自体は変更していない。
- **この過程で見つかった実バグ**: `showButton:false`のとき`onAdd()`が
  返すコンテナに`maplibregl-ctrl-group`クラスが残っていて、空の白い
  ボックスが地図の隅に表示されてしまっていた。`src/index.ts`で修正
  (ボタンを実際に描画する場合だけクラスを付与)、`tests/index.test.ts`で
  カバー。
- グリッドの行/列ラベルを「rows (m)」「cols (n)」から`− 2 + × − 2 +`
  (ラベル文字列なし、掛け算記法のみ)に単純化。

実機検証(Claude Browserプレビューペイン): ⓪→①→レビュー確認→
キャンセル→①→⓪の一通りの状態遷移、タイトル入力欄の値が印刷ヘッダーに
反映されること、を確認済み。

## 2026-09-09: `review()`の選択UIをチェックボックス一覧から地図上の×/+トグルボタンへ

「zukakuオリジナル(Save Paper)と同様に、四角の中心の丸ボタンで指定したい。
今の二段階(一覧+ハイライト)は重い」との指摘を受けて`src/review.ts`を
書き換えた。詳細は[adr/0002の追記(2026-09-09、2件目)](adr/0002-print-review-step.md)参照。

- チェックボックス`<ul>`一覧を廃止。各シートの中心(`bounds`があれば
  その中心、無ければ`center`)に`map.project()`でアンカーした円形×/+
  トグルボタンを地図上に直接配置(zukakuの`.cell-toggle`と同じ見た目)。
  除外時はグレー塗りつぶし。`map`の`move`/`resize`で位置を追従。
- `map`が無い場合(コントロールが地図に未追加)のみチェックボックス
  一覧にフォールバック。
- `ReviewMapLike`に`project()`/`getContainer()`/`on()`/`off()`を追加。
- `tests/review.test.ts`を全面書き直し(45テスト中13件がreview.ts分)。

**検証時の教訓(新規、要注意)**: Claude Browserプレビューペインが
「表示されていない」瞬間に印刷フローを操作すると、`docs/index.html`の
`computeSheets()`内`getBoundingClientRect()`が0を返し、**全シートの
boundsが同じ退化した点になり、トグルボタン全部が同じ画面座標に重なって
見える**という誤検知が起きた(コード側のバグではない)。今後この
リポジトリで実機検証する際は、**操作の前に一度スクリーンショットを
取ってペインが実際に描画されることを確認してから**フローを実行すること
——`document.hidden`の値だけでは可視性の判定に使えない(trueのままでも
レイアウトが正常なケースを確認済み)。

## 2026-09-09: ×/+トグルをグリッド編集画面へ移動、Printは`print()`を直接呼ぶ(デモのみ)

D9実装直後、「×と+はPrintボタンを押す前から出ていい。索引ページの除外は
不要。これでzukakuと同じUI/UXになる」との指摘を受けた。詳細は
[adr/0002の追記(2026-09-09、3件目)](adr/0002-print-review-step.md)参照。

- デモのPrintボタンを`review()`経由から`atlasControl.print()`直接呼び出しに
  変更——zukaku本体には「印刷→確認ダイアログ」という段階が無く、グリッド
  編集画面そのものが「何を刷るか決める」工程を兼ねているため。
- ×/+トグルを`#grid-overlay`の各セルに組み込んだ(zukakuの`renderGrid()`と
  同じ実装、`state.excludedCells`で管理)。状態①に入った時点で表示され、
  Printボタンを押す前から操作できる。
- 索引/概要ページには対応するセルが無いため、除外対象から自然に外れる。
- `computeSheets()`は除外セルを`detailSheets`から除くが、索引ページの
  `decorate()`にはグレー塗り表示用に`excluded`フラグ付きで残す。
- ページ数見積もり(`#page-estimate`)を復活。
- ライブラリ本体(`review()`自体・`src/`)は無変更——独自の事前選択UIを
  持たない呼び出し側向けの単体完結ステップとして引き続き提供する。

**検証時の教訓(重要、更新)**: 実機検証中、この日2回目の「印刷が固まって
見える」誤検知に遭遇した。原因は`document.hidden`でもコンテナサイズでもなく、
**Claude Browserプレビューペインは`wait`だけでは合成が止まり、`screenshot`
呼び出しを挟むことで再開する**という挙動だった(`snapshotSheet()`に
一時的なデバッグログを仕込み、`load`→`decorate`→`idle`の順序自体は常に
正常に、ただし遅延して発火し続けていることを確認して切り分けた)。
**今後この種の検証では、`wait`を連続して呼ばず、数秒おきに`screenshot`を
挟みながら待つこと。**

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
