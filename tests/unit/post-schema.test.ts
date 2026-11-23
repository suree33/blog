import { describe, expect, test } from 'vitest';
import { collections } from '../../src/content.config';
import type { PostFrontmatter } from '../../src/types/Post';

const schema = collections.posts.schema;
if (!schema || typeof schema === 'function') {
  throw new Error('Expected a static posts schema');
}

describe('posts collection schema', () => {
  const validPost = {
    title: 'Post title',
    pubDate: '2026-01-01',
    description: 'Post description',
    tags: ['Astro'],
  };

  test('preserves populated init-post fields', () => {
    const post: PostFrontmatter = schema.parse(validPost);
    expect(post).toEqual(validPost);
  });

  test('normalizes a YAML date without changing the other fields', () => {
    const post: PostFrontmatter = schema.parse({
      ...validPost,
      pubDate: new Date('2026-01-01'),
    });
    expect(post).toEqual(validPost);
  });

  test.each([
    ['title', undefined],
    ['title', null],
    ['title', '  '],
    ['description', undefined],
    ['description', null],
    ['description', '  '],
    ['tags', undefined],
    ['tags', null],
    ['tags', []],
    ['tags', ['  ']],
    ['pubDate', undefined],
    ['pubDate', '  '],
  ])('rejects missing or blank %s (%j)', (field, value) => {
    const { error } = schema.safeParse({ ...validPost, [field]: value });
    expect(error?.issues).toContainEqual(
      expect.objectContaining({ path: expect.arrayContaining([field]) }),
    );
  });

  test.each(['image', 'ogimage'])('requires alt in a %s object', (field) => {
    const src = '/photo.png';
    const image = { src, alt: 'A mountain' };
    expect(schema.parse({ ...validPost, [field]: image })).toMatchObject({
      [field]: image,
    });
    for (const input of [{ src }, { src, alt: '  ' }]) {
      const { error } = schema.safeParse({ ...validPost, [field]: input });
      expect(error?.message).toContain('"alt"');
    }
  });

  test('preserves a URL-only ogimage', () => {
    expect(schema.parse({ ...validPost, ogimage: '/photo.png' })).toMatchObject(
      {
        ogimage: '/photo.png',
      },
    );
  });

  test.each([
    { title: 42, pubDate: '2026-01-01' },
    { title: 'Title', pubDate: null },
    { title: 'Title', pubDate: '2026-01-01', description: 42 },
    { title: 'Title', pubDate: '2026-01-01', tags: [42] },
  ])('rejects invalid field types: %j', (post) => {
    expect(schema.safeParse({ ...validPost, ...post }).success).toBe(false);
  });
});
