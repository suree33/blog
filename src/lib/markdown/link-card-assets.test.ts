import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { HookParameters } from 'astro';
import type { LoaderContext } from 'astro/loaders';
import { load as parseHtml } from 'cheerio';
import sharp from 'sharp';
import { markdownToHtml } from 'satteri';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createLinkCards, withLinkCardImages } from './link-card-assets';

const filename = `${'a'.repeat(64)}.svg`;
let root: string;
let cacheDir: URL;
let meta: Map<string, string>;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'link-card-assets-'));
  cacheDir = pathToFileURL(`${root}/custom-cache/`);
  meta = new Map([['link-card-thumbnail', 'thumbnail-440-webp-v1']]);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

test.each(['empty', 'present', 'missing'])(
  'loader checks cached HTML (%s)',
  async (state) => {
    const directory = new URL('link-card-images/', cacheDir);
    if (state === 'present') {
      await mkdir(directory, { recursive: true });
      await writeFile(new URL(filename, directory), '<svg/>');
    }
    const remove = vi.fn();
    const context = {
      meta,
      config: { cacheDir },
      store: {
        entries: () =>
          state === 'empty'
            ? [['unaffected', { rendered: { html: '<p>Unchanged</p>' } }]]
            : [
                [
                  'affected',
                  {
                    rendered: {
                      html: `<img src="/link-card-images/${filename}">`,
                    },
                  },
                ],
                ['unaffected', { rendered: { html: '<p>Unchanged</p>' } }],
              ],
        delete: remove,
      },
      logger: { info: vi.fn() },
    } as unknown as LoaderContext;
    const load = vi.fn(async () => {
      expect(remove.mock.calls).toEqual(
        state === 'missing' ? [['affected']] : [],
      );
    });
    await withLinkCardImages({ name: 'fixture', load }).load(context);
    expect(load).toHaveBeenCalledWith(context);
  },
);

test('loader propagates rendering errors', async () => {
  meta.set('link-card-thumbnail', 'thumbnail-232-webp-v1');
  const context = {
    meta,
    config: { cacheDir },
    store: { entries: () => [] },
  } as unknown as LoaderContext;
  const error = new Error('render failed');
  await expect(
    withLinkCardImages({
      name: 'fixture',
      load: async () => {
        throw error;
      },
    }).load(context),
  ).rejects.toBe(error);
  expect(meta.get('link-card-thumbnail')).toBe('thumbnail-232-webp-v1');
});

test.each(['image', 'favicon'])(
  'loader retries only entries with remote card images (%s)',
  async (kind) => {
    const remove = vi.fn();
    const context = {
      meta,
      config: { cacheDir },
      store: {
        entries: () => [
          [
            'affected',
            {
              rendered: {
                html: `<img src="https://example.com/image.png" class="link-card__${kind}">`,
              },
            },
          ],
          ['unaffected', { rendered: { html: '<p>Unchanged</p>' } }],
        ],
        delete: remove,
      },
      logger: { info: vi.fn() },
    } as unknown as LoaderContext;
    await withLinkCardImages({ name: 'fixture', load: vi.fn() }).load(context);
    expect(remove.mock.calls).toEqual([['affected']]);
    await withLinkCardImages({ name: 'fixture', load: vi.fn() }).load(context);
    expect(remove.mock.calls).toEqual([['affected'], ['affected']]);
  },
);

test.each([false, true])(
  'build hook copies assets on every build (empty: %s)',
  async (empty) => {
    const { integration } = createLinkCards();
    await integration.hooks['astro:config:done']?.({
      config: { cacheDir },
    } as HookParameters<'astro:config:done'>);
    if (!empty) {
      const directory = new URL('link-card-images/', cacheDir);
      await mkdir(directory, { recursive: true });
      await writeFile(new URL(filename, directory), '<svg/>');
      await writeFile(new URL('not-an-image.txt', directory), 'private');
    }
    for (const output of ['first/', 'second/']) {
      const dir = pathToFileURL(`${root}/${output}`);
      await integration.hooks['astro:build:done']?.({
        dir,
      } as HookParameters<'astro:build:done'>);
      if (!empty) {
        expect(
          await readFile(new URL(`link-card-images/${filename}`, dir), 'utf8'),
        ).toBe('<svg/>');
        await expect(
          readFile(new URL('link-card-images/not-an-image.txt', dir)),
        ).rejects.toMatchObject({ code: 'ENOENT' });
      }
    }
  },
);

test('build hook propagates output write failures', async () => {
  const { integration } = createLinkCards();
  await integration.hooks['astro:config:done']?.({
    config: { cacheDir },
  } as HookParameters<'astro:config:done'>);
  await writeFile(path.join(root, 'output'), 'not a directory');
  await expect(
    integration.hooks['astro:build:done']?.({
      dir: pathToFileURL(`${root}/output/`),
    } as HookParameters<'astro:build:done'>),
  ).rejects.toMatchObject({ code: 'ENOTDIR' });
});

