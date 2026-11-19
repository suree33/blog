/**
 * ハンバーガーメニューによるトグル機能をを提供する
 *
 * 指定されたハンバーガーメニューをクリックすると、ハンバーガーメニューとトグル対象の要素にdata-active属性を付与したり削除したりすることで、
 * メニューの開閉を行う。初回クリック時には'start'クラスを削除し、data-active属性を追加する。
 * それ以降のクリックではdata-active属性のトグルを行う。
 * data-active属性が付与されている場合、トグル対象の要素にもdata-active属性を付与し、
 * data-active属性が削除された場合はトグル対象の要素からもdata-active属性を削除する。
 *
 * @param hamburgerSelector - ハンバーガーメニューの要素を指定するCSSセレクタ
 * @param toggleTargetSelector - トグルする要素を指定するCSSセレクタ
 *
 * @example
 * // HTMLでハンバーガーメニューとトグル対象の要素を定義
 * <button class="hamburger start"></button>
 * <nav class="hamburger-toggle"></nav>
 *
 * // CSSでハンバーガーメニューとトグル対象の要素のスタイルを定義
 * .hamburger {
 *   // ハンバーガーメニューのスタイル
 * }
 * .hamburger-toggle {
 *   // トグル対象の要素のスタイル
 * }
 *
 * // 関数を呼び出してハンバーガーメニューのトグル機能を有効化
 * import { toggleHamburgerMenu } from './hamburgerMenu.js';
 * toggleHamburgerMenu('.hamburger', '.hamburger-toggle');
 */
export const toggleHamburgerMenu = (
  hamburgerSelector: string,
  toggleTargetSelector: string,
) => {
  const hamburger = document.querySelector<HTMLElement>(hamburgerSelector);
  const menu = document.querySelectorAll(toggleTargetSelector);
  if (hamburger) {
    const closeMenu = () => {
      hamburger.removeAttribute('data-active');
      hamburger.setAttribute('aria-expanded', 'false');
      menu.forEach((item) => item.removeAttribute('data-active'));
      enableScroll();
    };

    window
      .matchMedia('(min-width: 640px)')
      .addEventListener('change', (event) => {
        if (event.matches) closeMenu();
      });

    hamburger.addEventListener('click', () => {
      if (hamburger.classList.contains('start')) {
        hamburger.classList.remove('start');
        hamburger.setAttribute('data-active', '');
      } else {
        hamburger.toggleAttribute('data-active');
      }

      if (hamburger.hasAttribute('data-active')) {
        hamburger.setAttribute('aria-expanded', 'true');
        menu.forEach((item) => item.setAttribute('data-active', ''));
        disableScroll();
      } else {
        closeMenu();
      }
    });
  }
  function disableScroll() {
    document.body.style.overflow = 'hidden';
  }
  function enableScroll() {
    document.body.style.overflow = 'unset';
  }
};

/**
 * スクロールに応じてヘッダーを隠したり表示したりする
 *
 * スクロールイベントを監視し、スクロール速度に応じてヘッダーを隠したり表示したりする。
 * 上にスクロールした場合、スクロール速度が上スクロールのしきい値を超えるとヘッダーを表示する。
 * 下にスクロールした場合、スクロール速度が下スクロールのしきい値を超えるとヘッダーを隠す。
 *
 * @param headerSelector - ヘッダーの要素を指定するCSSセレクタ
 * @param hamburgerSelector - ハンバーガーメニューの要素を指定するCSSセレクタ
 * @param options - オプション設定
 * @param options.upThreshold - 上スクロールの速度しきい値（ピクセル/秒）
 * @param options.downThreshold - 下スクロールの速度しきい値（ピクセル/秒）
 */
export const toggleHeaderOnScroll = (
  headerSelector: string,
  hamburgerSelector: string,
  options: { upThreshold?: number; downThreshold?: number } = {},
) => {
  const { upThreshold = 1500, downThreshold = 1000 } = options;
  let prevScrollpos = window.pageYOffset;
  let prevTime = Date.now();
  const header = document.querySelector<HTMLElement>(headerSelector);
  const hamburger = document.querySelector<HTMLElement>(hamburgerSelector);
  if (!header) return;

  window.addEventListener('scroll', () => {
    if (!(hamburger && hamburger.hasAttribute('data-active'))) {
      const currentScrollPos = window.pageYOffset;
      const currentTime = Date.now();
      const elapsedTime = currentTime - prevTime;

      // スクロール速度を計算（ピクセル/秒）
      const scrollSpeed =
        Math.abs(currentScrollPos - prevScrollpos) / (elapsedTime / 1000);

      if (prevScrollpos > currentScrollPos) {
        if (scrollSpeed > upThreshold) {
          // 上にスクロールした場合
          // ヘッダーを表示
          header.style.top = '0';
        }
      } else {
        if (scrollSpeed > downThreshold) {
          // 下にスクロールした場合
          // ヘッダーを隠す
          if (
            window.innerHeight + currentScrollPos >=
            document.body.clientHeight - 400
          ) {
            header.style.top = '0';
            console.log('bottom');
          } else {
            header.style.top = `-${header.offsetHeight}px`;
          }
        }
      }

      // スクロールが一番下まで到達した場合
      // ヘッダーを表示
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight) {
        header.style.top = '0';
      }

      prevScrollpos = currentScrollPos;
      prevTime = currentTime;
    }
  });
};
