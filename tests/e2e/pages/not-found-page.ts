import { type Locator, type Response } from '@playwright/test';
import { SitePage } from './site-page';
import { routes } from '../utils/routes';

/**
 * 404 ページ（`src/pages/404.astro` がレンダリングする）のページオブジェクト。
 *
 * 小さく保ち、ロケーターと遷移だけを提供する。検証は spec 側に書く。
 */
export class NotFoundPage extends SitePage {
  /**
   * 存在しないルートへ遷移する。
   *
   * `page.goto()` は 4xx レスポンスでも例外を投げないため、戻り値の `Response` を
   * 返し、呼び出し側で必要に応じてステータスを検証できるようにする。
   */
  async goto(): Promise<Response | null> {
    return this.page.goto(routes.notFound);
  }

  /** ページの見出し（`<h1>404: Page Not Found</h1>`）。 */
  get heading(): Locator {
    return this.page.getByRole('heading', {
      level: 1,
      name: '404: Page Not Found',
    });
  }

  /**
   * 「ホームに戻る」リンク。
   *
   * 404 ページからホーム（`/`）へ戻る導線。セマンティックロケーターで
   * アクセシブル名で特定し、DOM 構造の変更に強くする。
   */
  get homeLink(): Locator {
    return this.page.getByRole('link', { name: 'ホームに戻る' });
  }
}
