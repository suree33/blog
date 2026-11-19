import type { MarkdownInstance } from 'astro';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { load } from 'cheerio';
import { describe, expect, test } from 'vitest';
import type { PostFrontmatter } from '../../src/types/Post';
import * as codeTitlesFixture from './fixtures/code-titles.md';

const posts = import.meta.glob<MarkdownInstance<PostFrontmatter>>([
  '../../src/pages/posts/**/*.md',
  '!../../src/pages/posts/**/_*.md',
  '!../../src/pages/posts/.obsidian/**',
]);

describe('全 Markdown 記事のレンダリング', () => {
  test('巡回対象の記事が存在する', () => {
    expect(Object.keys(posts).length).toBeGreaterThan(0);
  });

  for (const [path, importPost] of Object.entries(posts)) {
    test(path, async () => {
      const post = await importPost();
      const container = await AstroContainer.create();
      const html = await container.renderToString(post.Content, {
        request: new Request(new URL(post.url ?? '/', 'https://sur33.com')),
      });
      const $ = load(html);

      expect($('title').text()).toBe(`${post.frontmatter.title} — Daiki Sato`);
      expect($('header').length).toBeGreaterThan(0);
      expect($('footer').length).toBeGreaterThan(0);
      expect($('article')).toHaveLength(1);
      expect($('article h1')).toHaveLength(1);
      expect($('article h1').text()).toBe(post.frontmatter.title);
      expect($('article time').length).toBeGreaterThan(0);
      expect((await post.compiledContent()).trim().length).toBeGreaterThan(0);

      const headings = post
        .getHeadings()
        .filter(({ depth }) => depth === 2 || depth === 3);
      const tocs = $('nav[aria-label="目次"]');
      expect(tocs).toHaveLength(headings.length ? 2 : 0);
      for (const nav of tocs) {
        const links = $(nav).find('a');
        expect(links.map((_, link) => $(link).text()).get()).toEqual(
          headings.map(({ text }) => text),
        );
        expect(links.map((_, link) => $(link).attr('href')).get()).toEqual(
          headings.map(({ slug }) => `#${slug}`),
        );
      }
      for (const { slug } of headings) {
        expect(
          $('article h2, article h3').filter(
            (_, heading) => $(heading).attr('id') === slug,
          ),
        ).toHaveLength(1);
      }
    });
  }
});

async function articleBody(slug: string) {
  const post = await posts[`../../src/pages/posts/${slug}.md`]();
  return load(await post.compiledContent());
}

describe('コードブロックのタイトル', () => {
  test.each([
    [
      'resolve-sidekick-nvim-codex-search-error',
      ['lua/sidekick/config.lua:106', 'lua/plugins/sidekick.lua'],
    ],
    ['remark-link-card-plus', ['astro.config.mjs', 'remark-link-card.css']],
    [
      'remark-link-card-with-astro',
      ['astro.config.mjs', 'remark-link-card.css'],
    ],
    [
      'tailscale-github-actions-to-deploy-palworld-server-docker',
      ['deploy.yml'],
    ],
  ])(
    '%s のコードタイトルとシンタックスハイライトを保持する',
    async (slug, titles) => {
      const $ = await articleBody(slug);
      const labels = $('.remark-code-container > .remark-code-title');

      expect(labels.map((_, label) => $(label).text()).get()).toEqual(titles);
      for (const label of labels) {
        const block = $(label).next('pre.astro-code');
        expect(block).toHaveLength(1);
        expect(block.find('code span[style]').length).toBeGreaterThan(0);
      }
    },
  );

  test('メタ文字列のタイトルを HTML ではなくテキストとして描画する', async () => {
    const $ = load(await codeTitlesFixture.compiledContent());
    const title = $('.remark-code-title');
    expect(title).toHaveLength(1);
    expect(title.text()).toBe('<file> & 名前.ts');
    expect(title.children()).toHaveLength(0);
    expect(title.next('pre.astro-code').find('code').text()).toBe(
      'const value = 1;',
    );
  });

  test('タイトルなしのコードブロックも背景色のためにコンテナで囲む', async () => {
    const $ = load(await codeTitlesFixture.compiledContent());
    const untitled = $('.remark-code-container > pre.astro-code:only-child');
    expect(untitled.map((_, pre) => $(pre).text()).get()).toEqual([
      'empty title',
      'different attribute',
      'no language or title',
    ]);
  });
});

describe('現在使用している Markdown の拡張', () => {
  test('GFM テーブルとセル内の強調が HTML になる', async () => {
    const $ = await articleBody('setup-obsidian-livesync');
    expect($('table')).toHaveLength(1);
    expect(
      $('thead th')
        .map((_, cell) => $(cell).text())
        .get(),
    ).toEqual(['', 'Sync', 'Sync Plus']);
    expect($('tbody tr')).toHaveLength(5);
    expect($('tbody tr').first().find('strong').text()).toBe('料金');
    expect($('tbody tr').first().find('td').eq(1).text()).toBe(
      '月額5ドル / 年額48ドル',
    );
  });

  test('Shiki がコードを保持して light/dark 両テーマでハイライトする', async () => {
    const $ = await articleBody('zshrc-startup-slow-cause-and-fix');
    const block = $('pre.astro-code').first();
    expect(block).toHaveLength(1);
    expect(block.find('code').text()).toBe(
      'for i in {1..5}; do /usr/bin/time zsh -i -c exit >/dev/null; done',
    );
    expect(block.attr('style')).toContain('--shiki-dark-bg:');
    expect(block.attr('style')).toContain('--shiki-light-bg:');
    const tokens = block.find('span[style]');
    expect(tokens.length).toBeGreaterThan(1);
    expect(tokens.first().attr('style')).toContain('--shiki-dark:');
    expect(tokens.first().attr('style')).toContain('--shiki-light:');
    expect($('p code').first().text()).toBe('.zshrc');
  });

  test('Markdown の相対画像パスが Astro のアセット URL になる', async () => {
    const $ = await articleBody('catppuccin-coteditor');
    const image = $('img[alt="CatppuccinテーマをCotEditorに適用したイメージ"]');
    expect(image).toHaveLength(1);
    expect(image.attr('src')).toBeTruthy();
    expect(image.attr('src')).not.toContain('./images/');
    expect(Number(image.attr('width'))).toBeGreaterThan(0);
    expect(Number(image.attr('height'))).toBeGreaterThan(0);
  });
});
