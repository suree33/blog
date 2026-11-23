import type { APIRoute } from 'astro';
import { buildLlmsTxt } from '@lib/agent-markdown';
import { getPublishedStandalonePageLinks } from '@lib/posts';

/**
 * llmstxt.org 形式のサイト概要。記事は個別に並べず、記事一覧・タグ一覧・固定ページへのリンクだけを載せる。
 */
export const GET = (async ({ site }) => {
  if (!site) {
    throw new Error('`site` must be configured to build /llms.txt');
  }

  return new Response(
    buildLlmsTxt({ site, pages: await getPublishedStandalonePageLinks() }),
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
}) satisfies APIRoute;
