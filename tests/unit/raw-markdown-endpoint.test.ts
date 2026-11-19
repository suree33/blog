import { readFile } from 'node:fs/promises';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getPublishedPosts } from '../../src/lib/posts';
import { getStaticPaths } from '../../src/pages/posts/[slug].md.ts';

vi.mock('../../src/lib/posts', () => ({ getPublishedPosts: vi.fn() }));
vi.mock('node:fs/promises', () => ({ readFile: vi.fn() }));

const data = { title: 'Published post', pubDate: '2026-01-01' };
const post = {
  id: 'published-post',
  collection: 'posts' as const,
  data,
  frontmatter: data,
  url: '/posts/published-post',
};

describe('raw Markdown static paths', () => {
  beforeEach(() => vi.resetAllMocks());

  test('reads the published source and removes only its layout line', async () => {
    vi.mocked(getPublishedPosts).mockResolvedValue([
      { ...post, filePath: 'post.md' },
    ]);
    vi.mocked(readFile).mockResolvedValue(
      '---\nlayout: old-layout\ntitle: Published post\n---\nBody\n',
    );

    expect(await getStaticPaths()).toEqual([
      {
        params: { slug: 'published-post' },
        props: { body: '---\ntitle: Published post\n---\nBody\n' },
      },
    ]);
    expect(readFile).toHaveBeenCalledWith('post.md', 'utf8');
  });

  test('generates no paths for an empty published collection', async () => {
    vi.mocked(getPublishedPosts).mockResolvedValue([]);
    expect(await getStaticPaths()).toEqual([]);
    expect(readFile).not.toHaveBeenCalled();
  });

  test('identifies the post whose source filePath is missing', async () => {
    vi.mocked(getPublishedPosts).mockResolvedValue([post]);
    await expect(getStaticPaths()).rejects.toThrow(
      'Missing source filePath for post "published-post"',
    );
    expect(readFile).not.toHaveBeenCalled();
  });

  test('propagates source read failures', async () => {
    vi.mocked(getPublishedPosts).mockResolvedValue([
      { ...post, filePath: 'post.md' },
    ]);
    vi.mocked(readFile).mockRejectedValue(new Error('Source unavailable'));
    await expect(getStaticPaths()).rejects.toThrow('Source unavailable');
  });
});
