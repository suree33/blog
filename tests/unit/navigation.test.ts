import { describe, expect, test } from 'vitest';
import { isNavItemActive } from '../../src/lib/navigation';

describe('isNavItemActive', () => {
  test.each([
    ['/', '/', true],
    ['/', '/posts', true],
    ['/', '/posts/', true],
    ['/', '/posts/example/', true],
    ['/', '/posts-other', true],
    ['/', '/about/', false],
    ['/', '/tags/example/', false],
    ['/about/', '/', false],
    ['/about/', '/about/', true],
    ['/about/', '/about/team/', true],
    ['/about/', '/about', false],
    ['/about/', '/about-other/', false],
    ['/about/', '/posts/example/', false],
  ])('path %j at %j is active: %j', (path, currentPath, expected) => {
    expect(isNavItemActive(path, currentPath)).toBe(expected);
  });
});
