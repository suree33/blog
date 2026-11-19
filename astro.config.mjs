import partytown from '@astrojs/partytown';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { unified } from '@astrojs/markdown-remark';
import icon from 'astro-icon';
import { defineConfig } from 'astro/config';
import rehypeCallouts from 'rehype-callouts';
import remarkLinkCard from 'remark-link-card-plus';

import { codeTitleTransformer } from './src/lib/code-title.ts';

// https://astro.build/config
export default defineConfig({
  site: 'https://sur33.com/',
  redirects: {
    '/posts': '/',
  },
  markdown: {
    processor: unified({
      remarkPlugins: [
        [
          remarkLinkCard,
          {
            cache: true,
          },
        ],
      ],
      rehypePlugins: [rehypeCallouts],
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
