import { defineHastPlugin, type HastNode } from 'satteri';

type Element = Extract<HastNode, { type: 'element' }>;
type Child = Element['children'][number];

function element(
  tagName: string,
  properties: Element['properties'] = {},
  children: Child[] = [],
): Element {
  return { type: 'element', tagName, properties, children };
}

function text(value: string): Child {
  return { type: 'text', value };
}

const line = (x1: number, y1: number, x2: number, y2: number) =>
  element('line', {
    x1: String(x1),
    y1: String(y1),
    x2: String(x2),
    y2: String(y2),
  });
const path = (d: string) => element('path', { d });

const noteIcon = [
  line(18, 2, 22, 6),
  path('M7.5 20.5 19 9l-4-4L3.5 16.5 2 22z'),
];
const tipIcon = [
  path(
    'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z',
  ),
];
const warningIcon = [
  path(
    'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z',
  ),
  line(12, 9, 12, 13),
  line(12, 17, 12.01, 17),
];
const infoIcon = [
  element('circle', { cx: '12', cy: '12', r: '10' }),
  line(12, 16, 12, 12),
  line(12, 8, 12.01, 8),
];

const callouts = new Map([
  ['note', { title: 'Note', icon: noteIcon }],
  ['tip', { title: 'Tip', icon: tipIcon }],
  ['important', { title: 'Important', icon: tipIcon }],
  ['warning', { title: 'Warning', icon: warningIcon }],
  ['caution', { title: 'Caution', icon: warningIcon }],
  ['info', { title: 'Info', icon: infoIcon }],
]);

function div(
  className: string,
  children: Child[],
  properties: Element['properties'] = {},
) {
  return element('div', { className: [className], ...properties }, children);
}

function splitTitle(
  children: Child[],
): [title: Child[], body: Child[]] | undefined {
  const title: Child[] = [];
  for (const [index, child] of children.entries()) {
    if (child.type === 'element' && child.tagName === 'br') {
      const body = children.slice(index + 1);
      const first = body[0];
      if (first?.type === 'text')
        body[0] = text(first.value.replace(/^\n/, ''));
      return [title, body];
    }
    if (child.type === 'element') {
      const split = splitTitle(child.children);
      if (split) {
        const [before, after] = split;
        if (before.length) title.push({ ...child, children: before });
        const body = children.slice(index + 1);
        if (after.length) body.unshift({ ...child, children: after });
        return [title, body];
      }
    } else if (child.type === 'text') {
      const newline = child.value.indexOf('\n');
      if (newline !== -1) {
        if (newline > 0) title.push(text(child.value.slice(0, newline)));
        const remaining = child.value.slice(newline + 1);
        const rest = children.slice(index + 1);
        return [title, remaining ? [text(remaining), ...rest] : rest];
      }
    }
    title.push(child);
  }
}

export const satteriCallouts = defineHastPlugin({
  name: 'blog-callouts',
  element: {
    filter: ['blockquote'],
    visit(quote) {
      const [paragraph, ...blocks] = quote.children.filter(
        (child) => child.type !== 'text' || child.value !== '\n',
      );
      if (paragraph?.type !== 'element' || paragraph.tagName !== 'p') return;
      const [first, ...inline] = paragraph.children;
      if (first?.type !== 'text') return;

      const marker = /^\[!([a-z]+)\](?=[ \t\n]|$)[ \t]*/i.exec(first.value);
      if (!marker) return;
      const type = marker[1].toLowerCase();
      const callout = callouts.get(type);
      if (!callout) return;

      const afterMarker = first.value.slice(marker[0].length);
      const content = afterMarker ? [text(afterMarker), ...inline] : inline;
      const [title, body] = splitTitle(content) ?? [content, []];
      const icon = element(
        'svg',
        {
          xmlns: 'http://www.w3.org/2000/svg',
          width: '1em',
          height: '1em',
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: '2',
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        },
        callout.icon,
      );
      return div(
        'callout',
        [
          div('callout-title', [
            div('callout-title-icon', [icon], { ariaHidden: 'true' }),
            div(
              'callout-title-text',
              title.length ? title : [text(callout.title)],
            ),
          ]),
          div(
            'callout-content',
            body.length ? [element('p', {}, body), ...blocks] : blocks,
          ),
        ],
        { 'data-callout': type, 'data-collapsible': 'false' },
      );
    },
  },
});
