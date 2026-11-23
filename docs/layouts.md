# レイアウト

このドキュメントでは、`src/layouts/` ディレクトリに含まれるAstroレイアウトコンポーネントについて説明します。

## 概要

レイアウトは階層化された構造になっており、基本的なHTMLテンプレートから特化したブログ記事レイアウトまで、段階的に機能を拡張しています。

```
BaseLayout.astro (基本レイアウト)
├── ProseArticleLayout.astro (記事レイアウト)
│   └── MarkdownPostLayout.astro (ブログ記事レイアウト)
```

## BaseLayout.astro

サイト全体の基本HTMLテンプレートを提供するレイアウトです。

### 主な機能

- **HTMLドキュメント構造**: `<html>`, `<head>`, `<body>` の基本構造
- **メタタグ管理**: SEO、OGP、ビューポート設定
- **サイト設定統合**: `config.json` からサイト名、説明、OGイメージを読み込み
- **ダークモード対応**: TailwindCSSのダークモードクラス
- **初期テーマ同期**: `<head>` のインラインスクリプトで localStorage のテーマを初回描画前に `<html>` へ反映し、OS テーマとの差分によるちらつきを防止
- **共通コンポーネント**: Header、Footer の配置

### SEO metadata

`BaseLayout` constructs canonical and Open Graph page URLs from the pathname
and `Astro.site` (the production origin in `astro.config.mjs`), without query
parameters. The 404 page passes `canonical={false}` to omit its canonical link.
RSS discovery points to `/rss.xml` on the same origin.

Social cards use `summary_large_image`. The default image at
`public/ogimage/ogimage-default.png` measures 1200 × 630 pixels (about 1.9:1);
only that image receives width and height tags. Update these measured values if
the file changes. Custom image strings have no intrinsic Astro image metadata,
so their dimensions are omitted rather than guessed or fetched remotely.
`ogImageAlt` overrides the image description; otherwise the default image uses
the site name and custom images use the page title. Object-form post `ogimage.alt`
is forwarded to this prop.

Google Analyticsのスクリプトは読み込みません。Cloudflare Web Analyticsの設定は変更していません。

### Keyboard navigation and headings

The first focusable element is the skip link, labeled `本文へスキップ`. It is
visually hidden until focused, appears as a full-width bar in normal flow above
the sticky header in both themes without covering its links,
and targets `<main id="main-content" tabindex="-1">` so activation moves keyboard
focus to the content. Keep this link before the header. The main target uses
`scroll-mt-24 sm:scroll-mt-28`, matching article heading anchors, so the sticky
header does not cover the first content link after activation and Tab.

Each HTML page supplies exactly one nonempty `h1` inside `main`; the header logo
is not a heading. The home page uses a visually hidden `Blog` heading to preserve
the existing design. Article, About, tag, Dreamhouse and 404 pages retain their
page titles as headings.

### Props

```typescript
interface Props {
  pageTitle?: string;
  ogimage?: string;
  ogImageAlt?: string;
  canonical?: boolean;
  description?: string;
  ogType?: 'website' | 'article';
}
```

### 使用例

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
---

<BaseLayout pageTitle="ページタイトル" description="ページの説明">
  <!-- コンテンツ -->
</BaseLayout>
```

### 内部ページへのリンク

内部のHTMLページへのリンクは、Cloudflare Static Assets がリダイレクトせずに配信するURLに合わせ、末尾に `/` を付けます。

`src/lib/posts.ts` の `getPublishedPosts()` と `getPublishedStandalonePages()` は、一覧とRSSに末尾が `/` のURLを渡します。`PostMetadata.astro` のタグリンクとMarkdown内の内部ページへのリンクも、この形式にそろえます。

`/rss.xml` や `/posts/example.md` などのファイルへのリンク、ページ内リンク、外部URLは変更しません。AstroのURLポリシーやWorkerの動作も変更しません。

## ProseArticleLayout.astro

文章コンテンツに特化したレイアウトです。BaseLayoutを拡張しています。

### 主な機能

- **Prose スタイリング**: TailwindCSS の typography プラグインを使用
- **レスポンシブデザイン**: モバイルでは外枠の左右16pxを除いた幅を本文に使い、`xl` 以上ではサイドバー目次との32pxのガターを確保
- **ダークモード対応**: prose-invert クラスによる自動切り替え
- **タイポグラフィ設定**: 見出し、コード、画像の統一スタイル

### Proseクラスの特徴

- `prose-h1:mb-10 prose-h1:mt-6 prose-h1:text-center prose-h1:text-3xl`: H1の中央配置と大きなサイズ
- `prose-h2:border-b prose-h2:border-b-neutral-300 prose-h2:pb-2`: H2に下線を追加
- `prose-h3:border-b prose-h3:border-b-neutral-300 prose-h3:pb-2`: H3に下線を追加
- `prose-img:rounded`: 画像に角丸を適用
- `prose-code:font-normal`: インラインコードのフォント調整

### Props

BaseLayoutと同じPropsを継承します。

### 使用例

```astro
---
import ProseArticleLayout from '../layouts/ProseArticleLayout.astro';
---

