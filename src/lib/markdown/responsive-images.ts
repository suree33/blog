import { defineHastPlugin } from 'satteri';
import type { SatteriAstroData } from '@astrojs/markdown-satteri';

// Reserve 2.5× the gutter-limited width or 3× the 36.125rem prose cap for browser downsampling.
const photoSizes = 'min(calc(250vw - 5rem), 108.375rem)';

export const responsiveMarkdownImages = defineHastPlugin({
  name: 'responsive-markdown-images',
  element: {
    filter: ['img'],
    visit(node, ctx) {
      const { src } = node.properties ?? {};
      const astro: SatteriAstroData | undefined = ctx.data.astro;
      if (
        typeof src !== 'string' ||
        !astro?.localImagePaths.has(decodeURI(src))
      ) {
        return;
      }

      const priority =
        astro.frontmatter.priorityFirstImage === true &&
        !ctx.data.hasPrioritizedMarkdownImage;
      if (/\.png$/i.test(src)) {
        ctx.setProperty(node, 'layout', 'none');
      } else {
        ctx.setProperty(node, 'sizes', photoSizes);
      }
      if (priority) {
        ctx.setProperty(node, 'priority', true);
        ctx.data.hasPrioritizedMarkdownImage = true;
      }
    },
  },
});
