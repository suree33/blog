import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const image = z.object({ src: z.string(), alt: z.string().optional() });
const date = z.union([
  z.string(),
  z.date().transform((value) => value.toISOString().slice(0, 10)),
]);

const posts = defineCollection({
  loader: glob({
    base: '.',
    pattern: [
      'src/content/posts/*.md',
      ...(process.env.E2E_DRAFT_FIXTURE === 'true'
        ? ['tests/e2e/fixtures/posts/*.md']
        : []),
    ],
    generateId: ({ entry }) => entry.replace(/^.*\//, '').replace(/\.md$/, ''),
  }),
  schema: z.object({
    layout: z.string().optional(),
    title: z
      .string()
      .nullish()
      .transform((value) => value ?? ''),
    pubDate: date,
    updatedDate: date.optional(),
    description: z
      .string()
      .nullish()
      .transform((value) => value ?? undefined)
      .optional(),
    tags: z
      .array(z.string())
      .nullish()
      .transform((value) => value ?? undefined)
      .optional(),
    draft: z.boolean().optional(),
    ogimage: z.union([z.string(), image]).optional(),
    image: image.optional(),
  }),
});

export const collections = { posts };
