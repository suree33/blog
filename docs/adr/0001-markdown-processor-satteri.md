# 0001. Markdown の処理系に Sätteri を使う

- 状態: 採用
- 関連: [移行 PRD #761](https://github.com/Suree33/blog/issues/761)、[切り替え #766](https://github.com/Suree33/blog/issues/766)

## 背景

Astro 7 の標準の Markdown 処理系は Sätteri だが、このブログではレイアウトの自動適用、コードタイトル、リンクカード、Callout のために `unified()` と remark／rehype プラグインを使っていた。Astro の標準構成に近づけつつ、記事の表示に意図しない差分を出さないことを移行の判断基準とした。生成 HTML が旧プラグインと完全に一致することは要件にしなかった。

## 決定

- [Astro の設定](../../astro.config.mjs)で、`markdown.processor` に `@astrojs/markdown-satteri` の `satteri()` を指定する。[リンクカード](../markdown-link-cards.md)は `createLinkCards()` が返す mdast プラグイン、[Callout](../markdown-callouts.md)は `satteriCallouts` の hast プラグインで処理する。いずれも実装はこのリポジトリで管理する。
- ブログ記事は `src/content/posts/*.md` から Astro の `posts` コンテンツコレクションに読み込む。`src/pages/posts/[slug].astro` で `render(post)` を呼び、本文・見出し・frontmatter を `MarkdownPostLayout` に渡す。従来の `postsDefaultLayout` は使わず、記事ごとの `layout` 指定も不要とする。[raw Markdown](../raw-markdown-endpoints.md) は元のファイルを読み、既存の `layout` 行があれば除いて配信する。
- コードタイトルには、コードフェンスの言語名に続けて `title="..."` と書く。[ローカルの Shiki transformer](../../src/lib/code-title.ts) がこの指定を読み取る。PRD では Markdown の記法を互換性の対象に含めていたが、旧来の `lang:file` 記法は引き継がなかった。

`@astrojs/markdown-remark`、`remark-flexible-code-titles`、`remark-link-card-plus`、`rehype-callouts` はプロジェクトの直接依存から外した。

## リンクカードの画像

描画済みの HTML が Astro のキャッシュから再利用されると、Markdown プラグインは実行されない。その場合でも HTML が参照する画像を配信できるよう、画像を Astro の `cacheDir` 配下の `link-card-images/` に保存する。Astro integration がビルドのたびに、公開用の出力先（通常は `dist/link-card-images/`）へ画像をコピーする。

サムネイルと favicon は画像と判定できたものだけをローカルに保存する。画像でない応答は該当の要素を表示せず、SVG favicon はローカルの `.svg` として配信する。取得・キャッシュの詳細は[リンクカードのドキュメント](../markdown-link-cards.md)を参照。

## 採用しなかった案

- `unified()` を使い続ける案では旧プラグインをそのまま使えるが、Astro 7 の標準構成に近づけるため、Sätteri に切り替えた。
- Markdown プラグインで引き続きレイアウトを適用する案や、各記事の frontmatter に `layout` を書く案は採用しなかった。記事のレイアウトはコンテンツコレクションを表示するルートで指定し、記事本文や配信用の Markdown とは分けた。

## 表示の確認

[全ページのビジュアルリグレッションテスト](../e2e-testing.md#ページ全体のビジュアルリグレッション-visual-pagesspects)で、記事のレイアウトやコードタイトル、Callout、リンクカードの表示を確認する。リンクカードの外部応答はスタブに置き換えるため、外部サイトが実際に返す画像はこのテストの対象外。
