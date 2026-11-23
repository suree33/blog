import { defineHastPlugin } from 'satteri';
import type { SatteriAstroData } from '@astrojs/markdown-satteri';

const proseSizes = '(max-width: 610px) calc(100vw - 2rem), 578px';

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
      ctx.setProperty(
        node,
        'sizes',
        priority ? proseSizes : `auto, ${proseSizes}`,
      );
      if (priority) {
        ctx.setProperty(node, 'priority', true);
        ctx.data.hasPrioritizedMarkdownImage = true;
      }
    },
  },
});
