import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import config from '@/config.json';
import sanitizeHtml from 'sanitize-html';
import { getPublishedPosts, getPublishedStandalonePages } from '@lib/posts';

export const GET = (async () => {
  const posts = await getPublishedPosts();
  const pages = await getPublishedStandalonePages();
  return rss({
    title: config.siteName,
    description: config.description,
    site: config.url,
    stylesheet: '/rss/styles.xsl',
    items: [
      ...(await Promise.all(
        pages
          .filter(({ frontmatter }) => frontmatter.title && frontmatter.pubDate)
          .map(async (post) => ({
            title: post.frontmatter.title,
            description: post.frontmatter.description || '',
            pubDate: new Date(post.frontmatter.pubDate),
            link: post.url,
            content: sanitizeHtml(await post.compiledContent()),
          })),
      )),
      ...posts.map((post) => ({
        title: post.data.title,
        description: post.data.description || '',
        pubDate: new Date(post.data.pubDate),
        link: post.url,
        content: sanitizeHtml(post.rendered?.html ?? ''),
      })),
    ],
    customData: `<language>ja-jp</language>`,
  });
}) satisfies APIRoute;
