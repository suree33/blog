import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../../src/worker.ts';

const markdownBody = '# 日本語の記事\n';

const createAssets = (
  fetch: (request: Request) => Promise<Response>,
): Env['ASSETS'] => ({
  fetch: (input, init) => fetch(new Request(input, init)),
  connect: () => {
    throw new Error('The Worker does not open sockets to ASSETS');
  },
});

const createEnv = (expectedPathname: string): Env => ({
  ASSETS: createAssets(async (request) => {
    assert.equal(new URL(request.url).pathname, expectedPathname);

    return new Response(markdownBody, {
      headers: { 'Content-Type': 'text/markdown' },
    });
  }),
});

test('direct .md response declares UTF-8 in Content-Type', async () => {
  const response = await worker.fetch(
    new Request('https://example.com/posts/example.md'),
    createEnv('/posts/example.md'),
  );

  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get('Content-Type'),
    'text/markdown; charset=utf-8',
  );
  assert.equal(await response.text(), markdownBody);
});

test('direct .txt response declares UTF-8 in Content-Type', async () => {
  const response = await worker.fetch(
    new Request('https://example.com/llms.txt'),
    {
      ASSETS: createAssets(
        async () =>
          new Response(markdownBody, {
            headers: { 'Content-Type': 'text/plain' },
          }),
      ),
    },
  );

  assert.equal(
    response.headers.get('Content-Type'),
    'text/plain; charset=utf-8',
  );
  assert.equal(await response.text(), markdownBody);
});

test('negotiated Markdown response declares UTF-8 in Content-Type', async () => {
  const response = await worker.fetch(
    new Request('https://example.com/posts/example', {
      headers: { Accept: 'text/markdown' },
    }),
    createEnv('/posts/example.md'),
  );

  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get('Content-Type'),
    'text/markdown; charset=utf-8',
  );
  assert.equal(response.headers.get('Vary'), 'Accept');
  assert.equal(await response.text(), markdownBody);
});

interface AssetCall {
  method: string;
  url: URL;
}

interface AssetsOptions {
  status?: number;
  markdownStatus?: number;
  statusText?: string;
  headers?: HeadersInit;
}

const createRecordingEnv = ({
  status = 200,
  markdownStatus,
  statusText = '',
  headers = {},
}: AssetsOptions = {}) => {
  const calls: AssetCall[] = [];

  return {
    calls,
    env: {
      ASSETS: createAssets(async (request) => {
        const url = new URL(request.url);
        calls.push({ method: request.method, url });

        const isMarkdown = url.pathname.endsWith('.md');

        const assetStatus = isMarkdown ? (markdownStatus ?? status) : status;

        return new Response(assetStatus === 304 ? null : url.pathname, {
          status: assetStatus,
          statusText,
          headers: {
            'Content-Type': isMarkdown
              ? 'text/markdown'
              : 'text/html; charset=utf-8',
            ...headers,
          },
        });
      }),
    } satisfies Env,
  };
};

const fetchPost = async (
  accept: string | null,
  {
    url = 'https://example.com/posts/example',
    method = 'GET',
    assets,
  }: { url?: string; method?: string; assets?: AssetsOptions } = {},
) => {
  const { calls, env } = createRecordingEnv(assets);
  const headers = new Headers();

  if (accept !== null) {
    headers.set('Accept', accept);
  }

  const response = await worker.fetch(
    new Request(url, { method, headers }),
    env,
  );

  return { response, assetCall: calls[0], calls };
};

const negotiationCases: { accept: string | null; markdown: boolean }[] = [
  { accept: null, markdown: false },
  { accept: '', markdown: false },
  { accept: 'text/markdown', markdown: true },
  { accept: 'TEXT/Markdown', markdown: true },
  { accept: 'text/markdown; charset=utf-8', markdown: true },
  { accept: ' text/markdown ; q=0.8 , text/html ; q=0.5 ', markdown: true },
  { accept: 'text/html', markdown: false },
  { accept: '*/*', markdown: false },
  { accept: 'text/*', markdown: false },
  { accept: 'text/markdown;q=0', markdown: false },
  { accept: 'text/markdown;q=0.000', markdown: false },
  { accept: 'text/markdown;q=0, text/html', markdown: false },
  { accept: 'text/markdown;q=0, */*', markdown: false },
  { accept: 'text/markdown;q=0, text/*', markdown: false },
  { accept: 'text/markdown;q=abc', markdown: false },
  { accept: 'text/markdown;q=', markdown: false },
  { accept: 'text/markdown;q=-1', markdown: false },
  { accept: 'text/markdown;q=1.5, text/html', markdown: true },
  { accept: 'text/markdown, text/html', markdown: true },
  { accept: 'text/html, text/markdown', markdown: false },
  { accept: 'text/markdown, */*', markdown: true },
  { accept: '*/*, text/markdown', markdown: false },
  { accept: 'text/markdown, text/*', markdown: true },
  { accept: 'text/*, text/markdown', markdown: false },
  { accept: 'text/markdown;q=0.9, text/html', markdown: false },
  { accept: 'text/html;q=0.9, text/markdown', markdown: true },
  { accept: 'text/html;q=0, text/markdown;q=0.1', markdown: true },
  { accept: 'text/markdown;q=0.8, */*;q=0.9', markdown: false },
  { accept: 'text/markdown;q=0.8, text/html;q=0.5, */*;q=0.9', markdown: true },
  { accept: 'text/markdown;q=0.5, text/html;q=0, */*;q=0.8', markdown: true },
  {
    accept: 'text/markdown;q=0.5, text/html;q=0, text/*;q=0.8',
    markdown: true,
  },
  {
    accept: 'text/markdown;q=0.5, text/html;charset=iso-8859-1;q=0, */*;q=0.8',
    markdown: false,
  },
  {
    accept: 'text/markdown;charset=iso-8859-1, text/html;q=0.5',
    markdown: false,
  },
  {
    accept:
      'text/markdown;charset=utf-8;q=0.9, text/markdown;q=0.1, text/html;q=0.5',
    markdown: true,
  },
  { accept: 'text/markdown;charset="utf-8", text/html;q=0.5', markdown: true },
  {
    accept: 'text/markdown;q=0.8, text/html;q=0, text/*;charset=utf-8;q=0.9',
    markdown: true,
  },
];

