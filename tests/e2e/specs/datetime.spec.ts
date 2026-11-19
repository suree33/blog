import { readFile } from 'node:fs/promises';
import { expect, test } from '../fixtures/test';
import { routes } from '../utils/routes';

async function frontmatterDates(route: string): Promise<string[]> {
  const source = await readFile(`src/content${route}.md`, 'utf8');
  const frontmatter = source.split('---')[1];
  const pubDate = frontmatter.match(/^pubDate:\s*(\S+)/m)?.[1];
  const updatedDate = frontmatter.match(/^updatedDate:\s*(\S+)/m)?.[1];
  expect(pubDate, `${route} has a publication date`).toBeTruthy();
  if (!pubDate) throw new Error(`Missing pubDate for ${route}`);
  return [pubDate, ...(updatedDate ? [updatedDate] : [])];
}

function expectISODate(actual: string | null, expected: string): void {
  expect(actual).toMatch(
    /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/,
  );
  if (!actual) throw new Error('Missing datetime attribute');
  expect(Number.isNaN(Date.parse(actual))).toBe(false);
  expect(new Date(actual).toISOString()).toBe(new Date(expected).toISOString());
}

test('home time attributes are ISO dates matching each post frontmatter', async ({
  homePage,
}) => {
  await homePage.goto();
  const times = homePage.page.locator('time');
  expect(await times.count()).toBeGreaterThan(0);
  for (const time of await times.all()) {
    const route = await time.locator('xpath=ancestor::a').getAttribute('href');
    expect(route).toBeTruthy();
    if (!route) throw new Error('Missing post link');
    const [pubDate] = await frontmatterDates(route);
    expectISODate(await time.getAttribute('datetime'), pubDate);
  }
});

test('article time attributes are ISO dates matching publication and update frontmatter', async ({
  articlePage,
}) => {
  const route = routes.articleWithCodeBlock;
  const dates = await frontmatterDates(route);
  expect(dates).toHaveLength(2);
  await articlePage.goto(route);
  const times = articlePage.page.locator('time');
  await expect(times).toHaveCount(dates.length);
  for (const [index, date] of dates.entries()) {
    expectISODate(await times.nth(index).getAttribute('datetime'), date);
  }
});
