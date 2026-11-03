# 0001. Markdown の処理系を Sätteri にする

- 状態: 採用
- 関連: #761（PRD）、#762〜#766

## 背景

`astro.config.mjs` は `@astrojs/markdown-remark` の `unified()` を指定し、Astro 7 のデフォルトの Markdown 処理系である Sätteri を使っていなかった。unified 上の次の拡張に依存していたためである。

- `postsDefaultLayout`: `src/pages/posts/*.md` に `MarkdownPostLayout` を自動で適用するローカルの remark プラグイン
- `remark-flexible-code-titles`（コードタイトル）、`remark-link-card-plus`（リンクカード）、`rehype-callouts`（Callout）

移行では、記事の表示（レイアウト、目次、ハイライト、画像、RSS、raw Markdown、Workers の content negotiation）を変えないことを条件にした。保証するのは Markdown の記法と表示上の意味までで、生成 HTML が旧プラグインと完全に一致することは求めない。

## 決定

- `markdown.processor` に `satteri()`（`@astrojs/markdown-satteri`）を指定し、拡張をリポジトリ内で所有する。
  - コードタイトル: Shiki transformer（`src/lib/markdown/code-title.ts`、`docs/code-title.md`）
  - Callout: hast プラグイン `calloutPlugin`（`src/lib/markdown/callout.ts`、`docs/markdown-callouts.md`）
  - リンクカード: 非同期の mdast プラグイン `linkCard()`（`src/lib/markdown/link-card.ts`、`docs/markdown-link-cards.md`）
- `@astrojs/markdown-satteri` は `satteri()` を import するために依存へ加え、Astro が使うバージョンに固定する（`satteri` / `shiki` と同じく Renovate の Astro グループで更新する）。
- 記事レイアウトは自動適用をやめ、各記事とテンプレート（`src/pages/posts/template/_blog-post.md`）の frontmatter に `layout: '@layouts/MarkdownPostLayout.astro'` を書く。
- 表示を変えないため、旧プラグインの挙動を次の点でもそのまま引き継ぐ。
  - Callout のダークモードは、これまでどおり `<html>` に `.dark` クラスがあるときだけ切り替える（テーマが「OS の設定」のときは OS がダークでもライトの色）。
  - 記事で使っていない Obsidian の Callout の種類（`[!TODO]` など）と折りたたみ（`[!NOTE]-` / `[!NOTE]+`）には対応せず、通常の blockquote として表示する。

## 結果

- unified と `@astrojs/markdown-remark`、`rehype-callouts`、`remark-link-card-plus`（と、それが使う `open-graph-scraper`）への依存がなくなった。拡張は単体テスト（Vitest）と E2E で守る。
- 生成 HTML は次の点だけが変わり、画面の表示は変わらない（切り替えの前後で、ネットワークスタブ付きのビルド出力の全ファイル比較と、全ページのフルページのスクリーンショット比較で確認した）。
  - クラス名: `callout*` → `markdown-callout-*`、`remark-link-card-plus__*` → `link-card__*`
  - リンクカードの画像の保存先: `public/remark-link-card-plus/` → `public/link-card-images/`（ファイル名の規則は同じ）
  - HTML のシリアライズ: 文字参照の書き方（`&#x26;` → `&amp;` など）と、ブロック要素の間の改行
- 見出しの `id`、目次、画像（`astro:assets` による最適化）、表、GFM の自動リンク、スマートな句読点、記事中の生の HTML、RSS の内容、sitemap、raw Markdown（`/posts/*.md`）は変わらない。脚注・取り消し線・タスクリストは記事で使っていないため、移行の前後の比較では確かめていない（使い始めるときは表示を確認する）。
- 新しい記事は frontmatter に `layout` が必要になる。テンプレートと `init-post` スキルで入るようにし、書き忘れは `tests/unit/posts-layout.test.ts` で検出する。`layout` は raw Markdown の出力から除去するので、Workers の content negotiation で返す Markdown にも含まれない。

## 検討した代替案

- **unified のまま使い続ける**: 既存のプラグインはそのまま動くが、Astro のデフォルトから外れ続け、更新の止まりがちなサードパーティ製プラグインに表示が依存し続ける。採用しない。
- **レイアウトの自動適用を Sätteri で続ける**: Sätteri のプラグインは `ctx.fileURL` と `ctx.data.astro.frontmatter` を参照できるので、`postsDefaultLayout` と同じことは技術的には書ける。しかし、Markdown のファイルを見てもレイアウトがどこで決まるかわからない「隠れた設定」が残り、処理系の内部（Astro が frontmatter をプラグインの後に読む順序）にも依存する。frontmatter に明示する方式は 1 行の重複で済み、`src/pages/dreamhouse.md` など既存のページとも書き方がそろい、raw Markdown からの除去も既存の処理で足りる。差がないなら隠れた仕組みの少ない方を選ぶ方針で、明示する方式を採用した。
- **旧プラグインと同じ HTML（クラス名）を出力する**: CSS をそのまま流用できるが、削除するプラグインの名前がクラス名に残る。表示が同じなら HTML の構造の一致は求めないため、プラグインに依存しない名前にした。
