# Suree33's blog repo

## プロジェクト概要

Astro + TypeScript + Tailwind CSSで構築されたDaiki Satoの個人ブログ (sur33.com)。pnpmをパッケージマネージャーとして使用し、Cloudflare Workersでホスティング。

## コマンド

コマンド一覧は `package.json` の `scripts` を参照。`prebuild` で `pnpm run lint` が走るため、lint が赤いと build も失敗する点に注意。

## 規約

- 複数のCSSクラスを結合する場合は `src/lib/utils.ts` の `cn()` を使用する。テンプレート文字列による手動連結も、条件付きクラスの手動表現もしない
- 実装や修正を始める前に、関連する `docs/` のドキュメントを能動的に参照する。新機能・新コンポーネント・カスタムコマンドの実装時と、既存機能の大幅な変更時は `docs/` を追加・更新する
- コード変更後は `pnpm run lint`（oxlint + eslint（.astro のみ）+ astro check + tsc）を通す

## Skills

- 新規ブログ記事を追加する必要がある場合、またはユーザーから新規記事追加を依頼された場合は、必ず `init-post` スキルを使用する。

## Workflow

- Issue と PRD は GitHub Issues で管理する（`gh` CLI を使用）。詳細は `docs/agents/issue-tracker.md` を参照。
- トリアージ語彙（needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix）。詳細は `docs/agents/triage-labels.md` を参照。
- Domain docs の参照方法は `docs/agents/domain.md` に従う。
