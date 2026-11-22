import { expect, type Locator, type Page } from '@playwright/test';

/**
 * サイトの `<header>` に対する主要なロケーターと操作をまとめる。
 *
 * POM はロケーターと小さな操作だけを持ち、検証は spec 側に書く。
 */
export class Header {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /** banner ランドマーク（`<header>`）。 */
  get root(): Locator {
    return this.page.getByRole('banner');
  }

  /**
   * 「Blog」ナビゲーションリンク。
   *
   * ヘッダーにはデスクトップ用とモバイル用の Blog リンクが両方 DOM に存在する。
   * デスクトップでは前者、モバイル（メニュー展開後）では後者だけが可視になるため、
   * `filter({ visible: true })` で「いま見えている」リンクを選択し、
   * デスクトップ・モバイル両方の spec で同じ POM を使えるようにする。
   */
  get blogLink(): Locator {
    return this.root
      .getByRole('link', { name: 'Blog' })
      .filter({ visible: true });
  }

  /** 「Tags」ナビゲーションリンク（可視判定の理由は `blogLink` を参照）。 */
  get tagsLink(): Locator {
    return this.root
      .getByRole('link', { name: 'Tags' })
      .filter({ visible: true });
  }

  /** 「About」ナビゲーションリンク（可視判定の理由は `blogLink` を参照）。 */
  get aboutLink(): Locator {
    return this.root
      .getByRole('link', { name: 'About' })
      .filter({ visible: true });
  }

  /**
   * テーマトグルボタン（`aria-label="テーマを切り替える"`）。
   *
   * ヘッダーアイコン群はデスクトップ用とモバイル用が両方 DOM に存在する。
   * `blogLink` 等と同様に `filter({ visible: true })` で表示中の方を選び、
   * デスクトップ・モバイル両方の spec で共用する（モバイルはメニュー展開後に可視）。
   */
  get themeToggle(): Locator {
    return this.root
      .getByRole('button', { name: 'テーマを切り替える' })
      .filter({ visible: true });
  }

  /**
   * モバイルのハンバーガーボタン（`aria-label="メニューを開閉する"`）。
   *
   * 小さいビューポートでのみ表示され、`aria-expanded` で開閉状態を表す。
   */
  get hamburger(): Locator {
    return this.root.getByRole('button', { name: 'メニューを開閉する' });
  }

  /**
   * モバイルメニューを開く。
   *
   * `aria-expanded` の更新後、ヘッダー配下のCSS animation/transitionが完了するまで待つ。
   * 既に開いている場合も、進行中のanimation/transitionがあれば完了を待つ。
   */
  async openMobileMenu(): Promise<void> {
    if ((await this.hamburger.getAttribute('aria-expanded')) !== 'true') {
      await this.hamburger.click();
      await expect(
        this.hamburger,
        'モバイルメニューを開くとハンバーガーボタンの aria-expanded が true になる',
      ).toHaveAttribute('aria-expanded', 'true');
    }

    await this.root.evaluate(async (header) => {
      const animations = header.getAnimations({ subtree: true });
      await Promise.allSettled(
        animations.map((animation) => animation.finished),
      );
    });
  }

  /** About リンクをクリックする。 */
  async gotoAbout(): Promise<void> {
    await this.aboutLink.click();
  }

  /** テーマトグルボタンをクリックする。 */
  async toggleTheme(): Promise<void> {
    await this.themeToggle.click();
  }
}
