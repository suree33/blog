import partytown from '@astrojs/partytown';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { unified } from '@astrojs/markdown-remark';
import icon from 'astro-icon';
import { defineConfig } from 'astro/config';
import rehypeCallouts from 'rehype-callouts';
import remarkLinkCard from 'remark-link-card-plus';

import { transformerCodeTitle } from './src/lib/markdown/code-title.ts';

const POSTS_MARKDOWN_LAYOUT = '@layouts/MarkdownPostLayout.astro';
const POSTS_MARKDOWN_PAGE_PATTERN =
  /(^|[/\\])src[/\\]pages[/\\]posts[/\\].+\.md$/;

function postsDefaultLayout() {
  return (_tree, file) => {
    const filePath = file.history[0];
    const frontmatter = file.data.astro?.frontmatter;

    if (!filePath || !frontmatter) {
      return;
    }

    if (POSTS_MARKDOWN_PAGE_PATTERN.test(filePath) && !frontmatter.layout) {
      frontmatter.layout = POSTS_MARKDOWN_LAYOUT;
    }
  };
}

// https://astro.build/config
export default defineConfig({
  site: 'https://sur33.com/',
  redirects: {
    '/posts': '/',
  },
  markdown: {
    processor: unified({
      remarkPlugins: [
        postsDefaultLayout,
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
