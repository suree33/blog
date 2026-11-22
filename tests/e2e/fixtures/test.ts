import { test as base, expect } from '@playwright/test';
import { HomePage } from '../pages/home-page';
import { AboutPage } from '../pages/about-page';
import { ArticlePage } from '../pages/article-page';
import { TagPage } from '../pages/tag-page';
import { TagIndexPage } from '../pages/tag-index-page';
import { RssFeedPage } from '../pages/rss-feed-page';
import { NotFoundPage } from '../pages/not-found-page';

/**
 * ブログ E2E スイートで共有する Playwright fixture。
 *
 * spec 側で `homePage` / `aboutPage` / `articlePage` / `tagPage` /
 * `rssFeedPage` / `notFoundPage` を毎回生成しなくて済むようにする。`isDesktop` は、
 * viewport の数値を各 spec に直接書かずにデスクトップ限定のテストを表現するために使う。
 */
export const test = base.extend<{
  homePage: HomePage;
  aboutPage: AboutPage;
  articlePage: ArticlePage;
  tagPage: TagPage;
  tagIndexPage: TagIndexPage;
  rssFeedPage: RssFeedPage;
  notFoundPage: NotFoundPage;
  isDesktop: boolean;
}>({
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },
  aboutPage: async ({ page }, use) => {
    await use(new AboutPage(page));
  },
  articlePage: async ({ page }, use) => {
    await use(new ArticlePage(page));
  },
  tagPage: async ({ page }, use) => {
    await use(new TagPage(page));
  },
  tagIndexPage: async ({ page }, use) => {
    await use(new TagIndexPage(page));
  },
  rssFeedPage: async ({ page, request }, use) => {
    await use(new RssFeedPage(page, request));
  },
  notFoundPage: async ({ page }, use) => {
    await use(new NotFoundPage(page));
  },
  isDesktop: async ({ page }, use) => {
    await use((page.viewportSize()?.width ?? 1280) >= 768);
  },
});

export { expect };
