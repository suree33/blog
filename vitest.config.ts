import { defineConfig } from 'vitest/config';

/**
 * ユニットテスト（Vitest）の設定。
 *
 * - `src/lib/**\/*.test.ts`: `src/lib/` 配下のモジュールと同じディレクトリに置くテスト
 *   （例: `src/lib/markdown/` に置く Sätteri 拡張の単体テスト）
 * - `tests/unit/**\/*.test.ts`: 特定のモジュールに属さないテスト（ライブラリの前提確認など）
 *
 * `tests/worker/` は Node.js Test Runner（`pnpm run test:worker`）、`tests/e2e/` は
 * Playwright の対象なので含めない。`src/pages/` に `.ts` を置くとルートになるため、
 * テストは `src/lib/` 以外の `src/` 配下に置かない。
 *
 * 詳細は `docs/unit-testing.md` を参照。
 */
export default defineConfig({
  resolve: {
    // tsconfig.json の `paths`（`@lib/*` など）をテストからも解決する。
    tsconfigPaths: true,
  },
  test: {
    include: ['src/lib/**/*.test.ts', 'tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
