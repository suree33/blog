import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

/**
 * 記事の Markdown（`src/pages/posts/*.md`）が、frontmatter の `layout` で記事レイアウトを
 * 明示していることの確認。
 *
 * Sätteri への移行で、`src/pages/posts/` 配下に `MarkdownPostLayout` を自動で適用していた
 * remark プラグイン（`postsDefaultLayout`）をやめ、各記事の frontmatter に書く方式にした
 * （`docs/adr/0001-markdown-processor-satteri.md`）。書き忘れた記事はレイアウトなしの
 * HTML になってしまうため、ここで検出する。新規記事はテンプレート
 * （`template/_blog-post.md`）から作るので、テンプレートも対象にする。
 */
const POSTS_DIRECTORY = new URL('../../src/pages/posts/', import.meta.url);
const POST_LAYOUT = "layout: '@layouts/MarkdownPostLayout.astro'";

const postFiles = readdirSync(POSTS_DIRECTORY)
  .filter((name) => name.endsWith('.md'))
  .sort();

function frontmatterLines(path: URL): string[] {
  const source = readFileSync(path, 'utf-8');
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(source);
  return match ? match[1].split('\n') : [];
}

describe('記事の Markdown の layout', () => {
  test('記事の Markdown が 1 件以上ある', () => {
    expect(
      postFiles.length,
      'src/pages/posts/ 直下に記事の Markdown が見つかる',
    ).toBeGreaterThan(0);
  });

  test.each(postFiles)('%s は MarkdownPostLayout を指定している', (name) => {
    expect(
      frontmatterLines(new URL(name, POSTS_DIRECTORY)),
      `${name} の frontmatter に ${POST_LAYOUT} がある`,
    ).toContain(POST_LAYOUT);
  });

  test('記事のテンプレートは MarkdownPostLayout を指定している', () => {
    expect(
      frontmatterLines(new URL('template/_blog-post.md', POSTS_DIRECTORY)),
      `テンプレートの frontmatter に ${POST_LAYOUT} がある（init-post スキルで作る記事に引き継がれる）`,
    ).toContain(POST_LAYOUT);
  });
});
