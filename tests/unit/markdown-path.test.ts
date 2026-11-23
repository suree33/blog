import { describe, expect, test } from 'vitest';
import { toMarkdownPath } from '../../src/lib/markdown-path';

describe('toMarkdownPath', () => {
  test.each([
    ['/', '/index.md'],
    ['/about/', '/about.md'],
    ['/about', '/about.md'],
    ['/posts/foo/', '/posts/foo.md'],
    ['/posts/foo', '/posts/foo.md'],
    ['/posts/example/nested', '/posts/example/nested.md'],
    ['/tags/', '/tags.md'],
    ['/tags/%E7%94%9F%E6%B4%BB/', '/tags/%E7%94%9F%E6%B4%BB.md'],
  ])('maps page pathname %s to %s', (pathname, markdownPath) => {
    expect(toMarkdownPath(pathname)).toBe(markdownPath);
  });

  test.each([
    ['/robots.txt', '/robots.txt.md'],
    ['/posts/example.html', '/posts/example.html.md'],
  ])(
    'preserves the original mechanical mapping for non-page pathname %s',
    (pathname, markdownPath) => {
      expect(toMarkdownPath(pathname)).toBe(markdownPath);
    },
  );

  test('query strings and fragments are outside the pathname input', () => {
    const url = new URL(
      'https://example.com/posts/example/?utm_source=feed#first-heading',
    );

    expect(toMarkdownPath(url.pathname)).toBe('/posts/example.md');
  });
});
