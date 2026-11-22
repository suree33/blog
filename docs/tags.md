# Tags

`src/lib/tags.ts` collects tags from published posts and standalone pages that have `pubDate`.

- `getTagPath(tag)` returns `/tags/<encodeURIComponent(tag)>/`. Use it for every tag link so that Japanese tags and characters such as `%`, `&`, `/`, and spaces produce valid URLs.
- `getPublishedTags()` returns each tag with its posts. `src/pages/tags/[tag].astro` uses it for static paths, and `src/pages/tags/index.astro` (`/tags/`) lists every tag with its post count, most-used first.
- Pass the raw tag to `getStaticPaths()` params. Astro encodes the output path itself; passing an encoded value encodes it twice.
- Astro rewrites `#` and `?` in params as `%23` and `%3F` before it encodes the output path, so a tag containing `#` or `?` gets a double-encoded page path. Avoid those characters in tags.
