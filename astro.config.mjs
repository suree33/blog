import { satteri } from '@astrojs/markdown-satteri';
import partytown from '@astrojs/partytown';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import icon from 'astro-icon';
import { defineConfig } from 'astro/config';

import { calloutPlugin } from './src/lib/markdown/callout.ts';
import { transformerCodeTitle } from './src/lib/markdown/code-title.ts';
import { linkCard } from './src/lib/markdown/link-card.ts';

// https://astro.build/config
export default defineConfig({
  site: 'https://sur33.com/',
  redirects: {
    '/posts': '/',
  },
  markdown: {
    // Astro 7 の既定の Markdown 処理系 Sätteri に、リポジトリ内の拡張を追加する。
    // 詳細は docs/adr/0001-markdown-processor-satteri.md を参照。
    processor: satteri({
      mdastPlugins: [linkCard()],
      hastPlugins: [calloutPlugin],
    }),
    shikiConfig: {
      themes: {
        dark: 'github-dark',
        light: 'github-light',
      },
      defaultColor: 'light-dark()',
      transformers: [transformerCodeTitle()],
    },
  },
  vite: {
    plugins: [tailwindcss()],
    server: {
      allowedHosts: ['quokka', 'quokka.local'],
    },
  },
  integrations: [
    sitemap(),
    icon(),
    partytown({
      config: {
        forward: ['dataLayer.push'],
      },
    }),
  ],
});
