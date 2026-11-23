import { getPublishedPosts, getPublishedStandalonePages } from '@lib/posts';
import type { Post } from '@/types/Post';

export const tagIndexPath = '/tags/';

export function getTagPath(tag: string): string {
  return `${tagIndexPath}${encodeURIComponent(tag)}/`;
}

export function groupPostsByTag<
  T extends { frontmatter: { tags?: readonly string[] | null } },
>(posts: readonly T[]): { tag: string; posts: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const post of posts) {
    for (const tag of new Set(post.frontmatter.tags)) {
      groups.set(tag, [...(groups.get(tag) ?? []), post]);
    }
  }
  return [...groups].map(([tag, posts]) => ({ tag, posts }));
}

export async function getPublishedTags() {
  const posts = [
    ...(await getPublishedStandalonePages()),
    ...(await getPublishedPosts()),
  ].filter(
    (post): post is typeof post & Post =>
      post.frontmatter.pubDate !== undefined,
  );
  return groupPostsByTag(posts);
}
