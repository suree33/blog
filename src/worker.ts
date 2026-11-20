interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
}

const POSTS_PATH_PATTERN = /^\/posts\/[^/.]+\/?$/;
const MARKDOWN_POSTS_PATH_PATTERN = /^\/posts\/[^/]+\.md$/;

interface AcceptPreference {
  mediaType: string;
  parameters: string[];
  q: number;
  order: number;
}

// Both the HTML and the Markdown variants are served as UTF-8.
const VARIANT_PARAMETERS = new Set(['charset=utf-8']);
const QUOTED_VALUE = /^([^=]+=)"(.*)"$/;

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
        .map((part) => part.trim().toLowerCase().replace(QUOTED_VALUE, '$1$2'));
      const qIndex = parameters.findIndex((parameter) =>
        parameter.startsWith('q='),
      );

      return {
        mediaType,
        parameters: qIndex === -1 ? parameters : parameters.slice(0, qIndex),
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
    (preferenceSubtype === '*' || preferenceSubtype === subtype) &&
    preference.parameters.every((parameter) =>
      VARIANT_PARAMETERS.has(parameter),
    )
  );
};

const typeSpecificity = ({ mediaType }: AcceptPreference) =>
  mediaType.split('/').filter((part) => part.length > 0 && part !== '*').length;

const bestPreferenceFor = (
  preferences: AcceptPreference[],
  mediaType: string,
) =>
  preferences
    .filter((preference) => matchesMediaType(preference, mediaType))
    .sort(
      (a, b) =>
        typeSpecificity(b) - typeSpecificity(a) ||
        b.parameters.length - a.parameters.length ||
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

const addVaryAccept = (headers: Headers) => {
  const vary = headers.get('Vary');

  if (!vary) {
    headers.set('Vary', 'Accept');
  } else if (
    !vary.split(',').some((value) => value.trim().toLowerCase() === 'accept')
  ) {
    headers.set('Vary', `${vary}, Accept`);
  }
};

const addMarkdownCharset = (headers: Headers) => {
  if (headers.get('Content-Type')?.split(';', 1)[0] === 'text/markdown') {
    headers.set('Content-Type', 'text/markdown; charset=utf-8');
  }
};

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    const isNegotiable =
      (request.method === 'GET' || request.method === 'HEAD') &&
      POSTS_PATH_PATTERN.test(url.pathname);
    const isMarkdown =
      isNegotiable && prefersMarkdown(request.headers.get('Accept'));
    let assetRequest = request;

    if (isMarkdown) {
      const markdownUrl = new URL(request.url);
      markdownUrl.pathname = `${url.pathname.replace(/\/$/, '')}.md`;

      assetRequest = new Request(markdownUrl, request);
    }

    const response = await env.ASSETS.fetch(assetRequest);
    const needsMarkdownCharset =
      isMarkdown || MARKDOWN_POSTS_PATH_PATTERN.test(url.pathname);

    if (!isNegotiable && !needsMarkdownCharset) {
      return response;
    }

    const headers = new Headers(response.headers);

    if (needsMarkdownCharset) {
      addMarkdownCharset(headers);
    }

    if (isNegotiable) {
      addVaryAccept(headers);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
