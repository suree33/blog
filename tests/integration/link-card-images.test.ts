import { execFile, spawn } from 'node:child_process';
import {
  cp,
  mkdtemp,
  readFile,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';

const exec = promisify(execFile);
const repository = fileURLToPath(new URL('../../', import.meta.url));
const cli = path.join(repository, 'node_modules/astro/bin/astro.mjs');
const assets = path.join(repository, 'src/lib/markdown/link-card-assets.ts');
const env = { ...process.env, VITEST: undefined, NODE_ENV: undefined };

test('clean, cached, and missing-image builds preserve HTML and assets; dev serves images', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'link-card-build-'));
  try {
    await cp(new URL('./fixtures/link-card-images/', import.meta.url), root, {
      recursive: true,
    });
    await symlink(
      path.join(repository, 'node_modules'),
      path.join(root, 'node_modules'),
      'dir',
    );
    for (const [file, original] of [
      ['astro.config.mjs', '../../../../src/lib/markdown/link-card-assets'],
      [
        'src/content.config.ts',
        '../../../../../src/lib/markdown/link-card-assets',
      ],
    ]) {
      if (file.endsWith('.ts'))
        await rename(path.join(root, `${file}.fixture`), path.join(root, file));
      const content = await readFile(path.join(root, file), 'utf8');
      await writeFile(path.join(root, file), content.replace(original, assets));
    }
    await rename(
      path.join(root, 'src/pages/index.astro.fixture'),
      path.join(root, 'src/pages/index.astro'),
    );
    let baseline: string | undefined;
    let sources: string[] = [];
    for (const state of ['clean', 'warm', 'missing']) {
      if (state === 'missing')
        await rm(path.join(root, 'cache/link-card-images'), {
          recursive: true,
        });
      const { stdout } = await exec(
        process.execPath,
        [cli, 'build', '--root', root],
        { cwd: repository, env },
      );
      if (state === 'missing')
        expect(stdout).toContain(
          'Rebuilding content with missing link card images',
        );
      const html = await readFile(path.join(root, 'output/index.html'), 'utf8');
      baseline ??= html;
      expect(html).toBe(baseline);
      sources = [...html.matchAll(/src="(\/link-card-images\/[^" ]+)"/g)].map(
        (match) => match[1],
      );
      expect(sources).toHaveLength(2);
      for (const source of sources) {
        expect(await readFile(path.join(root, 'output', source))).toEqual(
          await readFile(path.join(root, 'cache', source)),
        );
      }
    }
    const server = spawn(
      process.execPath,
      [cli, 'dev', '--root', root, '--port', '0'],
      { cwd: repository, env, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let serverOutput = '';
    server.stderr.on('data', (data: Buffer) => {
      serverOutput += data.toString();
    });
    try {
      const origin = await new Promise<string>((resolve, reject) => {
        let output = '';
        const timeout = setTimeout(() => reject(new Error(output)), 30_000);
        server.stdout.on('data', (data: Buffer) => {
          output += data.toString();
          serverOutput += data.toString();
          const match = /http:\/\/localhost:(\d+)/.exec(output);
          if (match) {
            clearTimeout(timeout);
            resolve(match[0]);
          }
        });
        server.once('error', reject);
        server.once('exit', (code) => {
          clearTimeout(timeout);
          reject(new Error(`Dev exited ${code}: ${output}`));
        });
      });
      const page = await fetch(origin);
      expect(page.status, `${serverOutput}\n${await page.text()}`).toBe(200);
      for (const source of sources) {
        const response = await fetch(`${origin}${source}`);
        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toBe('image/svg+xml');
        expect(await response.text()).toContain('<svg');
        const head = await fetch(`${origin}${source}`, { method: 'HEAD' });
        expect(head.status).toBe(200);
        expect(await head.text()).toBe('');
      }
      expect(
        (await fetch(`${origin}/link-card-images/${'f'.repeat(64)}.svg`))
          .status,
      ).toBe(404);
      expect(
        (await fetch(`${origin}/link-card-images/astro.config.mjs`)).status,
      ).toBe(404);
    } finally {
      server.kill('SIGTERM');
      await new Promise<void>((resolve) => {
        if (server.exitCode !== null) resolve();
        else server.once('exit', () => resolve());
      });
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 90_000);
