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
