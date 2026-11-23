# sur33.com blog

[![Static Badge](https://img.shields.io/badge/blog-sur33.com-fb5607?style=flat&link=https%3A%2F%2Fsur33.com%2F)](https://sur33.com/)
[![GitHub last commit (branch)](https://img.shields.io/github/last-commit/Suree33/blog/main?style=flat)](https://github.com/Suree33/blog/commits/main/)
[![wakatime](https://wakatime.com/badge/github/Suree33/blog.svg)](https://wakatime.com/badge/github/Suree33/blog)

[![Astro](https://img.shields.io/badge/Astro-0C1222?style=flat&logo=astro&logoColor=FDFDFE)](https://astro.build/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

## 実行方法

### 依存関係のインストール

```bash
pnpm install
```

Node.js と pnpm のバージョンは `package.json` の `devEngines.runtime` と `devEngines.packageManager` で管理しています。
`pnpm install` が指定バージョンの Node.js を導入し、`pnpm run` と `pnpm exec` はその Node.js で実行します。
解決した正確なバージョンは `pnpm-lock.yaml` に固定されます。
シェルから直接 `node` を実行すると別バージョンになることがあるため、その場合は `pnpm exec node` を使ってください。

### ローカルサーバーの起動

```bash
pnpm run dev
```

### フォーマット

```bash
pnpm run format
```

### ビルド

```bash
pnpm run build
```

### ビルド結果のプレビュー

```bash
pnpm run preview
```

### Worker の型生成

```bash
pnpm run cf-typegen
```

`wrangler.toml` の設定（バインディング、`compatibility_date`）から Worker の型を `worker-configuration.d.ts` に生成します。
生成した型は Worker 用の `tsconfig.worker.json` だけで読み込み、Astro のサイト側の型には混ぜません。
`pnpm run lint` も最初にこのコマンドを実行するため、Wrangler の更新後に型が古いまま残ることはありません。

## 記事の書き方

記事は `src/content/posts/` の直下に Markdown ファイル（`.md`）として置きます。記事の URL は `/posts/<拡張子を除いたファイル名>` です。たとえば `src/content/posts/hello.md` は `/posts/hello` になります。

ファイルの先頭に `---` で囲んだ frontmatter を書き、その下に Markdown で本文を書きます。

```yaml
---
title: はじめての記事
pubDate: 2026-10-01
description: このブログで書くこと
tags: [Astro]
---
```

- 必須: `pubDate`（公開日。例: `2026-10-01`）
- 任意: `title`（タイトル）、`description`（概要）、`tags`（タグ名の配列）、`updatedDate`（更新日。書式は `pubDate` と同じ）
- `image`（任意）: 記事に表示する画像を `{ src: /images/hello.png, alt: 記事の画像 }` のように指定します。`alt` は省略できます。
- `ogimage`（任意）: OGP 画像のパスを文字列で指定するか、`image` と同じ形式で指定します。
- 下書き: frontmatter に `draft: true` を追加します。下書きは記事一覧や RSS に載らず、記事の URL も生成されません。公開するときは `draft` を削除するか、`draft: false` に変更します。

Astro の `posts` コンテンツコレクションから記事を読み込み、`src/pages/posts/[slug].astro` で共通のレイアウトを適用するので、frontmatter に `layout` は不要です。

Markdown の処理には Sätteri を使います。[リンクカード](docs/markdown-link-cards.md)と [Callout](docs/markdown-callouts.md)は、このリポジトリのプラグインで変換します。処理系とレイアウトの採用理由は [Sätteri 移行の ADR](docs/adr/0001-markdown-processor-satteri.md) を参照してください。

### コードブロックのタイトル

コードフェンスの言語名に続けて `title="..."` を指定します（例: `` ```ts title="src/lib/utils.ts" ``）。
旧記法の `ts:src/lib/utils.ts` ではタイトルを表示しません。タイトルの表示には Astro の `shikiConfig.transformers` に登録した [Shiki transformer](src/lib/code-title.ts) を使います。

## 使用ツール・サービス

### フレームワーク

- [Astro](https://astro.build/)
- [Tailwind CSS](https://tailwindcss.com/)
  - [Tailwind Typography](https://github.com/tailwindlabs/tailwindcss-typography)

### アセット

- [Astro Icon](https://www.astroicon.dev/)
  - [Iconify](https://iconify.design/)
    - [Font Awesome 6](https://fontawesome.com/)
