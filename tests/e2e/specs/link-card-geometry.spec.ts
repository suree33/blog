import { expect, test } from '@playwright/test';

const mainStyles = `
  .link-card__card { grid-template-columns: 1fr 116px !important; }
  @media (min-width: 60ch) { .link-card__card { grid-template-columns: 1fr 220px !important; } }
  .link-card__main { width: auto !important; min-width: 100% !important; max-width: 100% !important; margin-right: 0 !important; padding-right: 0 !important; }
  .link-card__card :is(.link-card__content, .link-card__meta) { width: auto !important; }
`;

for (const viewport of [375, 800, 1280]) {
  test(`link cards preserve main's intrinsic sizing at ${viewport}px`, async ({
    page,
    request,
  }, testInfo) => {
    test.skip(
      !['chromium', 'firefox', 'webkit'].includes(testInfo.project.name),
    );
    test.setTimeout(180_000);
    await page.setViewportSize({ width: viewport, height: 900 });
    await page.route('**/*', (route) =>
      new URL(route.request().url()).hostname === 'localhost'
        ? route.continue()
        : route.abort(),
    );
    const sitemap = await (await request.get('/sitemap-0.xml')).text();
    const posts = [
      ...sitemap.matchAll(/<loc>https:\/\/sur33.com(\/posts\/[^<]+)<\/loc>/g),
    ].map((match) => match[1]);
    expect(posts).toContain('/posts/audio-interface-under-the-desk/');
    expect(posts).toContain('/posts/perplexity-pro-is-cheaper-on-ios-app/');
    const rows = [];
    for (const gutter of ['auto', 'stable']) {
      for (const post of posts) {
        await page.goto(post);
        await page.evaluate((value) => {
          document.documentElement.style.scrollbarGutter = value;
        }, gutter);
        await page.evaluate(() => document.fonts.ready);
        for (const scenario of ['normal', 'no-thumbnail', 'long-text']) {
          if (scenario === 'no-thumbnail')
            await page
              .locator('.link-card__thumbnail')
              .evaluateAll((elements) =>
                elements.forEach((element) => element.remove()),
              );
          if (scenario === 'long-text') {
            await page
              .locator(
                '.link-card__title, .link-card__description, .link-card__url',
              )
              .evaluateAll((elements) =>
                elements.forEach((element) => {
                  element.textContent =
                    'LongUnbrokenURL'.repeat(40) +
                    ' 日本語 and spaced text '.repeat(80);
                }),
              );
          }
          await page.evaluate(() => {
            document
              .querySelectorAll('.intrinsic-probe')
              .forEach((element) => element.remove());
            for (const container of document.querySelectorAll(
              '.link-card__container',
            )) {
              for (const width of ['min-content', 'max-content']) {
                const probe = container.cloneNode(true) as HTMLElement;
                probe.classList.add('intrinsic-probe');
                Object.assign(probe.style, {
                  position: 'fixed',
                  left: '-100000px',
                  top: '0',
                  width,
                });
                container.parentElement?.append(probe);
              }
            }
          });
          const measure = () =>
            page.evaluate(() => ({
              article: document
                .querySelector('article')
                ?.getBoundingClientRect().width,
              cards: [
                ...document.querySelectorAll(
                  '.link-card__card, .link-card__main, .intrinsic-probe',
                ),
              ].map((element) => element.getBoundingClientRect().width),
            }));
          const branch = await measure();
          const style = await page.addStyleTag({ content: mainStyles });
          const main = await measure();
          await style.evaluate((element) =>
            element.parentNode?.removeChild(element),
          );
          expect(branch, `${post} ${scenario}`).toEqual(main);
          rows.push({
            browser: testInfo.project.name,
            viewport,
            gutter,
            post,
            scenario,
            main: main.article,
            branch: branch.article,
          });
          if (scenario !== 'normal') {
            const gaps = await page
              .locator('.link-card__card')
              .evaluateAll((cards) =>
                cards
                  .filter((card) => !card.closest('.intrinsic-probe'))
                  .flatMap((card) =>
                    [
                      ...card.querySelectorAll(
                        '.link-card__content, .link-card__meta',
                      ),
                    ].map((child) =>
                      Math.abs(
                        card.getBoundingClientRect().right -
                          parseFloat(
                            getComputedStyle(
                              card.querySelector('.link-card__main') as Element,
                            ).paddingLeft,
                          ) -
                          child.getBoundingClientRect().right,
                      ),
                    ),
                  ),
              );
            for (const gap of gaps)
              expect(gap, `${post} ${scenario} content edge`).toBeLessThan(1);
          }
        }
        await page
          .locator('.intrinsic-probe')
          .evaluateAll((elements) =>
            elements.forEach((element) => element.remove()),
          );
      }
    }
    console.log(`CARD_GEOMETRY ${JSON.stringify(rows)}`);
    await testInfo.attach('card-geometry.json', {
      body: JSON.stringify(rows, null, 2),
      contentType: 'application/json',
    });
  });
}
