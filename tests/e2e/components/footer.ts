import { type Locator, type Page } from '@playwright/test';

/** サイトの `<footer>` に対する主要なロケーターをまとめる。 */
export class Footer {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /** contentinfo ランドマーク（`<footer>`）。 */
  get root(): Locator {
    return this.page.getByRole('contentinfo');
  }

  get blogLink(): Locator {
    return this.root.getByRole('link', { name: 'Blog' });
  }

  get tagsLink(): Locator {
    return this.root.getByRole('link', { name: 'Tags' });
  }

  get aboutLink(): Locator {
    return this.root.getByRole('link', { name: 'About' });
  }

  /** RSS フィードリンク（`aria-label="RSS feed"`）。 */
  get rssLink(): Locator {
    return this.root.getByRole('link', { name: 'RSS feed' });
  }
}
