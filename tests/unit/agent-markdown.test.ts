import { describe, expect, test } from 'vitest';
import {
  buildLlmsTxt,
  buildSiteMarkdown,
  buildTagIndexMarkdown,
  buildTagMarkdown,
  toMarkdownPath,
} from '../../src/lib/agent-markdown';

const site = new URL('https://example.com/');
const post = (
  title: string,
  pubDate: string,
  url: string,
  description?: string,
) => ({
  frontmatter: { title, pubDate, description },
  url,
});

describe('toMarkdownPath', () => {
  test.each([
    ['/', '/index.md'],
    ['/about/', '/about.md'],
    ['/posts/foo/', '/posts/foo.md'],
    ['/tags/', '/tags.md'],
    ['/tags/%E7%94%9F%E6%B4%BB/', '/tags/%E7%94%9F%E6%B4%BB.md'],
  ])('%s -> %s', (path, markdownPath) => {
    expect(toMarkdownPath(path)).toBe(markdownPath);
  });
});

describe('buildSiteMarkdown', () => {
  test('lists posts newest first and pages with Markdown URLs', () => {
    const markdown = buildSiteMarkdown({
      site,
      posts: [
        post('Old', '2024-01-01', '/posts/old/', 'Old post'),
        post('New', '2025-01-01', '/posts/new/'),
      ],
      pages: [{ title: 'About', url: '/about/' }],
    });

    expect(markdown).toMatch(/^# .+\n\n> .+\n/);
    expect(markdown).toContain(
      [
        '## 記事',
        '',
        '- [New](https://example.com/posts/new.md)',
        '- [Old](https://example.com/posts/old.md): Old post',
      ].join('\n'),
    );
    expect(markdown).toContain(
      [
        '## ページ',
        '',
        '- [About](https://example.com/about.md)',
        '- [タグ一覧](https://example.com/tags.md)',
      ].join('\n'),
    );
    expect(markdown).toContain('- [RSS フィード](https://example.com/rss.xml)');
  });
});

describe('buildLlmsTxt', () => {
  test('links list pages instead of individual posts', () => {
    const text = buildLlmsTxt({
      site,
      pages: [{ title: 'About', url: '/about/' }],
    });

    expect(text).toMatch(/^# .+\n\n> .+\n/);
    expect(text).toContain(
      [
        '## ページ',
        '',
        '- [記事一覧](https://example.com/index.md)',
        '- [タグ一覧](https://example.com/tags.md)',
        '- [About](https://example.com/about.md)',
      ].join('\n'),
    );
    expect(text).not.toContain('/posts/');
    expect(text).toContain('- [RSS フィード](https://example.com/rss.xml)');
  });
});

describe('tag Markdown', () => {
  test('tag index links each tag Markdown with its post count', () => {
    expect(
      buildTagIndexMarkdown({
        site,
        tags: [{ tag: '生活', posts: [{}, {}] }],
      }),
    ).toBe(
      '# タグ一覧\n\n- [生活](https://example.com/tags/%E7%94%9F%E6%B4%BB.md) (2件)\n',
    );
  });

  test('tag page lists its posts newest first', () => {
    expect(
      buildTagMarkdown({
        site,
        tag: 'Astro',
        posts: [
          post('Old', '2024-01-01', '/posts/old/'),
          post('Page', '2025-01-01', '/dreamhouse/', 'Standalone'),
        ],
      }),
    ).toBe(
      [
        '# Astroのタグが付いた記事',
        '',
        '- [Page](https://example.com/dreamhouse.md): Standalone',
        '- [Old](https://example.com/posts/old.md)',
        '',
      ].join('\n'),
    );
  });
});
