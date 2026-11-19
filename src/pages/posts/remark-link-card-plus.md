---
title: remark-link-card-plusへ移行しました
pubDate: 2026-02-12
tags: 
  - ウェブ開発
  - Astro
  - remark
description: メンテナンスの停滞している remark-link-card から remark-link-card-plus へ移行しました。
---

## gladevise/remark-link-card

remark-link-card はリンクをカード形式で表示するためのRemarkプラグインで、本サイトでもリンクカードの実現のためにこれを使用していました。ただ、現在はほぼメンテされていないので、移行することにしました。

<https://sur33.com/posts/remark-link-card-with-astro>

## okaryo/remark-link-card-plus

remark-link-card-plus は remark-link-card を改善したものらしいです。実際、remark-link-card ではOpen Graphのデータが大きすぎるとエラーになる問題がありましたが、この remark-link-card-plus では解消されていました。

<https://github.com/okaryo/remark-link-card-plus>

### 移行作業

#### 1. インストール

```bash
pnpm rm remark-link-card
pnpm i remark-link-card-plus
```

#### 2. astro.config.mjs に設定追加

今回は移行なので、やったことはimportの `'remark-link-card'` を `'remark-link-card-plus'` に置き換えただけ。

```javascript title="astro.config.mjs"
import remarkLinkCard from 'remark-link-card-plus';

export default defineConfig({
  // ...
  markdown: {
    remarkPlugins: [
      [
        remarkLinkCard,
        {
          cache: true,
        },
      ],
    ],
  },
  // ...
});
```

#### 3. CSS追加

基本的に[remark-link-cardの時のCSS](https://sur33.com/posts/remark-link-card-with-astro)をremark-link-card-plus用に書き換えただけ。ただ、Tailwind CSS化してあるため、 `@apply` を多用しており、純粋なCSSはほぼありません。Tailwind CSSを使っていないプロジェクトでは、AIなどで頑張って生CSS化して使ってください。

```css title="remark-link-card.css"
/* ブレークポイント: 60ch（Tailwindcss/Typographyのproseのmax-widthを参考に） */
.remark-link-card-plus__container {
  --padding-x: 1rem;
  --padding-y: 0.7rem;
  --border-radius: calc(0.5rem - 1px);
  @apply rounded-[calc(var(--border-radius)+1px)];
  @apply border border-(--tw-prose-hr);
  @apply transition-colors hover:bg-gray-50 dark:hover:bg-gray-800;
  @apply mb-5 w-full;
}

.remark-link-card-plus__card {
  @apply grid grid-cols-[1fr_116px] gap-4;
  @apply no-underline;

  @media (min-width: 60ch) {
    @apply grid-cols-[1fr_220px];
  }
}

.remark-link-card-plus__main {
  @apply flex flex-col justify-center font-normal;
  @apply max-w-full min-w-full;
  @apply col-1;
  @apply py-(--padding-y) pr-0 pl-(--padding-x);
  @apply rounded-tl-(--border-radius) rounded-bl-(--border-radius);
}

.remark-link-card-plus__content {
}

.remark-link-card-plus__title {
  @apply text-base leading-5 font-bold;
  @apply text-(--tw-prose-headings);
  @apply line-clamp-2 text-ellipsis;
}

.remark-link-card-plus__description {
  @apply text-xs text-gray-500 dark:text-gray-400;
  @apply mt-1 mb-3;

  @apply line-clamp-1 text-ellipsis;
}

.remark-link-card-plus__meta {
  @apply flex items-center gap-2;
}

.remark-link-card-plus__favicon {
  @apply m-0 mt-0.5;
}

.remark-link-card-plus__url {
  @apply text-xs text-gray-600 dark:text-gray-300;
  @apply line-clamp-1 text-ellipsis;
}

.remark-link-card-plus__thumbnail {
  @apply col-2 aspect-square;

  @media (min-width: 60ch) {
    @apply aspect-[1.91/1];
  }
}

.remark-link-card-plus__image {
  @apply m-0 h-full w-full object-cover;
  @apply rounded-tr-(--border-radius) rounded-br-(--border-radius);
}
```

### 使い方

使い方は変わらずで、

```markdown
https://github.com/okaryo/remark-link-card-plus
```

のようにリンクだけ裸で置けばリンクカードになります。

<https://github.com/okaryo/remark-link-card-plus>

## 参考

<https://blog.okaryo.studio/20250108-release-remark-link-card-plus/>

<https://github.com/okaryo/remark-link-card-plus>

<https://ilapaj.com/posts/2025-03-16-remark-link-card-plus/>
