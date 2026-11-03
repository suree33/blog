import sanitizeHtml from 'sanitize-html';
import {
  defineMdastPlugin,
  type MdastNode,
  type MdastPluginDefinition,
} from 'satteri';
import {
  createImageStore,
  DEFAULT_IMAGE_DIRECTORY,
  DEFAULT_IMAGE_PUBLIC_PATH,
} from './link-card-image';
import {
  errorMessage,
  fetchOpenGraph,
  type FetchLike,
} from './link-card-metadata';

/**
 * 段落に単独で置かれた URL をリンクカードにする Sätteri の mdast プラグイン。
 *
 * - 対象: ルート直下の段落で、子が 1 つだけのもの。その中の
 *   リンク（`<url>`、裸の URL の自動リンク、`[url](url)`）か、URL だけのテキスト
 * - OG メタデータと画像はビルド時に取得する。Sätteri の visitor は Promise を返せる
 *   （Astro も `markdownToHtml` の結果を await する）ので、プラグイン自体が非同期で取得する
 * - 取得に失敗してもビルドは止めず、カードの形のまま縮退する
 *
 * 詳細は `docs/markdown-link-cards.md` を参照。
 */

type Paragraph = Extract<MdastNode, { type: 'paragraph' }>;
type PhrasingContent = Paragraph['children'][number];
type Link = Extract<PhrasingContent, { type: 'link' }>;
type Text = Extract<PhrasingContent, { type: 'text' }>;

const LOG_PREFIX = '[link-card]';
const CLASS_PREFIX = 'link-card';

export interface LinkCardData {
  url: URL;
  title: string;
  description: string;
  /** favicon の `src`。ない場合は `undefined`。 */
  faviconSrc?: string;
  /** サムネイルの `src`。ない場合は `undefined`。 */
  imageSrc?: string;
  /** カードに表示する URL（ホスト名）。 */
  displayUrl: string;
}

export interface LinkCardOptions {
  /** 外部取得に使う fetch。既定は `globalThis.fetch`（E2E のネットワークスタブが捕捉する）。 */
  fetch?: FetchLike;
  /** 1 リクエストのタイムアウト（ミリ秒）。既定は 10 秒（旧プラグインと同じ）。 */
  timeout?: number;
  /** 同時に行う外部リクエストの上限。既定は 6。 */
  concurrency?: number;
  /** 画像の保存先ディレクトリ（絶対パス）。既定は `public/link-card-images/`。 */
  imageDirectory?: string;
  /** 保存した画像をサイトから参照するときのパス。既定は `/link-card-images/`。 */
  imagePublicPath?: string;
}

