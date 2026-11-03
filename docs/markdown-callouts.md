# Markdown の Callout

このドキュメントでは、記事の Markdown で使う GitHub 風の Callout（`> [!NOTE]` など）と、それを変換する Sätteri の hast プラグイン `src/lib/markdown/callout.ts` について説明します。

このプラグインは `rehype-callouts`（unified の rehype プラグイン）を置き換えたものです。経緯は `docs/adr/0001-markdown-processor-satteri.md` を参照。

## 記法

blockquote の 1 行目の先頭に `[!種類]` を書きます。

```markdown
> [!NOTE]
> 本文です。
>
> 複数の段落、リスト、コードブロックなども書けます。
```

- 種類名は大文字小文字を区別しません（`[!note]` / `[!Note]` も同じ）。
- `[!種類]` の後ろに文字列を書くと、それがタイトルになります（カスタムタイトル）。強調やコードなどのインライン要素も使えます。

  ```markdown
  > [!WARNING] 料金に注意
  > 本文です。
  ```

- 1 行目の末尾の強制改行（行末の空白 2 つ）は、タイトルと本文の区切りとして扱います。
- 本文のない Callout（`> [!NOTE]` だけ）は、タイトルだけの Callout になります。
- Callout の中の Callout、リスト項目の中の Callout も変換します。

## 対応する種類

| 記法             | 既定のタイトル | アイコン（Lucide） | 色（ライト / ダーク） |
| ---------------- | -------------- | ------------------ | --------------------- |
| `[!NOTE]`        | Note           | pencil             | `#0969da` / `#2f81f7` |
| `[!TIP]`         | Tip            | flame              | `#1a7f37` / `#3fb950` |
| `[!IMPORTANT]`   | Important      | flame              | `#8250df` / `#a371f7` |
| `[!WARNING]`     | Warning        | alert-triangle     | `#9a6700` / `#d29922` |
| `[!CAUTION]`     | Caution        | alert-triangle     | `#d1242f` / `#d1242f` |
| `[!INFO]`        | Info           | info               | `#888` / `#888`       |

GitHub の 5 種類に、記事で使っている `INFO` を加えています。タイトル、アイコン、色、余白は、移行前の表示（`rehype-callouts` を既定の設定で使い、CSS は github テーマを読み込む構成）と同じになるように合わせています。そのため、アイコンは GitHub の Octicons ではなく `rehype-callouts` の既定（obsidian テーマ）の Lucide のアイコンで、`INFO` は色を持たない灰色です。

## Callout にしないもの

次の blockquote は変換せず、通常の blockquote として内容をそのまま残します。

- `[!種類]` で始まらない blockquote
- 対応していない種類（例: `[!TODO]`、`[!DANGER]`）
- `[!種類]` が 1 段落目の先頭にない（文の途中や 2 段落目以降にある、強調などで囲まれている）
- 折りたたみの記法（`[!NOTE]-` / `[!NOTE]+`）や、`]` の直後に空白なしで文字が続くもの

`rehype-callouts`（obsidian テーマの既定設定）は `[!TODO]` などの Obsidian の種類や折りたたみにも対応していましたが、記事では使っていないため対応していません（移行後は通常の blockquote として表示されます）。使う場合はプラグインと CSS に追加します。

## 出力する HTML

```html
<div class="markdown-callout" data-callout-type="note">
  <div class="markdown-callout-title">
    <div class="markdown-callout-icon" aria-hidden="true"><svg>…</svg></div>
    <div class="markdown-callout-title-text">Note</div>
  </div>
  <div class="markdown-callout-content"><p>本文です。</p></div>
</div>
```

- クラス名は `rehype-callouts` のもの（`callout` / `callout-title` など）と重ならない `markdown-callout-*` を使います。
- 種類は `data-callout-type` 属性に小文字で出力します。
- アイコンは装飾なので `aria-hidden="true"` を付けます。

## スタイル (`src/styles/callout.css`)

`rehype-callouts` の github テーマの CSS と、`src/styles/global.css` の `.callout-title-icon svg { fill: none; }` を合わせた内容を、上記のクラス名で書き直したものです。

- ダークモードは `rehype-callouts` と同じく `<html>` に `.dark` クラスがあるときだけ切り替えます。テーマを「OS の設定」にしている場合（クラスなし）は、OS がダークでもライトの色になります（これまでの表示と同じ）。

## Astro への組み込み

- `astro.config.mjs` の `markdown.processor: satteri({ hastPlugins: [calloutPlugin] })` で組み込んでいます。Astro の Sätteri の処理では、ユーザーの hast プラグインはシンタックスハイライトの後、画像の処理と見出しの `id` 付けの前に実行されます。
- スタイルは `src/styles/global.css` から `@import './callout.css'` で読み込みます。

## テスト

- `src/lib/markdown/callout.test.ts`: `satteri` の `markdownToHtml` にプラグインを渡し、各種類、カスタムタイトル、本文（複数段落、リスト、コードブロック、入れ子）、Callout にしないものを確認します。実行方法は `docs/unit-testing.md` を参照。
- 見た目は E2E（`tests/e2e/specs/markdown-features.spec.ts` の Callout のテストと `visual-pages.spec.ts`）で確認します。
