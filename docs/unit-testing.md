# ユニットテスト (Vitest)

このドキュメントでは、Vitest を使ったユニットテストの構成と書き方をまとめます。ブラウザでの表示確認は Playwright（`docs/e2e-testing.md`）、Worker の HTTP 応答境界は Node.js Test Runner（`pnpm run test:worker`）が担当し、Vitest はそれ以外の TypeScript モジュール単位のテストを担当します。

主な用途は、リポジトリ内で所有する Markdown 拡張（Sätteri の mdast / hast プラグイン）の単体テストです。Sätteri のプラグインは Astro のビルドを通さずに、`satteri` の `markdownToHtml` に渡して単体で検証します。

## コマンド

- `pnpm run test:unit`: すべてのユニットテストを 1 回実行する（CI と同じ）
- `pnpm run test:unit:watch`: ウォッチモードで実行する
- 個別のファイルだけ実行する場合: `pnpm exec vitest run tests/unit/satteri.test.ts`

## テストファイルの置き場所

`vitest.config.ts` の `test.include` で、次の 2 か所だけを対象にしています。

| 置き場所                    | 用途                                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------- |
| `src/lib/**/*.test.ts`      | `src/lib/` 配下のモジュールと同じディレクトリに置くテスト（例: `src/lib/markdown/` の Sätteri 拡張） |
| `tests/unit/**/*.test.ts`   | 特定のモジュールに属さないテスト（ライブラリの前提確認など）                             |

- モジュールのテストは、対象ファイルの隣に `<name>.test.ts` として置きます。例: `src/lib/markdown/callout.ts` に対して `src/lib/markdown/callout.test.ts`。
- `src/pages/` 配下に `.ts` を置くと Astro のルート（エンドポイント）になるため、`src/lib/` 以外の `src/` 配下にはテストを置きません。
- `tests/worker/*.test.ts`（Node.js Test Runner）と `tests/e2e/`（Playwright）は Vitest の対象外です。
- テストファイルは Astro のビルドからは import されないため、本番の出力には含まれません。`pnpm run lint`（eslint / `astro check` / `tsc --noEmit`）の対象には含まれます。

## 設定 (`vitest.config.ts`)

- `test.environment`: `node`。Sätteri のプラグインは Node.js 上で動く構文木の変換なので、DOM 環境は使いません。
- `resolve.tsconfigPaths`: `true`。`tsconfig.json` の `paths`（`@lib/*` など）をテストからも解決します。
- Astro の Vite 設定（`getViteConfig()`）は読み込みません。テスト対象は Astro に依存しない純粋な TypeScript モジュールに限ります。

## Sätteri 拡張のテストの書き方

`satteri` は `astro` の依存として入りますが、テストから確実に import できるように devDependency として明示しています。バージョンは Astro（`@astrojs/markdown-satteri`）が使うものに合わせて固定し、Renovate では Astro グループで一緒に更新します。

```typescript
import { defineMdastPlugin, markdownToHtml } from 'satteri';
import { expect, test } from 'vitest';

test('インラインコードを通常のテキストに置き換える', () => {
  const plugin = defineMdastPlugin({
    name: 'strip-inline-code',
    inlineCode(node, ctx) {
      ctx.replaceNode(node, { type: 'text', value: node.value });
    },
  });

  const { html } = markdownToHtml('`let` を使う', { mdastPlugins: [plugin] });

  expect(html.trim(), 'インラインコードが通常のテキストに置き換わる').toBe(
    '<p>let を使う</p>',
  );
});
```

- hast プラグインの `element` visitor は `{ filter: ['a'], visit(node, ctx) { ... } }` のようにタグ名で絞り込む形で書きます（`filter: []` ですべての要素）。
- `markdownToHtml` の出力は末尾に改行が付くことがあるため、完全一致で比較する場合は `trim()` します。
- E2E と同じく、すべての `expect` に期待する結果を表す日本語のメッセージを付けます（`expect(actual, message)`）。
- 表示上の互換性（見た目や利用者から見える振る舞い）は E2E（`markdown-features.spec.ts` / `visual-pages.spec.ts`）で確認します。ユニットテストでは、プラグインが Markdown の記法をどの構文木・HTML に変換するかを確認します。

`tests/unit/satteri.test.ts` は、`markdownToHtml` の呼び出し、frontmatter の分離、mdast / hast プラグインの適用ができることを確かめるスモークテストです。

`tests/unit/posts-layout.test.ts` は、記事の Markdown（`src/pages/posts/*.md`）とテンプレートが frontmatter で `MarkdownPostLayout` を指定していることを確かめます（記事レイアウトは自動適用しないため。`docs/layouts.md` を参照）。

## Shiki transformer のテストの書き方

コードタイトル（`src/lib/markdown/code-title.ts`、`docs/code-title.md`）のような Shiki transformer は、`shiki` の `codeToHtml` にサイトと同じテーマ設定（`themes: { light: 'github-light', dark: 'github-dark' }`、`defaultColor: 'light-dark()'`）と transformer を渡して検証します。Astro と同じく、フェンスのメタ文字列は `meta: { __raw: '...' }` として渡します。

`shiki` も `satteri` と同じく、テストから import するために devDependency として明示し、バージョンを Astro（`@astrojs/internal-helpers`）が使うものに合わせて固定しています。Renovate では Astro グループで一緒に更新します。

## GitHub Actions

`.github/workflows/ci.yml` の `unit`（Unit tests）ジョブで `pnpm run test:unit` を実行します。checkout と pnpm のセットアップは他のジョブと同じ YAML anchor（`*checkout` / `*setup-pnpm`）を再利用します。
