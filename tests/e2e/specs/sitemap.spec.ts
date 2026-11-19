import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test';
import { routes, sampleTag } from '../utils/routes';

const productionOrigin = 'https://sur33.com';
const sitemapIndex = '/sitemap-index.xml';
const sitemapNamespace = 'http://www.sitemaps.org/schemas/sitemap/0.9';

async function readSitemapLocations(
  request: APIRequestContext,
  page: Page,
  path: string,
  rootName: 'sitemapindex' | 'urlset',
): Promise<URL[]> {
  const response = await request.get(path, { maxRedirects: 0 });
  expect(response.status(), `${path} は HTTP 200 を返す`).toBe(200);
  expect(
    response.headers()['content-type'],
    `${path} の Content-Type は XML 形式である`,
  ).toMatch(/^(application|text)\/xml(?:;|$)/i);

  const { parseError, root, namespace, locations } = await page.evaluate(
    ({ xml, entryName, sitemapNamespace }) => {
      const doc = new DOMParser().parseFromString(xml, 'application/xml');
      const root = doc.documentElement;
      const entries = Array.from(root.children).filter(
        (entry) =>
          entry.localName === entryName &&
          entry.namespaceURI === sitemapNamespace,
      );

      return {
        parseError: doc.querySelector('parsererror')?.textContent ?? null,
        root: root.localName,
        namespace: root.namespaceURI,
        locations: entries.map((entry) =>
          Array.from(entry.children)
            .find(
              (child) =>
                child.localName === 'loc' &&
                child.namespaceURI === sitemapNamespace,
            )
            ?.textContent?.trim(),
        ),
      };
    },
    {
      xml: await response.text(),
      entryName: rootName === 'sitemapindex' ? 'sitemap' : 'url',
      sitemapNamespace,
    },
  );

  expect(parseError, `${path} は整形式の XML である`).toBeNull();
  expect(root, `${path} のルート要素は <${rootName}> である`).toBe(rootName);
  expect(namespace, `${path} はサイトマップの名前空間を使う`).toBe(
    sitemapNamespace,
  );
  expect(
    locations,
    `${path} にはサイトマップの項目が 1 件以上ある`,
  ).not.toHaveLength(0);

  return locations.map((location) => {
    expect(location, `${path} の各項目に空でない <loc> がある`).toBeTruthy();
    const url = new URL(location ?? '');
    expect(url.origin, `<loc> の URL「${location}」は本番オリジンを指す`).toBe(
      productionOrigin,
    );
    return url;
  });
}

test.describe('サイトマップ', () => {
  test.skip(
    ({ browserName, isMobile }) => browserName !== 'chromium' || isMobile,
    'HTTP 応答は全プロジェクトで共通',
  );

  test('インデックスと分割サイトマップに本番 URL と主要ページが含まれる', async ({
    request,
    page,
  }) => {
    const shards = await readSitemapLocations(
      request,
      page,
      sitemapIndex,
      'sitemapindex',
    );
    const pages: URL[] = [];
    for (const shard of shards) {
      const previewPath = `.${shard.pathname}${shard.search}`;
      pages.push(
        ...(await readSitemapLocations(request, page, previewPath, 'urlset')),
      );
    }

    const paths = pages.map((url) => {
      const path = url.pathname.replace(/\/$/, '') || '/';
      return `${path}${url.search}${url.hash}`;
    });
    const tagPath = `${routes.tagsBase}${encodeURIComponent(sampleTag)}`;
    for (const path of [
      routes.home,
      routes.about,
      routes.sampleArticle,
      tagPath,
    ]) {
      expect(
        paths,
        `サイトマップには主要ページ「${path}」が含まれる`,
      ).toContain(path);
    }
  });

  test('robots.txt が本番のサイトマップインデックスを案内する', async ({
    request,
  }) => {
    const response = await request.get('/robots.txt', { maxRedirects: 0 });
    expect(response.status(), 'robots.txt は HTTP 200 を返す').toBe(200);
    expect(
      response.headers()['content-type'],
      'robots.txt の Content-Type は text/plain である',
    ).toMatch(/^text\/plain(?:;|$)/i);

    const body = await response.text();
    const sitemaps = Array.from(
      body.matchAll(/^[ \t]*sitemap[ \t]*:[ \t]*([^#\r\n]+)/gim),
      ([, url]) => url.trim(),
    );
    const indexUrl = new URL(sitemapIndex, productionOrigin).href;
    expect(
      sitemaps,
      `robots.txt は本番のインデックス「${indexUrl}」を指定する`,
    ).toContain(indexUrl);
  });
});