for (const { accept, markdown } of negotiationCases) {
  test(`Accept ${JSON.stringify(accept)} returns ${markdown ? 'Markdown' : 'HTML'}`, async () => {
    const { response, assetCall } = await fetchPost(accept);

    assert.equal(
      assetCall.url.pathname,
      markdown ? '/posts/example.md' : '/posts/example',
    );
    assert.equal(response.headers.get('Vary'), 'Accept');
  });
}

const methodCases: { method: string; markdown: boolean }[] = [
  { method: 'GET', markdown: true },
  { method: 'HEAD', markdown: true },
  { method: 'POST', markdown: false },
  { method: 'PUT', markdown: false },
  { method: 'OPTIONS', markdown: false },
];

for (const { method, markdown } of methodCases) {
  test(`${method} with Accept text/markdown ${markdown ? 'is' : 'is not'} negotiated`, async () => {
    const { response, assetCall } = await fetchPost('text/markdown', {
      method,
    });

    assert.equal(assetCall.method, method);
    assert.equal(
      assetCall.url.pathname,
      markdown ? '/posts/example.md' : '/posts/example',
    );
    assert.equal(response.headers.get('Vary'), markdown ? 'Accept' : null);
  });
}

const pathCases: { url: string; assetUrl: string }[] = [
  {
    url: 'https://example.com/posts/example/',
    assetUrl: 'https://example.com/posts/example.md',
  },
  {
    url: 'https://example.com/posts/example?utm_source=feed&a=1',
    assetUrl: 'https://example.com/posts/example.md?utm_source=feed&a=1',
  },
  {
    url: 'https://example.com/posts/example/?a=1',
    assetUrl: 'https://example.com/posts/example.md?a=1',
  },
  {
    url: 'https://example.com/',
    assetUrl: 'https://example.com/index.md',
  },
  {
    url: 'https://example.com/posts/',
    assetUrl: 'https://example.com/posts.md',
  },
  {
    url: 'https://example.com/posts/example/nested',
    assetUrl: 'https://example.com/posts/example/nested.md',
  },
  {
    url: 'https://example.com/robots.txt',
    assetUrl: 'https://example.com/robots.txt',
  },
  {
    url: 'https://example.com/posts/example.html',
    assetUrl: 'https://example.com/posts/example.html',
  },
  {
    url: 'https://example.com/tags/example',
    assetUrl: 'https://example.com/tags/example.md',
  },
  {
    url: 'https://example.com/tags/%E7%94%9F%E6%B4%BB/',
    assetUrl: 'https://example.com/tags/%E7%94%9F%E6%B4%BB.md',
  },
];

for (const { url, assetUrl } of pathCases) {
  test(`Accept text/markdown on ${url} fetches ${assetUrl}`, async () => {
    const { assetCall } = await fetchPost('text/markdown', { url });

    assert.equal(assetCall.url.href, assetUrl);
  });
}

const htmlVaryCases: { url: string; vary: string | null }[] = [
  { url: 'https://example.com/posts/example', vary: 'Accept' },
  { url: 'https://example.com/posts/example/?a=1', vary: 'Accept' },
  { url: 'https://example.com/', vary: 'Accept' },
  { url: 'https://example.com/posts/', vary: 'Accept' },
  { url: 'https://example.com/posts/example.html', vary: null },
  { url: 'https://example.com/tags/example', vary: 'Accept' },
  { url: 'https://example.com/robots.txt', vary: null },
];

for (const { url, vary } of htmlVaryCases) {
  test(`HTML response on ${url} has Vary ${JSON.stringify(vary)}`, async () => {
    const { response, assetCall } = await fetchPost('text/html', { url });

    assert.equal(assetCall.url.href, url);
    assert.equal(response.headers.get('Vary'), vary);
  });
}

