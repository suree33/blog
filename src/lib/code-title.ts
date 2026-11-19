import type { ShikiConfig } from 'astro';

export const codeTitleTransformer: NonNullable<
  ShikiConfig['transformers']
>[number] = {
  name: 'blog:code-title',
  root(tree) {
    const [pre] = tree.children;
    if (pre?.type !== 'element' || pre.tagName !== 'pre') return;

    const title = this.options.meta?.__raw
      ?.match(/(?:^|\s)title="([^"]*)"(?=\s|$)/)?.[1]
      .trim();
    const wrapper: typeof pre = {
      type: 'element',
      tagName: 'div',
      properties: { className: ['remark-code-container'] },
      children: [pre],
    };

    if (title) {
      wrapper.children.unshift({
        type: 'element',
        tagName: 'div',
        properties: { className: ['remark-code-title'] },
        children: [{ type: 'text', value: title }],
      });
    }

    tree.children[0] = wrapper;
  },
};
