# Post list

`src/components/PostList.astro` shares the home (`src/pages/index.astro`) and tag
(`src/pages/tags/[tag].astro`) post-list wrapper, container, grid, and `PostItem`
rendering. Its default slot renders inside `.container` before the `ul`, allowing
the tag page to supply its heading. The `posts` prop supplies the list;
`requireUrl` skips entries whose URL is undefined, as required by tag pages.

`sortPostsByDateDescending()` in `src/lib/posts.ts` sorts a copy using descending
publication timestamps. Equal dates retain their input order. Missing or invalid
dates produce a `NaN` comparison, preserving the previous native sort behavior;
they are not assigned a fallback date. URL filtering happens after sorting.
`getPublishedPosts()` retains its existing ID ordering.

Inline fixtures in `tests/unit/posts.test.ts` cover ordering, ties, non-mutation,
empty lists, and missing or invalid dates. Run `pnpm run test:unit` to check them.
