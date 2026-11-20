import { getCollection } from 'astro:content';
import type { MarkdownInstance } from 'astro';
import type { PostFrontmatter } from '@/types/Post';

export async function getPublishedPosts() {
  const posts = await getCollection('posts', ({ data }) => data.draft !== true);
  return posts
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((post) => ({
      ...post,
      frontmatter: post.data,
      url: `/posts/${post.id}/`,
    }));
}

export async function getPublishedStandalonePages() {
  const pages = Object.values(
    import.meta.glob<MarkdownInstance<PostFrontmatter>>('../pages/*.md', {
      eager: true,
    }),
  );
  return pages
    .filter(({ frontmatter }) => frontmatter.draft !== true)
    .map((page) => ({
      ...page,
      url: page.url && !page.url.endsWith('/') ? `${page.url}/` : page.url,
    }));
}
