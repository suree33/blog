import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../../src/worker.ts';

const markdownBody = '# 日本語の記事\n';

const createEnv = (expectedPathname: string) => ({
  ASSETS: {
    fetch: async (request: Request) => {
      assert.equal(new URL(request.url).pathname, expectedPathname);

      return new Response(markdownBody, {
        headers: { 'Content-Type': 'text/markdown' },
      });
    },
  },
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
  statusText?: string;
  headers?: HeadersInit;
}

const createRecordingEnv = ({
  status = 200,
  statusText = '',
  headers = {},
}: AssetsOptions = {}) => {
  const calls: AssetCall[] = [];

  return {
    calls,
    env: {
      ASSETS: {
        fetch: async (request: Request) => {
          const url = new URL(request.url);
          calls.push({ method: request.method, url });

          return new Response(url.pathname, {
            status,
            statusText,
            headers: {
              'Content-Type': url.pathname.endsWith('.md')
                ? 'text/markdown'
                : 'text/html; charset=utf-8',
              ...headers,
            },
          });
        },
      },
    },
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

  assert.equal(calls.length, 1);

  return { response, assetCall: calls[0] };
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
    assert.equal(response.headers.get('Vary'), markdown ? 'Accept' : null);
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
    url: 'https://example.com/posts/',
    assetUrl: 'https://example.com/posts/',
  },
  {
    url: 'https://example.com/posts/example/nested',
    assetUrl: 'https://example.com/posts/example/nested',
  },
  {
    url: 'https://example.com/posts/example.html',
    assetUrl: 'https://example.com/posts/example.html',
  },
  {
    url: 'https://example.com/tags/example',
    assetUrl: 'https://example.com/tags/example',
  },
];

for (const { url, assetUrl } of pathCases) {
  test(`Accept text/markdown on ${url} fetches ${assetUrl}`, async () => {
    const { assetCall } = await fetchPost('text/markdown', { url });

    assert.equal(assetCall.url.href, assetUrl);
  });
}

const assetStatusCases: { status: number; statusText: string }[] = [
  { status: 404, statusText: 'Not Found' },
  { status: 500, statusText: 'Internal Server Error' },
];

for (const { status, statusText } of assetStatusCases) {
  for (const accept of ['text/markdown', 'text/html']) {
    test(`ASSETS ${status} passes through for Accept ${accept}`, async () => {
      const { response, assetCall } = await fetchPost(accept, {
        assets: { status, statusText },
      });

      assert.equal(response.status, status);
      assert.equal(response.statusText, statusText);
      assert.equal(await response.text(), assetCall.url.pathname);
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
  test(`existing Vary ${JSON.stringify(vary)} becomes ${JSON.stringify(expected)}`, async () => {
    const { response } = await fetchPost('text/markdown', {
      assets: { headers: vary === null ? {} : { Vary: vary } },
    });

    assert.equal(response.headers.get('Vary'), expected);
  });
}
