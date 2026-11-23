export const navItems = [
  { path: '/', title: 'Blog' },
  { path: '/tags/', title: 'Tags' },
  { path: '/about/', title: 'About' },
] as const;

export function isNavItemActive(path: string, currentPath: string): boolean {
  const isHomeActive = currentPath === '/' || currentPath.startsWith('/posts');

  return (
    (path === '/' && isHomeActive) ||
    (path !== '/' && currentPath !== '/' && currentPath.startsWith(path))
  );
}
