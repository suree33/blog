import { describe, expect, test } from 'vitest';
import { sortPostsByDateDescending } from '../../src/lib/posts';

describe('sortPostsByDateDescending', () => {
  test('sorts newest first without mutating the input and preserves ties', () => {
    const posts = [
      { frontmatter: { pubDate: '2024-01-01' }, id: 'old' },
      { frontmatter: { pubDate: '2026-01-01' }, id: 'new' },
      { frontmatter: { pubDate: '2026-01-01' }, id: 'tie' },
    ];
    const original = [...posts];
    const sorted = sortPostsByDateDescending(Object.freeze(posts));
    expect(sorted.map(({ id }) => id)).toEqual(['new', 'tie', 'old']);
    expect(posts).toEqual(original);
    expect(sorted[0]).toBe(posts[1]);
    expect(sorted).not.toBe(posts);
  });

  test('returns a fresh empty list', () => {
    const posts: { frontmatter: { pubDate?: string } }[] = [];
    expect(sortPostsByDateDescending(posts)).toEqual([]);
    expect(sortPostsByDateDescending(posts)).not.toBe(posts);
  });

  test.each([undefined, '', 'invalid'])(
    'preserves NaN comparator behavior for %s dates',
    (pubDate) => {
      const posts = [
        { frontmatter: { pubDate: '2024-01-01' } },
        { frontmatter: { pubDate } },
        { frontmatter: { pubDate: '2026-01-01' } },
      ];
      expect(sortPostsByDateDescending(posts)).toEqual(posts);
    },
  );
});
