import { describe, expect, test } from 'vitest';
import { collections } from '../../src/content.config';
import type { PostFrontmatter } from '../../src/types/Post';

const schema = collections.posts.schema;
if (!schema || typeof schema === 'function') {
  throw new Error('Expected a static posts schema');
}

describe('posts collection schema', () => {
  test('preserves populated init-post fields', () => {
    const post: PostFrontmatter = schema.parse({
      title: 'Post title',
      pubDate: '2026-01-01',
      description: 'Post description',
      tags: ['Astro'],
    });
    expect(post).toEqual({
      title: 'Post title',
      pubDate: '2026-01-01',
      description: 'Post description',
      tags: ['Astro'],
    });
  });

  test('normalizes blank YAML fields without nullable consumer types', () => {
    const post: PostFrontmatter = schema.parse({
      title: null,
      pubDate: new Date('2026-01-01'),
      description: null,
      tags: null,
    });
    expect(post).toEqual({
      title: '',
      pubDate: '2026-01-01',
      description: undefined,
      tags: undefined,
    });
  });

  test('accepts absent init-post text fields', () => {
    expect(schema.parse({ pubDate: '2026-01-01' })).toEqual({
      title: '',
      pubDate: '2026-01-01',
    });
  });

  test.each([
    { title: 42, pubDate: '2026-01-01' },
    { title: 'Title', pubDate: null },
    { title: 'Title', pubDate: '2026-01-01', description: 42 },
    { title: 'Title', pubDate: '2026-01-01', tags: [42] },
  ])('rejects invalid field types: %j', (post) => {
    expect(schema.safeParse(post).success).toBe(false);
  });
});
