# CI向けスクリプト

## `build:ci`

```bash
pnpm run build:ci
```

CIでビルドだけを実行するためのスクリプトです。

- 実行内容: `astro build`
- `build:ci` 自体のコマンドとして `astro build` を直接実行します。
- `prebuild` は `build` スクリプトに紐づくフック名のため、`pnpm run build:ci` では実行されません。
- このリポジトリのCIでは `lint` を独立ステップで実行しているため、`prebuild` の重複実行を避ける目的で使います。

## `build:e2e`

```bash
pnpm run build:e2e
```

Playwright E2E の `webServer` が使うビルドです。`build:ci` と同じく `prebuild` を経由せずに `astro build` を実行しますが、`TZ=UTC` と `NODE_OPTIONS=--import ./tests/e2e/support/network-stub.ts` を付けて、ビルド時の外部 HTTP（リンクカードの OGP 取得など）を決定的なスタブ応答に置き換えます。本番デプロイには使いません。詳細は [E2E テスト](./e2e-testing.md) を参照してください。

## 使い分け

- ローカル開発: `pnpm run build`
  - `prebuild` が有効で、`pnpm lint` を先に実行します。
- CI: `pnpm run build:ci`
  - `prebuild` をスキップし、ビルドのみ実行します。

## pnpm 12設定

CIでは `package.json` の `packageManager` に従ってpnpm 12を使用します。

- pnpm 12でも `.npmrc` からはauth/registry設定のみを読み、プロジェクトのpnpm設定は `pnpm-workspace.yaml` に集約します。
- 依存パッケージのビルドスクリプト許可は `allowBuilds` で明示します。
- `strictDepBuilds` の既定値が有効なため、未レビューのビルドスクリプトがあると `pnpm install` は失敗します。
- pnpmのバージョンは `package.json` の `packageManager` に正確なバージョンで固定します。pnpmは自身のバージョンが一致しない場合に宣言された版へ自動で切り替えます。固定しているため、`pnpm-workspace.yaml` に未知の設定キーがあるとpnpm 12はエラーで検出してくれます。
- Node.jsのバージョンは `package.json` の `devEngines.runtime` にメジャーの範囲(`^24.0.0`)で指定します。`pnpm install` が範囲内の最新版を導入し、解決した正確なバージョンとチェックサムは `pnpm-lock.yaml` に記録されます。`pnpm run` はそのNode.jsでスクリプトを実行します。
- 範囲で指定しているのは、Cloudflare Workers Builds のビルド環境が独自の Node.js(既定 24.18.0)で動くためです。完全一致で固定するとビルド環境の Node.js と一致せずデプロイが失敗します。Workers Builds の既定がメジャーをまたいだら範囲も更新します。
- そのためCIは `actions/setup-node` を使いません。`pnpm/setup` が `package.json` の `packageManager` と `devEngines.runtime` を読み、pnpm とNode.jsを導入します。`cache: true` でpnpmストア(Node.js runtimeを含む)をキャッシュし、`require-lockfile: true` で `pnpm install --frozen-lockfile` まで実行します。lockfileと `package.json` がずれていればセットアップの時点で失敗します。
- 両バージョンの更新はRenovateが担当します(いずれもnpmマネージャが `packageManager` と `devEngines.runtime` を更新)。pnpmのmajor更新は他のmajor更新と混ぜず単独PRになります。

## Git pre-commit

Git 2.54 の設定ベース pre-commit hook では、CI のうち次のチェックを逐次実行します。

1. `pnpm run format:check`
2. `pnpm run lint`
3. `pnpm run build:ci`

Playwright E2E はブラウザとフォントの環境準備が必要で実行時間も長いため、pre-commit には含めず GitHub Actions で実行します。導入方法は [Git hooks](./git-hooks.md) を参照してください。
