import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { load } from 'cheerio';
import { expect, test } from '../fixtures/test';

const origin = 'https://sur33.com';
const dist = resolve('dist');
const htmlFiles = readdirSync(dist, { recursive: true })
  .map(String)
  .filter((file) => file.endsWith('.html') && !file.startsWith('~partytown/'));
const pagePaths = new Set(
  htmlFiles
    .filter((file) => file.endsWith('/index.html') || file === 'index.html')
    .map((file) => `/${file.replace(/index\.html$/, '')}`),
);

test('built internal page links use canonical URLs without redirects', async ({
  request,
}) => {
  const targets = new Set<string>();
  const check = (href: string, source: string) => {
    const url = new URL(href, `${origin}${source}`);
    if (url.origin !== origin) return;
    const canonical = `${url.pathname.replace(/\/$/, '')}/`;
    if (!pagePaths.has(decodeURI(canonical))) return;
    expect(url.pathname, `${source}: ${href}`).toBe(canonical);
    targets.add(url.pathname);
  };

  for (const file of htmlFiles) {
    const source = `/${file.replace(/index\.html$/, '')}`;
    const $ = load(readFileSync(resolve(dist, file), 'utf8'));
    $('a[href]').each((_, anchor) => {
      const href = $(anchor).attr('href');
      if (href) check(href, source);
    });
  }
  for (const file of ['rss.xml', 'sitemap-0.xml']) {
    const $ = load(readFileSync(resolve(dist, file), 'utf8'), { xml: true });
    $('link, loc').each((_, element) => {
      const href = $(element).text();
      if (href) check(href, `/${file}`);
    });
    $('content\\:encoded').each((_, element) => {
      const content = load($(element).text());
      content('a[href]').each((_, anchor) => {
        const href = content(anchor).attr('href');
        if (href) check(href, '/rss.xml');
      });
    });
  }

  expect(targets.size).toBeGreaterThan(0);
  for (const target of targets) {
    const response = await request.get(target, { maxRedirects: 0 });
    expect(response.status(), target).toBe(200);
  }
});
