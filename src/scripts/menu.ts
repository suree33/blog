/**
 * ハンバーガーメニューの開閉操作を設定する
 *
 * 開閉処理でdata-active属性、aria-expanded属性、本文のスクロール制御、キー操作の監視をまとめて更新する。
 * 初回に開くときは'start'クラスを削除する。クリックで開閉し、Escapeキーや画面幅の拡大で閉じる。
 * 開いている間はTabキーのフォーカス移動をメニュー内に留め、Escapeキーで閉じた後はボタンにフォーカスを戻す。
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
 * import { toggleHamburgerMenu } from '@scripts/menu';
 * toggleHamburgerMenu('.hamburger', '.hamburger-toggle');
 */
export const toggleHamburgerMenu = (
  hamburgerSelector: string,
  toggleTargetSelector: string,
) => {
  const hamburger = document.querySelector<HTMLElement>(hamburgerSelector);
  const menu = document.querySelectorAll(toggleTargetSelector);
  if (!hamburger) return;

  const panel = document.getElementById(
    hamburger.getAttribute('aria-controls') ?? '',
  );
  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
      hamburger.focus();
    } else if (event.key === 'Tab') {
      const controls = [
        hamburger,
        ...(panel?.querySelectorAll<HTMLElement>('a[href], button') ?? []),
      ].filter((element) => element.checkVisibility());
      const index = controls.indexOf(document.activeElement as HTMLElement);
      if (
        event.shiftKey ? index <= 0 : index === controls.length - 1 || index < 0
      ) {
        event.preventDefault();
        (event.shiftKey ? controls.at(-1) : controls[0])?.focus();
      }
    }
  };
  const closeMenu = () => {
    document.removeEventListener('keydown', handleKeydown);
    hamburger.removeAttribute('data-active');
    hamburger.setAttribute('aria-expanded', 'false');
    menu.forEach((item) => item.removeAttribute('data-active'));
    document.body.style.overflow = 'unset';
  };
  const openMenu = () => {
    hamburger.classList.remove('start');
    hamburger.setAttribute('data-active', '');
    hamburger.setAttribute('aria-expanded', 'true');
    menu.forEach((item) => item.setAttribute('data-active', ''));
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeydown);
  };

  window
    .matchMedia('(min-width: 640px)')
    .addEventListener('change', (event) => {
      if (event.matches) closeMenu();
    });

  hamburger.addEventListener('click', () => {
    const isOpen = hamburger.hasAttribute('data-active');
    return isOpen ? closeMenu() : openMenu();
  });
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
