import assert from 'node:assert/strict';
import test from 'node:test';
import { removeLayoutFrontmatter } from '../../src/lib/remove-layout-frontmatter.ts';

test('removes a final layout field without leaving a blank line', () => {
  const source = '---\ntitle: Example\nlayout: ./Post.astro\n---\n\n# Body\n';

  assert.equal(
    removeLayoutFrontmatter(source),
    '---\ntitle: Example\n---\n\n# Body\n',
  );
});

test('removes a layout field between other fields', () => {
  const source =
    '---\ntitle: Example\nlayout: ./Post.astro\ntags: []\n---\n\n# Body\n';

  assert.equal(
    removeLayoutFrontmatter(source),
    '---\ntitle: Example\ntags: []\n---\n\n# Body\n',
  );
});

test('preserves frontmatter without a layout field', () => {
  const source = '---\ntitle: Example\n---\n\n# Body\n';

  assert.equal(removeLayoutFrontmatter(source), source);
});

test('preserves Markdown without frontmatter', () => {
  const source = '# Body\n\nNo frontmatter\n';

  assert.equal(removeLayoutFrontmatter(source), source);
});

test('preserves a layout line that appears only in the body', () => {
  const source =
    '---\ntitle: Example\n---\n\n# Body\n\nlayout: ./Example.astro\n';

  assert.equal(removeLayoutFrontmatter(source), source);
});
