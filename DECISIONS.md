# Decisions

各項目は一段落の要旨のみ。詳細な経緯・調査ログ・比較検討は各リンク先の
`adr/`配下の個別ファイル(ADR形式)にある——この`DECISIONS.md`はその索引で
あり、内容の複製ではない。dwg7の他プロジェクト(zukaku等)と同じ運用方針。

## D1: jsPDFではなく`window.print()`を使い、atlas(複数シート)を第一級概念にする

既存のMapLibre印刷プラグイン(`@watergis/maplibre-gl-export`、
`opengeos/maplibre-gl-components`)はいずれも「今のビュー1枚をjsPDFで
ファイル化する」設計。このライブラリは[dwg7/zukaku](https://github.com/dwg7/zukaku)の
「Print in Browser」機能(Playwrightの`page.pdf()`はChromiumのネイティブ
印刷パイプラインを外部から叩いているだけで、同じCSSの`@page`制御は通常の
`window.print()`でも効く、という知見)を切り出し、複数シート・向き混在・
索引シートを持つ「atlas」をブラウザ自身の印刷ジョブとして組み立てることに
特化した。`AtlasControl`/`AtlasSheet`という命名自体がこの認識を反映する。
→ [adr/0001](adr/0001-window-print-not-jspdf.md)

## D2: `maplibre-gl`は`peerDependencies`とする

zukaku自身は`dependencies`として`maplibre-gl`を直接使うアプリケーションだが、
このライブラリは再利用可能なプラグインであり、消費者側のMapLibre GL JSの
バージョンと二重に読み込まれる・バージョン不整合を起こす、といった典型的な
npmライブラリの問題を避けるため、`peerDependencies`とした
(`opengeos/maplibre-gl-plugin-template`など、MapLibreエコシステムの
プラグインの標準的な扱いに合わせた)。

## D3: ライセンスはMIT(zukaku自体のCC0とは異なる) — **2026-09-08、D5により撤回**

zukaku本体はCC0を採用しているが、npmで公開する再利用可能なライブラリと
しては、エコシステムの標準であるMITライセンスの方が採用のハードルが低いと
判断し、意図的にzukakuの前例から離れてMITを選んだ。**この判断はD5で
CC0に変更された。撤回の経緯を残すため本文は書き換えず残す。**

## D4: `role: "detail" | "index"`は追加するが、処理の分岐には使わない

「atlasには詳細シートと索引シートがある」という運用者の語彙をAPIが素直に
受け止められるよう、`AtlasSheet.role`フィールドを追加した。ただし
`AtlasControl`自身の挙動はこの値では一切分岐しない(純粋なログ・デバッグ・
呼び出し側の可読性のための注釈)——コントロールが「索引シートとは何か」を
知ってしまうと、`decorate`フックと`sheets`配列という2つの拡張点だけで
atlas固有の知識を呼び出し側に閉じ込める、という設計原則(CLAUDE.md参照)が
崩れる。`bearing`/`pitch`の扱いも同じ設計原則から導かれる: `bearing`は
MapLibreの正射影の画面内回転に過ぎずコントロール側で常にそのまま渡せば
よいが、`pitch`は透視投影を導入し縮尺不整合を招くため、[dwg7/zukakuの
ADR 0004](https://github.com/dwg7/zukaku/blob/main/adr/0004-terrain-and-fill-extrusion-policy.md)
(terrainを常に無効化する根拠と同じ「物理的に貼り合わせるページは正射影
前提」という理由)に基づき、印刷は止めないが複数シートかつ非ゼロpitchの
場合に`console.warn`する、という軽いガードのみをコントロールに持たせた。
→ [adr/0001](adr/0001-window-print-not-jspdf.md)、
[dwg7/zukaku ADR 0004](https://github.com/dwg7/zukaku/blob/main/adr/0004-terrain-and-fill-extrusion-policy.md)

## D5: ライセンスをMITからCC0に変更(2026-09-08、D3を撤回)

D3でMITを選んだ後、著作権表示の名義をどうするかで再検討した。`dwg7`は
UN Open GIS Initiativeのdomain working groupであり法人格を持たない
——著作権は実際に書いたコード作者個人に帰属するのが原則なので、
「Copyright (c) dwg7」はMITの雛形上、権利者を正確には示せない。しかも
MITの著作権表示行は「複製物に含めること」という保持義務がライセンス本文に
組み込まれており、この不正確な名義が将来のフォークすべてに複製され続ける
ことになる。

一方、CC0の標準テキスト(zukaku自身のLICENSEで確認済み)には、そもそも
権利者名を書き込む決まった箇所がない——「the person associating CC0 with
a Work (the "Affirmer")」という一般的な言い方をするだけで、下流の複製物に
特定の名義を保持させる義務も発生しない。つまりCC0は「dwg7名義にしたいが
法人格の観点で正確な言い方がない」という問題そのものを構造的に回避できる。
加えて、zukaku本体が既にCC0を採用しており(「standing serverを持たない、
すべて公開する」という一貫した思想)、姉妹プロジェクトもCC0にする方が
dwg7組織としてのpublic domain姿勢に一貫性が出る。

エンタープライズ導入時にCC0が一部のライセンススキャナーで手動レビュー
対象になりうる、というMIT優位の実務的トレードオフは残るが、このライブラリの
想定利用者(GIS/OSSコミュニティ、MapLibreエコシステム)を踏まえて許容した。
→ [dwg7/zukakuのLICENSE](https://github.com/dwg7/zukaku/blob/main/LICENSE)(同一のCC0テキスト)

## D6: 印刷前に確認・調整できる`review()`ステップを追加(組み込みボタンの既定)

v1は「ボタン→即座に全シート印刷」という直線的なフローしか持たず、実用に
ならないという指摘を受けた——どの範囲をどう印刷するかはユーザーが決めたい。
新しい`review()`メソッドを追加し、組み込みボタンは既定でこれを呼ぶ
(`AtlasControlOptions.confirm ?? true`)。パネルは`AtlasSheet`の既存
フィールド(`bounds`/`headerLeft`/`headerRight`/`role`/`orientation`)だけで
構成し、`bounds`を持つシートはライブ地図上に矩形をハイライト表示する——
グリッド概念は持ち込まない(D4と同じ設計原則)。`print()`/`prepare()`自体は
一切変更しておらず、プログラム的な呼び出し(Playwright経由等)には確認が
割り込まない。
→ [adr/0002](adr/0002-print-review-step.md)

## D7: デモ(`examples/basic/`・`docs/`)にzukaku ADR 0005のグリッドUIを移植

デモが「1×3固定・手打ちのlng/lat矩形」だったため、(1)シート数を変える
手段が無い、(2)紙のアスペクト比が実際のA4と一致しない、という2つの問題を
抱えていた。[dwg7/zukaku ADR 0005](https://github.com/dwg7/zukaku/blob/main/adr/0005-range-selection-ui-interaction-model.md)の
「画面中央固定グリッド+地図パン」というインタラクションモデルと
`computePages()`(`map.unproject()`でスクリーン座標のグリッドセルを地理座標へ
逆変換)を両デモに移植し、両方を解消した——セルのCSSアスペクト比自体を
A4比率で固定して描画するため、そこから逆算した`bounds`は常に正しい紙面比率に
なる。Save Paper(グリッドセル除外)は移植していない——D6の`review()`が
「印刷前にシートを個別に外せる」という同等の機能を、グリッド概念抜きで
既に提供しているため。スタイル/都市プリセットもzukakuというアプリケーション
自体の機能であり、ライブラリのデモには不要と判断し移植していない。
ライブラリ本体(`src/`)には変更なし——デモのみの修正。

## D8: プラグインコントロールとしての状態遷移(⓪/①/②)を明文化し、`showButton:false`の見た目バグを修正

「このコントロールを使うこと自体がMapLibre GL JSの使い方に制約を課すか」
という問いを経て、グリッド編集UIを常時表示するのではなく、⓪(アトラス
モードの外)/①(編集中、グリッドUI表示)/②(印刷中、`review()`)という
3状態として整理すべき、との指摘を受けた。`AtlasControl`自体のAPI変更は
不要——`showButton:false`+呼び出し側の独自トグルボタン+`review()`直接
呼び出し、という既存の組み合わせで実現できた。ただしこの組み合わせを
今回初めて実際に使ったことで、`showButton:false`時に空の
`maplibregl-ctrl-group`ボックスが地図の隅に見えてしまう見た目バグが
見つかり、修正した(該当クラスをボタンが実在する場合だけ付与するよう変更)。
グリッドの行/列ラベルも「rows (m)」「cols (n)」から「− 2 + × − 2 +」
という無ラベル表記に単純化した。
→ [adr/0002の追記(2026-09-09)](adr/0002-print-review-step.md)

## D9: `review()`の選択UIを、チェックボックス一覧から地図上の×/+トグルボタンへ変更

「zukakuオリジナル(Save Paper、ADR 0008)と同様に、四角の中心の丸ボタンで
選択したい。今の一覧+ハイライトという二段階は重い」という指摘を受けた。
チェックボックスの`<ul>`一覧を廃止し、各シートの中心に`map.project()`で
アンカーした円形×/+ボタンを地図上に直接配置する方式に変更した——見る場所と
クリックする場所を一致させ、一箇所で完結する操作にした。`map`が無い場合
(コントロールが地図に追加される前)のみ、チェックボックス一覧に
フォールバックする。`ReviewMapLike`に`project()`/`getContainer()`/`on()`/
`off()`を追加。
→ [adr/0002の追記(2026-09-09、2件目)](adr/0002-print-review-step.md)

## D10: ×/+トグルを`review()`からグリッド編集画面へ移動し、Printボタンは`print()`を直接呼ぶ(デモのみ)

D9の直後、「×と+はPrintボタンを押す前から出ていい。索引ページの除外は
不要。これでzukakuと同じUI/UXになる」との指摘を受けた。zukaku本体の
Save Paperはそもそも印刷前のグリッド編集画面に常設されており、「印刷→
確認ダイアログ」という段階を持たない。デモ(`examples/basic/`・`docs/`)の
Printボタンを`review()`経由から`print()`直接呼び出しに変更し、×/+トグルを
`#grid-overlay`の各セルに組み込んだ(zukakuの`renderGrid()`と同じ実装)。
索引ページに対応するセルは無いため、除外対象から自然に外れる。ライブラリ
本体(`review()`自体)は変更なし——独自の事前選択UIを持たない呼び出し側
向けの単体完結ステップとして引き続き提供する。
→ [adr/0002の追記(2026-09-09、3件目)](adr/0002-print-review-step.md)

## D11: 索引ページの向き自動選択をやめ、常に選択中の`orientation`に一致させる(デモのみ)

1行×3列・portraitで印刷すると索引ページだけlandscapeになる、という報告
(`computeSheets()`がグリッド全体のアスペクト比から索引ページの向きを
自動選択していたため、zukaku ADR 0005の踏襲)。UI上は単一の`orientation`
トグルしか無く、索引ページだけ別ロジックで決まることが分かりにくいため、
自動選択をやめて常に`state.orientation`に一致させる方を選んだ(zukaku通りの
自動選択と、全ページ統一のどちらを取るか確認した結果)。デモ
(`examples/basic/`・`docs/`)の`computeSheets()`のみの変更、ライブラリ本体
(`src/`)は無関係。
→ [adr/0002の追記(2026-09-09、4件目)](adr/0002-print-review-step.md)

## D12: デモの`setAtlasMode`を任意の呼び出し元から呼べることを明示(zukaku統合の準備、デモのみ)

zukaku統合の前段として、「Atlasモードのボタンクリック以外からの
プログラム的な有効化」を先に済ませておく、というhfuさんの指示。
デモの`setAtlasMode(on)`は元々`AtlasModeToggle`ボタンから独立した
関数だったが、それが「ボタン専用」ではなく「状態①への遷移そのもの」
であることを明文化するため、`window.exampleAtlasMode = { set, isActive }`
を追加した。ライブラリ本体(`src/`)は無変更——`AtlasControl`は
元々`showButton:false`という形で「入口をどう用意するかは呼び出し側の
領域」を許容しており、今回の変更はその領域内での明示に留まる。
→ [adr/0002の追記(2026-09-10)](adr/0002-print-review-step.md)
