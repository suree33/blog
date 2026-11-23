# 静的アセットのブラウザキャッシュ

Cloudflare Workers Static Assets は `public/_headers` を読み込みます。このファイルはAstroのビルド時に `dist/_headers` へコピーされます。`/_astro/*` のルールは、ファイル名にハッシュを含むAstroのアセットの `Cache-Control` を、既定値から `public, max-age=31536000, immutable` に上書きします。内容が変わるとURLも変わるため、1年間キャッシュしても問題ありません。

`/link-card-images/*` は対象外です。`src/lib/markdown/link-card.ts` の `cacheImage()` がハッシュ化するのは、ダウンロードした画像のバイト列ではなく、デコードした取得元URLです。リモートの画像が変わっても、ローカルのファイル名は変わらない場合があります。

HTML、faviconには、Cloudflareの既定値である `public, max-age=0, must-revalidate` を維持します。サイト全体に `immutable` を適用するルールは追加しないでください。

`wrangler.toml` でWorkerを先に実行するのは `/posts/*` だけです。そのため、記事から参照する場合も、`/_astro/*` のアセットには静的アセットのルールが直接適用されます。Workerのヘッダー処理を変更する必要はありません。`src/worker.ts` は記事の配信を `env.ASSETS.fetch()` に委譲し、`Vary: Accept` やMarkdownのcharsetを追加するときも既存のヘッダーを保持します。Workerのコードで生成するレスポンスのヘッダーは、そのコード内で設定する必要があります。`_headers` はWorkerのレスポンス全般に適用されるミドルウェアではありません。

`_headers` の対応状況、上書き方法、Workerが生成するレスポンスへの注意点は、[Cloudflare Workers Static Assets のヘッダーに関するドキュメント](https://developers.cloudflare.com/workers/static-assets/headers/)を参照してください。

デプロイ時の挙動をローカルで確認するには、`pnpm run build:ci` の後に `pnpm exec wrangler dev` を実行します。`/_astro/` 配下に生成されたCSSまたは画像のURLを `curl -I` で確認し、`/posts/nespresso-mold/`、`/favicon.png`、`/link-card-images/` 配下のURLと比較します。Astro previewではCloudflareの `_headers` ルールが適用されないため、Wranglerを使ってください。
