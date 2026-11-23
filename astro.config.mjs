import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { satteri } from '@astrojs/markdown-satteri';
import icon from 'astro-icon';
import { defineConfig } from 'astro/config';
import process from 'node:process';

import { createLinkCards } from './src/lib/markdown/link-card-assets.ts';
import { requireImageAlt } from './src/lib/markdown/require-image-alt.ts';
import { responsiveMarkdownImages } from './src/lib/markdown/responsive-images.ts';
import { satteriCallouts } from './src/lib/satteri-callouts.ts';
import { codeTitleTransformer } from './src/lib/code-title.ts';

const linkCards = createLinkCards();

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
      mdastPlugins: [
        // Validate authored HTML before link cards generate decorative images.
        requireImageAlt(
          new URL('./src/content/posts/', import.meta.url),
          new URL('./tests/e2e/fixtures/posts/', import.meta.url),
        ),
        linkCards.plugin,
      ],
      hastPlugins: [satteriCallouts, responsiveMarkdownImages],
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
  integrations: [linkCards.integration, sitemap(), icon()],
});
