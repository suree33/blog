---
name: init-post
description: src/pages/posts/template/_blog-post.md を使って新規ブログ記事 Markdown を初期化する。ブログ記事の下書きを作る依頼、slug・title・description・tags を指定して記事ファイルを生成する依頼、日付入り frontmatter を素早く作る依頼で使用する。
---

# Init Post

このスキルでは、テンプレート `src/pages/posts/template/_blog-post.md` から `src/pages/posts/<slug>.md` を生成する。`pubDate` は指定日付または当日で埋め、`title` `description` `tags` を同時に設定する。

## 実行手順

1. リポジトリルート（`blog/`）で作業する。
2. ユーザーに以下を確認する。

- slug（必須、例: `my-new-post`）
- title（任意）
- description（任意）
- tags（任意、カンマ区切り）
- pubDate（任意、`YYYY-MM-DD`。未指定時は当日）

3. 生成スクリプトを実行する。

```bash
python3 .agents/skills/init-post/scripts/init_post.py \
  --slug my-new-post \
  --title "記事タイトル" \
  --description "記事の概要" \
  --tags "Astro,ブログ" \
  --date 2026-02-14
```

4. 生成先 `src/pages/posts/<slug>.md` を確認し、必要に応じて本文を追記する。

## コマンド仕様

- 必須:
- `--slug`: 出力ファイル名（`.md` なし）
- 任意:
- `--title`: frontmatter `title`
- `--description`: frontmatter `description`
- `--tags`: カンマ区切り（`a,b,c`）
- `--date`: `pubDate`（`YYYY-MM-DD`）
- `--root`: リポジトリルート（通常は不要）
- `--force`: 既存ファイルを上書き

## 実装メモ

- テンプレート内の `pubDate: {{date}}` を置換する。
- 記事レイアウトはテンプレートの `layout: '@layouts/MarkdownPostLayout.astro'` で指定する（自動適用はしない）。生成した記事から `layout` 行を消さない。raw Markdown（`/posts/<slug>.md`）では `layout` 行は除去される。
- 既存ファイルがある場合は `--force` が無ければ失敗させる。

## リソース

- `scripts/init_post.py`: テンプレートから記事ファイルを生成する。
