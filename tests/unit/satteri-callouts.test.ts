import { readFileSync } from 'node:fs';
import { load } from 'cheerio';
import { markdownToHtml } from 'satteri';
import { describe, expect, test } from 'vitest';
import { satteriCallouts } from '../../src/lib/satteri-callouts';

function render(markdown: string) {
  const { html } = markdownToHtml(markdown, {
    hastPlugins: [satteriCallouts],
  });
  return html;
}

function postCallouts(slug: string) {
  const file = new URL(`../../src/content/posts/${slug}.md`, import.meta.url);
  return readFileSync(file, 'utf8').match(/^> \[![^\n]+(?:\n>[^\n]*)*/gm) ?? [];
}

describe('Sätteri Callout', () => {
  test.each([
    ['resolve-sidekick-nvim-codex-search-error', ['info', 'note', 'note']],
    ['setup-obsidian-livesync', ['warning']],
  ] as const)(
    '%s の Callout が unified と同じ HTML になる',
    async (slug, types) => {
      const samples = postCallouts(slug);
      expect(samples).toHaveLength(types.length);

      for (const [index, sample] of samples.entries()) {
        const $new = load(render(sample), {}, false);
        const replacement = $new('.callout');

        expect(replacement).toHaveLength(1);
        expect(replacement.attr('data-callout')).toBe(types[index]);
        expect(replacement.attr()).toEqual({
          class: 'callout',
          'data-callout': types[index],
          'data-collapsible': 'false',
        });
        expect(replacement.html()).toMatchSnapshot(`${slug}-${index}`);
      }
    },
  );

  test.each([
    ['note', 'Note'],
    ['tip', 'Tip'],
    ['important', 'Important'],
    ['warning', 'Warning'],
    ['caution', 'Caution'],
    ['info', 'Info'],
  ])('%s の既定タイトルと装飾アイコンを描画する', (type, title) => {
    const $ = load(render(`> [!${type}]\n> 本文`));

    expect($('.callout').attr('data-callout')).toBe(type);
    expect($('.callout-title-text').text()).toBe(title);
    expect($('.callout-title-icon[aria-hidden="true"] svg')).toHaveLength(1);
    expect($('.callout-content p').text()).toBe('本文');
  });

  test('カスタムタイトルの強調、強制改行、複数段落とリストを保持する', () => {
    const $ = load(
      render('> [!NOTE] **タイトル**  \n> 本文\n>\n> 次の段落\n>\n> - 項目'),
    );

    expect($('.callout-title-text strong').text()).toBe('タイトル');
    expect(
      $('.callout-content > p')
        .map((_, el) => $(el).text())
        .get(),
    ).toEqual(['本文', '次の段落']);
    expect($('.callout-content > ul > li').text()).toBe('項目');
  });

  test('タイトルと本文にまたがる強調を改行で分ける', () => {
    const $ = load(render('> [!NOTE] **タイトル\n> 本文**\n> 後続'));

    expect($('.callout-title-text strong').text()).toBe('タイトル');
    expect($('.callout-content strong').text()).toBe('本文');
    expect($('.callout-content p').text()).toBe('本文\n後続');
  });

  test('Callout が入れ子でも描画する', () => {
    const $ = load(render('> [!NOTE]\n> 外側\n>\n> > [!INFO]\n> > 内側'));

    expect($('[data-callout="note"] > .callout-content > p').text()).toBe(
      '外側',
    );
    expect($('[data-callout="note"] [data-callout="info"] p').text()).toBe(
      '内側',
    );
  });

  test.each([
    '> 普通の引用',
    '> 普通の引用\n> [!NOTE]',
    '> [!UNKNOWN]\n> 本文',
    '> [!NOTE]-\n> 本文',
    '> [!NOTE]+\n> 本文',
  ])('対象外の引用を書き換えない: %j', (sample) => {
    expect(render(sample)).toBe(markdownToHtml(sample).html);
  });
});
