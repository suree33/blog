import { type Locator } from '@playwright/test';
import { SitePage } from './site-page';
import { escapeRegExp } from '../utils/regex';
import { routes } from '../utils/routes';

/** タグ一覧ページ（`/tags/`）のページオブジェクト。 */
export class TagIndexPage extends SitePage {
  async goto(): Promise<void> {
    await this.page.goto(routes.tagsBase);
  }

  /** ページの見出し（`<h1>タグ一覧</h1>`）。 */
  get heading(): Locator {
    return this.page.getByRole('heading', { level: 1, name: 'タグ一覧' });
  }

  /** `<main>` 内のタグリンク。アクセシブル名は「{タグ名} {記事数}件の記事」。 */
  get tagLinks(): Locator {
    return this.page.getByRole('main').getByRole('listitem').getByRole('link');
  }

  /** タグ名で特定したタグリンク。 */
  tagLink(tag: string): Locator {
    return this.page.getByRole('main').getByRole('link', {
      name: new RegExp(`^${escapeRegExp(tag)}\\s+\\d+\\s*件の記事$`),
    });
  }
}
