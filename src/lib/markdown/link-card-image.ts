import { createHash } from 'node:crypto';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { errorMessage, type FetchLike } from './link-card-metadata';

/**
 * リンクカードの画像（favicon・サムネイル）をビルド時にダウンロードして保存する。
 *
 * 保存先は `public/` 配下の gitignore 済みディレクトリで、ファイル名は
 * 画像 URL（`decodeURI` したもの）の SHA-256 + 拡張子にする。同じ名前のファイルが
 * あればダウンロードせずに再利用する。詳細は `docs/markdown-link-cards.md` を参照。
 */

const LOG_PREFIX = '[link-card]';

/** 既定の保存先（`public/link-card-images/`）。 */
export const DEFAULT_IMAGE_DIRECTORY = path.join(
  process.cwd(),
  'public',
  'link-card-images',
);
/** 既定の保存先をサイトから参照するときのパス。 */
export const DEFAULT_IMAGE_PUBLIC_PATH = '/link-card-images/';

const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'image/bmp': '.bmp',
  'image/x-icon': '.ico',
  'image/vnd.microsoft.icon': '.ico',
  'image/svg+xml': '.svg',
};

function startsWithBytes(bytes: Uint8Array, signature: number[], offset = 0) {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

/** 先頭のバイト列から画像形式を判定する。判定できなければ `undefined`。 */
export function sniffImageExtension(bytes: Uint8Array): string | undefined {
  if (startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47])) return '.png';
  if (startsWithBytes(bytes, [0xff, 0xd8, 0xff])) return '.jpg';
  if (startsWithBytes(bytes, [0x47, 0x49, 0x46, 0x38])) return '.gif';
  if (
    startsWithBytes(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWithBytes(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return '.webp';
  }
  if (startsWithBytes(bytes, [0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69], 4)) {
    return '.avif';
  }
  if (startsWithBytes(bytes, [0x00, 0x00, 0x01, 0x00])) return '.ico';
  if (startsWithBytes(bytes, [0x42, 0x4d])) return '.bmp';
  return undefined;
}

/**
 * 保存するファイルの拡張子を決める。SVG は Content-Type で、それ以外は先頭バイトで
 * 判定し、判定できなければ Content-Type から決める。画像でなければ `undefined`。
 */
export function imageExtension(
  contentType: string | null,
  bytes: Uint8Array,
): string | undefined {
  const mime = contentType?.split(';')[0]?.trim().toLowerCase() ?? '';
  if (mime === 'image/svg+xml') {
    return '.svg';
  }
  const sniffed = sniffImageExtension(bytes);
  if (sniffed) {
    return sniffed;
  }
  if (mime.startsWith('image/')) {
    // 旧プラグインと同じく、判定できない画像は .png として保存する。
    return CONTENT_TYPE_EXTENSIONS[mime] ?? '.png';
  }
  return undefined;
}

/** 画像 URL から保存ファイル名（拡張子なし）を求める。 */
export function imageFileStem(url: URL): string {
  let key = url.href;
  try {
    key = decodeURI(url.href);
  } catch {
    // decodeURI できない URL はそのままハッシュする。
  }
  return createHash('sha256').update(key).digest('hex');
}

export interface ImageStoreOptions {
  fetch: FetchLike;
  timeout: number;
  /** 保存先ディレクトリ（絶対パス）。 */
  directory: string;
  /** 保存先をサイトから参照するときのパス（末尾は `/`）。 */
  publicPath: string;
}

export interface ImageStore {
  /**
   * 画像を保存してサイト内のパスを返す。保存できなかったときは警告を出して
   * `undefined` を返す。
   */
  save(url: URL): Promise<string | undefined>;
}

export function createImageStore({
  fetch,
  timeout,
  directory,
  publicPath,
}: ImageStoreOptions): ImageStore {
  const pending = new Map<string, Promise<string | undefined>>();

  async function findCached(stem: string): Promise<string | undefined> {
    try {
      const files = await readdir(directory);
      return files.find((file) => file.startsWith(`${stem}.`));
    } catch {
      return undefined;
    }
  }

  async function download(url: URL): Promise<string | undefined> {
    const stem = imageFileStem(url);
    const cached = await findCached(stem);
    if (cached) {
      return `${publicPath}${cached}`;
    }
    try {
      const response = await fetch(url.href, {
        signal: AbortSignal.timeout(timeout),
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(`HTTP ${response.status}`);
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      const extension = imageExtension(
        response.headers.get('content-type'),
        bytes,
      );
      if (!extension) {
        throw new Error('画像ではない応答です');
      }
      const filename = `${stem}${extension}`;
      await mkdir(directory, { recursive: true });
      await writeFile(path.join(directory, filename), bytes);
      return `${publicPath}${filename}`;
    } catch (error) {
      console.warn(
        `${LOG_PREFIX} 画像を保存できませんでした: ${url.href} (${errorMessage(error)})`,
      );
      return undefined;
    }
  }

  return {
    save(url) {
      const key = url.href;
      let promise = pending.get(key);
      if (!promise) {
        promise = download(url);
        pending.set(key, promise);
      }
      return promise;
    },
  };
}
