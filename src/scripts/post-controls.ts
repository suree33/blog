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
  const template =
    content.querySelector<HTMLTemplateElement>('[data-code-copy]');
  const areaTemplate = template?.content.firstElementChild;
  if (!(areaTemplate instanceof HTMLElement)) return;

  for (const pre of content.querySelectorAll('pre')) {
    const code = pre.querySelector(':scope > code');
    if (!code) continue;

    const area = areaTemplate.cloneNode(true) as HTMLElement;
    const button = area.querySelector('button');
    const status = area.querySelector('[role="status"]');
    if (!button || !status) return;

    const title =
      pre.parentElement?.querySelector(':scope > .remark-code-title') ?? null;
    if (title) {
      button.setAttribute(
        'aria-label',
        `${title.textContent.trim()} のコードをコピー`,
      );
    }

    pre.before(area);
    area.insertBefore(pre, status);

    let reset: number | undefined;
    button.addEventListener('click', async () => {
      try {
        await clipboard.writeText(code.textContent ?? '');
      } catch {
        delete button.dataset.copied;
        status.textContent = 'コードをコピーできませんでした';
        return;
      }
      button.dataset.copied = '';
      status.textContent = 'コードをコピーしました';
      window.clearTimeout(reset);
      reset = window.setTimeout(() => {
        delete button.dataset.copied;
        status.textContent = '';
      }, 2000);
    });
  }
}

export function addPostControls(content: HTMLElement) {
  addHeadingPermalinks(content);
  if (typeof navigator.clipboard?.writeText === 'function') {
    addCopyButtons(content, navigator.clipboard);
  }
}
