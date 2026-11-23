import { defineHastPlugin } from 'satteri';

const widths = [360, 580, 720, 1080, 1160, 1440, 1740];
const proseSizes = '(max-width: 610px) calc(100vw - 2rem), 578px';
const aboutHero = '../assets/images/daiki-sato-xzItvPFgpBQ-unsplash.jpg';

export const responsiveMarkdownImages = defineHastPlugin({
  name: 'responsive-markdown-images',
  element: {
    filter: ['img'],
    visit(node, ctx) {
      const { src } = node.properties ?? {};
      if (typeof src !== 'string' || src.startsWith('/') || URL.canParse(src)) {
        return;
      }

      const eager = src === aboutHero;
      ctx.setProperty(node, 'widths', widths);
      ctx.setProperty(
        node,
        'sizes',
        eager ? proseSizes : `auto, ${proseSizes}`,
      );
      ctx.setProperty(node, 'loading', eager ? 'eager' : 'lazy');
      if (eager) ctx.setProperty(node, 'fetchpriority', 'high');
    },
  },
});
