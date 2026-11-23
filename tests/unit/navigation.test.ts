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
    ['/', '/tags/', false],
    ['/tags/', '/tags/', true],
    ['/tags/', '/tags/example/', true],
    ['/tags/', '/tags/%E3%82%AC%E3%82%B8%E3%82%A7%E3%83%83%E3%83%88/', true],
    ['/tags/', '/', false],
    ['/tags/', '/posts/example/', false],
    ['/tags/', '/about/', false],
    ['/tags/', '/tags', false],
    ['/tags/', '/tags-other/', false],
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
