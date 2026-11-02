import { type Locator } from '@playwright/test';

/**
 * 記事本文（Markdown から生成された部分）に対するロケーター。
 *
 * Callout・コードタイトル・リンクカードなどは Markdown 処理系のプラグインが生成し、
 * プラグインの置き換え（unified → Sätteri など）で HTML 構造やクラス名が変わりうる。
 * そのため、ここではプラグイン固有のクラス名や属性を使わず、表示テキスト、role、
 * `<pre>` / `<a href>` / `<img>` のような Markdown の意味に対応する要素だけで特定する。
 *
 * POM はロケーターだけを持ち、検証は spec 側に書く。
 */
export class MarkdownContent {
  readonly root: Locator;

  constructor(root: Locator) {
    this.root = root;
  }

  /**
   * Callout のコンテナ。
   *
   * タイトル（例: `Note`）と完全一致するテキストを持つ要素と、本文テキストの両方を含む
   * 要素のうち、最も内側のもの（文書順で最後に現れるもの）を Callout とみなす。
   * タグ名やクラス名には依存しない。
   */
  callout(title: string, bodyText: string): Locator {
    return this.root
      .locator('*')
      .filter({ has: this.root.page().getByText(title, { exact: true }) })
      .filter({ hasText: bodyText })
      .last();
  }

  /** Callout のタイトル（例: `Note`）。 */
  calloutTitle(title: string, bodyText: string): Locator {
    return this.callout(title, bodyText).getByText(title, { exact: true });
  }

  /** Callout の本文。 */
  calloutBody(title: string, bodyText: string): Locator {
    return this.callout(title, bodyText).getByText(bodyText);
  }

  /** 指定したコードを含むコードブロック（`<pre>`）。 */
  codeBlock(code: string): Locator {
    return this.root.locator('pre').filter({ hasText: code });
  }

  /** 表示テキストと完全一致する要素（コードタイトルなど）。 */
  textExact(text: string): Locator {
    return this.root.getByText(text, { exact: true });
  }

  /** 指定した URL へのリンク。 */
  linkTo(url: string): Locator {
    return this.root.locator(`a[href="${url}"]`);
  }

  /** TOC の対象になる本文見出し（h2 / h3、文書順）。 */
  get tocHeadings(): Locator {
    return this.root.locator('h2, h3');
  }
}
