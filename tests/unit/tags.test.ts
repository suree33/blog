import { describe, expect, test } from 'vitest';
import { getTagPath, groupPostsByTag } from '../../src/lib/tags';

describe('getTagPath', () => {
  test.each([
    ['Astro', '/tags/Astro/'],
    ['ガジェット', '/tags/%E3%82%AC%E3%82%B8%E3%82%A7%E3%83%83%E3%83%88/'],
    ['100%', '/tags/100%25/'],
    ['Q&A', '/tags/Q%26A/'],
    ['UI/UX', '/tags/UI%2FUX/'],
    ['Vue 3', '/tags/Vue%203/'],
  ])('%s -> %s', (tag, path) => {
    expect(getTagPath(tag)).toBe(path);
  });
});

describe('groupPostsByTag', () => {
  test('groups posts by tag in first-seen order and skips posts without tags', () => {
    const a = { id: 'a', frontmatter: { tags: ['Astro', 'ガジェット'] } };
    const b = { id: 'b', frontmatter: { tags: ['ガジェット', 'ガジェット'] } };
    const c = { id: 'c', frontmatter: {} };
    const d = { id: 'd', frontmatter: { tags: null } };

    expect(groupPostsByTag([a, b, c, d])).toEqual([
      { tag: 'Astro', posts: [a] },
      { tag: 'ガジェット', posts: [a, b] },
    ]);
  });
});
