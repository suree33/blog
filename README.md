# sur33.com blog

[![Static Badge](https://img.shields.io/badge/blog-sur33.com-fb5607?style=flat&link=https%3A%2F%2Fsur33.com%2F)](https://sur33.com/)
[![GitHub last commit (branch)](https://img.shields.io/github/last-commit/Suree33/blog/main?style=flat)](https://github.com/Suree33/blog/commits/main/)
[![wakatime](https://wakatime.com/badge/github/Suree33/blog.svg)](https://wakatime.com/badge/github/Suree33/blog)

[![Astro](https://img.shields.io/badge/Astro-0C1222?style=flat&logo=astro&logoColor=FDFDFE)](https://astro.build/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

## 実行方法

### 依存関係のインストール

```bash
pnpm install
```

Node.js と pnpm のバージョンは `package.json` の `devEngines.runtime` と `packageManager` で管理しています。
`pnpm install` が指定バージョンの Node.js を導入し、`pnpm run` と `pnpm exec` はその Node.js で実行します。
解決した正確なバージョンは `pnpm-lock.yaml` に固定されます。
シェルから直接 `node` を実行すると別バージョンになることがあるため、その場合は `pnpm exec node` を使ってください。

### ローカルサーバーの起動

```bash
pnpm run dev
```

### フォーマット

```bash
pnpm run format
```

### テスト

```bash
pnpm run lint          # eslint + astro check + tsc
pnpm run test:unit     # ユニットテスト (Vitest)
pnpm run test:worker   # Worker の HTTP 応答 (Node.js Test Runner)
pnpm run test:e2e      # E2E テスト (Playwright)
```

詳細は [docs/unit-testing.md](docs/unit-testing.md) と [docs/e2e-testing.md](docs/e2e-testing.md) を参照してください。

### ビルド

```bash
pnpm run build
```

### ビルド結果のプレビュー

```bash
pnpm run preview
```

## 使用ツール・サービス

### フレームワーク

- [Astro](https://astro.build/)
- [Tailwind CSS](https://tailwindcss.com/)
  - [Tailwind Typography](https://github.com/tailwindlabs/tailwindcss-typography)

### Remarkプラグイン

- [remark-link-card-plus](https://github.com/okaryo/remark-link-card-plus)

### アセット

- [Astro Icon](https://www.astroicon.dev/)
  - [Iconify](https://iconify.design/)
    - [Font Awesome 6](https://fontawesome.com/)
