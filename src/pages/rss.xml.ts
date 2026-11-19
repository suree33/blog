import rss from '@astrojs/rss';
import type { APIRoute, MarkdownInstance } from 'astro';
import config from '@/config.json';
import sanitizeHtml from 'sanitize-html';

interface RssFrontmatter {
  title?: string;
  pubDate?: string;
  description?: string;
}

/**
 * Determines whether a Markdown post contains both `title` and `pubDate` frontmatter required for RSS items.
 *
 * @param post - The Markdown instance to check
 * @returns `true` if the post's frontmatter contains both `title` and `pubDate`, `false` otherwise.
 */
function hasRequiredFrontmatter(
  post: MarkdownInstance<RssFrontmatter>,
): post is MarkdownInstance<
  RssFrontmatter & { title: string; pubDate: string }
> {
  return Boolean(post.frontmatter.title && post.frontmatter.pubDate);
}

/**
 * Markdown 記事一覧から RSS フィードを生成する `/rss.xml` エンドポイント。
 */
export const GET = (async () => {
  const posts = await Promise.all(
    Object.values(
      import.meta.glob<MarkdownInstance<RssFrontmatter>>('./**/*.md', {
        eager: true,
      }),
    ),
  );

  const items = await Promise.all(
    posts.filter(hasRequiredFrontmatter).map(async (post) => ({
      title: post.frontmatter.title,
      description: post.frontmatter.description || '',
      pubDate: new Date(post.frontmatter.pubDate),
      link: post.url,
      content: sanitizeHtml(await post.compiledContent(), {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
        transformTags: {
          img: (tagName, attribs) => ({
            tagName,
            attribs: {
              ...attribs,
              ...(attribs.src && {
                src: new URL(attribs.src, config.url).href,
              }),
            },
          }),
        },
      }),
    })),
  );

  return rss({
    title: config.siteName,
    description: config.description,
    site: config.url,
    stylesheet: '/rss/styles.xsl',
    items,
    customData: `<language>ja-jp</language>`,
  });
}) satisfies APIRoute;
