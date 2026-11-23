# Raw Markdown エンドポイント

ブログ記事の HTML ページに加えて、frontmatter を含む raw Markdown を取得できる `.md` エンドポイントを提供しています。Astro の表示制御用 `layout` frontmatter は出力しません。

記事以外のページ（トップ、固定ページ、タグ一覧、各タグ）にも Markdown 版があり、AI エージェント向けに `Accept: text/markdown` で取得できます（[AI エージェント向けの対応](#ai-エージェント向けの対応)）。

## URL

各記事の slug に `.md` を付けた URL で取得できます。

```text
/posts/foo
/posts/foo.md
```

- `/posts/foo`: 通常の HTML 記事ページ
- `/posts/foo.md`: frontmatter 込みの raw Markdown（`layout` は除外）
- `/posts/foo` + `Accept: text/markdown`: frontmatter 込みの raw Markdown（`layout` は除外）

## 実装

Raw Markdown の生成は `src/pages/posts/[slug].md.ts` で実装しています。

- `getPublishedPosts()` で `posts` コレクションの公開記事のみ取得し、`filePath` から元の Markdown を文字列として読み込む
- `getStaticPaths()` で記事ごとの `slug` を列挙し、静的ビルド時に `/posts/[slug].md` を生成する
- 読み込んだ Markdown の frontmatter から `layout` 行を除去する
- `GET` は raw Markdown を返し、Worker が最終レスポンスの `Content-Type` を `text/markdown; charset=utf-8` に正規化する

`template/_blog-post.md` や画像ディレクトリ配下のファイルは、コレクションの glob の対象外です。

通常の記事 URL への content negotiation は `src/worker.ts` で実装しています。

- `wrangler.toml` の `assets.run_worker_first = ["/*", "!/_astro/*"]` で、フィンガープリント付きアセット以外は Worker を先に実行する
- `GET` / `HEAD` で拡張子のないページ URL（`/`、`/about/`、`/posts/[slug]` など）にアクセスされ、`Accept` ヘッダーで `text/markdown` が `text/html` 以上に優先される場合は、対応する `.md`（`/` は `/index.md`、それ以外は末尾の `/` を除いて `.md` を付けたパス）を Assets binding から返す。`.md` がなければ HTML を返す
- `Accept` ヘッダーの `q` 値、ワイルドカード、同じ `q` 値での記述順を考慮する
- 1つのメディアタイプに複数の media range が当てはまる場合は、RFC 9110 に従い最も具体的なものの `q` 値を使う（例: `text/html;q=0, */*;q=0.8` では `text/html` は受け付けない扱い）
- 具体性はまず型・サブタイプ（`text/markdown` > `text/*` > `*/*`）で比べ、同じ型同士では `charset` などの media type パラメータ付きの range をより具体的な扱いとする。配信する UTF-8 の変種に一致する `charset=utf-8`（引用符付きの `charset="utf-8"` も同じ）以外のパラメータを持つ range は当てはまらないものとする
- キャッシュが `Accept` ごとに分かれるよう、振り分け対象（`GET` / `HEAD` のページ URL）のレスポンスには Markdown・HTML のどちらを返す場合も `Vary: Accept` を付与する

Worker 側は `.md` への振り分けに加え、Cloudflare Workers Static Assets が拡張子から付与する `text/markdown` に `charset=utf-8` を補います。raw Markdown の生成処理自体は Astro の endpoint に寄せています。別ホスティングへ移植する場合は、この振り分け・ヘッダー正規化層を移植先の middleware / edge function / rewrite に置き換えます。

## AI エージェント向けの対応

[Is Your Site Agent-Ready?](https://isitagentready.com/) のチェック項目のうち、静的なブログに当てはまるものに対応しています。スキャナーは入力した URL だけを調べるので、トップに加えて記事・About・タグのページも個別にスキャンします。

| URL | 内容 | 実装 |
| --- | --- | --- |
| `/index.md`、`/llms.txt` | サイト概要と、記事・固定ページ・タグ一覧の Markdown 版へのリンク（[llms.txt](https://llmstxt.org/) 形式） | `src/pages/index.md.ts`、`src/pages/llms.txt.ts`、`src/lib/agent-markdown.ts` |
| `/[page].md` | `src/pages/*.md` の固定ページの raw Markdown（`layout` は除外） | `src/pages/[page].md.ts` |
| `/tags.md`、`/tags/[tag].md` | タグ一覧と、タグごとの記事一覧 | `src/pages/tags.md.ts`、`src/pages/tags/[tag].md.ts` |
| `/robots.txt` | [Content Signals](https://contentsignals.org/)（`search=yes, ai-input=yes, ai-train=no`）。検索と AI の回答での利用は許可し、学習への利用は許可しない | `src/pages/robots.txt.ts` |

Worker は、ページ URL への `200` レスポンスに [RFC 8288](https://www.rfc-editor.org/rfc/rfc8288) の `Link` ヘッダーを付けます。

- HTML の場合は、対応する `.md` が Assets にあれば `rel="alternate"; type="text/markdown"` でそのパスを示す（有無は `HEAD` で確認する）
- HTML・Markdown のどちらでも、`/llms.txt`（`rel="describedby"`）、`/rss.xml`（`rel="alternate"`）、`/sitemap-index.xml`（`rel="sitemap"`）を示す

API や MCP サーバー、OAuth などは提供していないため、API Catalog や MCP Server Card、Agent Skills などのディスカバリー用ファイルは置いていません。

## 動作確認

変更時は以下を実行してください。

```bash
pnpm run lint
pnpm run test:worker
pnpm run test:unit
pnpm run build:ci && pnpm run test:integration
```
