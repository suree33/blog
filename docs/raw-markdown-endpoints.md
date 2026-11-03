# Raw Markdown エンドポイント

ブログ記事の HTML ページに加えて、frontmatter を含む raw Markdown を取得できる `.md` エンドポイントを提供しています。Astro の表示制御用 `layout` frontmatter は出力しません。

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

- `import.meta.glob('./*.md', { query: '?raw', import: 'default', eager: true })` で `src/pages/posts/` 直下の記事 Markdown を文字列として読み込む
- `getStaticPaths()` で記事ごとの `slug` を列挙し、静的ビルド時に `/posts/[slug].md` を生成する
- 読み込んだ Markdown の frontmatter から `layout` 行を除去する（記事は `layout: '@layouts/MarkdownPostLayout.astro'` を frontmatter に書いているが、読者には不要な Astro の内部設定のため出力しない）
- `GET` は raw Markdown を返し、Worker が最終レスポンスの `Content-Type` を `text/markdown; charset=utf-8` に正規化する

`template/_blog-post.md` や画像ディレクトリ配下のファイルは、`./*.md` の対象外です。

通常の記事 URL への content negotiation は `src/worker.ts` で実装しています。

- `wrangler.toml` の `assets.run_worker_first = ["/posts/*"]` で記事配下のみ Worker を先に実行する
- `GET` / `HEAD` で `/posts/[slug]` にアクセスされ、`Accept` ヘッダーで `text/markdown` が `text/html` 以上に優先される場合だけ `/posts/[slug].md` を Assets binding から返す
- `Accept` ヘッダーの `q` 値、ワイルドカード、同じ `q` 値での記述順を考慮する
- キャッシュが `Accept` ごとに分かれるよう、Markdown 返却時に `Vary: Accept` を付与する

Worker 側は `.md` への振り分けに加え、Cloudflare Workers Static Assets が拡張子から付与する `text/markdown` に `charset=utf-8` を補います。raw Markdown の生成処理自体は Astro の endpoint に寄せています。別ホスティングへ移植する場合は、この振り分け・ヘッダー正規化層を移植先の middleware / edge function / rewrite に置き換えます。

## 動作確認

変更時は以下を実行してください。

```bash
pnpm run lint
pnpm run build
```
