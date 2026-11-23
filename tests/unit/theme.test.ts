import { describe, expect, test } from 'vitest';
import { isTheme, THEMES } from '../../src/types/Theme';

describe('isTheme', () => {
  test.each(THEMES)('accepts %s', (theme) => {
    expect(isTheme(theme)).toBe(true);
  });

  test.each([null, '', 'system', 'Dark', 'light '])('rejects %j', (value) => {
    expect(isTheme(value)).toBe(false);
  });
});
