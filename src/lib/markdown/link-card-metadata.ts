import { htmlToHast, type HastNode } from 'satteri';

/**
 * リンクカードに表示する OG メタデータの取得と解析。
 *
 * 取得はビルド時に `fetch`（既定は `globalThis.fetch`）で行う。HTML の解析には
 * Sätteri の `htmlToHast` を使い、HTML エンティティの展開もパーサーに任せる。
 *
 * 抽出の優先順位は、旧プラグイン（`remark-link-card-plus` が使う
 * `open-graph-scraper`）のうち、このサイトの表示に効くものに合わせている。
 * 詳細は `docs/markdown-link-cards.md` を参照。
 */

/** ページから取り出したメタデータ。取り出せなかった項目は `undefined`。 */
export interface OpenGraphData {
  title?: string;
  description?: string;
  /** favicon の URL（相対 URL はページのオリジン基準で解決済み）。 */
  faviconUrl?: string;
  /** サムネイル画像の URL。絶対 URL として解釈できるものだけを返す。 */
  imageUrl?: string;
}

export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

type Element = Extract<HastNode, { type: 'element' }>;

const LOG_PREFIX = '[link-card]';

/** 取得前に HTML ではないと判断する拡張子（`open-graph-scraper` と同じ一覧）。 */
const NON_HTML_EXTENSIONS = [
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.3gp',
  '.avi',
  '.mov',
  '.mp4',
  '.m4v',
  '.m4a',
  '.mp3',
  '.mkv',
  '.ogv',
  '.ogm',
  '.ogg',
  '.oga',
  '.webm',
  '.wav',
  '.bmp',
  '.gif',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.zip',
  '.rar',
  '.tar',
  '.tar.gz',
  '.tgz',
  '.tar.bz2',
  '.tbz2',
  '.txt',
  '.pdf',
];

/** og:image がないときに `<img>` を候補にする画像の拡張子。 */
const IMAGE_EXTENSIONS = [
  'apng',
  'bmp',
  'gif',
  'ico',
  'cur',
  'jpg',
  'jpeg',
  'jfif',
  'pjpeg',
  'pjp',
  'png',
  'svg',
  'tif',
  'tiff',
  'webp',
];

/** favicon を探す `<link>` などの条件（上から順に優先）。 */
const FAVICON_SELECTORS: readonly {
  attribute: 'rel' | 'type';
  value: string;
}[] = [
  { attribute: 'rel', value: 'shortcut icon' },
  { attribute: 'rel', value: 'icon' },
  { attribute: 'rel', value: 'mask-icon' },
  { attribute: 'rel', value: 'apple-touch-icon' },
  { attribute: 'type', value: 'image/png' },
  { attribute: 'type', value: 'image/ico' },
  { attribute: 'type', value: 'image/x-icon' },
];

function isElement(node: HastNode): node is Element {
  return node.type === 'element';
}

function childrenOf(node: HastNode): HastNode[] {
  return 'children' in node && Array.isArray(node.children)
    ? (node.children as HastNode[])
    : [];
}

/** 文書順（前順）にすべての要素を列挙する。 */
function* walkElements(node: HastNode): Generator<Element> {
  for (const child of childrenOf(node)) {
    if (isElement(child)) {
      yield child;
    }
    yield* walkElements(child);
  }
}

function textOf(node: HastNode): string {
  if (node.type === 'text') {
    return node.value;
  }
  return childrenOf(node).map(textOf).join('');
}