<ProseArticleLayout pageTitle="記事タイトル">
  <h1>記事タイトル</h1>
  <p>記事本文...</p>
</ProseArticleLayout>
```

## MarkdownPostLayout.astro

Markdownブログ記事専用のレイアウトです。ProseArticleLayoutを拡張しています。

### 主な機能

- **Frontmatter対応**: Markdownのメタデータを自動表示
- **見出し目次（TOC）**: Markdown見出しから自動で目次を生成（h2/h3）
- **TOC状態同期**: スクロール位置に応じて`before/current/after`状態をJSで付与
- **タグ表示**: 記事タグのリンク生成
- **日付表示**: 公開日・更新日の表示（アイコン付き）
- **画像対応**: Frontmatterで指定した画像の表示
- **説明文表示**: 記事の概要を強調表示
- **Callout対応**: Sätteri 用ローカルプラグインのスタイル設定

### 記事本文の操作

`/posts/[slug]/` では `PostContent.astro` が記事本文に操作を追加する。見出しのパーマリンクには既存の ID を使い、目次は変更しない。Clipboard API が使える環境ではコピーボタンでコードだけをコピーできる。コードブロックのタイトルはコピーに含めない。

### Frontmatter対応プロパティ

```typescript
interface Frontmatter {
  title: string;
  tags: string[];
  pubDate: string;
  updatedDate?: string;
  image?: {
    src: string;
    alt: string;
  };
  description?: string;
  ogimage?: string | {
    src: string;
    alt?: string;
  };
}
```

### 表示要素

1. **タグリスト**: ドット区切りで表示、各タグはリンク化
2. **公開日**: 羽ペンアイコン付きで表示
3. **更新日**: 回転アイコン付きで表示（存在する場合のみ）
4. **記事タイトル**: H1として表示
5. **アイキャッチ画像**: 指定時のみ表示
6. **記事説明**: グレー背景のボックスで表示
7. **目次（TOC）**: タイトル直下にh2/h3見出しへのリンクを表示（見出しがある場合のみ）

### TOC状態同期ロジック

- `TableOfContents.astro` は `data-toc-root`, `data-toc-item`, `data-toc-link` を出力する
- `src/scripts/toc.ts` の `initTableOfContentsState()` がスクロール・リサイズ・ハッシュ変化に追従して、各目次項目に `data-target-state="before|current|after"` を付与する
- TOCリンクのクリック時に `current` を即時固定せず、スクロール位置だけを基準に状態更新する（スムーススクロール中のフラッシュ防止）
- `current` のリンクには `aria-current="location"` を付与する
- `:target-before`, `:target-after`, `:target-current` 相当のロジックのみ実装し、見た目のスタイリングは別タスクで追加する

### カスタムスタイル

- **Callout対応**: GitHub風のコールアウトスタイル
- **ダークモード**: Calloutのボーダーと色をダークテーマに対応
- **アイコン**: astro-icon コンポーネントでFont Awesomeアイコンを使用

### 使用例

`src/content/posts/` の `posts` コレクションを `src/pages/posts/[slug].astro` が `render()` し、見出しと frontmatter を `MarkdownPostLayout` に渡します。`layout` は不要です。`getPublishedPosts()` は `draft: true` を除外し、一覧・タグ・RSS・raw Markdown・記事ルートで共有します。下書きのルートは生成されず、sitemap にも入りません。

```astro
---
title: 'ブログ記事タイトル';
tags: ['tech', 'blog'];
pubDate: '2024-01-01';
---

# 記事内容 記事本文がここに来ます。
```

## 開発時の注意点

### レイアウトの選択指針

- **一般的なページ**: `BaseLayout` を使用
- **文章中心のページ**: `ProseArticleLayout` を使用
- **ブログ記事**: `MarkdownPostLayout` を使用（`src/content/posts/` 配下の Markdown には自動適用）

### カスタマイズ

レイアウトをカスタマイズする際は以下の点に注意してください：

1. **継承関係**: 上位レイアウトの変更は下位レイアウトにも影響します
2. **config.json**: サイト全体の設定は `src/config.json` で管理
3. **TailwindCSS**: スタイリングはTailwindクラスを使用
4. **ダークモード**: 全レイアウトでダークモード対応が必要

### プラグイン依存

- **astro-icon**: アイコン表示
- **satteriCallouts**: Callout機能（`src/lib/satteri-callouts.ts`）
- **@tailwindcss/typography**: Proseスタイリング
