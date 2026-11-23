import { readFile } from 'node:fs/promises';
import { type Locator } from '@playwright/test';
import { expect, test } from '../fixtures/test';
import { routes } from '../utils/routes';

async function frontmatterDates(route: string): Promise<string[]> {
  const source = await readFile(
    `src/content${route.replace(/\/$/, '')}.md`,
    'utf8',
  );
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

function japaneseLongDate(date: string): string {
  const instant = new Date(date);
  return `${instant.getUTCFullYear()}年${instant.getUTCMonth() + 1}月${instant.getUTCDate()}日`;
}

async function expectPostTime(time: Locator, date: string): Promise<void> {
  expectISODate(await time.getAttribute('datetime'), date);
  await expect(time).toHaveText(japaneseLongDate(date));
}

test('home dates show and encode each post frontmatter date', async ({
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
    await expectPostTime(time, pubDate);
  }
});

test('article dates show and encode publication and update frontmatter', async ({
  articlePage,
}) => {
  const route = routes.articleWithCodeBlock;
  const dates = await frontmatterDates(route);
  expect(dates).toHaveLength(2);
  await articlePage.goto(route);
  const times = articlePage.page.locator('time');
  await expect(times).toHaveCount(dates.length);
  for (const [index, date] of dates.entries()) {
    await expectPostTime(times.nth(index), date);
  }
});
