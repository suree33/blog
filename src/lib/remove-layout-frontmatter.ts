export const removeLayoutFrontmatter = (body: string) => {
  if (!body.startsWith('---\n')) {
    return body;
  }

  const frontmatterEndIndex = body.indexOf('\n---', 4);

  if (frontmatterEndIndex === -1) {
    return body;
  }

  const frontmatter = body.slice(4, frontmatterEndIndex + 1);
  const rest = body.slice(frontmatterEndIndex + 1);
  const frontmatterWithoutLayout = frontmatter.replace(/^layout:[^\n]*\n/m, '');

  return `---\n${frontmatterWithoutLayout}${rest}`;
};
