import type { Element, ElementContent } from 'hast';
import type { ShikiTransformer } from 'shiki';

/** コードブロック全体（タイトルと `<pre>`）を包む要素のクラス名。 */
export const CODE_BLOCK_CLASS = 'code-block';

/** コードタイトルの要素のクラス名。 */
export const CODE_TITLE_CLASS = 'code-block-title';

/**
 * `title="..."` または `title='...'` を、メタ文字列の先頭か空白の直後にあるときだけ拾う。
 * （`data-title="..."` のような別のキーに含まれる `title=` は対象外）
 */
const TITLE_PATTERN = /(?:^|\s)title=(?:"([^"]*)"|'([^']*)')/;

/**
 * コードフェンスのメタ文字列（例: ```` ```ts title="foo.ts" ```` の `title="foo.ts"`）から
 * コードタイトルを取り出す。
 *
 * @param meta - 言語名の後ろに書かれたメタ文字列。メタがない場合は `undefined`
 * @returns タイトル。`title` がない、または空白だけの場合は `undefined`
 */
export function parseCodeTitle(meta: string | undefined): string | undefined {
  if (!meta) {
    return undefined;
  }

  const match = TITLE_PATTERN.exec(meta);
  const title = match?.[1] ?? match?.[2];

  return title?.trim() ? title : undefined;
}

/**
 * コードフェンスのメタ文字列にある `title` をコードタイトルとして表示する Shiki transformer。
 *
 * Shiki が生成した `<pre>` を `<div class="code-block">` で包み、タイトルがあれば
 * `<pre>` の直前に `<div class="code-block-title">` を置く。タイトルの有無で
 * コードブロックの構造（親要素）が変わらないように、タイトルがなくても常に包む。
 *
 * Astro は unified（`@astrojs/markdown-remark`）でも Sätteri（`@astrojs/markdown-satteri`）でも
 * `shikiConfig.transformers` をそのまま Shiki に渡し、フェンスのメタ文字列を
 * `options.meta.__raw` として渡す。どちらも Shiki が返した root の最初の子を
 * コードブロックの置き換えに使うため、root の子は 1 つ（このラッパー）にする。
 *
 * 詳細は `docs/code-title.md` を参照。
 */
export function transformerCodeTitle(): ShikiTransformer {
  return {
    name: 'code-title',
    root(root) {
      const pre = root.children.find(
        (child): child is Element =>
          child.type === 'element' && child.tagName === 'pre',
      );
      if (!pre) {
        return;
      }

      const title = parseCodeTitle(this.options.meta?.__raw);
      const children: ElementContent[] = [];

      if (title) {
        children.push({
          type: 'element',
          tagName: 'div',
          properties: { className: [CODE_TITLE_CLASS] },
          children: [{ type: 'text', value: title }],
        });
      }
      children.push(pre);

      const container: Element = {
        type: 'element',
        tagName: 'div',
        properties: { className: [CODE_BLOCK_CLASS] },
        children,
      };
      root.children = [container];
    },
  };
}
