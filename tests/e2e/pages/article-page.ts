import { type Locator, type Page } from '@playwright/test';
import { Header } from '../components/header';
import { Footer } from '../components/footer';
import { MarkdownContent } from '../components/markdown-content';
import { PostMetadata } from '../components/post-metadata';
import { TableOfContents } from '../components/toc';
import { routes, sampleArticleTitle } from '../utils/routes';

/**
 * ブログ記事ページのページオブジェクト。
 *
 * `goto()` のデフォルトはサンプル記事のルート/タイトル。spec から別のルート
 * （とそのタイトル）を渡すことで、他の記事もテストできる。
 * 期待タイトルは内部で保持し、`heading` が遷移先のルートと同期するようにする。
 */
export class ArticlePage {
  readonly page: Page;
  readonly root: Locator;
  readonly header: Header;
  readonly footer: Footer;
  readonly metadata: PostMetadata;
  readonly toc: TableOfContents;
  /** 記事本文（Markdown から生成された部分を含む `<article>`）。 */
  readonly content: MarkdownContent;

  private currentTitle: string = sampleArticleTitle;

  constructor(page: Page) {
    this.page = page;
    this.root = page.getByRole('article');
    this.header = new Header(page);
    this.footer = new Footer(page);
    this.metadata = new PostMetadata(page);
    this.toc = new TableOfContents(page);
    this.content = new MarkdownContent(this.root);
  }

  /**
   * 記事のルートへ遷移する。
   *
   * @param route 記事の URL。デフォルトはサンプル記事のルート。
   * @param title ルートに対応する `<h1>` の期待テキスト。`heading` で使用。
   *   `route` でレンダリングされる記事と一致させる必要がある。
   */
  async goto(
    route: string = routes.sampleArticle,
    title: string = sampleArticleTitle,
  ): Promise<void> {
    this.currentTitle = title;
    await this.page.goto(route);
  }

  /** 記事タイトルの見出し（`<h1>`）。期待タイトルで特定する。 */
  get heading(): Locator {
    return this.page.getByRole('heading', {
      level: 1,
      name: this.currentTitle,
    });
  }

  /** TOC の対象になる本文見出し（記事本文内の h2）。 */
  get sectionHeadings(): Locator {
    return this.page.getByRole('article').getByRole('heading', { level: 2 });
  }
}
