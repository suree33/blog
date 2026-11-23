import type { APIRoute } from 'astro';
import { GET as getSiteMarkdown } from './index.md';

/**
 * llmstxt.org 形式のサイト概要。トップページの Markdown 版と同じ内容を返す。
 */
export const GET = (async (context) => {
  const response = await getSiteMarkdown(context);
  return new Response(response.body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}) satisfies APIRoute;
