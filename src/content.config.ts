import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { withLinkCardImages } from './lib/markdown/link-card-assets';

const requiredText = z.string().trim().min(1);
const image = z.object({ src: z.string(), alt: requiredText });
const date = z.union([
  z.string(),
  z.date().transform((value) => value.toISOString().slice(0, 10)),
]);

const posts = defineCollection({
  loader: withLinkCardImages(
    glob({
      base: '.',
      pattern: [
        'src/content/posts/*.md',
        ...(process.env.E2E_DRAFT_FIXTURE === 'true'
          ? ['tests/e2e/fixtures/posts/*.md']
          : []),
      ],
      generateId: ({ entry }) =>
        entry.replace(/^.*\//, '').replace(/\.md$/, ''),
    }),
  ),
  schema: z.object({
    layout: z.string().optional(),
    title: requiredText,
    pubDate: date.pipe(requiredText),
    updatedDate: date.optional(),
    description: requiredText,
    tags: z.array(requiredText).min(1),
    draft: z.boolean().optional(),
    ogimage: z.union([z.string(), image]).optional(),
    image: image.optional(),
  }),
});

export const collections = { posts };
