# コードタイトル

このドキュメントでは、記事のコードブロックにファイル名などのタイトルを付ける記法と、その実装（ローカルの Shiki transformer）について説明します。

## 記法

コードフェンスの言語名の後ろ（メタ文字列）に `title="..."` を書きます。

````markdown
```ts title="src/lib/utils.ts"
export function cn(...inputs: ClassValue[]) {}
```
````

- 値はダブルクォート（`title="..."`）またはシングルクォート（`title='...'`）で囲みます。クォートなし（`title=foo.ts`）はタイトルとして扱いません。
- 値の中の空白・コロン・スラッシュはそのままタイトルになります（例: `title="lua/sidekick/config.lua:106"`）。
- `title` はメタ文字列の先頭か空白の直後に書きます。ほかのメタと並べても構いません（例: `showLineNumbers title="foo.ts"`）。`data-title="..."` のような別のキーは対象外です。
- 値が空、または空白だけの場合はタイトルを表示しません。
- タイトルはテキストとして出力されるため、`<` や `&` などはエスケープされて表示されます。

以前の `remark-flexible-code-titles` の記法（```` ```ts:foo.ts ````）は使えません。言語名に `:` を含めると、言語名として解釈されてハイライトされなくなります。

## 実装

`src/lib/markdown/code-title.ts` の `transformerCodeTitle()` を、`astro.config.mjs` の `markdown.shikiConfig.transformers` に登録しています。

- `parseCodeTitle(meta)`: メタ文字列からタイトルを取り出します。
- `transformerCodeTitle()`: Shiki の `root` フックで、生成された `<pre>` を `<div class="code-block">` で包み、タイトルがあれば `<pre>` の直前に `<div class="code-block-title">` を置きます。

出力される HTML は次のとおりです。タイトルがないコードブロックも、構造をそろえるため `div.code-block` で包みます。

```html
<div class="code-block">
  <div class="code-block-title">src/lib/utils.ts</div>
  <pre class="astro-code ..." data-language="ts">...</pre>
</div>
```

### Markdown 処理系との関係

Shiki transformer は Markdown 処理系に依存しません。Astro は unified（`@astrojs/markdown-remark`）でも Sätteri（`@astrojs/markdown-satteri`、Astro 7 のデフォルト）でも、`@astrojs/internal-helpers/shiki` の同じハイライタを使い、次のように呼び出します。

- `shikiConfig.transformers` をそのまま Shiki に渡す
- コードフェンスのメタ文字列を `meta: { __raw: meta }` として渡す（transformer からは `this.options.meta.__raw` で読む）
- Shiki が返した root の最初の子で、元の `<pre>` を置き換える

そのため transformer は root の子を 1 つ（`div.code-block`）にしています。Sätteri へ切り替えても、このままで同じ HTML が出力されます。

## スタイル

`src/styles/code-block.css`（`global.css` から読み込み）で次のように表示します。

- `.code-block-title`: 等幅フォント・小さめの文字、上側だけ角丸、ライトは `gray-200`、ダークは `gray-800` の背景
- `.code-block-title + .astro-code`: 上マージンをなくし、左上の角丸を外してタイトルとつなげる
- `.code-block:has(.code-block-title)`: タイトル付きのブロックの上にマージン（`mt-7`）を取る
- `.code-block .astro-code`: コードブロックの背景を、ライトは `gray-100`、ダークは Shiki テーマ（github-dark）の背景色にする

クラス名は特定のプラグイン名に依存しない名前にしています。

## テスト

- ユニットテスト: `src/lib/markdown/code-title.test.ts`（メタ文字列の解析と、サイトと同じデュアルテーマ設定での `codeToHtml` の出力）。`docs/unit-testing.md` を参照。
- E2E: `tests/e2e/specs/markdown-features.spec.ts` のコードタイトルのテストで、タイトルがコードブロックの上に隙間なく付いて表示されることを確認します。見た目の細部は `visual-pages.spec.ts` が担当します。`docs/e2e-testing.md` を参照。
