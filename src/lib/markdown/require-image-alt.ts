import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseFragment, type DefaultTreeAdapterTypes } from 'parse5';
import {
  defineMdastPlugin,
  type MdastNode,
  type PluginFactoryContext,
} from 'satteri';

type ImageNode = Extract<MdastNode, { type: 'image' | 'imageReference' }>;

function findImageWithoutAlt(
  node: DefaultTreeAdapterTypes.Node,
): DefaultTreeAdapterTypes.Element | undefined {
  if (
    'tagName' in node &&
    node.tagName === 'img' &&
    !node.attrs.find(({ name }) => name === 'alt')?.value.trim()
  ) {
    return node;
  }
  if ('content' in node) return findImageWithoutAlt(node.content);
  if ('childNodes' in node) {
    for (const child of node.childNodes) {
      const image = findImageWithoutAlt(child);
      if (image) return image;
    }
  }
}

export function requireImageAlt(...directories: URL[]) {
  return ({ fileURL, source }: PluginFactoryContext) => {
    if (
      fileURL?.protocol !== 'file:' ||
      !directories.some(
        (directory) => directory.href === new URL('.', fileURL).href,
      )
    ) {
      return;
    }
    const path = fileURLToPath(fileURL);

    function fail(message: string, bodyLine?: number) {
      let location = path;
      if (bodyLine !== undefined) {
        // Astro passes the trimmed body; match it against the end of the file.
        const file = readFileSync(path, 'utf8').trimEnd();
        const body = source.trimEnd();
        if (file.endsWith(body)) {
          const prefix = file.slice(0, file.length - body.length);
          const precedingLines = prefix.match(/\r\n?|\n/g)?.length ?? 0;
          location += `:${precedingLines + bodyLine}`;
        }
      }
      throw new Error(`${location}: ${message}`);
    }

    function validate(node: Readonly<ImageNode>) {
      if (!node.alt?.trim()) {
        fail(
          'Markdown images need non-empty alt text.',
          node.position?.start.line,
        );
      }
    }

    return defineMdastPlugin({
      name: 'require-image-alt',
      options: { position: true },
      image: validate,
      imageReference: validate,
      html(node) {
        const fragment = parseFragment(node.value, {
          scriptingEnabled: false,
          sourceCodeLocationInfo: true,
        });
        const image = findImageWithoutAlt(fragment);
        if (!image) return;
        const blockLine = node.position?.start.line;
        const imageLine = image.sourceCodeLocation?.startLine ?? 1;
        fail(
          'HTML images need non-empty alt text.',
          blockLine === undefined ? undefined : blockLine + imageLine - 1,
        );
      },
    });
  };
}
