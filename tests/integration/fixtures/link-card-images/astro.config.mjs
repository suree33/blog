import process from 'node:process';
import { defineConfig } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';
import { createLinkCards } from '../../../../src/lib/markdown/link-card-assets';

const cards = createLinkCards({
  fetch: async (input) => {
    const url = String(input);
    if (
      url === 'https://example.com/image.svg' &&
      process.env.FIXTURE_FAIL_IMAGE === 'true'
    )
      throw new Error('Transient image failure');
    if (url === 'https://example.com/favicon.svg') {
      if (process.env.FIXTURE_FAVICON === 'transient')
        throw new Error('Transient favicon failure');
      if (process.env.FIXTURE_FAVICON === 'html')
        return new Response('<html>Not an image</html>', {
          headers: { 'content-type': 'text/html' },
        });
    }
    if (url.endsWith('.svg')) {
      return new Response(
        '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
        {
          headers: { 'content-type': 'image/svg+xml' },
        },
      );
    }
    if (
      !['https://example.com/', 'https://unaffected.example.com/'].includes(url)
    )
      throw new Error(`Unexpected request: ${url}`);
    console.log(`Fixture metadata: ${url}`);
    if (
      url === 'https://unaffected.example.com/' &&
      process.env.FIXTURE_FAIL_UNAFFECTED === 'true'
    )
      throw new Error('Unrelated metadata must stay cached');
    return new Response(
      `<html><head><meta property="og:title" content="Fixture"><meta property="og:image" content="${url}image.svg"><link rel="icon" href="${url}favicon.svg"></head></html>`,
    );
  },
});

export default defineConfig({
  cacheDir: './cache/',
  outDir: './output/',
  markdown: { processor: satteri({ mdastPlugins: [cards.plugin] }) },
  integrations: [cards.integration],
});
