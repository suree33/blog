# ユニットテスト (Vitest)

## コマンド

- `pnpm run test:unit`: 全ユニットテストを一度実行（CI 向け）
- `pnpm run test:unit:watch`: 変更を監視して再実行
- `pnpm run test:unit tests/unit/markdown.test.ts`: Markdown 回帰テストだけ実行

`pnpm install --frozen-lockfile` の後に実行します。ブラウザのインストールや事前ビルドは不要です。

## 構成

[Astro 公式のテストガイド](https://docs.astro.build/en/guides/testing/) に従い、
`vitest.config.ts` は `astro/config` の `getViteConfig()` で実際の Astro 設定を読み込みます。
Node 環境で `src/lib/**/*.test.ts` と `tests/unit/**/*.test.ts` のみを実行します。
`tests/worker/` は Node.js Test Runner、`tests/e2e/` は Playwright の対象です。
`src/pages/` にテストを置くとルートになるため、ここには置きません。

## Worker 統合テスト

`pnpm run build:ci && pnpm run test:integration` で実行します。ビルド済みの
`dist/` が必須です。`vitest.integration.config.ts` は Astro 設定を読み込まず、
`tests/integration/` だけを実行するため、ユニットテストとは独立しています。

Wrangler の公式 `createTestHarness` API で実際の `wrangler.toml` と静的アセットを
起動し、代表記事の HTML / Markdown 振り分け、Content-Type、Vary、静的 CSS、
未知の URL の 404 を検証します。`assets.not_found_handling = "404-page"` により、
通常の未知の URL と Worker 配下の未知の記事 URL は、サイトの `dist/404.html` を
ステータス 404 で返します。
CI の独立した「Worker integration tests」ジョブでもビルド後に実行します。

## Markdown 回帰テスト

`tests/unit/markdown.test.ts` は本番と同じ Sätteri ベースの Markdown 設定を使います。
テスト専用のレンダラーには切り替えません。

- `src/content/posts/**/*.md` を列挙し、Astro がページとして扱わない `_` 始まりのテンプレートと
  `.obsidian/` を除外します。記事追加時に一覧の手動更新は不要です。
- 各記事を Astro Container API でレイアウトごと描画し、タイトル、記事本文、公開日、
  ヘッダー、フッター、見出し ID と目次リンクの対応を検証します。
- 実際の記事の生成 HTML を Cheerio で解析し、GFM テーブル、セル内の強調、Shiki の
  light/dark 用トークン、インラインコード、相対画像のアセット解決を検証します。
- コードタイトル付きの記事でタイトルとハイライトを確認し、テスト用の Markdown で
  タイトルのエスケープやタイトルのないブロックの構造を検証します。
- 記事が 0 件になった場合や、コンパイル・描画時に例外が発生した場合も失敗します。

Callout、リンクカードの個別テストは含みません。
記事内にある場合は通常どおり処理されるため、リンクカードのメタデータ取得には
本番ビルドと同じくネットワークとプラグインのキャッシュを使用します。
外部サイトの応答内容はアサートしません。

`tests/unit/raw-markdown-endpoint.test.ts` は公開記事ソースの読み込みと layout 行の除去、公開記事が空の場合、`filePath` がない場合の明示的なエラー、読み込みエラーの伝播を検証します。

`tests/unit/post-schema.test.ts` は init-post の title・description・tags が空欄（YAML の null）でも読み込めること、既存の frontmatter 型に正規化されること、不正な型は拒否することを検証します。

## Sätteri リンクカードの単体テスト

`src/lib/markdown/link-card.test.ts` は、ローカルプラグインの
固定 HTML・CSS との互換性、画像キャッシュ、失敗時の縮退を検証します。
ループバック HTTP サーバーと注入した fetch を使うため、このテスト自体は外部通信しません。
詳細は [Sätteri 用リンクカード](./markdown-link-cards.md) を参照してください。

## 検証範囲と CI

これは HTML 構造の回帰テストであり、CSS の可視性やブラウザ上の配色、JavaScript の操作は
検証しません。それらは [Playwright E2E](./e2e-testing.md) が担当します。
Container API は実験的 API のため、Astro 更新時は互換性にも注意してください。

CI では既存の Lint ジョブで実行します。pre-commit の既存チェック（format、lint、build）は
変更していないため、コミット前には `pnpm run test:unit` も実行してください。

## Callout 回帰テスト

`tests/unit/satteri-callouts.test.ts` は既存記事の Callout を抜き出し、
旧 unified 出力を保存した固定 HTML と Sätteri の出力を比較します。
設定は [Markdown の Callout](./markdown-callouts.md) を参照してください。
