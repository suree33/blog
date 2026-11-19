# Markdown の Callout

引用ブロックの先頭に `[!NOTE]` のようなマーカーを書き、次の行から本文を書きます。

```markdown
> [!NOTE]
> 補足情報をここに書きます。
```

Sätteri 用のローカルプラグインは、GitHub の `NOTE`、`TIP`、`IMPORTANT`、
`WARNING`、`CAUTION` と、既存記事で使う `INFO` を扱います（大文字・小文字を区別しません）。
マーカーと同じ行に空白を挟んで書いたテキストはカスタムタイトルになります。
未対応の種類や折りたたみ記法（`[!NOTE]-`、`[!NOTE]+`）は通常の引用のままです。

## Sätteri への切り替え時

現在は unified と `rehype-callouts` を使用しており、ローカルプラグインと CSS は本番に読み込んでいません。

1. [Astro の Sätteri プロセッサ](https://docs.astro.build/en/reference/markdown-processors/satteri/) の
   `hastPlugins` に `src/lib/satteri-callouts.ts` の `satteriCallouts` を追加します。
2. `src/styles/global.css` の `rehype-callouts/theme/github` の読み込みを
   `./callout.css` に置き換え、既存の `.callout-title-icon svg` の修正を削除します。
   ローカル CSS に同じ修正が含まれています。
3. `rehype-callouts` を依存関係から削除する前に、比較テストの unified 出力を
   固定の期待値に置き換えます。

出力のクラス名、タイトル、装飾用 SVG は現在の `rehype-callouts` に合わせています。
配色は従来どおり `.dark` クラスで切り替わり、`INFO` はどちらも既定のグレーです。
既存記事の `INFO`、`NOTE`、`WARNING` は Vitest で両プロセッサの出力を比較しています。
