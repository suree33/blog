import type { APIRoute, GetStaticPaths } from 'astro';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { markdownResponse } from '@lib/agent-markdown';
import { getPublishedStandalonePages } from '@lib/posts';
import { removeLayoutFrontmatter } from '@lib/remove-layout-frontmatter';

/**
 * `src/pages/*.md` の固定ページごとの raw Markdown を返す `/[page].md` エンドポイントを静的生成する。
 */
export const getStaticPaths = (async () =>
  Promise.all(
    (await getPublishedStandalonePages()).map(async (page) => ({
      params: { page: basename(page.file, '.md') },
      props: {
        body: removeLayoutFrontmatter(await readFile(page.file, 'utf8')),
      },
    })),
  )) satisfies GetStaticPaths;

export const GET = (({ props }) =>
  markdownResponse((props as { body: string }).body)) satisfies APIRoute;
