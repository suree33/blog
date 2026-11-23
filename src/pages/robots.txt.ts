import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const sitemap = new URL('/sitemap-index.xml', site);
  return new Response(
    `User-agent: *
Content-Signal: search=yes, ai-input=yes, ai-train=no
Allow: /

Sitemap: ${sitemap.href}`,
    {
      headers: { 'Content-Type': 'text/plain' },
    },
  );
};
