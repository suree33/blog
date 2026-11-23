import config from '@/config.json';
import { sortPostsByDateDescending } from '@lib/posts';
import { getTagPath } from '@lib/tags';
import type { Post } from '@/types/Post';

type ListedPost = Post & { url: string };

/**
 * HTML ページのパスを、Worker が `Accept: text/markdown` で返す Markdown 版のパスに変換する。
 * `src/worker.ts` の対応付けと同じ規則（`/` → `/index.md`、末尾の `/` を除いて `.md` を付ける）。
 */
export const toMarkdownPath = (path: string) =>
  path === '/' ? '/index.md' : `${path.replace(/\/$/, '')}.md`;

const markdownLink = (title: string, path: string, site: URL) =>
  `[${title}](${new URL(toMarkdownPath(path), site).href})`;

const postLines = (posts: readonly ListedPost[], site: URL) =>
  sortPostsByDateDescending(posts).map(({ frontmatter, url }) => {
    const description = frontmatter.description
      ? `: ${frontmatter.description}`
      : '';
    return `- ${markdownLink(frontmatter.title, url, site)}${description}`;
  });

export function buildSiteMarkdown({
  site,
  posts,
  pages,
}: {
  site: URL;
  posts: readonly ListedPost[];
  pages: readonly { title: string; url: string }[];
}) {
  return [
    `# ${config.siteName}`,
    '',
    `> ${config.description}`,
    '',
    '各ページは `Accept: text/markdown` を付けてリクエストすると Markdown で返します。下のリンクは各ページの Markdown 版です。',
    '',
    '## 記事',
    '',
    ...postLines(posts, site),
    '',
    '## ページ',
    '',
    ...pages.map(({ title, url }) => `- ${markdownLink(title, url, site)}`),
    `- ${markdownLink('タグ一覧', '/tags/', site)}`,
    '',
    '## Optional',
    '',
    `- [RSS フィード](${new URL('/rss.xml', site).href})`,
    `- [サイトマップ](${new URL('/sitemap-index.xml', site).href})`,
    '',
  ].join('\n');
}

export function buildTagIndexMarkdown({
  site,
  tags,
}: {
  site: URL;
  tags: readonly { tag: string; posts: readonly unknown[] }[];
}) {
  return [
    '# タグ一覧',
    '',
    ...tags.map(
      ({ tag, posts }) =>
        `- ${markdownLink(tag, getTagPath(tag), site)} (${posts.length}件)`,
    ),
    '',
  ].join('\n');
}

export function buildTagMarkdown({
  site,
  tag,
  posts,
}: {
  site: URL;
  tag: string;
  posts: readonly ListedPost[];
}) {
  return [`# ${tag}のタグが付いた記事`, '', ...postLines(posts, site), ''].join(
    '\n',
  );
}

export const markdownResponse = (body: string) =>
  new Response(body, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
