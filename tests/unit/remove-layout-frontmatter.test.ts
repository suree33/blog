import { describe, expect, test } from 'vitest';
import { removeLayoutFrontmatter } from '../../src/lib/remove-layout-frontmatter';

describe('removeLayoutFrontmatter', () => {
  test('末尾の layout 行を空行を残さず除去する', () => {
    const source = '---\ntitle: Example\nlayout: ./Post.astro\n---\n\n# Body\n';

    expect(removeLayoutFrontmatter(source)).toBe(
      '---\ntitle: Example\n---\n\n# Body\n',
    );
  });

  test('他の項目に挟まれた layout 行を除去する', () => {
    const source =
      '---\ntitle: Example\nlayout: ./Post.astro\ntags: []\n---\n\n# Body\n';

    expect(removeLayoutFrontmatter(source)).toBe(
      '---\ntitle: Example\ntags: []\n---\n\n# Body\n',
    );
  });

  test('layout のない frontmatter は変更しない', () => {
    const source = '---\ntitle: Example\n---\n\n# Body\n';

    expect(removeLayoutFrontmatter(source)).toBe(source);
  });

  test('frontmatter のない Markdown は変更しない', () => {
    const source = '# Body\n\nNo frontmatter\n';

    expect(removeLayoutFrontmatter(source)).toBe(source);
  });

  test('本文にだけ現れる layout 行は保持する', () => {
    const source =
      '---\ntitle: Example\n---\n\n# Body\n\nlayout: ./Example.astro\n';

    expect(removeLayoutFrontmatter(source)).toBe(source);
  });
});
