import { type Locator } from '@playwright/test';
import { SitePage } from './site-page';
import { routes } from '../utils/routes';

/**
 * About ページ（`/about`）のページオブジェクト。
 */
export class AboutPage extends SitePage {
  async goto(): Promise<void> {
    await this.page.goto(routes.about);
  }

  /** ページの見出し（`<h1>Daiki Sato</h1>`）。 */
  get heading(): Locator {
    return this.page.getByRole('heading', { level: 1, name: 'Daiki Sato' });
  }
}
