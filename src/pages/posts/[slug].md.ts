import type { APIRoute, GetStaticPaths } from 'astro';
import { removeLayoutFrontmatter } from '@lib/remove-layout-frontmatter';
import { getPublishedPosts } from '@lib/posts';
import { readFile } from 'node:fs/promises';

/**
 * Markdown 記事ごとの raw Markdown を返す `/posts/[slug].md` エンドポイントを静的生成する。
 */
export const getStaticPaths = (async () =>
  Promise.all(
    (await getPublishedPosts()).map(async (post) => ({
      params: { slug: post.id },
      props: {
        body: removeLayoutFrontmatter(
          await readFile(post.filePath ?? '', 'utf8'),
        ),
      },
    })),
  )) satisfies GetStaticPaths;

export const GET = (({ props }) => {
  const { body } = props as { body: string };

  return new Response(body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
    },
  });
}) satisfies APIRoute;
