import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { render } from 'astro:content';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import config from '@/config.json';
import sanitizeHtml from 'sanitize-html';
import { getPublishedPosts, getPublishedStandalonePages } from '@lib/posts';

const sanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
  transformTags: {
    img: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        ...(attribs.src && { src: new URL(attribs.src, config.url).href }),
      },
    }),
  },
};

export const GET = (async () => {
  const posts = await getPublishedPosts();
  const pages = await getPublishedStandalonePages();
  const container = await AstroContainer.create();
  const pageItems = await Promise.all(
    pages.map(async (page) => {
      const { title, description, pubDate } = page.frontmatter;
      if (!title || !pubDate) return;

      return {
        title,
        description: description || '',
        pubDate: new Date(pubDate),
        link: page.url,
        content: sanitizeHtml(await page.compiledContent(), sanitizeOptions),
      };
    }),
  );
  return rss({
    title: config.siteName,
    description: config.description,
    site: config.url,
    stylesheet: '/rss/styles.xsl',
    items: [
      ...pageItems.filter((item) => item !== undefined),
      ...(await Promise.all(
        posts.map(async (post) => {
          const { Content } = await render(post);
          const html = await container.renderToString(Content);
          return {
            title: post.data.title,
            description: post.data.description || '',
            pubDate: new Date(post.data.pubDate),
            link: post.url,
            content: sanitizeHtml(html, sanitizeOptions),
          };
        }),
      )),
    ],
    customData: `<language>ja-jp</language>`,
  });
}) satisfies APIRoute;
