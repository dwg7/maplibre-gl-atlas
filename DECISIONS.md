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

## D3: ライセンスはMIT(zukaku自体のCC0とは異なる)

zukaku本体はCC0を採用しているが、npmで公開する再利用可能なライブラリと
しては、エコシステムの標準であるMITライセンスの方が採用のハードルが低いと
判断し、意図的にzukakuの前例から離れてMITを選んだ。

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
