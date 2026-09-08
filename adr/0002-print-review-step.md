# ADR 0002: 印刷前に確認・調整できる`review()`ステップを追加する

- ステータス: 採用・実装済み
- 日付: 2026-09-08

## コンテキスト

v1の`AtlasControl`は「印刷ボタンを押す→即座に全シートをスナップショット→
`window.print()`」という直線的なフローしか持たなかった。これでは実用に
ならない、という指摘を受けた。理由: **どの範囲をどのように印刷するか
(何枚になるか、どのシートを含めるか)はユーザー自身が決めたい**——にも
関わらず、ボタンを押した瞬間に確認の余地なく印刷ダイアログへ進んでしまう。

一方で、`sheets`や枚数をあらかじめ確定させた状態で**プログラム的に**
`print()`/`prepare()`を呼ぶ既存の使い方(Playwright経由のヘッドレス
レンダリング——zukaku側PR 3で使う予定の経路、または呼び出し側が既に
独自の選択UIを持つケース)には、確認ステップが割り込んではならない。
ヘッドレス環境ではダイアログを表示する相手がいない。

## 決定

**`review()`という新しい公開メソッドを追加し、組み込みボタンの既定の
入口をこれに切り替える。`print()`/`prepare()`自体は一切変更しない。**

```ts
class AtlasControl {
  async review(): Promise<void>;   // 新規
  async print(): Promise<void>;    // 変更なし
  async prepare(): Promise<void>;  // 変更なし
}
```

- 組み込みボタンのクリックは、既定(`AtlasControlOptions.confirm ?? true`)で
  `review()`を呼ぶ。`confirm: false`にすると`print()`を直接呼ぶ(旧来の
  挙動)——host側が独自の選択UIを既に持つ場合の逃げ道。
- `review()`が表示するパネルは、コントロールが元々持つ情報
  (`AtlasSheet.bounds`/`orientation`/`headerLeft`/`headerRight`/`role`)
  だけで構成する。グリッドや行列という概念は一切持ち込まない
  ([CLAUDE.md](../CLAUDE.md)の設計原則、DECISIONS.md D4と同じ理由)。
  一覧(チェックボックス+ラベル+向き+選択数)に加え、`bounds`を持つ
  シートは実際にコントロールが追加されているライブ地図の上に矩形の
  アウトラインを描画する——「どこを刷るか」を実際の地図で見せるため。
  `center`+`zoom`のみのシートは矩形を算出できないため一覧表示のみ
  (v1では対応を見送る)。
- ユーザーが「印刷」を押すと、チェックが入ったシートの部分集合だけを
  対象に、`print()`と同じ内部処理(`printSheets()`)に進む。「キャンセル」
  またはEscapeキーでは何も印刷されず、パネルと地図上の一時レイヤーを
  跡形なく除去する。
- `onBeforePrint`/`onAfterPrint`フックは、実際に印刷パイプラインへ進む
  瞬間(`printSheets()`実行時)にのみ発火する——レビューパネルを開いた
  だけ(まだキャンセルされうる段階)では発火しない。既存の意味論を
  変えない。

## 根拠

- ボタン(対話的入口)とAPI(プログラム的入口)を明確に分離することで、
  「人間が操作する主要ユースケースには確認が必須」「自動化された呼び出し
  には確認が不要、むしろ有害」という相反する要求を、どちらも妥協なく
  満たせる。
- 確認UIを`AtlasSheet`の既存フィールドだけで構築することで、グリッド概念を
  持ち込まずに済んだ——`sheets`と`decorate`が唯一の拡張点、という
  ADR 0001以来の設計原則を保てる。

## 影響

- `src/review.ts`(新規): `ReviewPanel`クラス、`generateReviewCss()`。
- `src/index.ts`: `onAdd(map)`で`map`参照を保持(以前は破棄していた)。
  `prepare()`/`print()`の本体を`printSheets()`/`buildPrintDom()`に分割し、
  `review()`から部分集合を渡せるようにした。
- `src/types.ts`: `AtlasControlOptions.confirm?: boolean`(既定`true`)を追加。
- `tests/review.test.ts`(新規): チェックボックスの状態管理、
  `bounds`の有無によるハイライト対象の切り分け、`dispose()`の
  冪等性を検証。地図は`addSource`/`addLayer`等を持つモックで代替し、
  実WebGLはVitestの対象外という既存方針(`snapshot.ts`)を踏襲。

## 参考

- [CLAUDE.md](../CLAUDE.md) — 「`sheets`と`decorate`が唯一の拡張点」という設計原則
- [DECISIONS.md](../DECISIONS.md) D4 — `role`と同じ「注釈は良いが分岐条件にはしない」という判断の系譜
- [dwg7/zukaku ADR 0008](https://github.com/dwg7/zukaku/blob/main/adr/0008-save-paper.md) — Save Paper(グリッドセル単位の除外)。発想の参考にしたが、行・列という概念を前提にしている点でこのADRの`review()`とは別レイヤーの機能
