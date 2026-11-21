import { getCollection } from 'astro:content';
import type { MarkdownInstance } from 'astro';
import type { StandalonePageFrontmatter } from '@/types/Post';

export async function getPublishedPosts() {
  const posts = await getCollection('posts', ({ data }) => data.draft !== true);
  return posts
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((post) => ({
      ...post,
      frontmatter: post.data,
      url: `/posts/${post.id}`,
    }));
}

export async function getPublishedStandalonePages() {
  const pages = Object.values(
    import.meta.glob<MarkdownInstance<StandalonePageFrontmatter>>(
      '../pages/*.md',
      { eager: true },
    ),
  );
  return pages.filter(({ frontmatter }) => frontmatter.draft !== true);
}
