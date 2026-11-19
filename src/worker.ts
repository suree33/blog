interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
}

const POSTS_PATH_PATTERN = /^\/posts\/[^/.]+\/?$/;
const MARKDOWN_POSTS_PATH_PATTERN = /^\/posts\/[^/]+\.md$/;

interface AcceptPreference {
  mediaType: string;
  q: number;
  order: number;
}

const parseQValue = (parameters: string[]) => {
  const quality = parameters.find((parameter) => parameter.startsWith('q='));

  if (!quality) {
    return 1;
  }

  const q = Number.parseFloat(quality.slice(2));

  if (Number.isNaN(q)) {
    return 0;
  }

  return Math.min(Math.max(q, 0), 1);
};

const parseAcceptHeader = (acceptHeader: string | null): AcceptPreference[] =>
  acceptHeader
    ?.split(',')
    .map((mediaRange, order) => {
      const [mediaType, ...parameters] = mediaRange
        .split(';')
        .map((part) => part.trim().toLowerCase());

      return {
        mediaType,
        q: parseQValue(parameters),
        order,
      };
    })
    .filter(({ mediaType }) => mediaType.length > 0) ?? [];

const matchesMediaType = (preference: AcceptPreference, mediaType: string) => {
  const [preferenceType, preferenceSubtype] = preference.mediaType.split('/');
  const [type, subtype] = mediaType.split('/');

  return (
    (preferenceType === '*' || preferenceType === type) &&
    (preferenceSubtype === '*' || preferenceSubtype === subtype)
  );
};

const specificity = (mediaType: string) =>
  mediaType.split('/').filter((part) => part.length > 0 && part !== '*').length;

const bestPreferenceFor = (
  preferences: AcceptPreference[],
  mediaType: string,
) =>
  preferences
    .filter((preference) => matchesMediaType(preference, mediaType))
    .sort(
      (a, b) =>
        specificity(b.mediaType) - specificity(a.mediaType) ||
        b.q - a.q ||
        a.order - b.order,
    )[0];

const prefersMarkdown = (acceptHeader: string | null) => {
  const preferences = parseAcceptHeader(acceptHeader);
  const markdown = bestPreferenceFor(preferences, 'text/markdown');

  if (!markdown || markdown.mediaType !== 'text/markdown' || markdown.q === 0) {
    return false;
  }

  const html = bestPreferenceFor(preferences, 'text/html');

  return (
    !html ||
    markdown.q > html.q ||
    (markdown.q === html.q && markdown.order <= html.order)
  );
};

const addVaryAccept = (response: Response) => {
  const headers = new Headers(response.headers);
  const vary = headers.get('Vary');

  if (!vary) {
    headers.set('Vary', 'Accept');
  } else if (
    !vary.split(',').some((value) => value.trim().toLowerCase() === 'accept')
  ) {
    headers.set('Vary', `${vary}, Accept`);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

const addMarkdownCharset = (response: Response) => {
  const headers = new Headers(response.headers);

  if (headers.get('Content-Type')?.split(';', 1)[0] === 'text/markdown') {
    headers.set('Content-Type', 'text/markdown; charset=utf-8');
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    const shouldReturnMarkdown =
      (request.method === 'GET' || request.method === 'HEAD') &&
      POSTS_PATH_PATTERN.test(url.pathname) &&
      prefersMarkdown(request.headers.get('Accept'));

    if (shouldReturnMarkdown) {
      const markdownUrl = new URL(request.url);
      markdownUrl.pathname = `${url.pathname.replace(/\/$/, '')}.md`;

      const response = await env.ASSETS.fetch(
        new Request(markdownUrl, request),
      );

      return addVaryAccept(addMarkdownCharset(response));
    }

    const response = await env.ASSETS.fetch(request);

    return MARKDOWN_POSTS_PATH_PATTERN.test(url.pathname)
      ? addMarkdownCharset(response)
      : response;
  },
};
