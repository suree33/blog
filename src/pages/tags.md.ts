import type { APIRoute } from 'astro';
import { buildTagIndexMarkdown, markdownResponse } from '@lib/agent-markdown';
import { getPublishedTags } from '@lib/tags';

/**
 * タグ一覧 `/tags/` の Markdown 版。並び順は HTML と同じ（記事数の多い順、同数はタグ名順）。
 */
export const GET = (async ({ site }) => {
  if (!site) {
    throw new Error('`site` must be configured to build /tags.md');
  }

  const tags = (await getPublishedTags()).sort(
    (a, b) =>
      b.posts.length - a.posts.length || a.tag.localeCompare(b.tag, 'ja'),
  );

  return markdownResponse(buildTagIndexMarkdown({ site, tags }));
}) satisfies APIRoute;
