import { afterEach, describe, expect, test } from 'vitest';
import { formatDate } from '../../src/scripts/date';

const originalTZ = process.env.TZ;

afterEach(() => {
  process.env.TZ = originalTZ;
});

describe('formatDate', () => {
  test.each([
    'UTC',
    'Asia/Tokyo',
    'America/Los_Angeles',
    'Pacific/Pago_Pago',
    'Pacific/Kiritimati',
  ])('keeps the frontmatter calendar date when built in %s', (timeZone) => {
    process.env.TZ = timeZone;
    expect(formatDate('2024-07-05')).toBe('2024年7月5日');
    expect(formatDate('2026-01-01')).toBe('2026年1月1日');
  });

  test.each([null, undefined, '', '   ', 'not a date'])(
    'returns false for %j',
    (input) => {
      expect(formatDate(input)).toBe(false);
    },
  );
});
