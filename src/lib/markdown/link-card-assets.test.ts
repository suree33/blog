import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { HookParameters } from 'astro';
import type { LoaderContext } from 'astro/loaders';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createLinkCards, withLinkCardImages } from './link-card-assets';

const filename = `${'a'.repeat(64)}.svg`;
let root: string;
let cacheDir: URL;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'link-card-assets-'));
  cacheDir = pathToFileURL(`${root}/custom-cache/`);
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
    const clear = vi.fn();
    const context = {
      config: { cacheDir },
      store: {
        values: () =>
          state === 'empty'
            ? []
            : [
                {
                  rendered: {
                    html: `<img src="/link-card-images/${filename}">`,
                  },
                },
              ],
        clear,
      },
      logger: { info: vi.fn() },
    } as unknown as LoaderContext;
    const load = vi.fn(async () => {
      expect(clear).toHaveBeenCalledTimes(state === 'missing' ? 1 : 0);
    });
    await withLinkCardImages({ name: 'fixture', load }).load(context);
    expect(load).toHaveBeenCalledWith(context);
  },
);

test('loader propagates rendering errors', async () => {
  const context = {
    config: { cacheDir },
    store: { values: () => [] },
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
});

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
