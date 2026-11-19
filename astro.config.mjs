import partytown from '@astrojs/partytown';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { satteri } from '@astrojs/markdown-satteri';
import icon from 'astro-icon';
import { defineConfig } from 'astro/config';
import process from 'node:process';

import { linkCard } from './src/lib/markdown/link-card.ts';
import { satteriCallouts } from './src/lib/satteri-callouts.ts';
import { codeTitleTransformer } from './src/lib/code-title.ts';

// https://astro.build/config
export default defineConfig({
  cacheDir:
    process.env.E2E_DRAFT_FIXTURE === 'true'
      ? './node_modules/.astro-e2e'
      : './node_modules/.astro',
  site: 'https://sur33.com/',
  redirects: {
    '/posts': '/',
  },
  markdown: {
    processor: satteri({
      mdastPlugins: [linkCard()],
      hastPlugins: [satteriCallouts],
    }),
    shikiConfig: {
      themes: {
        dark: 'github-dark',
        light: 'github-light',
      },
      defaultColor: 'light-dark()',
      transformers: [codeTitleTransformer],
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
