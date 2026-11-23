export const toMarkdownPath = (pathname: string) =>
  pathname === '/' ? '/index.md' : `${pathname.replace(/\/$/, '')}.md`;
