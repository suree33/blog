import type { CollectionEntry } from 'astro:content';

export type PostFrontmatter = CollectionEntry<'posts'>['data'];

export type StandalonePageFrontmatter = Omit<
  PostFrontmatter,
  'description' | 'tags' | 'pubDate' | 'updatedDate'
> &
  Partial<Pick<PostFrontmatter, 'description' | 'tags'>> & {
    pubDate?: PostFrontmatter['pubDate'];
    updatedDate?: PostFrontmatter['updatedDate'] | null;
  };

export interface Post {
  frontmatter: Pick<
    StandalonePageFrontmatter,
    'title' | 'description' | 'tags' | 'image'
  > &
    Pick<PostFrontmatter, 'pubDate'>;
  url?: string;
}
