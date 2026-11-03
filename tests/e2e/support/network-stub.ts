/**
 * E2E ビルド用のネットワークスタブ（Node.js の `--import` プリロード）。
 *
 * `pnpm run build:e2e` が `NODE_OPTIONS=--import ./tests/e2e/support/network-stub.ts`
 * 付きで `astro build` を実行するときだけ読み込まれる。本番ビルド（`build` /
 * `build:ci`）には一切影響しない。
 *
 * ## 目的
 *
 * リンクカード（`remark-link-card-plus`）はビルド時に外部サイトの OGP・favicon・
 * OG 画像を取得する。取得結果はネットワーク状態や時刻、相手サイトの変更（403 / 429
 * を含む）で変わるため、そのままではページ全体のビジュアルリグレッションが決定的に
 * ならない。このプリロードはビルド中の localhost 以外への HTTP(S) をすべて、
 * リクエスト URL だけから決まる合成レスポンスに置き換える。
 *
 * ## 差し替える経路
 *
 * 1. undici の Dispatcher（`DispatcherBase.prototype.dispatch`）
 *    - npm の `undici` は `module.registerHooks()` の load フックで読み込み時に
 *      パッチする。バージョンや個数に依存しない。`open-graph-scraper` のように
 *      独自の `Agent` を `dispatcher` に明示指定するライブラリもここで捕捉する。
 *    - Node.js 組み込みの `fetch` は `Symbol.for('undici.globalDispatcher.1')` の
 *      グローバル Dispatcher を使うため、パッチ済み `Agent` をグローバル Dispatcher に
 *      設定して捕捉する（`globalThis.fetch` を使う将来の自前プラグインも対象）。
 * 2. `node:http` / `node:https` の `request()` / `get()`
 * 3. `node:dns` の `lookup()`（`open-graph-scraper` は取得前に DNS で公開 IP か
 *    確認するため。実際の接続は 1. / 2. で横取りするので、返すアドレスへは接続しない）
 *
 * 横取りしたリクエストは、プロセス内で起動するループバックの HTTP サーバー
 * （スタブサーバー）へ転送し、そこで合成レスポンスを返す。
 *
 * ## 合成レスポンス
 *
 * - HEAD: 常に 200（本文なし）
 * - 画像（スタブ用ホスト、画像拡張子、Google の favicon API、`Accept: image/*`）:
 *   URL のハッシュから色を決めた小さな PNG
 * - それ以外: URL から決まる og:title / og:description / og:image / favicon を持つ HTML
 *
 * og:image と favicon の URL は予約済み TLD `.invalid` 配下（`*.e2e-stub.invalid`）に
 * する。`remark-link-card-plus` は画像 URL の SHA-256 をファイル名にして
 * `public/remark-link-card-plus/` にキャッシュするため、実在 URL と衝突しない
 * スタブ URL を使えば、ローカルに残った本物のキャッシュが結果を変えることはない。
 * ビルドで書き出されたスタブ画像は、プロセス終了時に同ディレクトリから削除する
 * （public/ を汚さず、以降の本番ビルドにスタブ画像が紛れ込まないようにするため）。
 */
import { createHash } from 'node:crypto';
import dns from 'node:dns';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import module from 'node:module';
import path from 'node:path';
import { isMainThread } from 'node:worker_threads';
import { crc32, deflateSync } from 'node:zlib';

const LOG_PREFIX = '[e2e-network-stub]';
/** スタブが合成する画像 URL のホスト名サフィックス（RFC 2606 の予約 TLD）。 */
const STUB_HOST_SUFFIX = '.e2e-stub.invalid';
/**
 * 非ローカルのホスト名に対して DNS が返すアドレス。
 * `open-graph-scraper` の公開 IP チェックを通すためだけの値で、実際には接続しない。
 */
const FAKE_PUBLIC_ADDRESS = '93.184.215.14';
const STUB_PATH_PREFIX = '/__e2e-network-stub?url=';
const PATCHED = Symbol.for('blog.e2e.networkStub.patched');
const PATCH_UNDICI = Symbol.for('blog.e2e.networkStub.patchUndici');
/**
 * リンクカードの画像の保存先。`remark-link-card-plus` と、置き換え予定の
 * リポジトリ内プラグイン（`src/lib/markdown/link-card.ts`）の両方を片付ける。
 */
