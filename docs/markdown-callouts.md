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

## 設定とテスト

`astro.config.mjs` で [Astro の Sätteri プロセッサ](https://docs.astro.build/en/reference/markdown-processors/satteri/) の
`hastPlugins` に `src/lib/satteri-callouts.ts` の `satteriCallouts` を登録しています。
`src/styles/global.css` は `./callout.css` を読み込みます。SVG の fill 補正もこの CSS に含まれます。

出力のクラス名、タイトル、装飾用 SVG は以前の `rehype-callouts` に合わせています。
配色は従来どおり `.dark` クラスで切り替わり、`INFO` はどちらも既定のグレーです。
既存記事の `INFO`、`NOTE`、`WARNING` は Vitest で旧プロセッサから取得した固定 HTML と比較しています。
