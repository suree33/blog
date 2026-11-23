import type { APIRoute } from 'astro';
import { buildSiteMarkdown, markdownResponse } from '@lib/agent-markdown';
import { getPublishedPosts, getPublishedStandalonePages } from '@lib/posts';

/**
 * トップページ `/` の Markdown 版。`/llms.txt` も同じ内容を返す。
 */
export const GET = (async ({ site }) => {
  if (!site) {
    throw new Error('`site` must be configured to build /index.md');
  }

  const pages = (await getPublishedStandalonePages()).flatMap(
    ({ frontmatter, url }) =>
      url
        ? [
            {
              title:
                (frontmatter as { pageTitle?: string }).pageTitle ??
                frontmatter.title,
              url,
            },
          ]
        : [],
  );

  return markdownResponse(
    buildSiteMarkdown({ site, posts: await getPublishedPosts(), pages }),
  );
}) satisfies APIRoute;