const URL_PATTERN = /^(https?:\/\/[^\s/$.?#].[^\s]*)$/i;

function isCardUrl(value: string): boolean {
  return URL.canParse(value) && URL_PATTERN.test(value);
}

function isSameUrl(a: string, b: string): boolean {
  try {
    return new URL(a).href === new URL(b).href;
  } catch {
    return false;
  }
}

function hasChildren(
  node: PhrasingContent,
): node is PhrasingContent & { children: PhrasingContent[] } {
  return 'children' in node && Array.isArray(node.children);
}

/**
 * 段落がリンクカードの対象なら、カードにする URL を返す。対象でなければ `undefined`。
 *
 * 判定は旧プラグイン（`remark-link-card-plus`）に合わせている。
 * - 段落の子が 1 つだけであること（前後に文字があれば通常のリンクのまま）
 * - その子孫に、リンク先とリンク文字列が同じ URL のリンクがあるか、
 *   URL だけのテキストがあること
 * - `[https://a.example](https://b.example)` のように文字列とリンク先が違うリンクは対象外
 *
 * 段落がルート直下にあるか（リストや引用の中ではないか）は呼び出し側で確かめる。
 */
export function findLinkCardUrl(paragraph: Paragraph): string | undefined {
  if (paragraph.children.length !== 1) {
    return undefined;
  }
  const links: Link[] = [];
  const texts: Text[] = [];
  const walk = (node: PhrasingContent, insideLink: boolean) => {
    if (node.type === 'link') {
      links.push(node);
    } else if (node.type === 'text' && !insideLink) {
      // リンクの中のテキストはリンク側で判定する。
      texts.push(node);
    }
    if (hasChildren(node)) {
      for (const child of node.children) {
        walk(child, insideLink || node.type === 'link');
      }
    }
  };
  for (const child of paragraph.children) {
    walk(child, false);
  }

  for (const link of links) {
    const [child] = link.children;
    if (
      link.children.length === 1 &&
      child?.type === 'text' &&
      isSameUrl(link.url, child.value)
    ) {
      return link.url;
    }
  }
  return texts.find((text) => isCardUrl(text.value))?.value;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * OG のタイトル・説明を、旧プラグインと同じく `sanitize-html` の既定の設定で
 * 無害化する。表示を変えないため、旧プラグインと同じ結果にしている。
 *
 * - 許可されていないタグ（`<tag>`、`<img>` など）はタグだけを取り除き、中の文字列は残す
 * - `<script>` / `<style>` などは中身ごと取り除く
 * - 許可されたタグ（`<b>`、`<a>` など）は、危険な属性や URL スキームを取り除いて残す
 * - 文字列中の `&` / `<` / `>` はエスケープする
 */
export function sanitizeText(value: string): string {
  return sanitizeHtml(value);
}

function className(value: string): string {
  return `${CLASS_PREFIX}__${value}`;
}

/**
 * カードの HTML を組み立てる。構造は旧プラグインと同じで、クラス名の接頭辞だけが
 * `remark-link-card-plus__` から `link-card__` に変わる（スタイルは
 * `src/styles/link-card.css`）。URL・画像パス・表示用 URL はエスケープし、
 * タイトルと説明は {@link sanitizeText} を通す。
 */
export function renderLinkCard(data: LinkCardData): string {
  const thumbnail = data.imageSrc
    ? `<div class="${className('thumbnail')}">
  <img src="${escapeHtml(data.imageSrc)}" class="${className('image')}" alt="">
</div>`
    : '';
  const favicon = data.faviconSrc
    ? `<img src="${escapeHtml(data.faviconSrc)}" class="${className('favicon')}" width="14" height="14" alt="">`
    : '';
  const main = `<div class="${className('main')}">
  <div class="${className('content')}">
    <div class="${className('title')}">${sanitizeText(data.title)}</div>
    <div class="${className('description')}">${sanitizeText(data.description)}</div>
  </div>
  <div class="${className('meta')}">
    ${favicon}
    <span class="${className('url')}">${escapeHtml(data.displayUrl)}</span>
  </div>
</div>`.replace(/\n\s*\n/g, '\n');
  const content = `${main}\n${thumbnail}`.trim();
  return `<div class="${className('container')}">
  <a href="${escapeHtml(data.url.href)}" target="_blank" rel="noreferrer noopener" class="${className('card')}">
    ${content}
  </a>
</div>`;
}

/** 同時に実行する fetch の数を制限する。 */
export function limitConcurrency(fetch: FetchLike, limit: number): FetchLike {
  let active = 0;
  const queue: (() => void)[] = [];
  const acquire = async () => {
    if (active >= limit) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }
    active += 1;
  };
  const release = () => {
    active -= 1;
    queue.shift()?.();
  };
  return async (input, init) => {
    await acquire();
    try {
      return await fetch(input, init);
    } finally {
      release();
    }
  };
}

function displayHostname(url: URL): string {
  try {
    return decodeURI(url.hostname);
  } catch {
    return url.hostname;
  }
}

/** URL からカードのデータを求める関数を作る。同じ URL は 1 回だけ取得する。 */
export function createLinkCardResolver(options: LinkCardOptions = {}) {
  const timeout = options.timeout ?? 10_000;
  const fetch = limitConcurrency(
    options.fetch ?? ((input, init) => globalThis.fetch(input, init)),
    options.concurrency ?? 6,
  );
  const images = createImageStore({
    fetch,
    timeout,
    directory: options.imageDirectory ?? DEFAULT_IMAGE_DIRECTORY,
    publicPath: options.imagePublicPath ?? DEFAULT_IMAGE_PUBLIC_PATH,
  });
  const cache = new Map<string, Promise<LinkCardData>>();

  async function resolveFavicon(url: URL, ogFavicon: string | undefined) {
    if (ogFavicon) {
      // 保存できなければ元の URL を参照する（旧プラグインと同じ）。
      return (await images.save(new URL(ogFavicon))) ?? ogFavicon;
    }
    // ページに favicon がなければ Google の favicon サービスを使う。
    // 取得できなければ（未登録のドメインは 404）favicon なしにする。
    const service = new URL('https://www.google.com/s2/favicons');
    service.searchParams.set('domain', url.hostname);
    return images.save(service);
  }

  async function resolve(url: URL): Promise<LinkCardData> {
    const og = await fetchOpenGraph(url, { fetch, timeout });
    const [faviconSrc, imageSrc] = await Promise.all([
      resolveFavicon(url, og?.faviconUrl),
      og?.imageUrl
        ? images
            .save(new URL(og.imageUrl))
            .then((saved) => saved ?? og.imageUrl)
        : undefined,
    ]);
    return {
      url,
      title: og?.title || url.hostname,
      description: og?.description || '',
      faviconSrc,
      imageSrc,
      displayUrl: displayHostname(url),
    };
  }

  return (url: URL): Promise<LinkCardData> => {
    let promise = cache.get(url.href);
    if (!promise) {
      promise = resolve(url).catch((error: unknown) => {
        // 想定外の失敗でもカードの形は保つ。
        console.warn(
          `${LOG_PREFIX} カードのデータを作れませんでした: ${url.href} (${errorMessage(error)})`,
        );
        return {
          url,
          title: url.hostname,
          description: '',
          displayUrl: displayHostname(url),
        };
      });
      cache.set(url.href, promise);
    }
    return promise;
  };
}

/**
 * リンクカードの Sätteri mdast プラグインを作る。
 *
 * ```ts
 * import { markdownToHtml } from 'satteri';
 * const { html } = await markdownToHtml(source, {
 *   mdastPlugins: [linkCard()],
 * });
 * ```
 *
 * 取得結果はプラグインのインスタンスごとにメモリーへ保持し、同じビルドの中で
 * 同じ URL を何度も取得しない。
 */
export function linkCard(options: LinkCardOptions = {}): MdastPluginDefinition {
  const resolveCard = createLinkCardResolver(options);
  return defineMdastPlugin({
    name: 'link-card',
    async paragraph(node, ctx) {
      if (ctx.parent(node)?.type !== 'root') {
        return;
      }
      const url = findLinkCardUrl(node as Paragraph);
      if (!url) {
        return;
      }
      const data = await resolveCard(new URL(url));
      ctx.replaceNode(node, { type: 'html', value: renderLinkCard(data) });
    },
  });
}
