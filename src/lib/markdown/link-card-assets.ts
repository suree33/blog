import { createHash } from 'node:crypto';
import {
  access,
  cp,
  mkdir,
  readdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { AstroConfig, AstroIntegration } from 'astro';
import type { Loader } from 'astro/loaders';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';
import { linkCard, type LinkCardOptions } from './link-card';

const imageFilename = '[a-f0-9]{64}\\.[a-z0-9]+';

function imageDirectory(config: Pick<AstroConfig, 'cacheDir'>) {
  return new URL('link-card-images/', config.cacheDir);
}

export function withLinkCardImages(loader: Loader): Loader {
  return {
    ...loader,
    name: `link-card-images:${loader.name}`,
    async load(context) {
      const directory = imageDirectory(context.config);
      for (const [id, entry] of context.store.entries()) {
        const html = entry.rendered?.html ?? '';
        if (
          /<img src="https?:\/\/[^" ]+" class="link-card__(?:image|favicon)"/.test(
            html,
          )
        ) {
          context.logger.info(
            `Rebuilding content with remote link card images: ${id}`,
          );
          context.store.delete(id);
          continue;
        }
        if (/class="link-card__image"(?![^>]*decoding="async")/.test(html)) {
          context.logger.info(
            `Rebuilding content with unoptimized link card images: ${id}`,
          );
          context.store.delete(id);
          continue;
        }
        const filenames = new Set(
          Array.from(
            html.matchAll(
              new RegExp(`/link-card-images/(${imageFilename})`, 'g'),
            ),
            (match) => match[1],
          ),
        );
        for (const filename of filenames) {
          try {
            await access(new URL(filename, directory));
          } catch {
            context.logger.info(
              `Rebuilding content with missing link card images: ${id}`,
            );
            context.store.delete(id);
            break;
          }
        }
      }
      await loader.load(context);
    },
  };
}

export function createLinkCards(
  options: Omit<LinkCardOptions, 'cacheDirectory' | 'thumbnail'> = {},
) {
  let directory: URL;
  const plugin = linkCard({
    ...options,
    async thumbnail(source) {
      if (!source.startsWith('/link-card-images/')) return undefined;
      try {
        const original = await readFile(
          new URL(source.slice('/link-card-images/'.length), directory),
        );
        const hash = createHash('sha256')
          .update(original)
          .update('thumbnail-232-webp-v1')
          .digest('hex');
        const filename = `${hash}.webp`;
        const output = new URL(filename, directory);
        try {
          await access(output);
        } catch {
          await writeFile(
            output,
            await sharp(original)
              .rotate()
              .resize({
                width: 232,
                height: 232,
                fit: 'inside',
                withoutEnlargement: true,
              })
              .webp()
              .toBuffer(),
          );
        }
        const { width, height } = await sharp(
          await readFile(output),
        ).metadata();
        if (!width || !height) return undefined;
        return { src: `/link-card-images/${filename}`, width, height };
      } catch (error) {
        console.warn(`[link-card] ${source}: ${String(error)}`);
        return undefined;
      }
    },
    get cacheDirectory() {
      return fileURLToPath(directory);
    },
  });
  const integration: AstroIntegration = {
    name: 'link-card-images',
    hooks: {
      'astro:config:done': ({ config }) => {
        directory = imageDirectory(config);
      },
      'astro:server:setup': ({ server }) => {
        server.middlewares.use(async (request, response, next) => {
          const pathname = request.url?.split('?')[0] ?? '';
          const match = new RegExp(
            `^/link-card-images/(${imageFilename})$`,
          ).exec(pathname);
          if (!match || !['GET', 'HEAD'].includes(request.method ?? '')) {
            next();
            return;
          }
          try {
            const buffer = await readFile(new URL(match[1], directory));
            const type = await fileTypeFromBuffer(buffer);
            response.setHeader(
              'Content-Type',
              match[1].endsWith('.svg')
                ? 'image/svg+xml'
                : (type?.mime ?? 'application/octet-stream'),
            );
            response.setHeader('Content-Length', buffer.length);
            response.end(request.method === 'HEAD' ? undefined : buffer);
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') next();
            else next(error);
          }
        });
      },
      'astro:build:done': async ({ dir }) => {
        await mkdir(directory, { recursive: true });
        const output = new URL('link-card-images/', dir);
        await mkdir(output, { recursive: true });
        for (const filename of await readdir(directory)) {
          if (new RegExp(`^${imageFilename}$`).test(filename)) {
            await cp(new URL(filename, directory), new URL(filename, output));
          }
        }
      },
    },
  };
  return { plugin, integration };
}
