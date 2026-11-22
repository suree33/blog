import { markdownToHtml } from 'satteri';
import { describe, expect, test } from 'vitest';
import { requireImageAlt } from '../../src/lib/markdown/require-image-alt';

const directory = new URL('file:///blog/posts/');
const fileURL = new URL('post.md', directory);
const mdastPlugins = [requireImageAlt(directory)];

describe('required Markdown image alt text', () => {
  test.each([
    '![](photo.png)',
    '![  ](photo.png)',
    '![][photo]\n\n[photo]: photo.png',
  ])('rejects %s with its file and line', (image) => {
    expect(() =>
      markdownToHtml(`Introduction\n\n${image}`, { fileURL, mdastPlugins }),
    ).toThrow(
      '/blog/posts/post.md (Markdown line 3): Markdown images need non-empty alt text.',
    );
  });

  test('accepts descriptive alt text and ignores Markdown examples in code', () => {
    const { html } = markdownToHtml(
      '![A mountain](photo.png)\n\n`![](example.png)`',
      {
        fileURL,
        mdastPlugins,
      },
    );
    expect(html).toContain('alt="A mountain"');
  });

  test('does not enforce post requirements outside the configured directories', () => {
    const { html } = markdownToHtml('![](decoration.png)', {
      fileURL: new URL('../standalone.md', directory),
      mdastPlugins,
    });
    expect(html).toContain('alt=""');
  });
});
