import {
  type APIRequestContext,
  type APIResponse,
  type Page,
} from '@playwright/test';
import { routes } from '../utils/routes';

/** RSS `<item>` のうち本スイートで検証に使うフィールド。 */
export interface RssFeedItem {
  title: string;
  link: string;
  content: string;
  pubDate: string;
}

/** RSS `<channel>` のうち本スイートで検証に使うフィールド。 */
export interface RssFeedContent {
  siteName: string;
  description: string;
  language: string;
  items: RssFeedItem[];
  stylesheet: string;
}

/**
 * `/rss.xml` エンドポイントのページオブジェクト。
 *
 * RSS はブラウザで描画するページではなく XML 応答のため、他の POM とは異なり
 * `APIRequestContext` で取得した `APIResponse` を介して検証する。
 * `goto()` でフィードを取得して本文をキャッシュし、`response` でステータスや
 * ヘッダーを、`content()` でパース結果をそれぞれ spec に提供する。
 *
 * XML のパースは XSLT スタイルシートの変換を受けず生の XML を扱うため、
 * ブラウザの `DOMParser` (`application/xml`) で行う。`@astrojs/rss` は
 * `Content-Type: application/xml` を返すため、content-type の検証もそれに合わせる。
 */
export class RssFeedPage {
  readonly page: Page;
  readonly request: APIRequestContext;
  private _response?: APIResponse;
  private _xml?: string;

  constructor(page: Page, request: APIRequestContext) {
    this.page = page;
    this.request = request;
  }

  /** `/rss.xml` を取得し、応答と本文をキャッシュする。 */
  async goto(): Promise<void> {
    this._response = await this.request.get(routes.rss);
    this._xml = await this._response.text();
  }

  /** `goto()` で取得した `APIResponse`。ステータス・ヘッダー検証に使用。 */
  get response(): APIResponse {
    if (!this._response) {
      throw new Error('RssFeedPage.goto() を先に呼び出してください。');
    }
    return this._response;
  }

  /** キャッシュした XML を `DOMParser` でパースした結果を返す。 */
  async content(): Promise<RssFeedContent> {
    if (!this._xml) {
      throw new Error('RssFeedPage.goto() を先に呼び出してください。');
    }
    return this.page.evaluate((xml) => {
      const doc = new DOMParser().parseFromString(xml, 'application/xml');
      if (doc.querySelector('parsererror')) {
        throw new Error('RSS XML のパースに失敗しました');
      }
      const channel = doc.querySelector('channel');
      const items = Array.from(doc.querySelectorAll('item')).map((item) => ({
        title: item.querySelector('title')?.textContent ?? '',
        link: item.querySelector('link')?.textContent ?? '',
        content:
          item.getElementsByTagNameNS(
            'http://purl.org/rss/1.0/modules/content/',
            'encoded',
          )[0]?.textContent ?? '',
        pubDate: item.querySelector('pubDate')?.textContent ?? '',
      }));
      return {
        siteName: channel?.querySelector('title')?.textContent ?? '',
        description: channel?.querySelector('description')?.textContent ?? '',
        language: channel?.querySelector('language')?.textContent ?? '',
        items,
        stylesheet:
          Array.from(doc.childNodes).find(
            (node) =>
              node.nodeType === Node.PROCESSING_INSTRUCTION_NODE &&
              node.nodeName === 'xml-stylesheet',
          )?.nodeValue ?? '',
      };
    }, this._xml);
  }
}
