# ブログの用語集

| 用語 | 意味 |
| --- | --- |
| 記事（post） | `src/content/posts/` 直下の Markdown ファイル。ファイル名の拡張子を除いた部分を slug として使い、公開記事は `/posts/[slug]` で読める。 |
| コンテンツコレクション（`posts`） | 記事の読み込み対象と frontmatter のスキーマを定義する Astro のコレクション（[`src/content.config.ts`](src/content.config.ts)）。 |
| frontmatter | Markdown の冒頭に書くメタデータ。タイトル、公開日（`pubDate`）、更新日（`updatedDate`）、タグなどを指定する。 |
| 下書き（`draft`） | frontmatter で `draft: true` を指定した記事。[`getPublishedPosts()`](src/lib/posts.ts) が除外するため、記事ページ、一覧、RSS、Raw Markdown には出力されない。 |
| タグ（`tags`） | frontmatter で指定する文字列の配列。`/tags/[tag]` では、同じタグを持つ公開記事と独立した Markdown ページを一覧にする。 |
| Sätteri | Markdown を HTML に変換する処理系。リンクカードと Callout は Sätteri 用のプラグインで処理する。採用の経緯は[ADR 0001](docs/adr/0001-markdown-processor-satteri.md)を参照。 |
| リンクカード | Markdown の単独の URL などを、リンク先のタイトルや画像を使ったカードに変換したもの。詳細は[リンクカード](docs/markdown-link-cards.md)を参照。 |
| Callout | `[!NOTE]` などのマーカーで始まる Markdown の引用ブロックを、補足や注意を示す表示に変換したもの。詳細は[Markdown の Callout](docs/markdown-callouts.md)を参照。 |
| Raw Markdown | 記事を HTML に変換する前の Markdown。公開記事の `/posts/[slug].md` で取得でき、frontmatter の `layout` は含まない。詳細は[Raw Markdown エンドポイント](docs/raw-markdown-endpoints.md)を参照。 |
| レイアウト | ページ共通の枠を `BaseLayout`、記事本文のスタイルを `ProseArticleLayout`、ブログ記事のメタデータと本文の配置を `MarkdownPostLayout` が担う。詳細は[レイアウト](docs/layouts.md)を参照。 |
