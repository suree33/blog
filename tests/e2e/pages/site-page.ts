import { type Page } from '@playwright/test';
import { Header } from '../components/header';
import { Footer } from '../components/footer';

/**
 * ヘッダーとフッターを持つページの共通基底クラス。
 */
export class SitePage {
  readonly page: Page;
  readonly header: Header;
  readonly footer: Footer;

  constructor(page: Page) {
    this.page = page;
    this.header = new Header(page);
    this.footer = new Footer(page);
  }
}