const assetStatusCases: { status: number; statusText: string }[] = [
  { status: 404, statusText: 'Not Found' },
  { status: 500, statusText: 'Internal Server Error' },
];

for (const { status, statusText } of assetStatusCases) {
  for (const accept of ['text/markdown', 'text/html']) {
    test(`ASSETS ${status} passes through for Accept ${accept}`, async () => {
      const { response, calls } = await fetchPost(accept, {
        assets: { status, statusText },
      });

      assert.equal(response.status, status);
      assert.equal(response.statusText, statusText);
      assert.equal(response.headers.get('Link'), null);
      assert.equal(await response.text(), '/posts/example');
      assert.equal(calls.length, accept === 'text/markdown' ? 2 : 1);
    });
  }
}

const varyCases: { vary: string | null; expected: string }[] = [
  { vary: null, expected: 'Accept' },
  { vary: 'Accept-Encoding', expected: 'Accept-Encoding, Accept' },
  { vary: 'Accept', expected: 'Accept' },
  { vary: 'accept', expected: 'accept' },
  { vary: 'Origin,ACCEPT', expected: 'Origin,ACCEPT' },
  { vary: 'Accept-Encoding, Accept', expected: 'Accept-Encoding, Accept' },
  {
    vary: 'Accept-Language, Origin',
    expected: 'Accept-Language, Origin, Accept',
  },
];

for (const { vary, expected } of varyCases) {
  for (const accept of ['text/markdown', 'text/html']) {
    test(`existing Vary ${JSON.stringify(vary)} becomes ${JSON.stringify(expected)} for Accept ${accept}`, async () => {
      const { response } = await fetchPost(accept, {
        assets: { headers: vary === null ? {} : { Vary: vary } },
      });

      assert.equal(response.headers.get('Vary'), expected);
    });
  }
}

const siteLinks = [
  '</llms.txt>; rel="describedby"; type="text/plain"',
  '</rss.xml>; rel="alternate"; type="application/rss+xml"',
  '</sitemap-index.xml>; rel="sitemap"; type="application/xml"',
];

const linkCases: { url: string; markdownPath: string }[] = [
  { url: 'https://example.com/', markdownPath: '/index.md' },
  { url: 'https://example.com/about/', markdownPath: '/about.md' },
  {
    url: 'https://example.com/posts/example/',
    markdownPath: '/posts/example.md',
  },
  { url: 'https://example.com/tags/', markdownPath: '/tags.md' },
];

for (const { url, markdownPath } of linkCases) {
  test(`HTML response on ${url} links its Markdown variant and site resources`, async () => {
    const { response, calls } = await fetchPost('text/html', { url });

    assert.deepEqual(
      calls.map(({ method, url }) => `${method} ${url.pathname}`),
      [`GET ${new URL(url).pathname}`, `HEAD ${markdownPath}`],
    );
    assert.equal(
      response.headers.get('Link'),
      [
        `<${markdownPath}>; rel="alternate"; type="text/markdown"`,
        ...siteLinks,
      ].join(', '),
    );
  });
}

test('HTML response without a Markdown variant links only site resources', async () => {
  const { response } = await fetchPost('text/html', {
    url: 'https://example.com/posts/',
    assets: { markdownStatus: 404 },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Link'), siteLinks.join(', '));
});

test('negotiated Markdown response links site resources', async () => {
  const { response, calls } = await fetchPost('text/markdown', {
    url: 'https://example.com/',
  });

  assert.equal(calls.length, 1);
  assert.equal(await response.text(), '/index.md');
  assert.equal(response.headers.get('Link'), siteLinks.join(', '));
});

test('Accept text/markdown falls back to HTML when no Markdown variant exists', async () => {
  const { response, calls } = await fetchPost('text/markdown', {
    url: 'https://example.com/posts/',
    assets: { markdownStatus: 404 },
  });

  assert.deepEqual(
    calls.map(({ method, url }) => `${method} ${url.pathname}`),
    ['GET /posts.md', 'GET /posts/', 'HEAD /posts.md'],
  );
  assert.equal(response.status, 200);
  assert.equal(await response.text(), '/posts/');
  assert.equal(response.headers.get('Vary'), 'Accept');
  assert.equal(response.headers.get('Link'), siteLinks.join(', '));
});

test('non-page assets are passed through without Link', async () => {
  const { response, calls } = await fetchPost('text/html', {
    url: 'https://example.com/robots.txt',
  });

  assert.equal(calls.length, 1);
  assert.equal(response.headers.get('Link'), null);
});

test('Accept text/markdown keeps a 304 for the Markdown variant', async () => {
  const { response, calls } = await fetchPost('text/markdown', {
    url: 'https://example.com/posts/example/',
    assets: { markdownStatus: 304 },
  });

  assert.deepEqual(
    calls.map(({ method, url }) => `${method} ${url.pathname}`),
    ['GET /posts/example.md'],
  );
  assert.equal(response.status, 304);
  assert.equal(response.headers.get('Vary'), 'Accept');
});