test.each(['large', 'small', 'empty', 'unsupported', 'missing'])(
  'thumbnail conversion (%s)',
  async (state) => {
    const original =
      state === 'unsupported'
        ? Buffer.from('invalid image')
        : state === 'empty'
          ? Buffer.alloc(0)
          : await sharp({
              create: {
                width: state === 'small' ? 32 : 480,
                height: state === 'small' ? 16 : 480,
                channels: 3,
                background: '#2288aa',
              },
            })
              .png()
              .toBuffer();
    const requests = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      const url = String(input);
      if (url.endsWith('/image.png'))
        return new Response(original, {
          headers: { 'content-type': 'image/png' },
        });
      return new Response(
        `<html><head><title>Card</title><link rel="icon" href="https://example.com/image.png">${state === 'missing' ? '' : '<meta property="og:image" content="https://example.com/image.png">'}</head></html>`,
      );
    });
    const { plugin, integration } = createLinkCards({ fetch: requests });
    await integration.hooks['astro:config:done']?.({
      config: { cacheDir },
    } as HookParameters<'astro:config:done'>);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const { html } = await markdownToHtml('https://example.com/', {
        mdastPlugins: [plugin],
      });
      const image = parseHtml(html)('.link-card__image');
      if (state === 'empty' || state === 'missing')
        expect(image).toHaveLength(0);
      else if (state === 'unsupported') {
        expect(image.attr('src')).toMatch(/\.png$/);
        expect(warn).toHaveBeenCalled();
      } else {
        const source = image.attr('src');
        if (!source) throw new Error('Missing thumbnail source');
        const bytes = await readFile(new URL(source.slice(1), cacheDir));
        expect(await sharp(bytes).metadata()).toMatchObject({
          format: 'webp',
          width: state === 'small' ? 32 : 440,
          height: state === 'small' ? 16 : 440,
        });
        expect(image.attr('width')).toBe(state === 'small' ? '32' : '440');
        expect(image.attr('height')).toBe(state === 'small' ? '16' : '440');
        expect(image.attr('loading')).toBe('lazy');
        expect(image.attr('decoding')).toBe('async');
        expect(parseHtml(html)('.link-card__favicon').attr('src')).toMatch(
          /\.png$/,
        );
        const cached = await markdownToHtml('https://example.com/', {
          mdastPlugins: [plugin],
        });
        expect(cached.html).toBe(html);
        expect(requests).toHaveBeenCalledTimes(2);
      }
    } finally {
      warn.mockRestore();
    }
  },
);

test('loader migrates thumbnails once and keeps failed-conversion fallbacks on warm loads', async () => {
  meta.clear();
  const directory = new URL('link-card-images/', cacheDir);
  await mkdir(directory, { recursive: true });
  await writeFile(new URL(filename, directory), '<svg/>');
  const fallbackFilename = `${'b'.repeat(64)}.png`;
  await writeFile(new URL(fallbackFilename, directory), 'invalid image');
  const remove = vi.fn();
  const context = {
    meta,
    config: { cacheDir },
    store: {
      entries: () => [
        [
          'fallback',
          {
            rendered: {
              html: `<img src="/link-card-images/${fallbackFilename}" class="link-card__image" alt="">`,
            },
          },
        ],
        [
          'new',
          {
            rendered: {
              html: `<img src="/link-card-images/${filename}" class="link-card__image" width="1" height="1" loading="lazy" decoding="async" alt="">`,
            },
          },
        ],
      ],
      delete: remove,
    },
    logger: { info: vi.fn() },
  } as unknown as LoaderContext;
  const loader = withLinkCardImages({ name: 'fixture', load: vi.fn() });
  await loader.load(context);
  expect(remove.mock.calls).toEqual([['fallback'], ['new']]);
  expect(meta.get('link-card-thumbnail')).toBe('thumbnail-440-webp-v1');
  remove.mockClear();
  await loader.load(context);
  expect(remove).not.toHaveBeenCalled();
});

test.each([undefined, 'thumbnail-232-webp-v1', 'thumbnail-440-webp-v1'])(
  'loader migrates cached thumbnail settings (%s)',
  async (version) => {
    if (version) meta.set('link-card-thumbnail', version);
    else meta.clear();
    const directory = new URL('link-card-images/', cacheDir);
    await mkdir(directory, { recursive: true });
    await writeFile(new URL(filename, directory), '<svg/>');
    const remove = vi.fn();
    const context = {
      meta,
      config: { cacheDir },
      store: {
        entries: () => [
          [
            'thumbnail',
            {
              rendered: {
                html: `<img src="/link-card-images/${filename}" class="link-card__image" decoding="async">`,
              },
            },
          ],
          ['unaffected', { rendered: { html: '<p>Unchanged</p>' } }],
        ],
        delete: remove,
      },
      logger: { info: vi.fn() },
    } as unknown as LoaderContext;
    await withLinkCardImages({ name: 'fixture', load: vi.fn() }).load(context);
    expect(remove.mock.calls).toEqual(
      version === 'thumbnail-440-webp-v1' ? [] : [['thumbnail']],
    );
    expect(meta.get('link-card-thumbnail')).toBe('thumbnail-440-webp-v1');
  },
);
