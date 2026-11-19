---
title: Astroにおけるremark-link-cardを使ったリンクカード
pubDate: 2024-04-05
updatedDate: 2026-02-12
tags:
  - ウェブ開発
  - Astro
  - remark
description: Astroで、remarkプラグインであるremark-link-cardを使いリンクをカード形式で表示できるようにしました。
ogimage: '/ogimage/remark-link-card-with-astro.og.png'
---

## 更新（2026/02/12）

remark-link-card-plus に移行しました。

<https://sur33.com/posts/remark-link-card-plus/>

## remark-link-card

remark-link-card は、remarkプラグインで、リンクをカード形式で表示するためのプラグインです。カード形式のリンクとは、以下のようなものです。

<https://github.com/gladevise/remark-link-card>

[Astroはデフォルトでremarkプラグインをサポートしている](https://docs.astro.build/ja/guides/markdown-content/#markdown%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3)ため、この `remark-link-card` を使ってリンクをカード形式で表示することができます。

## 実装

### 1. インストール

[GitHubのページ](https://github.com/gladevise/remark-link-card)を参考にインストールします。ここでは `bun` を使っていますが、 `npm` や `yarn` など、他のパッケージマネージャを使っても構いません。

```bash
bun install remark-link-card
```

### 2. 設定

`astro.config.mjs` を以下のように追記します。

```javascript title="astro.config.mjs"
import remarkLinkCard from 'remark-link-card';

// https://astro.build/config
export default defineConfig({
  // ...
  markdown: {
    remarkPlugins: [
      [
        remarkLinkCard,
        {
          cache: true,
          shortenUrl: true,
        },
      ],
    ],
  },
  // ...
});
```

今回は `cache` と `shortenUrl` を `true` にしています。

`remark-link-card` はデフォルトではAstroの毎コンパイル時にリンク情報を取得しに行きます。リンク先にかける負荷を減らすために、`cache` を `true` にして、リンク情報をキャッシュするようにしています。キャッシュは `/public/remark-link-card/` に保存されます。

また、`shortenUrl` を `true` にすることでリンク先のURLをドメインのみに短縮して表示するようにしています。

`remark-link-card` ではCSSは提供されていないので、自分でCSSを用意する必要があります。
CSSは以下のようにしました。

```scss title="remark-link-card.css"
/* ブレークポイント: 60ch（Tailwindcss/Typographyのproseのmax-widthを参考に） */
.rlc-container {
  --padding-x: 1rem;
  --padding-y: 0.7rem;
  --border-radius: calc(0.5rem - 1px);
  border: 1px solid var(--tw-prose-hr);
  border-radius: calc(var(--border-radius) + 1px);
  text-decoration: none;

  transition: background-color 150ms;

  &:hover {
    background-color: #f5f5f5;
    @media (prefers-color-scheme: dark) {
      background-color: #262626;
    }
  }

  width: 100%;
  margin-bottom: 1.25em;

  display: grid;
  grid-template-columns: 1fr 116px;
  gap: 1rem;
  @media (min-width: 60ch) {
    grid-template-columns: 1fr 220px;
  }
  .rlc-info {
    display: flex;
    flex-direction: column;
    justify-content: center;
    font-weight: normal;

    grid-column: 1;
    padding: var(--padding-y) 0 var(--padding-y) var(--padding-x);
    max-width: 100%;
    min-width: 100%;
    border-radius: var(--border-radius) 0 0 var(--border-radius);
    .rlc-title {
      font-size: 1rem;
      font-weight: bold;
      line-height: 1.3;
      color: var(--tw-prose-headings);

      overflow: hidden;
      display: -webkit-box;
      text-overflow: ellipsis;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }
    .rlc-description {
      font-size: 0.8rem;
      color: #737373;
      @media (prefers-color-scheme: dark) {
        color: #a3a3a3;
      }

      margin-bottom: 0.5em;

      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      -webkit-line-clamp: 1;
    }
    .rlc-url-container {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      .rlc-favicon {
        margin-top: 0.15rem;
        margin-bottom: 0;
      }
      .rlc-url {
        font-size: 0.8rem;
        color: #525252;
        @media (prefers-color-scheme: dark) {
          color: #d4d4d4;
        }

        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        -webkit-line-clamp: 1;
      }
    }
  }
  .rlc-image-container {
    grid-column: 2;
    aspect-ratio: 1 / 1;
    @media (min-width: 60ch) {
      aspect-ratio: 1.91 / 1;
    }
    .rlc-image {
      object-fit: cover;
      height: 100%;
      width: 100%;
      margin: 0;
      border-radius: 0 var(--border-radius) var(--border-radius) 0;
    }
  }
}
```

### 3. 使い方

`remark-link-card` は生のURLのみに適用されます。以下のように記述すると、リンクがカード形式で表示されます。

```markdown
https://github.com/gladevise/remark-link-card
```

<https://github.com/gladevise/remark-link-card>

<>で囲っても適用されます。

```markdown
<https://github.com/gladevise/remark-link-card>
```

<https://github.com/gladevise/remark-link-card>

インライン形式のリンクには適用されません。

```markdown
[remark-link-card - GitHub](https://github.com/gladevise/remark-link-card)
```

[remark-link-card - GitHub](https://github.com/gladevise/remark-link-card)

## 参考

<https://docs.astro.build/ja/guides/markdown-content/#markdown%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3>

<https://github.com/gladevise/remark-link-card>

<https://roboin.io/article/2024/02/09/how-to-use-remark-link-card/>

<https://futabooo.com/blog/2023/link-card/>
