import type { APIRoute, GetStaticPaths } from 'astro';

const rawPostModules = import.meta.glob<string>('./*.md', {
  eager: true,
  import: 'default',
  query: '?raw',
});

interface RawMarkdownPost {
  slug: string;
  body: string;
}

const removeLayoutFrontmatter = (body: string) => {
  if (!body.startsWith('---\n')) {
    return body;
  }

  const frontmatterEndIndex = body.indexOf('\n---', 4);

  if (frontmatterEndIndex === -1) {
    return body;
  }

  const frontmatter = body.slice(4, frontmatterEndIndex + 1);
  const rest = body.slice(frontmatterEndIndex + 1);
  const frontmatterWithoutLayout = frontmatter.replace(/^layout:[^\n]*\n/m, '');

  return `---\n${frontmatterWithoutLayout}${rest}`;
};

const rawPosts: RawMarkdownPost[] = Object.entries(rawPostModules).map(
  ([path, body]) => ({
    slug: path.replace('./', '').replace(/\.md$/, ''),
    body: removeLayoutFrontmatter(body),
  }),
);

/**
 * Markdown 記事ごとの raw Markdown を返す `/posts/[slug].md` エンドポイントを静的生成する。
 */
export const getStaticPaths = (() =>
  rawPosts.map((post) => ({
    params: { slug: post.slug },
    props: { body: post.body },
  }))) satisfies GetStaticPaths;

export const GET = (({ props }) => {
  const { body } = props as { body: string };

  return new Response(body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
    },
  });
}) satisfies APIRoute;
