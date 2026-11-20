import { type Locator, type Page } from '@playwright/test';
import { SitePage } from './site-page';
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
export class ArticlePage extends SitePage {
  readonly root: Locator;
  readonly metadata: PostMetadata;
  readonly toc: TableOfContents;

  private currentTitle: string = sampleArticleTitle;

  constructor(page: Page) {
    super(page);
    this.root = page.getByRole('article');
    this.metadata = new PostMetadata(page);
    this.toc = new TableOfContents(page);
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
