# Git hooks

Git 2.54 で追加された設定ベース hook を使い、コミット前に CI 相当の静的チェックとビルドを実行します。

## 前提

- Git 2.54 以上
- pnpm
- `pnpm install --frozen-lockfile` による依存関係のインストール

## 導入

clone ごとに一度、次を実行します。

```bash
pnpm run hooks:install
```

登録状態は次のコマンドで確認できます。

```bash
git hook list pre-commit --show-scope
```

`local` scope の `blog-ci` が表示されれば導入済みです。設定はローカルの `.git/config` に保存されるため、clone 時には自動継承されません。

## 実行内容

`git commit` の直前に、次を逐次実行します。

1. `pnpm run format:check`
2. `pnpm run lint`
3. `pnpm run build:ci`

最初の失敗で処理を終了し、コミットを中止します。検査対象はステージ済みファイルだけでなく作業ツリー全体です。Playwright E2E は実行時間とブラウザ・フォント依存が大きいため、GitHub Actions だけで実行します。

## テスト

`install.sh` / `uninstall.sh` / `pre-commit.sh` の挙動は次のコマンドで検証します。GitHub Actions の Lint ジョブでも実行されます。

```bash
pnpm run test:git-hooks
```

## 無効化と解除

この clone で一時的に無効化する場合:

```bash
git config --local hook.blog-ci.enabled false
```

再度有効化する場合:

```bash
git config --local hook.blog-ci.enabled true
```

登録を削除する場合:

```bash
pnpm run hooks:uninstall
```

緊急時は `git commit --no-verify` で1回だけ回避できますが、品質チェックを省略するため常用しません。

## GitHub Copilot CLI hooks との違い

この機能は Git 自身が `git commit` 時に実行する hook です。`.github/hooks/*.json` で設定する GitHub Copilot CLI の lifecycle hook とは独立しており、Copilot CLI を使わないコミットでも実行されます。