const LINK_CARD_CACHE_DIRS = [
  path.join(process.cwd(), 'public', 'remark-link-card-plus'),
  path.join(process.cwd(), 'public', 'link-card-images'),
];
const IMAGE_EXTENSION_PATTERN = /\.(?:png|jpe?g|gif|webp|avif|svg|ico|bmp)$/i;

type GlobalWithStub = typeof globalThis & {
  [PATCH_UNDICI]?: (exports: UndiciLike) => void;
};

const globalWithStub = globalThis as GlobalWithStub;

function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  return (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized === '::1' ||
    normalized.startsWith('127.')
  );
}

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

// ---------------------------------------------------------------------------
// 合成レスポンス
// ---------------------------------------------------------------------------

type Rgb = readonly [number, number, number];

function pngChunk(type: string, data: Buffer): Buffer {
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

/** 左右 2 色に塗り分けた RGB PNG を生成する（トリミング位置の変化も検出できる）。 */
function createPng(width: number, height: number, left: Rgb, right: Rgb) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.writeUInt8(8, 8); // ビット深度
  header.writeUInt8(2, 9); // カラータイプ: RGB
  const rowLength = 1 + width * 3;
  const pixels = Buffer.alloc(rowLength * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      pixels.set(x < width / 2 ? left : right, y * rowLength + 1 + x * 3);
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(pixels)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function colorsFromHash(hash: string): [Rgb, Rgb] {
  const bytes = Buffer.from(hash, 'hex');
  return [
    [bytes[0] ?? 0, bytes[1] ?? 0, bytes[2] ?? 0],
    [bytes[3] ?? 0, bytes[4] ?? 0, bytes[5] ?? 0],
  ];
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function isImageRequest(url: URL, accept: string): boolean {
  return (
    url.hostname.endsWith(STUB_HOST_SUFFIX) ||
    IMAGE_EXTENSION_PATTERN.test(url.pathname) ||
    (url.hostname === 'www.google.com' &&
      url.pathname.startsWith('/s2/favicons')) ||
    accept.trim().startsWith('image/')
  );
}

interface StubResponse {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
}

function createStubResponse(
  originalUrl: string,
  method: string,
  accept: string,
): StubResponse {
  const url = new URL(originalUrl);
  const hash = sha256(url.href);

  if (isImageRequest(url, accept)) {
    const isFavicon =
      url.hostname.startsWith('favicon.') || url.pathname.includes('favicon');
    const [left, right] = colorsFromHash(hash);
    const body = isFavicon
      ? createPng(16, 16, left, right)
      : createPng(120, 63, left, right);
    return {
      status: 200,
      headers: { 'content-type': 'image/png' },
      body: method === 'HEAD' ? Buffer.alloc(0) : body,
    };
  }

  const id = hash.slice(0, 16);
  const label = `${url.hostname}${url.pathname}`;
  const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>${escapeHtml(label)}</title>
<meta property="og:title" content="${escapeHtml(`E2E スタブ: ${label}`)}">
<meta property="og:description" content="${escapeHtml(`${url.href} の代わりにビルド時ネットワークスタブが返した説明文です。`)}">
<meta property="og:image" content="https://og-image${STUB_HOST_SUFFIX}/${id}.png">
<link rel="icon" href="https://favicon${STUB_HOST_SUFFIX}/${id}.png">
</head>
<body></body>
</html>
`;
  return {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
    body: method === 'HEAD' ? Buffer.alloc(0) : Buffer.from(html, 'utf-8'),
  };
}

// ---------------------------------------------------------------------------
// スタブサーバー（ループバック）
// ---------------------------------------------------------------------------

const servedImageUrls = new Set<string>();
let stubbedRequestCount = 0;

const originalHttpRequest = http.request;
const stubServer = http.createServer((request, response) => {
  const requestUrl = request.url ?? '';
  const originalUrl = requestUrl.startsWith(STUB_PATH_PREFIX)
    ? decodeURIComponent(requestUrl.slice(STUB_PATH_PREFIX.length))
    : undefined;

  if (!originalUrl || !URL.canParse(originalUrl)) {
    response.writeHead(400).end();
    return;
  }

  const method = request.method ?? 'GET';
  const stub = createStubResponse(
    originalUrl,
    method,
    request.headers.accept ?? '',
  );
  stubbedRequestCount += 1;
  if (stub.headers['content-type']?.startsWith('image/')) {
    servedImageUrls.add(originalUrl);
  }
  console.error(
    `${LOG_PREFIX} ${method} ${originalUrl} -> ${stub.status} ${stub.headers['content-type']}`,
  );
  response.writeHead(stub.status, {
    ...stub.headers,
    'content-length': String(stub.body.length),
  });
  response.end(stub.body);
});

await new Promise<void>((resolve) => {
  stubServer.listen(0, '127.0.0.1', resolve);
});
// スタブサーバーがビルドプロセスの終了を妨げないようにする。
stubServer.unref();

const stubAddress = stubServer.address();
if (!stubAddress || typeof stubAddress === 'string') {
  throw new Error(`${LOG_PREFIX} スタブサーバーのアドレスを取得できません`);
}
const stubOrigin = `http://127.0.0.1:${stubAddress.port}`;

function stubPathFor(originalUrl: string): string {
  return `${STUB_PATH_PREFIX}${encodeURIComponent(originalUrl)}`;
}

// ---------------------------------------------------------------------------
// undici
// ---------------------------------------------------------------------------

interface DispatchOptions {
  origin?: string | URL;
  path?: string;
  [key: string]: unknown;
}

type DispatchFn = (opts: DispatchOptions, handler: unknown) => boolean;

interface DispatcherPrototype {
  dispatch: DispatchFn;
  [PATCHED]?: boolean;
}

interface UndiciLike {
  Agent: new () => object;
  setGlobalDispatcher?: (dispatcher: object) => void;
}

/** Client / Pool のように自身の接続先を持つ Dispatcher から origin を求める。 */
function originOf(dispatcher: object, opts: DispatchOptions): string | null {
  if (opts.origin) {
    return new URL(opts.origin).origin;
  }
  const urlSymbol = Object.getOwnPropertySymbols(dispatcher).find(
    (symbol) => symbol.description === 'url',
  );
  const ownUrl: unknown = urlSymbol
    ? (dispatcher as Record<symbol, unknown>)[urlSymbol]
    : undefined;
  return ownUrl instanceof URL ? ownUrl.origin : null;
}

function patchUndici(undici: UndiciLike): void {
  const dispatcherBase = Object.getPrototypeOf(
    undici.Agent.prototype,
  ) as DispatcherPrototype;
  if (dispatcherBase[PATCHED]) {
    return;
  }
  if (!Object.hasOwn(dispatcherBase, 'dispatch')) {
    throw new Error(
      `${LOG_PREFIX} undici の DispatcherBase.prototype.dispatch が見つかりません`,
    );
  }

  const originalDispatch = dispatcherBase.dispatch;
  dispatcherBase[PATCHED] = true;
  // スタブサーバー（ローカル）への転送専用 Agent。
  const stubAgent = new undici.Agent();

  dispatcherBase.dispatch = function (opts, handler) {
    const origin = originOf(this, opts);
    if (origin === null || isLocalHostname(new URL(origin).hostname)) {
      return originalDispatch.call(this, opts, handler);
    }
    const originalUrl = new URL(opts.path ?? '/', origin).href;
    return originalDispatch.call(
      stubAgent,
      { ...opts, origin: stubOrigin, path: stubPathFor(originalUrl) },
      handler,
    );
  };
}

globalWithStub[PATCH_UNDICI] = patchUndici;

// 以降に読み込まれる undici（どのバージョン・どのパッケージ経由でも）の
// エントリーポイント末尾にパッチ呼び出しを追記する。
const UNDICI_ENTRY_PATTERN = /\/node_modules\/undici\/index\.js$/;
module.registerHooks({
  load(url, context, nextLoad) {
    const result = nextLoad(url, context);
    if (!UNDICI_ENTRY_PATTERN.test(url) || result.source == null) {
      return result;
    }
    const source =
      typeof result.source === 'string'
        ? result.source
        : Buffer.from(result.source as Uint8Array).toString('utf-8');
    return {
      ...result,
      source: `${source}\n;globalThis[Symbol.for('blog.e2e.networkStub.patchUndici')]?.(module.exports);\n`,
    };
  },
});

// Node.js 組み込み fetch が使うグローバル Dispatcher を、パッチ済み Agent にする。
const undici = (await import('undici')) as unknown as UndiciLike;
patchUndici(undici);
undici.setGlobalDispatcher?.(new undici.Agent());

// ---------------------------------------------------------------------------
// node:http / node:https
// ---------------------------------------------------------------------------

type RequestArgs = Parameters<typeof http.request>;

function urlFromRequestArgs(
  args: unknown[],
  defaultProtocol: string,
): { url: URL; options: http.RequestOptions; callback?: unknown } {
  const [first, second, third] = args;
  if (typeof first === 'string' || first instanceof URL) {
    const url = new URL(first);
    const options =
      typeof second === 'object' && second !== null
        ? (second as http.RequestOptions)
        : {};
    return {
      url,
      options,
      callback: typeof second === 'function' ? second : third,
    };
  }
  const options = (first ?? {}) as http.RequestOptions;
  const protocol = options.protocol ?? defaultProtocol;
  const host = options.hostname ?? options.host ?? 'localhost';
  const port = options.port ? `:${options.port}` : '';
  return {
    url: new URL(`${protocol}//${host}${port}${options.path ?? '/'}`),
    options,
    callback: second,
  };
}

function patchNodeHttp(target: typeof http | typeof https, protocol: string) {
  const originalRequest = target.request;
  const patchedRequest = function (this: unknown, ...args: unknown[]) {
    const { url, options, callback } = urlFromRequestArgs(args, protocol);
    if (isLocalHostname(url.hostname)) {
      return Reflect.apply(originalRequest, this, args) as http.ClientRequest;
    }
    return originalHttpRequest(
      `${stubOrigin}${stubPathFor(url.href)}`,
      { method: options.method, headers: options.headers },
      callback as RequestArgs[2],
    );
  };
  target.request = patchedRequest as typeof http.request;
  target.get = function (...args: unknown[]) {
    const request = patchedRequest(...args);
    request.end();
    return request;
  } as typeof http.get;
}

patchNodeHttp(http, 'http:');
patchNodeHttp(https, 'https:');

// ---------------------------------------------------------------------------
// node:dns
// ---------------------------------------------------------------------------

interface LookupOptionsLike {
  all?: boolean;
}

function fakeLookupResult(options: unknown) {
  const all =
    typeof options === 'object' &&
    options !== null &&
    (options as LookupOptionsLike).all;
  return all
    ? {
        all: true as const,
        value: [{ address: FAKE_PUBLIC_ADDRESS, family: 4 }],
      }
    : { all: false as const, value: FAKE_PUBLIC_ADDRESS };
}

const originalLookup = dns.lookup;
dns.lookup = function (hostname: string, ...rest: unknown[]) {
  if (isLocalHostname(hostname)) {
    return Reflect.apply(originalLookup, dns, [hostname, ...rest]);
  }
  const callback = rest.at(-1) as (...args: unknown[]) => void;
  const result = fakeLookupResult(rest.length > 1 ? rest[0] : undefined);
  process.nextTick(() => {
    if (result.all) {
      callback(null, result.value);
    } else {
      callback(null, result.value, 4);
    }
  });
} as typeof dns.lookup;

const originalPromisesLookup = dns.promises.lookup;
dns.promises.lookup = async function (hostname: string, options?: unknown) {
  if (isLocalHostname(hostname)) {
    return Reflect.apply(originalPromisesLookup, dns.promises, [
      hostname,
      options,
    ]);
  }
  const result = fakeLookupResult(options);
  return result.all ? result.value : { address: result.value, family: 4 };
} as typeof dns.promises.lookup;

// `import { request } from 'node:https'` のような名前付き import にも反映する。
module.syncBuiltinESMExports();

// ---------------------------------------------------------------------------
// 終了時の後片付け
// ---------------------------------------------------------------------------

process.on('exit', () => {
  if (isMainThread && stubbedRequestCount > 0) {
    console.error(
      `${LOG_PREFIX} ${stubbedRequestCount} 件の外部リクエストをスタブ応答に置き換えました`,
    );
  }
  if (servedImageUrls.size === 0) {
    return;
  }
  // どちらのプラグインも decodeURI(url.href) の SHA-256 をファイル名に使う。
  const hashes = new Set(
    [...servedImageUrls].flatMap((url) => {
      try {
        return [sha256(url), sha256(decodeURI(url))];
      } catch {
        return [sha256(url)];
      }
    }),
  );
  for (const directory of LINK_CARD_CACHE_DIRS) {
    let entries: string[];
    try {
      entries = fs.readdirSync(directory);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const [hash] = entry.split('.');
      if (hash && hashes.has(hash)) {
        fs.rmSync(path.join(directory, entry), { force: true });
      }
    }
  }
});
