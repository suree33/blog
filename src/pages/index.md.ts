import type { APIRoute } from 'astro';
import { buildSiteMarkdown, markdownResponse } from '@lib/agent-markdown';
import { getPublishedPosts, getPublishedStandalonePageLinks } from '@lib/posts';

/**
 * トップページ `/` の Markdown 版。記事一覧を含む。
 */
export const GET = (async ({ site }) => {
  if (!site) {
    throw new Error('`site` must be configured to build /index.md');
  }

  return markdownResponse(
    buildSiteMarkdown({
      site,
      posts: await getPublishedPosts(),
      pages: await getPublishedStandalonePageLinks(),
    }),
  );
}) satisfies APIRoute;