/** hast のプロパティを HTML の属性値（文字列）として読む。 */
function attribute(element: Element, name: string): string | undefined {
  const value = element.properties[name];
  if (Array.isArray(value)) {
    return value.join(' ');
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  return undefined;
}

function nonEmpty(value: string | undefined): string | undefined {
  return value !== undefined && value.length > 0 ? value : undefined;
}

function extensionOf(url: string): string {
  const last = url.split('.').pop() ?? '';
  return last.split('?')[0] ?? '';
}

/** `open-graph-scraper` と同様に、URL の末尾から HTML ではないページを判定する。 */
export function isNonHtmlUrl(url: string): boolean {
  const extension = `.${extensionOf(url)}`;
  return NON_HTML_EXTENSIONS.some((type) => extension.includes(type));
}

function isHttpUrl(value: string): boolean {
  if (!URL.canParse(value)) {
    return false;
  }
  const { protocol } = new URL(value);
  return protocol === 'http:' || protocol === 'https:';
}

/** favicon の URL を解決する。相対 URL はページのオリジンを基準にする（旧プラグインと同じ）。 */
export function resolveFaviconUrl(
  favicon: string,
  pageUrl: URL,
): string | undefined {
  try {
    const resolved = URL.canParse(favicon)
      ? new URL(favicon)
      : new URL(favicon, pageUrl.origin);
    return isHttpUrl(resolved.href) ? resolved.href : undefined;
  } catch {
    return undefined;
  }
}

interface ImageCandidate {
  url: string;
  width: number;
  height: number;
}

/**
 * og:image の候補から 1 枚を選ぶ。`open-graph-scraper` と同じく、
 * `og:image:secure_url` → `og:image` → `og:image:url` の順に使う一覧を決め、
 * GIF を優先したうえで、幅・高さの大きいものを優先する。
 */
function pickOgImage(
  secureUrls: string[],
  properties: string[],
  urls: string[],
  widths: string[],
  heights: string[],
): string | undefined {
  const list =
    secureUrls.length > 0
      ? secureUrls
      : properties.length > 0
        ? properties
        : urls;
  const candidates: ImageCandidate[] = list
    .map((url, index) => ({
      url,
      width: Number(widths[index]) || 0,
      height: Number(heights[index]) || 0,
    }))
    .filter((candidate) => candidate.url !== '')
    .slice(0, 10);
  const isGif = (url: string) =>
    /\.(\w{2,5})$/.exec(url)?.[1]?.toLowerCase() === 'gif';
  candidates.sort((a, b) => {
    if (isGif(a.url) !== isGif(b.url)) {
      return isGif(a.url) ? -1 : 1;
    }
    return Math.max(b.width, b.height) - Math.max(a.width, a.height);
  });
  return candidates[0]?.url;
}

/**
 * HTML から OG メタデータを取り出す。
 *
 * - タイトル: `og:title` → `<title>` → `<meta name="title">`
 * - 説明: `og:description` → `<meta name="description">` → `<meta itemprop="description">`
 * - 画像: `og:image`（`secure_url` / `url` を含む）→ 本文中の最初の画像（絶対 URL のみ）
 *   相対 URL の og:image は旧プラグインと同じく使わない
 * - favicon: `<link rel="shortcut icon">` → `rel="icon"` → … の順で最初に見つかったもの
 */
export function parseOpenGraph(html: string, pageUrl: URL): OpenGraphData {
  const tree = htmlToHast(html);
  const elements = [...walkElements(tree)];
  const head = elements.find((element) => element.tagName === 'head');
  const headChildren = head ? childrenOf(head).filter(isElement) : [];

  const single = new Map<string, string>();
  const multiple = new Map<string, string[]>();
  const multipleKeys = new Set([
    'og:image',
    'og:image:url',
    'og:image:secure_url',
    'og:image:width',
    'og:image:height',
  ]);

  for (const element of elements) {
    if (element.tagName !== 'meta') {
      continue;
    }
    const property =
      attribute(element, 'property') ?? attribute(element, 'name');
    if (!property) {
      continue;
    }
    const key = property.toLowerCase();
    const content =
      nonEmpty(attribute(element, 'content')) ?? attribute(element, 'value');
    if (multipleKeys.has(key)) {
      multiple.set(key, [...(multiple.get(key) ?? []), content ?? '']);
    } else if (content !== undefined) {
      // 同じプロパティが複数あるときは後勝ち（open-graph-scraper と同じ）。
      single.set(key, content);
    }
  }

  const headMeta = (name: string, value: string) =>
    nonEmpty(
      headChildren
        .filter(
          (element) =>
            element.tagName === 'meta' && attribute(element, name) === value,
        )
        .map((element) => attribute(element, 'content'))[0],
    );

  const titleElement = elements.find((element) => element.tagName === 'title');
  const title =
    nonEmpty(single.get('og:title')) ??
    nonEmpty(titleElement ? textOf(titleElement) : undefined) ??
    headMeta('name', 'title');

  const description =
    nonEmpty(single.get('og:description')) ??
    headMeta('name', 'description') ??
    headMeta('itemProp', 'description');

  let imageUrl = pickOgImage(
    multiple.get('og:image:secure_url') ?? [],
    multiple.get('og:image') ?? [],
    multiple.get('og:image:url') ?? [],
    multiple.get('og:image:width') ?? [],
    multiple.get('og:image:height') ?? [],
  );
  const hasOgImage =
    multiple.has('og:image') ||
    multiple.has('og:image:url') ||
    multiple.has('og:image:secure_url');
  if (!hasOgImage) {
    imageUrl = elements
      .filter((element) => element.tagName === 'img')
      .map((element) => attribute(element, 'src') ?? '')
      .find(
        (src) => isHttpUrl(src) && IMAGE_EXTENSIONS.includes(extensionOf(src)),
      );
  }

  let favicon: string | undefined;
  for (const selector of FAVICON_SELECTORS) {
    const found = elements.find(
      (element) =>
        element.tagName === 'link' &&
        attribute(element, selector.attribute) === selector.value,
    );
    favicon = nonEmpty(found ? attribute(found, 'href') : undefined);
    if (favicon) {
      break;
    }
  }

  return {
    title,
    description,
    faviconUrl: favicon ? resolveFaviconUrl(favicon, pageUrl) : undefined,
    imageUrl: imageUrl && isHttpUrl(imageUrl) ? imageUrl : undefined,
  };
}

function charsetFromContentType(value: string | null | undefined) {
  return /charset=([^()<>@,;:"/[\]?.=\s]*)/i.exec(value ?? '')?.[1];
}

/** `<meta charset>` → `<meta http-equiv="content-type">` → Content-Type ヘッダーの順に文字コードを決める。 */
function detectCharset(html: string, contentType: string | null) {
  const elements = [...walkElements(htmlToHast(html))];
  for (const element of elements) {
    if (element.tagName !== 'meta') {
      continue;
    }
    const charset = nonEmpty(attribute(element, 'charSet'));
    if (charset) {
      return charset;
    }
    if (attribute(element, 'httpEquiv')?.toLowerCase() === 'content-type') {
      const fromMeta = charsetFromContentType(attribute(element, 'content'));
      if (fromMeta) {
        return fromMeta;
      }
    }
  }
  return charsetFromContentType(contentType) ?? 'utf-8';
}

function decodeBody(buffer: ArrayBuffer, contentType: string | null): string {
  const utf8 = new TextDecoder('utf-8').decode(buffer);
  const charset = detectCharset(utf8, contentType);
  if (charset.toLowerCase() === 'utf-8') {
    return utf8;
  }
  try {
    return new TextDecoder(charset).decode(buffer);
  } catch {
    // 未知の文字コード名は UTF-8 として扱う。
    return utf8;
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.name === 'TimeoutError' ? 'タイムアウト' : error.message;
  }
  return String(error);
}

export interface FetchOpenGraphOptions {
  fetch: FetchLike;
  /** 1 リクエストのタイムアウト（ミリ秒）。 */
  timeout: number;
}

/**
 * ページを取得して OG メタデータを返す。取得・解析に失敗したときは警告を出して
 * `undefined` を返す（ビルドは止めない）。
 */
export async function fetchOpenGraph(
  url: URL,
  { fetch, timeout }: FetchOpenGraphOptions,
): Promise<OpenGraphData | undefined> {
  try {
    if (isNonHtmlUrl(url.href)) {
      throw new Error('HTML ページではない URL です');
    }
    const response = await fetch(url.href, {
      headers: { Accept: 'text/html' },
      signal: AbortSignal.timeout(timeout),
    });
    const contentType = response.headers.get('content-type');
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`HTTP ${response.status}`);
    }
    if (contentType && !contentType.toLowerCase().includes('text/')) {
      await response.body?.cancel();
      throw new Error(`HTML ではない応答です (${contentType})`);
    }
    const body = decodeBody(await response.arrayBuffer(), contentType);
    if (body === '') {
      throw new Error('本文が空です');
    }
    return parseOpenGraph(body, url);
  } catch (error) {
    console.warn(
      `${LOG_PREFIX} OG メタデータを取得できませんでした: ${url.href} (${errorMessage(error)})`,
    );
    return undefined;
  }
}
