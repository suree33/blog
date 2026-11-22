import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { test, expect } from '@playwright/test';

test('built pages do not load Google Analytics or its worker runtime', async () => {
  const files = await readdir('dist', { recursive: true });
  const pages = files.filter((file) => file.endsWith('.html'));

  expect(pages.length).toBeGreaterThan(0);
  expect(files.some((file) => file.startsWith('~partytown'))).toBe(false);

  for (const file of pages) {
    const html = await readFile(path.join('dist', file), 'utf8');
    expect(html, file).not.toMatch(
      /googletagmanager\.com|google-analytics\.com|text\/partytown|G-8ZCMEEKWF9|window\.dataLayer/,
    );
  }
});
