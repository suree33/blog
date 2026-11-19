import { createHash } from 'node:crypto';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileTypeFromBuffer } from 'file-type';
import openGraph from 'open-graph-scraper';
import sanitizeHtml from 'sanitize-html';
import { defineMdastPlugin, type MdastNode } from 'satteri';

export interface LinkCardOptions {
  fetch?: typeof globalThis.fetch;
  cacheDirectory: string;
  timeout?: number;
}

function sameUrl(a: string, b: string) {
  try {
    return new URL(a).href === new URL(b).href;
  } catch {
    return false;
  }
}

function cardUrl(node: Readonly<MdastNode>): string | undefined {
  if (node.type === 'link') {
    const [child] = node.children;
    return node.children.length === 1 &&
      child?.type === 'text' &&
      sameUrl(node.url, child.value)
      ? node.url
      : undefined;
  }
  if (
    node.type === 'text' &&
    URL.canParse(node.value) &&
    /^(https?:\/\/[^\s/$.?#].[^\s]*)$/i.test(node.value)
  ) {
    return node.value;
  }
  if ('children' in node) {
    for (const child of node.children) {
      const url = cardUrl(child);
      if (url) return url;
    }
  }
  return undefined;
}

function attribute(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

interface CardData {
  url: URL;
  title: string;
  description: string;
  favicon?: string;
  image?: string;
}

function renderCard(data: CardData) {
  let hostname = data.url.hostname;
  try {
    hostname = decodeURI(hostname);
  } catch {
    // Keep the original hostname if decoding fails.
  }
  return `<div class="link-card__container">
  <a href="${attribute(data.url.href)}" target="_blank" rel="noreferrer noopener" class="link-card__card">
    <div class="link-card__main">
      <div class="link-card__content">
        <div class="link-card__title">${sanitizeHtml(data.title)}</div>
        <div class="link-card__description">${sanitizeHtml(data.description)}</div>
      </div>
      <div class="link-card__meta">
        ${data.favicon ? `<img src="${attribute(data.favicon)}" class="link-card__favicon" width="14" height="14" alt="">` : ''}
        <span class="link-card__url">${sanitizeHtml(hostname)}</span>
      </div>
    </div>
    ${data.image ? `<div class="link-card__thumbnail"><img src="${attribute(data.image)}" class="link-card__image" alt=""></div>` : ''}
  </a>
</div>`;
}

export function linkCard(options: LinkCardOptions) {
  const fetch = options.fetch ?? globalThis.fetch;
  const timeout = options.timeout ?? 10_000;
  const cards = new Map<string, Promise<string | undefined>>();
  const images = new Map<string, Promise<string | undefined>>();
  const warn = (url: string, error: unknown) =>
    console.warn(`[link-card] ${url}: ${String(error)}`);

  async function cacheImage(
    url: string,
    thumbnail: boolean,
  ): Promise<string | undefined> {
    try {
      const directory = options.cacheDirectory;
      const hash = createHash('sha256').update(decodeURI(url)).digest('hex');
      await mkdir(directory, { recursive: true });
      const cached = (await readdir(directory)).find((file) =>
        file.startsWith(`${hash}.`),
      );
      if (cached) return `/link-card-images/${cached}`;
      const response = await fetch(url, {
        signal: AbortSignal.timeout(timeout),
      });
      const contentType = response.headers.get('content-type') ?? '';
      const buffer = Buffer.from(await response.arrayBuffer());
      const detectedType = await fileTypeFromBuffer(buffer);
      if (detectedType && !detectedType.mime.startsWith('image/')) {
        if (thumbnail) {
          warn(url, new Error('Not an image'));
          return undefined;
        }
        throw new Error('Not an image');
      }
      if (
        thumbnail &&
        !contentType.toLowerCase().startsWith('image/') &&
        !detectedType?.mime.startsWith('image/')
      ) {
        warn(url, new Error('Not an image'));
        return undefined;
      }
      const extension = contentType.startsWith('image/svg+xml')
        ? 'svg'
        : (detectedType?.ext ??
          (contentType.startsWith('image/') ? 'png' : undefined));
      if (!extension) throw new Error('Not an image');
      const filename = `${hash}.${extension}`;
      await writeFile(path.join(directory, filename), buffer);
      return `/link-card-images/${filename}`;
    } catch (error) {
      warn(url, error);
      return url;
    }
  }

  function image(url: string, thumbnail = false) {
    const key = `${thumbnail}:${url}`;
    let pending = images.get(key);
    if (!pending) {
      pending = cacheImage(url, thumbnail);
      images.set(key, pending);
    }
    return pending;
  }

  async function metadata(url: URL) {
    try {
      if (options.fetch) {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(timeout),
          headers: { Origin: url.href, Accept: 'text/html' },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const charset = /charset=([^;\s]+)/i.exec(
          response.headers.get('content-type') ?? '',
        )?.[1];
        const html = new TextDecoder(charset).decode(
          await response.arrayBuffer(),
        );
        return (await openGraph({ html })).result;
      }
      return (await openGraph({ url: url.href, timeout: timeout / 1000 }))
        .result;
    } catch (error) {
      warn(url.href, error);
      return undefined;
    }
  }

  async function resolve(url: URL) {
    const og = await metadata(url);
    let favicon = og?.favicon;
    if (favicon) {
      try {
        favicon = new URL(favicon, url.origin).href;
      } catch (error) {
        warn(favicon, error);
        favicon = undefined;
      }
    }
    if (!favicon) {
      const fallback = `https://www.google.com/s2/favicons?domain=${url.hostname}`;
      try {
        const response = await fetch(fallback, {
          method: 'HEAD',
          signal: AbortSignal.timeout(timeout),
        });
        if (response.ok) favicon = fallback;
      } catch (error) {
        warn(fallback, error);
        return undefined;
      }
    }
    const ogImage = og?.ogImage?.[0]?.url;
    const [faviconSrc, imageSrc] = await Promise.all([
      favicon ? image(new URL(favicon).href) : undefined,
      ogImage && URL.canParse(ogImage)
        ? image(new URL(ogImage).href, true)
        : undefined,
    ]);
    return renderCard({
      url,
      title: og?.ogTitle || url.hostname,
      description: og?.ogDescription || '',
      favicon: faviconSrc,
      image: imageSrc,
    });
  }

  return defineMdastPlugin({
    name: 'link-card',
    async paragraph(node, ctx) {
      if (ctx.parent(node)?.type !== 'root' || node.children.length !== 1)
        return;
      const url = cardUrl(node.children[0]);
      if (!url) return;
      const key = new URL(url).href;
      let pending = cards.get(key);
      if (!pending) {
        pending = resolve(new URL(key)).catch((error: unknown) => {
          warn(key, error);
          return renderCard({
            url: new URL(key),
            title: new URL(key).hostname,
            description: '',
          });
        });
        cards.set(key, pending);
      }
      const html = await pending;
      if (html !== undefined)
        ctx.replaceNode(node, { type: 'html', value: html });
    },
  });
}
