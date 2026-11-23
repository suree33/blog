function addHeadingPermalinks(content: HTMLElement) {
  const template = content.querySelector<HTMLTemplateElement>(
    '[data-heading-permalink]',
  );
  const icon = template?.content.firstElementChild;
  if (!icon) return;

  for (const heading of content.querySelectorAll<HTMLElement>(
    ':is(h1, h2, h3, h4, h5, h6)[id]:not([id=""])',
  )) {
    const permalink = document.createElement('a');
    const name = heading.textContent.trim() || heading.id;
    permalink.className = 'post-heading-permalink';
    permalink.href = `#${encodeURIComponent(heading.id)}`;
    permalink.setAttribute('aria-label', `「${name}」へのパーマリンク`);
    permalink.title = 'この見出しへのパーマリンク';
    permalink.append(icon.cloneNode(true));

    const wrapper = document.createElement('div');
    wrapper.className = 'post-heading';
    heading.before(wrapper);
    wrapper.append(heading, permalink);
  }
}

function addCopyButtons(content: HTMLElement, clipboard: Clipboard) {
  const template = content.querySelector<HTMLTemplateElement>(
    '[data-code-toolbar]',
  );
  const toolbarTemplate = template?.content.firstElementChild;
  if (!toolbarTemplate) return;

  for (const pre of content.querySelectorAll('pre')) {
    const code = pre.querySelector(':scope > code');
    if (!code) continue;

    const toolbar = toolbarTemplate.cloneNode(true) as HTMLElement;
    const button = toolbar.querySelector('button');
    const label = button?.querySelector('span');
    const status = toolbar.querySelector('[role="status"]');
    if (!button || !label || !status) return;

    let block = pre.parentElement;
    if (!block?.classList.contains('remark-code-container')) {
      block = document.createElement('div');
      pre.before(block);
      block.append(pre);
    }
    block.classList.add('post-code');

    const title = block.querySelector(':scope > .remark-code-title');
    if (title) {
      toolbar.prepend(title);
      button.setAttribute(
        'aria-label',
        `${title.textContent} のコードをコピー`,
      );
    }
    pre.before(toolbar);

    let reset: number | undefined;
    button.addEventListener('click', async () => {
      try {
        await clipboard.writeText(code.textContent);
        label.textContent = 'コピー済み';
        status.textContent = 'コードをコピーしました';
      } catch {
        label.textContent = 'コピー失敗';
        status.textContent = 'コードをコピーできませんでした';
      }
      window.clearTimeout(reset);
      reset = window.setTimeout(() => {
        label.textContent = 'コピー';
        status.textContent = '';
      }, 2500);
    });
  }
}

export function addPostControls(content: HTMLElement) {
  addHeadingPermalinks(content);
  if (typeof navigator.clipboard?.writeText === 'function') {
    addCopyButtons(content, navigator.clipboard);
  }
}
