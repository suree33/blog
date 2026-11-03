import { defineHastPlugin, type HastNode } from 'satteri';

type Element = Extract<HastNode, { type: 'element' }>;
type ElementContent = Element['children'][number];
type Text = Extract<ElementContent, { type: 'text' }>;

/**
 * Callout のアイコン（SVG 要素）を作る。
 *
 * 現在の表示（`rehype-callouts` の既定テーマ obsidian のアイコン）と同じ、
 * Lucide 由来の線画アイコンを 24x24 の viewBox で描く。
 */
function icon(children: ElementContent[]): Element {
  return {
    type: 'element',
    tagName: 'svg',
    properties: {
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
    children,
  };
}

function shape(
  tagName: string,
  properties: Record<string, string>,
): ElementContent {
  return { type: 'element', tagName, properties, children: [] };
}

const noteIcon = (): Element =>
  icon([
    shape('line', { x1: '18', y1: '2', x2: '22', y2: '6' }),
    shape('path', { d: 'M7.5 20.5 19 9l-4-4L3.5 16.5 2 22z' }),
  ]);

const infoIcon = (): Element =>
  icon([
    shape('circle', { cx: '12', cy: '12', r: '10' }),
    shape('line', { x1: '12', y1: '16', x2: '12', y2: '12' }),
    shape('line', { x1: '12', y1: '8', x2: '12.01', y2: '8' }),
  ]);

const tipIcon = (): Element =>
  icon([
    shape('path', {
      d: 'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z',
    }),
  ]);

const warningIcon = (): Element =>
  icon([
    shape('path', {
      d: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z',
    }),
    shape('line', { x1: '12', y1: '9', x2: '12', y2: '13' }),
    shape('line', { x1: '12', y1: '17', x2: '12.01', y2: '17' }),
  ]);

/**
 * 対応する Callout の種類。キーは記法（`[!NOTE]` など）の種類名を小文字にしたもの。
 *
 * GitHub の 5 種類に加えて、記事で使っている `INFO` に対応する。
 * タイトルとアイコンは、これまでの表示（`rehype-callouts` の既定設定）に合わせている。
 */
export const CALLOUT_TYPES = {
  note: { title: 'Note', icon: noteIcon },
  tip: { title: 'Tip', icon: tipIcon },
  important: { title: 'Important', icon: tipIcon },
  warning: { title: 'Warning', icon: warningIcon },
  caution: { title: 'Caution', icon: warningIcon },
  info: { title: 'Info', icon: infoIcon },
} as const satisfies Record<string, { title: string; icon: () => Element }>;

export type CalloutType = keyof typeof CALLOUT_TYPES;

/** Callout が出力する要素のクラス名。スタイルは `src/styles/callout.css` で定義する。 */
export const CALLOUT_CLASS_NAMES = {
  container: 'markdown-callout',
  title: 'markdown-callout-title',
  icon: 'markdown-callout-icon',
  titleText: 'markdown-callout-title-text',
  content: 'markdown-callout-content',
} as const;

/**
 * 1 行目の先頭にある Callout の記法。
 *
 * - `type`: 種類名（大文字小文字は区別しない）
 * - `title`: `]` の後ろに続くカスタムタイトル（任意）
 *
 * `[!NOTE]-` / `[!NOTE]+`（折りたたみ）には対応しないため、`]` の直後は
 * 空白か行末に限る。
 */
const CALLOUT_MARKER = /^\[!(?<type>[A-Za-z]+)\](?=[ \t\n]|$)[ \t]*/;

function isCalloutType(type: string): type is CalloutType {
  return Object.hasOwn(CALLOUT_TYPES, type);
}

function isElement(node: HastNode, tagName?: string): node is Element {
  return (
    node.type === 'element' &&
    (tagName === undefined || node.tagName === tagName)
  );
}

function isWhitespaceText(node: HastNode): boolean {
  return node.type === 'text' && node.value.trim() === '';
}

function text(value: string): Text {
  return { type: 'text', value };
}

function element(
  tagName: string,
  className: string,
  children: ElementContent[],
  properties: Element['properties'] = {},
): Element {
  return {
    type: 'element',
    tagName,
    properties: { className: [className], ...properties },
    children,
  };
}

/** 隣り合うテキストノードを 1 つにまとめる（`[!NOTE]` と後続の文字が分かれていても判定できるように）。 */
function mergeAdjacentText(children: ElementContent[]): ElementContent[] {
  const merged: ElementContent[] = [];
  for (const child of children) {
    const last = merged.at(-1);
    if (child.type === 'text' && last?.type === 'text') {
      merged[merged.length - 1] = text(last.value + child.value);
    } else {
      merged.push(child);
    }
  }
  return merged;
}

/** 前後の空白だけのテキストを取り除き、両端のテキストを trim する。 */
function trimInline(children: ElementContent[]): ElementContent[] {
  const result = [...children];
  const first = result[0];
  if (first?.type === 'text') {
    result[0] = text(first.value.trimStart());
  }
  const lastIndex = result.length - 1;
  const last = result[lastIndex];
  if (last?.type === 'text') {
    result[lastIndex] = text(last.value.trimEnd());
  }
  return result.filter((node) => !(node.type === 'text' && node.value === ''));
}

interface ParsedCallout {
  type: CalloutType;
  /** カスタムタイトル。空なら種類ごとの既定のタイトルを使う。 */
  title: ElementContent[];
  /** Callout の本文になるノード。 */
  body: ElementContent[];
}

/**
 * blockquote が Callout の記法で始まっていれば、種類・タイトル・本文に分解する。
 * Callout でなければ `undefined` を返す。
 */
function parseCallout(
  blockquote: Element,
  transformChildren: (children: ElementContent[]) => ElementContent[],
): ParsedCallout | undefined {
  const blocks = blockquote.children.filter((node) => !isWhitespaceText(node));
  const [firstBlock, ...restBlocks] = blocks;
  if (!firstBlock || !isElement(firstBlock, 'p')) {
    return undefined;
  }

  const inline = mergeAdjacentText(firstBlock.children);
  const [firstInline, ...restInline] = inline;
  if (firstInline?.type !== 'text') {
    return undefined;
  }

  const match = CALLOUT_MARKER.exec(firstInline.value);
  const type = match?.groups?.type?.toLowerCase();
  if (!match || !type || !isCalloutType(type)) {
    return undefined;
  }

  // 記法を取り除いた 1 行目の残り（カスタムタイトル）と、2 行目以降（本文）に分ける。
  const afterMarker: ElementContent[] = [
    text(firstInline.value.slice(match[0].length)),
    ...restInline,
  ];
  const title: ElementContent[] = [];
  let firstParagraphBody: ElementContent[] = [];
  for (const [index, node] of afterMarker.entries()) {
    if (isElement(node, 'br')) {
      // 1 行目の末尾の強制改行（行末の空白 2 つ）はタイトルの区切りとして扱う。
      const rest = afterMarker.slice(index + 1);
      const next = rest[0];
      if (next?.type === 'text') {
        rest[0] = text(next.value.replace(/^\n/, ''));
      }
      firstParagraphBody = rest;
      break;
    }
    if (node.type === 'text' && node.value.includes('\n')) {
      const newlineIndex = node.value.indexOf('\n');
      title.push(text(node.value.slice(0, newlineIndex)));
      firstParagraphBody = [
        text(node.value.slice(newlineIndex + 1)),
        ...afterMarker.slice(index + 1),
      ];
      break;
    }
    title.push(node);
  }

  const paragraphBody = trimInline(firstParagraphBody);
  const body: ElementContent[] = [
    ...(paragraphBody.length > 0
      ? [
          {
            type: 'element' as const,
            tagName: 'p',
            properties: firstBlock.properties,
            children: transformChildren(paragraphBody),
          },
        ]
      : []),
    ...transformChildren(restBlocks),
  ];

  return { type, title: transformChildren(trimInline(title)), body };
}

function buildCallout({ type, title, body }: ParsedCallout): Element {
  const definition = CALLOUT_TYPES[type];
  return element(
    'div',
    CALLOUT_CLASS_NAMES.container,
    [
      element('div', CALLOUT_CLASS_NAMES.title, [
        element('div', CALLOUT_CLASS_NAMES.icon, [definition.icon()], {
          ariaHidden: 'true',
        }),
        element(
          'div',
          CALLOUT_CLASS_NAMES.titleText,
          title.length > 0 ? title : [text(definition.title)],
        ),
      ]),
      element('div', CALLOUT_CLASS_NAMES.content, body),
    ],
    { dataCalloutType: type },
  );
}

/**
 * 子孫も含めて blockquote を Callout に変換する。何も変わらなければ同じノードを返す。
 */
function transformNode<N extends ElementContent>(node: N): N | Element {
  if (!isElement(node)) {
    return node;
  }
  if (node.tagName === 'blockquote') {
    const callout = parseCallout(node, transformChildren);
    if (callout) {
      return buildCallout(callout);
    }
  }
  const children = transformChildren(node.children);
  if (children === node.children) {
    return node;
  }
  return {
    type: 'element',
    tagName: node.tagName,
    properties: node.properties,
    children,
  };
}

function transformChildren(children: ElementContent[]): ElementContent[] {
  let changed = false;
  const result = children.map((child) => {
    const transformed = transformNode(child);
    if (transformed !== child) {
      changed = true;
    }
    return transformed;
  });
  return changed ? result : children;
}

/**
 * GitHub 風の Callout（`> [!NOTE]` などで始まる blockquote）を変換する Sätteri の hast プラグイン。
 *
 * ```markdown
 * > [!NOTE]
 * > 本文
 * ```
 *
 * を次の HTML に変換する。
 *
 * ```html
 * <div class="markdown-callout" data-callout-type="note">
 *   <div class="markdown-callout-title">
 *     <div class="markdown-callout-icon" aria-hidden="true"><svg>…</svg></div>
 *     <div class="markdown-callout-title-text">Note</div>
 *   </div>
 *   <div class="markdown-callout-content"><p>本文</p></div>
 * </div>
 * ```
 *
 * 未対応の種類や、記法で始まらない blockquote はそのまま残す。
 * 詳細は `docs/markdown-callouts.md` を参照。
 */
export const calloutPlugin = defineHastPlugin({
  name: 'callout',
  element: {
    filter: ['blockquote'],
    visit(node, ctx) {
      // 入れ子の blockquote は、いちばん外側の blockquote を処理するときにまとめて変換する。
      // （外側を置き換えた後に内側を置き換えると、内側の変更が捨てられるため）
      for (
        let ancestor: Readonly<HastNode> | undefined = ctx.parent(node);
        ancestor && ancestor.type !== 'root';
        ancestor = ctx.parent(ancestor)
      ) {
        if (isElement(ancestor, 'blockquote')) {
          return;
        }
      }

      const transformed = transformNode(node);
      if (transformed !== node) {
        ctx.replaceNode(node, transformed);
      }
    },
  },
});
