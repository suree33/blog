import { defineConfig } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';
import { createLinkCards } from '../../../../src/lib/markdown/link-card-assets';

const cards = createLinkCards({
  fetch: async (input) => {
    const url = String(input);
    if (url.endsWith('.svg')) {
      return new Response(
        '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
        {
          headers: { 'content-type': 'image/svg+xml' },
        },
      );
    }
    if (url !== 'https://example.com/')
      throw new Error(`Unexpected request: ${url}`);
    return new Response(
      '<html><head><meta property="og:title" content="Fixture"><meta property="og:image" content="https://example.com/image.svg"><link rel="icon" href="https://example.com/favicon.svg"></head></html>',
    );
  },
});

export default defineConfig({
  cacheDir: './cache/',
  outDir: './output/',
  markdown: { processor: satteri({ mdastPlugins: [cards.plugin] }) },
  integrations: [cards.integration],
});
