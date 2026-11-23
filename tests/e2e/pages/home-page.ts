import { type Page } from '@playwright/test';
import { SitePage } from './site-page';
import { PostList } from '../components/post-list';
import { routes } from '../utils/routes';

/**
 * ホームページ（`/`）のページオブジェクト。
 */
export class HomePage extends SitePage {
  readonly postList: PostList;

  constructor(page: Page) {
    super(page);
    this.postList = new PostList(page);
  }

  async goto(): Promise<void> {
    await this.page.goto(routes.home);
  }
}
