# ユニットテスト (Vitest)

## コマンド

- `pnpm run test:unit`: 全ユニットテストを一度実行（CI 向け）
- `pnpm run test:unit:watch`: 変更を監視して再実行
- `pnpm run test:unit -- tests/unit/markdown.test.ts`: Markdown 回帰テストだけ実行

`pnpm install --frozen-lockfile` の後に実行します。ブラウザのインストールや事前ビルドは不要です。

## 構成

[Astro 公式のテストガイド](https://docs.astro.build/en/guides/testing/) に従い、
`vitest.config.ts` は `astro/config` の `getViteConfig()` で実際の Astro 設定を読み込みます。
Node 環境で `src/lib/**/*.test.ts` と `tests/unit/**/*.test.ts` のみを実行します。
`tests/worker/` は Node.js Test Runner、`tests/e2e/` は Playwright の対象です。
`src/pages/` にテストを置くとルートになるため、ここには置きません。

## Markdown 回帰テスト

`tests/unit/markdown.test.ts` は現在の unified ベースの Markdown 設定をそのまま使います。
テスト専用のレンダラーや Sätteri 設定への切り替えは行いません。

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

これは HTML 構造の回帰テストであり、CSS の可視性やブラウザ上の配色、JavaScript の操作は
検証しません。それらは [Playwright E2E](./e2e-testing.md) が担当します。
Container API は実験的 API のため、Astro 更新時は互換性にも注意してください。

CI では既存の Lint ジョブで実行します。pre-commit の既存チェック（format、lint、build）は
変更していないため、コミット前には `pnpm run test:unit` も実行してください。
