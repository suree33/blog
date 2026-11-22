import { fileURLToPath } from 'node:url';
import {
  defineMdastPlugin,
  htmlToHast,
  type HastNode,
  type MdastNode,
  type PluginFactoryContext,
} from 'satteri';

type ImageNode = Extract<MdastNode, { type: 'image' | 'imageReference' }>;

function hasImageWithoutAlt(node: HastNode): boolean {
  if (node.type === 'element' && node.tagName === 'img') {
    const { alt } = node.properties;
    return typeof alt !== 'string' || !alt.trim();
  }
  return 'children' in node && node.children.some(hasImageWithoutAlt);
}

export function requireImageAlt(...directories: URL[]) {
  return ({ fileURL }: PluginFactoryContext) => {
    if (
      fileURL?.protocol !== 'file:' ||
      !directories.some(
        (directory) => directory.href === new URL('.', fileURL).href,
      )
    ) {
      return;
    }
    const path = fileURLToPath(fileURL);

    function validate(node: Readonly<ImageNode>) {
      if (!node.alt?.trim()) {
        const line = node.position?.start.line;
        const location = line === undefined ? '' : ` (Markdown line ${line})`;
        throw new Error(
          `${path}${location}: Markdown images need non-empty alt text.`,
        );
      }
    }

    return defineMdastPlugin({
      name: 'require-image-alt',
      options: { position: true },
      image: validate,
      imageReference: validate,
      html(node) {
        if (!hasImageWithoutAlt(htmlToHast(node.value, { fragment: true })))
          return;
        const line = node.position?.start.line;
        const location =
          line === undefined ? '' : ` (Markdown HTML starts on line ${line})`;
        throw new Error(
          `${path}${location}: HTML images need non-empty alt text.`,
        );
      },
    });
  };
}
