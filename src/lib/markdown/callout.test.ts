import { markdownToHtml } from 'satteri';
import { describe, expect, test } from 'vitest';
import { CALLOUT_TYPES, calloutPlugin } from './callout';

function render(markdown: string): string {
  return markdownToHtml(markdown, { hastPlugins: [calloutPlugin] }).html;
}

/** Callout を含まない状態（プラグインなし）の出力。 */
function renderWithoutPlugin(markdown: string): string {
  return markdownToHtml(markdown).html;
}

function titleOf(title: string): string {
  return `<div class="markdown-callout-title-text">${title}</div>`;
}

describe('calloutPlugin', () => {
  describe('対応する種類', () => {
    const cases = [
      ['NOTE', 'note', 'Note'],
      ['TIP', 'tip', 'Tip'],
      ['IMPORTANT', 'important', 'Important'],
      ['WARNING', 'warning', 'Warning'],
      ['CAUTION', 'caution', 'Caution'],
      ['INFO', 'info', 'Info'],
    ] as const;

    test('対応する種類は GitHub の 5 種類と INFO', () => {
      expect(
        Object.keys(CALLOUT_TYPES).sort(),
        '対応する種類の一覧が想定どおり',
      ).toEqual(['caution', 'important', 'info', 'note', 'tip', 'warning']);
    });

    for (const [marker, type, title] of cases) {
      test(`[!${marker}] を ${title} の Callout に変換する`, () => {
        const html = render(`> [!${marker}]\n> 本文です。`);

        expect(html, 'blockquote が残らない').not.toContain('<blockquote>');
        expect(html, '種類が data 属性に出力される').toContain(
          `<div class="markdown-callout" data-callout-type="${type}">`,
        );
        expect(html, '既定のタイトルが表示される').toContain(titleOf(title));
        expect(html, 'アイコンが装飾として出力される').toContain(
          '<div class="markdown-callout-icon" aria-hidden="true"><svg',
        );
        expect(html, '本文が content に入る').toContain(
          '<div class="markdown-callout-content"><p>本文です。</p></div>',
        );
        expect(html, '記法の文字列が残らない').not.toContain(`[!${marker}]`);
      });
    }

    test('種類名の大文字小文字を区別しない', () => {
      for (const marker of ['note', 'Note', 'nOtE']) {
        const html = render(`> [!${marker}]\n> 本文`);
        expect(html, `[!${marker}] が note の Callout になる`).toContain(
          'data-callout-type="note"',
        );
        expect(html, `[!${marker}] のタイトルは Note になる`).toContain(
          titleOf('Note'),
        );
      }
    });

    test('Callout の出力全体が想定どおりのマークアップになる', () => {
      const html = render('> [!NOTE]\n> 本文');

      expect(html.trim(), 'Callout のマークアップ全体').toBe(
        '<div class="markdown-callout" data-callout-type="note">' +
          '<div class="markdown-callout-title">' +
          '<div class="markdown-callout-icon" aria-hidden="true">' +
          '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<line x1="18" y1="2" x2="22" y2="6"></line>' +
          '<path d="M7.5 20.5 19 9l-4-4L3.5 16.5 2 22z"></path>' +
          '</svg></div>' +
          '<div class="markdown-callout-title-text">Note</div>' +
          '</div>' +
          '<div class="markdown-callout-content"><p>本文</p></div>' +
          '</div>',
      );
    });
  });

  describe('タイトル', () => {
    test('記法の後ろの文字列をカスタムタイトルにする', () => {
      const html = render('> [!WARNING] 料金に注意\n> 本文');

      expect(html, 'カスタムタイトルが表示される').toContain(
        titleOf('料金に注意'),
      );
      expect(html, '既定のタイトルは表示されない').not.toContain('>Warning<');
      expect(html, '本文は content に入る').toContain(
        '<div class="markdown-callout-content"><p>本文</p></div>',
      );
    });

    test('カスタムタイトル中のインライン要素を残す', () => {
      const html = render('> [!TIP] *強調* と `code`\n> 本文');

      expect(html, 'タイトル中の強調とコードが残る').toContain(
        titleOf('<em>強調</em> と <code>code</code>'),
      );
    });

    test('1 行目末尾の強制改行（空白 2 つ）をタイトルの区切りとして扱う', () => {
      const html = render('> [!NOTE]  \n> 本文');

      expect(html, '既定のタイトルが表示される').toContain(titleOf('Note'));
      expect(html, '本文の先頭に改行が残らない').toContain(
        '<div class="markdown-callout-content"><p>本文</p></div>',
      );
    });

    test('本文がなければ content は空になる', () => {
      const html = render('> [!CAUTION]');

      expect(html, 'タイトルだけの Callout になる').toContain(
        titleOf('Caution'),
      );
      expect(html, 'content は空').toContain(
        '<div class="markdown-callout-content"></div>',
      );
    });
  });

  describe('本文', () => {
    test('複数の段落を残す', () => {
      const html = render('> [!NOTE]\n> 1 段落目\n>\n> 2 段落目');

      expect(html, '2 つの段落が content に入る').toContain(
        '<div class="markdown-callout-content"><p>1 段落目</p><p>2 段落目</p></div>',
      );
    });

    test('段落内の改行・強調・リンクを残す', () => {
      const html = render(
        '> [!INFO]\n> 1 行目 **太字**\n> <https://example.com/>',
      );

      expect(html, '改行とインライン要素が残る').toContain(
        '<p>1 行目 <strong>太字</strong>\n<a href="https://example.com/">https://example.com/</a></p>',
      );
    });

    test('リストとコードブロックを残す', () => {
      const html = render(
        '> [!TIP]\n> - 項目 1\n> - 項目 2\n>\n> ```sh\n> pnpm install\n> ```',
      );

      expect(html, 'リストが content に残る').toMatch(
        /<div class="markdown-callout-content"><ul>\s*<li>項目 1<\/li>\s*<li>項目 2<\/li>\s*<\/ul>/,
      );
      expect(html, 'コードブロックが content に残る').toContain('pnpm install');
      expect(html, 'コードブロックが pre として残る').toContain('<pre');
    });

    test('Callout の中の Callout も変換する', () => {
      const html = render('> [!NOTE]\n> 外側\n>\n> > [!WARNING]\n> > 内側');

      expect(html, 'blockquote が残らない').not.toContain('<blockquote>');
      expect(html, '外側の Callout が出力される').toContain(
        'data-callout-type="note"',
      );
      expect(html, '内側の Callout が外側の content に入る').toMatch(
        /<div class="markdown-callout-content"><p>外側<\/p><div class="markdown-callout" data-callout-type="warning">.*<p>内側<\/p><\/div><\/div><\/div><\/div>/s,
      );
    });

    test('通常の blockquote の中の Callout を変換し、外側は blockquote のまま残す', () => {
      const html = render('> 引用\n>\n> > [!NOTE]\n> > 内側');

      expect(html, '外側は blockquote のまま').toMatch(
        /^<blockquote>\s*<p>引用<\/p>/,
      );
      expect(html, '内側は Callout になる').toContain(
        'data-callout-type="note"',
      );
    });

    test('リストの中の Callout を変換する', () => {
      const html = render('- 項目\n\n  > [!NOTE]\n  > 本文');

      expect(html, 'リスト項目の中に Callout が出力される').toMatch(
        /<li>\s*<p>項目<\/p>\s*<div class="markdown-callout" data-callout-type="note">/,
      );
    });
  });

  describe('Callout にしないもの', () => {
    const untouched = [
      ['通常の blockquote', '> ただの引用です。'],
      ['未対応の種類', '> [!TODO]\n> やること'],
      ['記法が段落の先頭にない', '> 先頭ではない [!NOTE]\n> 本文'],
      ['記法が 2 段落目にある', '> 1 段落目\n>\n> [!NOTE]\n> 本文'],
      ['折りたたみの記法（未対応）', '> [!NOTE]- 折りたたみ\n> 本文'],
      ['記法の直後に空白がない', '> [!NOTE]本文'],
      ['記法が強調の中にある', '> **[!NOTE]**\n> 本文'],
      ['空の種類名', '> [!]\n> 本文'],
      ['空の blockquote', '>'],
      ['blockquote でない段落', '[!NOTE]\n本文'],
    ] as const;

    for (const [label, markdown] of untouched) {
      test(`${label}はそのまま残す`, () => {
        expect(
          render(markdown),
          'プラグインなしと同じ HTML になる（内容が失われない）',
        ).toBe(renderWithoutPlugin(markdown));
      });
    }

    test('Callout と通常の blockquote が混在しても通常の blockquote は変わらない', () => {
      const html = render('> [!NOTE]\n> 本文\n\n> 引用です。');

      expect(html, 'Callout に変換される').toContain(
        'data-callout-type="note"',
      );
      expect(html, '通常の blockquote はそのまま残る').toContain(
        '<blockquote>\n<p>引用です。</p>\n</blockquote>',
      );
    });
  });
});
