import { defineHastPlugin, defineMdastPlugin, markdownToHtml } from 'satteri';
import { describe, expect, test } from 'vitest';

/**
 * Sätteri（Astro 7 のデフォルト Markdown 処理系）をテストから直接呼び出せることの確認。
 *
 * リポジトリ内で所有する Sätteri 拡張は、この `markdownToHtml` に
 * `mdastPlugins` / `hastPlugins` を渡す形で単体テストを書く。ここではその前提
 * （パッケージの解決、ネイティブバインディングの読み込み、プラグインの適用）が
 * 成り立つことを確かめる。
 */
describe('satteri の markdownToHtml', () => {
  test('Markdown を HTML に変換できる', () => {
    const { html } = markdownToHtml('# 見出し\n\n本文の段落です。');

    expect(html, '見出しが h1 に変換される').toContain('<h1>見出し</h1>');
    expect(html, '段落が p に変換される').toContain('<p>本文の段落です。</p>');
  });

  test('frontmatter を本文と分けて返す', () => {
    const { html, frontmatter } = markdownToHtml(
      '---\ntitle: テスト記事\n---\n\n本文',
    );

    expect(frontmatter, 'YAML frontmatter が取り出される').toMatchObject({
      kind: 'yaml',
    });
    expect(html, 'frontmatter は HTML に出力されない').not.toContain('title:');
    expect(html, '本文は HTML に出力される').toContain('<p>本文</p>');
  });

  test('mdast プラグインで Markdown の構文木を書き換えられる', () => {
    const stripInlineCode = defineMdastPlugin({
      name: 'strip-inline-code',
      inlineCode(node, ctx) {
        ctx.replaceNode(node, { type: 'text', value: node.value });
      },
    });

    const { html } = markdownToHtml('`let` を使う', {
      mdastPlugins: [stripInlineCode],
    });

    expect(html.trim(), 'インラインコードが通常のテキストに置き換わる').toBe(
      '<p>let を使う</p>',
    );
  });

  test('hast プラグインで HTML の構文木を書き換えられる', () => {
    const addClassToLinks = defineHastPlugin({
      name: 'add-class-to-links',
      element: {
        filter: ['a'],
        visit(node, ctx) {
          ctx.setProperty(node, 'className', ['external']);
        },
      },
    });

    const { html } = markdownToHtml('[リンク](https://example.com/)', {
      hastPlugins: [addClassToLinks],
    });

    expect(html, 'リンクに class が追加される').toContain(
      '<a href="https://example.com/" class="external">リンク</a>',
    );
  });
});
