import type { CollectionEntry } from 'astro:content';

export type PostFrontmatter = CollectionEntry<'posts'>['data'];

export type StandalonePageFrontmatter = Omit<
  PostFrontmatter,
  'pubDate' | 'updatedDate'
> & {
  pubDate?: PostFrontmatter['pubDate'];
  updatedDate?: PostFrontmatter['updatedDate'] | null;
};

export interface Post {
  frontmatter: Pick<
    PostFrontmatter,
    'title' | 'pubDate' | 'description' | 'tags' | 'image'
  >;
  url?: string;
}
