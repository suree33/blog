import { codeToHtml } from 'shiki';
import { describe, expect, test } from 'vitest';

import {
  CODE_BLOCK_CLASS,
  CODE_TITLE_CLASS,
  parseCodeTitle,
  transformerCodeTitle,
} from './code-title';

/**
 * サイトの `astro.config.mjs`（`markdown.shikiConfig`）と同じテーマ設定でハイライトする。
 * Astro と同じく、フェンスのメタ文字列は `meta.__raw` として渡す。
 */
function highlight(code: string, lang: string, meta?: string) {
  return codeToHtml(code, {
    lang,
    themes: { light: 'github-light', dark: 'github-dark' },
    defaultColor: 'light-dark()',
    meta: meta === undefined ? undefined : { __raw: meta },
    transformers: [transformerCodeTitle()],
  });
}

describe('parseCodeTitle', () => {
  test('ダブルクォートで囲んだ title を取り出す', () => {
    expect(
      parseCodeTitle('title="foo.ts"'),
      'ダブルクォートの中身がタイトルになる',
    ).toBe('foo.ts');
  });

  test('シングルクォートで囲んだ title を取り出す', () => {
    expect(
      parseCodeTitle("title='foo.ts'"),
      'シングルクォートの中身がタイトルになる',
    ).toBe('foo.ts');
  });

  test('クォートの中の空白・コロン・スラッシュ・反対側のクォートはそのまま残す', () => {
    expect(
      parseCodeTitle('title="lua/sidekick/config.lua:106"'),
      'パスと行番号を含むタイトルがそのまま取り出される',
    ).toBe('lua/sidekick/config.lua:106');
    expect(
      parseCodeTitle('title="my file.ts"'),
      '空白を含むタイトルがそのまま取り出される',
    ).toBe('my file.ts');
    expect(
      parseCodeTitle(`title="it's.ts"`),
      'ダブルクォートの中のシングルクォートはタイトルの一部になる',
    ).toBe("it's.ts");
  });

  test('メタがない、または title がない場合はタイトルなし', () => {
    expect(parseCodeTitle(undefined), 'メタがなければタイトルなし').toBe(
      undefined,
    );
    expect(parseCodeTitle(''), '空のメタならタイトルなし').toBe(undefined);
    expect(
      parseCodeTitle('showLineNumbers {1,3-4}'),
      'title 以外のメタだけならタイトルなし',
    ).toBe(undefined);
  });

  test('空、または空白だけの title はタイトルなし', () => {
    expect(parseCodeTitle('title=""'), '空の title はタイトルなし').toBe(
      undefined,
    );
    expect(
      parseCodeTitle('title="   "'),
      '空白だけの title はタイトルなし',
    ).toBe(undefined);
  });

  test('クォートで囲まれていない title は対象外', () => {
    expect(
      parseCodeTitle('title=foo.ts'),
      'クォートなしの title はタイトルとして扱わない',
    ).toBe(undefined);
  });

  test('ほかのメタと一緒に書いた title を取り出す', () => {
    expect(
      parseCodeTitle('showLineNumbers title="foo.ts" {1,3}'),
      'ほかのメタの間にある title が取り出される',
    ).toBe('foo.ts');
    expect(
      parseCodeTitle('data-title="other" title="foo.ts"'),
      '別のキー（data-title）ではなく title の値が取り出される',
    ).toBe('foo.ts');
    expect(
      parseCodeTitle('data-title="other"'),
      '別のキー（data-title）だけならタイトルなし',
    ).toBe(undefined);
  });
});

describe('transformerCodeTitle', () => {
  test('title があると、ラッパーの中でタイトルを <pre> の直前に置く', async () => {
    const html = await highlight('const a = 1;', 'ts', 'title="foo.ts"');

    expect(
      html.startsWith(
        `<div class="${CODE_BLOCK_CLASS}"><div class="${CODE_TITLE_CLASS}">foo.ts</div><pre class="shiki shiki-themes github-light github-dark"`,
      ),
      'ラッパー → タイトル → <pre> の順に並ぶ',
    ).toBe(true);
    expect(
      html.endsWith('</pre></div>'),
      'ラッパーが <pre> を閉じた後に閉じる',
    ).toBe(true);
  });

  test('ハイライトとデュアルテーマの色を保つ', async () => {
    const html = await highlight('const a = 1;', 'ts', 'title="foo.ts"');

    expect(
      html,
      '<pre> にライト・ダーク両テーマの背景色が light-dark() で付く',
    ).toContain('background-color:light-dark(#fff, #24292e)');
    expect(
      html,
      'キーワードのトークンにライト・ダーク両テーマの色が付く',
    ).toContain(
      '<span style="color:light-dark(#D73A49, #F97583);--shiki-light:#D73A49;--shiki-dark:#F97583">const</span>',
    );
  });

  test('title がなくても <pre> をラッパーで包み、タイトルは出さない', async () => {
    const html = await highlight('const a = 1;', 'ts', 'showLineNumbers');

    expect(
      html.startsWith(`<div class="${CODE_BLOCK_CLASS}"><pre `),
      'ラッパーの直下に <pre> が来る',
    ).toBe(true);
    expect(html, 'タイトルの要素は出力されない').not.toContain(
      CODE_TITLE_CLASS,
    );
  });

  test('メタがないコードブロックもラッパーで包む', async () => {
    const html = await highlight('plain text', 'plaintext');

    expect(
      html.startsWith(`<div class="${CODE_BLOCK_CLASS}"><pre `),
      'ラッパーの直下に <pre> が来る',
    ).toBe(true);
    expect(html, 'タイトルの要素は出力されない').not.toContain(
      CODE_TITLE_CLASS,
    );
  });

  test('タイトルの HTML 特殊文字はエスケープされる', async () => {
    const html = await highlight(
      'const a = 1;',
      'ts',
      `title="<script>alert('x')</script>&amp;.ts"`,
    );

    expect(
      html,
      'タイトルの中の <script> がタグとして出力されない',
    ).not.toContain('<script>');
    expect(html, '< と & が文字参照になってタイトルに表示される').toContain(
      `<div class="${CODE_TITLE_CLASS}">&#x3C;script>alert('x')&#x3C;/script>&#x26;amp;.ts</div>`,
    );
  });
});
