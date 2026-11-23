import type { APIRoute, GetStaticPaths } from 'astro';
import { buildTagMarkdown, markdownResponse } from '@lib/agent-markdown';
import { getPublishedTags } from '@lib/tags';

/**
 * タグごとの記事一覧 `/tags/[tag]/` の Markdown 版を `/tags/[tag].md` として静的生成する。
 */
export const getStaticPaths = (async () =>
  (await getPublishedTags()).map(({ tag, posts }) => ({
    params: { tag },
    props: { tag, posts },
  }))) satisfies GetStaticPaths;

export const GET = (({ site, props }) => {
  if (!site) {
    throw new Error('`site` must be configured to build tag Markdown');
  }

  const { tag, posts } = props as Awaited<
    ReturnType<typeof getPublishedTags>
  >[number];

  return markdownResponse(
    buildTagMarkdown({
      site,
      tag,
      posts: posts.flatMap((post) =>
        post.url ? [{ ...post, url: post.url }] : [],
      ),
    }),
  );
}) satisfies APIRoute;
