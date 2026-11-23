import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('immutable caching is restricted to fingerprinted Astro assets', async () => {
  const headers = await readFile(
    new URL('../../public/_headers', import.meta.url),
    'utf8',
  );
  assert.equal(
    headers.trim(),
    '/_astro/*\n  Cache-Control: public, max-age=31536000, immutable',
  );
});
