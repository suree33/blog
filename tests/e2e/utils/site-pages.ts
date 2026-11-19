import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { routes } from './routes';

/**
 * ページ全体のビジュアルリグレッション（`visual-pages.spec.ts`）で撮影するページ一覧。
 *
 * 記事とタグはソース（`src/pages/`）から動的に列挙し、記事やタグを追加したときに
 * 撮影対象から漏れないようにする。列挙結果がビルド後の sitemap と一致することは
 * spec 側で検証する（列挙ロジックの誤りもそこで検出する）。
 */
export interface SitePage {
  /** テスト名に使う表示名。 */
  label: string;
  /** `page.goto()` に渡すパス。 */
  route: string;
  /** スナップショット名のパス要素（例: `['posts', 'nespresso-mold']`）。 */
  snapshotPath: string[];
  /** sitemap に載るページかどうか（404 は載らない）。 */
  inSitemap: boolean;
}

const pagesDir = fileURLToPath(new URL('../../../src/pages/', import.meta.url));
const postsDir = path.join(pagesDir, 'posts');

/** `src/pages/` 配下の `.md` を再帰的に列挙する（`.obsidian` などのドットディレクトリは除外）。 */
function listMarkdownFiles(dir: string): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith('.'))
    .flatMap((entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return listMarkdownFiles(fullPath);
      }
      return entry.name.endsWith('.md') ? [fullPath] : [];
    });
}

function unquote(value: string): string {
  return value.trim().replace(/^(['"])(.*)\1$/, '$2');
}

/**
 * frontmatter の `tags` を読み取る。
 *
 * ブロック形式（`tags:` + `  - タグ`）とフロー形式（`tags: [a, b]`）に対応する。
 * 値が空の `tags:` は、タグページと同様にタグなしとして扱う。
 */
export function parseFrontmatterTags(markdown: string): string[] {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown)?.[1];
  if (!frontmatter) {
    return [];
  }

  const lines = frontmatter.split(/\r?\n/);
  const tagsIndex = lines.findIndex((line) => /^tags:/.test(line));
  if (tagsIndex === -1) {
    return [];
  }

  const inlineValue = lines[tagsIndex]?.slice('tags:'.length).trim() ?? '';
  if (inlineValue.startsWith('[')) {
    return inlineValue
      .replace(/^\[|\]$/g, '')
      .split(',')
      .map(unquote)
      .filter(Boolean);
  }

  const tags: string[] = [];
  for (const line of lines.slice(tagsIndex + 1)) {
    const item = /^\s+-\s+(.+)$/.exec(line);
    if (!item?.[1]) {
      break;
    }
    tags.push(unquote(item[1]));
  }
  return tags;
}

/** `src/pages/posts/*.md`（`template/` などのサブディレクトリと `_` 始まりを除く）。 */
function listPostSlugs(): string[] {
  return fs
    .readdirSync(postsDir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith('.md') &&
        !entry.name.startsWith('_'),
    )
    .map((entry) => entry.name.replace(/\.md$/, ''))
    .sort();
}

/** タグページ（`src/pages/tags/[tag].astro`）と同じく `src/pages/**\/*.md` からタグを集める。 */
function listTags(): string[] {
  const tags = listMarkdownFiles(pagesDir).flatMap((file) =>
    parseFrontmatterTags(fs.readFileSync(file, 'utf-8')),
  );
  return [...new Set(tags)].sort();
}

export const sitePages: SitePage[] = [
  {
    label: 'ホーム',
    route: routes.home,
    snapshotPath: ['home'],
    inSitemap: true,
  },
  {
    label: 'About',
    route: routes.about,
    snapshotPath: ['about'],
    inSitemap: true,
  },
  {
    label: 'Dreamhouse',
    route: '/dreamhouse',
    snapshotPath: ['dreamhouse'],
    inSitemap: true,
  },
  ...listPostSlugs().map((slug) => ({
    label: `記事 ${slug}`,
    route: `/posts/${slug}`,
    snapshotPath: ['posts', slug],
    inSitemap: true,
  })),
  ...listTags().map((tag) => ({
    label: `タグ ${tag}`,
    route: `${routes.tagsBase}${encodeURIComponent(tag)}`,
    snapshotPath: ['tags', tag],
    inSitemap: true,
  })),
  {
    label: '404',
    route: routes.notFound,
    snapshotPath: ['404'],
    inSitemap: false,
  },
];
